import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, customers, users, settlements } from '@/db/schema';
import { eq, desc, and, or, like, sql, gte, lte } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'sales';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'manager' || user.role === 'admin';

    const dateConditions: any[] = [];
    if (startDate) dateConditions.push(gte(orders.orderDate, new Date(startDate)));
    if (endDate) dateConditions.push(lte(orders.orderDate, new Date(endDate)));

    if (reportType === 'sales') {
      const salesByDay = await db
        .select({
          date: sql<string>`date_trunc('day', ${orders.orderDate})::date`,
          orders: sql<number>`count(*)`,
          revenue: sql<number>`coalesce(sum(${orders.grandTotal}), 0)`,
          collected: sql<number>`coalesce(sum(${orders.amountPaid}), 0)`,
        })
        .from(orders)
        .where(
          and(
            ...dateConditions,
            !isAdmin ? eq(orders.salespersonId, user.id) : undefined
          )
        )
        .groupBy(sql`date_trunc('day', ${orders.orderDate})`)
        .orderBy(desc(sql`date_trunc('day', ${orders.orderDate})`))
        .limit(30);

      return NextResponse.json({
        type: 'sales',
        data: salesByDay.map(d => ({
          ...d,
          revenue: Number(d.revenue),
          collected: Number(d.collected),
        })),
      });
    }

    if (reportType === 'collections') {
      const collections = await db
        .select({
          date: sql<string>`date_trunc('day', ${settlements.settledAt})::date`,
          count: sql<number>`count(*)`,
          amount: sql<number>`coalesce(sum(${settlements.amount}), 0)`,
          cash: sql<number>`coalesce(sum(${settlements.amount}) filter (where ${settlements.paymentMode} = 'cash'), 0)`,
          upi: sql<number>`coalesce(sum(${settlements.amount}) filter (where ${settlements.paymentMode} = 'upi'), 0)`,
          bank: sql<number>`coalesce(sum(${settlements.amount}) filter (where ${settlements.paymentMode} = 'bank'), 0)`,
        })
        .from(settlements)
        .where(!isAdmin ? eq(settlements.salespersonId, user.id) : undefined)
        .groupBy(sql`date_trunc('day', ${settlements.settledAt})`)
        .orderBy(desc(sql`date_trunc('day', ${settlements.settledAt})`))
        .limit(30);

      return NextResponse.json({
        type: 'collections',
        data: collections.map(c => ({
          ...c,
          amount: Number(c.amount),
          cash: Number(c.cash),
          upi: Number(c.upi),
          bank: Number(c.bank),
        })),
      });
    }

    if (reportType === 'customers' && isManager) {
      const customerReport = await db
        .select({
          id: customers.id,
          name: customers.name,
          city: customers.city,
          totalOrders: sql<number>`count(DISTINCT ${orders.id})`,
          totalRevenue: sql<number>`coalesce(sum(${orders.grandTotal}), 0)`,
          outstanding: sql<number>`coalesce(sum(${orders.balance}), 0)`,
          lastOrder: sql<string>`max(${orders.orderDate})`,
        })
        .from(customers)
        .leftJoin(orders, eq(orders.customerId, customers.id))
        .groupBy(customers.id)
        .orderBy(desc(sql`coalesce(sum(${orders.grandTotal}), 0)`))
        .limit(50);

      return NextResponse.json({
        type: 'customers',
        data: customerReport.map(c => ({
          ...c,
          totalRevenue: Number(c.totalRevenue),
          outstanding: Number(c.outstanding),
        })),
      });
    }

    if (reportType === 'salespeople' && isManager) {
      const spReport = await db
        .select({
          id: users.id,
          name: users.name,
          totalOrders: sql<number>`count(DISTINCT ${orders.id})`,
          totalRevenue: sql<number>`coalesce(sum(${orders.grandTotal}), 0)`,
          collected: sql<number>`coalesce(sum(${orders.amountPaid}), 0)`,
          pending: sql<number>`coalesce(sum(${orders.balance}), 0)`,
          avgOrderValue: sql<number>`coalesce(avg(${orders.grandTotal}), 0)`,
        })
        .from(users)
        .leftJoin(orders, eq(orders.salespersonId, users.id))
        .where(eq(users.role, 'salesperson'))
        .groupBy(users.id)
        .orderBy(desc(sql`coalesce(sum(${orders.grandTotal}), 0)`));

      return NextResponse.json({
        type: 'salespeople',
        data: spReport.map(sp => ({
          ...sp,
          totalRevenue: Number(sp.totalRevenue),
          collected: Number(sp.collected),
          pending: Number(sp.pending),
          avgOrderValue: Number(sp.avgOrderValue),
        })),
      });
    }

    return NextResponse.json({ type: reportType, data: [] });
  } catch (error) {
    console.error('Reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
