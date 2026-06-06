'use client';

import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Horizon } from '@stellar/stellar-sdk';
import { HORIZON_URL } from '@/lib/stellar';
import QRScanner from './QRScanner';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  addDoc, 
  orderBy,
  getDocs
} from 'firebase/firestore';
import { 
  Plus, Trash2, ShoppingCart, Tag, History, CheckCircle2, 
  ArrowRight, X, Printer, Package, ChevronRight, AlertCircle, RefreshCw, Loader2
} from 'lucide-react';

const horizon = new Horizon.Server(HORIZON_URL);

interface Product {
  id: string;
  name: string;
  price: number; // in XLM
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface Receipt {
  id: string;
  timestamp: number;
  items: CartItem[];
  total: number;
  memo: string;
  txHash: string;
}

interface PosSystemProps {
  ownerAddress: string;
}

export default function PosSystem({ ownerAddress }: PosSystemProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'history'>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  // Inventory form
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  
  // Checkout & Payment State
  const [checkoutState, setCheckoutState] = useState<'idle' | 'waiting' | 'paid'>('idle');
  const [activeMemo, setActiveMemo] = useState('');
  const [activeTotal, setActiveTotal] = useState(0);
  const [activeTxHash, setActiveTxHash] = useState('');
  const [pollingError, setPollingError] = useState<string | null>(null);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Firestore synchronizer & LocalStorage migration
  useEffect(() => {
    if (!user) return;

    const syncAndListen = async () => {
      setLoadingData(true);

      const productsRef = collection(db, 'products');
      const receiptsRef = collection(db, 'receipts');

      // 1. Check if Firestore contains any products for this user
      const productsQuery = query(productsRef, where('uid', '==', user.uid));
      const productsSnap = await getDocs(productsQuery);
      
      const receiptsQuery = query(receiptsRef, where('uid', '==', user.uid));
      const receiptsSnap = await getDocs(receiptsQuery);

      const dbHasProducts = !productsSnap.empty;
      const dbHasReceipts = !receiptsSnap.empty;

      // 2. Perform Migration if Firestore is empty but LocalStorage has data
      const storedProductsStr = localStorage.getItem(`sari_products_${ownerAddress}`);
      const storedReceiptsStr = localStorage.getItem(`sari_receipts_${ownerAddress}`);

      if (storedProductsStr && !dbHasProducts) {
        try {
          const localProducts = JSON.parse(storedProductsStr) as Product[];
          for (const prod of localProducts) {
            await setDoc(doc(db, 'products', prod.id), {
              id: prod.id,
              name: prod.name,
              price: prod.price,
              uid: user.uid,
              ownerAddress: ownerAddress,
              createdAt: Date.now()
            });
          }
          console.log('Successfully migrated products from local storage to Firestore.');
        } catch (err) {
          console.error('Failed to migrate local products:', err);
        }
      } else if (!storedProductsStr && !dbHasProducts) {
        // Prepopulate default mock products in Firestore on very first access
        const mockProducts: Product[] = [
          { id: 'prod_coke', name: 'Coca-Cola 1.5L', price: 5.0 },
          { id: 'prod_lucky_me', name: 'Lucky Me Instant Noodles', price: 2.0 },
          { id: 'prod_nagaraya', name: 'Nagaraya Garlic 80g', price: 1.5 },
          { id: 'prod_fudgee', name: 'Fudgee Barr Chocolate', price: 1.0 },
        ];
        for (const prod of mockProducts) {
          await setDoc(doc(db, 'products', prod.id), {
            id: prod.id,
            name: prod.name,
            price: prod.price,
            uid: user.uid,
            ownerAddress: ownerAddress,
            createdAt: Date.now()
          });
        }
      }

      if (storedReceiptsStr && !dbHasReceipts) {
        try {
          const localReceipts = JSON.parse(storedReceiptsStr) as Receipt[];
          for (const rec of localReceipts) {
            await addDoc(collection(db, 'receipts'), {
              timestamp: rec.timestamp,
              items: rec.items,
              total: rec.total,
              memo: rec.memo,
              txHash: rec.txHash,
              uid: user.uid,
              merchantAddress: ownerAddress
            });
          }
          console.log('Successfully migrated receipts from local storage to Firestore.');
        } catch (err) {
          console.error('Failed to migrate local receipts:', err);
        }
      }

      // Cleanup local storage after migration
      localStorage.removeItem(`sari_products_${ownerAddress}`);
      localStorage.removeItem(`sari_receipts_${ownerAddress}`);

      // 3. Set up Real-time listener for Products
      const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
        const prodsList: Product[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          prodsList.push({
            id: data.id,
            name: data.name,
            price: data.price
          });
        });
        setProducts(prodsList);
        setLoadingData(false);
      });

      // 4. Set up Real-time listener for Receipts
      const unsubscribeReceipts = onSnapshot(
        query(receiptsRef, where('uid', '==', user.uid), orderBy('timestamp', 'desc')),
        (snapshot) => {
          const recList: Receipt[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            recList.push({
              id: docSnap.id,
              timestamp: data.timestamp,
              items: data.items,
              total: data.total,
              memo: data.memo,
              txHash: data.txHash
            });
          });
          setReceipts(recList);
        },
        (err) => {
          console.error('Receipts listener error:', err);
        }
      );

