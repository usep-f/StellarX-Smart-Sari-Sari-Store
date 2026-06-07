'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  onAuthStateChanged,
  signOut,
  deleteUser as firebaseDeleteUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot,
  getDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

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
  signInWithWallet: (walletAddress: string) => Promise<{ isNew: boolean }>;
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

  // Listen for authentication changes
  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Setup a real-time listener for the user profile document in Firestore
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
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
        if (unsubscribeProfile) {
          unsubscribeProfile();
        }
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const signInWithWallet = async (walletAddress: string) => {
    setLoading(true);
    try {
      // 1. Get challenge
      const challengeRes = await fetch(getFunctionUrl('getAuthChallenge'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });
      if (!challengeRes.ok) {
        throw new Error('Failed to request authentication challenge.');
      }
      const { unsignedXdr } = await challengeRes.json();

      // 2. Sign with Freighter
      const freighter = await import('@stellar/freighter-api');
      const signed = await freighter.signTransaction(unsignedXdr, {
        networkPassphrase: 'Test SDF Network ; September 2015',
        address: walletAddress,
      });
      if (signed.error) {
        throw new Error(typeof signed.error === 'string' ? signed.error : 'Signing was rejected by Freighter.');
      }

      // 3. Verify challenge and get Firebase Custom Token
      const verifyRes = await fetch(getFunctionUrl('verifyAuthChallenge'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedXdr: signed.signedTxXdr, walletAddress }),
      });
      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        console.error('verifyAuthChallenge failed:', errData);
        throw new Error(errData.details || errData.error || 'Verification failed.');
      }
      const { customToken } = await verifyRes.json();

      // 4. Sign in to Firebase Auth
      const { signInWithCustomToken } = await import('firebase/auth');
      const userCredential = await signInWithCustomToken(auth, customToken);
      const loggedInUser = userCredential.user;

      // 5. Check if profile exists
      const userDocRef = doc(db, 'users', loggedInUser.uid);
      const docSnap = await getDoc(userDocRef);

      return { isNew: !docSnap.exists() };
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const createWalletProfile = async (role: 'merchant' | 'customer', fullName: string) => {
    if (!user) throw new Error('User must be logged in to create a profile.');
    
    const userProfile: UserProfile = {
      email: null,
      role,
      fullName,
      linkedWallet: user.uid,
      createdAt: Date.now(),
    };

    await setDoc(doc(db, 'users', user.uid), userProfile);
  };

  const updateProfileDetails = async (fullName: string) => {
    if (!user) throw new Error('User must be logged in to update profile details.');
    const userDocRef = doc(db, 'users', user.uid);
    await updateDoc(userDocRef, {
      fullName,
    });

    // Sync the owner's name to their registered store if they are a merchant
    if (profile?.role === 'merchant') {
      try {
        const storeDocRef = doc(db, 'stores', user.uid);
        const storeSnap = await getDoc(storeDocRef);
        if (storeSnap.exists()) {
          await updateDoc(storeDocRef, {
            ownerName: fullName,
          });
        }
      } catch (err) {
        console.error('Failed to sync updated owner name to store document:', err);
      }
    }
  };

  const deleteUserAccount = async () => {
    if (!user) throw new Error('User must be logged in to delete their account.');

    // 1. Cascade delete Firestore data
    const userDocRef = doc(db, 'users', user.uid);

    // A. Delete customer purchases
    if (profile?.role === 'customer') {
      const purchasesQuery = query(collection(db, 'purchases'), where('uid', '==', user.uid));
      const purchasesSnap = await getDocs(purchasesQuery);
      const deletePromises = purchasesSnap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletePromises);
    }

    // B. Delete merchant store items and legacy data
    if (profile?.role === 'merchant') {
      // Delete nested products
      const storeProductsQuery = query(collection(db, 'stores', user.uid, 'products'));
      const storeProductsSnap = await getDocs(storeProductsQuery);
      const deleteStoreProdsPromises = storeProductsSnap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deleteStoreProdsPromises);

      // Delete nested receipts
      const storeReceiptsQuery = query(collection(db, 'stores', user.uid, 'receipts'));
      const storeReceiptsSnap = await getDocs(storeReceiptsQuery);
      const deleteStoreReceiptsPromises = storeReceiptsSnap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deleteStoreReceiptsPromises);

      // Delete legacy products
      const legacyProductsQuery = query(collection(db, 'products'), where('uid', '==', user.uid));
      const legacyProductsSnap = await getDocs(legacyProductsQuery);
      const deleteLegacyProdsPromises = legacyProductsSnap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deleteLegacyProdsPromises);

      // Delete legacy receipts
      const legacyReceiptsQuery = query(collection(db, 'receipts'), where('uid', '==', user.uid));
      const legacyReceiptsSnap = await getDocs(legacyReceiptsQuery);
      const deleteLegacyReceiptsPromises = legacyReceiptsSnap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deleteLegacyReceiptsPromises);
    }

    // C. Delete the user profile document itself
    await deleteDoc(userDocRef);

    // 2. Delete from Firebase Authentication
    try {
      await firebaseDeleteUser(user);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'auth/requires-recent-login') {
        throw new Error('Verification required: Please sign in again, then attempt account deletion immediately.');
      }
      throw err;
    }
  };

  const logOut = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } finally {
      setLoading(false);
    }
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
