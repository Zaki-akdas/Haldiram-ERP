import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });

    const isAdmin = user.role === 'admin';

    let query = supabase
      .from('orders')
      .select('*')
      .eq('id', orderId);

    if (!isAdmin) query = query.eq('salesperson_id', user.id);

    const { data: order, error } = await query.single();
    if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const { data: customer } = await supabase.from('customers').select('id, name, phone, address').eq('id', order.customer_id).single();
    const { data: salesperson } = await supabase.from('users').select('id, name').eq('id', order.salesperson_id).single();

    const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderId);
    const { data: settlements } = await supabase.from('settlements').select('*').eq('order_id', orderId);

    return NextResponse.json({
      order: {
        id: order.id,
        invoiceNumber: order.invoice_number,
        customerId: order.customer_id,
        customerName: customer?.name,
        customerPhone: customer?.phone,
        customerAddress: customer?.address,
        salespersonId: order.salesperson_id,
        salespersonName: salesperson?.name,
        orderDate: order.order_date,
        dueDate: order.due_date,
        status: order.status,
        subtotal: Number(order.subtotal || 0),
        totalGst: Number(order.total_gst || 0),
        grandTotal: Number(order.grand_total || 0),
        amountPaid: Number(order.amount_paid || 0),
        balance: Number(order.balance || 0),
        settlementStatus: order.settlement_status,
        beat: order.beat,
        notes: order.notes,
        createdAt: order.created_at,
      },
      items: (items || []).map((i: any) => ({
        ...i,
        unitPrice: Number(i.unit_price || 0),
        taxableAmount: Number(i.taxable_amount || 0),
        gstAmount: Number(i.gst_amount || 0),
        totalAmount: Number(i.total_amount || 0),
      })),
      settlements: (settlements || []).map((s: any) => ({
        ...s,
        amount: Number(s.amount || 0),
      })),
    });
  } catch (error) {
    console.error('Order fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });

    const body = await request.json();
    const { status, dueDate, notes } = body;

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (dueDate) updateData.due_date = new Date(dueDate).toISOString();
    if (notes !== undefined) updateData.notes = notes;

    const { data: updated, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (error || !updated) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      activity_type: 'order_updated',
      entity_type: 'order',
      entity_id: orderId,
      description: `Updated order ${updated.invoice_number}`,
      metadata: body,
    });

    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error('Order update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });

    await supabase.from('order_items').delete().eq('order_id', orderId);
    await supabase.from('settlements').delete().eq('order_id', orderId);

    const { data: deleted, error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId)
      .select()
      .single();

    if (error || !deleted) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      activity_type: 'order_updated',
      entity_type: 'order',
      entity_id: orderId,
      description: `Deleted order ${deleted.invoice_number}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Order delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
