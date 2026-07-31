'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'salesperson' | 'admin'>('salesperson');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password || !role) {
      setError('Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role, phone }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create account');
        return;
      }

      const loginResult = await login(email, password);
      if (loginResult.success) {
        window.location.href = '/dashboard';
      } else {
        setError(loginResult.error || 'Account created but login failed. Please try logging in.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-900";

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.16),_transparent_35%),linear-gradient(135deg,_#f8fafc_0%,_#eef4ff_100%)] font-sans lg:flex-row dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_35%),linear-gradient(135deg,_#020617_0%,_#0f172a_100%)]">
      <div className="relative hidden items-center justify-center overflow-hidden bg-slate-950 lg:flex lg:w-1/2">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -left-10 top-0 h-96 w-96 animate-pulse rounded-full bg-white blur-3xl"></div>
          <div className="absolute -right-10 bottom-0 h-96 w-96 animate-pulse rounded-full bg-blue-400 blur-3xl delay-700"></div>
        </div>
        <div className="relative z-10 px-12 text-center">
          <img src="/logo.png" alt="Swami Sharanam" className="mx-auto mb-8 h-32 w-auto drop-shadow-2xl" />
          <h1 className="mb-6 text-6xl font-black tracking-tighter text-white">Swami Sharanam</h1>
          <p className="mx-auto max-w-md text-xl font-medium leading-relaxed text-slate-300">
            The next generation of sales distribution, collections, and field execution management.
          </p>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center p-6 sm:p-12 lg:p-24">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Create account</h2>
            <p className="mt-2 font-medium text-slate-500 dark:text-slate-400">Join the team and manage your sales operations</p>
          </div>

          <div className="rounded-[28px] border border-slate-200/80 bg-white/85 p-8 shadow-soft backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/70">
            {error && (
              <div className="mb-6 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-600 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="ml-1 text-sm font-bold text-slate-700 dark:text-slate-300">Full Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required disabled={loading} className={inputClass} placeholder="John Doe" />
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-sm font-bold text-slate-700 dark:text-slate-300">Email Address *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} className={inputClass} placeholder="name@company.com" />
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-sm font-bold text-slate-700 dark:text-slate-300">Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} className={inputClass} placeholder="+91 90000 00000" />
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-sm font-bold text-slate-700 dark:text-slate-300">Account Type *</label>
                <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'salesperson')} required disabled={loading} className={inputClass}>
                  <option value="salesperson">Salesperson</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-sm font-bold text-slate-700 dark:text-slate-300">Password *</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} className={inputClass} placeholder="••••••••" />
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-sm font-bold text-slate-700 dark:text-slate-300">Confirm Password *</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={loading} className={inputClass} placeholder="••••••••" />
              </div>

              <button type="submit" disabled={loading} className="btn-primary mt-4 w-full py-4 text-lg">
                {loading ? <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : 'Create Account'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Already have an account?{' '}
                <Link href="/login" className="font-bold text-blue-600 hover:text-blue-700">
                  Sign in
                </Link>
              </p>
              <p className="mt-3 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                Built for <span className="font-bold text-blue-500">operational clarity</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
