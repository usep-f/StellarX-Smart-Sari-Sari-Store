'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toast: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message, duration }]);

    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, [removeToast]);

  const success = useCallback((msg: string, dur?: number) => toast('success', msg, dur), [toast]);
  const error = useCallback((msg: string, dur?: number) => toast('error', msg, dur), [toast]);
  const info = useCallback((msg: string, dur?: number) => toast('info', msg, dur), [toast]);
  const warning = useCallback((msg: string, dur?: number) => toast('warning', msg, dur), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info, warning }}>
      {children}
      
      {/* Toast Overlay Container */}
      <div className="fixed top-24 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  const { type, message } = toast;

  // Custom styling and icons based on type
  const config = {
    success: {
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
      borderClass: 'border-emerald-500/30 shadow-emerald-500/5',
      accentColor: 'bg-emerald-500',
    },
    error: {
      icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
      borderClass: 'border-rose-500/30 shadow-rose-500/5',
      accentColor: 'bg-rose-500',
    },
    info: {
      icon: <Info className="w-5 h-5 text-sky-400" />,
      borderClass: 'border-sky-500/30 shadow-sky-500/5',
      accentColor: 'bg-sky-500',
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      borderClass: 'border-amber-500/30 shadow-amber-500/5',
      accentColor: 'bg-amber-500',
    },
  }[type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`pointer-events-auto glass rounded-2xl p-4 border flex items-start gap-3 shadow-xl ${config.borderClass} relative overflow-hidden`}
    >
      {/* Decorative progress animation background */}
      <motion.div 
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: (toast.duration || 4000) / 1000, ease: 'linear' }}
        className={`absolute bottom-0 left-0 h-[2px] ${config.accentColor}`}
      />

      <div className="shrink-0 mt-0.5">{config.icon}</div>
      <div className="flex-1 text-xs font-medium text-gray-200 pr-4 leading-relaxed">
        {message}
      </div>
      <button
        onClick={onClose}
        className="shrink-0 text-gray-500 hover:text-gray-300 transition duration-150 p-0.5 rounded-lg hover:bg-white/5"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
