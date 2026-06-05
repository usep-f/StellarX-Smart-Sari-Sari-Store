'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getAllStores, Store } from '@/lib/registryContract';
import { 
  ChevronRight, 
  MapPin, Coins, Layers, ArrowRight, User, Settings, RefreshCw, Loader2 
} from 'lucide-react';

// Dynamically import Map component (ssr: false) to prevent Next.js build errors
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] bg-black/40 rounded-2xl flex items-center justify-center border border-white/5 animate-pulse text-gray-500 text-xs">
      Loading Sari-Sari Map...
    </div>
  ),
});

export default function Home() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Load registered stores from Soroban contract
  const loadStores = useCallback(async () => {
    setLoadingStores(true);
    try {
      const contractStores = await getAllStores();
      
      // Seed default mock stores to make the map look active immediately if contract is empty
      const mockStores: Store[] = [
        {
          owner: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
          name: "Ate Nena's Tindahan (Demo)",
          lat: 14.6535,
          lng: 121.0485,
        },
        {
          owner: 'GDZPPDBCG7HWRDIPNUXEALM4N4PTEPZZG33MREFLF6L5YTYYV3MYMEMO',
          name: "Kuya Juan's Mart (Demo)",
          lat: 14.6485,
          lng: 121.0525,
        },
        {
          owner: 'GACW52K7HJDEML2D6XWZLTN66J3EFLFRG2YJCYFL4NAT4AQH3ZLLMEMO',
          name: "Lorna's Mini Store (Demo)",
          lat: 14.6515,
          lng: 121.0550,
        },
      ];

      // Combine contract stores and mock stores
      setStores([...contractStores, ...mockStores]);
    } catch (err) {
      console.error('Failed to load stores from contract:', err);
    } finally {
      setLoadingStores(false);
    }
  }, []);

  // Fetch user location
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStores();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        },
        () => {
          // Fallback to Quezon City default center
          setUserLocation([14.6507, 121.0506]);
        }
      );
    } else {
      setUserLocation([14.6507, 121.0506]);
    }
  }, [loadStores]);

  return (
    <main className="min-h-screen w-full py-12 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl flex flex-col gap-10">
        
        {/* Hero Banner */}
        <section className="text-center flex flex-col items-center gap-4 max-w-3xl mx-auto">
          <span className="bg-[#ff7a00]/10 border border-[#ff7a00]/25 text-[#ff7a00] text-[10px] font-extrabold tracking-widest uppercase px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-md shadow-[#ff7a00]/5">
            <Coins className="w-3.5 h-3.5" /> StellarX workshop project
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl mt-2 bg-clip-text text-transparent bg-linear-to-r from-white via-white to-gray-500">
            Sari-Stellar POS & Map
          </h1>
          <p className="text-sm text-gray-400 max-w-xl leading-relaxed mt-2">
            A Web3 Point-of-Sale (PoS) system and discovery map for local sari-sari stores in the Philippines. Operating entirely on the Stellar Testnet using native XLM.
          </p>
        </section>

        {/* Quick Stats Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
          <div className="glass p-4 rounded-2xl border border-white/5 flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 uppercase font-medium">Registered Stores</span>
            <span className="text-xl font-extrabold text-white">{stores.length} Active</span>
          </div>
          <div className="glass p-4 rounded-2xl border border-white/5 flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 uppercase font-medium">Payment Asset</span>
            <span className="text-xl font-extrabold text-[#ffc700]">XLM Native</span>
          </div>
          <div className="glass p-4 rounded-2xl border border-white/5 flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 uppercase font-medium">Settlement Speed</span>
            <span className="text-xl font-extrabold text-[#00c853]">~5 Seconds</span>
          </div>
          <div className="glass p-4 rounded-2xl border border-white/5 flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 uppercase font-medium">Registry Ledger</span>
            <span className="text-xl font-extrabold text-white flex items-center gap-1">
              Soroban <Layers className="w-4 h-4 text-[#ff7a00]" />
            </span>
          </div>
        </section>

        {/* Interactive Discovery Map */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#ff7a00]" /> Nearby Sari-Sari Stores
            </h3>
            <button
              onClick={loadStores}
              className="text-xs text-gray-400 hover:text-white transition flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reload Map
            </button>
          </div>
          <div className="h-[400px] w-full rounded-3xl overflow-hidden border border-card-border shadow-2xl relative">
            {loadingStores ? (
              <div className="absolute inset-0 bg-black/40 z-20 flex items-center justify-center text-gray-400 text-xs gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#ff7a00]" /> Loading store registry...
              </div>
            ) : null}
            <Map stores={stores} userLocation={userLocation} />
          </div>
        </section>

        {/* Portal Entry Callouts */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-2">
          
          {/* Merchant Card */}
          <div className="glass-premium rounded-3xl p-6 flex flex-col justify-between gap-6 hover:shadow-xl hover:shadow-[#ff7a00]/5 transition duration-300">
            <div className="flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ff7a00]/15 border border-[#ff7a00]/25 flex items-center justify-center text-[#ff7a00]">
                <Settings className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Store Owner Portal</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Connect your Freighter wallet to register your shop on the decentralized map registry, add catalog products, print product barcodes, and display payment QR invoices.
              </p>
            </div>
            <button
              onClick={() => router.push('/merchant')}
              className="w-full bg-[#ff7a00] hover:bg-[#e06b00] text-white font-bold py-3 px-4 rounded-xl transition flex items-center justify-center gap-1.5 group shadow-lg shadow-[#ff7a00]/15"
            >
              Launch Merchant Dashboard <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </button>
          </div>

          {/* Customer Card */}
          <div className="glass rounded-3xl p-6 flex flex-col justify-between gap-6 hover:shadow-xl hover:shadow-white/5 transition duration-300">
            <div className="flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00c853]/15 border border-[#00c853]/25 flex items-center justify-center text-[#00c853]">
                <User className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Customer Payment Desk</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Use your phone camera to scan merchant invoices, connect Freighter to sign payments in native XLM, and instantly acquire cryptographically secure receipts on-chain.
              </p>
            </div>
            <button
              onClick={() => router.push('/customer')}
              className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3 px-4 rounded-xl border border-white/10 transition flex items-center justify-center gap-1.5 group"
            >
              Open Camera Scanner <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </button>
          </div>

        </section>

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-gray-600 flex flex-col gap-1 border-t border-white/5 pt-6">
          <p>Sari-Stellar dApp is built using Stellar, Soroban, Next.js, and Leaflet Maps.</p>
          <p>Created for the StellarX PH workshop @ PUP QC · Testnet Environment.</p>
        </footer>

      </div>
    </main>
  );
}
