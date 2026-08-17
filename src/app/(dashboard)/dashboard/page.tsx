'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';

interface DashboardRecentOrder {
  id: number;
  invoiceNumber: string | null;
  customerId: number | null;
  customer?: { name: string } | null;
  grandTotal: string | null;
  status: string;
  createdAt: Date | string | null;
}

interface DashboardData {
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: string | number | null;
  totalCollected: string | number | null;
  pendingSettlements: number;
  recentOrders: DashboardRecentOrder[];
  activeReceivables: Array<{
    id: number;
    invoiceNumber: string | null;
    customerId: number | null;
    customer?: { name: string } | null;
    grandTotal: string | null;
    amountPaid: string | null;
    balance: string | null;
    dueDate: Date | string | null;
  }>;
  salespeoplePerformance: Array<{
    name: string;
    orderCount: number;
    totalRevenue: string | number | null;
    totalCollected: string | number | null;
  }>;
}

export default function DashboardPage() {
  const { user, authFetch } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const res = await authFetch('/api/dashboard');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [authFetch]);

  const formatCurrency = (amount: number = 0) => {
    return Number(amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Pending</span>;
      case 'confirmed': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Confirmed</span>;
      case 'delivered': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">Delivered</span>;
      case 'cancelled': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">Cancelled</span>;
      default: return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">{status || 'Active'}</span>;
    }
  };

  const dashboardData = {
    kpis: {
      totalOrders: data?.totalOrders ?? 0,
      totalRevenue: Number(data?.totalRevenue ?? 0),
      collections: Number(data?.totalCollected ?? 0),
      pendingSettlements: data?.pendingSettlements ?? 0,
    },
    recentShipments: (data?.recentOrders && data.recentOrders.length > 0)
      ? data.recentOrders.map((o) => ({
          id: o?.invoiceNumber || `INV-${o?.id}`,
          customer: o?.customer?.name || `Customer #${o?.customerId}`,
          amount: Number(o?.grandTotal || 0),
          status: o?.status || 'pending',
          date: o?.createdAt || new Date().toISOString()
        }))
      : [],
    activeReceivables: (data?.activeReceivables && data.activeReceivables.length > 0)
      ? data.activeReceivables.map((r) => ({
          customer: r?.customer?.name || `Customer #${r?.customerId}`,
          invoice: r?.invoiceNumber || `INV-${r?.id}`,
          total: Number(r?.grandTotal || 0),
          paid: Number(r?.amountPaid || 0),
          balance: Number(r?.balance || 0),
          dueDate: r?.dueDate || new Date().toISOString()
        }))
      : [],
    teamPerformance: (data?.salespeoplePerformance && data.salespeoplePerformance.length > 0)
      ? data.salespeoplePerformance.map((sp) => ({
          name: sp.name,
          orders: sp.orderCount || 0,
          sales: Number(sp.totalRevenue || 0),
          collections: Number(sp.totalCollected || 0),
          rate: sp.totalRevenue ? Math.round((Number(sp.totalCollected || 0) / Number(sp.totalRevenue)) * 100) : 0
        }))
      : []
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 pb-12">
      {/* Banner Card with Image */}
      <div className="relative rounded-2xl overflow-hidden glass-card p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero-banner.jpg"
            alt="Haldiram ERP Banner"
            fill
            className="object-cover opacity-20 dark:opacity-30"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-transparent dark:from-slate-950/90" />
        </div>

        <div className="relative z-10 space-y-2 max-w-xl">
          <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            Distribution Hub Overview
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Swami Sharanam ERP Dashboard
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Welcome back, <span className="font-semibold text-white">{user?.name || 'User'}</span>! Clean distribution metrics, GST billing, and route collections hub.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap gap-3">
          <Link href="/orders/new" className="btn-primary">
            + New Order
          </Link>
          <Link href="/invoices" className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm backdrop-blur-md transition-all">
            📋 Copy-Paste Invoice Extractor
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Orders</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{dashboardData.kpis.totalOrders}</h3>
            </div>
          </div>
        </div>

        <div className="glass-card p-5 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/30">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Revenue</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatCurrency(dashboardData.kpis.totalRevenue)}</h3>
            </div>
          </div>
        </div>

        <div className="glass-card p-5 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-amber-500/30">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Collections</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatCurrency(dashboardData.kpis.collections)}</h3>
            </div>
          </div>
        </div>

        <div className="glass-card p-5 animate-fade-in" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 shadow-lg shadow-rose-500/30">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Settlements</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{dashboardData.kpis.pendingSettlements}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Shipments Table */}
      <div className="glass-card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Shipments</h2>
          <Link href="/orders" className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">
            View All &rarr;
          </Link>
        </div>
        <div className="overflow-x-auto">
          {dashboardData.recentShipments.length === 0 ? (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
              No recent orders found. Click <strong>+ New Order</strong> to create your first order.
            </div>
          ) : (
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-bold">Invoice #</th>
                  <th className="px-4 py-3 font-bold">Customer</th>
                  <th className="px-4 py-3 font-bold">Amount</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {dashboardData.recentShipments.slice(0, 5).map((order, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">{order.id}</td>
                    <td className="px-4 py-3.5 font-medium">{order.customer}</td>
                    <td className="px-4 py-3.5 font-bold">{formatCurrency(order.amount)}</td>
                    <td className="px-4 py-3.5">{getStatusBadge(order.status)}</td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">{new Date(order.date).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
