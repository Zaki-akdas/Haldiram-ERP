'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';

type InputType = 'pdf' | 'excel' | 'csv';
type OutputType = 'csv' | 'copy-paste';
type Mode = 'fast' | 'ai';

export default function ConvertPage() {
  const { authFetch } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [inputType, setInputType] = useState<InputType>('pdf');
  const [outputType, setOutputType] = useState<OutputType>('csv');
  const [mode, setMode] = useState<Mode>('fast');
  const [converting, setConverting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null); setPreview(null); setError(''); setProgress(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      if (!['pdf', 'xlsx', 'xls', 'csv'].includes(ext)) {
        setError('Unsupported file type. Please upload PDF, Excel, or CSV.');
        return;
      }
      setFile(f);
      setInputType(ext as InputType);
      setError('');
      setPreview(null);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFileChange({ target: { files: [f] } } as any);
  }, []);

  const handleConvert = async () => {
    if (!file) return;

    setConverting(true);
    setProgress(0);
    setError('');
    setPreview(null);

    const tick = setInterval(() => setProgress(p => Math.min(p + 10, 90)), 150);

    try {
      if (mode === 'ai') {
        // AI mode: extract structured data then format as CSV/copy-paste
        const fd = new FormData();
        fd.append('file', file);
        
        const token = typeof window !== 'undefined' ? localStorage.getItem('salessettle_token') : null;
        const res = await fetch('/api/ai/extract', {
          method: 'POST',
          body: fd,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'AI extraction failed' }));
          throw new Error(err.error || 'AI extraction failed');
        }

        const data = await res.json();
        const extracted = data.extracted;

        if (outputType === 'csv') {
          // Convert extracted data to CSV
          const headers = ['S.No', 'Item Name', 'HSN/SAC', 'Qty', 'Unit', 'Rate', 'Taxable', 'GST Rate', 'CGST', 'SGST', 'GST Amount', 'Total'];
          const rows = extracted.items?.map((item: any, i: number) => [
            i + 1,
            `"${(item.description || '').replace(/"/g, '""')}"`,
            item.hsn || '',
            item.quantity || 0,
            item.unit || 'PCS',
            item.rate || 0,
            item.taxable || 0,
            item.gstRate || 0,
            item.cgst || 0,
            item.sgst || 0,
            item.gst || 0,
            item.total || 0,
          ]) || [];

          // Add totals row
          if (extracted.totals) {
            rows.push([
              '', 'TOTAL', '', extracted.totals.totalQty || 0, '', '', 
              extracted.totals.taxableAmount || 0, '', '', '', 
              extracted.totals.totalGst || 0, extracted.totals.grandTotal || 0
            ]);
          }

          const csv = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
          setPreview(csv);
        } else {
          // Copy-paste format
          let text = `# Converted from: ${file.name}\n`;
          text += `# Date: ${new Date().toLocaleDateString('en-IN')}\n\n`;
          
          if (extracted.seller) {
            text += `## Seller\n`;
            if (extracted.seller.name) text += `Company: ${extracted.seller.name}\n`;
            if (extracted.seller.gstin) text += `GSTIN: ${extracted.seller.gstin}\n`;
            if (extracted.seller.phone) text += `Phone: ${extracted.seller.phone}\n`;
            if (extracted.seller.address) text += `Address: ${extracted.seller.address}\n`;
            text += '\n';
          }

          if (extracted.buyer) {
            text += `## Customer\n`;
            if (extracted.buyer.name) text += `Name: ${extracted.buyer.name}\n`;
            if (extracted.buyer.phone) text += `Phone: ${extracted.buyer.phone}\n`;
            if (extracted.buyer.address) text += `Address: ${extracted.buyer.address}\n`;
            text += '\n';
          }

          if (extracted.items?.length) {
            text += `## Items\n`;
            text += `# | Item Name | HSN/SAC | Qty | Unit | Rate | GST | Total\n`;
            text += `|---|-----------|---------|-----|------|------|-----|------|\n`;
            extracted.items.forEach((item: any, i: number) => {
              text += `| ${i + 1} | ${item.description || ''} | ${item.hsn || ''} | ${item.quantity || 0} | ${item.unit || 'PCS'} | ${item.rate || 0} | ${item.gst || 0} | ${item.total || 0} |\n`;
            });
            text += '\n';
          }

          if (extracted.totals) {
            text += `## Totals\n`;
            text += `Subtotal: ${extracted.totals.taxableAmount || 0}\n`;
            text += `GST: ${extracted.totals.totalGst || 0}\n`;
            text += `Grand Total: ${extracted.totals.grandTotal || 0}\n`;
          }

          setPreview(text);
        }
      } else {
        // Fast mode: direct conversion using existing API
        const fd = new FormData();
        fd.append('file', file);
        fd.append('targetFormat', outputType);

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

        const text = await res.text();
        setPreview(text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      clearInterval(tick);
      setConverting(false);
      setProgress(100);
    }
  };

  const handleDownload = () => {
    if (!preview) return;
    const blob = new Blob([preview], { type: outputType === 'csv' ? 'text/csv' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file ? `${file.name.replace(/\.[^/.]+$/, '')}_converted.${outputType === 'csv' ? 'csv' : 'txt'}` : 'converted.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!preview) return;
    navigator.clipboard.writeText(preview).then(() => {
      alert('Copied to clipboard!');
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">🔄 File Converter</h1>
        <p className="text-slate-500 dark:text-slate-400">Convert PDF, Excel, or CSV to structured CSV or Copy-Paste format</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-5 space-y-5">
          {/* File Upload */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              file ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div>
                <span className="text-5xl mb-3 block">
                  {file.name.match(/\.(xlsx|xls|csv)$/i) ? '📊' : '📄'}
                </span>
                <p className="font-bold text-lg text-slate-800 dark:text-white">{file.name}</p>
                <p className="text-sm text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                <button onClick={e => { e.stopPropagation(); reset(); }} className="mt-3 text-xs text-red-500 hover:underline font-bold">
                  Remove file
                </button>
              </div>
            ) : (
              <div>
                <div className="flex justify-center gap-4 text-5xl mb-3">
                  <span>📄</span><span>📊</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 font-bold">Drag & drop your file here</p>
                <p className="text-slate-400 text-sm mt-1">Supports PDF, Excel (.xlsx/.xls), CSV</p>
              </div>
            )}
          </div>

          {/* Mode & Output Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mode</label>
              <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setMode('fast')}
                  className={`flex-1 py-2 text-sm font-bold transition-colors ${
                    mode === 'fast' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  ⚡ Fast
                </button>
                <button
                  onClick={() => setMode('ai')}
                  className={`flex-1 py-2 text-sm font-bold transition-colors ${
                    mode === 'ai' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  🤖 AI (Ollama)
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Output Format</label>
              <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setOutputType('csv')}
                  className={`flex-1 py-2 text-sm font-bold transition-colors ${
                    outputType === 'csv' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  📋 CSV
                </button>
                <button
                  onClick={() => setOutputType('copy-paste')}
                  className={`flex-1 py-2 text-sm font-bold transition-colors ${
                    outputType === 'copy-paste' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  📝 Copy-Paste
                </button>
              </div>
            </div>
          </div>

          {/* Convert Button */}
          <button
            onClick={handleConvert}
            disabled={!file || converting}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {converting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Converting...
              </>
            ) : (
              <>
                {mode === 'ai' ? '🤖' : '⚡'} Convert to {outputType === 'csv' ? 'CSV' : 'Copy-Paste'}
              </>
            )}
          </button>

          {/* Progress */}
          {converting && (
            <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 rounded-lg text-sm font-medium text-center">
              {error}
            </div>
          )}

          {/* Preview & Actions */}
          {preview && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Preview</h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
                  >
                    📋 Copy
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
                  >
                    ⬇ Download
                  </button>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700 overflow-x-auto">
                <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono">
                  {preview}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900 rounded-xl p-4">
        <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
          <span>ℹ️</span> How it works
        </h4>
        <ul className="mt-2 space-y-1 text-xs text-blue-700 dark:text-blue-400">
          <li><strong>Fast mode:</strong> Direct file parsing — instant results for clean PDFs and Excel files.</li>
          <li><strong>AI mode:</strong> Uses local Ollama model to intelligently extract and structure data from messy invoices.</li>
          <li><strong>Copy-Paste format:</strong> Optimized for directly pasting into WhatsApp, Excel, or email.</li>
        </ul>
      </div>
    </div>
  );
}
