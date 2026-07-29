'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface ActivityLog {
  id: number;
  userId: number | null;
  userName: string | null;
  activityType: string;
  entityType: string | null;
  entityId: number | null;
  description: string;
  ipAddress: string | null;
  createdAt: string;
}

const activityIcons: Record<string, string> = {
  login: '🔓',
  logout: '🔒',
  order_created: '📦',
  order_updated: '✏️',
  settlement: '💰',
  invoice_uploaded: '📄',
  customer_added: '👤',
  product_added: '🏷️',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

export default function ActivityPage() {
  const { authFetch } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  async function fetchLogs() {
    setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const res = await authFetch(`/api/activity?page=${page}&limit=50`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to load logs' }));
        throw new Error(data.error || 'Failed to fetch');
      }
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, [page, authFetch]);

  return (
    <div className="space-y-6">
      <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Activity Log</h1>
          <p className="text-slate-500 dark:text-slate-400">Track all system activities</p>
          {lastRefreshed && (
            <p className="text-[10px] text-zinc-400 mt-1 font-medium">Last updated: {lastRefreshed.toLocaleTimeString('en-IN')}</p>
          )}
        </div>
        <button
          onClick={fetchLogs}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 transition-colors disabled:opacity-60"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No activity recorded yet</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-start gap-4">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-xl">
                  {activityIcons[log.activityType] || '📝'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-800 dark:text-white">{log.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                    {log.userName && (
                      <span>👤 {log.userName}</span>
                    )}
                    <span>🕐 {timeAgo(log.createdAt)}</span>
                    {log.entityType && (
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">
                        {log.entityType}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-lg disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-slate-600 dark:text-slate-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-lg disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
