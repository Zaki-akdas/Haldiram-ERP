'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import type { Customer, Product } from '@/db/schema';
import type { IngestItem, IngestResult } from '@/lib/ingestion/types';
import type { ExtractionResult } from '@/lib/ai-provider';

interface AiExtractResponse {
  extraction?: ExtractionResult;
  validation?: unknown;
  provider?: string;
  // Loose fields used by the AI-mode review UI.
  customerName?: string;
  total?: number;
}

interface ExtractModeState {
  extraction: IngestResult;
  validation?: unknown;
}

export default function BillsPage() {
  const { authFetch } = useAuth();
  const [mode, setMode] = useState<'fast' | 'ai' | 'extract'>('fast');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(`FB-${new Date().getTime()}`);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<Array<{
    id: number | string;
    productId: string;
    productName?: string;
    erpId?: string;
    hsnCode?: string;
    quantity: number;
    basePrice: number;
    discount: number;
    taxableAmount?: number;
    gstRate?: number;
    gstAmount?: number;
    totalAmount?: number;
  }>>([{ id: 1, productId: '', quantity: 1, basePrice: 0, discount: 0 }]);
  const [recentBills, setRecentBills] = useState<{ invoiceNumber: string; total: number; date: string }[]>([]);
  const [notification, setNotification] = useState('');
  
  // AI Mode states
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiResults, setAiResults] = useState<AiExtractResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Extract Mode states
  const [extractText, setExtractText] = useState('');
  const [extractFile, setExtractFile] = useState<File | null>(null);
  const [extractResults, setExtractResults] = useState<ExtractModeState | null>(null);
  const [extractLoading, setExtractLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const [custRes, prodRes] = await Promise.all([
      authFetch('/api/customers'),
      authFetch('/api/products')
    ]);
    const custData = custRes.ok ? (await custRes.json()) as { customers?: Customer[] } | Customer[] : null;
    const prodData = prodRes.ok ? (await prodRes.json()) as { products?: Product[] } | Product[] : null;
    return {
      customers: Array.isArray(custData) ? custData : (custData?.customers || []),
      products: Array.isArray(prodData) ? prodData : (prodData?.products || []),
    };
  }, [authFetch]);

  const loadData = async () => {
    try {
      const { customers: loadedCustomers, products: loadedProducts } = await fetchData();
      setCustomers(loadedCustomers);
      setProducts(loadedProducts);
    } catch (err) {
      console.error("Failed to load initial data", err);
    }
  };

  useEffect(() => {
    // Fetch on mount; state updates happen in .then callbacks so they are not
    // synchronous within the effect body.
    fetchData()
      .then(({ customers: loadedCustomers, products: loadedProducts }) => {
        setCustomers(loadedCustomers);
        setProducts(loadedProducts);
      })
      .catch(err => console.error('Failed to load initial data', err));
  }, [authFetch, fetchData]);

  const addRow = () => {
    setRows([...rows, { id: Date.now(), productId: '', quantity: 1, basePrice: 0, discount: 0 }]);
  };

  const removeRow = (id: number | string) => {
    if (rows.length > 1) {
      setRows(rows.filter(r => r.id !== id));
    }
  };

  const handleRowChange = (id: number | string, field: string, value: string | number) => {
    setRows(rows.map(r => {
      if (r.id === id) {
        const updated = { ...r, [field]: value };
        if (field === 'productId') {
          const prodList = Array.isArray(products) ? products : [];
          const product = prodList.find(p => String(p.id) === String(value));
          if (product) updated.basePrice = Number(product.basePrice || product.mrp || 0);
        }
        return updated;
      }
      return r;
    }));
  };

  const calculateSubtotal = () => {
    return rows.reduce((sum, r) => sum + ((r.quantity * r.basePrice) - r.discount), 0);
  };
  const gst = calculateSubtotal() * 0.18;
  const grandTotal = calculateSubtotal() + gst;

  const submitFastBill = async () => {
    try {
      const subtotal = calculateSubtotal();
      const orderGst = subtotal * 0.18;
      const orderGrandTotal = subtotal + orderGst;
      const res = await authFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer,
          invoiceNumber,
          orderDate: date,
          items: rows.map(r => ({
            productId: r.productId || null,
            productName: (Array.isArray(products) ? products : []).find(p => String(p.id) === String(r.productId))?.name || r.productName || 'Item',
            quantity: Number(r.quantity) || 1,
            unitPrice: Number(r.basePrice) || 0,
            discount: Number(r.discount) || 0,
            gstRate: 18,
            unit: 'PCS'
          })),
          subtotal,
          taxableAmount: subtotal,
          cgst: orderGst / 2,
          sgst: orderGst / 2,
          igst: 0,
          totalGst: orderGst,
          grandTotal: orderGrandTotal,
          status: 'confirmed'
        })
      });
      if (res.ok) {
        setNotification('Bill submitted successfully!');
        setRecentBills([{ invoiceNumber, total: orderGrandTotal, date }, ...recentBills].slice(0, 5));
        setInvoiceNumber(`FB-${Date.now()}`);
        setRows([{ id: Date.now(), productId: '', quantity: 1, basePrice: 0, discount: 0 }]);
        setTimeout(() => setNotification(''), 3000);
      } else {
        const err = await res.json();
        setNotification(err.error || 'Failed to submit bill.');
      }
    } catch (err) {
      console.error(err);
      setNotification('Failed to submit bill.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAiFile(e.target.files[0]);
    }
  };

  const processAiFile = async () => {
    if (!aiFile) return;
    setAiLoading(true);
    const formData = new FormData();
    formData.append('file', aiFile);
    try {
      const res = await authFetch('/api/ai/extract', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        setAiResults(await res.json());
      }
    } catch (err) {
      console.error(err);
      setNotification('Failed to process file with AI.');
    }
    setAiLoading(false);
  };

  const processExtractText = async () => {
    if (!extractText.trim()) return;
    setExtractLoading(true);
    try {
      const formData = new FormData();
      formData.append('text', extractText);
      formData.append('fileName', 'Pasted Text');
      formData.append('deploymentMode', 'cloud');
      
      const res = await authFetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setExtractResults({ extraction: data.result, validation: data.validation });
      } else {
        const err = await res.json();
        setNotification(err.error || 'Failed to extract bill data.');
      }
    } catch (err) {
      console.error(err);
      setNotification('Failed to extract bill data.');
    }
    setExtractLoading(false);
  };

  const processExtractFile = async () => {
    if (!extractFile) return;
    setExtractLoading(true);
    const formData = new FormData();
    formData.append('file', extractFile);
    formData.append('deploymentMode', 'cloud');
    
    try {
      const res = await authFetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setExtractResults({ extraction: data.result, validation: data.validation });
      } else {
        const err = await res.json();
        setNotification(err.error || 'Failed to extract bill data from file.');
      }
    } catch (err) {
      console.error(err);
      setNotification('Failed to extract bill data from file.');
    }
    setExtractLoading(false);
  };

  const applyExtractedItems = () => {
    if (!extractResults?.extraction?.items) return;
    const extractedItems = extractResults.extraction.items;
    const productList = Array.isArray(products) ? products : [];
    const newRows = extractedItems.map((item: IngestItem) => {
      // Match the extracted line to a real product by ERP ID so productId is valid for order creation
      const matchedProduct = productList.find(p => p.erpId === item.erpId);
      return {
        id: Date.now() + Math.random(),
        productId: matchedProduct ? String(matchedProduct.id) : '',
        productName: item.productName || matchedProduct?.name || '',
        quantity: item.quantity || 1,
        basePrice: item.unitPrice || item.mrp || 0,
        discount: item.discount || 0,
        erpId: item.erpId || '',
        hsnCode: item.hsnCode || '',
        taxableAmount: item.taxableAmount || 0,
        gstRate: item.gstRate || 0,
        gstAmount: item.gstAmount || 0,
        totalAmount: item.totalAmount || 0,
      };
    });
    setRows(newRows);
    setMode('fast');
    setNotification('Extracted items loaded into bill form!');
    setTimeout(() => setNotification(''), 3000);
  };

  const submitExtractedBill = async () => {
    if (!extractResults?.extraction) return;
    setExtractLoading(true);
    try {
      const extracted = extractResults.extraction;
      const header = extracted.header || {};
      const subtotal = header.taxableAmount || header.subtotal || 0;
      const totalGst = header.totalGst || 0;
      const grandTotal = header.grandTotal || subtotal + totalGst;

      const res = await authFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer || '1',
          invoiceNumber: header.invoiceNumber || `FB-${new Date().getTime()}`,
          orderDate: date,
          items: (extracted.items || []).map((item: IngestItem) => ({
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxableAmount: item.taxableAmount,
            gstRate: item.gstRate,
            gstAmount: item.gstAmount,
            totalAmount: item.totalAmount,
            hsnCode: item.hsnCode,
            erpId: item.erpId,
          })),
          subtotal,
          taxableAmount: subtotal,
          cgst: header.cgst || totalGst / 2,
          sgst: header.sgst || totalGst / 2,
          igst: header.igst || 0,
          totalGst,
          grandTotal,
          status: 'confirmed'
        })
      });

      if (res.ok) {
        setNotification('Bill submitted successfully!');
        setExtractResults(null);
        setExtractText('');
        setExtractFile(null);
        setMode('fast');
        setTimeout(() => setNotification(''), 3000);
      } else {
        const data = await res.json();
        setNotification(data.error || 'Failed to submit bill.');
      }
    } catch (err) {
      console.error(err);
      setNotification('Failed to submit extracted bill.');
    }
    setExtractLoading(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Field Bill Punching</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Quick invoice entry & order punching from the field</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Data
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <button 
          className={`px-6 py-2 rounded-full font-medium transition-all ${mode === 'fast' ? 'bg-primary text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
          onClick={() => setMode('fast')}
        >
          Fast Mode
        </button>
        <button 
          className={`px-6 py-2 rounded-full font-medium transition-all ${mode === 'extract' ? 'bg-primary text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
          onClick={() => setMode('extract')}
        >
          Extract
        </button>
        <Link
          href="/ingest"
          className="px-6 py-2 rounded-full font-medium transition-all bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md hover:from-indigo-700 hover:to-purple-700"
        >
          ✨ AI Ingestion
        </Link>
      </div>

      {notification && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 transition-all">
          {notification}
        </div>
      )}

      {mode === 'fast' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-1">Customer</label>
                  <select 
                    className="input-field w-full"
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                  >
                    <option value="">Select Customer...</option>
                    {(Array.isArray(customers) ? customers : []).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Invoice Number</label>
                  <input type="text" className="input-field w-full" value={invoiceNumber} readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input type="date" className="input-field w-full" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="hidden md:grid grid-cols-12 gap-2 text-sm font-medium text-gray-500 mb-2">
                  <div className="col-span-4">Product</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2">Price</div>
                  <div className="col-span-2">Discount</div>
                  <div className="col-span-2">Total</div>
                </div>

                {rows.map((row) => (
                  <div key={row.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-gray-50 dark:bg-gray-800/50 p-4 md:p-0 rounded-lg md:bg-transparent">
                    <div className="md:col-span-4">
                      <label className="md:hidden block text-xs mb-1">Product</label>
                      <select 
                        className="input-field w-full"
                        value={row.productId}
                        onChange={(e) => handleRowChange(row.id, 'productId', e.target.value)}
                      >
                        <option value="">Select...</option>
                        {(Array.isArray(products) ? products : []).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="md:hidden block text-xs mb-1">Qty</label>
                      <input 
                        type="number" 
                        className="input-field w-full" 
                        value={row.quantity} 
                        onChange={(e) => handleRowChange(row.id, 'quantity', Number(e.target.value))}
                        min="1"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="md:hidden block text-xs mb-1">Price</label>
                      <input 
                        type="number" 
                        className="input-field w-full bg-gray-100 dark:bg-gray-700" 
                        value={row.basePrice} 
                        readOnly
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="md:hidden block text-xs mb-1">Discount</label>
                      <input 
                        type="number" 
                        className="input-field w-full" 
                        value={row.discount} 
                        onChange={(e) => handleRowChange(row.id, 'discount', Number(e.target.value))}
                      />
                    </div>
                    <div className="md:col-span-2 flex justify-between items-center">
                      <div className="font-medium text-right w-full pr-2">
                        ₹{((row.quantity * row.basePrice) - row.discount).toFixed(2)}
                      </div>
                      <button 
                        onClick={() => removeRow(row.id)}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    </div>
                  </div>
                ))}

                <button 
                  onClick={addRow}
                  className="mt-4 flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                  Add Item
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-card p-6">
              <h2 className="text-xl font-bold mb-4">Summary</h2>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span>₹{calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>GST (18%)</span>
                  <span>₹{gst.toFixed(2)}</span>
                </div>
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between font-bold text-lg">
                  <span>Grand Total</span>
                  <span className="text-primary">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>
              <button 
                className="btn-primary w-full py-3 text-lg"
                onClick={submitFastBill}
              >
                Submit Bill
              </button>
            </div>

            {recentBills.length > 0 && (
              <div className="glass-card p-6">
                <h3 className="font-bold mb-3">Recent Bills (Today)</h3>
                <div className="space-y-2">
                  {recentBills.map((b, i) => (
                    <div key={i} className="flex justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="font-medium">{b.invoiceNumber}</span>
                      <span className="text-primary font-bold">₹{b.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : mode === 'ai' ? (
        <div className="glass-card p-8 text-center max-w-2xl mx-auto">
          {!aiResults ? (
            <>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-12 hover:border-primary transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  onChange={handleFileUpload}
                  accept="image/*,.pdf"
                />
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                <h3 className="text-lg font-medium mb-1">Drag & drop or click to browse</h3>
                <p className="text-sm text-gray-500">Upload a photo of a handwritten bill or invoice</p>
                {aiFile && <p className="mt-4 font-medium text-primary">Selected: {aiFile.name}</p>}
              </div>
              <button 
                className="btn-primary mt-6 w-full py-3"
                onClick={processAiFile}
                disabled={!aiFile || aiLoading}
              >
                {aiLoading ? 'Processing...' : 'Extract Data'}
              </button>
            </>
          ) : (
            <div className="text-left">
              <h3 className="text-xl font-bold mb-4">Extracted Data</h3>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-1">Extracted Customer</label>
                  <input type="text" className="input-field w-full" defaultValue={aiResults.customerName} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Extracted Total</label>
                  <input type="text" className="input-field w-full" defaultValue={`₹${aiResults.total}`} />
                </div>
              </div>
              <div className="flex gap-4">
                <button 
                  className="btn-primary flex-1 py-3"
                  onClick={submitExtractedBill}
                  disabled={extractLoading}
                >
                  {extractLoading ? 'Submitting...' : 'Approve & Submit'}
                </button>
                <button className="px-6 py-3 rounded-lg bg-gray-200 dark:bg-gray-700 font-medium" onClick={() => setAiResults(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-xl font-bold mb-4">Paste or Upload Bill Data</h2>
            <p className="text-sm text-gray-500 mb-4">Supports CSV, TSV, and copy-paste formats from Excel, Google Sheets, or any bill format.</p>
            
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center mb-4">
              <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setExtractFile(e.target.files[0]);
                  }
                }}
                accept=".csv,.tsv,.txt,.text"
              />
              <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
              <h3 className="text-lg font-medium mb-1">Upload CSV or TSV File</h3>
              <p className="text-sm text-gray-500">Or paste bill data directly into the text area below</p>
              {extractFile && <p className="mt-4 font-medium text-primary">Selected: {extractFile.name}</p>}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Or Paste Bill Data</label>
                <textarea 
                  className="input-field w-full h-48 font-mono text-sm"
                  placeholder="Paste CSV, TSV, or copy-paste bill data here..."
                  value={extractText}
                  onChange={(e) => setExtractText(e.target.value)}
                />
              </div>
              <div className="flex gap-4">
                <button 
                  className="btn-primary flex-1 py-3"
                  onClick={processExtractText}
                  disabled={!extractText.trim() || extractLoading}
                >
                  {extractLoading ? 'Extracting...' : 'Extract from Text'}
                </button>
                <button 
                  className="btn-primary flex-1 py-3"
                  onClick={processExtractFile}
                  disabled={!extractFile || extractLoading}
                >
                  {extractLoading ? 'Extracting...' : 'Extract from File'}
                </button>
              </div>
            </div>
          </div>

          {extractResults && (
            <div className="glass-card p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Extracted Bill Data</h3>
                <span className="text-sm text-gray-500">Format: {extractResults.extraction?.format}</span>
              </div>

              {extractResults.extraction?.items && extractResults.extraction.items.length > 0 && (
                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3">S No</th>
                        <th className="text-left py-2 px-3">ERP ID</th>
                        <th className="text-left py-2 px-3">Product Name</th>
                        <th className="text-left py-2 px-3">HSN</th>
                        <th className="text-right py-2 px-3">Qty</th>
                        <th className="text-right py-2 px-3">Unit Price</th>
                        <th className="text-right py-2 px-3">Taxable</th>
                        <th className="text-right py-2 px-3">GST%</th>
                        <th className="text-right py-2 px-3">GST Amt</th>
                        <th className="text-right py-2 px-3">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractResults.extraction.items.map((item: IngestItem, idx: number) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3">{item.srNo || idx + 1}</td>
                          <td className="py-2 px-3 font-mono text-xs">{item.erpId || '-'}</td>
                          <td className="py-2 px-3">{item.productName}</td>
                          <td className="py-2 px-3 font-mono text-xs">{item.hsnCode || '-'}</td>
                          <td className="py-2 px-3 text-right">{item.quantity}</td>
                          <td className="py-2 px-3 text-right">₹{(item.unitPrice || 0).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right">₹{(item.taxableAmount || 0).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right">{item.gstRate || 0}%</td>
                          <td className="py-2 px-3 text-right">₹{(item.gstAmount || 0).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-medium">₹{(item.totalAmount || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                        <td colSpan={6} className="py-2 px-3 text-right font-bold">Totals:</td>
                        <td className="py-2 px-3 text-right font-bold">₹{((extractResults.extraction?.header?.taxableAmount) || 0).toFixed(2)}</td>
                        <td colSpan={2}></td>
                        <td className="py-2 px-3 text-right font-bold">₹{((extractResults.extraction?.header?.totalGst) || 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-bold">₹{((extractResults.extraction?.header?.grandTotal) || 0).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <div className="flex gap-4">
                <button 
                  className="btn-primary flex-1 py-3"
                  onClick={applyExtractedItems}
                >
                  Load Items into Bill Form
                </button>
                <button 
                  className="px-6 py-3 rounded-lg bg-gray-200 dark:bg-gray-700 font-medium"
                  onClick={() => setExtractResults(null)}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
