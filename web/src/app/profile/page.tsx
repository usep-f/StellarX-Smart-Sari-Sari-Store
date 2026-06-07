'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { fetchBalances, Balances } from '@/lib/balances';
import { useToast } from '@/components/ui/Toast';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import {
  ArrowLeft,
  User as UserIcon,
  Calendar,
  Shield,
  Wallet,
  Trash2,
  Loader2,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, updateProfileDetails, deleteUserAccount, logOut } = useAuth();
  const wallet = useWallet();
  const { publicKey } = wallet;
  const { success: showToastSuccess, error: showToastError } = useToast();

  // Full Name State
  const [fullName, setFullName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Balances State
  const [balances, setBalances] = useState<Balances | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Sync state with profile
  useEffect(() => {
    if (profile?.fullName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFullName(profile.fullName);
    }
  }, [profile]);

  // Guard routing: redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  // Load balances from blockchain
  const getBalances = useCallback(async (address: string) => {
    setLoadingBalances(true);
    try {
      const b = await fetchBalances(address);
      setBalances(b);
    } catch (err) {
      console.error('Failed to load wallet balances:', err);
      showToastError('Failed to fetch wallet balances from Horizon.');
    } finally {
      setLoadingBalances(false);
    }
  }, [showToastError]);

  // Fetch balances when user address is resolved
  useEffect(() => {
    if (user?.uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      getBalances(user.uid);
    } else {
      setBalances(null);
    }
  }, [user?.uid, getBalances]);

  // Handle Full Name Save
  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim() === profile?.fullName) return;

    setSavingName(true);
    try {
      await updateProfileDetails(fullName.trim());
      showToastSuccess('Profile name updated successfully.');
    } catch (err) {
      console.error(err);
      showToastError(err instanceof Error ? err.message : 'Failed to update profile details.');
    } finally {
      setSavingName(false);
    }
  };

  // Handle Account Deletion
  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await deleteUserAccount();
      showToastSuccess('Your account has been deleted permanently.');
      setIsDeleteModalOpen(false);
      
      // Force logOut and redirect to home
      logOut().then(() => router.push('/'));
    } catch (err) {
      console.error(err);
      showToastError(err instanceof Error ? err.message : 'Deletion failed.');
      setDeletingAccount(false);
    }
  };

  // Format Unix Timestamp
  const formatJoinedDate = (timestamp: number) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center gap-3 text-gray-400">
        <Loader2 className="w-10 h-10 animate-spin text-[#ff7a00]" />
        <p className="text-sm">Verifying profile session...</p>
      </div>
    );
  }

  const isNameChanged = fullName.trim() !== '' && fullName.trim() !== profile?.fullName;

  return (
    <main className="min-h-screen w-full pt-24 pb-12 px-4 sm:px-6">
      <div className="mx-auto max-w-4xl flex flex-col gap-6">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-card-border pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (profile?.role === 'merchant') {
                  router.push('/merchant');
                } else {
                  router.push('/customer');
                }
              }}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-gray-400 hover:text-white transition"
              title="Go to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl flex items-center gap-2">
                Profile Settings
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Manage your credentials, linked Stellar wallets, and account status.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PROFILE CARD */}
          <div className="glass rounded-3xl p-6 border border-card-border flex flex-col gap-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-[#ff7a00]" /> Personal Details
            </h2>

            {/* Avatar & Role */}
            <div className="flex items-center gap-4 border-b border-white/5 pb-4">
              <div className="w-16 h-16 rounded-2xl bg-linear-to-tr from-[#ff7a00] to-[#00f0ff] flex items-center justify-center text-white text-xl font-extrabold shadow-lg">
                {profile?.fullName ? profile.fullName.slice(0, 2).toUpperCase() : user.uid.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold text-white">{profile?.fullName || 'Full Name'}</span>
                <span className="text-[10px] bg-[#00f0ff]/10 border border-[#00f0ff]/20 text-[#00f0ff] font-extrabold uppercase px-2 py-0.5 rounded-md mt-1 w-max">
                  {profile?.role === 'merchant' ? 'Store Owner' : 'Customer'}
                </span>
              </div>
            </div>

            {/* Profile fields Form */}
            <form onSubmit={handleSaveName} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                  Full Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="flex-1 bg-[#161c24] border border-card-border rounded-xl p-3 text-xs text-white placeholder-gray-600 outline-none focus:border-[#ff7a00] transition"
                    disabled={savingName}
                    required
                  />
                  <button
                    type="submit"
                    disabled={!isNameChanged || savingName}
                    className="bg-[#ff7a00] hover:bg-[#e06b00] disabled:bg-gray-800 disabled:text-gray-500 disabled:border-transparent text-white font-bold p-3 rounded-xl transition flex items-center justify-center gap-1.5 text-xs cursor-pointer shadow-lg shadow-[#ff7a00]/10"
                  >
                    {savingName ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-4 h-4" /> Save
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Account Created
                </label>
                <div className="bg-[#161c24]/50 border border-white/5 rounded-xl p-3 text-xs text-gray-500 flex items-center gap-2">
                  <span>{profile?.createdAt ? formatJoinedDate(profile.createdAt) : 'Unknown'}</span>
                </div>
              </div>
            </form>
          </div>

          {/* STELLAR WALLET CARD */}
          <div className="glass rounded-3xl p-6 border border-card-border flex flex-col gap-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#00f0ff]" /> Stellar Wallet Status
            </h2>

            {/* Wallet details */}
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 font-semibold tracking-wider uppercase">Active Wallet Identity</span>
                  {publicKey === user.uid ? (
                    <span className="bg-[#00c853]/15 border border-[#00c853]/35 text-[#00c853] text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Active Login
                    </span>
                  ) : (
                    <span className="bg-[#ffc700]/15 border border-[#ffc700]/35 text-[#ffc700] text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" /> Extension Mismatch
                    </span>
                  )}
                </div>
                <span className="font-mono text-xs text-white break-all mt-1">
                  {user.uid}
                </span>
                <div className="flex items-center gap-3 mt-1 text-[10px]">
                  <a
                    href={`https://stellar.expert/explorer/testnet/account/${user.uid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00f0ff] hover:underline"
                  >
                    View on StellarExpert
                  </a>
                </div>
              </div>

              {/* Wallet mismatches */}
              {publicKey && publicKey !== user.uid && (
                <div className="p-3 bg-[#ffc700]/10 border border-[#ffc700]/20 text-[#ffc700] rounded-xl text-[10px] leading-relaxed">
                  <strong>Freighter Extension Account:</strong> Your extension is currently set to account <span className="font-mono">{publicKey.slice(0, 6)}...{publicKey.slice(-6)}</span>. You are logged into profile <span className="font-mono">{user.uid.slice(0, 6)}...{user.uid.slice(-6)}</span>. Sign out and sign in with the new address to switch profiles.
                </div>
              )}

              {/* Blockchain Balances */}
              <div className="p-4 rounded-2xl bg-[#161c24]/50 border border-white/5 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
                  <span>On-Chain Balances</span>
                  <button
                    onClick={() => getBalances(user.uid)}
                    disabled={loadingBalances}
                    className="text-gray-500 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                    title="Reload balances"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingBalances ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {loadingBalances ? (
                  <div className="py-4 flex items-center justify-center gap-2 text-gray-500 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-[#ff7a00]" /> Loading...
                  </div>
                ) : balances ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col bg-black/20 rounded-xl p-3 border border-white/5">
                      <span className="text-[10px] text-gray-500 font-bold uppercase">XLM Balance</span>
                      <span className="text-base font-extrabold text-white mt-1 font-mono">
                        {balances.xlm} <span className="text-[10px] font-sans font-normal text-gray-400">XLM</span>
                      </span>
                    </div>
                    <div className="flex flex-col bg-black/20 rounded-xl p-3 border border-white/5">
                      <span className="text-[10px] text-gray-500 font-bold uppercase">USDC Balance</span>
                      <span className="text-base font-extrabold text-white mt-1 font-mono">
                        {balances.usdc} <span className="text-[10px] font-sans font-normal text-gray-400">USDC</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-gray-500 italic">No blockchain data loaded. Click Refresh to query Horizon.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* DANGER ZONE */}
        <div className="glass rounded-3xl p-6 border border-rose-500/20 bg-linear-to-r from-rose-500/5 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-3.5 items-start">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Danger Zone</h4>
              <p className="text-xs text-gray-400 mt-1 max-w-xl leading-relaxed">
                Permanently delete your profile and account. This will recursively cascade and erase your profile metadata, invoices, products, and purchases from our records. This cannot be undone.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsDeleteModalOpen(true);
            }}
            className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl shrink-0 transition flex items-center gap-1.5 self-start sm:self-center cursor-pointer"
          >
            <Trash2 className="w-4 h-4" /> Delete Account
          </button>
        </div>
      </div>

      {/* SECURE DELETE ACCOUNT MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <div
            onClick={() => !deletingAccount && setIsDeleteModalOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
          />

          {/* Modal Container */}
          <div
            className="w-full max-w-md glass rounded-3xl p-6 border border-rose-500/25 shadow-2xl flex flex-col gap-5 relative z-10 overflow-hidden"
            style={{ backgroundColor: 'rgba(13, 18, 30, 0.96)' }}
          >
            <div className="flex gap-3.5 items-start border-b border-white/5 pb-3">
              <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white leading-tight">Delete Account Permanently</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">Action cannot be undone</p>
              </div>
            </div>

            <div className="text-xs text-gray-400 leading-relaxed flex flex-col gap-2.5">
              <p>
                You are about to delete your profile on Sari-Stellar. This deletes:
              </p>
              <ul className="list-disc list-inside pl-1 flex flex-col gap-1 text-[11px] text-rose-300">
                <li>Your profile details, metadata, and authentication records</li>
                {profile?.role === 'customer' ? (
                  <li>All your customer checkout logs and purchase records</li>
                ) : (
                  <>
                    <li>All products, catalog items, and inventory counts</li>
                    <li>All checkout receipts and sales registers</li>
                  </>
                )}
              </ul>

              {profile?.role === 'merchant' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-[11px] mt-1">
                  <strong>Notice to Merchant:</strong> Deleting your account will **not** deregister your store from the decentralized Stellar blockchain. We recommend deregistering your store on-chain first.
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-2 justify-end border-t border-white/5 pt-4">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deletingAccount}
                className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition duration-150 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition duration-150 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {deletingAccount ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" /> Permanently Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY LOADER */}
      <LoadingOverlay
        isOpen={savingName || deletingAccount}
        message={
          savingName ? 'Saving your updated profile details...' :
          deletingAccount ? 'Recursively deleting all documents and credentials...' :
          'Processing, please wait...'
        }
      />
    </main>
  );
}
