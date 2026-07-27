import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'manager' || user.role === 'admin';

    const orderQuery = supabaseAdmin.from('orders').select('status, grand_total, amount_paid, balance, order_date');
    if (!isAdmin) orderQuery.eq('salesperson_id', user.id);
    const { data: allOrders } = await orderQuery;

    const totalOrders = allOrders?.length || 0;
    const pendingOrders = allOrders?.filter((o: any) => o.status === 'pending').length || 0;
    const deliveredOrders = allOrders?.filter((o: any) => o.status === 'delivered').length || 0;
    const todayOrders = allOrders?.filter((o: any) => new Date(o.order_date) >= startOfToday) || [];
    const monthlyOrders = allOrders?.filter((o: any) => new Date(o.order_date) >= startOfMonth) || [];

    const customerQuery = supabaseAdmin.from('customers').select('id, is_active, assigned_salesperson_id');
    if (!isAdmin) customerQuery.eq('assigned_salesperson_id', user.id);
    const { data: customersData } = await customerQuery;

    const { count: totalProducts } = await supabaseAdmin.from('products').select('*', { count: 'exact', head: true });
    const { count: activeProducts } = await supabaseAdmin.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true);

    const { data: recentOrdersData } = await supabaseAdmin
      .from('orders')
      .select('id, invoice_number, grand_total, status, order_date, customers(name)')
      .order('order_date', { ascending: false })
      .limit(5);

    const { data: pendingSettlementsData } = await supabaseAdmin
      .from('orders')
      .select('id, invoice_number, balance, order_date, customers(name)')
      .gt('balance', 0)
      .order('order_date', { ascending: false })
      .limit(5);

    let salespersonStats: any[] = [];
    if (isManager) {
      const { data: usersData } = await supabaseAdmin.from('users').select('id, name');
      salespersonStats = (usersData || []).map((u: any) => {
        const salespersonOrders = allOrders?.filter((o: any) => o.salesperson_id === u.id) || [];
        const revenue = salespersonOrders.reduce((sum: number, o: any) => sum + Number(o.grand_total || 0), 0);
        return { id: u.id, name: u.name, orders: salespersonOrders.length, revenue };
      }).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 10);
    }

    return NextResponse.json({
      stats: {
        todayOrders: todayOrders.length,
        todayRevenue: todayOrders.reduce((sum: number, o: any) => sum + Number(o.grand_total || 0), 0),
        todayPending: todayOrders.reduce((sum: number, o: any) => sum + Number(o.balance || 0), 0),
        todayCollected: todayOrders.reduce((sum: number, o: any) => sum + Number(o.amount_paid || 0), 0),
        totalOrders,
        pendingOrders,
        deliveredOrders,
        totalRevenue: allOrders?.reduce((sum: number, o: any) => sum + Number(o.grand_total || 0), 0) || 0,
        monthlyOrders: monthlyOrders.length,
        monthlyRevenue: monthlyOrders.reduce((sum: number, o: any) => sum + Number(o.grand_total || 0), 0),
        monthlyCollected: monthlyOrders.reduce((sum: number, o: any) => sum + Number(o.amount_paid || 0), 0),
        totalCustomers: customersData?.length || 0,
        activeCustomers: customersData?.filter((c: any) => c.is_active).length || 0,
        totalProducts: totalProducts || 0,
        activeProducts: activeProducts || 0,
      },
      recentOrders: (recentOrdersData || []).map((o: any) => ({ ...o, grandTotal: Number(o.grand_total || 0), customerName: o.customers?.name })),
      pendingSettlements: (pendingSettlementsData || []).map((s: any) => ({ ...s, balance: Number(s.balance || 0), customerName: s.customers?.name })),
      salespersonStats,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
