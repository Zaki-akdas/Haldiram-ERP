'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

interface Order {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  salespersonName: string;
  orderDate: string;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  grandTotal: number;
  amountPaid: number;
  balance: number;
  settlementStatus: 'pending' | 'partial' | 'settled';
  beat: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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
    year: 'numeric',
  });
}

/* ─── Professional SVG Icons ─── */
const ViewIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const DeleteIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

export default function OrdersPage() {
  const { user, authFetch } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search,
        status,
      });
      
      const res = await authFetch(`/api/orders?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      
      const data = await res.json();
      setOrders(data.orders);
      setPagination(data.pagination);
      setSelectedIds([]); // Reset selection on new fetch
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, search, status]);

  const toggleSelectAll = () => {
    if (selectedIds.length === orders.length) setSelectedIds([]);
    else setSelectedIds(orders.map(o => o.id));
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  async function handleBulkDelete() {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} orders?`)) return;
    setLoading(true);
    try {
      await Promise.all(selectedIds.map(id => authFetch(`/api/orders/${id}`, { method: 'DELETE' })));
      fetchOrders();
    } catch (err) {
      alert('Error during bulk deletion');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number, inv: string) {
    if (!confirm(`Are you sure you want to delete order "${inv}"?`)) return;
    
    try {
      const res = await authFetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchOrders();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete order');
      }
    } catch (err) {
      alert('Error deleting order');
    }
  }

  const statusColors = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    delivered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const settlementColors = {
    pending: 'text-red-600 dark:text-red-400',
    partial: 'text-amber-600 dark:text-amber-400',
    settled: 'text-emerald-600 dark:text-emerald-400',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Sales Orders</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage and track all customer shipments</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchOrders()}
            className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl hover:text-emerald-600 transition-colors border border-zinc-200 dark:border-zinc-700"
            title="Refresh Data"
          >
            <RefreshIcon />
          </button>
          <Link
            href="/orders/new"
            className="btn-primary"
          >
            <span className="text-xl">+</span>
            <span>New Order</span>
          </Link>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && isManager && (
        <div className="bg-zinc-900 text-white px-6 py-4 rounded-[1.5rem] flex items-center justify-between shadow-cool animate-fade-in">
          <p className="text-sm font-bold">{selectedIds.length} orders selected</p>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl transition-all text-sm font-bold"
          >
            <DeleteIcon />
            <span>Delete Selected</span>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 rounded-[1.5rem] p-4 shadow-soft border border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">🔍</span>
          <input
            type="text"
            placeholder="Search by invoice or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-11"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border-transparent border focus:border-emerald-500 rounded-xl outline-none transition-all text-sm font-bold text-zinc-700 dark:text-zinc-300"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-soft border border-zinc-100 dark:border-zinc-800 overflow-hidden">
        {loading && orders.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-20 text-center">
            <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-6 py-4 text-left w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === orders.length && orders.length > 0}
                      onChange={toggleSelectAll}
                      className="w-5 h-5 rounded-lg border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Invoice</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Customer</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-zinc-400 uppercase tracking-widest">Amount</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-zinc-400 uppercase tracking-widest">Balance</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                {orders.map((order) => (
                  <tr key={order.id} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors ${selectedIds.includes(order.id) ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.id)}
                        onChange={() => toggleSelect(order.id)}
                        className="w-5 h-5 rounded-lg border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/orders/${order.id}`} className="font-black text-emerald-600 hover:underline tracking-tight">
                        {order.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-zinc-900 dark:text-white tracking-tight">{order.customerName}</p>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{order.salespersonName}</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-zinc-500 dark:text-zinc-400">{formatDate(order.orderDate)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest ${statusColors[order.status]}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-zinc-900 dark:text-white">
                      {formatCurrency(order.grandTotal)}
                    </td>
                    <td className={`px-6 py-4 text-right font-black ${settlementColors[order.settlementStatus]}`}>
                      {formatCurrency(order.balance)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <Link
                          href={`/orders/${order.id}`}
                          className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                          title="View Details"
                        >
                          <ViewIcon />
                        </Link>
                        {isManager && (
                          <button
                            onClick={() => handleDelete(order.id, order.invoiceNumber)}
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                            title="Delete Order"
                          >
                            <DeleteIcon />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-8 py-5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold disabled:opacity-50 transition-all hover:border-emerald-500 shadow-sm"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold disabled:opacity-50 transition-all hover:border-emerald-500 shadow-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
