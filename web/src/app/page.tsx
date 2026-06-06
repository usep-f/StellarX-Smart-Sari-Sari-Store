'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, getCountFromServer } from 'firebase/firestore';
import { getAllStores, Store } from '@/lib/registryContract';
import { server } from '@/lib/stellar';
import { useToast } from '@/components/ui/Toast';
import { 
  ChevronDown, ChevronUp, RefreshCw, Loader2, Coins, MapPin, 
  User, ArrowRight, Check, HelpCircle, Shield, Globe, Cpu, X, Send, Code, Megaphone, MessageCircle,
  Store as StoreIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

// Dynamically import Map component (ssr: false) to prevent Next.js build errors
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] bg-slate-950/40 rounded-2xl flex items-center justify-center border border-white/5 animate-pulse text-gray-500 text-xs font-mono">
      Loading Sari-Sari Discovery Map...
    </div>
  ),
});

export default function Home() {
  const { error } = useToast();
  const { user, profile } = useAuth();

  // Store lists & user count states
  const [stores, setStores] = useState<Store[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  
  const [userCount, setUserCount] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // FAQ states
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Stellar testnet RPC health
  const [rpcStatus, setRpcStatus] = useState<'checking' | 'online' | 'degraded'>('checking');
  const [latestLedger, setLatestLedger] = useState<number | null>(null);
  const [rpcLatency, setRpcLatency] = useState<number | null>(null);

  // Load stores from Soroban Registry
  const loadStores = useCallback(async () => {
    setLoadingStores(true);
    try {
      const contractStores = await getAllStores();
      setStores(contractStores);
    } catch (err) {
      console.error('Failed to load stores from Soroban:', err);
      error('Failed to load stores from blockchain registry.');
    } finally {
      setLoadingStores(false);
    }
  }, [error]);

  // Load user count from Firestore
  const loadUserCount = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const coll = collection(db, 'users');
      const snap = await getCountFromServer(coll);
      setUserCount(snap.data().count);
    } catch (err) {
      console.error('Failed to fetch user count from Firestore:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Check RPC Node health
  const checkRpcHealth = useCallback(async () => {
    const start = Date.now();
    try {
      const res = await server.getLatestLedger();
      if (res && res.sequence) {
        setLatestLedger(res.sequence);
        setRpcStatus('online');
        setRpcLatency(Date.now() - start);
      } else {
        setRpcStatus('degraded');
      }
    } catch (err) {
      console.error('Stellar RPC is unreachable:', err);
      setRpcStatus('degraded');
    }
  }, []);

  // Fetch initial data
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStores();
    loadUserCount();
    checkRpcHealth();

    // User geolocation fetch
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        },
        () => {
          setUserLocation([14.6507, 121.0506]); // Default Quezon City
        }
      );
    } else {
      setUserLocation([14.6507, 121.0506]);
    }

    const interval = setInterval(checkRpcHealth, 30000); // Poll health every 30s
    return () => clearInterval(interval);
  }, [loadStores, loadUserCount, checkRpcHealth]);

  const faqItems = [
    {
      q: "How do I connect my wallet to the platform?",
      a: "Install the Freighter Wallet browser extension, fund a Testnet account using our Friendbot faucet directly on the dashboard, and click 'Connect Wallet' in the merchant or customer portals."
    },
    {
      q: "What token is used for payments?",
      a: "The platform operates entirely on the Stellar Testnet using native XLM. It has a zero-inflation structure and processes payments with nominal network fees (fractions of a cent)."
    },
    {
      q: "How does the store discovery map work?",
      a: "Store Owners register their physical locations by sending coordinate data directly to our Soroban smart contract registry. Once mined, their store instantly renders on our live discovery map."
    },
    {
      q: "How fast are transaction settlements?",
      a: "Stellar ledgers close every 4 to 5 seconds. Payments are settled instantly in near real-time, removing the typical 3-day clearing cycles of standard retail card terminals."
    },
    {
      q: "Is there a transaction or subscription fee?",
      a: "There are no platform or registration fees. Only the standard network transaction fee of 100 stroops (0.00001 XLM) is charged by the Stellar blockchain to ensure security and prevent DDoS spam."
    }
  ];

  return (
    <main className="min-h-screen w-full flex flex-col items-center bg-background overflow-x-hidden">
      
      {/* 1. HERO SECTION */}
      <section id="hero" className="w-full relative pt-24 pb-20 sm:pt-32 sm:pb-32 border-b border-white/5">
        
        {/* Dynamic Blobby Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ 
              x: ["0%", "15%", "-10%", "0%"], 
              y: ["0%", "10%", "-15%", "0%"],
              scale: [1, 1.2, 0.9, 1]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[5%] left-[10%] w-[500px] h-[500px] bg-[#ff7a00] rounded-full mix-blend-screen opacity-[0.15] blur-[100px]" 
          />
          <motion.div 
            animate={{ 
              x: ["0%", "-15%", "15%", "0%"], 
              y: ["0%", "15%", "10%", "0%"],
              scale: [1, 1.1, 1.3, 1]
            }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[10%] right-[5%] w-[400px] h-[400px] bg-[#00f0ff] rounded-full mix-blend-screen opacity-[0.15] blur-[100px]" 
          />
          <motion.div 
            animate={{ 
              x: ["0%", "20%", "-15%", "0%"], 
              y: ["0%", "-20%", "15%", "0%"],
              scale: [1, 1.3, 1.1, 1]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -bottom-[20%] left-[25%] w-[600px] h-[600px] bg-[#7000ff] rounded-full mix-blend-screen opacity-[0.15] blur-[120px]" 
          />
        </div>

        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 flex flex-col items-center text-center relative z-10">
        
        {/* Content */}
        <div className="w-full flex flex-col items-center gap-6">
          
          <motion.span 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#ff7a00]/10 border border-[#ff7a00]/25 text-[#ff7a00] text-[10px] font-extrabold tracking-widest uppercase px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-md shadow-[#ff7a00]/5"
          >
            <Coins className="w-3.5 h-3.5" /> StellarX workshop project
          </motion.span>
          
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl bg-clip-text text-transparent bg-linear-to-r from-white via-white to-gray-500 leading-tight"
          >
            The Web3 POS <br />
            <span className="bg-clip-text text-transparent bg-linear-to-r from-[#ff7a00] via-[#ffc700] to-[#00f0ff] text-neon-orange">
              For Sari-Sari Stores
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm sm:text-base text-gray-400 max-w-2xl leading-relaxed mx-auto"
          >
            A high-speed decentralized Point-of-Sale invoice generator and discovery network. Empowering micro-retail merchants in the Philippines using low-cost Stellar settlements.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-4 w-full sm:w-auto"
          >
            <Link
              href={user ? (profile?.role === 'merchant' ? '/merchant' : '/customer') : '/auth'}
              className="flex-1 sm:flex-initial bg-linear-to-r from-[#ff7a00] to-[#ffc700] hover:from-[#e06b00] hover:to-[#e0b000] text-white font-extrabold text-xs py-3.5 px-6 rounded-xl transition duration-200 flex items-center justify-center gap-1.5 shadow-lg shadow-[#ff7a00]/15 group"
            >
              {user ? 'Go to Dashboard' : 'Join Us'} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </Link>
          </motion.div>

          {/* Live Metrics Grid */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 gap-4 w-full max-w-md mt-6 border-t border-white/5 pt-6"
          >
            <div className="glass p-4 rounded-2xl border border-white/5 flex flex-col gap-1 relative overflow-hidden neon-glow-cyan">
              <div className="absolute top-1 right-2 flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00f0ff] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#00f0ff]"></span>
                </span>
                <span className="text-[7px] text-[#00f0ff] font-extrabold uppercase tracking-wider">Syncing Live</span>
              </div>
              <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Registered Stores</span>
              <span className="text-xl font-black text-white font-sans mt-0.5">
                {loadingStores ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#ff7a00]" />
                ) : (
                  `${stores.length} Active`
                )}
              </span>
            </div>

            <div className="glass p-4 rounded-2xl border border-white/5 flex flex-col gap-1 relative overflow-hidden neon-glow-orange">
              <div className="absolute top-1 right-2 flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff7a00] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#ff7a00]"></span>
                </span>
                <span className="text-[7px] text-[#ff7a00] font-extrabold uppercase tracking-wider">Syncing Live</span>
              </div>
              <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">System Users</span>
              <span className="text-xl font-black text-white font-sans mt-0.5">
                {loadingUsers ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#00f0ff]" />
                ) : (
                  `${userCount} Linked`
                )}
              </span>
            </div>
          </motion.div>

        </div>

        </div>
      </section>

      {/* 2. MAP SECTION */}
      <section id="map" className="w-full bg-background py-20 border-b border-white/5 scroll-mt-20 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#00f0ff]/5 via-transparent to-transparent pointer-events-none -z-10" />
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 flex flex-col gap-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
              <MapPin className="w-6 h-6 text-[#ff7a00]" /> Store Discovery Map
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Explore micro-merchants registered on the Stellar ledger in real-time.
            </p>
          </div>
          <button
            onClick={loadStores}
            className="self-start sm:self-center text-xs text-gray-400 hover:text-white transition flex items-center gap-1.5 p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStores ? 'animate-spin text-[#ff7a00]' : ''}`} /> 
            Reload Registry
          </button>
        </div>

        {/* Map Container Widget */}
        <div className="h-[450px] w-full rounded-3xl overflow-hidden border border-white/5 shadow-2xl relative">
          {loadingStores && (
            <div className="absolute inset-0 bg-slate-950/80 z-20 flex flex-col items-center justify-center text-gray-400 text-xs gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#ff7a00]" />
              <span className="font-mono">Syncing with Soroban ledger...</span>
            </div>
          )}
          <Map stores={stores} userLocation={userLocation} onStoreSelect={setSelectedStore} />

          {/* Floating Details Side-Panel on Click */}
          <AnimatePresence>
            {selectedStore && (
              <motion.div
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                className="absolute top-4 left-4 z-20 w-80 glass rounded-2xl p-5 border-white/5 flex flex-col gap-4 shadow-2xl pointer-events-auto"
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col items-start">
                    <span className="text-[8px] bg-[#ff7a00]/10 border border-[#ff7a00]/25 text-[#ff7a00] font-extrabold uppercase px-2 py-0.5 rounded-full">
                      On-Chain registry
                    </span>
                    <h4 className="text-base font-extrabold text-white mt-2 leading-tight">
                      {selectedStore.name}
                    </h4>
                  </div>
                  <button
                    onClick={() => setSelectedStore(null)}
                    className="p-1 hover:bg-white/5 rounded-lg text-gray-500 hover:text-gray-300 transition"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                <div className="flex flex-col gap-2.5 text-xs border-y border-white/5 py-3.5 my-1">
                  <div className="flex items-start gap-2.5 text-gray-400">
                    <MapPin className="w-4 h-4 text-[#00f0ff] shrink-0 mt-0.5" />
                    <div className="font-mono text-[10px] leading-relaxed">
                      Lat: {selectedStore.lat.toFixed(6)} <br />
                      Lng: {selectedStore.lng.toFixed(6)}
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 text-gray-400">
                    <User className="w-4 h-4 text-[#ffc700] shrink-0 mt-0.5" />
                    <div className="font-mono text-[10px] break-all leading-normal">
                      Owner: <br />
                      <span className="text-white select-all">{selectedStore.owner}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2.5 w-full">
                  <Link
                    href={`/customer?to=${selectedStore.owner}`}
                    className="flex-1 bg-linear-to-r from-[#ff7a00] to-[#ffc700] hover:from-[#e06b00] hover:to-[#e0b000] text-white text-xs font-bold py-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-[#ff7a00]/15"
                  >
                    <Coins className="w-3.5 h-3.5" /> Pay Merchant
                  </Link>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedStore.lat},${selectedStore.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white/5 hover:bg-white/10 text-white text-xs font-semibold py-3 px-4 rounded-xl border border-white/10 transition flex items-center justify-center"
                  >
                    Route
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        </div>
      </section>

      {/* 3. ABOUT US SECTION */}
      <section id="about" className="w-full bg-slate-950/30 py-20 border-b border-white/5 scroll-mt-20 relative">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#00f0ff]/5 blur-[120px] rounded-full pointer-events-none -z-10" />
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 flex flex-col gap-12">
        
        <div className="text-center max-w-2xl mx-auto flex flex-col gap-3">
          <span className="text-[10px] text-[#00f0ff] uppercase tracking-widest font-extrabold text-neon-cyan">About Us</span>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Bridging Local Commerce and Web3
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
            Sari-Stellar leverages the high-speed and ultra-low-fee architecture of the Stellar blockchain to bring modern financial rails to neighborhood sari-sari stores.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          
          <div className="glass p-6 rounded-3xl border border-white/5 flex flex-col gap-4 hover:shadow-xl hover:shadow-[#ff7a00]/5 transition duration-300 group">
            <div className="w-11 h-11 rounded-xl bg-[#ff7a00]/10 border border-[#ff7a00]/20 flex items-center justify-center text-[#ff7a00] group-hover:scale-105 transition duration-200">
              <Shield className="w-5.5 h-5.5" />
            </div>
            <h3 className="font-extrabold text-base text-white">Trustless Registry</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Store locations and credentials are saved immutable on-chain using Soroban Smart Contracts. No centralized entity can alter or revoke your business profile.
            </p>
          </div>

          <div className="glass p-6 rounded-3xl border border-white/5 flex flex-col gap-4 hover:shadow-xl hover:shadow-[#00f0ff]/5 transition duration-300 group">
            <div className="w-11 h-11 rounded-xl bg-[#00f0ff]/10 border border-[#00f0ff]/20 flex items-center justify-center text-[#00f0ff] group-hover:scale-105 transition duration-200">
              <Globe className="w-5.5 h-5.5" />
            </div>
            <h3 className="font-extrabold text-base text-white">Frictionless Settlements</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Skip intermediate banks and clearing agents. Receive digital payments in stable assets directly into your non-custodial wallet within seconds.
            </p>
          </div>

          <div className="glass p-6 rounded-3xl border border-white/5 flex flex-col gap-4 hover:shadow-xl hover:shadow-[#ffc700]/5 transition duration-300 group">
            <div className="w-11 h-11 rounded-xl bg-[#ffc700]/10 border border-[#ffc700]/20 flex items-center justify-center text-[#ffc700] group-hover:scale-105 transition duration-200">
              <Cpu className="w-5.5 h-5.5" />
            </div>
            <h3 className="font-extrabold text-base text-white">Hyper-scalable</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Built on the core principles of Stellar Core. Capable of handling thousands of transactions per second globally, ensuring smooth operations even during peak hours.
            </p>
          </div>

        </div>

        </div>
      </section>

      {/* 4. BENEFICIARIES SECTION */}
      <section id="beneficiaries" className="w-full bg-background py-20 border-b border-white/5 scroll-mt-20 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-[#00f0ff]/5 via-transparent to-transparent pointer-events-none -z-10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#ff7a00]/5 via-transparent to-transparent pointer-events-none -z-10" />
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6">
        
        <div className="text-center max-w-2xl mx-auto flex flex-col gap-3 mb-12">
          <span className="text-[10px] text-[#ffc700] uppercase tracking-widest font-extrabold">Beneficiaries</span>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Empowering Both Sides of the Counter
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
            A unified framework that provides specific solutions for both local store owners and their daily customers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          
          {/* Customer Card */}
          <div className="glass-cyan rounded-3xl p-8 border border-[#00f0ff]/15 flex flex-col justify-between gap-6 hover:shadow-2xl hover:shadow-[#00f0ff]/5 transition duration-300">
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#00f0ff]/10 border border-[#00f0ff]/30 flex items-center justify-center text-[#00f0ff]">
                <User className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-extrabold text-white">The Customer</h3>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                Enjoy hassle-free retail checkout without carrying paper bills or waiting for card authorizations. Use your smartphone to scan and settle payments securely in seconds.
              </p>
              
              <ul className="flex flex-col gap-2.5 mt-2">
                <li className="flex items-center gap-2 text-xs text-gray-300">
                  <div className="w-5 h-5 rounded-full bg-[#00f0ff]/10 flex items-center justify-center"><Check className="w-3 h-3 text-[#00f0ff]" /></div>
                  Connect and pay using secure wallet standard passkeys.
                </li>
                <li className="flex items-center gap-2 text-xs text-gray-300">
                  <div className="w-5 h-5 rounded-full bg-[#00f0ff]/10 flex items-center justify-center"><Check className="w-3 h-3 text-[#00f0ff]" /></div>
                  Zero surcharge or transaction markup.
                </li>
                <li className="flex items-center gap-2 text-xs text-gray-300">
                  <div className="w-5 h-5 rounded-full bg-[#00f0ff]/10 flex items-center justify-center"><Check className="w-3 h-3 text-[#00f0ff]" /></div>
                  Cryptographically secure, tamper-proof payment receipts.
                </li>
              </ul>
            </div>
          </div>

          {/* Store Owner Card */}
          <div className="glass-premium rounded-3xl p-8 border border-[#ff7a00]/15 flex flex-col justify-between gap-6 hover:shadow-2xl hover:shadow-[#ff7a00]/5 transition duration-300">
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#ff7a00]/10 border border-[#ff7a00]/30 flex items-center justify-center text-[#ff7a00]">
                <StoreIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-extrabold text-white">Sari-Sari Store Owner</h3>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                Take control of your cash flow. Track your inventories, issue barcodes, display digital QR invoices, and register your business on a global decentralized store catalog map.
              </p>
              
              <ul className="flex flex-col gap-2.5 mt-2">
                <li className="flex items-center gap-2 text-xs text-gray-300">
                  <div className="w-5 h-5 rounded-full bg-[#ff7a00]/10 flex items-center justify-center"><Check className="w-3 h-3 text-[#ff7a00]" /></div>
                  Non-custodial, peer-to-peer revenue collection.
                </li>
                <li className="flex items-center gap-2 text-xs text-gray-300">
                  <div className="w-5 h-5 rounded-full bg-[#ff7a00]/10 flex items-center justify-center"><Check className="w-3 h-3 text-[#ff7a00]" /></div>
                  Easy inventory lookup and product barcode generation.
                </li>
                <li className="flex items-center gap-2 text-xs text-gray-300">
                  <div className="w-5 h-5 rounded-full bg-[#ff7a00]/10 flex items-center justify-center"><Check className="w-3 h-3 text-[#ff7a00]" /></div>
                  No hardware terminal leases or merchant account lock-ins.
                </li>
              </ul>
            </div>
          </div>

        </div>

        </div>
      </section>

      {/* 5. FAQ SECTION */}
      <section id="faq" className="w-full bg-slate-950/30 py-20 border-b border-white/5 scroll-mt-20 relative">
        <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-[#00f0ff]/20 to-transparent" />
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6">
        
        <div className="text-center max-w-2xl mx-auto flex flex-col gap-3 mb-10">
          <span className="text-[10px] text-[#00f0ff] uppercase tracking-widest font-extrabold text-neon-cyan">FAQ</span>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
            Get quick answers about wallets, transaction speeds, ledger registrations, and fees.
          </p>
        </div>

        {/* Collapsible Accordions */}
        <div className="flex flex-col gap-3.5 w-full">
          {faqItems.map((item, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div 
                key={index} 
                className="glass rounded-2xl border border-white/5 overflow-hidden transition-all duration-300"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  className="w-full px-5 py-4.5 flex items-center justify-between text-left font-extrabold text-xs sm:text-sm text-white hover:bg-white/5 transition duration-150 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4.5 h-4.5 text-[#ff7a00] shrink-0" />
                    {item.q}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                    >
                      <div className="px-5 pb-5 pt-1 text-xs text-gray-400 border-t border-white/5 leading-relaxed bg-slate-950/20">
                        {item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        </div>
      </section>

      {/* 6. COMMUNITY HUB SECTION */}
      <section id="community" className="w-full bg-background py-20 border-b border-white/5 scroll-mt-20 relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#ff7a00]/5 blur-[100px] pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#00f0ff]/5 blur-[100px] pointer-events-none -z-10" />
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6">
        
        <div className="text-center flex flex-col gap-2 mb-10">
          <span className="text-[10px] text-[#ff7a00] uppercase tracking-widest font-extrabold">Community & Support</span>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Join the Network</h2>
          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed max-w-lg mx-auto">
            Connect with other merchants, developers, and the core team. As a decentralized protocol, our community is our primary support desk.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <a href="#" className="glass rounded-3xl p-6 border border-white/5 hover:border-[#ff7a00]/30 hover:shadow-lg hover:shadow-[#ff7a00]/10 transition duration-300 flex flex-col items-center text-center gap-4 group">
            <div className="w-12 h-12 rounded-2xl bg-[#ff7a00]/10 flex items-center justify-center text-[#ff7a00] group-hover:scale-110 transition duration-300">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-white">Discord</h3>
              <p className="text-xs text-gray-500 mt-1">Live support & developer chat</p>
            </div>
          </a>

          <a href="#" className="glass rounded-3xl p-6 border border-white/5 hover:border-[#00f0ff]/30 hover:shadow-lg hover:shadow-[#00f0ff]/10 transition duration-300 flex flex-col items-center text-center gap-4 group">
            <div className="w-12 h-12 rounded-2xl bg-[#00f0ff]/10 flex items-center justify-center text-[#00f0ff] group-hover:scale-110 transition duration-300">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-white">X / Twitter</h3>
              <p className="text-xs text-gray-500 mt-1">Announcements & updates</p>
            </div>
          </a>

          <a href="#" className="glass rounded-3xl p-6 border border-white/5 hover:border-white/20 hover:shadow-lg transition duration-300 flex flex-col items-center text-center gap-4 group">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white group-hover:scale-110 transition duration-300">
              <Code className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-white">GitHub</h3>
              <p className="text-xs text-gray-500 mt-1">Contribute to the Soroban contracts</p>
            </div>
          </a>
        </div>

        </div>
      </section>

      {/* 7. FOOTER SECTION */}
      <footer className="w-full border-t border-white/5 bg-slate-950/40 py-12 px-4 sm:px-6 flex flex-col items-center">
        <div className="max-w-6xl w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8 text-left">
          
          {/* Brand Info */}
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-[#ff7a00] to-[#ffc700] flex items-center justify-center text-white">
                <Coins className="w-4.5 h-4.5" />
              </div>
              <span className="font-bold text-sm text-white">Sari-Stellar</span>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Decentralized retail payment desks built on the Stellar Network for communities across the Philippines.
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Navigation</h4>
            <div className="flex flex-col gap-2 text-xs">
              <a href="#hero" className="text-gray-500 hover:text-white transition duration-150">Top</a>
              <a href="#map" className="text-gray-500 hover:text-white transition duration-150">Discovery Map</a>
              <a href="#about" className="text-gray-500 hover:text-white transition duration-150">About Us</a>
              <a href="#faq" className="text-gray-500 hover:text-white transition duration-150">FAQs</a>
            </div>
          </div>

          {/* Stellar Resources */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Resources</h4>
            <div className="flex flex-col gap-2 text-xs">
              <a href="https://stellar.org" target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white transition duration-150">Stellar Network</a>
              <a href="https://developers.stellar.org" target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white transition duration-150">Soroban Docs</a>
              <a href="https://stellar.org/foundation" target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white transition duration-150">Stellar Foundation</a>
              <a href="https://stellar.expert/explorer/testnet" target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white transition duration-150">Testnet Explorer</a>
            </div>
          </div>

          {/* Network Health Indicator */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Network Status</h4>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="relative flex h-2 w-2">
                  {rpcStatus === 'online' ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </>
                  ) : rpcStatus === 'checking' ? (
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 animate-pulse"></span>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  )}
                </span>
                
                <span className="font-semibold text-gray-300">
                  {rpcStatus === 'online' ? 'Stellar Testnet: Online' : rpcStatus === 'checking' ? 'Connecting to Node...' : 'Stellar Testnet: Degraded'}
                </span>
              </div>
              
              {latestLedger && (
                <p className="text-[10px] text-gray-500 font-mono pl-4 leading-normal">
                  Ledger: #{latestLedger} <br />
                  Latency: {rpcLatency}ms
                </p>
              )}
            </div>
          </div>

        </div>

        <div className="max-w-6xl w-full border-t border-white/5 pt-8 text-center flex flex-col gap-2 text-[10px] text-gray-600">
          <p>© {new Date().getFullYear()} Sari-Stellar. Operating in sandbox test environment.</p>
          <p>Created for the StellarX PH workshop @ PUP QC.</p>
        </div>
      </footer>

    </main>
  );
}
