import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isManager } from '@/lib/auth';
import { db } from '@/db';
import { products, activityLogs, type NewProduct } from '@/db/schema';
import { eq } from 'drizzle-orm';

const allowedProductFields = ['erpId', 'name', 'description', 'category', 'unit', 'mrp', 'basePrice', 'gstRate', 'hsnCode', 'stockQty', 'isActive'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isManager(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await req.json() as Record<string, unknown>;

    const updateData: Partial<NewProduct> = { updatedAt: new Date() };
    for (const field of allowedProductFields) {
      if (body[field] !== undefined) {
        (updateData as Record<string, unknown>)[field] = body[field];
      }
    }

    const [updated] = await db.update(products)
      .set(updateData)
      .where(eq(products.id, Number(id)))
      .returning();

    if (!updated) {
       return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    await db.insert(activityLogs).values({
      userId: user.id,
      activityType: 'product_added',
      entityType: 'product',
      entityId: updated.id,
      description: `Product ${updated.name} updated`
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isManager(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const productId = Number(id);

    const [deleted] = await db.delete(products).where(eq(products.id, productId)).returning();
    
    if (deleted) {
        await db.insert(activityLogs).values({
          userId: user.id,
          activityType: 'product_added',
          entityType: 'product',
          entityId: Number(productId),
          description: `Product ${deleted.name} deleted`
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}