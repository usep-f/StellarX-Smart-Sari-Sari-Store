'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { fetchBalances, Balances } from '@/lib/balances';
import { useToast } from '@/components/ui/Toast';
import ConnectWallet from '@/components/ConnectWallet';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import {
  ArrowLeft,
  User as UserIcon,
  Mail,
  Calendar,
  Shield,
  Wallet,
  Trash2,
  Loader2,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff
} from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, updateProfileDetails, unlinkWalletAddress, deleteUserAccount } = useAuth();
  const wallet = useWallet();
  const { publicKey, connect, connecting } = wallet;
  const { success: showToastSuccess, error: showToastError } = useToast();

  // Full Name State
  const [fullName, setFullName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Balances State
  const [balances, setBalances] = useState<Balances | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Modal States
  const [isUnlinkModalOpen, setIsUnlinkModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  // Fetch balances when linked wallet changes
  useEffect(() => {
    if (profile?.linkedWallet) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      getBalances(profile.linkedWallet);
    } else {
      setBalances(null);
    }
  }, [profile?.linkedWallet, getBalances]);

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

  // Handle Wallet Link/Update
  const [linkingWallet, setLinkingWallet] = useState(false);
  const handleLinkWallet = async () => {
    if (!publicKey) return;
    setLinkingWallet(true);
    try {
      await updateProfileDetails(profile?.fullName || ''); // ensure name is set
      const { doc, getDoc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      // Link address
      const userDocRef = doc(db, 'users', user!.uid);
      await updateDoc(userDocRef, {
        linkedWallet: publicKey,
      });

      // Sync name to stores collection
      const storeDocRef = doc(db, 'stores', publicKey);
      const storeSnap = await getDoc(storeDocRef);
      if (storeSnap.exists()) {
        await updateDoc(storeDocRef, {
          ownerName: profile?.fullName || user?.email?.split('@')[0] || 'Unknown',
        });
      }
      
      showToastSuccess('Wallet linked to profile successfully.');
    } catch (err) {
      console.error(err);
      showToastError('Failed to link wallet address.');
    } finally {
      setLinkingWallet(false);
    }
  };

  // Handle Wallet Unlink
  const handleUnlinkWallet = async () => {
    try {
      await unlinkWalletAddress();
      showToastSuccess('Wallet unlinked from profile.');
    } catch (err) {
      console.error(err);
      showToastError('Failed to unlink wallet.');
    }
  };

  // Handle Account Deletion
  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) {
      showToastError('Password is required to delete your account.');
      return;
    }

    setDeletingAccount(true);
    try {
      await deleteUserAccount(deletePassword);
      showToastSuccess('Your account has been deleted permanently.');
      setIsDeleteModalOpen(false);
      router.push('/');
    } catch (err) {
      console.error(err);
      showToastError(err instanceof Error ? err.message : 'Deletion failed. Check your password and try again.');
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

  // Shorten wallet addresses
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
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
            <ConnectWallet {...wallet} />
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
                {profile?.fullName ? profile.fullName.slice(0, 2).toUpperCase() : user.email?.slice(0, 2).toUpperCase() || 'U'}
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
                  <Mail className="w-3.5 h-3.5" /> Email Address
                </label>
                <input
                  type="email"
                  value={profile?.email || user.email || ''}
                  className="bg-[#161c24]/50 border border-white/5 rounded-xl p-3 text-xs text-gray-500 outline-none cursor-not-allowed"
                  disabled
                />
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
          <div className="glass rounded-3xl p-6 border border-card-border flex flex-col gap-5 justify-between">
            <div className="flex flex-col gap-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#00f0ff]" /> Stellar Integration
              </h2>

              {/* Linked Wallet Details */}
              {profile?.linkedWallet ? (
                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-2 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 font-semibold tracking-wider uppercase">Linked Public Key</span>
                      {publicKey === profile.linkedWallet ? (
                        <span className="bg-[#00c853]/15 border border-[#00c853]/35 text-[#00c853] text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Verified Connected
                        </span>
                      ) : (
                        <span className="bg-[#ffc700]/15 border border-[#ffc700]/35 text-[#ffc700] text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> Mismatched/Disconnected
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-white break-all mt-1">
                      {profile.linkedWallet}
                    </span>
                    <div className="flex items-center gap-3 mt-1 text-[10px]">
                      <a
                        href={`https://stellar.expert/explorer/testnet/account/${profile.linkedWallet}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#00f0ff] hover:underline"
                      >
                        View on StellarExpert
                      </a>
                    </div>
                  </div>

                  {/* Blockchain Balances */}
                  <div className="p-4 rounded-2xl bg-[#161c24]/50 border border-white/5 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
                      <span>Blockchain Balances</span>
                      <button
                        onClick={() => getBalances(profile.linkedWallet!)}
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
              ) : (
                <div className="p-6 text-center bg-white/5 border border-white/5 rounded-2xl flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#ffc700]/10 border border-[#ffc700]/20 flex items-center justify-center text-[#ffc700]">
                    <Wallet className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">No Wallet Linked</h4>
                    <p className="text-[10px] text-gray-400 mt-1 max-w-[220px] mx-auto leading-relaxed">
                      Link your Stellar public key to accept payments as a merchant or verify transactions as a client.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Wallet Action Button Footer */}
            <div className="mt-5 border-t border-white/5 pt-4">
              {profile?.linkedWallet ? (
                <div className="flex flex-col gap-3">
                  {publicKey && publicKey !== profile.linkedWallet && (
                    <button
                      onClick={handleLinkWallet}
                      disabled={linkingWallet}
                      className="w-full bg-[#ffc700] hover:bg-[#e0b000] text-[#070a0e] text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5"
                    >
                      {linkingWallet ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Updating...
                        </>
                      ) : (
                        'Update Link to Connected Wallet'
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setIsUnlinkModalOpen(true)}
                    className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer"
                  >
                    Unlink Wallet Address
                  </button>
                </div>
              ) : (
                <div className="w-full">
                  {publicKey ? (
                    <button
                      onClick={handleLinkWallet}
                      disabled={linkingWallet}
                      className="w-full bg-[#00f0ff] hover:bg-[#00c5d1] text-black font-extrabold text-xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5"
                    >
                      {linkingWallet ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Wallet className="w-4 h-4" /> Link Connected Wallet ({formatAddress(publicKey)})
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={connect}
                      disabled={connecting}
                      className="w-full bg-[#ff7a00] hover:bg-[#e06b00] disabled:bg-gray-800 text-white font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5 text-xs shadow-lg shadow-[#ff7a00]/10"
                    >
                      {connecting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Wallet className="w-4 h-4" /> Connect Freighter Wallet
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
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
              setDeletePassword('');
              setIsDeleteModalOpen(true);
            }}
            className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl shrink-0 transition flex items-center gap-1.5 self-start sm:self-center"
          >
            <Trash2 className="w-4 h-4" /> Delete Account
          </button>
        </div>
      </div>

      {/* CONFIRM UNLINK MODAL */}
      <ConfirmationModal
        isOpen={isUnlinkModalOpen}
        title="Unlink Wallet Address"
        message="Are you sure you want to unlink your wallet? This will stop cloud synchronization of products, POS configurations, and receipts. You can link a wallet again at any time."
        confirmText="Unlink Wallet"
        cancelText="Keep Linked"
        type="warning"
        onConfirm={handleUnlinkWallet}
        onClose={() => setIsUnlinkModalOpen(false)}
      />

      {/* SECURE DELETE ACCOUNT MODAL WITH PASSWORD */}
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

              {profile?.role === 'merchant' && profile.linkedWallet && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-[11px] mt-1">
                  <strong>Notice to Merchant:</strong> Deleting your account will **not** deregister your store from the decentralized Stellar blockchain. We recommend deregistering your store on-chain first.
                </div>
              )}
            </div>

            <form onSubmit={handleDeleteAccount} className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-400 font-semibold">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password to verify"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full bg-[#161c24] border border-card-border rounded-xl py-3 pl-3 pr-10 text-xs text-white placeholder-gray-600 outline-none focus:border-rose-500 transition"
                    required
                    disabled={deletingAccount}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-gray-500 hover:text-white"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
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
                  type="submit"
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
            </form>
          </div>
        </div>
      )}

      {/* OVERLAY LOADER */}
      <LoadingOverlay
        isOpen={savingName || linkingWallet || deletingAccount}
        message={
          savingName ? 'Saving your updated profile details...' :
          linkingWallet ? 'Linking your Stellar wallet to your profile...' :
          deletingAccount ? 'Recursively deleting all documents and credentials...' :
          'Processing, please wait...'
        }
      />
    </main>
  );
}
