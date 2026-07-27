import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });

    const isAdmin = user.role === 'admin';

    let query = supabaseAdmin
      .from('orders')
      .select('*, customers(name, phone, address), users(name)')
      .eq('id', orderId);

    if (!isAdmin) query = query.eq('salesperson_id', user.id);

    const { data: order, error } = await query.single();
    if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const { data: items } = await supabaseAdmin.from('order_items').select('*').eq('order_id', orderId);
    const { data: settlements } = await supabaseAdmin.from('settlements').select('*').eq('order_id', orderId);

    return NextResponse.json({
      order: {
        id: order.id,
        invoiceNumber: order.invoice_number,
        customerId: order.customer_id,
        customerName: order.customers?.name,
        customerPhone: order.customers?.phone,
        customerAddress: order.customers?.address,
        salespersonId: order.salesperson_id,
        salespersonName: order.users?.name,
        orderDate: order.order_date,
        deliveryDate: order.delivery_date,
        status: order.status,
        subtotal: Number(order.subtotal || 0),
        taxableAmount: Number(order.taxable_amount || 0),
        cgst: Number(order.cgst || 0),
        sgst: Number(order.sgst || 0),
        igst: Number(order.igst || 0),
        totalGst: Number(order.total_gst || 0),
        grandTotal: Number(order.grand_total || 0),
        amountPaid: Number(order.amount_paid || 0),
        balance: Number(order.balance || 0),
        settlementStatus: order.settlement_status,
        beat: order.beat,
        notes: order.notes,
        metadata: order.metadata,
        createdAt: order.created_at,
      },
      items: (items || []).map((i: any) => ({
        ...i,
        unitPrice: Number(i.unit_price || 0),
        discount: Number(i.discount || 0),
        taxableAmount: Number(i.taxable_amount || 0),
        gstRate: Number(i.gst_rate || 0),
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
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });

    const body = await request.json();
    const { status, deliveryDate, notes } = body;

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updateData.status = status;
    if (deliveryDate) updateData.delivery_date = new Date(deliveryDate).toISOString();
    if (notes !== undefined) updateData.notes = notes;

    const { data: updated, error } = await supabaseAdmin
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (error || !updated) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    await supabaseAdmin.from('activity_logs').insert({
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
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });

    await supabaseAdmin.from('order_items').delete().eq('order_id', orderId);
    await supabaseAdmin.from('settlements').delete().eq('order_id', orderId);

    const { data: deleted, error } = await supabaseAdmin
      .from('orders')
      .delete()
      .eq('id', orderId)
      .select()
      .single();

    if (error || !deleted) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    await supabaseAdmin.from('activity_logs').insert({
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
