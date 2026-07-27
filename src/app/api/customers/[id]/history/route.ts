import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orderItems, orders } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const customerId = parseInt(id, 10);

    if (isNaN(customerId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const history = await db
      .select({
        productName: orderItems.productName,
        erpId: orderItems.erpId,
        unitPrice: orderItems.unitPrice,
        gstRate: orderItems.gstRate,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.orderDate))
      .limit(20);

    const uniqueItems = Array.from(new Map(history.map(item => [item.erpId || item.productName, item])).values());

    return NextResponse.json({ items: uniqueItems });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
