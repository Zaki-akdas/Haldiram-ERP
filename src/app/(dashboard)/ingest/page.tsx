'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { matchItemsToCatalog, suggestCatalogProducts, enrichItemFromCatalog } from '@/lib/product-match';

type DeploymentMode = 'cloud' | 'local';
type AIProvider = 'gemini' | 'azure' | 'bazaarlink' | 'ollama';

interface IngestItem {
  srNo?: number;
  erpId?: string;
  productName: string;
  hsnCode?: string;
  mrp?: number;
  unit?: string;
  cases?: number;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxableAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  /** Catalog product the user linked manually. */
  productId?: number | null;
  /** True when the user (or the source bill) stated the GST rate explicitly. */
  gstRateExplicit?: boolean;
  /** True when the user (or the source bill) stated the unit explicitly. */
  unitExplicit?: boolean;
}

interface CatalogProduct {
  id: number;
  erpId: string;
  name: string;
  hsnCode?: string;
  gstRate: number;
  unit: string;
}

interface IngestHeader {
  invoiceNumber?: string;
  invoiceDate?: string;
  sellerName?: string;
  sellerGSTIN?: string;
  customerName?: string;
  customerGSTIN?: string;
  customerAddress?: string;
  subtotal?: number;
  taxableAmount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalGst?: number;
  grandTotal?: number;
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

interface OrderHeaderFields {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerGSTIN: string;
  notes: string;
  creditDays: number;
}

function CatalogLinkControl({
  item,
  catalog,
  exactMatchId,
  catalogLoading,
  onLink,
  onUnlink,
}: {
  item: IngestItem;
  catalog: CatalogProduct[];
  exactMatchId: number | null;
  catalogLoading: boolean;
  onLink: (product: CatalogProduct) => void;
  onUnlink: () => void;
}) {
  const productById = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const linked = item.productId != null ? productById.get(item.productId) : undefined;
  if (linked) {
    return (
      <div className="mt-1 flex items-center gap-1.5 text-xs">
        <span className="text-sky-500">→ {linked.name} · {linked.erpId || `#${linked.id}`}</span>
        <button
          type="button"
          onClick={onUnlink}
          className="text-gray-400 hover:text-red-500 transition-colors"
          title="Unlink product"
        >✕</button>
      </div>
    );
  }
  const auto = exactMatchId != null ? productById.get(exactMatchId) : undefined;
  if (auto) {
    return (
      <div className="mt-1 text-xs text-emerald-500">
        auto-linked: {auto.name} · {auto.erpId || `#${auto.id}`}
      </div>
    );
  }
  const suggestions = suggestCatalogProducts(item, catalog, 5);
  return (
    <div className="mt-1">
      <select
        className="input-field w-full text-xs py-1"
        value=""
        disabled={catalogLoading}
        onChange={(e) => {
          const product = productById.get(Number(e.target.value));
          if (product) onLink(product);
        }}
      >
        <option value="">{catalogLoading ? 'Loading catalog…' : '— Link catalog product —'}</option>
        {suggestions.map((p) => (
          <option key={p.id} value={p.id}>{p.name} · {p.erpId || `#${p.id}`}</option>
        ))}
        {suggestions.length === 0 && !catalogLoading && (
          <option value="" disabled>No matching products</option>
        )}
      </select>
    </div>
  );
}

export default function IngestPage() {
  const { authFetch } = useAuth();
  const router = useRouter();
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
  const [headerFields, setHeaderFields] = useState<OrderHeaderFields>({
    invoiceNumber: '',
    invoiceDate: '',
    customerName: '',
    customerGSTIN: '',
    notes: '',
    creditDays: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // Load the product catalog once so the review table can suggest manual
  // links for items the automatic matcher could not resolve.
  useEffect(() => {
    let mounted = true;
    authFetch('/api/products?limit=1000')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted) return;
        const rows = ((data?.products || []) as Record<string, unknown>[]);
        setCatalog(rows.map((p) => ({
          id: Number(p.id),
          erpId: String(p.erpId ?? ''),
          name: String(p.name ?? ''),
          hsnCode: p.hsnCode ? String(p.hsnCode) : undefined,
          gstRate: Number(p.gstRate) || 0,
          unit: String(p.unit || 'PCS'),
        })));
      })
      .catch(() => { /* catalog is optional — the order still works without it */ })
      .finally(() => { if (mounted) setCatalogLoading(false); });
    return () => { mounted = false; };
  }, [authFetch]);

