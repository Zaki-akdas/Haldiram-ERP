import { NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, customers, products, users, settlements } from '@/db/schema';
import { eq, sql, and, gte, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'manager' || user.role === 'admin';

    const [orderStats] = await db
      .select({
        total: sql<number>`count(*)`,
        pending: sql<number>`count(*) filter (where ${orders.status} = 'pending')`,
        delivered: sql<number>`count(*) filter (where ${orders.status} = 'delivered')`,
        totalAmount: sql<number>`coalesce(sum(${orders.grandTotal}), 0)`,
      })
      .from(orders)
      .where(!isAdmin ? eq(orders.salespersonId, user.id) : undefined);

    const todayConditions = [gte(orders.orderDate, startOfToday)];
    if (!isAdmin) todayConditions.push(eq(orders.salespersonId, user.id));

    const [todayStats] = await db
      .select({
        count: sql<number>`count(*)`,
        totalValue: sql<number>`coalesce(sum(${orders.grandTotal}), 0)`,
        collectedToday: sql<number>`coalesce(sum(${orders.amountPaid}), 0)`,
        pendingValue: sql<number>`coalesce(sum(${orders.balance}), 0)`,
      })
      .from(orders)
      .where(and(...todayConditions));

    const monthConditions = [gte(orders.orderDate, startOfMonth)];
    if (!isAdmin) monthConditions.push(eq(orders.salespersonId, user.id));

    const [monthlyStats] = await db
      .select({
        orders: sql<number>`count(*)`,
        revenue: sql<number>`coalesce(sum(${orders.grandTotal}), 0)`,
        collected: sql<number>`coalesce(sum(${orders.amountPaid}), 0)`,
      })
      .from(orders)
      .where(and(...monthConditions));

    let totalCustomers = 0;
    let activeCustomers = 0;
    if (!isAdmin) {
      const custResult = await db.select().from(customers).where(eq(customers.assignedSalespersonId, user.id));
      totalCustomers = custResult.length;
      activeCustomers = custResult.filter((c: any) => c.isActive).length;
    } else {
      const [customerStats] = await db
        .select({
          total: sql<number>`count(*)`,
          active: sql<number>`count(*) filter (where ${customers.isActive} = true)`,
        })
        .from(customers);
      totalCustomers = Number(customerStats?.total || 0);
      activeCustomers = Number(customerStats?.active || 0);
    }

    const [productStats] = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${products.isActive} = true)`,
      })
      .from(products);

    const recentOrders = await db
      .select({
        id: orders.id,
        invoiceNumber: orders.invoiceNumber,
        customerName: customers.name,
        grandTotal: orders.grandTotal,
        status: orders.status,
        orderDate: orders.orderDate,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(!isAdmin ? eq(orders.salespersonId, user.id) : undefined)
      .orderBy(desc(orders.orderDate))
      .limit(5);

    const pendingSettlements = await db
      .select({
        id: orders.id,
        invoiceNumber: orders.invoiceNumber,
        customerName: customers.name,
        balance: orders.balance,
        orderDate: orders.orderDate,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(
        and(
          sql`${orders.balance} > 0`,
          !isAdmin ? eq(orders.salespersonId, user.id) : undefined
        )
      )
      .orderBy(desc(orders.orderDate))
      .limit(5);

    let salespersonStats: any[] = [];
    if (isManager) {
      salespersonStats = await db
        .select({
          id: users.id,
          name: users.name,
          orders: sql<number>`count(${orders.id})`,
          revenue: sql<number>`coalesce(sum(${orders.grandTotal}), 0)`,
        })
        .from(users)
        .leftJoin(orders, and(
          eq(orders.salespersonId, users.id),
          gte(orders.orderDate, startOfMonth)
        ))
        .where(eq(users.role, 'salesperson'))
        .groupBy(users.id, users.name)
        .orderBy(desc(sql`coalesce(sum(${orders.grandTotal}), 0)`))
        .limit(10);
    }

    return NextResponse.json({
      stats: {
        todayOrders: Number(todayStats?.count || 0),
        todayRevenue: Number(todayStats?.totalValue || 0),
        todayPending: Number(todayStats?.pendingValue || 0),
        todayCollected: Number(todayStats?.collectedToday || 0),
        totalOrders: Number(orderStats?.total || 0),
        pendingOrders: Number(orderStats?.pending || 0),
        deliveredOrders: Number(orderStats?.delivered || 0),
        totalRevenue: Number(orderStats?.totalAmount || 0),
        monthlyOrders: Number(monthlyStats?.orders || 0),
        monthlyRevenue: Number(monthlyStats?.revenue || 0),
        monthlyCollected: Number(monthlyStats?.collected || 0),
        totalCustomers,
        activeCustomers,
        totalProducts: Number(productStats?.total || 0),
        activeProducts: Number(productStats?.active || 0),
      },
      recentOrders: recentOrders.map(o => ({
        ...o,
        grandTotal: Number(o.grandTotal),
      })),
      pendingSettlements: pendingSettlements.map(s => ({
        ...s,
        balance: Number(s.balance),
      })),
      salespersonStats,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
