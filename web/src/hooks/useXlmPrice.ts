'use client';

import { useState, useEffect, useCallback } from 'react';

const CRYPTOCOMPARE_API_URL = 'https://min-api.cryptocompare.com/data/price?fsym=XLM&tsyms=PHP';
const DEFAULT_RATE = 10.00; // Fallback rate in PHP per 1 XLM
const POLL_INTERVAL = 10000; // 10 seconds

export interface XlmPriceState {
  rate: number;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => Promise<number>;
}

export function useXlmPrice(): XlmPriceState {
  const [rate, setRate] = useState<number>(DEFAULT_RATE);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchRate = useCallback(async (): Promise<number> => {
    setLoading(true);
    try {
      const res = await fetch(CRYPTOCOMPARE_API_URL);
      if (!res.ok) {
        throw new Error(`Failed to fetch exchange rate from CryptoCompare: ${res.statusText}`);
      }
      const data = await res.json();
      const price = parseFloat(data?.PHP);
      if (isNaN(price) || price <= 0) {
        throw new Error('CryptoCompare API returned invalid exchange rate price');
      }
      setRate(price);
      setError(null);
      setLastUpdated(new Date());
      setLoading(false);
      return price;
    } catch (err: unknown) {
      console.error('Error fetching XLM to PHP rate:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
      // Retain the existing rate (or fallback) on failure
      return rate;
    }
  }, [rate]);

  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    let intervalId: NodeJS.Timeout;

    const startPolling = () => {
      // Defer initial fetch to prevent synchronous setState during mounting
      Promise.resolve().then(() => {
        fetchRate();
      });
      intervalId = setInterval(fetchRate, POLL_INTERVAL);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };

    if (document.visibilityState === 'visible') {
      startPolling();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchRate]);

  return { rate, loading, error, lastUpdated, refetch: fetchRate };
}
