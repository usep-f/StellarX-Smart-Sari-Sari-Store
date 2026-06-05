'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { fetchBalances, Balances } from '@/lib/balances';
import { fundTestnetAccount } from '@/lib/stellar';
import { buildPaymentXDR } from '@/lib/payment';
import { signAndSubmit } from '@/lib/sign';
import { 
  Wallet, AlertTriangle, CheckCircle2, 
  Loader2, ArrowRight, RefreshCw, Landmark
} from 'lucide-react';

interface CustomerPaymentProps {
  merchantAddress: string;
  amount: number;
  memo: string;
}

interface PurchaseReceipt {
  id: string;
  timestamp: number;
  merchant: string;
  amount: number;
  memo: string;
  txHash: string;
}

export default function CustomerPayment({
  merchantAddress,
  amount,
  memo,
}: CustomerPaymentProps) {
  const wallet = useWallet();
  const { publicKey, connect, connecting, error: walletError } = wallet;

  const [balances, setBalances] = useState<Balances | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [funding, setFunding] = useState(false);
  
  // Payment execution state
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'paying' | 'success' | 'failed'>('idle');
  const [txHash, setTxHash] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  
  // Purchase History
  const [purchases, setPurchases] = useState<PurchaseReceipt[]>([]);

  // Load balances
  const getBalances = async (pubKey: string) => {
    setLoadingBalance(true);
    try {
      const b = await fetchBalances(pubKey);
      setBalances(b);
    } catch (err) {
      console.error('Failed to load balances:', err);
    } finally {
      setLoadingBalance(false);
    }
  };

  useEffect(() => {
    if (publicKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      getBalances(publicKey);
      
      // Load purchase history
      const stored = localStorage.getItem(`sari_purchases_${publicKey}`);
      if (stored) {
        setPurchases(JSON.parse(stored));
      }
    } else {
      setBalances(null);
    }
  }, [publicKey]);

  // Request Friendbot funds
  const handleFund = async () => {
    if (!publicKey) return;
    setFunding(true);
    try {
      await fundTestnetAccount(publicKey);
      // Wait a bit for Ledger to register funding
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await getBalances(publicKey);
    } catch (err: unknown) {
      console.error(err);
      alert('Funding failed. Please try again.');
    } finally {
      setFunding(false);
    }
  };

  // Run payment transaction
  const handlePay = async () => {
    if (!publicKey || !merchantAddress || !amount || !memo) return;
    
    // Check balance
    if (balances && parseFloat(balances.xlm) < amount) {
      setPaymentError('Insufficient XLM balance to complete this transaction.');
      setPaymentStatus('failed');
      return;
    }

    setPaymentStatus('paying');
    setPaymentError(null);

    try {
      // 1. Build payment XDR
      const xdr = await buildPaymentXDR(
        publicKey,
        merchantAddress,
        amount.toString(),
        'XLM',
        memo
      );

      // 2. Sign, submit, and poll using Freighter
      const hash = await signAndSubmit(xdr, publicKey);
      setTxHash(hash);
      setPaymentStatus('success');

      // 3. Save receipt to local storage
      const newPurchase: PurchaseReceipt = {
        id: `pur_${Date.now()}`,
        timestamp: Date.now(),
        merchant: merchantAddress,
        amount,
        memo,
        txHash: hash,
      };

      const updated = [newPurchase, ...purchases];
      setPurchases(updated);
      localStorage.setItem(`sari_purchases_${publicKey}`, JSON.stringify(updated));

      // Refresh balances
      await getBalances(publicKey);
    } catch (err: unknown) {
      console.error('Payment execution failed:', err);
      setPaymentError(err instanceof Error ? err.message : 'Transaction failed.');
      setPaymentStatus('failed');
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-6">
      {paymentStatus === 'idle' && (
        <div className="glass rounded-3xl p-6 border border-card-border flex flex-col gap-6">
          <div className="text-center">
            <span className="bg-[#ff7a00]/10 border border-[#ff7a00]/20 text-[#ff7a00] text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full">
              Sari-Sari Store Checkout
            </span>
            <h3 className="font-bold text-xl text-white mt-3">Confirm Payment Details</h3>
            <p className="text-xs text-gray-400 mt-1">Review the transaction before signing with Freighter.</p>
          </div>

          {/* Checkout Card */}
          <div className="bg-[#161c24]/80 rounded-2xl p-5 border border-white/5 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block">Merchant Address</span>
                <span className="text-xs font-mono text-white truncate max-w-[200px] block mt-0.5" title={merchantAddress}>
                  {merchantAddress.slice(0, 10)}...{merchantAddress.slice(-10)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block">Memo Reference</span>
                <span className="text-xs font-mono text-[#ffc700] font-bold block mt-0.5">{memo}</span>
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 flex justify-between items-center">
              <span className="text-sm text-gray-300 font-semibold">Total Amount</span>
              <span className="text-2xl font-bold font-mono text-[#00c853] flex items-baseline gap-1">
                {amount.toFixed(2)} <span className="text-xs text-[#ffc700] font-sans font-normal">XLM</span>
              </span>
            </div>
          </div>

          {/* Wallet Actions */}
          {!publicKey ? (
            <div className="flex flex-col gap-3">
              <button
                onClick={connect}
                disabled={connecting}
                className="w-full bg-[#ff7a00] hover:bg-[#e06b00] disabled:bg-gray-700 text-white font-bold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="w-5 h-5" /> Connect Freighter Wallet
                  </>
                )}
              </button>
              {walletError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{walletError}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4 border-t border-white/5 pt-4">
              {/* Connected Wallet Info */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#ff7a00]" />
                  <div>
                    <span className="text-[10px] text-gray-400 block">Connected Wallet</span>
                    <span className="text-xs font-mono text-white">{publicKey.slice(0, 6)}...{publicKey.slice(-6)}</span>
                  </div>
                </div>
                
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 block">Your Balance</span>
                  {loadingBalance ? (
                    <span className="text-xs text-gray-500 animate-pulse block">Loading...</span>
                  ) : (
                    <span className="text-xs font-bold font-mono text-white block">
                      {balances?.funded ? `${balances.xlm} XLM` : '0.00 XLM'}
                    </span>
                  )}
                </div>
              </div>

              {/* Fund account if necessary */}
              {balances && !balances.funded && (
                <div className="bg-[#ffc700]/10 border border-[#ffc700]/20 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2 text-[#ffc700] text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Account Unfunded</p>
                      <p className="text-[10px] text-[#ffc700]/80">This wallet is new on testnet and has 0 balance.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleFund}
                    disabled={funding}
                    className="bg-[#ffc700] hover:bg-[#e0b000] disabled:bg-gray-700 text-[#0b0f14] text-xs font-bold py-1.5 px-3 rounded-lg transition shrink-0 flex items-center justify-center gap-1"
                  >
                    {funding ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Funding...
                      </>
                    ) : (
                      'Request 10k XLM'
                    )}
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <button
                onClick={handlePay}
                disabled={!!(balances && parseFloat(balances.xlm) < amount)}
                className="w-full bg-[#00c853] hover:bg-[#00b04a] disabled:bg-gray-800 disabled:text-gray-500 disabled:border-transparent text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-[#00c853]/20 transition flex items-center justify-center gap-2 group border border-[#00c853]/30"
              >
                Confirm & Pay Invoice <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Payment Loading State */}
      {paymentStatus === 'paying' && (
        <div className="glass rounded-3xl p-8 border border-card-border flex flex-col items-center justify-center text-center gap-4 py-16">
          <Loader2 className="w-12 h-12 animate-spin text-[#ff7a00]" />
          <h3 className="font-bold text-lg text-white">Processing Transaction...</h3>
          <p className="text-xs text-gray-400 max-w-[280px]">
            Please sign the transaction popup in your Freighter wallet, then wait a few seconds for finality on the Stellar network.
          </p>
        </div>
      )}

      {/* Payment Success State */}
      {paymentStatus === 'success' && (
        <div className="glass rounded-3xl p-6 border border-card-border flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#00c853]/10 border border-[#00c853]/30 flex items-center justify-center text-[#00c853]">
            <CheckCircle2 className="w-10 h-10 animate-bounce-slow" />
          </div>

          <div>
            <h3 className="font-bold text-xl text-white">Payment Successful!</h3>
            <p className="text-xs text-gray-400 mt-1">Your payment of {amount.toFixed(2)} XLM has been settled.</p>
          </div>

          <div className="w-full border-t border-b border-dashed border-white/10 py-4 flex flex-col gap-2.5 text-left text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Recipient Store</span>
              <span className="font-mono text-white">{merchantAddress.slice(0, 8)}...{merchantAddress.slice(-8)}</span>
            </div>
            <div className="flex justify-between">
              <span>Invoice Memo</span>
              <span className="font-mono text-white">{memo}</span>
            </div>
            <div className="flex justify-between">
              <span>Transaction Hash</span>
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[#ff7a00] hover:underline"
              >
                {txHash.slice(0, 8)}...{txHash.slice(-8)}
              </a>
            </div>
          </div>

          <p className="text-[10px] text-gray-500">
            You can close this tab now. The store owner&apos;s screen will automatically update with your payment.
          </p>
        </div>
      )}

      {/* Payment Failed State */}
      {paymentStatus === 'failed' && (
        <div className="glass rounded-3xl p-6 border border-card-border flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div>
            <h3 className="font-bold text-lg text-white">Payment Failed</h3>
            <p className="text-xs text-gray-400 mt-1">An error occurred while compiling or submitting the transaction.</p>
          </div>

          <div className="bg-red-500/5 border border-red-500/15 text-red-400 text-xs rounded-xl p-3 w-full font-mono text-left wrap-break-word">
            {paymentError || 'Unknown transaction submission error.'}
          </div>

          <button
            onClick={() => setPaymentStatus('idle')}
            className="w-full bg-white/5 hover:bg-white/10 text-white font-semibold py-2.5 px-4 rounded-xl transition border border-white/10 text-xs"
          >
            Go Back & Retry
          </button>
        </div>
      )}

      {/* Personal Purchase History */}
      {publicKey && purchases.length > 0 && (
        <div className="glass rounded-2xl p-5 border border-card-border flex flex-col gap-4">
          <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
            <Landmark className="w-4 h-4 text-[#ffc700]" /> Your Purchases
          </h4>
          <div className="flex flex-col gap-3 max-h-[200px] overflow-y-auto pr-1">
            {purchases.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-xs text-white">Memo: {p.memo}</span>
                  <span className="text-[10px] text-gray-500 block">Store: {p.merchant.slice(0, 6)}...{p.merchant.slice(-6)}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-bold text-red-400">-{p.amount.toFixed(2)} XLM</span>
                  <span className="text-[9px] text-gray-500 block">{new Date(p.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
