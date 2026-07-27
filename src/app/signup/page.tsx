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

  const inputClass = "w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all";

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
        </div>
      </div>

      {/* Signup Side */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 lg:p-24 relative">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">Create Account</h2>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">Join the team and manage your sales operations</p>
          </div>

          <div className="bg-white dark:bg-zinc-900/50 p-8 rounded-3xl shadow-cool border border-zinc-100 dark:border-zinc-800">
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-2xl text-sm font-semibold flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                  className={inputClass}
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">Email Address *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className={inputClass}
                  placeholder="name@company.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                  className={inputClass}
                  placeholder="+91 90000 00000"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">Account Type *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'salesperson')}
                  required
                  disabled={loading}
                  className={inputClass}
                >
                  <option value="salesperson">Salesperson</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">Password *</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">Confirm Password *</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-4 text-lg mt-4"
              >
                {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create Account'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Already have an account?{' '}
                <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-bold">
                  Sign in
                </Link>
              </p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-3 font-medium">
                Made by <span className="font-bold text-emerald-600">Zaki</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
