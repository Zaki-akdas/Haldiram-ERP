'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import type { Customer } from '@/db/schema';

interface OrderProduct {
  id: string;
  erpId: string;
  name: string;
  price: number;
  gstRate: number;
}

interface OrderItemDraft {
  productId: string;
  productName: string;
  erpId?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  gstRate: number;
}

export default function NewOrderPage() {
  const router = useRouter();
  const { authFetch } = useAuth();
  
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<OrderProduct[]>([]);
  
  // Order Details
  const [customerId, setCustomerId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${new Date().getTime().toString().slice(-6)}`);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [beat, setBeat] = useState('');
  const [creditDays, setCreditDays] = useState(0);
  const [notes, setNotes] = useState('');
  
  // Order Items
  const [items, setItems] = useState<OrderItemDraft[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoadingCustomers(true);
      try {
        const res = await authFetch('/api/customers?limit=200');
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data as Customer[] : (data.customers || []) as Customer[];
          setCustomers(list);
        }
      } catch (err) {
        console.error('Failed to load customers', err);
      } finally {
        setLoadingCustomers(false);
      }
    };

    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const res = await authFetch('/api/products?limit=500');
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data as Record<string, unknown>[] : (data.products || []) as Record<string, unknown>[];
          setProducts(list.map((p) => ({
            id: String(p.id),
            erpId: p.erpId ? String(p.erpId) : '',
            name: String(p.name || ''),
            price: Number(p.basePrice || 0),
            gstRate: Number(p.gstRate || 5),
          })));
        }
      } catch (err) {
        console.error('Failed to load products', err);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchCustomers();
    fetchProducts();
  }, [authFetch]);


  const formatCurrency = (amount: number) => {
    return Number(amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  };

  const handleAddProduct = (product: OrderProduct) => {
    const existingItem = items.find(item => item.productId === product.id);
    if (existingItem) {
      updateItem(product.id, 'quantity', existingItem.quantity + 1);
    } else {
      setItems([...items, {
        productId: product.id,
        productName: product.name,
        erpId: product.erpId,
        quantity: 1,
        unitPrice: product.price,
        discount: 0,
        gstRate: product.gstRate
      }]);
    }
  };

  const updateItem = (productId: string, field: string, value: number) => {
    setItems(items.map(item => {
      if (item.productId === productId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const removeItem = (productId: string) => {
    setItems(items.filter(item => item.productId !== productId));
  };

  // Calculations
  const calculatedItems = items.map(item => {
    const taxableAmount = (item.quantity * item.unitPrice) - item.discount;
    const gstAmount = taxableAmount * (item.gstRate / 100);
    const totalAmount = taxableAmount + gstAmount;
    return { ...item, taxableAmount, gstAmount, totalAmount };
  });

  const subtotal = calculatedItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalDiscount = calculatedItems.reduce((sum, item) => sum + item.discount, 0);
  const totalTaxable = calculatedItems.reduce((sum, item) => sum + item.taxableAmount, 0);
  const totalGst = calculatedItems.reduce((sum, item) => sum + item.gstAmount, 0);
  const grandTotal = totalTaxable + totalGst;
  const cgst = totalGst / 2;
  const sgst = totalGst / 2;

  const handleSubmit = async () => {
    if (!customerId || items.length === 0) {
      alert('Please select a customer and add at least one item.');
      return;
    }
    
    setSubmitting(true);
    
    const payload = {
      customerId: Number(customerId),
      invoiceNumber,
      orderDate,
      deliveryDate: deliveryDate || undefined,
      beat,
      creditDays,
      notes,
      subtotal,
      taxableAmount: totalTaxable,
      cgst,
      sgst,
      igst: 0,
      totalGst,
      grandTotal,
      items: calculatedItems.map(item => ({
        productId: item.productId ? Number(item.productId) : null,
        erpId: item.erpId || null,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxableAmount: item.taxableAmount,
        gstRate: item.gstRate,
        gstAmount: item.gstAmount,
        totalAmount: item.totalAmount,
      })),
    };

try {
       const res = await authFetch('/api/orders', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(payload),
       });

       if (res.ok) {
         const createdOrder = await res.json();
         setNotification('Order created successfully!');
         setTimeout(() => router.push(`/orders/${createdOrder.order.id}`), 1500);
       } else {
         const data = await res.json();
         throw new Error(data.error || 'Failed to create order');
       }
     } catch (error) {
       console.error('Failed to create order', error);
       alert('Failed to create order');
     } finally {
       setSubmitting(false);
     }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
    p.erpId.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {notification && (
        <div className="p-4 rounded-xl bg-emerald-900/40 text-emerald-300 border border-emerald-700 font-semibold">
          {notification}
        </div>
      )}
      <div className="flex items-center gap-4">
        <Link href="/orders" className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </Link>
        <h1 className="text-3xl font-bold text-white tracking-tight">Create New Order</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {/* Order Details */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-2">Order Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Customer *</label>
                <select className="input-field w-full" value={customerId} onChange={e => setCustomerId(e.target.value)} required disabled={loadingCustomers}>
                  <option value="">{loadingCustomers ? 'Loading customers...' : 'Select Customer'}</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Invoice Number</label>
                <input type="text" className="input-field w-full" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Order Date</label>
                <input type="date" className="input-field w-full" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Delivery Date</label>
                <input type="date" className="input-field w-full" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Beat</label>
                <input type="text" className="input-field w-full placeholder-gray-500" placeholder="e.g. North Zone" value={beat} onChange={e => setBeat(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Credit Days</label>
                <input type="number" min="0" className="input-field w-full" value={creditDays} onChange={e => setCreditDays(parseInt(e.target.value) || 0)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-300 mb-1 block">Notes</label>
                <textarea className="input-field w-full min-h-[80px]" placeholder="Add any special instructions..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Product Selection */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-2">Add Products</h2>
            <div className="mb-4 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input 
                type="text" 
                placeholder="Search products by name or ERP ID..." 
                className="input-field pl-10 w-full"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {filteredProducts.map(product => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-white/5 hover:bg-slate-700/50 transition-colors">
                  <div>
                    <div className="font-medium text-white">{product.name}</div>
                    <div className="text-xs text-gray-400">ERP: {product.erpId} &bull; Base: {formatCurrency(product.price)} &bull; GST: {product.gstRate}%</div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => handleAddProduct(product)}
                    className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Order Items */}
          <div className="glass-card p-6 overflow-hidden">
            <h2 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-2">Order Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-xs uppercase bg-slate-800/50 text-gray-400">
                  <tr>
                    <th className="px-3 py-3">Product</th>
                    <th className="px-3 py-3 w-20">Qty</th>
                    <th className="px-3 py-3 text-right">Price</th>
                    <th className="px-3 py-3 w-24 text-right">Disc.</th>
                    <th className="px-3 py-3 text-right">Taxable</th>
                    <th className="px-3 py-3 text-right">GST</th>
                    <th className="px-3 py-3 text-right font-bold">Total</th>
                    <th className="px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-gray-500">No items added yet. Select products from above.</td>
                    </tr>
                  ) : (
                    calculatedItems.map(item => (
                      <tr key={item.productId} className="border-b border-white/5 bg-slate-900/20">
                        <td className="px-3 py-3">
                          <div className="font-medium text-white">{item.productName}</div>
                          <div className="text-xs text-gray-500">{item.erpId}</div>
                        </td>
                        <td className="px-3 py-3">
                          <input 
                            type="number" 
                            min="1"
                            className="input-field w-16 p-1 h-8 text-center"
                            value={item.quantity}
                            onChange={e => updateItem(item.productId, 'quantity', parseInt(e.target.value) || 1)}
                          />
                        </td>
                        <td className="px-3 py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-3 py-3">
                          <input 
                            type="number" 
                            min="0"
                            className="input-field w-20 p-1 h-8 text-right"
                            value={item.discount}
                            onChange={e => updateItem(item.productId, 'discount', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-3 py-3 text-right">{formatCurrency(item.taxableAmount)}</td>
                        <td className="px-3 py-3 text-right text-xs">
                          {formatCurrency(item.gstAmount)}<br/><span className="text-gray-500">({item.gstRate}%)</span>
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-emerald-400">{formatCurrency(item.totalAmount)}</td>
                        <td className="px-3 py-3 text-center">
                          <button 
                            onClick={() => removeItem(item.productId)}
                            className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Section: Summary */}
        <div className="lg:col-span-1">
          <div className="glass-card p-6 sticky top-6">
            <h2 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-2">Order Summary</h2>
            
            <div className="space-y-3 text-sm text-gray-300 mb-6">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount</span>
                  <span>- {formatCurrency(totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Taxable Amount</span>
                <span>{formatCurrency(totalTaxable)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>CGST</span>
                <span>{formatCurrency(cgst)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>SGST</span>
                <span>{formatCurrency(sgst)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Total GST</span>
                <span>{formatCurrency(totalGst)}</span>
              </div>
              
              <div className="my-4 border-t border-white/10 pt-4"></div>
              
              <div className="flex justify-between items-center text-xl font-bold text-white">
                <span>Grand Total</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>

            <button 
              onClick={handleSubmit}
              disabled={submitting || items.length === 0 || !customerId}
              className="btn-primary w-full py-3 flex justify-center text-sm font-bold shadow-lg shadow-indigo-500/30"
            >
              {submitting ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                'Create Order'
              )}
            </button>
            {(!customerId || items.length === 0) && (
              <p className="text-xs text-center text-rose-400 mt-3">Select a customer and add items to continue.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
