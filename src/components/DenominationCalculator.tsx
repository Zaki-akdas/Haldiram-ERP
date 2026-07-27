'use client';

import { useState, useEffect } from 'react';

const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

interface DenominationCounts {
  [key: string]: number;
}

interface DenominationCalculatorProps {
  onTotalChange: (total: number, counts: DenominationCounts) => void;
  targetAmount?: number;
}

export default function DenominationCalculator({ onTotalChange, targetAmount }: DenominationCalculatorProps) {
  const [counts, setCounts] = useState<DenominationCounts>({
    '500': 0, '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '2': 0, '1': 0
  });

  const total = Object.entries(counts).reduce((sum, [val, count]) => sum + (Number(val) * count), 0);

  useEffect(() => {
    onTotalChange(total, counts);
  }, [total, counts, onTotalChange]);

  const handleChange = (val: number, count: string) => {
    const n = parseInt(count, 10) || 0;
    setCounts(prev => ({ ...prev, [val.toString()]: n }));
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-3">
      <div className="flex justify-between items-center mb-2 border-b border-slate-200 dark:border-slate-600 pb-2">
        <h4 className="text-xs font-bold text-slate-400 uppercase">Cash Denominations</h4>
        <div className="text-right">
          <p className="text-lg font-bold text-emerald-600">₹{total.toLocaleString()}</p>
          {targetAmount !== undefined && (
            <p className={`text-[10px] ${total === targetAmount ? 'text-emerald-500' : 'text-amber-500'}`}>
              {total === targetAmount ? '✅ Matches perfectly' : `Diff: ₹${(targetAmount - total).toLocaleString()}`}
            </p>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {DENOMINATIONS.map(d => (
          <div key={d} className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-500 w-8">₹{d}</span>
            <span className="text-xs text-slate-400">×</span>
            <input
              type="number"
              min="0"
              value={counts[d.toString()] || ''}
              onChange={(e) => handleChange(d, e.target.value)}
              placeholder="0"
              className="w-16 px-2 py-1 text-right text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <span className="text-xs font-mono text-slate-400 w-16 text-right">
              = {(d * (counts[d.toString()] || 0)).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
