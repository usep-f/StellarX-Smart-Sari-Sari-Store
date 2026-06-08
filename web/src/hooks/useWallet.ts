'use client';
import { useState, useCallback, useEffect } from 'react';
import { getKit } from '@/lib/wallet';

export interface WalletState {
  publicKey: string | null;
  connecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string>;
}

export function useWallet(): WalletState {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('activeWallet');
    const timerId = setTimeout(() => {
      if (stored) {
        setPublicKey(stored);
      }
    }, 0);
    return () => clearTimeout(timerId);
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const kit = getKit();
      if (!kit) throw new Error('Wallet kit not initialized');

      const { address } = await kit.authModal();
      if (!address) {
        throw new Error('No address returned — did you approve the request?');
      }

      setPublicKey(address);
      localStorage.setItem('activeWallet', address);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setPublicKey(null);
    setError(null);
    localStorage.removeItem('activeWallet');
  }, []);

  const signTransaction = useCallback(async (xdr: string) => {
    const kit = getKit();
    if (!kit) throw new Error('Wallet kit not initialized');
    const { signedTxXdr } = await kit.signTransaction(xdr, {
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
    return signedTxXdr;
  }, []);

  return { publicKey, connecting, error, connect, disconnect, signTransaction };
}
