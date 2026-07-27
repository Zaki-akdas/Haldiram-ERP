'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      window.location.href = '/dashboard';
    }
  }, [user, authLoading]);

  const handleLogin = async (loginEmail: string, loginPassword: string) => {
    setError('');
    setLoading(true);
    try {
      const result = await login(loginEmail, loginPassword);
      if (result.success) {
        window.location.href = '/dashboard';
        return;
      } else {
        setError(result.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('System error. Please try again.');
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    await handleLogin(email, password);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col lg:flex-row overflow-hidden font-sans">
      {/* Visual Side */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-emerald-600 items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 -left-10 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 -right-10 w-96 h-96 bg-emerald-400 rounded-full blur-3xl animate-pulse delay-700"></div>
        </div>
        <div className="relative z-10 text-center px-12">
          <img src="/logo.png" alt="Swami Sharanam" className="h-32 w-auto mx-auto mb-8 drop-shadow-2xl" />
          <h1 className="text-6xl font-black text-white mb-6 tracking-tighter italic">Swami Sharanam</h1>
          <p className="text-xl text-emerald-50 font-medium max-w-md mx-auto leading-relaxed">
            The next generation of Sales Distribution & Collection Management.
          </p>
          <div className="mt-12 flex justify-center gap-4">
            <div className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
              <p className="text-3xl font-bold text-white">99%</p>
              <p className="text-xs text-emerald-100 uppercase tracking-widest mt-1">Accuracy</p>
            </div>
            <div className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
              <p className="text-3xl font-bold text-white">Live</p>
              <p className="text-xs text-emerald-100 uppercase tracking-widest mt-1">Tracking</p>
            </div>
          </div>
        </div>
      </div>

      {/* Login Side */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 lg:p-24 relative">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="lg:hidden text-center mb-8">
            <img src="/logo.png" alt="Swami Sharanam" className="h-20 w-auto mx-auto mb-4" />
            <h1 className="text-3xl font-black text-emerald-600 tracking-tighter italic">Swami Sharanam</h1>
          </div>
          
          <div>
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">Welcome Back</h2>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">Sign in to manage your sales operations</p>
          </div>

          <div className="bg-white dark:bg-zinc-900/50 p-8 rounded-3xl shadow-cool border border-zinc-100 dark:border-zinc-800">
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-2xl text-sm font-semibold flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="input-field"
                  placeholder="name@company.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="input-field"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-4 text-lg mt-4"
              >
                {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Sign In'}
              </button>
            </form>
          </div>

          <div className="text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-emerald-600 hover:text-emerald-700 font-bold">
                Create one
              </Link>
            </p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-3 font-medium">
              Made by <span className="font-bold text-emerald-600">Zaki</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
