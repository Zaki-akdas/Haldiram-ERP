'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function DashboardPage() {
  const { user, authFetch } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await authFetch('/api/dashboard');
        if (!res.ok) throw new Error('Failed to fetch dashboard');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading dashboard');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [authFetch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 p-6 rounded-3xl text-red-600 dark:text-red-400 font-bold flex flex-col items-center gap-4">
        <span className="text-4xl">❌</span>
        {error}
        <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-600 text-white rounded-xl text-sm">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const isManager = user?.role === 'manager' || user?.role === 'admin';

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter">Business Overview</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 font-medium">Tracking live distribution and cash settlements</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">System Healthy</span>
        </div>
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Bills Added Today', val: data.stats.todayOrders, sub: formatCurrency(data.stats.todayRevenue), color: 'bg-emerald-600', icon: '📝' },
          { label: 'Pending Today', val: `-${formatCurrency(data.stats.todayPending).replace('₹','')}`, sub: 'Uncollected bills', color: 'bg-amber-500', icon: '⏳' },
          { label: 'Collections Confirmed', val: `+${formatCurrency(data.stats.todayCollected).replace('₹','')}`, sub: 'Cash & Online', color: 'bg-blue-600', icon: '💰' },
          { label: 'Active Customers', val: data.stats.activeCustomers, sub: `Out of ${data.stats.totalCustomers} total`, color: 'bg-zinc-900', icon: '👥' },
        ].map((stat, i) => (
          <div key={i} className="group relative bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-soft border border-zinc-100 dark:border-zinc-800 hover:border-emerald-500 transition-all duration-300">
            <div className={`absolute top-6 right-6 w-12 h-12 ${stat.color} rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-black/10`}>
              {stat.icon}
            </div>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">{stat.val}</p>
            <p className="text-xs font-bold text-zinc-500 mt-2 flex items-center gap-1">
               {stat.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Orders */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-soft border border-zinc-100 dark:border-zinc-800 overflow-hidden">
          <div className="p-8 pb-4 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Latest Shipments</h2>
            <button className="text-xs font-bold text-emerald-600 hover:underline uppercase tracking-widest">View All</button>
          </div>
          <div className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
            {data.recentOrders.length === 0 ? (
              <div className="p-12 text-center text-zinc-400 font-bold uppercase tracking-widest text-xs">No active orders</div>
            ) : (
              data.recentOrders.map((order: any) => (
                <div key={order.id} className="p-6 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-xl">📦</div>
                    <div>
                      <p className="font-black text-zinc-900 dark:text-white tracking-tight leading-none mb-1">{order.invoiceNumber}</p>
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{order.customerName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-zinc-900 dark:text-white mb-1">{formatCurrency(order.grandTotal)}</p>
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                      order.status === 'delivered' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      order.status === 'pending' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                    }`}>{order.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Settlements */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-soft border border-zinc-100 dark:border-zinc-800 overflow-hidden">
          <div className="p-8 pb-4 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Active Receivables</h2>
            <button className="text-xs font-bold text-emerald-600 hover:underline uppercase tracking-widest">Collections</button>
          </div>
          <div className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
            {data.pendingSettlements.length === 0 ? (
              <div className="p-12 text-center text-zinc-400 font-bold uppercase tracking-widest text-xs">All records settled! 🎉</div>
            ) : (
              data.pendingSettlements.map((item: any) => (
                <div key={item.id} className="p-6 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 dark:bg-red-900/10 rounded-2xl flex items-center justify-center text-xl">💳</div>
                    <div>
                      <p className="font-black text-zinc-900 dark:text-white tracking-tight leading-none mb-1">{item.invoiceNumber}</p>
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{item.customerName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-red-600 dark:text-red-400 mb-1">{formatCurrency(item.balance)}</p>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">Pending Collection</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {isManager && data.salespersonStats.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-soft border border-zinc-100 dark:border-zinc-800 overflow-hidden">
          <div className="p-8 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Representative Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                  <th className="px-8 py-5 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Representative</th>
                  <th className="px-8 py-5 text-right text-[10px] font-black text-zinc-400 uppercase tracking-widest">Volume</th>
                  <th className="px-8 py-5 text-right text-[10px] font-black text-zinc-400 uppercase tracking-widest">Revenue</th>
                  <th className="px-8 py-5 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.salespersonStats.map((sp: any) => (
                  <tr key={sp.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-zinc-900 text-white rounded-lg flex items-center justify-center font-black text-xs">{sp.name.charAt(0)}</div>
                        <span className="font-bold text-zinc-900 dark:text-white tracking-tight">{sp.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right font-black text-zinc-600 dark:text-zinc-400">{sp.orders}</td>
                    <td className="px-8 py-6 text-right font-black text-zinc-900 dark:text-white">{formatCurrency(sp.revenue)}</td>
                    <td className="px-8 py-6 text-center">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block ring-4 ring-emerald-500/20"></span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
