import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;
    const isAdmin = user.role === 'admin';

    let query = supabaseAdmin
      .from('customers')
      .select('*', { count: 'exact' });

    if (!isAdmin) {
      query = query.eq('assigned_salesperson_id', user.id);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,gstin.ilike.%${search}%`);
    }

    const { data: customerList, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const formattedCustomers = (customerList || []).map((c: any) => ({
      ...c,
      salespersonName: null,
      creditLimit: Number(c.credit_limit || 0),
      outstandingBalance: Number(c.outstanding_balance || 0),
    }));

    return NextResponse.json({
      customers: formattedCustomers,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Customers fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const {
      name,
      phone,
      email,
      gstin,
      pan,
      address,
      city,
      state,
      pincode,
      beat,
      creditLimit,
      assignedSalespersonId,
    } = body;

    if (!name) return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });

    const { data: newCustomer, error } = await supabaseAdmin
      .from('customers')
      .insert({
        name,
        phone,
        email,
        gstin,
        pan,
        address,
        city,
        state,
        pincode,
        beat,
        credit_limit: creditLimit?.toString() || '0',
        assigned_salesperson_id: assignedSalespersonId || (user.role === 'salesperson' ? user.id : null),
      })
      .select()
      .single();

    if (error) throw error;

    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      activity_type: 'customer_added',
      entity_type: 'customer',
      entity_id: newCustomer.id,
      description: `Added customer ${name}`,
    });

    return NextResponse.json({ customer: newCustomer }, { status: 201 });
  } catch (error) {
    console.error('Customer create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
