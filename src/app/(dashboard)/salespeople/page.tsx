'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface SalespersonRow {
  id: number | string;
  name: string;
  email?: string;
  role?: string;
  phone?: string | null;
  avatar?: string | null;
  isActive?: boolean;
  sales: number;
  collections: number;
  orders: number;
  customers: number;
}

export default function SalespeoplePage() {
  const { user, authFetch } = useAuth();
  
  const [salespeople, setSalespeople] = useState<SalespersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<(number | string)[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<SalespersonRow | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'salesperson',
  });

  const canAccess = user?.role === 'admin' || user?.role === 'manager';

  const fetchSalespeople = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await authFetch('/api/salespeople');
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data) ? data as Record<string, unknown>[] : (data.salespeople || []) as Record<string, unknown>[];
        const formatted: SalespersonRow[] = rawList.map((sp) => ({
          id: sp.id as number | string,
          name: String(sp.name || ''),
          email: sp.email != null ? String(sp.email) : undefined,
          role: sp.role != null ? String(sp.role) : undefined,
          phone: sp.phone != null ? String(sp.phone) : null,
          avatar: sp.avatar != null ? String(sp.avatar) : null,
          isActive: sp.isActive != null ? Boolean(sp.isActive) : undefined,
          sales: Number(sp.sales || sp.totalRevenue || 0),
          collections: Number(sp.collections || sp.totalCollected || 0),
          orders: Number(sp.orders || sp.orderCount || 0),
          customers: Number(sp.customers || sp.customerCount || 0),
        }));
        setSalespeople(formatted);
        setLoading(false);
        setRefreshing(false);
        return;
      }
    } catch (err) {
      console.error('Failed to fetch salespeople', err);
    }
    
    setSalespeople([]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (canAccess) {
      // State updates happen in .then/.finally callbacks, not synchronously in the effect.
      authFetch('/api/salespeople')
        .then(async res => {
          if (!res.ok) return;
          const data = await res.json();
          const rawList = Array.isArray(data) ? data as Record<string, unknown>[] : (data.salespeople || []) as Record<string, unknown>[];
          const formatted: SalespersonRow[] = rawList.map((sp) => ({
            id: sp.id as number | string,
            name: String(sp.name || ''),
            email: sp.email != null ? String(sp.email) : undefined,
            role: sp.role != null ? String(sp.role) : undefined,
            phone: sp.phone != null ? String(sp.phone) : null,
            avatar: sp.avatar != null ? String(sp.avatar) : null,
            isActive: sp.isActive != null ? Boolean(sp.isActive) : undefined,
            sales: Number(sp.sales || sp.totalRevenue || 0),
            collections: Number(sp.collections || sp.totalCollected || 0),
            orders: Number(sp.orders || sp.orderCount || 0),
            customers: Number(sp.customers || sp.customerCount || 0),
          }));
          setSalespeople(formatted);
        })
        .catch(err => console.error('Failed to fetch salespeople', err))
        .finally(() => { setLoading(false); setRefreshing(false); });
    }
  }, [canAccess, authFetch]);

  const toggleSelectAll = () => {
    if (selectedIds.length === salespeople.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(salespeople.map(sp => sp.id));
    }
  };

  const toggleSelectOne = (id: number | string, e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleDeleteSingle = async (id: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this team member?')) return;
    try {
      setSalespeople(salespeople.filter(sp => sp.id !== id));
      setSelectedIds(selectedIds.filter(i => i !== id));
    } catch (err) {
      console.error('Delete error', err);
    }
  };

  const handleDeleteBulk = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected team members?`)) return;
    setSalespeople(salespeople.filter(sp => !selectedIds.includes(sp.id)));
    setSelectedIds([]);
  };

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
        <svg className="w-20 h-20 text-rose-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Access Denied</h2>
        <p className="text-slate-500 max-w-md">You do not have permission to manage team members.</p>
      </div>
    );
  }

  const handleOpenAddModal = () => {
    setEditingPerson(null);
    setFormData({ name: '', email: '', phone: '', password: '', role: 'salesperson' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/salespeople', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchSalespeople(true);
      }
    } catch (error) {
      console.error('Failed to save team member', error);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Sales Team Management</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage field agents, managers, and route performance</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchSalespeople(true)}
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
          {user?.role === 'admin' && (
            <button onClick={handleOpenAddModal} className="btn-primary flex items-center gap-2">
              + Add Member
            </button>
          )}
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card p-6 h-48 animate-pulse flex flex-col justify-between">
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : salespeople.length === 0 ? (
        <div className="glass-card p-12 text-center flex flex-col items-center justify-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No team members found</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Click + Add Member or Refresh to reload team data.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {salespeople.map((sp) => (
            <div key={sp.id} className="glass-card p-6 flex flex-col justify-between relative group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(sp.id)}
                    onChange={(e) => toggleSelectOne(sp.id, e)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">{sp.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{sp.email}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${sp.role === 'admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'}`}>
                  {sp.role}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-200 dark:border-slate-800 my-2">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Sales</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">₹{(sp.sales || 0).toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Collections</p>
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">₹{(sp.collections || 0).toLocaleString('en-IN')}</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-slate-500 font-semibold">{sp.phone || 'No Phone'}</span>
                <button onClick={(e) => handleDeleteSingle(sp.id, e)} className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/40">
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add Team Member</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Full Name</label>
                <input required type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Amit Kumar" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Email</label>
                <input required type="email" className="input-field" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="amit@haldiram.com" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Password</label>
                <input required type="password" className="input-field" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="••••••••" />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
