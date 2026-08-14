'use client';

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';

type DeploymentMode = 'cloud' | 'local';
type AIProvider = 'gemini' | 'azure' | 'bazaarlink' | 'ollama';

interface IngestItem {
  srNo?: number;
  erpId?: string;
  productName: string;
  hsnCode?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discount?: number;
  taxableAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
}

interface IngestHeader {
  invoiceNumber?: string;
  invoiceDate?: string;
  customerName?: string;
  customerGSTIN?: string;
  grandTotal?: number;
  totalGst?: number;
}

interface IngestResult {
  format: string;
  header: IngestHeader;
  items: IngestItem[];
  confidence: number;
  warnings: string[];
  provider?: string;
  processingTimeMs: number;
}

interface ValidationResult {
  score: number;
  issues: string[];
  suggestions: string[];
  isValid: boolean;
}

export default function IngestPage() {
  const { authFetch } = useAuth();
  const [mode, setMode] = useState<DeploymentMode>('cloud');
  const [preferredProvider, setPreferredProvider] = useState<AIProvider>('gemini');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [notification, setNotification] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [editableItems, setEditableItems] = useState<IngestItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setActiveTab('upload');
    }
  }, []);

  const processIngestion = async (createOrderNow = false) => {
    setLoading(true);
    setResult(null);
    setValidation(null);
    setOrderId(null);

    try {
      const textToProcess = text;
      let fileName = 'pasted-text.txt';

      if (file && activeTab === 'upload') {
        fileName = file.name;
        // Send all files to the server-side API for parsing
        // (PDF/Excel parsing requires Node.js modules unavailable in the browser)
      }

      if (!textToProcess.trim() && !file) {
        showNotification('Please provide text or upload a file');
        setLoading(false);
        return;
      }

      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      }
      if (textToProcess.trim()) {
        formData.append('text', textToProcess);
      }
      formData.append('fileName', fileName);
      formData.append('deploymentMode', mode);
      formData.append('preferredProvider', preferredProvider);
      formData.append('createOrder', createOrderNow ? 'true' : 'false');

      const res = await authFetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data.result);
        setEditableItems(data.result.items);
        setValidation(data.validation);
        if (data.orderId) {
          setOrderId(data.orderId);
          showNotification(`Order #${data.orderId} created successfully!`);
        }
      } else {
        const err = await res.json();
        showNotification(err.error || 'Ingestion failed');
      }
    } catch (err) {
      console.error(err);
      showNotification('Ingestion failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const createOrderFromExtracted = async () => {
    if (!result) return;
    await processIngestion(true);
  };

  const updateItem = (index: number, field: keyof IngestItem, value: any) => {
    const updated = [...editableItems];
    updated[index] = { ...updated[index], [field]: value };
    setEditableItems(updated);
  };

  const addItem = () => {
    setEditableItems([...editableItems, {
      productName: '',
      quantity: 1,
      unitPrice: 0,
      taxableAmount: 0,
      gstRate: 5,
      gstAmount: 0,
      totalAmount: 0,
    }]);
  };

  const removeItem = (index: number) => {
    setEditableItems(editableItems.filter((_, i) => i !== index));
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getValidationColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">AI Data Ingestion</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Advanced AI-powered order ingestion from CSV, Excel, PDF, and unstructured text
          </p>
        </div>
        {orderId && (
          <div className="px-4 py-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-lg">
            Order #{orderId} created successfully
          </div>
        )}
      </div>

      {notification && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 transition-all">
          {notification}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Input */}
        <div className="lg:col-span-1 space-y-6">
          {/* Deployment Mode */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold mb-4">Deployment Mode</h2>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setMode('cloud')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                  mode === 'cloud'
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}
              >
                ☁️ Cloud AI
              </button>
              <button
                onClick={() => setMode('local')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                  mode === 'local'
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}
              >
                🖥️ Local AI
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {mode === 'cloud'
                ? 'Uses cloud AI providers (Gemini, Azure, BazaarLink) for highest accuracy.'
                : 'Uses locally hosted models (Ollama) for offline processing.'}
            </p>

            {mode === 'cloud' && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">Cloud Provider</label>
                <select
                  value={preferredProvider}
                  onChange={(e) => setPreferredProvider(e.target.value as AIProvider)}
                  className="input-field w-full"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="azure">Azure OpenAI</option>
                  <option value="bazaarlink">BazaarLink</option>
                </select>
              </div>
            )}

            {mode === 'local' && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">Local Provider</label>
                <select
                  value={preferredProvider}
                  onChange={(e) => setPreferredProvider(e.target.value as AIProvider)}
                  className="input-field w-full"
                >
                  <option value="ollama">Ollama (Local)</option>
                </select>
              </div>
            )}
          </div>

          {/* Input Section */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold mb-4">Input Data</h2>
            
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                  activeTab === 'upload'
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}
              >
                📁 Upload File
              </button>
              <button
                onClick={() => setActiveTab('paste')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                  activeTab === 'paste'
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}
              >
                📋 Paste Text
              </button>
            </div>

            {activeTab === 'upload' && (
              <div
                className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center hover:border-primary transition-colors cursor-pointer"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept=".csv,.tsv,.txt,.json,.pdf,.xlsx,.xls"
                />
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <h3 className="text-lg font-medium mb-1">Drag & drop files here</h3>
                <p className="text-sm text-gray-500">or click to browse</p>
                <p className="text-xs text-gray-400 mt-2">Supports CSV, TSV, JSON, PDF, Excel</p>
                {file && <p className="mt-4 font-medium text-primary">Selected: {file.name}</p>}
              </div>
            )}

            {activeTab === 'paste' && (
              <div>
                <label className="block text-sm font-medium mb-1">Paste Bill Data</label>
                <textarea
                  className="input-field w-full h-64 font-mono text-sm"
                  placeholder="Paste CSV, TSV, JSON, or unstructured invoice text here..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-4 mt-4">
              <button
                className="btn-primary flex-1 py-3"
                onClick={() => processIngestion(false)}
                disabled={loading || (!file && !text.trim())}
              >
                {loading ? 'Processing...' : 'Extract Data'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="lg:col-span-2 space-y-6">
          {result && (
            <>
              {/* Confidence & Validation */}
              <div className="glass-card p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <div>
                    <h3 className="text-xl font-bold">Extraction Result</h3>
                    <p className="text-sm text-gray-500">
                      Format: {result.format} • {result.provider || 'Regex-based'} • {result.processingTimeMs}ms
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-full border text-sm font-medium ${getConfidenceColor(result.confidence)}`}>
                      {result.confidence}% Confidence
                    </div>
                    {validation && (
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getValidationColor(validation.score)}`}
                            style={{ width: `${validation.score}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{validation.score}/100</span>
                      </div>
                    )}
                  </div>
                </div>

                {validation && validation.issues.length > 0 && (
                  <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">⚠️ Issues Detected</h4>
                    <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                      {validation.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                    {validation.suggestions.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Suggestions:</p>
                        <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                          {validation.suggestions.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {result.warnings.length > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <ul className="list-disc list-inside text-sm text-blue-700 dark:text-blue-400 space-y-1">
                      {result.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Extracted Items */}
              <div className="glass-card p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">Extracted Items</h3>
                  <button
                    onClick={addItem}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    + Add Item
                  </button>
                </div>

                {editableItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-2">Product Name</th>
                          <th className="text-right py-2 px-2">Qty</th>
                          <th className="text-right py-2 px-2">Unit Price</th>
                          <th className="text-right py-2 px-2">Taxable</th>
                          <th className="text-right py-2 px-2">GST%</th>
                          <th className="text-right py-2 px-2">GST Amt</th>
                          <th className="text-right py-2 px-2">Total</th>
                          <th className="py-2 px-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {editableItems.map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                className="input-field w-full text-sm"
                                value={item.productName}
                                onChange={(e) => updateItem(idx, 'productName', e.target.value)}
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                className="input-field w-16 text-right text-sm"
                                value={item.quantity}
                                onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                className="input-field w-20 text-right text-sm"
                                value={item.unitPrice}
                                onChange={(e) => updateItem(idx, 'unitPrice', Number(e.target.value))}
                              />
                            </td>
                            <td className="py-2 px-2 text-right">
                              ₹{(item.taxableAmount || 0).toFixed(2)}
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                className="input-field w-14 text-right text-sm"
                                value={item.gstRate}
                                onChange={(e) => updateItem(idx, 'gstRate', Number(e.target.value))}
                              />
                            </td>
                            <td className="py-2 px-2 text-right">
                              ₹{(item.gstAmount || 0).toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right font-medium">
                              ₹{(item.totalAmount || 0).toFixed(2)}
                            </td>
                            <td className="py-2 px-2">
                              <button
                                onClick={() => removeItem(idx)}
                                className="text-red-500 hover:bg-red-50 p-1 rounded-full transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                          <td colSpan={3} className="py-2 px-2 text-right font-bold">Totals:</td>
                          <td className="py-2 px-2 text-right font-bold">
                            ₹{editableItems.reduce((sum, i) => sum + (i.taxableAmount || 0), 0).toFixed(2)}
                          </td>
                          <td colSpan={2}></td>
                          <td className="py-2 px-2 text-right font-bold">
                            ₹{editableItems.reduce((sum, i) => sum + (i.gstAmount || 0), 0).toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-right font-bold">
                            ₹{editableItems.reduce((sum, i) => sum + (i.totalAmount || 0), 0).toFixed(2)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No items extracted. Upload a file or paste data to begin.
                  </div>
                )}
              </div>

              {/* Actions */}
              {result && result.items.length > 0 && (
                <div className="glass-card p-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      className="btn-primary flex-1 py-3"
                      onClick={createOrderFromExtracted}
                      disabled={loading || !validation?.isValid}
                    >
                      {loading ? 'Creating Order...' : 'Create Sales Order'}
                    </button>
                    <button
                      className="px-6 py-3 rounded-lg bg-gray-200 dark:bg-gray-700 font-medium"
                      onClick={() => {
                        setResult(null);
                        setValidation(null);
                        setOrderId(null);
                        setEditableItems([]);
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  {!validation?.isValid && (
                    <p className="text-sm text-red-500 mt-2">
                      Order creation requires a minimum validation score of 60% and at least one valid item.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {!result && (
            <div className="glass-card p-12 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">No Data Ingested Yet</h3>
              <p className="text-sm text-gray-500">
                Upload a file or paste bill data on the left to start AI-powered extraction.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
