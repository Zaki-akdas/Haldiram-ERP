'use client';

import { useEffect } from 'react';

export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="glass-card max-w-md w-full p-8 text-center animate-scale-in">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10">
          <svg className="h-7 w-7 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          An unexpected error occurred while loading this page.
          {error.digest ? ` (Reference: ${error.digest})` : ''}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => unstable_retry()} className="btn-primary">
            Try Again
          </button>
          <a href="/dashboard" className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 inline-flex items-center justify-center">
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
