'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

interface Customer {
  id: number;
  name: string;
  phone: string | null;
}

interface Product {
  id: number;
  erpId: string | null;
  name: string;
  basePrice: number;
  gstRate: number;
  unit: string;
}

interface OrderItem {
  productId: number;
  productName: string;
  erpId: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
}

export default function NewOrderPage() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [suggestedItems, setSuggestedItems] = useState<any[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState('');
  const [creditDays, setCreditDays] = useState('0');
  const [beat, setBeat] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      authFetch('/api/customers?limit=100').then(r => r.json()),
      authFetch('/api/products?limit=100').then(r => r.json()),
    ]).then(([custData, prodData]) => {
      setCustomers(custData.customers);
      setProducts(prodData.products);
      setLoading(false);
    });
  }, [authFetch]);

  // Fetch customer-specific history when customer selection changes
  useEffect(() => {
    if (selectedCustomer) {
      authFetch(`/api/customers/${selectedCustomer}/history`)
        .then(r => r.json())
        .then(data => setSuggestedItems(data.items || []))
        .catch(() => setSuggestedItems([]));
    } else {
      setSuggestedItems([]);
    }
  }, [selectedCustomer, authFetch]);

  const addItem = (product: Product) => {
    const existing = items.find(i => i.productId === product.id);
    if (existing) {
      setItems(items.map(i => {
        if (i.productId === product.id) {
          const qty = i.quantity + 1;
          const taxable = qty * i.unitPrice;
          const gst = (taxable * i.gstRate) / 100;
          return { ...i, quantity: qty, taxableAmount: taxable, gstAmount: gst, totalAmount: taxable + gst };
        }
        return i;
      }));
    } else {
      const taxable = product.basePrice;
      const gst = (taxable * product.gstRate) / 100;
      setItems([...items, {
        productId: product.id,
        productName: product.name,
        erpId: product.erpId || '',
        quantity: 1,
        unitPrice: product.basePrice,
        gstRate: product.gstRate,
        taxableAmount: taxable,
        gstAmount: gst,
        totalAmount: taxable + gst,
      }]);
    }
  };

  const updateQuantity = (productId: number, qty: number) => {
    if (qty <= 0) {
      setItems(items.filter(i => i.productId !== productId));
    } else {
      setItems(items.map(i => {
        if (i.productId === productId) {
          const taxable = qty * i.unitPrice;
          const gst = (taxable * i.gstRate) / 100;
          return { ...i, quantity: qty, taxableAmount: taxable, gstAmount: gst, totalAmount: taxable + gst };
        }
        return i;
      }));
    }
  };

  const totals = items.reduce((acc, item) => ({
    subtotal: acc.subtotal + item.taxableAmount,
    gst: acc.gst + item.gstAmount,
    grandTotal: acc.grandTotal + item.totalAmount,
  }), { subtotal: 0, gst: 0, grandTotal: 0 });

  const handleSubmit = async () => {
    if (!selectedCustomer || items.length === 0) return;
    
    setSubmitting(true);
    try {
      const invoiceNumber = `PSSE/26-27/${Date.now().toString().slice(-5)}`;
      
      const res = await authFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber,
          customerId: selectedCustomer,
          items,
          beat,
          notes,
          creditDays,
        }),
      });
      
      if (res.ok) {
        router.push('/orders');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">New Order</h1>
        <p className="text-slate-500 dark:text-slate-400">Create a new sales order</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer & Products */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selection */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-slate-800 dark:text-white mb-3">Select Customer</h3>
            <select
              value={selectedCustomer || ''}
              onChange={(e) => setSelectedCustomer(Number(e.target.value))}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
            >
              <option value="">Choose a customer...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Customer History / Suggestions */}
          {selectedCustomer && suggestedItems.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border-l-4 border-amber-500">
              <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-3 uppercase tracking-wider flex items-center gap-2">
                <span>🕒</span> Customer's Frequent Items
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {suggestedItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-900/30">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-white text-xs truncate">{item.productName}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{item.erpId}</p>
                    </div>
                    <button
                      onClick={() => addItem({
                        id: 0, // Placeholder
                        name: item.productName,
                        basePrice: Number(item.unitPrice),
                        gstRate: Number(item.gstRate),
                        erpId: item.erpId,
                        unit: 'PCS'
                      })}
                      className="ml-3 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-md transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product Selection */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-slate-800 dark:text-white mb-3">All Products</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {products.map(product => (
                <button
                  key={product.id}
                  onClick={() => addItem(product)}
                  className="p-3 text-left bg-slate-50 dark:bg-slate-700/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors group"
                >
                  <p className="font-medium text-slate-800 dark:text-white text-sm truncate group-hover:text-emerald-700">{product.name}</p>
                  <p className="text-emerald-600 text-sm font-bold">{formatCurrency(product.basePrice)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Order Items */}
          {items.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-semibold text-slate-800 dark:text-white">Order Items</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {items.map(item => (
                  <div key={item.productId} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-white">{item.productName}</p>
                      <p className="text-sm text-slate-500">{formatCurrency(item.unitPrice)} × {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center"
                        >
                          −
                        </button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                      <p className="w-24 text-right font-medium text-emerald-600">{formatCurrency(item.totalAmount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm sticky top-4">
            <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Order Summary</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="text-slate-800 dark:text-white">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">GST</span>
                <span className="text-slate-800 dark:text-white">{formatCurrency(totals.gst)}</span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex justify-between">
                <span className="font-medium text-slate-800 dark:text-white">Grand Total</span>
                <span className="font-bold text-emerald-600 text-lg">{formatCurrency(totals.grandTotal)}</span>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Credit Timing</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={creditDays}
                    onChange={(e) => setCreditDays(e.target.value)}
                    className="w-20 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-bold"
                  />
                  <span className="text-xs text-slate-500">Days to pay</span>
                </div>
                <p className="text-[9px] text-slate-400 mt-1 italic">Due by: {new Date(Date.now() + parseInt(creditDays || '0') * 86400000).toLocaleDateString()}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Beat / Route</label>
                <input
                  type="text"
                  value={beat}
                  onChange={(e) => setBeat(e.target.value)}
                  placeholder="e.g., Main Market"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Internal Note</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any specific delivery or billing instructions..."
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm"
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!selectedCustomer || items.length === 0 || submitting}
              className="mt-6 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Creating...' : '📦 Create Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
