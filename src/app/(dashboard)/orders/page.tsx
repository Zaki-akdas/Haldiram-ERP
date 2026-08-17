'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

interface OrderDisplayRow {
  id: number;
  invoiceNumber: string | null;
  customerId: number | null;
  salespersonId: number | null;
  orderDate: Date | string | null;
  status: string;
  grandTotal: string | null;
  amountPaid: string | null;
  balance: string | null;
  customer?: { name: string } | null;
  salesperson?: { name: string } | null;
  // Loose display fallbacks tolerated from the API payload.
  customerName?: string | null;
  salespersonName?: string | null;
  date?: string | null;
  total?: string | number | null;
  paid?: string | number | null;
}

export default function OrdersPage() {
  const router = useRouter();
  const { authFetch } = useAuth();
  
  const [orders, setOrders] = useState<OrderDisplayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  // Filters
  const [status, setStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchOrders = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (status !== 'All') queryParams.append('status', status.toLowerCase());
      if (search) queryParams.append('search', search);
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);

      const res = await authFetch(`/api/orders?${queryParams.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setOrders(Array.isArray(json) ? json as OrderDisplayRow[] : (json.orders || []) as OrderDisplayRow[]);
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error('Failed to fetch orders', error);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchOrders(), 300);
    return () => clearTimeout(timer);
  }, [authFetch, status, search, startDate, endDate]);

  const toggleSelectAll = () => {
    if (selectedIds.length === orders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(orders.map(o => o.id));
    }
  };

  const toggleSelectOne = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleDeleteSingle = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this order?')) return;
    try {
      const res = await authFetch('/api/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] })
      });
      if (res.ok) {
        setSelectedIds(selectedIds.filter(i => i !== id));
        fetchOrders(true);
      }
    } catch (err) {
      console.error('Delete error', err);
    }
  };

  const handleDeleteBulk = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected orders?`)) return;
    try {
      const res = await authFetch('/api/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });
      if (res.ok) {
        setSelectedIds([]);
        fetchOrders(true);
      }
    } catch (err) {
      console.error('Bulk delete error', err);
    }
  };

  const formatCurrency = (amount: number | string | null | undefined) => {
    return Number(amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending': return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Pending</span>;
      case 'confirmed': return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Confirmed</span>;
      case 'delivered': return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">Delivered</span>;
      case 'cancelled': return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">Cancelled</span>;
      default: return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Sales Orders</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage invoice orders, order status, and balance payments</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchOrders(true)}
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
          <Link href="/orders/new" className="btn-primary flex items-center gap-2">
            + New Order
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Search</label>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search invoice # or customer..." 
              className="input-field pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <svg className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
        
        <div className="w-40">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Status</label>
          <select 
            className="input-field py-2"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Start Date</label>
          <input 
            type="date" 
            className="input-field py-2"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>
        
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">End Date</label>
          <input 
            type="date" 
            className="input-field py-2"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={orders.length > 0 && selectedIds.length === orders.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-4 py-4 font-bold">Invoice #</th>
                <th className="px-4 py-4 font-bold">Customer</th>
                <th className="px-4 py-4 font-bold hidden md:table-cell">Salesperson</th>
                <th className="px-4 py-4 font-bold">Date</th>
                <th className="px-4 py-4 font-bold">Status</th>
                <th className="px-4 py-4 font-bold text-right">Total</th>
                <th className="px-4 py-4 font-bold text-right hidden lg:table-cell">Paid</th>
                <th className="px-4 py-4 font-bold text-right">Balance</th>
                <th className="px-4 py-4 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                [1, 2, 3, 4].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-4"><div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                    <td className="px-4 py-4"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                    <td className="px-4 py-4"><div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                    <td className="px-4 py-4 hidden md:table-cell"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                    <td className="px-4 py-4"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                    <td className="px-4 py-4"><div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded-full"></div></td>
                    <td className="px-4 py-4"><div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded ml-auto"></div></td>
                    <td className="px-4 py-4 hidden lg:table-cell"><div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded ml-auto"></div></td>
                    <td className="px-4 py-4"><div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded ml-auto"></div></td>
                    <td className="px-4 py-4"><div className="h-8 w-12 bg-slate-200 dark:bg-slate-700 rounded mx-auto"></div></td>
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    <p className="font-semibold text-slate-900 dark:text-white text-base">No orders found</p>
                    <p className="text-xs mt-1">Create a new order or click Refresh to reload backend records.</p>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr 
                    key={order.id} 
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => router.push(`/orders/${order.id}`)}
                  >
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.id)}
                        onChange={() => toggleSelectOne(order.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">{order?.invoiceNumber || order?.id}</td>
<td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">{order.customerName || order.customer?.name || 'Customer'}</td>
                     <td className="px-4 py-4 text-slate-500 dark:text-slate-400 hidden md:table-cell">{order.salespersonName || order.salesperson?.name || 'Salesperson'}</td>
                    <td className="px-4 py-4">{new Date(order.orderDate || order.date || new Date().getTime()).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-4">{getStatusBadge(order.status)}</td>
                    <td className="px-4 py-4 text-right font-black text-slate-900 dark:text-white">{formatCurrency(order.grandTotal || order.total)}</td>
                    <td className="px-4 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400 hidden lg:table-cell">{formatCurrency(order.amountPaid || order.paid)}</td>
                    <td className={`px-4 py-4 text-right font-black ${(Number(order.balance) || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                      {formatCurrency(order.balance)}
                    </td>
                    <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40"
                          onClick={() => router.push(`/orders/${order.id}`)}
                        >
                          👁️
                        </button>
                        <button 
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/40"
                          onClick={(e) => handleDeleteSingle(order.id, e)}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
