'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  isOpen: boolean;
  message?: string;
}

export default function LoadingOverlay({
  isOpen,
  message = 'Processing transaction, please wait...',
}: LoadingOverlayProps) {
  
  // Prevent background scroll when overlay is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-xs pointer-events-auto"
          />

          {/* Glowing Spinner Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full max-w-xs pointer-events-auto glass rounded-3xl p-8 border border-white/5 shadow-2xl flex flex-col items-center justify-center gap-5 text-center relative overflow-hidden neon-glow-orange"
            style={{ backgroundColor: 'rgba(13, 18, 30, 0.95)' }}
          >
            {/* Spinning Glow Loader */}
            <div className="relative w-16 h-16 flex items-center justify-center">
              {/* Outer pulsing ring */}
              <div className="absolute inset-0 rounded-full bg-[#ff7a00]/10 border border-[#ff7a00]/25 animate-ping opacity-75" />
              
              <Loader2 className="w-10 h-10 animate-spin text-[#ff7a00] relative z-10" />
            </div>

            {/* Status Message */}
            <div className="flex flex-col gap-1.5 mt-2">
              <span className="text-[10px] text-[#ff7a00] uppercase tracking-widest font-extrabold animate-pulse">
                System Active
              </span>
              <p className="text-xs font-semibold text-gray-200 leading-relaxed max-w-[180px] mx-auto">
                {message}
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
