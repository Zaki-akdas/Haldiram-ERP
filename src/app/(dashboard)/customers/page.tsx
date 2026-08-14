'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  gstin?: string;
  pan?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  beat: string;
  creditLimit: number;
  outstanding: number;
  assignedSalespersonId?: string;
  salespersonName?: string;
}

interface Salesperson {
  id: string;
  name: string;
}

interface PurchaseOrder {
  id: string;
  invoiceNumber: string;
  date: string;
  amount: number;
  status: string;
  paid: number;
  balance: number;
}

export default function CustomersPage() {
  const { user, authFetch } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<Customer | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseOrder[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '', phone: '', email: '', gstin: '', pan: '', address: '',
    city: '', state: '', pincode: '', beat: '', creditLimit: 0, assignedSalespersonId: ''
  });

  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const fetchCustomers = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await authFetch(`/api/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(Array.isArray(data) ? data : (data.customers || []));
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error('Failed to fetch customers', error);
      setCustomers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSalespeople = async () => {
    if (!canEdit) return;
    try {
      const res = await authFetch('/api/salespeople');
      if (res.ok) {
        const data = await res.json();
        setSalespeople(Array.isArray(data) ? data : (data.salespeople || []));
      }
    } catch (error) {
      console.error('Failed to fetch salespeople', error);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchSalespeople();
  }, [search]);

  const toggleSelectAll = () => {
    if (selectedIds.length === customers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(customers.map(c => c.id));
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
    if (!confirm('Are you sure you want to delete this customer?')) return;
    try {
      const res = await authFetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedIds(selectedIds.filter(i => i !== id));
        fetchCustomers(true);
      }
    } catch (error) {
      console.error('Delete failed', error);
    }
  };

  const handleDeleteBulk = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected customers?`)) return;
    try {
      const res = await authFetch('/api/customers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });
      if (res.ok) {
        setSelectedIds([]);
        fetchCustomers(true);
      }
    } catch (err) {
      console.error('Bulk delete error', err);
    }
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormData({
      name: '', phone: '', email: '', gstin: '', pan: '', address: '',
      city: '', state: '', pincode: '', beat: '', creditLimit: 0, assignedSalespersonId: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({ ...c });
    setIsModalOpen(true);
  };

  const openHistory = async (c: Customer) => {
    setSelectedCustomerForHistory(c);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const res = await authFetch(`/api/customers/${c.id}/history`);
      if (res.ok) {
        const data = await res.json();
        setPurchaseHistory(data.orders || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers';
      const method = editingCustomer ? 'PATCH' : 'POST';
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchCustomers(true);
      }
    } catch (error) {
      console.error('Save failed', error);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number = 0) => {
    return Number(amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Customers Management</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Manage your distribution client base, GSTINs, credit limits, and balances</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => fetchCustomers(true)}
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
          {canEdit && (
            <button onClick={openAddModal} className="btn-primary whitespace-nowrap flex items-center gap-2">
              + Add Customer
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4 flex justify-between items-center">
        <div className="relative w-full sm:w-80">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search customers..."
            className="input-field pl-10 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {customers.length > 0 && (
          <button onClick={toggleSelectAll} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
            {selectedIds.length === customers.length ? 'Deselect All' : 'Select All Customers'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="glass-card p-5 h-48 animate-pulse flex flex-col justify-between">
              <div>
                <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full mb-2"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="glass-card p-12 text-center flex flex-col items-center justify-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No customers found</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Adjust your search or click + Add Customer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {customers.map((c) => (
            <div key={c.id} className="glass-card p-5 hover:-translate-y-1 transition-all duration-200 hover:shadow-xl cursor-pointer flex flex-col relative" onClick={() => openHistory(c)}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={(e) => toggleSelectOne(c.id, e as any)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1">{c.name}</h3>
                </div>
                {c.gstin && <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 rounded-full px-3 py-0.5 text-xs font-bold border border-indigo-200 dark:border-indigo-800">GSTIN</span>}
              </div>
              
              <div className="space-y-1 mb-4 text-sm text-slate-600 dark:text-slate-400 flex-grow font-medium">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                  {c.phone || 'N/A'}
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  {c.email || 'N/A'}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Credit Limit</p>
                  <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(c.creditLimit)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Outstanding</p>
                  <p className={`text-sm font-extrabold ${c.outstanding > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {formatCurrency(c.outstanding)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 mt-auto">
                <span className="text-xs font-semibold text-slate-500">{c.salespersonName || 'Unassigned'}</span>
                
                {canEdit && (
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEditModal(c)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg">✏️</button>
                    <button onClick={(e) => handleDeleteSingle(c.id, e)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg">🗑️</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Name *</label>
                <input required type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Raju Stores" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Phone</label>
                  <input type="text" className="input-field" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+91 9876543210" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">GSTIN</label>
                  <input type="text" className="input-field" value={formData.gstin} onChange={e => setFormData({...formData, gstin: e.target.value})} placeholder="23AMFPV..." />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
