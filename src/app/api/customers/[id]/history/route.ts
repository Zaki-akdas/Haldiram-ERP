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
    const customerId = parseInt(id, 10);

    if (isNaN(customerId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const { data: history, error } = await supabase
      .from('order_items')
      .select('product_name, erp_id, unit_price, gst_rate, orders!inner(order_date)')
      .eq('orders.customer_id', customerId)
      .order('orders.order_date', { ascending: false })
      .limit(20);

    if (error) throw error;

    const uniqueItems = Array.from(new Map((history || []).map((item: any) => [item.erp_id || item.product_name, item])).values());

    return NextResponse.json({ items: uniqueItems });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
