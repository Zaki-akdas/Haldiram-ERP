import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/db';
import { getCurrentUser } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const customerId = parseInt(id, 10);
    const body = await request.json();

    const { data: updated, error } = await supabaseAdmin
      .from('customers')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)
      .select()
      .single();

    if (error || !updated) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    return NextResponse.json({ customer: updated });
  } catch (error) {
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
    const customerId = parseInt(id, 10);

    if (isNaN(customerId)) return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 });

    const { data: existingOrders } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('customer_id', customerId)
      .limit(1);

    if (existingOrders && existingOrders.length > 0) {
      return NextResponse.json({
        error: 'Cannot delete customer with existing orders. Delete orders first.',
      }, { status: 400 });
    }

    const { data: deleted, error } = await supabaseAdmin
      .from('customers')
      .delete()
      .eq('id', customerId)
      .select()
      .single();

    if (error || !deleted) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      activity_type: 'customer_added',
      entity_type: 'customer',
      entity_id: customerId,
      description: `Deleted customer ${deleted.name}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Customer delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
