import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'sales';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'manager' || user.role === 'admin';

    if (reportType === 'sales') {
      let query = supabase.from('orders').select('order_date, grand_total, amount_paid, salesperson_id');
      if (!isAdmin) query = query.eq('salesperson_id', user.id);
      if (startDate) query = query.gte('order_date', startDate);
      if (endDate) query = query.lte('order_date', endDate);

      const { data: ordersData } = await query;
      const salesByDay: Record<string, { orders: number; revenue: number; collected: number }> = {};
      for (const o of ordersData || []) {
        const day = new Date(o.order_date).toISOString().split('T')[0];
        if (!salesByDay[day]) salesByDay[day] = { orders: 0, revenue: 0, collected: 0 };
        salesByDay[day].orders++;
        salesByDay[day].revenue += Number(o.grand_total || 0);
        salesByDay[day].collected += Number(o.amount_paid || 0);
      }
      const data = Object.entries(salesByDay)
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30);
      return NextResponse.json({ type: 'sales', data });
    }

    if (reportType === 'collections') {
      let query = supabase.from('settlements').select('settled_at, amount, payment_mode, salesperson_id');
      if (!isAdmin) query = query.eq('salesperson_id', user.id);
      if (startDate) query = query.gte('settled_at', startDate);
      if (endDate) query = query.lte('settled_at', endDate);

      const { data: settlementsData } = await query;
      const collections: Record<string, { count: number; amount: number; cash: number; upi: number; bank: number }> = {};
      for (const s of settlementsData || []) {
        const day = new Date(s.settled_at).toISOString().split('T')[0];
        if (!collections[day]) collections[day] = { count: 0, amount: 0, cash: 0, upi: 0, bank: 0 };
        collections[day].count++;
        collections[day].amount += Number(s.amount || 0);
        if (s.payment_mode === 'cash') collections[day].cash += Number(s.amount || 0);
        if (s.payment_mode === 'upi') collections[day].upi += Number(s.amount || 0);
        if (s.payment_mode === 'bank') collections[day].bank += Number(s.amount || 0);
      }
      const data = Object.entries(collections)
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30);
      return NextResponse.json({ type: 'collections', data });
    }

    if (reportType === 'customers' && isManager) {
      const { data: customersData } = await supabase.from('customers').select('id, name, city');
      const result: any[] = [];
      for (const c of customersData || []) {
        const { data: ordersData } = await supabase.from('orders').select('grand_total, balance, order_date').eq('customer_id', c.id);
        const totalOrders = ordersData?.length || 0;
        const totalRevenue = ordersData?.reduce((sum: number, o: any) => sum + Number(o.grand_total || 0), 0) || 0;
        const outstanding = ordersData?.reduce((sum: number, o: any) => sum + Number(o.balance || 0), 0) || 0;
        const lastOrder = ordersData?.length ? new Date(Math.max(...ordersData.map((o: any) => new Date(o.order_date).getTime()))).toISOString() : null;
        result.push({ id: c.id, name: c.name, city: c.city, totalOrders, totalRevenue, outstanding, lastOrder });
      }
      const data = result.sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 50);
      return NextResponse.json({ type: 'customers', data: data.map(c => ({ ...c, totalRevenue: Number(c.totalRevenue), outstanding: Number(c.outstanding) })) });
    }

    if (reportType === 'salespeople' && isManager) {
      const { data: usersData } = await supabase.from('users').select('id, name').eq('role', 'salesperson');
      const result: any[] = [];
      for (const u of usersData || []) {
        const { data: ordersData } = await supabase.from('orders').select('grand_total, amount_paid, balance').eq('salesperson_id', u.id);
        result.push({
          id: u.id,
          name: u.name,
          totalOrders: ordersData?.length || 0,
          totalRevenue: ordersData?.reduce((sum: number, o: any) => sum + Number(o.grand_total || 0), 0) || 0,
          collected: ordersData?.reduce((sum: number, o: any) => sum + Number(o.amount_paid || 0), 0) || 0,
          pending: ordersData?.reduce((sum: number, o: any) => sum + Number(o.balance || 0), 0) || 0,
          avgOrderValue: ordersData?.length ? (ordersData.reduce((sum: number, o: any) => sum + Number(o.grand_total || 0), 0) / ordersData.length) : 0,
        });
      }
      const data = result.sort((a, b) => b.totalRevenue - a.totalRevenue);
      return NextResponse.json({ type: 'salespeople', data: data.map(sp => ({ ...sp, totalRevenue: Number(sp.totalRevenue), collected: Number(sp.collected), pending: Number(sp.pending), avgOrderValue: Number(sp.avgOrderValue) })) });
    }

    return NextResponse.json({ type: reportType, data: [] });
  } catch (error) {
    console.error('Reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
