'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/dashboard');
    }, 1500); // Brief delay to show the nice animation

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="glass-card max-w-sm w-full p-8 flex flex-col items-center justify-center space-y-6 animate-fade-in">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/30 animate-pulse">
            <span className="text-3xl font-bold text-white tracking-tighter">SS</span>
          </div>
          <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-ping"></div>
            <div className="w-3 h-3 rounded-full bg-green-500 absolute"></div>
          </div>
        </div>
        
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white tracking-tight">Swami Sharanam</h1>
          <p className="text-sm text-indigo-200">Distribution Hub</p>
        </div>

        <div className="flex flex-col items-center space-y-3 pt-4">
          <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-300 animate-pulse">Establishing Secure Connection...</p>
        </div>
      </div>
    </div>
  );
}
