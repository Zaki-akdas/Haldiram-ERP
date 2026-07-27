'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import DenominationCalculator from '@/components/DenominationCalculator';

interface OrderDetail {
  id: number;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  salespersonName: string;
  orderDate: string;
  deliveryDate: string | null;
  status: string;
  subtotal: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  grandTotal: number;
  amountPaid: number;
  balance: number;
  settlementStatus: string;
  beat: string | null;
  notes: string | null;
}

interface OrderItem {
  id: number;
  productName: string;
  erpId: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxableAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
}

interface Settlement {
  id: number;
  amount: number;
  paymentMode: string;
  referenceNumber: string | null;
  settledAt: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OrderDetailPage() {
  const { user, authFetch } = useAuth();
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettlement, setShowSettlement] = useState(false);
  const [settlementData, setSettlementData] = useState({
    amount: '',
    paymentMode: 'cash',
    referenceNumber: '',
    notes: '',
    clearingDays: '0', // New
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchOrder() {
      try {
        const res = await authFetch(`/api/orders/${params.id}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setOrder(data.order);
        setItems(data.items);
        setSettlements(data.settlements);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const [denominationCounts, setDenominationCounts] = useState<Record<string, number>>({});
  const [cashTotal, setCashTotal] = useState(0);

  const handleSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    
    setSubmitting(true);
    try {
      const amount = parseFloat(settlementData.amount);
      const isSplit = settlementData.paymentMode === 'split';
      
      const payload = {
        orderId: order.id,
        amount: amount,
        paymentMode: settlementData.paymentMode,
        cashAmount: isSplit ? cashTotal : (settlementData.paymentMode === 'cash' ? amount : 0),
        onlineAmount: isSplit ? (amount - cashTotal) : (settlementData.paymentMode === 'online' ? amount : 0),
        denominations: settlementData.paymentMode === 'cash' || isSplit ? denominationCounts : null,
        referenceNumber: settlementData.referenceNumber || null,
        notes: settlementData.notes || null,
      };

      const res = await authFetch('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        setShowSettlement(false);
        setSettlementData({ amount: '', paymentMode: 'cash', referenceNumber: '', notes: '', clearingDays: '0' });
        setCashTotal(0);
        setDenominationCounts({});
        // Refresh order data
        const refreshRes = await authFetch(`/api/orders/${params.id}`);
        const refreshData = await refreshRes.json();
        setOrder(refreshData.order);
        setSettlements(refreshData.settlements);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!order) return;
    
    try {
      await authFetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          ...(newStatus === 'delivered' ? { deliveryDate: new Date().toISOString() } : {}),
        }),
      });
      
      setOrder({ ...order, status: newStatus });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Order not found</p>
        <Link href="/orders" className="text-emerald-600 hover:underline">Back to orders</Link>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-blue-100 text-blue-700',
    delivered: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/orders" className="text-sm text-slate-500 hover:text-emerald-600">← Back to orders</Link>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{order.invoiceNumber}</h1>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[order.status]}`}>
          {order.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Info */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Customer</p>
                <p className="font-medium text-slate-800 dark:text-white">{order.customerName}</p>
                {order.customerPhone && <p className="text-sm text-slate-500">📞 {order.customerPhone}</p>}
              </div>
              <div>
                <p className="text-xs text-slate-500">Order Date</p>
                <p className="font-medium text-slate-800 dark:text-white">{formatDate(order.orderDate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Salesperson</p>
                <p className="font-medium text-slate-800 dark:text-white">{order.salespersonName}</p>
              </div>
              {order.beat && (
                <div>
                  <p className="text-xs text-slate-500">Beat</p>
                  <p className="font-medium text-slate-800 dark:text-white">{order.beat}</p>
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-white">Order Items</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50">
                    <th className="px-4 py-2 text-left">Product</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Rate</th>
                    <th className="px-4 py-2 text-right">GST</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {items.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-2">
                        <p className="text-slate-800 dark:text-white">{item.productName}</p>
                        {item.erpId && <p className="text-xs text-slate-500 font-mono">{item.erpId}</p>}
                      </td>
                      <td className="px-4 py-2 text-right">{item.quantity} {item.unit}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-2 text-right">{item.gstRate}%</td>
                      <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Settlement History */}
          {settlements.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-semibold text-slate-800 dark:text-white">Settlement History</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {settlements.map(s => (
                  <div key={s.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{formatDate(s.settledAt)}</p>
                      <p className="text-xs text-slate-500 uppercase">{s.paymentMode}</p>
                    </div>
                    <p className="font-medium text-emerald-600">{formatCurrency(s.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Totals */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CGST</span>
                <span>{formatCurrency(order.cgst)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">SGST</span>
                <span>{formatCurrency(order.sgst)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-medium">
                <span>Grand Total</span>
                <span className="text-emerald-600">{formatCurrency(order.grandTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Paid</span>
                <span className="text-emerald-600">{formatCurrency(order.amountPaid)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Balance</span>
                <span className={order.balance > 0 ? 'text-red-600' : 'text-emerald-600'}>
                  {formatCurrency(order.balance)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <h3 className="font-semibold text-slate-800 dark:text-white">Actions</h3>
            
            {order.balance > 0 && (
              <button
                onClick={() => setShowSettlement(true)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                💰 Record Payment
              </button>
            )}
            
            {order.status === 'pending' && (
              <button
                onClick={() => updateStatus('confirmed')}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                ✅ Confirm Order
              </button>
            )}
            
            {order.status === 'confirmed' && (
              <button
                onClick={() => updateStatus('delivered')}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                🚚 Mark Delivered
              </button>
            )}

            {(user?.role === 'admin' || user?.role === 'manager') && (
              <button
                onClick={async () => {
                  if (confirm(`Delete order ${order.invoiceNumber}?`)) {
                    const res = await authFetch(`/api/orders/${order.id}`, { method: 'DELETE' });
                    if (res.ok) router.push('/orders');
                    else alert('Delete failed');
                  }
                }}
                className="w-full py-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
              >
                🗑️ Delete Order
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Settlement Modal */}
      {showSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Record Payment</h2>
              <button onClick={() => setShowSettlement(false)} className="text-slate-400">✕</button>
            </div>
            
            <form onSubmit={handleSettlement} className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Total Amount (Balance: {formatCurrency(order.balance)})
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={order.balance}
                  required
                  value={settlementData.amount}
                  onChange={(e) => setSettlementData({ ...settlementData, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white font-bold"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 font-bold">Payment Mode</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'cash', label: '💵 Cash', color: 'border-emerald-500' },
                    { id: 'online', label: '📱 Online', color: 'border-blue-500' },
                    { id: 'cheque', label: '🏦 Cheque', color: 'border-amber-600' },
                    { id: 'credit_note', label: '📝 CN', color: 'border-red-500' },
                    { id: 'split', label: '🌓 Split', color: 'border-purple-500' },
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSettlementData({ ...settlementData, paymentMode: m.id })}
                      className={`py-2 px-2 text-[10px] font-black rounded-lg border-2 transition-all ${
                        settlementData.paymentMode === m.id
                          ? `${m.color} bg-slate-50 dark:bg-slate-700`
                          : 'border-slate-200 dark:border-slate-700 text-slate-400'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {(settlementData.paymentMode === 'cheque' || settlementData.paymentMode === 'credit_note') && (
                <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100 dark:border-amber-800">
                  <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase mb-1">
                    Timing Details (Days to settle)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      required
                      value={settlementData.clearingDays}
                      onChange={(e) => setSettlementData({ ...settlementData, clearingDays: e.target.value })}
                      className="w-20 px-3 py-1.5 border border-amber-300 dark:border-amber-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-bold"
                    />
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Days from today</span>
                  </div>
                  <p className="text-[9px] text-amber-500 mt-2 italic">Expected settling date: {new Date(Date.now() + parseInt(settlementData.clearingDays || '0') * 86400000).toLocaleDateString()}</p>
                </div>
              )}

              {settlementData.paymentMode === 'split' && (
                <div className="bg-purple-50 dark:bg-purple-900/10 p-3 rounded-lg border border-purple-100 dark:border-purple-800">
                  <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase mb-2">Split Breakdown</p>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">Cash Part</p>
                      <p className="font-bold text-slate-800 dark:text-white">{formatCurrency(cashTotal)}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">Online Part</p>
                      <p className="font-bold text-slate-800 dark:text-white">{formatCurrency(parseFloat(settlementData.amount || '0') - cashTotal)}</p>
                    </div>
                  </div>
                </div>
              )}

              {(settlementData.paymentMode === 'cash' || settlementData.paymentMode === 'split') && (
                <DenominationCalculator 
                  targetAmount={settlementData.paymentMode === 'cash' ? parseFloat(settlementData.amount || '0') : undefined}
                  onTotalChange={(total, counts) => {
                    setCashTotal(total);
                    setDenominationCounts(counts);
                  }} 
                />
              )}
              
              {settlementData.paymentMode !== 'cash' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 text-xs">Ref # (UPI / Bank / Cheque No)</label>
                  <input
                    type="text"
                    value={settlementData.referenceNumber}
                    onChange={(e) => setSettlementData({ ...settlementData, referenceNumber: e.target.value })}
                    placeholder="Transaction ID / UTR / Cheque #"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 text-xs font-bold">Internal Note</label>
                <textarea
                  value={settlementData.notes}
                  onChange={(e) => setSettlementData({ ...settlementData, notes: e.target.value })}
                  placeholder="Add any specific details about this collection..."
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSettlement(false)}
                  className="flex-1 py-2 border border-slate-300 dark:border-slate-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
