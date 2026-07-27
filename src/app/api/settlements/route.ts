import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;
    const isAdmin = user.role === 'admin';

    let query = supabaseAdmin
      .from('settlements')
      .select('*, orders(invoice_number), customers(name), users!settlements_salesperson_id_fkey(name)', { count: 'exact' })
      .order('settled_at', { ascending: false });

    if (!isAdmin) query = query.eq('salesperson_id', user.id);

    const { data: settlementList, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    const formatted = (settlementList || []).map((s: any) => ({
      id: s.id,
      orderId: s.order_id,
      invoiceNumber: s.orders?.invoice_number,
      customerId: s.customer_id,
      customerName: s.customers?.name,
      salespersonId: s.salesperson_id,
      salespersonName: s.users?.name,
      amount: Number(s.amount || 0),
      paymentMode: s.payment_mode,
      referenceNumber: s.reference_number,
      notes: s.notes,
      settledAt: s.settled_at,
      createdAt: s.created_at,
    }));

    return NextResponse.json({
      settlements: formatted,
      pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
    });
  } catch (error) {
    console.error('Settlements fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { orderId, amount, paymentMode, cashAmount, onlineAmount, denominations, clearingDays, referenceNumber, notes } = body;

    if (!orderId || amount === undefined || !paymentMode) {
      return NextResponse.json(
        { error: 'Order ID, amount, and payment mode are required' },
        { status: 400 }
      );
    }

    const { data: orderData, error } = await supabaseAdmin
      .from('orders')
      .select('*, customers(name)')
      .eq('id', orderId)
      .single();

    if (error || !orderData) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const currentBalance = Number(orderData.balance || 0);
    if (amount > currentBalance + 0.5) {
      return NextResponse.json(
        { error: `Amount exceeds balance (₹${currentBalance.toFixed(2)})` },
        { status: 400 }
      );
    }

    const { data: newSettlement, error: insertError } = await supabaseAdmin
      .from('settlements')
      .insert({
        order_id: orderId,
        customer_id: orderData.customer_id,
        salesperson_id: user.id,
        amount: amount.toString(),
        cash_amount: (cashAmount || 0).toString(),
        online_amount: (onlineAmount || 0).toString(),
        payment_mode: paymentMode,
        denominations: denominations || null,
        clearing_days: clearingDays ? parseInt(clearingDays) : 0,
        reference_number: referenceNumber || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const newAmountPaid = Number(orderData.amount_paid || 0) + amount;
    const newBalance = Math.max(0, Number(orderData.grand_total || 0) - newAmountPaid);
    const newStatus = newBalance <= 0 ? 'settled' : (newAmountPaid > 0 ? 'partial' : 'pending');

    await supabaseAdmin
      .from('orders')
      .update({
        amount_paid: newAmountPaid.toFixed(2),
        balance: newBalance.toFixed(2),
        settlement_status: newStatus,
      })
      .eq('id', orderId);

    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      activity_type: 'settlement',
      entity_type: 'settlement',
      entity_id: newSettlement.id,
      description: `Bill Punched: Collected ₹${amount} from ${orderData.customers?.name || 'customer'} for ${orderData.invoice_number} (${paymentMode})`,
      metadata: { orderId, amount, paymentMode, shop: orderData.customers?.name, invoice: orderData.invoice_number, denominations },
    });

    return NextResponse.json({ settlement: newSettlement }, { status: 201 });
  } catch (error) {
    console.error('Settlement create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
