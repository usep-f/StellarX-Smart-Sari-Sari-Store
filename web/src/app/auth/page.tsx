'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { 
  Lock, Mail, User, Store, ArrowLeft, AlertCircle, Loader2, CheckCircle2 
} from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const { user, profile, signIn, signUp, loading: authLoading } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'merchant'>('customer');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (user && profile && !authLoading) {
      if (profile.role === 'merchant') {
        router.push('/merchant');
      } else {
        router.push('/customer');
      }
    }
  }, [user, profile, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Basic validation
    if (!email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!isLogin && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email.trim(), password);
        setSuccess('Login successful! Redirecting...');
      } else {
        await signUp(email.trim(), password, role);
        setSuccess('Registration successful! Redirecting...');
      }
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) {
        if (err.message.includes('auth/email-already-in-use')) {
          setError('This email address is already registered.');
        } else if (err.message.includes('auth/invalid-credential') || err.message.includes('auth/wrong-password')) {
          setError('Invalid email or password.');
        } else if (err.message.includes('auth/invalid-email')) {
          setError('Please enter a valid email address.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Authentication failed. Please try again.');
      }
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center pt-28 pb-12 px-4 sm:px-6 relative">
      
      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-[#ff7a00]/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-[#00c853]/5 blur-3xl pointer-events-none" />

      <div className="max-w-md w-full flex flex-col gap-6 relative z-10">
        
        {/* Back Link */}
        <div className="flex justify-start">
          <Link 
            href="/" 
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition duration-200"
          >
            <ArrowLeft className="w-4 h-4" /> Back to discovery map
          </Link>
        </div>

        {/* Card */}
        <div className="glass rounded-3xl border border-white/5 p-8 shadow-2xl flex flex-col gap-6">
          
          {/* Header */}
          <div className="text-center flex flex-col gap-2">
            <span className="text-[10px] text-[#ff7a00] uppercase tracking-widest font-extrabold">
              Sari-Stellar Portal
            </span>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-xs text-gray-400">
              {isLogin 
                ? 'Sign in to access your dashboard and wallet sync.' 
                : 'Join the next-gen Sari-Sari store network.'}
            </p>
          </div>

          {/* Error & Success Messages */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}
          
          {success && (
            <div className="bg-[#00c853]/10 border border-[#00c853]/20 text-[#00c853] text-xs rounded-xl p-3 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>{success}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            {/* Role Selection (Only for SignUp) */}
            {!isLogin && (
              <div className="flex flex-col gap-2">
                <label className="text-[11px] text-gray-400 font-medium">Select Your Role</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('customer')}
                    className={`py-3 px-4 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                      role === 'customer' 
                        ? 'bg-[#00c853]/10 border-[#00c853]/50 text-white' 
                        : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <User className={`w-5 h-5 ${role === 'customer' ? 'text-[#00c853]' : ''}`} />
                    <span className="text-xs font-bold">Customer</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setRole('merchant')}
                    className={`py-3 px-4 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                      role === 'merchant' 
                        ? 'bg-[#ff7a00]/10 border-[#ff7a00]/50 text-white' 
                        : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <Store className={`w-5 h-5 ${role === 'merchant' ? 'text-[#ff7a00]' : ''}`} />
                    <span className="text-xs font-bold">Store Owner</span>
                  </button>
                </div>
              </div>
            )}

            {/* Email Field */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-gray-400 font-medium">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#161c24] border border-card-border rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-gray-600 outline-none focus:border-[#ff7a00] transition"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-gray-400 font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#161c24] border border-card-border rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-gray-600 outline-none focus:border-[#ff7a00] transition"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Confirm Password Field (Only for SignUp) */}
            {!isLogin && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-gray-400 font-medium">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#161c24] border border-card-border rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-gray-600 outline-none focus:border-[#ff7a00] transition"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white font-bold py-3 px-4 rounded-xl shadow-lg transition mt-2 flex items-center justify-center gap-1.5 ${
                role === 'merchant' && !isLogin
                  ? 'bg-[#ff7a00] hover:bg-[#e06b00] shadow-[#ff7a00]/10' 
                  : 'bg-[#00c853] hover:bg-[#00b24a] shadow-[#00c853]/10'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Authentication in progress...
                </>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          {/* Toggle Tab Footer */}
          <div className="text-center text-xs text-gray-500 mt-2">
            {isLogin ? (
              <p>
                Don&apos;t have an account?{' '}
                <button 
                  onClick={() => setIsLogin(false)} 
                  className="text-white hover:underline font-semibold"
                >
                  Register here
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button 
                  onClick={() => setIsLogin(true)} 
                  className="text-white hover:underline font-semibold"
                >
                  Log In here
                </button>
              </p>
            )}
          </div>

        </div>

      </div>
    </main>
  );
}
