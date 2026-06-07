'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/hooks/useWallet';
import { useAuth } from '@/context/AuthContext';
import { fetchBalances, Balances } from '@/lib/balances';
import { fundTestnetAccount } from '@/lib/stellar';
import { 
  getAllStores, 
  buildRegisterStoreXDR, 
  buildDeregisterStoreXDR, 
  Store 
} from '@/lib/registryContract';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { signAndSubmit } from '@/lib/sign';
import PosSystem from '@/components/PosSystem';
import ConnectWallet from '@/components/ConnectWallet';
import { 
  Store as StoreIcon, MapPin, Navigation, Loader2, 
  AlertCircle, Wallet, ArrowLeft, RefreshCw, LogOut, CheckCircle2 
} from 'lucide-react';

// Dynamically import Map component (ssr: false) to prevent Next.js build errors
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[350px] bg-black/40 rounded-2xl flex items-center justify-center border border-white/5 animate-pulse text-gray-500 text-xs">
      Loading Interactive Map...
    </div>
  ),
});

export default function MerchantPage() {
  const router = useRouter();
  const wallet = useWallet();
  const { publicKey, connect, connecting } = wallet;
  const { user, profile, loading: authLoading, logOut, linkWalletAddress } = useAuth();

  // Store registration form state
  const [storeName, setStoreName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  
  const [registering, setRegistering] = useState(false);
  const [deregistering, setDeregistering] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Loaded contract data
  const [stores, setStores] = useState<Store[]>([]);
  const [merchantStore, setMerchantStore] = useState<Store | null>(null);
  const [loadingStore, setLoadingStore] = useState(false);

  // Wallet balances
  const [balances, setBalances] = useState<Balances | null>(null);
  const [funding, setFunding] = useState(false);

  // Route guarding redirect
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  // Load balances
  const getBalances = useCallback(async () => {
    if (!publicKey) return;
    try {
      const b = await fetchBalances(publicKey);
      setBalances(b);
    } catch (err) {
      console.error('Failed to load balances:', err);
    }
  }, [publicKey]);

  useEffect(() => {
    if (publicKey) {
      const initStoreData = async () => {
        setLoadingStore(true);
        try {
          const allStores = await getAllStores();
          setStores(allStores);
        } catch (err) {
          console.error('Failed to load stores:', err);
        }
        
        // Load balances safely inside async context
        await getBalances();
      };
      
      initStoreData();

      // Real-time listener for the merchant's store
      const unsubscribe = onSnapshot(
        doc(db, 'stores', publicKey),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setMerchantStore({
              owner: data.owner,
              name: data.name,
              lat: data.lat,
              lng: data.lng,
            } as Store);
            setSyncing(false); // Stop syncing if we get the store
          } else {
            setMerchantStore(null);
          }
          setLoadingStore(false);
        },
        (error) => {
          console.error('Error listening to store:', error);
          setActionError('Could not fetch store registry from Firestore.');
          setLoadingStore(false);
        }
      );

      return () => unsubscribe();
    } else {
      const clearState = async () => {
        setMerchantStore(null);
        setBalances(null);
        setStores([]);
      };
      clearState();
    }
  }, [publicKey, getBalances]);

  // Fund wallet via Friendbot
  const handleFund = async () => {
    if (!publicKey) return;
    setFunding(true);
    try {
      await fundTestnetAccount(publicKey);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await getBalances();
    } catch (err) {
      console.error(err);
      alert('Friendbot funding failed.');
    } finally {
      setFunding(false);
    }
  };

  // Get current GPS location
  const handleGetLocation = () => {
    setGpsLoading(true);
    setActionError(null);
    if (!navigator.geolocation) {
      setActionError('Geolocation is not supported by your browser.');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
        setGpsLoading(false);
      },
      (error) => {
        console.warn('GPS location fallback triggered:', error.message);
        // Fallback to Quezon City
        setLat('14.6507');
        setLng('121.0506');
        setActionError('GPS access denied or unavailable. Defaulted coordinates to Quezon City.');
        setGpsLoading(false);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  // Click handler on map
  const handleMapClick = (clickLat: number, clickLng: number) => {
    setLat(clickLat.toFixed(6));
    setLng(clickLng.toFixed(6));
  };

  // Trigger immediate on-demand store sync via cloud function
  const triggerImmediateSync = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'saristellarx';
      const region = 'asia-southeast1';
      
      const useEmulator = process.env.NEXT_PUBLIC_USE_FUNCTIONS_EMULATOR === 'true';
      const url = useEmulator
        ? `http://127.0.0.1:5001/${projectId}/${region}/syncStoreOnDemand`
        : `https://${region}-${projectId}.cloudfunctions.net/syncStoreOnDemand`;

      console.log('Triggering immediate store sync at:', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.warn('Immediate sync response error:', errData);
      } else {
        console.log('Immediate store sync triggered successfully.');
      }
    } catch (err) {
      console.warn('Failed to trigger immediate sync (this is normal if the local Firebase Functions emulator is not running):', err);
    }
  }, [user]);

  // Submit store registration to Soroban contract
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !storeName.trim() || !lat || !lng) return;

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) return;

    setRegistering(true);
    setActionError(null);

    try {
      // 1. Build contract call XDR
      const xdr = await buildRegisterStoreXDR(publicKey, storeName.trim(), latNum, lngNum);
      
      // 2. Sign, submit, and poll using Freighter
      await signAndSubmit(xdr, publicKey);
      
      // 3. UI will update automatically via onSnapshot once the indexer picks it up
      setSyncing(true);
      setStoreName('');
      setLat('');
      setLng('');

      // 4. Trigger immediate on-demand sync
      await triggerImmediateSync();
    } catch (err: unknown) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setRegistering(false);
    }
  };

  // Deregister store
  const handleDeregister = async () => {
    if (!publicKey || !merchantStore) return;
    if (!confirm('Are you sure you want to remove your store from the registry?')) return;

    setDeregistering(true);
    setActionError(null);

    try {
      const xdr = await buildDeregisterStoreXDR(publicKey);
      await signAndSubmit(xdr, publicKey);
      // UI will update automatically via onSnapshot
      
      // Trigger immediate on-demand sync
      await triggerImmediateSync();
    } catch (err: unknown) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : 'Deregistration failed.');
    } finally {
      setDeregistering(false);
    }
  };

  // Show loading indicator during session verification
  if (authLoading || !user) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center gap-3 text-gray-400">
        <Loader2 className="w-10 h-10 animate-spin text-[#ff7a00]" />
        <p className="text-sm">Verifying merchant session...</p>
      </div>
    );
  }

  // Deny access if profile is not a merchant
  if (profile && profile.role !== 'merchant') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4">
        <div className="max-w-md w-full glass rounded-3xl p-8 border border-red-500/20 text-center flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Access Denied</h2>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              Your account is registered as a Customer. The Merchant POS Portal is reserved for store owners.
            </p>
          </div>
          <div className="flex gap-4 w-full">
            <button
              onClick={() => router.push('/customer')}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 px-4 rounded-xl border border-white/10 text-xs transition"
            >
              Go to Customer Portal
            </button>
            <button
              onClick={logOut}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen w-full pt-24 pb-8 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl flex flex-col gap-6">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-card-border pb-5">
          <div className="flex items-center gap-3">
            <Link 
              href="/" 
              className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-gray-400 hover:text-white transition"
              title="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <StoreIcon className="w-5 h-5 text-[#ff7a00]" />
                <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                  Merchant POS Portal
                </h1>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Configure your store on-chain and scan client orders.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ConnectWallet {...wallet} />
          </div>
        </header>

        {/* Action Error alerts */}
        {actionError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-4 flex items-start gap-2 max-w-2xl">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Error:</span> {actionError}
            </div>
          </div>
        )}

        {/* Wallet Linking / Mismatch Prompts */}
        {publicKey && !profile?.linkedWallet && (
          <div className="bg-[#ff7a00]/10 border border-[#ff7a00]/25 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-2.5 items-start">
              <Wallet className="w-5 h-5 text-[#ff7a00] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-white">Link Your Wallet</h4>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                  Link your connected wallet <span className="font-mono text-[#ffc700]">{publicKey.slice(0, 6)}...{publicKey.slice(-6)}</span> to your merchant account to sync your products and sales receipts to the cloud.
                </p>
              </div>
            </div>
            <button
              onClick={() => linkWalletAddress(publicKey)}
              className="bg-[#ff7a00] hover:bg-[#e06b00] text-white text-xs font-bold py-2 px-4 rounded-xl shrink-0 transition"
            >
              Link Connected Wallet
            </button>
          </div>
        )}

        {publicKey && profile?.linkedWallet && publicKey !== profile.linkedWallet && (
          <div className="bg-[#ffc700]/10 border border-[#ffc700]/25 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-2.5 items-start">
              <AlertCircle className="w-5 h-5 text-[#ffc700] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-white">Wallet Address Mismatch</h4>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                  Your connected wallet (<span className="font-mono text-[#ffc700]">{publicKey.slice(0, 6)}...{publicKey.slice(-6)}</span>) is different from your linked merchant wallet (<span className="font-mono text-white">{profile.linkedWallet.slice(0, 6)}...{profile.linkedWallet.slice(-6)}</span>).
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (confirm("Are you sure you want to update your linked wallet? This will associate new products and sales with this wallet.")) {
                  linkWalletAddress(publicKey);
                }
              }}
              className="bg-[#ffc700] hover:bg-[#e0b000] text-[#070a0e] text-xs font-bold py-2 px-4 rounded-xl shrink-0 transition"
            >
              Update Linked Wallet
            </button>
          </div>
        )}

        {/* Loading State */}
        {publicKey && loadingStore && (
          <div className="py-24 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-[#ff7a00]" />
            <p className="text-sm">Querying Soroban contract registry...</p>
          </div>
        )}

        {/* Wallet Not Connected State */}
        {!publicKey && !connecting && (
          <div className="max-w-md mx-auto w-full glass rounded-3xl p-8 border border-card-border text-center flex flex-col items-center gap-6 my-12">
            <div className="w-16 h-16 rounded-full bg-[#ff7a00]/10 border border-[#ff7a00]/20 flex items-center justify-center text-[#ff7a00]">
              <Wallet className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Merchant Access Required</h2>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Connect your Freighter wallet to register your store on the blockchain, manage products, and accept Stellar payments.
              </p>
            </div>
            <button
              onClick={connect}
              className="w-full bg-[#ff7a00] hover:bg-[#e06b00] text-white font-bold py-3 px-4 rounded-xl transition shadow-lg shadow-[#ff7a00]/25"
            >
              Connect Freighter Wallet
            </button>
          </div>
        )}

        {publicKey && !loadingStore && (
          <>
            {/* Store PROFILE / REGISTRATION PANEL */}
            {syncing && !merchantStore ? (
              <div className="py-24 text-center text-gray-400 flex flex-col items-center justify-center gap-3 glass rounded-3xl border border-card-border">
                <Loader2 className="w-10 h-10 animate-spin text-[#ff7a00]" />
                <h2 className="text-lg font-bold text-white mt-2">Syncing your store...</h2>
                <p className="text-sm max-w-sm">
                  Your store has been successfully registered on the Stellar blockchain. We are waiting for the indexer to sync your data. This can take up to 1 minute.
                </p>
              </div>
            ) : !merchantStore ? (
              // Store Registration Form
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                
                {/* Map location selector */}
                <div className="lg:col-span-3 flex flex-col gap-2">
                  <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-[#ffc700]" /> Pin your store on the map
                  </span>
                  <div className="h-[400px] w-full rounded-2xl overflow-hidden shadow-lg border border-card-border">
                    <Map 
                      stores={stores} 
                      onMapClick={handleMapClick}
                      selectedLocation={lat && lng ? [parseFloat(lat), parseFloat(lng)] : null}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 italic">
                    Click anywhere on the map to set your store coordinates automatically.
                  </span>
                </div>

                {/* Registration form details */}
                <div className="lg:col-span-2 glass rounded-3xl p-6 border border-card-border flex flex-col gap-5">
                  <div>
                    <h2 className="text-lg font-bold text-white">Register Store</h2>
                    <p className="text-xs text-gray-400 mt-1">Deploy your store profile on the Stellar ledger.</p>
                  </div>

                  <form onSubmit={handleRegister} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-gray-400 font-medium">Store Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Aling Nena's Sari-Sari Store"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        className="bg-[#161c24] border border-card-border rounded-xl p-3 text-xs text-white placeholder-gray-600 outline-none focus:border-[#ff7a00] transition"
                        required
                        disabled={registering}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] text-gray-400 font-medium">Latitude</label>
                        <input
                          type="text"
                          placeholder="e.g. 14.6507"
                          value={lat}
                          onChange={(e) => setLat(e.target.value)}
                          className="bg-[#161c24] border border-card-border rounded-xl p-3 text-xs text-white placeholder-gray-600 outline-none focus:border-[#ff7a00] transition"
                          required
                          disabled={registering}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] text-gray-400 font-medium">Longitude</label>
                        <input
                          type="text"
                          placeholder="e.g. 121.0506"
                          value={lng}
                          onChange={(e) => setLng(e.target.value)}
                          className="bg-[#161c24] border border-card-border rounded-xl p-3 text-xs text-white placeholder-gray-600 outline-none focus:border-[#ff7a00] transition"
                          required
                          disabled={registering}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleGetLocation}
                        disabled={gpsLoading || registering}
                        className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold py-2.5 rounded-xl border border-white/10 transition flex items-center justify-center gap-1.5"
                      >
                        {gpsLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Acquiring GPS...
                          </>
                        ) : (
                          <>
                            <Navigation className="w-3.5 h-3.5 text-[#ffc700]" /> Use My GPS
                          </>
                        )}
                      </button>
                    </div>

                    {/* Funding card for new wallets */}
                    {balances && !balances.funded && (
                      <div className="bg-[#ffc700]/10 border border-[#ffc700]/20 rounded-xl p-3 flex flex-col gap-2">
                        <div className="text-xs text-[#ffc700]">
                          <span className="font-bold">Funding Required:</span> Since this is on the Stellar Testnet, registering a store requires Wasm invocation fees. Request test funds first.
                        </div>
                        <button
                          type="button"
                          onClick={handleFund}
                          disabled={funding}
                          className="bg-[#ffc700] hover:bg-[#e0b000] disabled:bg-gray-700 text-[#0b0f14] text-xs font-bold py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5"
                        >
                          {funding ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Funding Account...
                            </>
                          ) : (
                            'Get 10,000 Testnet XLM'
                          )}
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={registering || !!(balances && !balances.funded)}
                      className="w-full bg-[#ff7a00] hover:bg-[#e06b00] disabled:bg-gray-800 disabled:text-gray-500 disabled:border-transparent text-white font-bold py-3 px-4 rounded-xl shadow-lg transition mt-2 flex items-center justify-center gap-1.5"
                    >
                      {registering ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Registering Store...
                        </>
                      ) : (
                        <>
                          <StoreIcon className="w-4 h-4" /> Register Store on Ledger
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              // Store Registered - Display POS Dashboard
              <div className="flex flex-col gap-6">
                
                {/* Store Profile Card */}
                <div className="glass rounded-3xl p-5 border border-[#ff7a00]/20 bg-linear-to-r from-[#ff7a00]/5 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#ff7a00]/10 border border-[#ff7a00]/30 flex items-center justify-center text-white">
                      🏪
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-bold text-base text-white">{merchantStore.name}</h2>
                        <span className="bg-[#00c853]/15 border border-[#00c853]/35 text-[#00c853] text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Registered On-Chain
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-1">
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-500" /> Lat: {merchantStore.lat.toFixed(6)}, Lng: {merchantStore.lng.toFixed(6)}</span>
                        <span className="font-mono text-gray-500">Owner: {merchantStore.owner.slice(0, 8)}...{merchantStore.owner.slice(-8)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleDeregister}
                    disabled={deregistering}
                    className="bg-red-500/10 hover:bg-red-500/20 disabled:bg-gray-800 text-red-400 text-xs font-bold py-2 px-4 rounded-xl border border-red-500/20 transition flex items-center gap-1.5 self-start sm:self-center"
                  >
                    {deregistering ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Removing...
                      </>
                    ) : (
                      <>
                        <LogOut className="w-3.5 h-3.5" /> Remove Store
                      </>
                    )}
                  </button>
                </div>

                {/* Render Point of Sale components */}
                <PosSystem ownerAddress={publicKey} />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
