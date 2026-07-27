'use client';

import { useAuth } from './AuthProvider';
import { useState, useEffect, useCallback } from 'react';

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
    <header className="sticky top-0 z-30 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2.5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Swami Sharanam" className="h-8 w-auto hidden sm:block" />
            <div>
              <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                {user?.name ? `${user.name.split(' ')[0]},` : 'Welcome'} <span className="text-emerald-600 italic">Welcome</span>
              </h2>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end mr-4">
            <p className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long' })}
            </p>
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setTheme(false)}
              className={`p-2 rounded-xl transition-all duration-300 ${!darkMode ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Light mode"
            >
              ☀️
            </button>
            <button
              onClick={() => setTheme(true)}
              className={`p-2 rounded-xl transition-all duration-300 ${darkMode ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
              title="Dark mode"
            >
              🌙
            </button>
          </div>

          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative p-2.5 bg-zinc-100 dark:bg-zinc-900 transition-colors border border-zinc-200 dark:border-zinc-800 rounded-xl ${showNotifications ? 'text-emerald-500 border-emerald-500' : 'text-zinc-600 dark:text-zinc-400 hover:text-emerald-500'}`}
            >
              <span className="text-lg">🔔</span>
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-zinc-100 dark:ring-zinc-900"></span>
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-zinc-900 rounded-3xl shadow-cool border border-zinc-100 dark:border-zinc-800 overflow-hidden animate-fade-in">
                <div className="p-5 border-b border-zinc-50 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex justify-between items-center">
                  <h3 className="font-black text-xs uppercase tracking-widest text-zinc-400">Notifications</h3>
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">2 NEW</span>
                </div>
                <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
                  <div className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">System Update</p>
                    <p className="text-xs text-zinc-500 mt-1">Multi-payment modes and bulk delete are now active.</p>
                    <p className="text-[10px] text-zinc-400 mt-2 font-medium">Just now</p>
                  </div>
                  <div className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">New Order Confirmed</p>
                    <p className="text-xs text-zinc-500 mt-1">Invoice PSSE/15792 has been successfully punched.</p>
                    <p className="text-[10px] text-zinc-400 mt-2 font-medium">10 mins ago</p>
                  </div>
                </div>
                <button className="w-full p-4 text-[10px] font-black text-zinc-400 hover:text-emerald-500 uppercase tracking-widest border-t border-zinc-50 dark:border-zinc-800 transition-colors">
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