      return () => {
        unsubscribeProducts();
        unsubscribeReceipts();
      };
    };

    const cleanupPromise = syncAndListen();
    return () => {
      cleanupPromise.then((cleanup) => {
        if (cleanup) cleanup();
      });
    };
  }, [user, ownerAddress]);

  // Add Product to Inventory in Firestore
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newProductName.trim() || !newProductPrice) return;
    
    const priceNum = parseFloat(newProductPrice);
    if (isNaN(priceNum) || priceNum <= 0) return;

    const prodId = `prod_${Date.now()}`;
    try {
      await setDoc(doc(db, 'products', prodId), {
        id: prodId,
        name: newProductName.trim(),
        price: priceNum,
        uid: user.uid,
        ownerAddress: ownerAddress,
        createdAt: Date.now()
      });
      setNewProductName('');
      setNewProductPrice('');
    } catch (err) {
      console.error('Failed to add product:', err);
      alert('Failed to save product to database.');
    }
  };

  // Delete Product from Firestore
  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id));
      // Remove from cart if exists
      setCart((prev) => prev.filter((item) => item.product.id !== id));
    } catch (err) {
      console.error('Failed to delete product:', err);
      alert('Failed to delete product.');
    }
  };

  // Add Item to Cart (from manual list or scanning)
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  // Handle scanned product barcode (Product ID)
  const handleBarcodeScanned = (scannedText: string) => {
    const product = products.find((p) => p.id === scannedText);
    if (product) {
      addToCart(product);
    } else {
      alert(`Scanned code "${scannedText}" does not match any product in inventory.`);
    }
  };

  // Cart quantity controls
  const updateCartQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const clearCart = () => setCart([]);

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  };

  // Checkout process
  const startCheckout = () => {
    if (cart.length === 0) return;
    
    // Generate unique memo: sari-[random 5 digit number]
    const randDigits = Math.floor(10000 + Math.random() * 90000);
    const memo = `sari-${randDigits}`;
    const total = getCartTotal();

    setActiveMemo(memo);
    setActiveTotal(total);
    setCheckoutState('waiting');
    setPollingError(null);
  };

  // Poll Horizon for payment matching the activeMemo
  useEffect(() => {
    if (checkoutState !== 'waiting' || !user) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const checkPayment = async () => {
      try {
        const txs = await horizon.transactions().forAccount(ownerAddress).order('desc').limit(10).call();
        
        for (const tx of txs.records) {
          if (tx.memo === activeMemo && tx.successful) {
            // Fetch operations for this transaction to verify the amount and recipient
            const opsPage = await tx.operations();
            let hasValidPayment = false;

            for (const op of opsPage.records) {
              const opPayment = op as unknown as {
                type: string;
                to?: string;
                asset_type?: string;
                amount?: string;
              };
              if (
                opPayment.type === 'payment' &&
                opPayment.to === ownerAddress &&
                opPayment.asset_type === 'native' &&
                opPayment.amount
              ) {
                const amountPaid = parseFloat(opPayment.amount);
                // Allow a tiny margin for float representation issues
                if (Math.abs(amountPaid - activeTotal) < 0.00001) {
                  hasValidPayment = true;
                  break;
                }
              }
            }

            if (!hasValidPayment) {
              console.warn(
                `Transaction ${tx.hash} matched memo ${activeMemo} but did not contain a valid payment of ${activeTotal} XLM to ${ownerAddress}.`
              );
              continue; // Keep looking at other transactions
            }

            // Found successful transaction matching the memo and verifying payment details!
            setActiveTxHash(tx.hash);
            setCheckoutState('paid');
            
            // Save receipt to Firestore
            await addDoc(collection(db, 'receipts'), {
              timestamp: Date.now(),
              items: cart,
              total: activeTotal,
              memo: activeMemo,
              txHash: tx.hash,
              uid: user.uid,
              merchantAddress: ownerAddress,
            });
            
            // Clear cart
            setCart([]);
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            break;
          }
        }
      } catch (err) {
        console.error('Error polling Horizon for payments:', err);
        setPollingError('Network connection issue. Retrying...');
      }
    };

    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(checkPayment, 2000);
    
    // Initial check immediately
    checkPayment();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [checkoutState, activeMemo, ownerAddress, activeTotal, cart, user]);

  // Simulate payment (bypasses blockchain for quick debugging on testnet if needed)
  const simulatePaymentSuccess = async () => {
    if (!user) return;
    const mockHash = 'sim_hash_' + Math.random().toString(36).substring(7);
    setActiveTxHash(mockHash);
    setCheckoutState('paid');
    
    try {
      await addDoc(collection(db, 'receipts'), {
        timestamp: Date.now(),
        items: cart,
        total: activeTotal,
        memo: activeMemo,
        txHash: mockHash,
        uid: user.uid,
        merchantAddress: ownerAddress,
      });
      setCart([]);
    } catch (err) {
      console.error('Failed to save simulated payment:', err);
    }
  };

  // Final URL that customer scans to open the web app customer checkout page
  const getPaymentUrl = () => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/customer?to=${ownerAddress}&amount=${activeTotal}&memo=${activeMemo}`;
  };

  const simulateCustomerRedirect = () => {
    window.open(getPaymentUrl(), '_blank');
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Navigation tabs */}
      <div className="flex border-b border-card-border p-1 bg-black/20 rounded-xl max-w-sm glass">
        <button
          onClick={() => setActiveTab('pos')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'pos' ? 'bg-[#ff7a00] text-white shadow-md' : 'text-gray-400 hover:text-white'
          }`}
        >
          <ShoppingCart className="w-4 h-4" /> POS Cart
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'inventory' ? 'bg-[#ff7a00] text-white shadow-md' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Package className="w-4 h-4" /> Products
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'history' ? 'bg-[#ff7a00] text-white shadow-md' : 'text-gray-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" /> Sales
        </button>
      </div>

      {loadingData && activeTab !== 'pos' ? (
        <div className="py-12 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff7a00]" />
          <p className="text-xs">Loading database records...</p>
        </div>
      ) : null}

      {/* POS Cart Tab */}
      {activeTab === 'pos' && checkoutState === 'idle' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart items */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="glass rounded-2xl p-5 flex flex-col gap-4 border border-card-border">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-white">Active Purchase</h3>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs text-red-400 hover:underline flex items-center gap-1"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="py-12 text-center text-gray-500 flex flex-col items-center gap-2">
                  <ShoppingCart className="w-12 h-12 text-gray-700" />
                  <p className="text-sm">Your cart is empty.</p>
                  <p className="text-xs max-w-[250px]">Scan product codes using the side panel or click products below to manually add items.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition"
                    >
                      <div>
                        <h4 className="font-semibold text-sm text-white">{item.product.name}</h4>
                        <p className="text-xs text-gray-400">{item.product.price.toFixed(2)} XLM each</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 border border-white/10 rounded-lg p-1 bg-black/20">
                          <button
                            onClick={() => updateCartQuantity(item.product.id, -1)}
                            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white rounded hover:bg-white/5"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(item.product.id, 1)}
                            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white rounded hover:bg-white/5"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => updateCartQuantity(item.product.id, -item.quantity)}
                          className="text-gray-500 hover:text-red-400 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Catalog List */}
            <div className="glass rounded-2xl p-5 border border-card-border flex flex-col gap-3">
              <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-[#ffc700]" /> Quick Catalog Add
              </h4>
              {products.length === 0 ? (
                <p className="text-xs text-gray-500">No products configured. Set them up in the Products tab.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[160px] overflow-y-auto pr-1">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="p-2.5 rounded-xl bg-[#161c24] hover:bg-white/5 border border-white/5 text-left transition flex flex-col gap-1 group"
                    >
                      <span className="font-semibold text-xs text-white truncate w-full group-hover:text-[#ff7a00]">{p.name}</span>
                      <span className="text-[10px] text-[#ffc700] font-bold">{p.price.toFixed(2)} XLM</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Scanner Panel */}
          <div>
            <QRScanner
              onScanSuccess={handleBarcodeScanned}
              placeholderText="Scan a product QR code to add to cart"
              manualLabel="Manual Entry"
              manualOptions={products.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.price} XLM)`,
              }))}
            />

            {cart.length > 0 && (
              <div className="mt-4 p-5 rounded-2xl bg-linear-to-br from-[#ff7a00]/10 to-transparent border border-[#ff7a00]/20 flex flex-col gap-4">
                <div className="flex justify-between items-end">
                  <span className="text-xs text-gray-400">Grand Total</span>
                  <span className="text-2xl font-bold text-white font-mono flex items-baseline gap-1">
                    {getCartTotal().toFixed(2)} <span className="text-xs text-[#ffc700] font-sans">XLM</span>
                  </span>
                </div>
                <button
                  onClick={startCheckout}
                  className="w-full bg-[#ff7a00] hover:bg-[#e06b00] text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-[#ff7a00]/25 transition flex items-center justify-center gap-2 group"
                >
                  Checkout Purchase <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* POS Cart Tab - Checkout & Waiting for Payment */}
      {activeTab === 'pos' && checkoutState === 'waiting' && (
        <div className="max-w-md mx-auto w-full glass rounded-3xl p-6 border border-card-border flex flex-col items-center gap-6 relative">
          <button
            onClick={() => setCheckoutState('idle')}
            className="absolute top-4 right-4 text-gray-500 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center">
            <span className="bg-[#ffc700]/10 border border-[#ffc700]/20 text-[#ffc700] text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full">
              Invoice Generated
            </span>
            <h3 className="font-bold text-xl text-white mt-3">Waiting for Customer Payment</h3>
            <p className="text-xs text-gray-400 mt-1">Scan the QR code below on the customer&apos;s phone to pay.</p>
          </div>

          {/* QR Code Container */}
          <div className="bg-white p-4 rounded-2xl shadow-xl flex items-center justify-center border border-gray-100">
            <QRCodeSVG value={getPaymentUrl()} size={200} />
          </div>

          <div className="w-full bg-black/20 rounded-2xl p-4 border border-white/5 flex flex-col gap-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Merchant Address</span>
              <span className="font-mono text-white">{ownerAddress.slice(0, 6)}...{ownerAddress.slice(-6)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Payment Memo</span>
              <span className="font-mono text-[#ffc700] font-bold">{activeMemo}</span>
            </div>
            <div className="border-t border-white/5 my-1 pt-2 flex justify-between text-sm font-bold text-white">
              <span>Amount Due</span>
              <span className="font-mono text-[#00c853]">{activeTotal.toFixed(2)} XLM</span>
            </div>
          </div>

          {/* Live Polling Status */}
          <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
            <RefreshCw className="w-4 h-4 animate-spin text-[#ff7a00]" />
            <span>Listening to the Stellar blockchain for payment...</span>
          </div>

          {pollingError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg p-2.5 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{pollingError}</span>
            </div>
          )}

          {/* Simulator actions */}
          <div className="w-full border-t border-white/5 pt-4 flex flex-col gap-2">
            <button
              onClick={simulateCustomerRedirect}
              className="w-full bg-white/5 hover:bg-white/10 text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition border border-white/10"
            >
              Simulate: Open Customer Pay Tab
            </button>
            <button
              onClick={simulatePaymentSuccess}
              className="w-full bg-[#00c853]/15 hover:bg-[#00c853]/25 text-[#00c853] text-xs font-bold py-2 px-4 rounded-xl transition border border-[#00c853]/25"
            >
              Simulate: Force On-Chain Payment
            </button>
          </div>
        </div>
      )}

      {/* POS Cart Tab - Payment Successful / Receipt */}
      {activeTab === 'pos' && checkoutState === 'paid' && (
        <div className="max-w-md mx-auto w-full glass rounded-3xl p-6 border border-card-border flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#00c853]/10 border border-[#00c853]/30 flex items-center justify-center text-[#00c853] animate-bounce-slow">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h3 className="font-bold text-xl text-white">Payment Received!</h3>
            <p className="text-xs text-gray-400 mt-1">Transaction successfully settled on Stellar testnet.</p>
          </div>

          <div className="w-full border-t border-b border-dashed border-white/10 py-4 flex flex-col gap-2.5 text-left text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Transaction Hash</span>
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${activeTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[#ff7a00] hover:underline"
              >
                {activeTxHash.slice(0, 8)}...{activeTxHash.slice(-8)}
              </a>
            </div>
            <div className="flex justify-between">
              <span>Date / Time</span>
              <span className="text-white">{new Date().toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Reference Memo</span>
              <span className="font-mono text-white">{activeMemo}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white mt-1 pt-2 border-t border-white/5">
              <span>Total Received</span>
              <span className="font-mono text-[#00c853]">{activeTotal.toFixed(2)} XLM</span>
            </div>
          </div>

          <div className="flex gap-3 w-full">
            <button
              onClick={() => setCheckoutState('idle')}
              className="flex-1 bg-[#ff7a00] hover:bg-[#e06b00] text-white font-bold py-3 px-4 rounded-xl shadow-lg transition"
            >
              New Sale
            </button>
            <button
              onClick={() => {
                window.print();
              }}
              className="bg-white/5 hover:bg-white/10 text-white p-3 rounded-xl border border-white/10 transition"
              title="Print Receipt"
            >
              <Printer className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Products Tab (Inventory Catalog) */}
      {activeTab === 'inventory' && !loadingData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Add product form */}
          <div className="glass rounded-2xl p-5 border border-card-border flex flex-col gap-4 self-start">
            <h3 className="font-bold text-base text-white">Add New Product</h3>
            <form onSubmit={handleAddProduct} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-gray-400 font-medium">Product Name</label>
                <input
                  type="text"
                  placeholder="e.g. Pancit Canton"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="bg-[#161c24] border border-card-border rounded-xl p-2.5 text-xs text-white placeholder-gray-600 outline-none focus:border-[#ff7a00] transition"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-gray-400 font-medium">Price (XLM)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 2.50"
                  value={newProductPrice}
                  onChange={(e) => setNewProductPrice(e.target.value)}
                  className="bg-[#161c24] border border-card-border rounded-xl p-2.5 text-xs text-white placeholder-gray-600 outline-none focus:border-[#ff7a00] transition"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#ff7a00] hover:bg-[#e06b00] text-white font-semibold py-2.5 rounded-xl transition mt-2 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Save Product
              </button>
            </form>
          </div>

          {/* Catalog grid */}
          <div className="md:col-span-2 glass rounded-2xl p-5 border border-card-border flex flex-col gap-4">
            <h3 className="font-bold text-base text-white">Product Catalog</h3>
            {products.length === 0 ? (
              <p className="text-xs text-gray-500 py-6 text-center">No products in inventory.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col gap-3 p-4 rounded-xl bg-[#161c24]/50 border border-white/5 hover:border-white/10 transition group relative"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="font-bold text-xs text-white">{p.name}</h4>
                        <p className="text-[10px] text-[#ffc700] font-bold mt-0.5">{p.price.toFixed(2)} XLM</p>
                      </div>
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className="text-gray-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition absolute top-2 right-2"
                        title="Delete Product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Product barcode representation */}
                    <div className="flex items-center gap-3 bg-black/30 p-2 rounded-lg border border-white/5 mt-auto">
                      <div className="bg-white p-1 rounded border border-gray-200">
                        <QRCodeSVG value={p.id} size={50} />
                      </div>
                      <div>
                        <span className="text-[10px] block font-mono text-gray-500">ID barcode:</span>
                        <span className="text-[10px] font-mono font-bold text-gray-400 truncate max-w-[120px] block">{p.id}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sales History Tab */}
      {activeTab === 'history' && !loadingData && (
        <div className="glass rounded-2xl p-5 border border-card-border flex flex-col gap-4">
          <h3 className="font-bold text-base text-white">Completed Sales</h3>
          {receipts.length === 0 ? (
            <div className="py-12 text-center text-gray-500 flex flex-col items-center gap-2">
              <History className="w-12 h-12 text-gray-700" />
              <p className="text-sm">No sales history yet.</p>
              <p className="text-xs">Your completed on-chain POS transactions will show up here.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-1">
              {receipts.map((rec) => (
                <div
                  key={rec.id}
                  className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition flex flex-col gap-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
                    <div>
                      <span className="font-semibold text-xs text-white">Invoice {rec.memo}</span>
                      <span className="text-[10px] text-gray-500 block">{new Date(rec.timestamp).toLocaleString()}</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#00c853] bg-[#00c853]/10 border border-[#00c853]/20 px-2.5 py-0.5 rounded-full">
                      +{rec.total.toFixed(2)} XLM
                    </span>
                  </div>

                  {/* Items purchased */}
                  <div className="flex flex-col gap-1 text-[11px] text-gray-400">
                    {rec.items.map((item) => (
                      <div key={item.product.id} className="flex justify-between">
                        <span>
                          {item.product.name} <span className="text-gray-500">x{item.quantity}</span>
                        </span>
                        <span className="font-mono">{(item.product.price * item.quantity).toFixed(2)} XLM</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-gray-500 border-t border-white/5 pt-2">
                    <span>Tx: <span className="font-mono">{rec.txHash.slice(0, 10)}...</span></span>
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${rec.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#ff7a00] hover:underline flex items-center gap-0.5"
                    >
                      View on explorer <ChevronRight className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
