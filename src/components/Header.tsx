'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';

// Theme is external state (localStorage + system preference); subscribe to it
// with useSyncExternalStore so reads stay pure and updates flow through React.
function subscribeToTheme(callback: () => void) {
  window.addEventListener('storage', callback);
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    mq.removeEventListener('change', callback);
  };
}

function getThemeSnapshot(): boolean {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return savedTheme === 'dark' || (!savedTheme && prefersDark);
}

function getServerSnapshot(): boolean {
  return false;
}

export default function Header({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { user } = useAuth();
  const isDark = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerSnapshot);

  // Keep the DOM class in sync with the subscribed theme value.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggleTheme = () => {
    const newDark = !isDark;
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
    // The storage event does not fire in the same tab; notify subscribers manually.
    window.dispatchEvent(new Event('storage'));
  };

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 lg:px-6 transition-colors duration-200">
      <div className="flex items-center">
        <button
          onClick={onToggleSidebar}
          className="mr-4 rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        <div className="hidden lg:flex flex-col">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            Welcome, {user?.name || 'User'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{today}</p>
        </div>
        
        <div className="flex lg:hidden items-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold mr-2 shadow-sm">
            SS
          </div>
          <span className="font-bold text-slate-900 dark:text-white text-sm">Swami Sharanam</span>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3">
        <Link 
          href="/reference" 
          className="rounded-xl p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" 
          title="Quick Reference"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477-4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </Link>
        
        <button 
          onClick={toggleTheme}
          className="rounded-xl p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Toggle Dark / Light Theme"
        >
          {isDark ? (
            <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-xs shadow-md">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'SS'}
          </div>
          <span className="hidden sm:inline-block text-xs font-semibold text-slate-800 dark:text-slate-200">
            {user?.name || 'Admin'}
          </span>
        </div>
      </div>
    </header>
  );
}
