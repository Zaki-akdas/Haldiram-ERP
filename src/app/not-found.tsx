import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="glass-card max-w-md w-full p-8 text-center animate-scale-in">
        <p className="text-6xl font-extrabold bg-gradient-to-tr from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">404</p>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Page Not Found</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/dashboard" className="btn-primary">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
