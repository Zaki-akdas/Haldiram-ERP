'use client';

import { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';

export default function HomePage() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        window.location.href = '/dashboard';
      } else {
        window.location.href = '/login';
      }
    }
  }, [user, loading]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950">
      <img src="/logo-icon.svg" alt="Swami Sharanam" className="w-28 h-auto mb-8 animate-pulse" />
      <h1 className="text-3xl font-black text-white tracking-tighter italic">Swami Sharanam</h1>
      <p className="text-zinc-500 text-xs mt-4 font-black uppercase tracking-[0.4em]">Establishing Secure Connection...</p>
    </div>
  );
}
