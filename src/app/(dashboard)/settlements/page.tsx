'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface Settlement {
  id: string;
  date: string;
  invoiceNumber: string;
  customerName: string;
  salespersonName: string;
  amount: number;
  cashAmount: number;
  onlineAmount: number;
  mode: 'Cash' | 'Online' | 'Cheque' | 'Split';
  referenceNumber: string;
  notes: string;
  denominations?: { denomination: number; quantity: number }[];
}

export default function SettlementsPage() {
  const { authFetch } = useAuth();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Filters
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchSettlements = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (modeFilter !== 'All') queryParams.append('mode', modeFilter);
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);

      const res = await authFetch(`/api/settlements?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSettlements(Array.isArray(data) ? data : (data.settlements || []));
      } else {
        setSettlements([]);
      }
    } catch (error) {
      console.error('Failed to fetch settlements', error);
      setSettlements([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSettlements();
  }, [search, modeFilter, startDate, endDate]);

  const toggleSelectAll = () => {
    if (selectedIds.length === settlements.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(settlements.map(s => s.id));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleDeleteSingle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this settlement record?')) return;
    try {
      const res = await authFetch('/api/settlements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] })
      });
      if (res.ok) {
        setSelectedIds(selectedIds.filter(i => i !== id));
        fetchSettlements(true);
      }
    } catch (err) {
      console.error('Delete error', err);
    }
  };

  const handleDeleteBulk = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected settlements?`)) return;
    try {
      const res = await authFetch('/api/settlements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });
      if (res.ok) {
        setSelectedIds([]);
        fetchSettlements(true);
      }
    } catch (err) {
      console.error('Bulk delete error', err);
    }
  };

  const formatCurrency = (amount: number = 0) => {
    return Number(amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  };

  const totalCollections = settlements.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const cashCollections = settlements.reduce((sum, s) => sum + Number(s.cashAmount || 0), 0);
  const onlineCollections = settlements.reduce((sum, s) => sum + Number(s.onlineAmount || 0), 0);
  const avgSettlement = settlements.length ? totalCollections / settlements.length : 0;

  const exportCSV = () => {
    if (settlements.length === 0) return;
    
    const headers = ['Date', 'Invoice #', 'Customer', 'Salesperson', 'Total Amount', 'Cash Amount', 'Online Amount', 'Mode', 'Reference #', 'Notes'];
    const rows = settlements.map(s => [
      new Date(s.date).toLocaleDateString('en-IN'),
      s.invoiceNumber,
      `"${s.customerName}"`,
      `"${s.salespersonName}"`,
      s.amount,
      s.cashAmount,
      s.onlineAmount,
      s.mode,
      s.referenceNumber || '',
      `"${s.notes || ''}"`
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `settlements_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getModeBadge = (mode: string) => {
    switch (mode) {
      case 'Cash': return <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-2.5 py-1 rounded-full text-xs font-bold">Cash</span>;
      case 'Online': return <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 px-2.5 py-1 rounded-full text-xs font-bold">Online</span>;
      case 'Cheque': return <span className="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 px-2.5 py-1 rounded-full text-xs font-bold">Cheque</span>;
      case 'Split': return <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-2.5 py-1 rounded-full text-xs font-bold">Split</span>;
      default: return <span className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 px-2.5 py-1 rounded-full text-xs font-bold">{mode}</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Collections & Settlements</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Track daily route collections, cash, and online payments</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchSettlements(true)}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-all"
            title="Refresh Data from Backend"
          >
            <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          {selectedIds.length > 0 && (
            <button
              onClick={handleDeleteBulk}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-rose-500/20"
            >
              🗑️ Delete Selected ({selectedIds.length})
            </button>
          )}
          <button onClick={exportCSV} disabled={settlements.length === 0} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-sm flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Collections</h3>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(totalCollections)}</p>
        </div>
        
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cash</h3>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(cashCollections)}</p>
        </div>

        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            </div>
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Online</h3>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(onlineCollections)}</p>
        </div>

        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Settlement</h3>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(avgSettlement)}</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="glass-card overflow-hidden">
          <div className="animate-pulse flex flex-col">
            <div className="h-12 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700"></div>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 border-b border-slate-100 dark:border-slate-800 flex items-center px-6 gap-4">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
              </div>
            ))}
          </div>
        </div>
      ) : settlements.length === 0 ? (
        <div className="glass-card p-12 text-center flex flex-col items-center justify-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No settlements found</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Adjust your filters or click Refresh to reload backend records.</p>
        </div>
      ) : (
        <div className="glass-card overflow-x-auto rounded-2xl">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-sm">
            <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={settlements.length > 0 && selectedIds.length === settlements.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Invoice #</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Customer / SP</th>
                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">Mode</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider">Total (₹)</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider">Cash</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider">Online</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Denominations</th>
                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {settlements.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(s.id)}
                      onChange={(e) => toggleSelectOne(s.id, e as any)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600 dark:text-slate-400">{new Date(s.date).toLocaleDateString('en-IN')}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900 dark:text-white">{s.invoiceNumber}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 dark:text-white line-clamp-1">{s.customerName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{s.salespersonName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">{getModeBadge(s.mode)}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-black text-slate-900 dark:text-white text-right">{formatCurrency(s.amount)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-emerald-600 dark:text-emerald-400 font-bold text-right">{s.cashAmount > 0 ? formatCurrency(s.cashAmount) : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-blue-600 dark:text-blue-400 font-bold text-right">{s.onlineAmount > 0 ? formatCurrency(s.onlineAmount) : '-'}</td>
                  <td className="px-6 py-4">
                    {s.denominations && s.denominations.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {s.denominations.filter((d: any) => d.quantity > 0).map((d: any) => (
                          <span key={d.denomination} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xs">
                            ₹{d.denomination} × {d.quantity}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={(e) => handleDeleteSingle(s.id, e)} className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/40">
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
