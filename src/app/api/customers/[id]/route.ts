import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers, orders, orderItems, settlements, activityLogs } from '@/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
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

    const [updated] = await db.update(customers).set({
      ...body,
      updatedAt: new Date(),
    }).where(eq(customers.id, customerId)).returning();

    if (!updated) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

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

    if (isNaN(customerId)) {
      return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 });
    }

    const existingOrders = await db.select({ id: orders.id }).from(orders).where(eq(orders.customerId, customerId)).limit(1);

    if (existingOrders.length > 0) {
      return NextResponse.json({
        error: 'Cannot delete customer with existing orders. Delete orders first.',
      }, { status: 400 });
    }

    const [deleted] = await db.delete(customers).where(eq(customers.id, customerId)).returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    await db.insert(activityLogs).values({
      userId: user.id,
      activityType: 'customer_added',
      entityType: 'customer',
      entityId: customerId,
      description: `Deleted customer ${deleted.name}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Customer delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
