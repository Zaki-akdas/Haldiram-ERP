import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { orders, settlements } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const customerId = Number(id);

    const customerOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.orderDate));

    const customerSettlements = await db
      .select()
      .from(settlements)
      .where(eq(settlements.customerId, customerId));

    const totalSpent = customerOrders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);
    const totalPaid = customerOrders.reduce((sum, order) => sum + Number(order.amountPaid || 0), 0);
    const outstanding = totalSpent - totalPaid;

    return NextResponse.json({
      orders: customerOrders,
      settlements: customerSettlements,
      totalSpent,
      totalPaid,
      outstanding
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
