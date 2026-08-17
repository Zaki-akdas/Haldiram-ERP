'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface ReportRow {
  name?: string;
  date?: string;
  sales?: number;
  spent?: number;
  cash?: number;
  online?: number;
  cheque?: number;
  total?: number;
  paid?: number;
  outstanding?: number;
  count?: number;
  orders?: number;
  rate?: number;
  collections?: number;
  [key: string]: unknown;
}

interface ReportData {
  summary?: Record<string, number>;
  concentration?: number;
  table: ReportRow[];
}

export default function ReportsPage() {
  const { user, authFetch } = useAuth();
  const [activeTab, setActiveTab] = useState('Sales');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const tabs = ['Sales', 'Collections', 'Customers', 'Salespeople'];

  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'manager') return;
    
    const fetchReports = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        query.append('type', activeTab.toLowerCase());
        if (startDate) query.append('startDate', startDate);
        if (endDate) query.append('endDate', endDate);
        
        const res = await authFetch(`/api/reports?${query.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json && (json.summary || json.table)) {
            setData({ ...json, table: json.table || [] });
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error(err);
      }
      
      // Default zero state when no database records exist
      if (activeTab === 'Sales') {
        setData({
          summary: { totalSales: 0, totalOrders: 0, avgOrder: 0, highestOrder: 0 },
          table: []
        });
      } else if (activeTab === 'Collections') {
        setData({
          summary: { total: 0, cash: 0, online: 0, cheque: 0 },
          table: []
        });
      } else if (activeTab === 'Customers') {
        setData({
          concentration: 0,
          table: []
        });
      } else {
        setData({ table: [] });
      }
      setLoading(false);
    };

    fetchReports();
  }, [activeTab, startDate, endDate, user, authFetch]);

  if (user?.role === 'salesperson') {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="glass-card p-10 text-center max-w-md">
          <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-500">You do not have permission to view reports.</p>
        </div>
      </div>
    );
  }

  const exportCSV = () => {
    alert(`Exporting ${activeTab} data to CSV...`);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Reports & Analytics</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Deep distribution insights, sales velocity, and collection metrics</p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 500);
          }}
          className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-all"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Data
        </button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex gap-3 items-center bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <input 
            type="date" 
            className="input-field py-1.5 text-sm border-none bg-gray-50 dark:bg-gray-900" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
          />
          <span className="text-gray-400">to</span>
          <input 
            type="date" 
            className="input-field py-1.5 text-sm border-none bg-gray-50 dark:bg-gray-900" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
          />
        </div>
      </div>

      <div className="flex overflow-x-auto gap-2 mb-8 pb-2 scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2.5 rounded-full font-medium whitespace-nowrap transition-all ${activeTab === tab ? 'bg-primary text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex justify-end mb-4">
        <button onClick={exportCSV} className="flex items-center gap-2 text-sm font-medium text-primary bg-primary/10 px-4 py-2 rounded-lg hover:bg-primary/20 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          Export CSV
        </button>
      </div>

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>)}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
        </div>
      ) : !data ? (
        <div className="glass-card p-12 text-center text-gray-500">No data available</div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {activeTab === 'Sales' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-card p-5 border-l-4 border-l-blue-500">
                  <p className="text-sm text-gray-500 font-medium mb-1">Total Sales</p>
                  <p className="text-2xl font-bold">₹{(data.summary?.totalSales || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="glass-card p-5 border-l-4 border-l-green-500">
                  <p className="text-sm text-gray-500 font-medium mb-1">Total Orders</p>
                  <p className="text-2xl font-bold">{data.summary?.totalOrders || 0}</p>
                </div>
                <div className="glass-card p-5 border-l-4 border-l-purple-500">
                  <p className="text-sm text-gray-500 font-medium mb-1">Avg Order Value</p>
                  <p className="text-2xl font-bold">₹{(data.summary?.avgOrder || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="glass-card p-5 border-l-4 border-l-amber-500">
                  <p className="text-sm text-gray-500 font-medium mb-1">Highest Single Order</p>
                  <p className="text-2xl font-bold">₹{(data.summary?.highestOrder || 0).toLocaleString('en-IN')}</p>
                </div>
              </div>

              <div className="glass-card p-6 overflow-hidden">
                <h3 className="text-lg font-bold mb-6">Sales Trend</h3>
                <div className="h-[200px] flex items-end gap-2 md:gap-4 border-b border-gray-200 dark:border-gray-700 pb-2 relative">
                  {data.table.map((item, i: number) => {
                    const maxSales = Math.max(0, ...data.table.map(d => Number(d.sales) || 0));
                    const heightPercent = ((Number(item.sales) || 0) / (maxSales || 1)) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end group">
                        <div className="w-full bg-primary/80 hover:bg-primary rounded-t-sm transition-all duration-1000 ease-out relative" style={{ height: `${heightPercent}%` }}>
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded whitespace-nowrap z-10 transition-opacity">
                            ₹{(item.sales || 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div className="text-[10px] md:text-xs text-gray-500 mt-2 rotate-45 md:rotate-0 origin-left whitespace-nowrap">
                          {item.date ? new Date(item.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                        <th className="p-4 font-semibold text-sm">Date</th>
                        <th className="p-4 font-semibold text-sm text-right">Order Count</th>
                        <th className="p-4 font-semibold text-sm text-right">Total Sales</th>
                        <th className="p-4 font-semibold text-sm text-right">Average</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {data.table.map((row, i: number) => (
                        <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="p-4 text-sm">{row.date}</td>
                          <td className="p-4 text-sm text-right">{row.count}</td>
                          <td className="p-4 text-sm font-medium text-right">₹{(row.sales || 0).toLocaleString('en-IN')}</td>
                          <td className="p-4 text-sm text-right text-gray-500">₹{Math.round((row.sales || 0) / (row.count || 1)).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'Collections' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-card p-5 border-l-4 border-l-blue-500">
                  <p className="text-sm text-gray-500 font-medium mb-1">Total Collections</p>
                  <p className="text-2xl font-bold">₹{(data.summary?.total || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="glass-card p-5 border-l-4 border-l-green-500">
                  <p className="text-sm text-gray-500 font-medium mb-1">Cash</p>
                  <p className="text-2xl font-bold text-green-600">₹{(data.summary?.cash || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="glass-card p-5 border-l-4 border-l-purple-500">
                  <p className="text-sm text-gray-500 font-medium mb-1">Online</p>
                  <p className="text-2xl font-bold text-purple-600">₹{(data.summary?.online || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="glass-card p-5 border-l-4 border-l-amber-500">
                  <p className="text-sm text-gray-500 font-medium mb-1">Cheque</p>
                  <p className="text-2xl font-bold text-amber-600">₹{(data.summary?.cheque || 0).toLocaleString('en-IN')}</p>
                </div>
              </div>

              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                        <th className="p-4 font-semibold text-sm">Date</th>
                        <th className="p-4 font-semibold text-sm text-right">Count</th>
                        <th className="p-4 font-semibold text-sm text-right">Cash</th>
                        <th className="p-4 font-semibold text-sm text-right">Online</th>
                        <th className="p-4 font-semibold text-sm text-right">Total</th>
                        <th className="p-4 font-semibold text-sm w-1/3">Proportion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {data.table.map((row, i: number) => (
                        <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="p-4 text-sm">{row.date}</td>
                          <td className="p-4 text-sm text-right">{row.count}</td>
                          <td className="p-4 text-sm text-right text-green-600 font-medium">₹{(row.cash || 0).toLocaleString('en-IN')}</td>
                          <td className="p-4 text-sm text-right text-purple-600 font-medium">₹{(row.online || 0).toLocaleString('en-IN')}</td>
                          <td className="p-4 text-sm text-right font-bold">₹{(row.total || 0).toLocaleString('en-IN')}</td>
                          <td className="p-4">
                            <div className="h-2 w-full bg-gray-100 rounded-full flex overflow-hidden">
                              <div className="bg-green-500 h-full" style={{ width: `${((row.cash || 0) / (row.total || 0)) * 100}%` }}></div>
                              <div className="bg-purple-500 h-full" style={{ width: `${((row.online || 0) / (row.total || 0)) * 100}%` }}></div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'Customers' && (
            <>
              <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20 text-primary-800 dark:text-primary-300 flex items-center gap-3">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <p className="font-medium">Top 10 customers account for <strong>{data.concentration}%</strong> of total revenue.</p>
              </div>

              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                        <th className="p-4 font-semibold text-sm">Customer Name</th>
                        <th className="p-4 font-semibold text-sm text-right">Orders</th>
                        <th className="p-4 font-semibold text-sm text-right">Total Spent</th>
                        <th className="p-4 font-semibold text-sm text-right">Paid</th>
                        <th className="p-4 font-semibold text-sm text-right">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {data.table.sort((a, b) => (Number(b.spent) || 0) - (Number(a.spent) || 0)).map((row, i: number) => (
                        <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="p-4 font-medium">{row.name}</td>
                          <td className="p-4 text-sm text-right">{row.orders}</td>
                          <td className="p-4 text-sm font-bold text-right">₹{(row.spent || 0).toLocaleString('en-IN')}</td>
                          <td className="p-4 text-sm text-green-600 text-right">₹{(row.paid || 0).toLocaleString('en-IN')}</td>
                          <td className={`p-4 text-sm font-medium text-right ${(row.outstanding || 0) > 0 ? 'text-red-500' : 'text-gray-500'}`}>
                            ₹{(row.outstanding || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'Salespeople' && (
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                      <th className="p-4 font-semibold text-sm">Name</th>
                      <th className="p-4 font-semibold text-sm text-right">Orders</th>
                      <th className="p-4 font-semibold text-sm text-right">Sales</th>
                      <th className="p-4 font-semibold text-sm text-right">Collections</th>
                      <th className="p-4 font-semibold text-sm w-48">Collection Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {data.table.sort((a, b) => (Number(b.sales) || 0) - (Number(a.sales) || 0)).map((row, i: number) => (
                      <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="p-4 font-medium">{row.name}</td>
                        <td className="p-4 text-sm text-right">{row.orders}</td>
                        <td className="p-4 text-sm font-bold text-right">₹{(row.sales || 0).toLocaleString('en-IN')}</td>
                        <td className="p-4 text-sm font-medium text-right text-green-600">₹{(row.collections || 0).toLocaleString('en-IN')}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium w-10">{(row.rate || 0)}%</span>
                            <div className="h-2 flex-1 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${(row.rate || 0) >= 90 ? 'bg-green-500' : (row.rate || 0) >= 80 ? 'bg-amber-500' : 'bg-red-500'}`} 
                                style={{ width: `${row.rate || 0}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
