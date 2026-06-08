'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  doc, 
  onSnapshot,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TransactionBuilder, Account, Memo, Operation } from '@stellar/stellar-sdk';
import { getKit } from '@/lib/wallet';
import { NETWORK_PASSPHRASE } from '@/lib/stellar';
import { usePathname } from 'next/navigation';

export interface User {
  uid: string;
}

export interface UserProfile {
  email: string | null;
  role: 'merchant' | 'customer';
  linkedWallet: string;
  createdAt: number;
  fullName?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithWallet: () => Promise<{ isNew: boolean; publicKey: string }>;
  createWalletProfile: (role: 'merchant' | 'customer', fullName: string) => Promise<void>;
  updateProfileDetails: (fullName: string) => Promise<void>;
  deleteUserAccount: () => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getFunctionUrl = (name: string) => {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'saristellarx';
  const region = 'asia-southeast1';
  const useEmulator = process.env.NEXT_PUBLIC_USE_FUNCTIONS_EMULATOR === 'true';
  return useEmulator
    ? `http://127.0.0.1:5001/${projectId}/${region}/${name}`
    : `https://${region}-${projectId}.cloudfunctions.net/${name}`;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionRestored, setSessionRestored] = useState(false);
  const pathname = usePathname();

  const logOut = async () => {
    setUser(null);
    setProfile(null);
    localStorage.removeItem('activeWallet');
  };

  // Onboarding/Registration Failsafe:
  // If the user has connected a wallet but has no profile document, and they navigate away 
  // from the /auth portal, log them out automatically to prevent a half-logged-in session.
  useEffect(() => {
    if (!loading && user && !profile && pathname !== '/auth') {
      const timerId = setTimeout(() => {
        logOut();
      }, 0);
      return () => clearTimeout(timerId);
    }
  }, [loading, user, profile, pathname]);

  // Restore session from localStorage
  useEffect(() => {
    const savedWallet = localStorage.getItem('activeWallet');
    const timerId = setTimeout(() => {
      if (savedWallet) {
        setUser({ uid: savedWallet });
      }
      setSessionRestored(true);
    }, 0);
    return () => clearTimeout(timerId);
  }, []);

  // Listen for Firestore profile changes when user is set
  useEffect(() => {
    if (!sessionRestored) return;

    let unsubscribeProfile: (() => void) | undefined;
    let timerId: NodeJS.Timeout | undefined;

    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }, (err) => {
        console.error('Failed to listen to profile document:', err);
        setLoading(false);
      });
    } else {
      timerId = setTimeout(() => {
        setProfile(null);
        setLoading(false);
      }, 0);
    }

    return () => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [user, sessionRestored]);

  /** Helper to sign a payload and send it to a secure cloud function */
  const sendSecurePayload = async (functionName: string, action: string, data?: Record<string, unknown>) => {
    if (!user) throw new Error('Not logged in');
    const kit = getKit();
    if (!kit) throw new Error('Wallet kit not initialized');

    const payload = {
      walletAddress: user.uid,
      timestamp: Date.now(),
      action,
      data
    };

    // Hash the payload
    const payloadStr = JSON.stringify(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payloadStr) as unknown as BufferSource);

    // Build the transaction
    const tx = new TransactionBuilder(new Account(user.uid, '0'), {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addMemo(Memo.hash(Buffer.from(hashBuffer)))
      .addOperation(Operation.bumpSequence({ bumpTo: '1' }))
      .setTimeout(300)
      .build();

    // Request signature
    const { signedTxXdr } = await kit.signTransaction(tx.toXDR(), {
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    // Send to Cloud Function
    const res = await fetch(getFunctionUrl(functionName), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, signedXdr: signedTxXdr }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Request failed');
    }
  };

  const signInWithWallet = async () => {
    setLoading(true);
    try {
      const kit = getKit();
      if (!kit) throw new Error('Wallet kit not initialized');

      // Use authModal which handles module selection and returns address
      const { address } = await kit.authModal();
      
      setUser({ uid: address });
      localStorage.setItem('activeWallet', address);

      // Check if profile exists
      const userDocRef = doc(db, 'users', address);
      const docSnap = await getDoc(userDocRef);

      return { isNew: !docSnap.exists(), publicKey: address };
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const createWalletProfile = async (role: 'merchant' | 'customer', fullName: string) => {
    await sendSecurePayload('secureWriteProfile', 'createProfile', { role, fullName });
  };

  const updateProfileDetails = async (fullName: string) => {
    await sendSecurePayload('secureWriteProfile', 'updateProfile', { fullName });
  };

  const deleteUserAccount = async () => {
    await sendSecurePayload('secureDeleteAccount', 'deleteAccount');
    logOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithWallet,
        createWalletProfile,
        updateProfileDetails,
        deleteUserAccount,
        logOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
