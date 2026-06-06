'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  User as UserIcon, LogOut, Menu, X, ChevronDown, Coins, LayoutDashboard 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const { user, profile, logOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Monitor scroll height to add extra background blur on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menus on page navigation
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenuOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  const navLinks = [
    { name: 'Discovery Map', href: '/#map' },
    { name: 'About Us', href: '/#about' },
    { name: 'Beneficiaries', href: '/#beneficiaries' },
    { name: 'FAQ', href: '/#faq' },
    { name: 'Community', href: '/#community' },
  ];

  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // If we are on the homepage, scroll smoothly
    if (pathname === '/' && href.startsWith('/#')) {
      e.preventDefault();
      const elementId = href.substring(2);
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setMobileMenuOpen(false);
      }
    }
  };

  const getDashboardUrl = () => {
    if (!profile) return '/auth';
    return profile.role === 'merchant' ? '/merchant' : '/customer';
  };

  const getUserInitials = () => {
    if (!profile?.email) return 'U';
    return profile.email.substring(0, 2).toUpperCase();
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled 
        ? 'bg-background/95 backdrop-blur-2xl border-b border-white/5 shadow-2xl shadow-black/50 py-3' 
        : 'bg-transparent py-5'
    }`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-[#ff7a00] to-[#ffc700] flex items-center justify-center text-white shadow-md shadow-[#ff7a00]/20 group-hover:scale-105 transition duration-200">
            <Coins className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5 font-sans">
            Sari-Stellar <span className="text-[10px] bg-[#00f0ff]/10 border border-[#00f0ff]/20 text-[#00f0ff] font-extrabold uppercase px-1.5 py-0.5 rounded-md">PH</span>
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              onClick={(e) => handleScrollTo(e, link.href)}
              className="text-xs font-semibold text-gray-400 hover:text-white transition duration-200"
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Desktop Profile / Login CTAs */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="relative">
              {/* Profile Avatar trigger */}
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 p-1.5 pl-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 transition duration-200 text-left cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-linear-to-tr from-[#ff7a00]/20 to-[#00f0ff]/20 border border-[#ff7a00]/30 flex items-center justify-center text-[10px] font-extrabold text-white">
                  {getUserInitials()}
                </div>
                <div className="flex flex-col pr-1">
                  <span className="text-[10px] text-gray-400 font-bold max-w-[100px] truncate leading-tight">
                    {profile?.email}
                  </span>
                  <span className="text-[8px] text-[#00f0ff] uppercase tracking-widest font-extrabold leading-none mt-0.5">
                    {profile?.role === 'merchant' ? 'Store Owner' : 'Customer'}
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown */}
              <AnimatePresence>
                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-56 rounded-2xl glass border-white/5 p-2 shadow-2xl z-20 flex flex-col gap-1"
                    >
                      <div className="px-3 py-2 border-b border-white/5 mb-1 text-left">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Account</p>
                        <p className="text-xs text-white truncate font-medium mt-0.5">{profile?.email}</p>
                      </div>
                      
                      <Link
                        href={getDashboardUrl()}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition duration-150"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <LayoutDashboard className="w-4 h-4 text-[#ff7a00]" />
                        My Dashboard
                      </Link>

                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          logOut().then(() => router.push('/'));
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition duration-150 text-left w-full cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-400" />
                        Sign Out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link
              href="/auth"
              className="bg-white/5 hover:bg-white/10 text-white font-bold text-xs py-2.5 px-5 rounded-xl border border-white/10 transition duration-200 flex items-center gap-1.5 shadow-md hover:shadow-[#00f0ff]/5"
            >
              <UserIcon className="w-3.5 h-3.5 text-[#00f0ff]" />
              Sign In
            </Link>
          )}
        </div>

        {/* Mobile Hamburger menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition text-gray-400 hover:text-white"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

      </div>

      {/* Mobile Drawer menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden mt-2 rounded-2xl glass border-white/5 p-4 shadow-2xl flex flex-col gap-4 overflow-hidden"
          >
            <nav className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={(e) => handleScrollTo(e, link.href)}
                  className="text-xs font-bold text-gray-400 hover:text-white transition duration-200 py-1"
                >
                  {link.name}
                </Link>
              ))}
            </nav>

            <div className="border-t border-white/5 pt-4 flex flex-col gap-2">
              {user ? (
                <>
                  <div className="flex items-center gap-2 px-1 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-[#ff7a00]/20 to-[#00f0ff]/20 border border-[#ff7a00]/30 flex items-center justify-center text-xs font-extrabold text-white">
                      {getUserInitials()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs text-white truncate font-medium leading-tight">{profile?.email}</span>
                      <span className="text-[8px] text-[#00f0ff] uppercase tracking-widest font-extrabold leading-none mt-0.5">
                        {profile?.role === 'merchant' ? 'Store Owner' : 'Customer'}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={getDashboardUrl()}
                    className="flex items-center justify-center gap-1.5 bg-[#ff7a00] hover:bg-[#e06b00] text-white font-bold text-xs py-3 px-4 rounded-xl transition"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Open Dashboard
                  </Link>

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logOut().then(() => router.push('/'));
                    }}
                    className="flex items-center justify-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 font-bold text-xs py-3 px-4 rounded-xl transition cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  href="/auth"
                  className="bg-white/5 hover:bg-white/10 text-white font-bold text-xs py-3 px-4 rounded-xl border border-white/10 transition flex items-center justify-center gap-1.5"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <UserIcon className="w-4 h-4 text-[#00f0ff]" />
                  Sign In
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
