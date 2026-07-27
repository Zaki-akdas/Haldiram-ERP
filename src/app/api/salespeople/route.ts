import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { data: salespeopleData } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('role', 'salesperson');

    const result: any[] = [];
    for (const sp of salespeopleData || []) {
      const { count: totalOrdersCount } = await supabaseAdmin
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('salesperson_id', sp.id);

      const { count: monthlyOrdersCount } = await supabaseAdmin
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('salesperson_id', sp.id)
        .gte('order_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

      const { data: revenueData } = await supabaseAdmin
        .from('orders')
        .select('grand_total')
        .eq('salesperson_id', sp.id);

      const totalRevenue = revenueData?.reduce((sum, o) => sum + Number(o.grand_total || 0), 0) || 0;

      const { data: monthlyRevenueData } = await supabaseAdmin
        .from('orders')
        .select('grand_total')
        .eq('salesperson_id', sp.id)
        .gte('order_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

      const monthlyRevenue = monthlyRevenueData?.reduce((sum, o) => sum + Number(o.grand_total || 0), 0) || 0;

      const { count: totalCustomersCount } = await supabaseAdmin
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_salesperson_id', sp.id);

      result.push({
        id: sp.id,
        email: sp.email,
        name: sp.name,
        phone: sp.phone,
        isActive: sp.is_active,
        createdAt: sp.created_at,
        totalOrders: totalOrdersCount || 0,
        monthlyOrders: monthlyOrdersCount || 0,
        totalRevenue,
        monthlyRevenue,
        totalCustomers: totalCustomersCount || 0,
      });
    }

    result.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return NextResponse.json({
      salespeople: result.map(sp => ({
        ...sp,
        totalRevenue: Number(sp.totalRevenue),
        monthlyRevenue: Number(sp.monthlyRevenue),
      })),
    });
  } catch (error) {
    console.error('Salespeople fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only admin can create salespeople' }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, name, phone } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    const { data: newUser, error } = await supabaseAdmin
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password,
        name,
        phone,
        role: 'salesperson',
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error) {
    console.error('Salesperson create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
