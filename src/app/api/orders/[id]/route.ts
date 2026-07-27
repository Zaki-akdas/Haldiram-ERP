import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, orderItems, customers, users, settlements, activityLogs } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const isAdmin = user.role === 'admin';

    const [order] = await db
      .select({
        id: orders.id,
        invoiceNumber: orders.invoiceNumber,
        customerId: orders.customerId,
        customerName: customers.name,
        customerPhone: customers.phone,
        customerAddress: customers.address,
        salespersonId: orders.salespersonId,
        salespersonName: users.name,
        orderDate: orders.orderDate,
        deliveryDate: orders.deliveryDate,
        status: orders.status,
        subtotal: orders.subtotal,
        taxableAmount: orders.taxableAmount,
        cgst: orders.cgst,
        sgst: orders.sgst,
        igst: orders.igst,
        totalGst: orders.totalGst,
        grandTotal: orders.grandTotal,
        amountPaid: orders.amountPaid,
        balance: orders.balance,
        settlementStatus: orders.settlementStatus,
        beat: orders.beat,
        notes: orders.notes,
        metadata: orders.metadata,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .innerJoin(users, eq(orders.salespersonId, users.id))
      .where(
        and(
          eq(orders.id, orderId),
          !isAdmin ? eq(orders.salespersonId, user.id) : undefined
        )
      );

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const orderSettlements = await db.select().from(settlements).where(eq(settlements.orderId, orderId));

    return NextResponse.json({
      order: {
        ...order,
        subtotal: Number(order.subtotal),
        taxableAmount: Number(order.taxableAmount),
        cgst: Number(order.cgst),
        sgst: Number(order.sgst),
        igst: Number(order.igst),
        totalGst: Number(order.totalGst),
        grandTotal: Number(order.grandTotal),
        amountPaid: Number(order.amountPaid),
        balance: Number(order.balance),
      },
      items: items.map(i => ({
        ...i,
        unitPrice: Number(i.unitPrice),
        discount: Number(i.discount),
        taxableAmount: Number(i.taxableAmount),
        gstRate: Number(i.gstRate),
        gstAmount: Number(i.gstAmount),
        totalAmount: Number(i.totalAmount),
      })),
      settlements: orderSettlements.map(s => ({
        ...s,
        amount: Number(s.amount),
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
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const body = await request.json();
    const { status, deliveryDate, notes } = body;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (deliveryDate) updateData.deliveryDate = new Date(deliveryDate);
    if (notes !== undefined) updateData.notes = notes;

    const [updated] = await db.update(orders).set(updateData).where(eq(orders.id, orderId)).returning();

    if (!updated) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    await db.insert(activityLogs).values({
      userId: user.id,
      activityType: 'order_updated',
      entityType: 'order',
      entityId: orderId,
      description: `Updated order ${updated.invoiceNumber}`,
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

    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
    await db.delete(settlements).where(eq(settlements.orderId, orderId));

    const [deleted] = await db.delete(orders).where(eq(orders.id, orderId)).returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    await db.insert(activityLogs).values({
      userId: user.id,
      activityType: 'order_updated',
      entityType: 'order',
      entityId: orderId,
      description: `Deleted order ${deleted.invoiceNumber}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Order delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
