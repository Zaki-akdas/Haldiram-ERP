import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;
    const isAdmin = user.role === 'admin';

    let query = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .order('order_date', { ascending: false });

    if (!isAdmin) query = query.eq('salesperson_id', user.id);
    if (status && status !== 'all') query = query.eq('status', status);

    if (search) {
      const { data: matchingCustomers } = await supabase
        .from('customers')
        .select('id')
        .ilike('name', `%${search}%`);
      const customerIds = matchingCustomers?.map((c: any) => c.id) || [];
      if (customerIds.length > 0) {
        query = query.or(`invoice_number.ilike.%${search}%,customer_id.in.(${customerIds.join(',')})`);
      } else {
        query = query.ilike('invoice_number', `%${search}%`);
      }
    }

    const { data: orderList, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    const customerIds = [...new Set((orderList || []).map((o: any) => o.customer_id).filter(Boolean))];
    const salespersonIds = [...new Set((orderList || []).map((o: any) => o.salesperson_id).filter(Boolean))];

    const { data: customersData } = await supabase.from('customers').select('id, name').in('id', customerIds);
    const { data: usersData } = await supabase.from('users').select('id, name').in('id', salespersonIds);

    const customerMap: Map<number, any> = new Map((customersData || []).map((c: any) => [c.id, c]));
    const userMap: Map<number, any> = new Map((usersData || []).map((u: any) => [u.id, u]));

    return NextResponse.json({
      orders: (orderList || []).map((o: any) => ({
        id: o.id,
        invoiceNumber: o.invoice_number,
        customerId: o.customer_id,
        customerName: customerMap.get(o.customer_id)?.name || null,
        salespersonId: o.salesperson_id,
        salespersonName: userMap.get(o.salesperson_id)?.name || null,
        orderDate: o.order_date,
        dueDate: o.due_date,
        status: o.status,
        subtotal: Number(o.subtotal || 0),
        totalGst: Number(o.total_gst || 0),
        grandTotal: Number(o.grand_total || 0),
        amountPaid: Number(o.amount_paid || 0),
        balance: Number(o.balance || 0),
        settlementStatus: o.settlement_status,
        beat: o.beat,
      })),
      pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
    });
  } catch (error) {
    console.error('Orders fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    let { invoiceNumber, customerId, customerName, orderDate, items, beat, notes, creditDays } = body;

    const orderDateObj = orderDate ? new Date(orderDate) : new Date();
    let dueDate = null;
    if (creditDays && !isNaN(parseInt(creditDays))) {
      dueDate = new Date(orderDateObj);
      dueDate.setDate(dueDate.getDate() + parseInt(creditDays));
    }

    let subtotal = 0;
    let totalGst = 0;
    if (items && Array.isArray(items)) {
      for (const item of items) {
        subtotal += Number(item.taxableAmount) || 0;
        totalGst += Number(item.gstAmount) || 0;
      }
    }

    const grandTotal = subtotal + totalGst;

    if (!customerId && customerName) {
      const { data: existing } = await supabase.from('customers').select('id').ilike('name', customerName).limit(1);
      if (existing && existing.length > 0) {
        customerId = existing[0].id;
      } else {
        const { data: newCust } = await supabase
          .from('customers')
          .insert({ name: customerName, beat: beat || 'New Beat', assigned_salesperson_id: user.id })
          .select()
          .single();
        customerId = newCust.id;
      }
    }

    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('invoice_number', invoiceNumber)
      .limit(1);

    let finalInvoiceNumber = invoiceNumber;
    if (existingOrder && existingOrder.length > 0) finalInvoiceNumber = `${invoiceNumber}-${Date.now().toString().slice(-4)}`;

    const { data: newOrder } = await supabase
      .from('orders')
      .insert({
        invoice_number: finalInvoiceNumber,
        customer_id: customerId,
        salesperson_id: user.id,
        order_date: orderDateObj.toISOString(),
        due_date: dueDate ? dueDate.toISOString() : null,
        credit_days: creditDays ? parseInt(creditDays) : 0,
        status: 'pending',
        subtotal: subtotal.toFixed(2),
        total_gst: totalGst.toFixed(2),
        grand_total: grandTotal.toFixed(2),
        amount_paid: '0.00',
        balance: grandTotal.toFixed(2),
        settlement_status: 'pending',
        beat,
        notes: notes || null,
      })
      .select()
      .single();

    if (items && Array.isArray(items) && items.length > 0) {
      const itemsToInsert = items.map((item: any) => ({
        order_id: newOrder.id,
        product_id: item.productId || null,
        product_name: String(item.productName || 'Unnamed Item').substring(0, 255),
        quantity: Math.max(1, parseInt(item.quantity) || 0),
        short_quantity: 0,
        return_quantity: 0,
        unit_price: (Number(item.unitPrice) || 0).toFixed(2),
        taxable_amount: (Number(item.taxableAmount) || 0).toFixed(2),
        gst_amount: (Number(item.gstAmount) || 0).toFixed(2),
        total_amount: (Number(item.totalAmount) || 0).toFixed(2),
      }));
      await supabase.from('order_items').insert(itemsToInsert);
    }

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      activity_type: 'order_created',
      entity_type: 'order',
      entity_id: newOrder.id,
      description: `Created order ${finalInvoiceNumber}`,
    });

    return NextResponse.json({ order: newOrder }, { status: 201 });
  } catch (error) {
    console.error('Order create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
