'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface Product {
  id: number;
  erpId: string | null;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  mrp: number;
  basePrice: number;
  gstRate: number;
  hsnCode: string | null;
  stockQty: number;
  isActive: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
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

export default function ProductsPage() {
  const { user, authFetch } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const [formData, setFormData] = useState({
    erpId: '',
    name: '',
    description: '',
    category: '',
    unit: 'PCS',
    mrp: '',
    basePrice: '',
    gstRate: '5',
    hsnCode: '',
    stockQty: '0',
  });
  const [submitting, setSubmitting] = useState(false);

  async function fetchProducts() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, category });
      const res = await authFetch(`/api/products?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      
      const data = await res.json();
      setProducts(data.products);
      setCategories(data.categories);
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category]);

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setFormData({
      erpId: product.erpId || '',
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      unit: product.unit,
      mrp: String(product.mrp),
      basePrice: String(product.basePrice),
      gstRate: String(product.gstRate),
      hsnCode: product.hsnCode || '',
      stockQty: String(product.stockQty),
    });
    setShowForm(true);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const method = editingId ? 'PATCH' : 'POST';
      const url = editingId ? `/api/products/${editingId}` : '/api/products';
      
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          mrp: parseFloat(formData.mrp),
          basePrice: parseFloat(formData.basePrice),
          gstRate: parseFloat(formData.gstRate),
          stockQty: parseInt(formData.stockQty, 10),
        }),
      });
      
      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setFormData({ erpId: '', name: '', description: '', category: '', unit: 'PCS', mrp: '', basePrice: '', gstRate: '5', hsnCode: '', stockQty: '0' });
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Are you sure you want to delete product "${name}"?`)) return;
    try {
      const res = await authFetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) fetchProducts();
      else alert('Failed to delete (linked to orders?)');
    } catch (err) {
      alert('Error deleting product');
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === products.length) setSelectedIds([]);
    else setSelectedIds(products.map(p => p.id));
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.length} products?`)) return;
    setLoading(true);
    try {
      for (const id of selectedIds) {
        await authFetch(`/api/products/${id}`, { method: 'DELETE' });
      }
      fetchProducts();
    } catch (err) {
      alert('Some items could not be deleted');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Inventory</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage your product catalog and stock levels</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchProducts()}
            className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl hover:text-emerald-600 transition-colors border border-zinc-200 dark:border-zinc-700"
          >
            <RefreshIcon />
          </button>
          <button
            onClick={() => { setEditingId(null); setShowForm(true); }}
            className="btn-primary"
          >
            <span className="text-xl">+</span>
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {selectedIds.length > 0 && isManager && (
        <div className="bg-zinc-900 text-white px-6 py-4 rounded-[1.5rem] flex items-center justify-between shadow-cool animate-fade-in">
          <p className="text-sm font-bold">{selectedIds.length} items selected</p>
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
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-11"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border-transparent border focus:border-emerald-500 rounded-xl outline-none transition-all text-sm font-bold text-zinc-700 dark:text-zinc-300"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-soft border border-zinc-100 dark:border-zinc-800 overflow-hidden">
        {loading && products.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="p-20 text-center text-zinc-500 uppercase tracking-widest text-xs font-black">No products found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-6 py-4 text-left w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === products.length && products.length > 0}
                      onChange={toggleSelectAll}
                      className="w-5 h-5 rounded-lg border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Product</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">ERP ID</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Category</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-zinc-400 uppercase tracking-widest">MRP</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-zinc-400 uppercase tracking-widest">Base Price</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-zinc-400 uppercase tracking-widest">Stock</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                {products.map((product) => (
                  <tr key={product.id} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors ${selectedIds.includes(product.id) ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        className="w-5 h-5 rounded-lg border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-black text-zinc-900 dark:text-white tracking-tight leading-tight">{product.name}</p>
                        {product.hsnCode && (
                          <p className="text-[10px] font-bold text-zinc-400 uppercase mt-0.5">HSN: {product.hsnCode}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono font-bold text-emerald-600">
                      {product.erpId || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 text-[10px] font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-full uppercase">
                        {product.category || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-zinc-900 dark:text-white tracking-tight">
                      {formatCurrency(product.mrp)}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-emerald-600 tracking-tight">
                      {formatCurrency(product.basePrice)}
                    </td>
                    <td className={`px-6 py-4 text-right font-black tracking-tight ${
                      product.stockQty > 50 ? 'text-emerald-600' : 
                      product.stockQty > 10 ? 'text-amber-500' : 'text-red-500'
                    }`}>
                      {product.stockQty} <span className="text-[10px] uppercase opacity-60 ml-1">{product.unit}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => handleEdit(product)}
                          className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                        >
                          <EditIcon />
                        </button>
                        {isManager && (
                          <button 
                            onClick={() => handleDelete(product.id, product.name)}
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
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
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-cool border border-zinc-200 dark:border-zinc-800 animate-fade-in">
            <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
              <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight uppercase">
                {editingId ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button onClick={() => setShowForm(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 transition-colors font-bold text-xl">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">Product Name *</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field mt-1" />
                </div>
                
                <div>
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">ERP ID</label>
                  <input type="text" value={formData.erpId} onChange={(e) => setFormData({ ...formData, erpId: e.target.value.toUpperCase() })} className="input-field mt-1 font-mono" />
                </div>
                
                <div>
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">Category</label>
                  <input type="text" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="input-field mt-1" />
                </div>
                
                <div>
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">MRP *</label>
                  <input type="number" step="0.01" required value={formData.mrp} onChange={(e) => setFormData({ ...formData, mrp: e.target.value })} className="input-field mt-1 font-bold text-emerald-600" />
                </div>
                
                <div>
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">Base Price *</label>
                  <input type="number" step="0.01" required value={formData.basePrice} onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })} className="input-field mt-1 font-bold text-emerald-600" />
                </div>
                
                <div>
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">GST Rate (%)</label>
                  <select value={formData.gstRate} onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })} className="input-field mt-1 font-bold">
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">Stock Quantity</label>
                  <input type="number" value={formData.stockQty} onChange={(e) => setFormData({ ...formData, stockQty: e.target.value })} className="input-field mt-1" />
                </div>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold uppercase text-xs">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1 py-4 text-xs uppercase tracking-widest">
                  {submitting ? 'Processing...' : editingId ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
