'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertOctagon, Info, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'danger';
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  onConfirm,
  onClose,
}: ConfirmationModalProps) {
  
  // Close on ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scroll when modal is open
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

  const config = {
    info: {
      icon: <Info className="w-6 h-6 text-sky-400" />,
      iconBg: 'bg-sky-500/10 border-sky-500/20Class',
      borderClass: 'border-sky-500/20',
      confirmBtnClass: 'bg-sky-500 hover:bg-sky-600 focus:ring-sky-500/20 text-white',
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6 text-amber-400" />,
      iconBg: 'bg-amber-500/10 border-amber-500/20Class',
      borderClass: 'border-amber-500/20',
      confirmBtnClass: 'bg-[#ff7a00] hover:bg-[#e06b00] focus:ring-[#ff7a00]/20 text-white',
    },
    danger: {
      icon: <AlertOctagon className="w-6 h-6 text-red-400" />,
      iconBg: 'bg-red-500/10 border-red-500/20Class',
      borderClass: 'border-red-500/20',
      confirmBtnClass: 'bg-red-500 hover:bg-red-600 focus:ring-red-500/20 text-white',
    },
  }[type];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity pointer-events-auto"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`w-full max-w-md pointer-events-auto glass rounded-3xl p-6 border ${config.borderClass} shadow-2xl flex flex-col gap-5 relative overflow-hidden`}
            style={{ backgroundColor: 'rgba(13, 18, 30, 0.95)' }}
          >
            {/* Top Close Cross */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-white p-1 rounded-xl hover:bg-white/5 transition duration-150"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Content Body */}
            <div className="flex gap-4 items-start">
              {/* Type-based warning icon block */}
              <div className={`p-3 rounded-2xl border shrink-0 bg-white/5 border-white/5`}>
                {config.icon}
              </div>
              <div className="flex flex-col gap-1.5 pr-4">
                <h3 className="text-base font-extrabold text-white leading-tight">
                  {title}
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {message}
                </p>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex gap-3 mt-1 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition duration-150"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 ${config.confirmBtnClass}`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
