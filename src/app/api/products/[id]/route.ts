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
    const productId = parseInt(id, 10);
    const body = await request.json();

    const { data: updated, error } = await supabaseAdmin
      .from('products')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select()
      .single();

    if (error || !updated) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    return NextResponse.json({ product: updated });
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
    const productId = parseInt(id, 10);

    if (isNaN(productId)) return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });

    const { data: linkedItems } = await supabaseAdmin
      .from('order_items')
      .select('id')
      .eq('product_id', productId)
      .limit(1);

    if (linkedItems && linkedItems.length > 0) {
      return NextResponse.json({
        error: 'Cannot delete product linked to existing orders. Mark it as inactive instead.',
      }, { status: 400 });
    }

    const { data: deleted, error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', productId)
      .select()
      .single();

    if (error || !deleted) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      activity_type: 'product_added',
      entity_type: 'product',
      entity_id: productId,
      description: `Deleted product ${deleted.name}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Product delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
