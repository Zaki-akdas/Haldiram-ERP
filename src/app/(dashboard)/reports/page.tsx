'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';

type ReportType = 'sales' | 'collections' | 'customers' | 'salespeople';

interface ReportData {
  type: string;
  data: unknown[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}

export default function ReportsPage() {
  const { authFetch } = useAuth();
  const [reportType, setReportType] = useState<ReportType>('sales');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  async function fetchReport() {
    setLoading(true);
    setRefreshing(true);
    try {
      const res = await authFetch(`/api/reports?type=${reportType}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchReport();
  }, [reportType, authFetch]);

  const reportTabs = [
    { id: 'sales' as const, label: '📈 Sales', icon: '📈' },
    { id: 'collections' as const, label: '💰 Collections', icon: '💰' },
    { id: 'customers' as const, label: '👥 Customers', icon: '👥' },
    { id: 'salespeople' as const, label: '👔 Salespeople', icon: '👔' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Reports</h1>
          <p className="text-slate-500 dark:text-slate-400">Analytics and insights</p>
          {lastRefreshed && (
            <p className="text-[10px] text-zinc-400 mt-1 font-medium">Last updated: {lastRefreshed.toLocaleTimeString('en-IN')}</p>
          )}
        </div>
        <button
          onClick={fetchReport}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 transition-colors disabled:opacity-60"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      {/* Report Type Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-2 shadow-sm flex flex-wrap gap-2">
        {reportTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setReportType(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              reportType === tab.id
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No data available</div>
        ) : (
          <div className="overflow-x-auto">
            {reportType === 'sales' && (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Orders</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {(data.data as Array<{ date: string; orders: number; revenue: number; collected: number }>).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 text-slate-800 dark:text-white">{formatDate(row.date)}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{row.orders}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatCurrency(row.revenue)}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatCurrency(row.collected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'collections' && (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Count</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Cash</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">UPI</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Bank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {(data.data as Array<{ date: string; count: number; amount: number; cash: number; upi: number; bank: number }>).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 text-slate-800 dark:text-white">{formatDate(row.date)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{row.count}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatCurrency(row.amount)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(row.cash)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(row.upi)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(row.bank)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'customers' && (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">City</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Orders</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {(data.data as Array<{ name: string; city: string; totalOrders: number; totalRevenue: number; outstanding: number }>).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{row.name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.city || '-'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{row.totalOrders}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatCurrency(row.totalRevenue)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${row.outstanding > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {formatCurrency(row.outstanding)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'salespeople' && (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Orders</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Collected</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Pending</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Avg Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {(data.data as Array<{ name: string; totalOrders: number; totalRevenue: number; collected: number; pending: number; avgOrderValue: number }>).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{row.name}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{row.totalOrders}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatCurrency(row.totalRevenue)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(row.collected)}</td>
                      <td className={`px-4 py-3 text-right ${row.pending > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {formatCurrency(row.pending)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(row.avgOrderValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
