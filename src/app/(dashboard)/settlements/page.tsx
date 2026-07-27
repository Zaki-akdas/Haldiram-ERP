'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface Settlement {
  id: number;
  orderId: number;
  invoiceNumber: string;
  customerName: string;
  salespersonName: string;
  amount: number;
  paymentMode: string;
  referenceNumber: string | null;
  notes: string | null;
  settledAt: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
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

export default function SettlementsPage() {
  const { authFetch } = useAuth();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettlements() {
      try {
        const res = await authFetch('/api/settlements');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setSettlements(data.settlements);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchSettlements();
  }, []);

  const paymentModeColors: Record<string, string> = {
    cash: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    upi: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    bank: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    cheque: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };

  // Calculate totals
  const totals = settlements.reduce((acc, s) => {
    acc.total += s.amount;
    acc[s.paymentMode] = (acc[s.paymentMode] || 0) + s.amount;
    return acc;
  }, { total: 0 } as Record<string, number>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Settlements</h1>
        <p className="text-slate-500 dark:text-slate-400">Track all payment collections</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total Collected</p>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.total)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-slate-500">Cash</p>
          <p className="text-xl font-bold text-slate-800 dark:text-white">{formatCurrency(totals.cash || 0)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-slate-500">UPI</p>
          <p className="text-xl font-bold text-slate-800 dark:text-white">{formatCurrency(totals.upi || 0)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-slate-500">Bank Transfer</p>
          <p className="text-xl font-bold text-slate-800 dark:text-white">{formatCurrency(totals.bank || 0)}</p>
        </div>
      </div>

      {/* Settlements Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : settlements.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No settlements recorded yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Mode</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {settlements.map((settlement) => (
                  <tr key={settlement.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {formatDate(settlement.settledAt)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-emerald-600">
                      {settlement.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-800 dark:text-white">
                      {settlement.customerName}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full uppercase ${
                        paymentModeColors[settlement.paymentMode] || 'bg-slate-100 text-slate-600'
                      }`}>
                        {settlement.paymentMode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600">
                      {formatCurrency(settlement.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 font-mono">
                      {settlement.referenceNumber || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
