'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface Salesperson {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  totalOrders: number;
  monthlyOrders: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalCustomers: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SalespeopePage() {
  const { user, authFetch } = useAuth();
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', name: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);

  async function fetchSalespeople() {
    try {
      const res = await authFetch('/api/salespeople');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setSalespeople(data.salespeople);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSalespeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const res = await authFetch('/api/salespeople', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (res.ok) {
        setShowForm(false);
        setFormData({ email: '', password: '', name: '', phone: '' });
        fetchSalespeople();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Salespeople</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage your sales team</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            <span>➕</span>
            <span>Add Salesperson</span>
          </button>
        )}
      </div>

      {/* Salespeople Grid */}
      {loading ? (
        <div className="p-8 text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      ) : salespeople.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center text-slate-500 shadow-sm">
          No salespeople found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {salespeople.map((sp) => (
            <div key={sp.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center text-lg font-bold">
                    {sp.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-white">{sp.name}</h3>
                    <p className="text-sm text-slate-500">{sp.email}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  sp.isActive 
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {sp.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              {sp.phone && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">📞 {sp.phone}</p>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">This Month</p>
                  <p className="font-bold text-slate-800 dark:text-white">{sp.monthlyOrders} orders</p>
                  <p className="text-sm text-emerald-600">{formatCurrency(sp.monthlyRevenue)}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">All Time</p>
                  <p className="font-bold text-slate-800 dark:text-white">{sp.totalOrders} orders</p>
                  <p className="text-sm text-emerald-600">{formatCurrency(sp.totalRevenue)}</p>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 text-center">
                <span className="text-sm text-slate-500">👥 {sp.totalCustomers} customers assigned</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Salesperson Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Add Salesperson</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
