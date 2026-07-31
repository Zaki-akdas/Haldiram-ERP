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
      }
      setError(result.error || 'Invalid credentials');
    } catch {
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="relative h-20 w-20">
          <div className="absolute inset-0 rounded-full border-4 border-blue-500/20"></div>
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.16),_transparent_35%),linear-gradient(135deg,_#f8fafc_0%,_#eef4ff_100%)] font-sans lg:flex-row dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_35%),linear-gradient(135deg,_#020617_0%,_#0f172a_100%)]">
      <div className="relative hidden items-center justify-center overflow-hidden bg-slate-950 lg:flex lg:w-1/2">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -left-10 top-0 h-96 w-96 animate-pulse rounded-full bg-white blur-3xl"></div>
          <div className="absolute -right-10 bottom-0 h-96 w-96 animate-pulse rounded-full bg-blue-400 blur-3xl delay-700"></div>
        </div>
        <div className="relative z-10 px-12 text-center">
          <img src="/logo.svg" alt="Swami Sharanam" className="mx-auto mb-8 h-32 w-auto drop-shadow-2xl" />
          <h1 className="mb-6 text-6xl font-black tracking-tighter text-white">Swami Sharanam</h1>
          <p className="mx-auto max-w-md text-xl font-medium leading-relaxed text-slate-300">
            The next generation of sales distribution, collections, and field execution management.
          </p>
          <div className="mt-12 flex justify-center gap-4">
            <div className="rounded-2xl border border-white/20 bg-white/10 px-6 py-3 backdrop-blur-md">
              <p className="text-3xl font-bold text-white">99%</p>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">Accuracy</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 px-6 py-3 backdrop-blur-md">
              <p className="text-3xl font-bold text-white">Live</p>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-300">Tracking</p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center p-6 sm:p-12 lg:p-24">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="mb-8 text-center lg:hidden">
            <img src="/logo-icon.svg" alt="Swami Sharanam" className="mx-auto mb-4 h-20 w-auto" />
            <h1 className="text-3xl font-black tracking-tighter text-blue-600">Swami Sharanam</h1>
          </div>

          <div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Welcome back</h2>
            <p className="mt-2 font-medium text-slate-500 dark:text-slate-400">Sign in to manage your sales operations</p>
          </div>

          <div className="rounded-[28px] border border-slate-200/80 bg-white/85 p-8 shadow-soft backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/70">
            {error && (
              <div className="mb-6 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-600 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="ml-1 text-sm font-bold text-slate-700 dark:text-slate-300">Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} className="input-field" placeholder="name@company.com" />
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-sm font-bold text-slate-700 dark:text-slate-300">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} className="input-field" placeholder="••••••••" />
              </div>

              <button type="submit" disabled={loading} className="btn-primary mt-4 w-full py-4 text-lg">
                {loading ? <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : 'Sign In'}
              </button>
            </form>
          </div>

          <div className="text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-bold text-blue-600 hover:text-blue-700">
                Create one
              </Link>
            </p>
            <p className="mt-3 text-[10px] font-medium text-slate-400 dark:text-slate-500">
              Built for <span className="font-bold text-blue-500">operational clarity</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
