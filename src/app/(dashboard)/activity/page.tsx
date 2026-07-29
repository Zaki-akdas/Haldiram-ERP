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

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
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
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to load logs');
      } finally {
        setLoading(false);
      }
    }

    fetchLogs();
  }, [page, authFetch]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Activity Log</h1>
        <p className="text-slate-500 dark:text-slate-400">Track all system activities</p>
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
