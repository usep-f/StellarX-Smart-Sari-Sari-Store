'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser as firebaseDeleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential
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
  email: string;
  role: 'merchant' | 'customer';
  linkedWallet: string | null;
  createdAt: number;
  fullName?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, role: 'merchant' | 'customer', fullName: string) => Promise<void>;
  logOut: () => Promise<void>;
  linkWalletAddress: (walletAddress: string) => Promise<void>;
  updateProfileDetails: (fullName: string) => Promise<void>;
  unlinkWalletAddress: () => Promise<void>;
  deleteUserAccount: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, role: 'merchant' | 'customer', fullName: string) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      // Create the user profile in Firestore
      const userProfile: UserProfile = {
        email,
        role,
        fullName,
        linkedWallet: null,
        createdAt: Date.now(),
      };

      await setDoc(doc(db, 'users', newUser.uid), userProfile);
    } catch (error) {
      setLoading(false);
      throw error;
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

  const linkWalletAddress = async (walletAddress: string) => {
    if (!user) throw new Error('User must be logged in to link a wallet.');
    const userDocRef = doc(db, 'users', user.uid);
    await updateDoc(userDocRef, {
      linkedWallet: walletAddress,
    });

    // Sync the owner's name to their registered store, if it exists
    try {
      const storeDocRef = doc(db, 'stores', walletAddress);
      const storeSnap = await getDoc(storeDocRef);
      if (storeSnap.exists()) {
        await updateDoc(storeDocRef, {
          ownerName: profile?.fullName || user.email?.split('@')[0] || 'Unknown',
        });
      }
    } catch (err) {
      console.error('Failed to sync owner name to store document:', err);
    }
  };

  const updateProfileDetails = async (fullName: string) => {
    if (!user) throw new Error('User must be logged in to update profile details.');
    const userDocRef = doc(db, 'users', user.uid);
    await updateDoc(userDocRef, {
      fullName,
    });

    // Sync the owner's name to their registered store if they have a linked wallet
    if (profile?.linkedWallet) {
      try {
        const storeDocRef = doc(db, 'stores', profile.linkedWallet);
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

  const unlinkWalletAddress = async () => {
    if (!user) throw new Error('User must be logged in to unlink a wallet.');
    const userDocRef = doc(db, 'users', user.uid);
    await updateDoc(userDocRef, {
      linkedWallet: null,
    });
  };

  const deleteUserAccount = async (password: string) => {
    if (!user) throw new Error('User must be logged in to delete their account.');
    if (!user.email) throw new Error('User email not found.');

    // 1. Re-authenticate the user first to verify the request
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);

    // 2. Cascade delete Firestore data
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
      if (profile.linkedWallet) {
        // Delete nested products
        const storeProductsQuery = query(collection(db, 'stores', profile.linkedWallet, 'products'));
        const storeProductsSnap = await getDocs(storeProductsQuery);
        const deleteStoreProdsPromises = storeProductsSnap.docs.map((d) => deleteDoc(d.ref));
        await Promise.all(deleteStoreProdsPromises);

        // Delete nested receipts
        const storeReceiptsQuery = query(collection(db, 'stores', profile.linkedWallet, 'receipts'));
        const storeReceiptsSnap = await getDocs(storeReceiptsQuery);
        const deleteStoreReceiptsPromises = storeReceiptsSnap.docs.map((d) => deleteDoc(d.ref));
        await Promise.all(deleteStoreReceiptsPromises);
      }

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

    // 3. Delete from Firebase Authentication
    await firebaseDeleteUser(user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        logOut,
        linkWalletAddress,
        updateProfileDetails,
        unlinkWalletAddress,
        deleteUserAccount,
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
