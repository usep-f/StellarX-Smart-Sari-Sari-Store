'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import CustomerPayment from '@/components/CustomerPayment';
import QRScanner from '@/components/QRScanner';
import { ArrowLeft, ScanLine, HelpCircle, Loader2 } from 'lucide-react';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const merchantAddress = searchParams.get('to') || '';
  const amountStr = searchParams.get('amount') || '';
  const memo = searchParams.get('memo') || '';
  
  const amount = parseFloat(amountStr);
  const isValidParams = merchantAddress && !isNaN(amount) && amount > 0 && memo;

  // Handle scanned payment URL directly if opened without params
  const handlePaymentScanned = (scannedUrl: string) => {
    try {
      // Expecting a URL like: http://localhost:3000/customer?to=...&amount=...&memo=...
      const url = new URL(scannedUrl);
      if (url.pathname.includes('/customer')) {
        router.push(url.search);
      } else {
        alert('Invalid Payment QR. Please scan a valid store payment QR code.');
      }
    } catch {
      alert('Invalid QR format. Please scan a valid store payment URL.');
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-card-border pb-5">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/')}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-gray-400 hover:text-white transition"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-[#ff7a00]" />
              <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                Customer Payments
              </h1>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Securely scan and approve store invoice payments on Stellar.
            </p>
          </div>
        </div>
      </header>

      {isValidParams ? (
        // Render Payment Approval Component
        <CustomerPayment 
          merchantAddress={merchantAddress} 
          amount={amount} 
          memo={memo} 
        />
      ) : (
        // Render QR Scanner when no active checkout parameters exist
        <div className="max-w-md mx-auto w-full flex flex-col gap-6 my-4">
          <div className="glass rounded-3xl p-6 border border-card-border flex flex-col gap-4 text-center items-center">
            <div className="w-12 h-12 rounded-full bg-[#ff7a00]/10 border border-[#ff7a00]/20 flex items-center justify-center text-[#ff7a00]">
              <ScanLine className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Scan Payment Invoice</h2>
              <p className="text-xs text-gray-400 mt-1 max-w-[300px] mx-auto leading-relaxed">
                Scan the payment QR code displayed on the merchant&apos;s checkout screen to review and pay.
              </p>
            </div>
          </div>

          <QRScanner
            onScanSuccess={handlePaymentScanned}
            placeholderText="Scan store invoice QR code to start payment"
            simulateLabel="Simulate Invoice Scan"
            // Let them simulate scanning an invoice to a mock merchant address
            simulateOptions={[
              {
                value: `http://localhost:3000/customer?to=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5&amount=8.50&memo=sari-12345`,
                label: 'Simulate invoice: 8.50 XLM (Ate Nena)',
              },
              {
                value: `http://localhost:3000/customer?to=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5&amount=12.00&memo=sari-67890`,
                label: 'Simulate invoice: 12.00 XLM (Tindahan Ni Juan)',
              },
            ]}
          />
          
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex gap-3 text-xs text-gray-400">
            <HelpCircle className="w-5 h-5 text-[#ffc700] shrink-0" />
            <div>
              <p className="font-semibold text-white">How it works</p>
              <p className="mt-1 leading-relaxed">
                1. The merchant scans products and clicks Checkout.<br />
                2. They display a QR invoice code on their screen.<br />
                3. Scan that QR code using this camera page to pay instantly on-chain.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomerPage() {
  return (
    <main className="min-h-screen w-full py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Suspense 
          fallback={
            <div className="py-24 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-[#ff7a00]" />
              <p className="text-sm">Initializing checkout session...</p>
            </div>
          }
        >
          <CheckoutContent />
        </Suspense>
      </div>
    </main>
  );
}
