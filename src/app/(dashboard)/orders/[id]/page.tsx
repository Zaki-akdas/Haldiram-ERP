'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

interface OrderItemView {
  id: number;
  name: string;
  erpId: string;
  qty: number;
  shortQty: number;
  returnQty: number;
  unitPrice: number;
  discount: number;
  taxable: number;
  gstRate: number;
  gstAmt: number;
  total: number;
  productId: number | null;
  product: {
    id: number;
    erpId: string;
    name: string;
    basePrice: number;
    gstRate: number;
    unit: string;
  } | null;
  priceMismatch: boolean;
  gstMismatch: boolean;
}

interface PaymentView {
  id: number;
  date: string;
  amount: number;
  cash: number;
  online: number;
  mode: string;
  reference: string;
  notes: string;
  denominations?: { denomination: number; quantity: number }[];
}

interface OrderDetailView {
  id: number;
  customerId: number | null;
  invoiceNumber: string | null;
  status: string;
  date: string;
  customerName: string;
  customerPhone: string;
  salesperson: string;
  beat: string;
  creditDays: number;
  dueDate: string;
  items: OrderItemView[];
  summary: {
    subtotal: number;
    discount: number;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
    grandTotal: number;
  };
  financials: { paid: number; balance: number };
  payments: PaymentView[];
}

