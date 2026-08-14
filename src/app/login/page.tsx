'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const { login, user } = useAuth();

  useEffect(() => {
    if (user) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await login(email, password);
      if (res.success) {
        router.push('/dashboard');
      } else {
        setError(res.error || 'Invalid email or password');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const fillAdminCredentials = () => {
    setEmail('admin@haldiram.com');
    setPassword('supabase_managed');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row items-stretch justify-between">
      {/* Left Column: Visual Banner */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden items-center justify-center p-12">
        <Image
          src="/images/hero-banner.jpg"
          alt="Haldiram ERP Distribution Hub"
          fill
          className="object-cover opacity-60"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        
        <div className="relative z-10 max-w-lg space-y-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/40">
              <span className="font-bold text-xl text-white">SS</span>
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Swami Sharanam</h2>
              <p className="text-xs text-indigo-300">Haldiram Distribution Hub</p>
            </div>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
            AI-Powered Sales Distribution & Settlements Management
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Real-time sales orders, field bill punching, AI invoice extraction, multi-mode cash settlements, and Indian GST analytics hub.
          </p>

          <div className="flex gap-6 pt-4 border-t border-white/10 text-xs text-slate-300">
            <div>
              <p className="text-indigo-400 font-bold text-lg">100%</p>
              <p>GST Compliant</p>
            </div>
            <div>
              <p className="text-emerald-400 font-bold text-lg">AI-Powered</p>
              <p>Invoice Extraction</p>
            </div>
            <div>
              <p className="text-amber-400 font-bold text-lg">Multi-Role</p>
              <p>Admin, Manager, Sales</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="max-w-md w-full glass-card p-8 animate-fade-in shadow-2xl border border-gray-800">
          <div className="flex flex-col items-center text-center space-y-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-2xl font-extrabold text-white">SS</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Swami Sharanam ERP</h1>
              <p className="text-sm text-gray-400 mt-1">Sign in to your distribution portal</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-900/30 border border-red-700 rounded-xl text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                className="input-field"
                placeholder="admin@haldiram.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider" htmlFor="password">
                  Password
                </label>
                <button
                  type="button"
                  onClick={fillAdminCredentials}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
                >
                  Use Demo Admin
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-field pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '🔒'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 text-sm font-bold flex justify-center items-center gap-2 mt-2"
            >
              {isLoading ? 'Signing In...' : 'Sign In to Dashboard'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-gray-400">
            Need access? Contact your Admin.{' '}
            <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Admins: create accounts
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
