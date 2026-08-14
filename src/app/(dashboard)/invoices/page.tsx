'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';

interface ExtractedItem {
  srNo?: number;
  erpId?: string;
  productName: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  taxableAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
}

interface UniversalResult {
  format: string;
  header: {
    invoiceNumber?: string;
    invoiceDate?: string;
    customerName?: string;
    customerGSTIN?: string;
    subtotal?: number;
    taxableAmount?: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    totalGst?: number;
    grandTotal?: number;
  };
  items: ExtractedItem[];
  confidence: number;
  warnings?: string[];
}

export default function InvoicesPage() {
  const { authFetch } = useAuth();
  const router = useRouter();

  const [inputTab, setInputTab] = useState<'paste' | 'file'>('paste');
  const [pastedText, setPastedText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'fast' | 'ai'>('fast');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<UniversalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const sampleInvoice = `Seller Firm Name: RAJSHREE SNACKS AND FOODS PRIVATE LIMITED
GSTIN: 23AAPCR5371M1ZT
Invoice/Bill Number: RS/26-27/1577
Bill/Invoice Date: 22 Jul 2026

Billed To: PRO SWAMI SHARNAM ENTERPRISES
GSTIN: 23AMFPV5397L1ZB

1 FD012600160691200D All In One MRP 5|16 GM*6.912 KG (NGP) 21069099 5.00 432 5 2160 4.0475 1,649.5488 0.00 (0) 8,247.74 5 412.38 8,660.12
2 FD092104001240001D Aloo Bhujia 400 GM*12.40 KG 21069099 109.00 31 2 62 88.7261 2,594.8209 0.00 (0) 5,189.64 5 259.48 5,449.12

Total Value: 2,73,345.00`;

  const sampleTsv = `Item Code\tItem Name\tHSN\tMRP\tQty\tRate\tTaxable\tGST %\tTotal
FD0126001\tAll In One 16GM\t21069099\t5.00\t2160\t4.0475\t8247.74\t5\t8660.12
FD0921040\tAloo Bhujia 400GM\t21069099\t109.00\t62\t88.7261\t5189.64\t5\t5449.12
FD0180003\tBoondi MRP 10\t21069099\t10.00\t432\t8.1400\t3317.41\t5\t3483.29`;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const formatCurrency = (amount: number = 0) => {
    return Number(amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  };

  const processExtraction = async () => {
    setProcessing(true);
    setError(null);
    setResult(null);
    setSuccessMsg('');

    try {
      if (inputTab === 'paste') {
        if (!pastedText.trim()) {
          throw new Error('Please paste invoice data or table text first.');
        }

        const formData = new FormData();
        formData.append('text', pastedText);
        formData.append('fileName', 'Pasted Text');
        formData.append('deploymentMode', 'cloud');

        const res = await authFetch('/api/ingest', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Extraction failed');
        setResult(data.result);
      } else {
        if (!file) throw new Error('Please select a file to upload.');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('deploymentMode', 'cloud');

        const res = await authFetch('/api/ingest', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'File extraction failed');
        setResult(data.result);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Extraction failed. Please check format.');
    } finally {
      setProcessing(false);
    }
  };

  const handleImportOrder = async () => {
    if (!result) return;
    setImporting(true);
    setError(null);

    try {
      // 1. Check or pick customer
      const custRes = await authFetch('/api/customers?limit=1');
      let customerId: number | null = null;

      if (custRes.ok) {
        const custData = await custRes.json();
        const customersList = Array.isArray(custData) ? custData : (custData.customers || []);
        if (customersList.length > 0) {
          customerId = Number(customersList[0].id);
        }
      }

      // If no customer exists in DB, create one from extracted invoice details
      if (!customerId) {
        const newCustRes = await authFetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: result.header.customerName || 'PRO SWAMI (SHARNAM ENTERPRISES)',
            gstin: result.header.customerGSTIN || '23AMFPV5397L1ZB',
            city: 'Bhopal',
            state: 'Madhya Pradesh',
            creditLimit: 500000
          })
        });
        if (newCustRes.ok) {
          const newCust = await newCustRes.json();
          customerId = Number(newCust.id);
        }
      }

      const orderPayload = {
        customerId: customerId || 1,
        invoiceNumber: result.header.invoiceNumber || `INV-${Date.now()}`,
        status: 'confirmed',
        subtotal: result.header.taxableAmount || result.header.subtotal || 0,
        taxableAmount: result.header.taxableAmount || 0,
        cgst: result.header.cgst || 0,
        sgst: result.header.sgst || 0,
        igst: result.header.igst || 0,
        totalGst: result.header.totalGst || 0,
        grandTotal: result.header.grandTotal || 0,
        items: (result.items || []).map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxableAmount: item.taxableAmount,
          gstRate: item.gstRate,
          gstAmount: item.gstAmount,
          totalAmount: item.totalAmount,
          hsnCode: item.hsnCode,
          erpId: item.erpId
        })),
        notes: `Imported from ${result.format || 'Invoice Extractor'}`
      };

      const res = await authFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      if (res.ok) {
        setSuccessMsg(`✅ Order ${orderPayload.invoiceNumber} created and saved successfully! Redirecting to orders...`);
        setTimeout(() => router.push('/orders'), 1500);
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create order');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to import as sales order');
    } finally {
      setImporting(false);
    }
  };

  const downloadCSV = () => {
    if (!result || !result.items) return;

    const headers = ['S No', 'ERP ID', 'Product Name', 'HSN Code', 'Quantity', 'Unit Price', 'Taxable Amount', 'GST Rate %', 'GST Amount', 'Total Amount'];
    const rows = result.items.map(item => [
      item.srNo || '',
      item.erpId || '',
      `"${(item.productName || '').replace(/"/g, '""')}"`,
      item.hsnCode || '',
      item.quantity || 0,
      item.unitPrice || 0,
      item.taxableAmount || 0,
      item.gstRate || 0,
      item.gstAmount || 0,
      item.totalAmount || 0
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
      link.download = `extracted_invoice_${result.header.invoiceNumber || 'data'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setPastedText('');
    setResult(null);
    setError(null);
    setSuccessMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Copy-Paste & Invoice Extractor</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Universal bill parser: Paste text directly or upload PDF/Excel/CSV invoices</p>
        </div>
        <button
          onClick={reset}
          className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Extractor
        </button>
      </div>

      {/* Input Mode Selector */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => { setInputTab('paste'); setError(null); }}
          className={`py-3 px-6 font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            inputTab === 'paste'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <span>📋</span> Copy-Paste Raw Text / TSV / CSV
        </button>
        <button
          onClick={() => { setInputTab('file'); setError(null); }}
          className={`py-3 px-6 font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            inputTab === 'file'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <span>📄</span> Upload PDF / Image File
        </button>
      </div>

      {/* TAB 1: COPY-PASTE MODE */}
      {inputTab === 'paste' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <label className="block text-sm font-medium text-gray-300">
              Paste Copy-Pasted Data (TSV from Excel, CSV, Raw Invoice text, WhatsApp format):
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPastedText(sampleInvoice)}
                className="text-xs px-3 py-1.5 rounded bg-slate-800 text-indigo-300 hover:bg-slate-700 transition-colors"
              >
                Load Sample Invoice
              </button>
              <button
                type="button"
                onClick={() => setPastedText(sampleTsv)}
                className="text-xs px-3 py-1.5 rounded bg-slate-800 text-indigo-300 hover:bg-slate-700 transition-colors"
              >
                Load Sample TSV
              </button>
            </div>
          </div>

          <textarea
            rows={9}
            className="w-full p-4 rounded-xl border border-gray-700 bg-slate-900 text-gray-100 font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Paste raw invoice text, TSV from Excel, or CSV here..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
          />

          <div className="flex justify-between items-center">
            <button
              onClick={reset}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear Text
            </button>

            <button
              onClick={processExtraction}
              disabled={processing || !pastedText.trim()}
              className="btn-primary py-2.5 px-6 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              {processing ? '⚡ Extracting...' : '⚡ Extract Invoice Data'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: FILE UPLOAD MODE */}
      {inputTab === 'file' && (
        <div className="space-y-4">
          <div
            className={`glass-card border-2 border-dashed p-8 text-center transition-all cursor-pointer relative ${
              dragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-700 hover:border-indigo-500/50'
            }`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.png,.jpg,.jpeg"
            />
            <div className="flex flex-col items-center">
              <svg className="w-12 h-12 text-indigo-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
              <h3 className="text-lg font-bold text-white mb-1">
                {file ? file.name : 'Click or Drag & Drop PDF Invoice'}
              </h3>
              <p className="text-sm text-gray-400">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Supports PDF Tax Invoices, JPG, PNG'}
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={reset}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Reset
            </button>

            <button
              onClick={processExtraction}
              disabled={processing || !file}
              className="btn-primary py-2.5 px-6 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              {processing ? 'Processing PDF...' : 'Extract PDF Invoice'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-900/30 text-red-300 border border-red-800 flex items-center gap-3">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-900/40 text-emerald-300 border border-emerald-700 font-semibold">
          {successMsg}
        </div>
      )}

      {/* EXTRACTION RESULT DISPLAY */}
      {result && (
        <div className="glass-card p-6 space-y-6 animate-fade-in">
          {/* Status & Action Bar */}
          <div className="flex justify-between items-center flex-wrap gap-4 border-b border-gray-800 pb-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {result.format || 'Extracted'}
                </span>
                <span className="text-xs text-gray-400">Confidence: {result.confidence}%</span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">Extracted Invoice Summary</h2>
            </div>

            <div className="flex gap-3">
              <button
                onClick={downloadCSV}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-200 text-sm font-semibold rounded-lg flex items-center gap-2 border border-gray-700 transition-colors"
              >
                <span>💾</span> Export CSV
              </button>
              <button
                onClick={handleImportOrder}
                disabled={importing}
                className="btn-primary py-2 px-5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/30"
              >
                {importing ? 'Importing...' : '📥 Create Sales Order'}
              </button>
            </div>
          </div>

          {/* Header Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 p-4 rounded-xl border border-gray-800">
              <p className="text-xs text-gray-400">Invoice / Bill Number</p>
              <p className="text-base font-bold text-white mt-0.5">{result.header.invoiceNumber || 'Auto-generated'}</p>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-gray-800">
              <p className="text-xs text-gray-400">Invoice Date</p>
              <p className="text-base font-bold text-white mt-0.5">{result.header.invoiceDate || 'Today'}</p>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-gray-800">
              <p className="text-xs text-gray-400">Customer (Billed To)</p>
              <p className="text-base font-bold text-white mt-0.5">{result.header.customerName || 'Selected Customer'}</p>
               {result.header.customerGSTIN && <p className="text-xs text-indigo-300 font-mono">GSTIN: {result.header.customerGSTIN}</p>}
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-gray-800">
              <p className="text-xs text-gray-400">Grand Total</p>
              <p className="text-lg font-bold text-emerald-400 mt-0.5">{formatCurrency(result.header.grandTotal)}</p>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <h3 className="text-base font-bold text-white mb-3">Line Items ({result.items?.length || 0})</h3>
            <div className="overflow-x-auto max-h-96 rounded-xl border border-gray-800">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-xs uppercase bg-slate-900 text-gray-400 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">ERP ID</th>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">HSN</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Unit Price</th>
                    <th className="px-4 py-3 text-right">Taxable</th>
                    <th className="px-4 py-3 text-right">GST %</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {result.items?.map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-400">{item.srNo || i + 1}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-indigo-300">{item.erpId || '-'}</td>
                      <td className="px-4 py-2.5 font-semibold text-white">{item.productName}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{item.hsnCode || '-'}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-white">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(item.taxableAmount)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-amber-300">{item.gstRate}%</td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-400">{formatCurrency(item.totalAmount)}</td>
                    </tr>
                  ))}
                  {(!result.items || result.items.length === 0) && (
                    <tr>
                      <td colSpan={9} className="text-center py-6 text-gray-500">
                        No line items parsed. Check raw text.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
