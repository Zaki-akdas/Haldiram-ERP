'use client';

import { useAuth } from './AuthProvider';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDark = localStorage.getItem('darkMode') === 'true';
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const setTheme = useCallback((isDark: boolean) => {
    setDarkMode(isDark);
    localStorage.setItem('darkMode', String(isDark));
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  if (!mounted) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/75 px-6 py-4 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/75">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onMenuClick} className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Swami Sharanam" className="hidden h-9 w-auto sm:block" />
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                {user?.name ? `${user.name.split(' ')[0]},` : 'Welcome'} <span className="italic text-blue-600">Welcome</span>
              </h2>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="mr-4 hidden flex-col items-end sm:flex">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long' })}
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
            <Link href="/reference" className="rounded-xl p-2 text-slate-500 transition-colors hover:text-blue-500" title="Quick Reference">
              📚
            </Link>
            <button onClick={() => setTheme(false)} className={`rounded-xl p-2 transition-all duration-300 ${!darkMode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`} title="Light mode">
              ☀️
            </button>
            <button onClick={() => setTheme(true)} className={`rounded-xl p-2 transition-all duration-300 ${darkMode ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`} title="Dark mode">
              🌙
            </button>
          </div>

          <div className="relative">
            <button onClick={() => setShowNotifications(!showNotifications)} className={`relative rounded-2xl border border-slate-200 bg-slate-100 p-2.5 transition-colors dark:border-slate-800 dark:bg-slate-900 ${showNotifications ? 'border-blue-500 text-blue-500' : 'text-slate-600 hover:text-blue-500 dark:text-slate-400'}`}>
              <span className="text-lg">🔔</span>
              <span className="absolute right-2.5 top-2 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-slate-100 dark:ring-slate-900"></span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-cool animate-fade-in dark:border-slate-800 dark:bg-slate-900/95">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-800/30">
                  <h3 className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Notifications</h3>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-600 dark:bg-blue-900/30">2 NEW</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <p className="text-sm font-bold leading-tight text-slate-900 dark:text-white">System Update</p>
                    <p className="mt-1 text-xs text-slate-500">Multi-payment modes and bulk delete are now active.</p>
                    <p className="mt-2 text-[10px] font-medium text-slate-400">Just now</p>
                  </div>
                  <div className="p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <p className="text-sm font-bold leading-tight text-slate-900 dark:text-white">New Order Confirmed</p>
                    <p className="mt-1 text-xs text-slate-500">Invoice PSSE/15792 has been successfully punched.</p>
                    <p className="mt-2 text-[10px] font-medium text-slate-400">10 mins ago</p>
                  </div>
                </div>
                <button className="w-full border-t border-slate-100 p-4 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 transition-colors hover:text-blue-500 dark:border-slate-800">
                  Clear All
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
