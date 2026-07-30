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
interface Extracted {
  seller?: Seller; buyer?: Buyer; invoice?: InvMeta;
  items?: Item[]; totals?: Totals;
  metadata?: { extractionConfidence: number; fileType: string; rawTextLength: number };
}
interface Validation { passed: string[]; warnings: string[]; errors: string[]; score: number }
interface Rec { format: string; confidence: number; reason: string; tips: string[] }

const INR = (n: number) => n ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

const FILE_TYPES: Record<string, { icon: string; label: string; color: string }> = {
  pdf: { icon: '📄', label: 'PDF', color: 'text-red-500' },
  excel: { icon: '📊', label: 'Excel', color: 'text-emerald-600' },
  xlsx: { icon: '📊', label: 'Excel', color: 'text-emerald-600' },
  xls: { icon: '📊', label: 'Excel', color: 'text-emerald-600' },
  csv: { icon: '📋', label: 'CSV', color: 'text-blue-500' },
  txt: { icon: '📝', label: 'Text', color: 'text-slate-500' },
  text: { icon: '📝', label: 'Text', color: 'text-slate-500' },
};

function getFileInfo(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return FILE_TYPES[ext] || { icon: '📎', label: ext.toUpperCase(), color: 'text-slate-500' };
}

export default function InvoicesPage() {
  const { authFetch } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [recommendation, setRecommendation] = useState<Rec | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'upload' | 'paste'>('upload');
  const [importing, setImporting] = useState(false);
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [mode, setMode] = useState<'regex' | 'ai'>('regex');
  const [provider, setProvider] = useState<'ollama' | 'gemini' | 'azure'>('ollama');
  const [downloading, setDownloading] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [customerNameInput, setCustomerNameInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = () => {
    setFile(null); setExtracted(null); setValidation(null); setRecommendation(null); setError(''); setInvoiceId(null); setMode('regex'); setProvider('ollama'); setDownloading(false); setEditingCustomer(false); setCustomerNameInput('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      const allowed = ['pdf', 'csv', 'tsv', 'txt', 'xlsx', 'xls'];
      if (!allowed.includes(ext)) {
        setError(`Unsupported file type ".${ext}". Please upload PDF, Excel, or CSV.`);
        return;
      }
      setFile(f); setExtracted(null); setValidation(null); setRecommendation(null); setError('');
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  }, []);

  const handleExtract = async () => {
    if (tab === 'upload' && !file) return;
    if (tab === 'paste' && !textInput.trim()) return;

    setExtracting(true); setProgress(0); setError('');
    setExtracted(null); setValidation(null); setRecommendation(null);
    abortRef.current = new AbortController();

    const tick = setInterval(() => setProgress(p => Math.min(p + 5, 92)), 120);

    try {
      const fd = new FormData();
      if (tab === 'upload' && file) fd.append('file', file);
      else fd.append('textContent', textInput);

      if (mode === 'ai') {
        fd.append('provider', provider);
      }

      const token = typeof window !== 'undefined' ? localStorage.getItem('salessettle_token') : null;
      const endpoint = mode === 'ai' ? '/api/ai/extract' : '/api/invoices/extract';
      const res = await fetch(endpoint, {
        method: 'POST', body: fd,
        signal: abortRef.current.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Server error' }));
        throw new Error(data.error || `Failed (${res.status})`);
      }

      const data = await res.json();

      if (mode === 'ai' && (data.fallbackToRegex || data.aiError)) {
        setError('AI extraction failed, falling back to regex...');
        const fd2 = new FormData();
        if (tab === 'upload' && file) fd2.append('file', file);
        else fd2.append('textContent', textInput);
        const res2 = await fetch('/api/invoices/extract', {
          method: 'POST', body: fd2,
          signal: abortRef.current.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res2.ok) {
          const data2 = await res2.json().catch(() => ({ error: 'Fallback failed' }));
          throw new Error(data2.error || 'Regex fallback failed');
        }
        const data2 = await res2.json();
        setExtracted(data2.extracted);
        setValidation(data2.validation);
        setRecommendation(data2.recommendation);
        setInvoiceId(data2.invoiceId || null);
        setProgress(100);
      } else {
        setExtracted(data.extracted);
        setValidation(data.validation);
        setRecommendation(data.recommendation);
        setInvoiceId(data.invoiceId || null);
        setProgress(100);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') setError('Extraction cancelled');
      else setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally { clearInterval(tick); setExtracting(false); }
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

      const data = await res.json();
      const text = data.text || '';
      const filename = data.filename || (targetFormat === 'csv' ? 'converted.csv' : 'converted.txt');
      const blob = new Blob([text], { type: targetFormat === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
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

  const handleImport = async () => {
    if (!extracted || !extracted.totals) {
      setError('Extracted data is incomplete. Please ensure totals are visible.');
      return;
    }

    setImporting(true);
    setError('');

    try {
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

      const rawInvNo = extracted.invoice?.number || `B${Date.now().toString().slice(-8)}`;
      const invNo = rawInvNo.replace(/[^\w\-\/]/g, '').trim();

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
        window.location.href = '/dashboard';
      } else {
        setError(data.error || 'The system could not save this bill. Please check if the Bill No already exists.');
      }
    } catch (err) {
      setError('Connection error. Please check your internet and try again.');
    } finally {
      setImporting(false);
    }
  };

  const hasResults = !!(extracted && validation);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">📄 Document Upload &amp; Extraction</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Upload PDF, Excel, or CSV invoices to extract structured data with AI-powered validation</p>
      </div>

      {/* Supported Formats Banner */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: '📄', name: 'PDF', desc: 'Tax invoices, bills', acc: '~85%', color: 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800' },
          { icon: '📊', name: 'Excel (.xlsx)', desc: 'Spreadsheets, reports', acc: '~98%', color: 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800' },
          { icon: '📋', name: 'CSV', desc: 'Comma-separated data', acc: '~95%', color: 'border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800' },
        ].map(f => (
          <div key={f.name} className={`border rounded-xl p-3 text-center ${f.color}`}>
            <span className="text-2xl">{f.icon}</span>
            <p className="font-semibold text-slate-800 dark:text-white text-sm mt-1">{f.name}</p>
            <p className="text-xs text-slate-500">{f.desc}</p>
            <p className="text-xs font-bold text-emerald-600 mt-1">Accuracy: {f.acc}</p>
          </div>
        ))}
      </div>

      {/* Upload Area */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          {(['upload', 'paste'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); reset(); }}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${tab === t
                ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/10'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              {t === 'upload' ? '📁 Upload Document' : '📝 Paste Text'}
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
            🤖 AI
          </button>
        </div>
        {mode === 'ai' && (
          <div className="px-5 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
            <label className="text-[10px] font-bold text-slate-400 uppercase mr-2">Provider</label>
            <select value={provider} onChange={e => setProvider(e.target.value as any)} className="text-xs border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-white">
              <option value="ollama">Ollama</option>
              <option value="gemini">Gemini</option>
              <option value="azure">Azure OpenAI</option>
            </select>
          </div>
        )}

        <div className="p-5">
          {tab === 'upload' ? (
            <>
              <div onDrop={handleDrop} onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                  file ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}>
                <input ref={fileRef} type="file" accept=".pdf,.csv,.tsv,.txt,.xlsx,.xls" onChange={e => handleFiles(e.target.files)} className="hidden" />

                {file ? (
                  <div>
                    <span className={`text-6xl ${getFileInfo(file).color}`}>{getFileInfo(file).icon}</span>
                    <p className="mt-3 font-semibold text-lg text-slate-800 dark:text-white">{file.name}</p>
                    <div className="flex items-center justify-center gap-3 mt-2 text-sm text-slate-500">
                      <span>{(file.size / 1024).toFixed(1)} KB</span>
                      <span>•</span>
                      <span className={`font-medium ${getFileInfo(file).color}`}>{getFileInfo(file).label}</span>
                    </div>
                    <button onClick={e => { e.stopPropagation(); reset(); }}
                      className="mt-3 text-xs text-red-500 hover:text-red-700 underline">Remove file</button>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-center gap-3 text-5xl">
                      <span>📄</span><span>📊</span><span>📋</span>
                    </div>
                    <p className="mt-4 text-slate-700 dark:text-slate-300 font-medium">Drag &amp; drop your document here</p>
                    <p className="text-slate-400 text-sm mt-1">or <span className="text-emerald-600 font-medium">browse files</span></p>
                    <p className="text-xs text-slate-400 mt-3">Accepted: PDF, Excel (.xlsx/.xls), CSV, TXT</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <textarea value={textInput} onChange={e => setTextInput(e.target.value)} rows={12}
              placeholder={`Paste invoice text here...\n\nExample:\nPRO SWAMI SHARNAM ENTERPRISES\nGSTIN: 23AMFPV5397L1ZB\nInvoice No: PSSE/26-27/15792\nDate: 18 Jul 2026\nBill To: Shri Sai Kirana\n\n1  FE089200180756601D  Swami Ghee  0405  24  180  165.00  3960.00  99.00  99.00  4158.00\n\nGrand Total: 13303.00`}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-white font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
          )}

          {/* Extract Button */}
          <div className="mt-4 flex gap-3">
            <button onClick={handleExtract}
              disabled={extracting || (tab === 'upload' ? !file : !textInput.trim())}
              className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base">
              {extracting ? (
                <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Extracting...</>
              ) : (
                <>{mode === 'ai' ? '🤖 AI Extract' : '⚡ Extract Data'}</>
              )}
            </button>
            {extracting && (
              <button onClick={() => abortRef.current?.abort()}
                className="px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium">✕ Cancel</button>
            )}
          </div>

          {file && hasResults && !extracting && (
            <div className="mt-3 flex gap-3">
              <button onClick={() => handleDownload('csv')} disabled={downloading}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                <span>📋</span> Download CSV
              </button>
              <button onClick={() => handleDownload('copy-paste')} disabled={downloading}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                <span>📝</span> Download Copy-Paste
              </button>
            </div>
          )}

          {/* Progress */}
          {(extracting || progress === 100) && (
            <div className="mt-3">
              <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                  style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-slate-500 text-center mt-1">
                {progress === 100 ? '✅ Extraction complete' : `${progress}% — Processing...`}
              </p>
            </div>
          )}

          {error && <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 rounded-lg text-sm">{error}</div>}
        </div>
      </div>

      {/* ─── Results ─── */}
      {hasResults && (
        <>
          {/* Validation */}
          {validation && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 dark:text-white text-lg">✅ Validation Results</h3>
                <div className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                  validation.score >= 75 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : validation.score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                  {validation.score}% Score
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center mb-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg"><p className="text-2xl font-bold text-emerald-600">{validation.passed.length}</p><p className="text-xs font-semibold text-emerald-700">PASSED</p></div>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg"><p className="text-2xl font-bold text-amber-600">{validation.warnings.length}</p><p className="text-xs font-semibold text-amber-700">WARNINGS</p></div>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg"><p className="text-2xl font-bold text-red-600">{validation.errors.length}</p><p className="text-xs font-semibold text-red-700">ERRORS</p></div>
              </div>
              <div className="space-y-1 text-sm max-h-52 overflow-y-auto">
                {validation.passed.map((m, i) => <div key={`p${i}`} className="flex gap-2 text-emerald-700 dark:text-emerald-400"><span className="flex-shrink-0">✅</span><span>{m}</span></div>)}
                {validation.warnings.map((m, i) => <div key={`w${i}`} className="flex gap-2 text-amber-600 dark:text-amber-400"><span className="flex-shrink-0">⚠️</span><span>{m}</span></div>)}
                {validation.errors.map((m, i) => <div key={`e${i}`} className="flex gap-2 text-red-600 dark:text-red-400"><span className="flex-shrink-0">❌</span><span>{m}</span></div>)}
              </div>
            </div>
          )}

          {/* Recommendation */}
          {recommendation && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-800 dark:text-white mb-2">📊 Format Analysis</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">{recommendation.reason}</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-500">
                {recommendation.tips.map((t, i) => <li key={i}>💡 {t}</li>)}
              </ul>
            </div>
          )}

          {/* Extracted Data */}
          {extracted && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 dark:text-white text-lg">📋 Extracted Data</h3>
                {extracted.metadata && (
                  <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full text-xs text-slate-500">
                    {extracted.metadata.fileType.toUpperCase()} • {extracted.metadata.extractionConfidence}% confidence
                  </span>
                )}
              </div>

              <div className="p-5 space-y-6">
                {/* Seller & Buyer */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {extracted.seller && (extracted.seller.name || extracted.seller.gstin) && (
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">🏭 Seller</h4>
                      {extracted.seller.name && <p className="font-semibold text-slate-800 dark:text-white">{extracted.seller.name}</p>}
                      {extracted.seller.address && <p className="text-sm text-slate-500 mt-1">{extracted.seller.address}</p>}
                      <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                        {extracted.seller.gstin && <p>GSTIN: <span className="font-mono font-medium text-emerald-600">{extracted.seller.gstin}</span></p>}
                        {extracted.seller.pan && <p>PAN: <span className="font-mono">{extracted.seller.pan}</span></p>}
                        {extracted.seller.fssai && <p>FSSAI: <span className="font-mono">{extracted.seller.fssai}</span></p>}
                        {extracted.seller.phone && <p>📞 {extracted.seller.phone}</p>}
                      </div>
                    </div>
                  )}
                  {extracted.buyer && (extracted.buyer.name || extracted.buyer.phone) && (
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">👤 Buyer / Customer</h4>
                      {editingCustomer ? (
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={customerNameInput}
                            onChange={(e) => setCustomerNameInput(e.target.value)}
                            onBlur={() => {
                              if (!extracted) return;
                              setExtracted({
                                ...extracted,
                                buyer: { ...(extracted.buyer || { name: '', phone: '', address: '' }), name: customerNameInput } as Buyer
                              });
                              setEditingCustomer(false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (!extracted) return;
                                setExtracted({
                                  ...extracted,
                                  buyer: { ...(extracted.buyer || { name: '', phone: '', address: '' }), name: customerNameInput } as Buyer
                                });
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
                          className="flex items-center gap-2 cursor-pointer group mb-2"
                          onClick={() => {
                            const currentName = extracted?.buyer?.name || '';
                            setCustomerNameInput(currentName);
                            setEditingCustomer(true);
                          }}
                        >
                          <p className={`font-semibold flex-1 ${!extracted?.buyer?.name ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                            {extracted?.buyer?.name || 'Not detected — tap to edit'}
                          </p>
                          <span className="text-xs text-slate-400 group-hover:text-emerald-500 transition-colors">✏️</span>
                        </div>
                      )}
                      {extracted.buyer.address && <p className="text-sm text-slate-500 mt-1">{extracted.buyer.address}</p>}
                      {extracted.buyer.phone && <p className="text-sm mt-2">📞 {extracted.buyer.phone}</p>}
                    </div>
                  )}
                </div>

                {/* Invoice Meta */}
                {extracted.invoice && (extracted.invoice.number || extracted.invoice.date) && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">🧾 Invoice Details</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Invoice #', val: extracted.invoice.number },
                        { label: 'Date', val: extracted.invoice.date },
                        { label: 'Salesman', val: extracted.invoice.salesman },
                        { label: 'Beat', val: extracted.invoice.beat },
                      ].filter(x => x.val).map((x, i) => (
                        <div key={i} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                          <p className="text-xs text-slate-400">{x.label}</p>
                          <p className="font-medium text-slate-800 dark:text-white text-sm mt-0.5">{x.val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Line Items */}
                {extracted.items && extracted.items.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">📦 Line Items ({extracted.items.length})</h4>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-700 text-xs uppercase text-slate-500">
                            <th className="px-3 py-2 text-left">#</th>
                            <th className="px-3 py-2 text-left">ERP ID</th>
                            <th className="px-3 py-2 text-left">Description</th>
                            <th className="px-3 py-2 text-center">HSN</th>
                            <th className="px-3 py-2 text-right">Qty</th>
                            <th className="px-3 py-2 text-right">Rate</th>
                            <th className="px-3 py-2 text-right">Taxable</th>
                            <th className="px-3 py-2 text-right">GST</th>
                            <th className="px-3 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {extracted.items.map((item, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                              <td className="px-3 py-2 text-slate-400">{item.sno}</td>
                              <td className="px-3 py-2 font-mono text-xs text-emerald-600">{item.erpId || '—'}</td>
                              <td className="px-3 py-2 text-slate-800 dark:text-white">{item.description || '—'}</td>
                              <td className="px-3 py-2 text-center font-mono text-xs text-slate-400">{item.hsn || '—'}</td>
                              <td className="px-3 py-2 text-right font-medium">{item.quantity || '—'}</td>
                              <td className="px-3 py-2 text-right">{item.rate ? INR(item.rate) : '—'}</td>
                              <td className="px-3 py-2 text-right">{item.taxable ? INR(item.taxable) : '—'}</td>
                              <td className="px-3 py-2 text-right text-amber-600">{item.gst ? INR(item.gst) : '—'}</td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-white">{item.total ? INR(item.total) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Totals */}
                {extracted.totals && extracted.totals.grandTotal > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">💰 Totals</h4>
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        {[
                          { label: 'Total Qty', val: extracted.totals.totalQty ? String(extracted.totals.totalQty) : null },
                          { label: 'Taxable Amount', val: extracted.totals.taxableAmount ? INR(extracted.totals.taxableAmount) : null },
                          { label: 'CGST', val: extracted.totals.cgst ? INR(extracted.totals.cgst) : null },
                          { label: 'SGST', val: extracted.totals.sgst ? INR(extracted.totals.sgst) : null },
                          { label: 'Total GST', val: extracted.totals.totalGst ? INR(extracted.totals.totalGst) : null },
                          { label: 'Discount', val: extracted.totals.discount ? INR(extracted.totals.discount) : null },
                          { label: 'Round Off', val: extracted.totals.roundOff ? INR(extracted.totals.roundOff) : null },
                        ].filter(x => x.val).map((x, i) => (
                          <div key={i}>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">{x.label}</p>
                            <p className="font-semibold text-emerald-800 dark:text-emerald-300">{x.val}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-700 flex items-center justify-between">
                        <span className="text-lg font-bold text-emerald-800 dark:text-emerald-300">Grand Total</span>
                        <span className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{INR(extracted.totals.grandTotal)}</span>
                      </div>
                      {extracted.totals.amountInWords && (
                        <p className="mt-2 text-xs italic text-emerald-600 dark:text-emerald-400">{extracted.totals.amountInWords}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button onClick={handleImport} disabled={importing} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                    {importing ? (
                      <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importing...</>
                    ) : (
                      <>📥 Import as Order</>
                    )}
                  </button>
                  <button onClick={reset} className="px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-700">
                    🔄 New Upload
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
