'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';

interface Product {
  id: string;
  erpId: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  mrp: number;
  basePrice: number;
  gstRate: number;
  hsnCode: string;
  stockQty: number;
  status: 'Active' | 'Inactive';
}

export default function ProductsPage() {
  const { user, authFetch } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<Product>>({
    erpId: '', name: '', description: '', category: '', unit: 'PCS',
    mrp: 0, basePrice: 0, gstRate: 18, hsnCode: '', stockQty: 0, status: 'Active'
  });

  const canAccess = user?.role === 'admin' || user?.role === 'manager';

  const fetchProducts = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await authFetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : (data.products || []));
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Failed to fetch products', error);
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (canAccess) fetchProducts();
  }, [canAccess]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map(p => p.id));
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
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await authFetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedIds(selectedIds.filter(i => i !== id));
        fetchProducts(true);
      }
    } catch (error) {
      console.error('Delete failed', error);
    }
  };

  const handleDeleteBulk = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected products?`)) return;
    try {
      const res = await authFetch('/api/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });
      if (res.ok) {
        setSelectedIds([]);
        fetchProducts(true);
      }
    } catch (err) {
      console.error('Bulk delete error', err);
    }
  };

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
        <svg className="w-20 h-20 text-rose-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Access Denied</h2>
        <p className="text-slate-500 max-w-md">You do not have the required permissions to view or manage products.</p>
      </div>
    );
  }

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.erpId.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({
      erpId: '', name: '', description: '', category: '', unit: 'PCS',
      mrp: 0, basePrice: 0, gstRate: 18, hsnCode: '', stockQty: 0, status: 'Active'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProduct(p);
    setFormData({ ...p });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PATCH' : 'POST';
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchProducts(true);
      }
    } catch (error) {
      console.error('Save failed', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Products Catalog</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage FMCG SKU inventory, MRP, and GST rates</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchProducts(true)}
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
          <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
            + Add Product
          </button>
        </div>
      </div>

      {/* Category Visual Banner Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          onClick={() => setCategoryFilter(categoryFilter === 'Snacks' ? 'All' : 'Snacks')}
          className={`relative rounded-2xl overflow-hidden glass-card p-6 h-40 flex items-end cursor-pointer transition-all duration-300 ${categoryFilter === 'Snacks' ? 'ring-2 ring-indigo-500 scale-[1.01]' : 'hover:scale-[1.01]'}`}
        >
          <Image src="/images/cat-snacks.jpg" alt="Snacks Category" fill className="object-cover opacity-35 dark:opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Category</span>
            <h3 className="text-xl font-extrabold text-white">Bhujia, Sev & Namkeen Snacks</h3>
            <p className="text-xs text-slate-300">Crispy Indian snacks SKU catalog</p>
          </div>
        </div>

        <div 
          onClick={() => setCategoryFilter(categoryFilter === 'Sweets' ? 'All' : 'Sweets')}
          className={`relative rounded-2xl overflow-hidden glass-card p-6 h-40 flex items-end cursor-pointer transition-all duration-300 ${categoryFilter === 'Sweets' ? 'ring-2 ring-indigo-500 scale-[1.01]' : 'hover:scale-[1.01]'}`}
        >
          <Image src="/images/cat-sweets.jpg" alt="Sweets Category" fill className="object-cover opacity-35 dark:opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Category</span>
            <h3 className="text-xl font-extrabold text-white">Soan Papdi & Sweets</h3>
            <p className="text-xs text-slate-300">Packaged Indian sweets & confectionery</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search product name or ERP ID..."
            className="input-field pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                categoryFilter === cat
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3.5 w-10">
                  <input
                    type="checkbox"
                    checked={filteredProducts.length > 0 && selectedIds.length === filteredProducts.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-4 py-3.5 font-bold">Product</th>
                <th className="px-4 py-3.5 font-bold">ERP ID</th>
                <th className="px-4 py-3.5 font-bold">Category</th>
                <th className="px-4 py-3.5 font-bold text-right">MRP (₹)</th>
                <th className="px-4 py-3.5 font-bold text-right">Base Price (₹)</th>
                <th className="px-4 py-3.5 font-bold text-right">GST %</th>
                <th className="px-4 py-3.5 font-bold text-center">Stock Qty</th>
                <th className="px-4 py-3.5 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                [1, 2, 3, 4].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-4"><div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                    <td className="px-4 py-4"><div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                    <td className="px-4 py-4"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                    <td className="px-4 py-4"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                    <td className="px-4 py-4"><div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded ml-auto"></div></td>
                    <td className="px-4 py-4"><div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded ml-auto"></div></td>
                    <td className="px-4 py-4"><div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded ml-auto"></div></td>
                    <td className="px-4 py-4"><div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded mx-auto"></div></td>
                    <td className="px-4 py-4"><div className="h-6 w-12 bg-slate-200 dark:bg-slate-700 rounded mx-auto"></div></td>
                  </tr>
                ))
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    No products found matching your search criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.id)}
                        onChange={(e) => toggleSelectOne(p.id, e as any)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl relative overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800">
                          <Image
                            src={p.category === 'Sweets' ? '/images/cat-sweets.jpg' : '/images/cat-snacks.jpg'}
                            alt={p.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm">{p.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">HSN: {p.hsnCode || '21069099'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-400 font-bold">{p.erpId}</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300">
                        {p.category || 'Snacks'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-900 dark:text-white">₹{p.mrp}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">₹{p.basePrice}</td>
                    <td className="px-4 py-3.5 text-right font-bold">{p.gstRate}%</td>
                    <td className="px-4 py-3.5 text-center font-bold">{p.stockQty} {p.unit}</td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={(e) => openEditModal(p, e)} className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40">
                          ✏️
                        </button>
                        <button onClick={(e) => handleDeleteSingle(p.id, e)} className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/40">
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

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">ERP ID</label>
                  <input type="text" required className="input-field" value={formData.erpId || ''} onChange={e => setFormData({...formData, erpId: e.target.value})} placeholder="FD012600..." />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Product Name</label>
                  <input type="text" required className="input-field" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Aloo Bhujia 400g" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Category</label>
                  <input type="text" className="input-field" value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="Snacks" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">HSN Code</label>
                  <input type="text" className="input-field" value={formData.hsnCode || ''} onChange={e => setFormData({...formData, hsnCode: e.target.value})} placeholder="21069099" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">MRP (₹)</label>
                  <input type="number" step="0.01" className="input-field" value={formData.mrp || 0} onChange={e => setFormData({...formData, mrp: parseFloat(e.target.value)})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Base Price (₹)</label>
                  <input type="number" step="0.01" className="input-field" value={formData.basePrice || 0} onChange={e => setFormData({...formData, basePrice: parseFloat(e.target.value)})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">GST Rate %</label>
                  <input type="number" className="input-field" value={formData.gstRate || 18} onChange={e => setFormData({...formData, gstRate: parseFloat(e.target.value)})} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
