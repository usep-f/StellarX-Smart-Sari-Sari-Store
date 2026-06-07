'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { 
  Wallet, User, Store, ArrowLeft, AlertCircle, Loader2, CheckCircle2, X
} from 'lucide-react';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { useToast } from '@/components/ui/Toast';

export default function AuthPage() {
  const router = useRouter();
  const { user, profile, signInWithWallet, createWalletProfile, loading: authLoading } = useAuth();
  const { publicKey, connect, connecting, error: walletError, disconnect } = useWallet();
  const { error: showToastError } = useToast();
  
  // Login / Onboarding Page state
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'customer' | 'merchant'>('customer');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Redirect if already logged in and profile exists
  useEffect(() => {
    if (user && profile && !authLoading) {
      if (profile.role === 'merchant') {
        router.push('/merchant');
      } else {
        router.push('/customer');
      }
    } else if (user && !profile && !authLoading) {
      // User is logged in but doesn't have a profile document, trigger onboarding
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOnboarding(true);
    }
  }, [user, profile, authLoading, router]);

  // Handle Wallet Login Click
  const handleWalletLogin = async () => {
    setError(null);
    setSuccess(null);

    if (!publicKey) {
      connect();
      return;
    }

    setLoading(true);
    try {
      const { isNew } = await signInWithWallet(publicKey);
      if (isNew) {
        setSuccess('Wallet authenticated! Please configure your profile details.');
        setIsOnboarding(true);
      } else {
        setSuccess('Authentication successful! Redirecting...');
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Freighter wallet authentication failed.');
      showToastError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Onboarding Submit
  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createWalletProfile(role, fullName.trim());
      setSuccess('Profile configured successfully! Redirecting...');
      
      // Let AuthContext update and effect handle routing
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center pt-28 pb-12 px-4 sm:px-6 relative">
      
      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-[#ff7a00]/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-[#00f0ff]/5 blur-3xl pointer-events-none" />

      <div className="max-w-md w-full flex flex-col gap-6 relative z-10">
        
        {/* Back Link */}
        <div className="flex justify-start">
          <Link 
            href="/" 
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition duration-200"
          >
            <ArrowLeft className="w-4 h-4" /> Back to discovery map
          </Link>
        </div>

        {/* Card */}
        <div className="glass rounded-3xl border border-white/5 p-8 shadow-2xl flex flex-col gap-6">
          
          {/* Header */}
          <div className="text-center flex flex-col gap-2">
            <span className="text-[10px] text-[#ff7a00] uppercase tracking-widest font-extrabold">
              Sari-Stellar Web3 Portal
            </span>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              {isOnboarding ? 'Complete Profile' : 'Authenticate Identity'}
            </h2>
            <p className="text-xs text-gray-400">
              {isOnboarding 
                ? 'Associate your Stellar address with a display name and account role.' 
                : 'Connect and sign in securely with your Stellar Wallet.'}
            </p>
          </div>

          {/* Error & Success Messages */}
          {(error || walletError) && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3 flex items-start justify-between gap-2 w-full">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>{error || walletError}</div>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400/70 hover:text-red-400 transition shrink-0"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {success && (
            <div className="bg-[#00c853]/10 border border-[#00c853]/20 text-[#00c853] text-xs rounded-xl p-3 flex items-start justify-between gap-2 w-full">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <div>{success}</div>
              </div>
              <button
                onClick={() => setSuccess(null)}
                className="text-[#00c853]/70 hover:text-[#00c853] transition shrink-0"
                aria-label="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Authentication Screen */}
          {!isOnboarding ? (
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-2.5 text-center">
                <div className="w-12 h-12 rounded-full bg-[#ff7a00]/10 border border-[#ff7a00]/20 flex items-center justify-center text-[#ff7a00] mx-auto">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Stellar Wallet Authorization</h4>
                  <p className="text-[10px] text-gray-400 mt-1 max-w-[250px] mx-auto leading-relaxed">
                    We use a secure SEP-10 style cryptographic challenge to verify your ownership of the connected keypair.
                  </p>
                </div>
              </div>

              {publicKey ? (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleWalletLogin}
                    disabled={loading}
                    className="w-full bg-[#ff7a00] hover:bg-[#e06b00] text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-[#ff7a00]/25 transition flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Verifying Challenge...
                      </>
                    ) : (
                      <>
                        <Wallet className="w-4 h-4" /> Sign In with Freighter ({formatAddress(publicKey)})
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={disconnect}
                    disabled={loading}
                    className="text-xs text-gray-500 hover:text-white transition hover:underline mt-1 cursor-pointer"
                  >
                    Disconnect Wallet / Switch Account
                  </button>
                </div>
              ) : (
                <button
                  onClick={connect}
                  disabled={connecting}
                  className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3.5 px-4 rounded-xl border border-white/10 transition flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Connecting Freighter...
                    </>
                  ) : (
                    <>
                      <Wallet className="w-4 h-4 text-[#00f0ff]" /> Connect Freighter Wallet
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            // Onboarding Form for new wallets
            <form onSubmit={handleOnboardingSubmit} className="flex flex-col gap-4">
              
              {/* Role Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] text-gray-400 font-medium">Select Your Role</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('customer')}
                    className={`py-3 px-4 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                      role === 'customer' 
                        ? 'bg-[#00c853]/10 border-[#00c853]/50 text-white' 
                        : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/10'
                    }`}
                    disabled={loading}
                  >
                    <User className={`w-5 h-5 ${role === 'customer' ? 'text-[#00c853]' : ''}`} />
                    <span className="text-xs font-bold">Customer</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setRole('merchant')}
                    className={`py-3 px-4 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                      role === 'merchant' 
                        ? 'bg-[#ff7a00]/10 border-[#ff7a00]/50 text-white' 
                        : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/10'
                    }`}
                    disabled={loading}
                  >
                    <Store className={`w-5 h-5 ${role === 'merchant' ? 'text-[#ff7a00]' : ''}`} />
                    <span className="text-xs font-bold">Store Owner</span>
                  </button>
                </div>
              </div>

              {/* Full Name Field */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-gray-400 font-medium">Display Name / Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-[#161c24] border border-card-border rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-gray-600 outline-none focus:border-[#ff7a00] transition"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 mt-1">
                <label className="text-[11px] text-gray-400 font-medium">Stellar Public Key</label>
                <div className="bg-[#161c24]/50 border border-white/5 rounded-xl p-3 font-mono text-[10px] text-gray-500 break-all select-all">
                  {publicKey || user?.uid}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition mt-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                  role === 'merchant'
                    ? 'bg-[#ff7a00] hover:bg-[#e06b00] shadow-[#ff7a00]/15' 
                    : 'bg-[#00c853] hover:bg-[#00b24a] shadow-[#00c853]/15'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving profile...
                  </>
                ) : (
                  'Complete Registration'
                )}
              </button>
            </form>
          )}

        </div>

      </div>
      <LoadingOverlay 
        isOpen={loading || authLoading} 
        message={
          authLoading ? 'Verifying authentication...' :
          isOnboarding ? 'Saving display details...' :
          'Signing authentication challenge...'
        } 
      />
    </main>
  );
}
