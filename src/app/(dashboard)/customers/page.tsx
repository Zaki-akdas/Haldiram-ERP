'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  city: string | null;
  beat: string | null;
  creditLimit: number;
  outstandingBalance: number;
  salespersonName: string | null;
  isActive: boolean;
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

const DeleteIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

export default function CustomersPage() {
  const { user, authFetch } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    gstin: '',
    address: '',
    city: '',
    state: '',
    beat: '',
    creditLimit: '50000',
  });
  const [submitting, setSubmitting] = useState(false);

  async function fetchCustomers() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search,
      });
      
      const res = await authFetch(`/api/customers?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      
      const data = await res.json();
      setCustomers(data.customers);
      setPagination(data.pagination);
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, search]);

  const handleEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      gstin: customer.gstin || '',
      address: customer.address || '',
      city: customer.city || '',
      state: '', // Not provided in initial interface
      beat: customer.beat || '',
      creditLimit: String(customer.creditLimit),
    });
    setShowForm(true);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const method = editingId ? 'PATCH' : 'POST';
      const url = editingId ? `/api/customers/${editingId}` : '/api/customers';
      
      // Note: Patch endpoint for customers doesn't exist yet, I'll create it
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          creditLimit: parseFloat(formData.creditLimit),
        }),
      });
      
      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setFormData({ name: '', phone: '', email: '', gstin: '', address: '', city: '', state: '', beat: '', creditLimit: '50000' });
        fetchCustomers();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Are you sure you want to delete customer "${name}"? This cannot be undone.`)) return;
    
    try {
      const res = await authFetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCustomers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete customer');
      }
    } catch (err) {
      alert('Error deleting customer');
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} customers?`)) return;
    setLoading(true);
    try {
      for (const id of selectedIds) {
        await authFetch(`/api/customers/${id}`, { method: 'DELETE' });
      }
      fetchCustomers();
    } catch (err) {
      alert('Some items could not be deleted (they may have existing orders)');
    } finally {
      setLoading(false);
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Customers</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage your verified customer database</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchCustomers()}
            className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl hover:text-emerald-600 transition-colors border border-zinc-200 dark:border-zinc-700"
            title="Refresh Data"
          >
            <RefreshIcon />
          </button>
          <button
            onClick={() => { setEditingId(null); setShowForm(true); }}
            className="btn-primary"
          >
            <span className="text-xl">+</span>
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {selectedIds.length > 0 && isManager && (
        <div className="bg-zinc-900 text-white px-6 py-4 rounded-[1.5rem] flex items-center justify-between shadow-cool animate-fade-in">
          <p className="text-sm font-bold">{selectedIds.length} customers selected</p>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl transition-all text-sm font-bold"
          >
            <DeleteIcon />
            <span>Delete Selected</span>
          </button>
        </div>
      )}

      {/* Search */}
      <div className="bg-white dark:bg-zinc-900 rounded-[1.5rem] p-4 shadow-soft border border-zinc-100 dark:border-zinc-800">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">🔍</span>
          <input
            type="text"
            placeholder="Search by name, phone, or GSTIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-11"
          />
        </div>
      </div>

      {/* Customers Grid */}
      {loading && customers.length === 0 ? (
        <div className="p-20 text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-12 text-center shadow-soft border border-zinc-100 dark:border-zinc-800">
          <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">No customers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {customers.map((customer) => (
            <div key={customer.id} className={`group relative bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-soft border border-zinc-100 dark:border-zinc-800 hover:border-emerald-500 transition-all duration-300 ${selectedIds.includes(customer.id) ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/10' : ''}`}>
              <div className="absolute top-6 left-6">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(customer.id)}
                  onChange={() => toggleSelect(customer.id)}
                  className="w-5 h-5 rounded-lg border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              <div className="flex items-start justify-between mb-4 ml-8">
                <div>
                  <h3 className="font-black text-lg text-zinc-900 dark:text-white tracking-tight leading-tight">{customer.name}</h3>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">{customer.city || 'No Location'}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleEdit(customer)}
                    className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                    title="Edit Customer"
                  >
                    <EditIcon />
                  </button>
                  {isManager && (
                    <button 
                      onClick={() => handleDelete(customer.id, customer.name)}
                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                      title="Delete Customer"
                    >
                      <DeleteIcon />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="space-y-2 text-xs font-bold mb-6 ml-8">
                {customer.phone && (
                  <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                    <span>📞</span>
                    <span>{customer.phone}</span>
                  </div>
                )}
                {customer.gstin && (
                  <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                    <span>📄</span>
                    <span className="font-mono">{customer.gstin}</span>
                  </div>
                )}
                {customer.beat && (
                  <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                    <span>📍</span>
                    <span className="uppercase tracking-wider">{customer.beat}</span>
                  </div>
                )}
              </div>
              
              <div className="mt-4 pt-4 border-t border-zinc-50 dark:border-zinc-800 flex justify-between">
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Balance</p>
                  <p className={`text-lg font-black ${customer.outstandingBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatCurrency(customer.outstandingBalance)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Limit</p>
                  <p className="text-lg font-black text-zinc-800 dark:text-white">{formatCurrency(customer.creditLimit)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-cool border border-zinc-200 dark:border-zinc-800 animate-fade-in">
            <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
              <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight uppercase tracking-widest">
                {editingId ? 'Edit Customer' : 'Add New Customer'}
              </h2>
              <button onClick={() => setShowForm(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 transition-colors font-bold text-xl">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">Full Name *</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field mt-1" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">Phone</label>
                    <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input-field mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">Email</label>
                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input-field mt-1" />
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">GSTIN</label>
                  <input type="text" value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })} maxLength={15} className="input-field mt-1 font-mono" placeholder="23AMFPV..." />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">City</label>
                    <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="input-field mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">Beat / Route</label>
                    <input type="text" value={formData.beat} onChange={(e) => setFormData({ ...formData, beat: e.target.value })} className="input-field mt-1" />
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">Credit Limit</label>
                  <input type="number" value={formData.creditLimit} onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })} className="input-field mt-1 font-bold text-emerald-600" />
                </div>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold uppercase tracking-widest text-xs">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1 py-4 text-xs uppercase tracking-widest">
                  {submitting ? 'Processing...' : editingId ? 'Update Customer' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
