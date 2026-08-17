'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import type { ActivityResponse } from '@/lib/api-types';

function getRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return 'Unknown time';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Unknown time';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-IN');
}

export default function ActivityPage() {
  const { user, authFetch } = useAuth();
  const [activities, setActivities] = useState<ActivityResponse['activities']>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('All');
  
  const types = ['All', 'Login', 'Logout', 'Order Created', 'Order Updated', 'Settlement', 'Invoice Uploaded', 'Customer Added', 'Product Added'];

  const fetchActivity = useCallback(async () => {
    try {
      const res = await authFetch('/api/activity');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.activities)) {
          return json.activities as ActivityResponse['activities'];
        }
      }
    } catch (err) {
      console.error(err);
    }
    return [] as ActivityResponse['activities'];
  }, [authFetch]);

  const refreshActivity = () => {
    setLoading(true);
    fetchActivity()
      .then(acts => setActivities(acts))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'manager') return;
    // State updates happen in .then/.finally callbacks, not synchronously in the effect.
    fetchActivity()
      .then(acts => setActivities(acts))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [user, authFetch, fetchActivity]);

  if (user?.role === 'salesperson') {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="glass-card p-10 text-center max-w-md">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-500">You do not have permission to view the activity log.</p>
        </div>
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch(type) {
      case 'login': return { color: 'bg-green-100 text-green-600', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /> };
      case 'logout': return { color: 'bg-gray-100 text-gray-600', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /> };
      case 'order_created': return { color: 'bg-blue-100 text-blue-600', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /> };
      case 'order_updated': return { color: 'bg-indigo-100 text-indigo-600', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /> };
      case 'settlement': return { color: 'bg-amber-100 text-amber-600', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /> };
      case 'invoice_uploaded': return { color: 'bg-purple-100 text-purple-600', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /> };
      case 'customer_added': return { color: 'bg-teal-100 text-teal-600', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /> };
      case 'product_added': return { color: 'bg-orange-100 text-orange-600', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /> };
      default: return { color: 'bg-gray-100 text-gray-600', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> };
    }
  };

  const filtered = activities.filter(a => filterType === 'All' || a.activityType.replace('_', ' ').toLowerCase() === filterType.toLowerCase());

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Activity Log</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">System audit trail and real-time distribution events</p>
        </div>
        <button
          onClick={refreshActivity}
          className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-all"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Data
        </button>
      </div>

      <div className="glass-card p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-4 flex-wrap">
          <select 
            className="input-field py-2"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="date" className="input-field py-2" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="glass-card p-4 h-24 animate-pulse flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-gray-500">
          No activity recorded
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((activity) => {
            const { color, icon } = getIcon(activity.activityType);
            return (
              <div key={activity.id} className="glass-card p-4 flex items-start gap-4 hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${color}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{icon}</svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white break-words">
                    {activity.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{activity.user}</span>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span className="text-sm text-gray-500" title={activity.createdAt ? new Date(activity.createdAt).toLocaleString() : ''}>
                      {getRelativeTime(activity.createdAt)}
                    </span>
                  </div>
                </div>
                {activity.entityId && (
                  <Link href={`/orders/${activity.entityId}`} className="text-primary text-sm font-medium hover:underline whitespace-nowrap hidden sm:block">
                    View
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {!loading && filtered.length > 0 && (
        <div className="mt-6 flex justify-center">
          <button className="px-6 py-2 rounded-full border border-gray-200 dark:border-gray-700 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
