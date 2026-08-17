'use client';

import { useState } from 'react';

type DenomCalculatorProps = {
  targetAmount?: number;
  onDenominationsChange?: (denoms: Record<string, number>, total: number) => void;
};

const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

export default function DenominationCalculator({ targetAmount, onDenominationsChange }: DenomCalculatorProps) {
  const [counts, setCounts] = useState<Record<string, number>>(
    DENOMINATIONS.reduce((acc, curr) => ({ ...acc, [curr]: 0 }), {})
  );

  // Derived state — recomputed on every render, no effect needed.
  const total = DENOMINATIONS.reduce((sum, denom) => sum + denom * (counts[denom] || 0), 0);

  const notifyChange = (nextCounts: Record<string, number>, nextTotal: number) => {
    if (onDenominationsChange) {
      onDenominationsChange(nextCounts, nextTotal);
    }
  };

  const handleCountChange = (denom: number, val: string) => {
    const num = parseInt(val, 10);
    const next: Record<string, number> = {
      ...counts,
      [denom]: isNaN(num) || num < 0 ? 0 : num
    };
    const nextTotal = DENOMINATIONS.reduce((sum, d) => sum + d * (next[d] || 0), 0);
    setCounts(next);
    notifyChange(next, nextTotal);
  };

  const handleReset = () => {
    const reset = DENOMINATIONS.reduce((acc, curr) => ({ ...acc, [curr]: 0 }), {});
    setCounts(reset);
    notifyChange(reset, 0);
  };

  const difference = (targetAmount || 0) - total;
  
  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="glass-card p-6 border border-border">
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Cash Denominations</h3>
          <p className="text-sm text-text-secondary">Enter currency note counts</p>
        </div>
        <button 
          onClick={handleReset}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10 transition-colors"
        >
          Reset All
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {DENOMINATIONS.map(denom => (
          <div key={denom} className="flex items-center justify-between rounded-xl border border-border bg-white/50 dark:bg-gray-800/50 p-3 shadow-sm transition-all hover:border-primary/50">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-12 items-center justify-center rounded bg-gray-100 dark:bg-gray-700 font-medium text-text-primary shadow-inner">
                ₹{denom}
              </span>
              <span className="text-text-secondary text-sm font-medium">x</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <input
                type="number"
                min="0"
                value={counts[denom] || ''}
                onChange={(e) => handleCountChange(denom, e.target.value)}
                className="w-20 rounded-lg border border-border bg-white dark:bg-gray-900 px-2 py-1 text-right text-sm font-medium text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="0"
              />
              <span className="text-xs font-semibold text-text-secondary">
                {formatINR(denom * (counts[denom] || 0))}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-gray-50 dark:bg-gray-800/80 p-5 border border-border shadow-inner">
        <div className="flex flex-col gap-3">
          {targetAmount !== undefined && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-secondary">Target Amount:</span>
              <span className="font-semibold text-text-primary">{formatINR(targetAmount)}</span>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <span className="text-text-secondary text-sm">Calculated Total:</span>
            <span className="text-2xl font-bold text-primary tracking-tight">{formatINR(total)}</span>
          </div>
          
          {targetAmount !== undefined && (
            <div className="mt-2 flex justify-between items-center border-t border-border pt-3">
              <span className="text-sm font-medium text-text-secondary">Difference:</span>
              <span className={`font-bold ${difference === 0 ? 'text-accent' : 'text-danger'}`}>
                {difference > 0 ? 'Short by ' : difference < 0 ? 'Excess of ' : ''}
                {formatINR(Math.abs(difference))}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
