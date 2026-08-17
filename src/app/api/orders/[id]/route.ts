import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { orders, orderItems, customers, users, activityLogs, settlements as settlementsTable, orderStatusEnum, products, type NewOrder } from '@/db/schema';

type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
import { eq, and, desc, inArray } from 'drizzle-orm';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const orderId = Number(id);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId));
    // Only safe columns — never the password hash.
    const [salesperson] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        phone: users.phone,
        avatar: users.avatar,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, order.salespersonId));

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

    // Attach the linked catalog product (if any) to each item so the UI can
    // link to the product record and flag price / GST mismatches.
    const productIds = items.filter(i => i.productId != null).map(i => i.productId as number);
    const productsById = new Map<number, typeof products.$inferSelect>();
    if (productIds.length > 0) {
      const rows = await db.select().from(products).where(inArray(products.id, productIds));
      for (const row of rows) productsById.set(row.id, row);
    }
    const itemsWithProduct = items.map((item) => ({
      ...item,
      product: item.productId != null ? (productsById.get(item.productId) ?? null) : null,
    }));

    const settlements = await db.select().from(settlementsTable)
      .where(eq(settlementsTable.orderId, orderId))
      .orderBy(desc(settlementsTable.settledAt));

    return NextResponse.json({ order, customer, salesperson, items: itemsWithProduct, settlements });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const orderId = Number(id);
    const body = await req.json() as { status?: string };
    const { status } = body;

    const validStatuses: OrderStatus[] = ['pending', 'confirmed', 'delivered', 'cancelled'];
    if (status && !validStatuses.includes(status as OrderStatus)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const updateData: Partial<NewOrder> = { updatedAt: new Date() };
    if (status) updateData.status = status as OrderStatus;

    const [updated] = await db.update(orders).set(updateData).where(eq(orders.id, orderId)).returning();

    if (!updated) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    await db.insert(activityLogs).values({
      userId: user.id,
      activityType: 'order_updated',
      entityType: 'order',
      entityId: orderId,
      description: `Order ${updated.invoiceNumber} status changed to ${status || updated.status}`
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

    const { id } = await params;
    const orderId = Number(id);

    await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
    await db.delete(orders).where(eq(orders.id, orderId));

    await db.insert(activityLogs).values({
      userId: user.id,
      activityType: 'order_updated',
      entityType: 'order',
      entityId: orderId,
      description: `Order #${orderId} deleted`
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}