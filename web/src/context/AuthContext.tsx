'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot,
  getDoc
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