function CashDenominationInput({ amount, onChange }: { amount: number; onChange: (denoms: { denomination: number; quantity: number }[]) => void }) {
  const [denoms, setDenoms] = useState<{ denomination: number; quantity: number }[]>(
    DENOMINATIONS.map(d => ({ denomination: d, quantity: 0 }))
  );

  const updateQuantity = (denomination: number, quantity: number) => {
    const updated = denoms.map(d => d.denomination === denomination ? { ...d, quantity: Math.max(0, quantity) } : d);
    setDenoms(updated);
    onChange(updated);
  };

  const calculatedTotal = denoms.reduce((sum, d) => sum + d.denomination * d.quantity, 0);
  const isMismatch = amount > 0 && calculatedTotal !== amount;

  return (
    <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
      <p className="text-xs text-gray-400 mb-3">Cash Denominations (Optional)</p>
      <div className="grid grid-cols-1 gap-2">
        {denoms.map(d => (
          <div key={d.denomination} className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-300 w-16">₹{d.denomination}</span>
            <input
              type="number"
              min="0"
              className="input-field w-20 text-sm text-center"
              value={d.quantity}
              onChange={e => updateQuantity(d.denomination, parseInt(e.target.value) || 0)}
            />
            <span className="text-xs text-gray-500 w-16">= ₹{(d.denomination * d.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
        <span className="text-xs text-gray-400">Calculated Cash Total:</span>
        <span className={`text-sm font-bold ${isMismatch ? 'text-rose-400' : 'text-emerald-400'}`}>
          ₹{calculatedTotal.toFixed(2)}
        </span>
      </div>
      {isMismatch && (
        <p className="text-xs text-rose-400 mt-2">Cash total does not match payment amount.</p>
      )}
    </div>
  );
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { authFetch } = useAuth();
  
  const [order, setOrder] = useState<OrderDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Payment state
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [onlineAmount, setOnlineAmount] = useState<number>(0);
  const [reference, setReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [denominations, setDenominations] = useState<{ denomination: number; quantity: number }[]>([]);

  useEffect(() => {
    let mounted = true;
    const fetchOrder = async () => {
      setLoading(true);
      try {
        const res = await authFetch(`/api/orders/${id}`);
        if (!res.ok) throw new Error('Failed to fetch order');
        const json = await res.json();
        if (!mounted) return;
        const apiOrder = (json.order || {}) as Record<string, unknown>;
        const apiItems = (json.items || []) as Record<string, unknown>[];
        const apiCustomer = (json.customer || {}) as Record<string, unknown>;
        const apiSalesperson = (json.salesperson || {}) as Record<string, unknown>;
        const apiSettlements = (json.settlements || []) as Record<string, unknown>[];

        const totalPaid = apiSettlements.reduce((sum: number, s) => sum + Number(s.amount || 0), 0);
        const grandTotal = Number(apiOrder.grandTotal || 0);
        const balance = grandTotal - totalPaid;

        setOrder({
          id: Number(apiOrder.id) || 0,
          customerId: apiOrder.customerId != null ? Number(apiOrder.customerId) : null,
          invoiceNumber: apiOrder.invoiceNumber ? String(apiOrder.invoiceNumber) : null,
          status: apiOrder.status === 'confirmed' ? 'Confirmed' : apiOrder.status === 'delivered' ? 'Delivered' : apiOrder.status === 'cancelled' ? 'Cancelled' : 'Pending',
          date: apiOrder.orderDate ? new Date(String(apiOrder.orderDate)).toISOString().split('T')[0] : '',
          customerName: String(apiCustomer.name ?? 'Unknown'),
          customerPhone: String(apiCustomer.phone ?? '-'),
          salesperson: String(apiSalesperson.name ?? 'Unknown'),
          beat: String(apiOrder.beat ?? '-'),
          creditDays: Number(apiOrder.creditDays) || 0,
          dueDate: apiOrder.dueDate ? new Date(String(apiOrder.dueDate)).toISOString().split('T')[0] : '',
          items: apiItems.map((item) => {
            const productRaw = item.product as Record<string, unknown> | null | undefined;
            const productId = item.productId != null ? Number(item.productId) : null;
            const product = productRaw && Number(productRaw.id)
              ? {
                  id: Number(productRaw.id),
                  erpId: String(productRaw.erpId ?? ''),
                  name: String(productRaw.name ?? ''),
                  basePrice: Number(productRaw.basePrice) || 0,
                  gstRate: Number(productRaw.gstRate) || 0,
                  unit: String(productRaw.unit ?? 'PCS'),
                }
              : null;
            const unitPrice = Number(item.unitPrice) || 0;
            const gstRate = Number(item.gstRate) || 0;
            return {
              id: Number(item.id) || 0,
              name: String(item.productName ?? ''),
              erpId: String(item.erpId ?? '-'),
              qty: Number(item.quantity) || 0,
              shortQty: Number(item.shortQuantity) || 0,
              returnQty: Number(item.returnQuantity) || 0,
              unitPrice,
              discount: Number(item.discount) || 0,
              taxable: Number(item.taxableAmount) || 0,
              gstRate,
              gstAmt: Number(item.gstAmount) || 0,
              total: Number(item.totalAmount) || 0,
              productId,
              product,
              priceMismatch: product ? Math.abs(unitPrice - product.basePrice) > 0.01 : false,
              gstMismatch: product && product.gstRate > 0 ? Math.abs(gstRate - product.gstRate) > 0.01 : false,
            };
          }),
          summary: {
            subtotal: Number(apiOrder.subtotal) || 0,
            discount: apiItems.reduce((sum: number, item) => sum + Number(item.discount || 0), 0),
            taxable: Number(apiOrder.taxableAmount) || 0,
            cgst: Number(apiOrder.cgst) || 0,
            sgst: Number(apiOrder.sgst) || 0,
            igst: Number(apiOrder.igst) || 0,
            totalGst: Number(apiOrder.totalGst) || 0,
            grandTotal,
          },
          financials: {
            paid: totalPaid,
            balance,
          },
          payments: apiSettlements.map((s) => ({
            id: Number(s.id) || 0,
            date: s.settledAt ? new Date(String(s.settledAt)).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            amount: Number(s.amount) || 0,
            cash: Number(s.cashAmount) || 0,
            online: Number(s.onlineAmount) || 0,
            mode: String(s.paymentMode ?? 'Cash'),
            reference: String(s.referenceNumber ?? ''),
            notes: String(s.notes ?? ''),
          })),
        });
        setPaymentAmount(balance > 0 ? Math.round(balance * 100) / 100 : 0);
        setLoading(false);
      } catch (e) {
        console.error(e);
        if (mounted) setLoading(false);
      }
    };
    fetchOrder();
    return () => { mounted = false; };
  }, [id, authFetch]);

  const formatCurrency = (amount: number) => {
    return Number(amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const res = await authFetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus.toLowerCase() }),
      });
      if (res.ok) {
        const updated = await res.json();
        const capitalized = updated.status === 'confirmed' ? 'Confirmed' : updated.status === 'delivered' ? 'Delivered' : updated.status === 'cancelled' ? 'Cancelled' : 'Pending';
        if (order) setOrder({ ...order, status: capitalized });
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update status');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to update order status');
    }
  };

  const handleRecordPayment = async () => {
    if (paymentMode === 'Split' && (Number(cashAmount) + Number(onlineAmount) !== Number(paymentAmount))) {
      alert('Split amounts must equal total payment amount.');
      return;
    }

    if (paymentMode === 'Cash' && !paymentNotes.trim()) {
      alert('Cash Order Notes are required for Cash payments.');
      return;
    }

    if (!order) return;

    // Validate denominations match cash amount for Cash mode
    if (paymentMode === 'Cash') {
      const denomTotal = denominations.reduce((sum, d) => sum + d.denomination * d.quantity, 0);
      if (denomTotal > 0 && denomTotal !== paymentAmount) {
        alert('Cash denominations total does not match payment amount.');
        return;
      }
    }

    try {
      const res = await authFetch('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: Number(id),
          customerId: order.customerId,
          amount: paymentAmount,
          cashAmount: paymentMode === 'Cash' ? paymentAmount : (paymentMode === 'Split' ? cashAmount : 0),
          onlineAmount: ['Online', 'Cheque'].includes(paymentMode) ? paymentAmount : (paymentMode === 'Split' ? onlineAmount : 0),
          paymentMode,
          denominations: paymentMode === 'Cash' ? denominations : null,
          referenceNumber: reference,
          notes: paymentNotes,
        }),
      });

      if (res.ok) {
        const newSettlement = await res.json();
        const totalPaid = order.payments.reduce((sum: number, p) => sum + Number(p.amount || 0), 0) + Number(paymentAmount);
        const grandTotal = Number(order.summary.grandTotal || 0);
        const balance = grandTotal - totalPaid;

        setOrder({
          ...order,
          financials: {
            paid: totalPaid,
            balance,
          },
          payments: [...order.payments, {
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            amount: paymentAmount,
            cash: paymentMode === 'Cash' ? paymentAmount : (paymentMode === 'Split' ? cashAmount : 0),
            online: ['Online', 'Cheque'].includes(paymentMode) ? paymentAmount : (paymentMode === 'Split' ? onlineAmount : 0),
            mode: paymentMode,
            reference,
            notes: paymentNotes,
            denominations: paymentMode === 'Cash' ? denominations : undefined,
          }],
        });
        setShowPaymentModal(false);
        setPaymentMode('Cash');
        setPaymentAmount(0);
        setCashAmount(0);
        setOnlineAmount(0);
        setReference('');
        setPaymentNotes('');
        setDenominations([]);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to record payment');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to record payment');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex gap-4">
          <div className="h-10 w-10 bg-slate-700 rounded-full"></div>
          <div className="h-10 w-48 bg-slate-700 rounded"></div>
        </div>
        <div className="h-48 glass-card rounded-xl bg-slate-800/50"></div>
        <div className="h-64 glass-card rounded-xl bg-slate-800/50"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-40 glass-card rounded-xl bg-slate-800/50"></div>
          <div className="h-40 glass-card rounded-xl bg-slate-800/50"></div>
        </div>
      </div>
    );
  }

  if (!order) return <div className="text-white">Order not found</div>;

  return (
    <div className="space-y-6 pb-12 animate-fade-in relative">
      <div className="flex items-center gap-4">
        <Link href="/orders" className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </Link>
        <h1 className="text-3xl font-bold text-white tracking-tight">Order Details</h1>
      </div>

      {/* Header Card */}
      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-white">{order.id}</h2>
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
              order.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
              order.status === 'Confirmed' ? 'bg-blue-100 text-blue-800' :
              order.status === 'Delivered' ? 'bg-green-100 text-green-800' :
              'bg-red-100 text-red-800'
            }`}>
              {order.status}
            </span>
            <span className="text-sm text-gray-400">{new Date(order.date).toLocaleDateString('en-IN')}</span>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => window.open(`/api/orders/${id}/invoice`, '_blank')}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              title="Download GST Invoice PDF"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Invoice PDF
            </button>
            <button
              onClick={() => window.open(`/api/orders/${id}/invoice/html`, '_blank')}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              title="Open print-friendly invoice in browser"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print Invoice
            </button>
            {order.status === 'Pending' && (
              <button onClick={() => handleUpdateStatus('Confirmed')} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/30">
                Confirm Order
              </button>
            )}
            {order.status === 'Confirmed' && (
              <button onClick={() => handleUpdateStatus('Delivered')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-emerald-500/30">
                Mark Delivered
              </button>
            )}
            {['Pending', 'Confirmed'].includes(order.status) && (
              <button onClick={() => handleUpdateStatus('Cancelled')} className="px-4 py-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 text-sm font-medium rounded-lg transition-colors">
                Cancel
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <p className="text-gray-400 mb-1">Customer Info</p>
            <p className="font-bold text-white text-base">{order.customerName}</p>
            <p className="text-gray-300">{order.customerPhone}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Sales & Logistics</p>
            <p className="text-white"><span className="text-gray-500">Rep:</span> {order.salesperson}</p>
            <p className="text-white"><span className="text-gray-500">Beat:</span> {order.beat}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Credit Terms</p>
            <p className="text-white"><span className="text-gray-500">Days:</span> {order.creditDays}</p>
            <p className="text-white"><span className="text-gray-500">Due:</span> {new Date(order.dueDate).toLocaleDateString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-slate-800/30">
          <h3 className="font-bold text-white">Order Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-xs uppercase bg-slate-800/50 text-gray-400">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Disc</th>
                <th className="px-4 py-3 text-right">Taxable</th>
                <th className="px-4 py-3 text-right">GST</th>
                <th className="px-4 py-3 text-right font-bold text-white">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i: number) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.erpId}</div>
                    {item.product ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Link
                          href={`/products?search=${encodeURIComponent(item.product.erpId || item.product.name)}`}
                          className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 hover:underline"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5-5 5M6 12h12" />
                          </svg>
                          {item.product.name} · {item.product.erpId || `#${item.product.id}`}
                        </Link>
                        {item.priceMismatch && (
                          <span
                            title={`Catalog base price ${item.product.basePrice.toFixed(2)} vs billed ${item.unitPrice.toFixed(2)}`}
                            className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30"
                          >
                            price ₹{item.product.basePrice.toFixed(2)} cat.
                          </span>
                        )}
                        {item.gstMismatch && (
                          <span
                            title={`Catalog GST ${item.product.gstRate}% vs billed ${item.gstRate}%`}
                            className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30"
                          >
                            GST {item.product.gstRate}% cat.
                          </span>
                        )}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{item.qty}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-4 py-3 text-right text-rose-400">{item.discount > 0 ? `-${formatCurrency(item.discount)}` : '-'}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(item.taxable)}</td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(item.gstAmt)}<br/><span className="text-xs text-gray-500">@{item.gstRate}%</span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-400">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financials & Settlements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
{/* Financial Summary */}
         <div className="glass-card p-6 h-full flex flex-col">
           <h3 className="font-bold text-white mb-4">Financial Summary</h3>
           <div className="space-y-3 text-sm flex-1">
             <div className="flex justify-between text-gray-300">
               <span>Subtotal</span>
               <span>{formatCurrency(order.summary.subtotal)}</span>
             </div>
             <div className="flex justify-between text-gray-300">
               <span>Taxable Amount</span>
               <span>{formatCurrency(order.summary.taxable)}</span>
             </div>
             <div className="flex justify-between text-gray-400">
               <span>CGST</span>
               <span>{formatCurrency(order.summary.cgst)}</span>
             </div>
             <div className="flex justify-between text-gray-400">
               <span>SGST</span>
               <span>{formatCurrency(order.summary.sgst)}</span>
             </div>
             <div className="flex justify-between text-gray-400">
               <span>IGST</span>
               <span>{formatCurrency(order.summary.igst)}</span>
             </div>
             <div className="flex justify-between font-medium text-gray-300">
               <span>Total GST</span>
               <span>{formatCurrency(order.summary.totalGst)}</span>
             </div>
             <div className="my-4 border-t border-white/10"></div>
             
             <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 space-y-2">
               <div className="flex justify-between items-center">
                 <span className="font-medium text-gray-300">Grand Total</span>
                 <span className="text-xl font-bold text-white">{formatCurrency(order.summary.grandTotal)}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-emerald-400">Amount Paid</span>
                 <span className="font-medium text-emerald-400">{formatCurrency(order.financials.paid)}</span>
               </div>
               <div className="flex justify-between items-center border-t border-white/10 pt-2 mt-2">
                 <span className="font-bold text-white">Balance Due</span>
                 <span className={`text-xl font-bold ${order.financials.balance > 0 ? 'text-rose-400' : 'text-gray-400'}`}>
                   {formatCurrency(order.financials.balance)}
                 </span>
               </div>
             </div>
           </div>
         </div>

         {/* Cash Order Notes (Admin View) */}
         {order.payments.some((p) => p.mode === 'Cash' && p.notes) && (
           <div className="glass-card p-6 h-full flex flex-col">
             <h3 className="font-bold text-white mb-4">Cash Order Notes</h3>
             <div className="space-y-3 flex-1 overflow-y-auto">
               {order.payments.filter((p) => p.mode === 'Cash' && p.notes).map((pay, i: number) => (
                 <div key={i} className="bg-slate-800/50 p-3 rounded-xl border border-white/5">
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-xs font-medium text-gray-400">{new Date(pay.date).toLocaleDateString('en-IN')}</span>
                     <span className="text-xs font-bold text-emerald-400">{formatCurrency(pay.amount)}</span>
                   </div>
                   <p className="text-sm text-gray-300 whitespace-pre-wrap">{pay.notes}</p>
                 </div>
               ))}
             </div>
           </div>
         )}

         {/* Payment History */}
        <div className="glass-card p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-white">Payment History</h3>
            {order.financials.balance > 0 && (
              <button 
                onClick={() => { setPaymentAmount(Math.round(order.financials.balance * 100) / 100); setShowPaymentModal(true); }}
                className="btn-primary py-1.5 px-3 text-sm"
              >
                Record Payment
              </button>
            )}
          </div>
          
          {order.payments.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 py-8">
              <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              <p>No payments recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-sm text-gray-300">
                  <thead className="text-xs uppercase bg-slate-800/50 text-gray-400 border-b border-white/10">
 <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Mode</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Reference</th>
                      <th className="px-3 py-2">Notes</th>
                      <th className="px-3 py-2">Denominations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.payments.map((pay, i: number) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-3 py-3 whitespace-nowrap">{new Date(pay.date).toLocaleDateString('en-IN')}</td>
                        <td className="px-3 py-3">
                          <span className="px-2 py-1 rounded-md text-xs bg-slate-700 font-medium">{pay.mode}</span>
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-emerald-400">{formatCurrency(pay.amount)}</td>
                        <td className="px-3 py-3 text-xs text-gray-400">{pay.reference || '-'}</td>
                        <td className="px-3 py-3 text-xs text-gray-300 max-w-xs truncate">{pay.notes || '-'}</td>
                        <td className="px-3 py-3">
                          {pay.denominations && pay.denominations.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {pay.denominations.filter(d => d.quantity > 0).map(d => (
                                <span key={d.denomination} className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">
                                  ₹{d.denomination}×{d.quantity}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal Overlay */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card max-w-md w-full p-6 shadow-2xl border border-white/10">
            <h2 className="text-xl font-bold text-white mb-4">Record Payment</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Payment Mode</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Cash', 'Online', 'Cheque', 'Split'].map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={`py-2 text-sm rounded-lg border font-medium transition-colors ${
                        paymentMode === mode 
                          ? 'bg-indigo-600 border-indigo-500 text-white' 
                          : 'bg-slate-800 border-white/10 text-gray-400 hover:bg-slate-700'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Total Amount (₹)</label>
                <input 
                  type="number" 
                  className="input-field w-full text-lg font-bold"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(Number(e.target.value))}
                />
              </div>

              {paymentMode === 'Split' && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-xl border border-white/5">
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1 block">Cash Portion</label>
                    <input type="number" className="input-field w-full" value={cashAmount} onChange={e => setCashAmount(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1 block">Online Portion</label>
                    <input type="number" className="input-field w-full" value={onlineAmount} onChange={e => setOnlineAmount(Number(e.target.value))} />
                  </div>
                </div>
              )}

              {paymentMode === 'Cash' && (
                <CashDenominationInput amount={paymentAmount} onChange={setDenominations} />
              )}

              {['Online', 'Cheque', 'Split'].includes(paymentMode) && (
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-1 block">Reference / UTR Number</label>
                  <input type="text" className="input-field w-full" value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. UPI transaction ID" />
                </div>
              )}

              {paymentMode === 'Cash' && (
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-1 block">Cash Order Notes <span className="text-rose-400">*</span></label>
                  <textarea className="input-field w-full h-24" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="Enter cash transaction details for auditing..." required></textarea>
                </div>
              )}

              {paymentMode !== 'Cash' && (
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-1 block">Notes</label>
                  <textarea className="input-field w-full h-20" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="Optional notes..."></textarea>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleRecordPayment}
                className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors font-medium text-sm shadow-lg shadow-emerald-500/30"
              >
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
