import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products, orderItems, activityLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
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

    const [updated] = await db.update(products).set({
      ...body,
      updatedAt: new Date(),
    }).where(eq(products.id, productId)).returning();

    if (!updated) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

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

    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const linkedItems = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.productId, productId)).limit(1);

    if (linkedItems.length > 0) {
      return NextResponse.json({
        error: 'Cannot delete product linked to existing orders. Mark it as inactive instead.',
      }, { status: 400 });
    }

    const [deleted] = await db.delete(products).where(eq(products.id, productId)).returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    await db.insert(activityLogs).values({
      userId: user.id,
      activityType: 'product_added',
      entityType: 'product',
      entityId: productId,
      description: `Deleted product ${deleted.name}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Product delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