  // Server-equivalent automatic match (ERP ID, then name) per current row.
  const exactMatchIds = useMemo(
    () => (catalog.length > 0 ? matchItemsToCatalog(editableItems, catalog) : []),
    [editableItems, catalog]
  );

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

  const processIngestion = async () => {
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

      const res = await authFetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data.result);
        setEditableItems(data.result.items);
        setValidation(data.validation);
        setHeaderFields({
          invoiceNumber: data.result.header?.invoiceNumber || '',
          invoiceDate: data.result.header?.invoiceDate || '',
          customerName: data.result.header?.customerName || '',
          customerGSTIN: data.result.header?.customerGSTIN || '',
          notes: '',
          creditDays: 0,
        });
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
    if (!result || editableItems.length === 0) return;
    setLoading(true);
    setNotification('');

    try {
      // Recompute header totals from the confirmed (edited) items so the order
      // matches exactly what the user reviewed on screen.
      const subtotal = editableItems.reduce((sum, i) => sum + (i.quantity || 0) * (i.unitPrice || 0), 0);
      const taxableAmount = editableItems.reduce((sum, i) => sum + (i.taxableAmount || 0), 0);
      const totalGst = editableItems.reduce((sum, i) => sum + (i.gstAmount || 0), 0);
      const grandTotal = editableItems.reduce((sum, i) => sum + (i.totalAmount || 0), 0);

      const review = {
        ...result,
        items: editableItems,
        header: {
          ...result.header,
          invoiceNumber: headerFields.invoiceNumber || result.header?.invoiceNumber,
          invoiceDate: headerFields.invoiceDate || result.header?.invoiceDate,
          customerName: headerFields.customerName || result.header?.customerName,
          customerGSTIN: headerFields.customerGSTIN || result.header?.customerGSTIN,
          subtotal,
          taxableAmount,
          cgst: totalGst / 2,
          sgst: totalGst / 2,
          totalGst,
          grandTotal,
        },
      };

      const formData = new FormData();
      formData.append('review', JSON.stringify(review));
      formData.append('deploymentMode', mode);
      formData.append('preferredProvider', preferredProvider);
      formData.append('createOrder', 'true');
      formData.append('orderData', JSON.stringify({
        customerName: headerFields.customerName || undefined,
        customerGSTIN: headerFields.customerGSTIN || undefined,
        notes: headerFields.notes || undefined,
        creditDays: Number(headerFields.creditDays) || 0,
      }));

      const res = await authFetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        if (data.orderId) {
          setOrderId(data.orderId);
          showNotification(`Order #${data.orderId} created from the bill`);
          // Show the created order right away.
          router.push(`/orders/${data.orderId}`);
        } else {
          showNotification(data.orderCreationSkipped || 'Order was not created');
        }
      } else {
        showNotification(data.error || 'Order creation failed');
      }
    } catch (err) {
      console.error(err);
      showNotification('Order creation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateItem = <K extends keyof IngestItem>(index: number, field: K, value: IngestItem[K]) => {
    const updated = [...editableItems];
    updated[index] = { ...updated[index], [field]: value };
    // A user-typed GST rate / unit is authoritative: catalog enrichment must
    // not overwrite it when the order is created.
    if (field === 'gstRate') updated[index].gstRateExplicit = true;
    if (field === 'unit') updated[index].unitExplicit = true;
    setEditableItems(updated);
  };

  const linkProduct = (index: number, product: CatalogProduct) => {
    const updated = [...editableItems];
    const item = { ...updated[index], productId: product.id };
    // Apply the catalog's GST rate / unit now (when the bill didn't state
    // them) so the row shows the exact values that will be stored.
    const enriched = enrichItemFromCatalog(item, product);
    if (!item.gstRateExplicit) {
      item.gstRate = enriched.gstRate;
      item.gstAmount = enriched.gstAmount;
      item.totalAmount = enriched.totalAmount;
      item.gstRateExplicit = true;
    }
    if (!item.unitExplicit) {
      item.unit = enriched.unit;
      item.unitExplicit = true;
    }
    updated[index] = item;
    setEditableItems(updated);
  };

  const unlinkProduct = (index: number) => {
    const updated = [...editableItems];
    updated[index] = { ...updated[index], productId: null };
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
      gstRateExplicit: true,
      unitExplicit: true,
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
                onClick={() => processIngestion()}
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

              {/* Order Details (header) */}
              <div className="glass-card p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">Order Details</h3>
                  <span className="text-xs text-gray-500">These fields are saved with the order — correct them if the extraction missed something.</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice Number</label>
                    <input
                      type="text"
                      className="input-field w-full text-sm"
                      value={headerFields.invoiceNumber}
                      onChange={(e) => setHeaderFields({ ...headerFields, invoiceNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice Date</label>
                    <input
                      type="date"
                      className="input-field w-full text-sm"
                      value={headerFields.invoiceDate}
                      onChange={(e) => setHeaderFields({ ...headerFields, invoiceDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer Name</label>
                    <input
                      type="text"
                      className="input-field w-full text-sm"
                      placeholder="Customer name"
                      value={headerFields.customerName}
                      onChange={(e) => setHeaderFields({ ...headerFields, customerName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer GSTIN</label>
                    <input
                      type="text"
                      className="input-field w-full text-sm"
                      placeholder="Customer GSTIN"
                      value={headerFields.customerGSTIN}
                      onChange={(e) => setHeaderFields({ ...headerFields, customerGSTIN: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Credit Days</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field w-full text-sm"
                      value={headerFields.creditDays}
                      onChange={(e) => setHeaderFields({ ...headerFields, creditDays: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</label>
                    <input
                      type="text"
                      className="input-field w-full text-sm"
                      placeholder="Optional notes"
                      value={headerFields.notes}
                      onChange={(e) => setHeaderFields({ ...headerFields, notes: e.target.value })}
                    />
                  </div>
                </div>
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
                          <th className="text-left py-2 px-2">ERP ID</th>
                          <th className="text-left py-2 px-2">HSN</th>
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
                              <CatalogLinkControl
                                item={item}
                                catalog={catalog}
                                exactMatchId={exactMatchIds[idx] ?? null}
                                catalogLoading={catalogLoading}
                                onLink={(product) => linkProduct(idx, product)}
                                onUnlink={() => unlinkProduct(idx)}
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                className="input-field w-20 text-sm"
                                placeholder="ERP ID"
                                value={item.erpId || ''}
                                onChange={(e) => updateItem(idx, 'erpId', e.target.value)}
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                className="input-field w-20 text-sm"
                                placeholder="HSN"
                                value={item.hsnCode || ''}
                                onChange={(e) => updateItem(idx, 'hsnCode', e.target.value)}
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
                          <td colSpan={5} className="py-2 px-2 text-right font-bold">Totals:</td>
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
                      disabled={loading || editableItems.length === 0}
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
                        setHeaderFields({ invoiceNumber: '', invoiceDate: '', customerName: '', customerGSTIN: '', notes: '', creditDays: 0 });
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    The order is created from the reviewed items above (your edits are applied, not the raw parse).
                    The server re-validates the data and explains below if it falls below the 60% threshold.
                  </p>
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
