'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';

/* ─── Types ─── */
interface Seller { name: string; gstin: string; pan: string; fssai: string; phone: string; address: string }
interface Buyer { name: string; phone: string; address: string; gstin?: string }
interface InvMeta { number: string; date: string; salesman: string; beat: string; employeeContact: string }
interface Item {
  sno: number; erpId: string; description: string; hsn: string;
  quantity: number; freeQty: number; unit: string; mrp: number;
  rate: number; discount: number; taxable: number; gstRate: number;
  cgst: number; sgst: number; gst: number; total: number;
}
interface Totals {
  totalQty: number; subtotal: number; discount: number;
  taxableAmount: number; cgst: number; sgst: number; igst: number;
  totalGst: number; grandTotal: number; roundOff: number;
  amountInWords: string;
}
interface ExtractedData {
  seller?: Seller; buyer?: Buyer; invoice?: InvMeta;
  items?: Item[]; totals?: Totals;
  metadata?: { extractionConfidence: number; fileType: string; rawTextLength: number };
}

const INR = (n: number) => n ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';

export default function BillsPage() {
  const { authFetch } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [tab, setTab] = useState<'upload' | 'paste'>('upload');
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [mode, setMode] = useState<'regex' | 'ai'>('regex');
  const [downloading, setDownloading] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [customerNameInput, setCustomerNameInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null); setTextInput(''); setExtracted(null); setError(''); setInvoiceId(null); setMode('regex'); setDownloading(false); setEditingCustomer(false); setCustomerNameInput('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setExtracted(null); setError(''); }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setExtracted(null); setError(''); }
  }, []);

  const handleExtract = async () => {
    if (tab === 'upload' && !file) return;
    if (tab === 'paste' && !textInput.trim()) return;

    setExtracting(true); setProgress(0); setError('');
    setExtracted(null);

    const tick = setInterval(() => setProgress(p => Math.min(p + 10, 92)), 150);

    try {
      const fd = new FormData();
      if (tab === 'upload' && file) {
        fd.append('file', file);
      } else {
        fd.append('textContent', textInput);
      }

      const token = typeof window !== 'undefined' ? localStorage.getItem('salessettle_token') : null;
      const endpoint = mode === 'ai' ? '/api/ai/extract' : '/api/invoices/extract';
      const res = await fetch(endpoint, {
        method: 'POST', body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Server error' }));
        throw new Error(err.error || 'Extraction failed');
      }

      const data = await res.json();
      setExtracted(data.extracted);
      setInvoiceId(data.invoiceId || null);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally { clearInterval(tick); setExtracting(false); }
  };

  const handleImport = async () => {
    if (!extracted || !extracted.totals) {
      setError('Extracted data is incomplete. Please ensure totals are visible.');
      return;
    }
    
    setImporting(true);
    setError('');
    
    try {
      // 1. Resolve Customer ID
      const buyerName = extracted.buyer?.name || '';
      let customerId: number | null = null;

      try {
        const custRes = await authFetch(`/api/customers?search=${encodeURIComponent(buyerName)}&limit=1`);
        if (custRes.ok) {
          const custData = await custRes.json();
          if (custData.customers && custData.customers.length > 0) {
            customerId = custData.customers[0].id;
          }
        }
      } catch (e) {
        console.warn('Customer resolution failed, will attempt auto-create', e);
      }

      // 2. Resolve Invoice Number (must be unique)
      const rawInvNo = extracted.invoice?.number || `B${Date.now().toString().slice(-8)}`;
      // Clean invoice number of symbols that might break URLS or SQL
      const invNo = rawInvNo.replace(/[^\w\-\/]/g, '').trim();

      // 3. Format items correctly with strict number casting
      const items = (extracted.items || []).map(it => ({
        productName: String(it.description || 'Unknown Product').substring(0, 250),
        erpId: String(it.erpId || '').substring(0, 50),
        quantity: Math.max(1, Number(it.quantity) || 0),
        unitPrice: Number(it.rate) || 0,
        taxableAmount: Number(it.taxable) || 0,
        gstAmount: Number(it.gst) || 0,
        totalAmount: Number(it.total) || 0,
        gstRate: Number(it.gstRate) || 0
      }));

      // Ensure at least one item exists
      if (items.length === 0) {
        items.push({
          productName: 'Punched Bill Total',
          erpId: 'PUNCHED',
          quantity: 1,
          unitPrice: Number(extracted.totals.taxableAmount) || Number(extracted.totals.grandTotal) || 0,
          taxableAmount: Number(extracted.totals.taxableAmount) || Number(extracted.totals.grandTotal) || 0,
          gstAmount: Number(extracted.totals.totalGst) || 0,
          totalAmount: Number(extracted.totals.grandTotal) || 0,
          gstRate: Number(extracted.totals.taxableAmount) > 0 ? (Number(extracted.totals.totalGst) / Number(extracted.totals.taxableAmount) * 100) : 5
        });
      }

      // 4. Create the order
      const payload = {
        invoiceNumber: invNo,
        invoiceId: invoiceId,
        customerId,
        customerName: buyerName,
        customerPhone: extracted.buyer?.phone || '',
        customerEmail: '',
        customerGstin: extracted.buyer?.gstin || '',
        customerAddress: extracted.buyer?.address || '',
        orderDate: new Date().toISOString(),
        beat: (extracted.invoice?.beat || 'Field Entry').substring(0, 250),
        notes: `Imported via Salesperson. Ref: ${file?.name || 'Text'}. Orig Date: ${extracted.invoice?.date || 'N/A'}`,
        items: items
      };

      const res = await authFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        // SUCCESS: Redirect to dashboard
        window.location.href = '/dashboard';
      } else {
        // SERVER-SIDE ERROR
        setError(data.error || 'The system could not save this bill. Please check if the Bill No already exists.');
      }
    } catch (err) {
      setError('Connection error. Please check your internet and try again.');
    } finally {
      setImporting(false);
    }
  };

  const handleDownload = async (targetFormat: 'csv' | 'copy-paste') => {
    if (!file) return;
    setDownloading(true);
    setError('');

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('targetFormat', targetFormat);

      const token = typeof window !== 'undefined' ? localStorage.getItem('salessettle_token') : null;
      const res = await fetch('/api/convert', {
        method: 'POST',
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Conversion failed' }));
        throw new Error(err.error || 'Conversion failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition');
      let filename = targetFormat === 'csv' ? 'converted.csv' : 'converted.txt';
      if (disposition && disposition.includes('filename=')) {
        filename = disposition.split('filename=')[1].replace(/"/g, '');
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">🧾 Field Bill Punching</h1>
        <p className="text-slate-500 dark:text-slate-400">Upload customer bills (PDF/Excel/CSV/Image) to punch them into the system</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          {(['upload', 'paste'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); reset(); }}
              className={`flex-1 px-4 py-3 text-sm font-bold transition-colors ${tab === t
                ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/30 dark:bg-emerald-900/10'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
              {t === 'upload' ? '📁 Upload Bill' : '📝 Paste Text'}
            </button>
          ))}
        </div>

        {/* Mode toggle */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button onClick={() => setMode('regex')}
            className={`flex-1 px-4 py-2 text-xs font-bold transition-colors ${mode === 'regex'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30 dark:bg-blue-900/10'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            ⚡ Fast (Regex)
          </button>
          <button onClick={() => setMode('ai')}
            className={`flex-1 px-4 py-2 text-xs font-bold transition-colors ${mode === 'ai'
              ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/30 dark:bg-purple-900/10'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            🤖 AI (Ollama)
          </button>
        </div>

        <div className="p-5">
          {tab === 'upload' ? (
            <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                file ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400'}`}>
              <input ref={fileRef} type="file" accept=".pdf,.csv,.tsv,.txt,.xlsx,.xls,.jpg,.jpeg,.png" onChange={handleFileChange} className="hidden" />
              
              {file ? (
                <div>
                  <span className="text-6xl mb-4 block">
                    {file.name.match(/\.(xlsx|xls|csv)$/i) ? '📊' : file.name.match(/\.(pdf)$/i) ? '📄' : '📷'}
                  </span>
                  <p className="font-bold text-lg text-slate-800 dark:text-white">{file.name}</p>
                  <p className="text-sm text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  <button onClick={e => { e.stopPropagation(); reset(); }} className="mt-4 text-xs text-red-500 hover:underline font-bold">Remove file</button>
                </div>
              ) : (
                <div>
                  <div className="flex justify-center gap-4 text-5xl mb-4">
                    <span>📄</span><span>📊</span><span>📷</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 font-bold">Drag &amp; drop customer bill</p>
                  <p className="text-slate-400 text-sm mt-1">Supports PDF, Excel, CSV, and Photos</p>
                </div>
              )}
            </div>
          ) : (
            <textarea value={textInput} onChange={e => setTextInput(e.target.value)} rows={10}
              placeholder={`Paste bill details here...\n\nExample:\nShri sai Kirana\nGSTIN: 23AMFPV5397L1ZB\nBill No: PSSE/15792\nGrand Total: 810.21`}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-white font-mono text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          )}

          {extracting && (
            <div className="mt-4">
              <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-slate-500 text-center mt-2 font-medium">Extracting data... {progress}%</p>
            </div>
          )}

          {error && <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 rounded-lg text-sm font-medium text-center">{error}</div>}

          {!extracted && !extracting && (
            <button onClick={handleExtract} 
              disabled={tab === 'upload' ? !file : !textInput.trim()}
              className="mt-6 w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-40">
              <span>{mode === 'ai' ? '🤖' : '⚡'}</span> {mode === 'ai' ? 'AI Extract Bill' : 'Extract Bill Details'}
            </button>
          )}
        </div>
      </div>

      {/* Extracted Preview */}
      {extracted && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span>📋</span> Extracted Summary
              </h3>
              {extracted.metadata && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded">
                  {extracted.metadata.fileType} • {extracted.metadata.extractionConfidence}% Conf.
                </span>
              )}
            </div>
            
            <div className="p-5 space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Customer / Shop</p>
                  {editingCustomer ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customerNameInput}
                        onChange={(e) => setCustomerNameInput(e.target.value)}
                      onBlur={() => {
                        if (!extracted) return;
                        setExtracted({
                          ...extracted,
                          buyer: { ...(extracted.buyer || { name: '', phone: '', address: '' }), name: customerNameInput } as Buyer
                        } as ExtractedData);
                        setEditingCustomer(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (!extracted) return;
                          setExtracted({
                            ...extracted,
                            buyer: { ...(extracted.buyer || { name: '', phone: '', address: '' }), name: customerNameInput } as Buyer
                          } as ExtractedData);
                          setEditingCustomer(false);
                        }
                      }}
                        className="flex-1 px-2 py-1 bg-white dark:bg-slate-800 border border-emerald-500 rounded text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="Enter customer name"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-2 cursor-pointer group"
                      onClick={() => {
                        const currentName = extracted?.buyer?.name || '';
                        setCustomerNameInput(currentName);
                        setEditingCustomer(true);
                      }}
                    >
                      <p className={`font-bold flex-1 ${!extracted?.buyer?.name ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                        {extracted?.buyer?.name || 'Not detected — tap to edit'}
                      </p>
                      <span className="text-xs text-slate-400 group-hover:text-emerald-500 transition-colors">✏️</span>
                    </div>
                  )}
                  {extracted.buyer?.phone && !editingCustomer && <p className="text-xs text-slate-500 mt-1">📞 {extracted.buyer.phone}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Bill No</p>
                    <p className="font-bold text-slate-800 dark:text-white">{extracted.invoice?.number || '—'}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Date</p>
                    <p className="font-bold text-slate-800 dark:text-white">{extracted.invoice?.date || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Product List (THE REQUESTED FIX) */}
              {extracted.items && extracted.items.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Product List</h4>
                  <div className="overflow-x-auto border border-slate-100 dark:border-slate-700 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-700/50">
                        <tr className="text-[10px] uppercase text-slate-500 font-black">
                          <th className="px-3 py-2 text-left w-10">#</th>
                          <th className="px-3 py-2 text-left">Product Description</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-right">Rate</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {extracted.items.map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/20">
                            <td className="px-3 py-2 text-slate-400 font-mono text-xs">{item.sno}</td>
                            <td className="px-3 py-2">
                              <p className="font-bold text-slate-800 dark:text-white leading-tight">{item.description}</p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.erpId || 'NO-ERP-ID'}</p>
                            </td>
                            <td className="px-3 py-2 text-right font-black text-slate-700 dark:text-slate-300">{item.quantity}</td>
                            <td className="px-3 py-2 text-right text-slate-500 font-mono text-xs">{INR(item.rate)}</td>
                            <td className="px-3 py-2 text-right font-black text-emerald-600">{INR(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Totals */}
              {extracted.totals && extracted.totals.grandTotal > 0 && (
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-6 text-white shadow-lg shadow-emerald-100 dark:shadow-none">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-black uppercase opacity-70">Total Bill Value</p>
                      <p className="text-4xl font-black mt-1">{INR(extracted.totals.grandTotal)}</p>
                      <p className="text-[10px] mt-2 italic opacity-80">{extracted.totals.amountInWords}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase opacity-70">Taxable: {INR(extracted.totals.taxableAmount)}</p>
                      <p className="text-[10px] font-black uppercase opacity-70">Total GST: {INR(extracted.totals.totalGst)}</p>
                      <p className="text-lg font-black mt-2">Qty: {extracted.totals.totalQty}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action */}
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <button 
                    onClick={handleImport} 
                    disabled={importing}
                    className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xl shadow-emerald-100 dark:shadow-none transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {importing ? (
                      <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Punching...</>
                    ) : (
                      <>📥 Punch Bill to Dashboard</>
                    )}
                  </button>
                  <button onClick={reset} className="px-6 py-4 border border-slate-300 dark:border-slate-600 text-slate-500 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    🔄 New
                  </button>
                </div>
                {file && (
                  <div className="flex gap-3">
                    <button onClick={() => handleDownload('csv')} disabled={downloading}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                      <span>📋</span> Download CSV
                    </button>
                    <button onClick={() => handleDownload('copy-paste')} disabled={downloading}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                      <span>📝</span> Download Copy-Paste
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guidelines */}
      {!extracted && !extracting && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900 rounded-xl p-5">
          <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
            <span>💡</span> Pro-Tips for Field Punching
          </h4>
          <ul className="mt-3 space-y-2 text-xs text-blue-700 dark:text-blue-400">
            <li className="flex gap-2"><span>✅</span> <strong>Selectable Text PDFs</strong> give the highest accuracy (99%).</li>
            <li className="flex gap-2"><span>✅</span> <strong>Photos</strong> should be flat, well-lit, and show the whole bill.</li>
            <li className="flex gap-2"><span>✅</span> <strong>Excel Files</strong> are great for bulk stock list punching.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
