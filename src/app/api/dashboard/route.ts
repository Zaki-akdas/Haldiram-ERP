import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isManager } from '@/lib/auth';
import { db } from '@/db';
import { orders, customers, users } from '@/db/schema';
import { eq, desc, and, ne, sql, count } from 'drizzle-orm';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orderConditions = user.role === 'salesperson' ? [eq(orders.salespersonId, user.id)] : [];
    const customerConditions = user.role === 'salesperson' ? [eq(customers.assignedSalespersonId, user.id)] : [];
    
    const orderWhere = orderConditions.length > 0 ? and(...orderConditions) : undefined;
    const customerWhere = customerConditions.length > 0 ? and(...customerConditions) : undefined;

    const [{ totalOrders }] = await db.select({ totalOrders: count() }).from(orders).where(orderWhere);
    const [{ totalCustomers }] = await db.select({ totalCustomers: count() }).from(customers).where(customerWhere);

    const [{ totalRevenue }] = await db
      .select({ totalRevenue: sql<number>`sum(CAST(${orders.grandTotal} AS DECIMAL))` })
      .from(orders)
      .where(orderWhere);

    const [{ totalCollected }] = await db
      .select({ totalCollected: sql<number>`sum(CAST(${orders.amountPaid} AS DECIMAL))` })
      .from(orders)
      .where(orderWhere);

    const pendingConditions = [...orderConditions, ne(orders.settlementStatus, 'settled')];
    const [{ pendingSettlements }] = await db
      .select({ pendingSettlements: count() })
      .from(orders)
      .where(and(...pendingConditions));

    // For simplicity, just joining with a subquery or doing a second query
const recentOrdersRaw = await db
       .select({
         id: orders.id,
         invoiceNumber: orders.invoiceNumber,
         customerId: orders.customerId,
         salespersonId: orders.salespersonId,
         orderDate: orders.orderDate,
         status: orders.status,
         grandTotal: orders.grandTotal,
         amountPaid: orders.amountPaid,
         balance: orders.balance,
         createdAt: orders.createdAt,
         customerName: customers.name,
         customerPhone: customers.phone,
         salespersonName: users.name,
       })
       .from(orders)
       .leftJoin(customers, eq(orders.customerId, customers.id))
       .leftJoin(users, eq(orders.salespersonId, users.id))
       .where(orderWhere)
       .orderBy(desc(orders.createdAt))
       .limit(5);

    const recentOrders = recentOrdersRaw.map((order) => ({
      ...order,
      customer: order.customerName ? { name: order.customerName, phone: order.customerPhone } : { name: `Customer #${order.customerId}` },
      salesperson: order.salespersonName ? { name: order.salespersonName } : undefined,
    }));

    const activeReceivables = await db
      .select()
      .from(orders)
      .where(and(...orderConditions, sql`CAST(${orders.balance} AS DECIMAL) > 0`))
      .orderBy(desc(sql`CAST(${orders.balance} AS DECIMAL)`))
      .limit(10);

    let salespeoplePerformance: any[] = [];
    if (isManager(user.role)) {
      const salespeople = await db.select().from(users).where(eq(users.role, 'salesperson'));
      
      salespeoplePerformance = await Promise.all(
        salespeople.map(async (sp) => {
          const [{ spOrderCount }] = await db.select({ spOrderCount: count() }).from(orders).where(eq(orders.salespersonId, sp.id));
          const [{ spTotalRevenue }] = await db.select({ spTotalRevenue: sql<number>`sum(CAST(${orders.grandTotal} AS DECIMAL))` }).from(orders).where(eq(orders.salespersonId, sp.id));
          
          return {
            id: sp.id,
            name: sp.name,
            orderCount: spOrderCount,
            totalRevenue: spTotalRevenue || 0
          };
        })
      );
    }

    return NextResponse.json({
      totalOrders,
      totalCustomers,
      totalRevenue: totalRevenue || 0,
      totalCollected: totalCollected || 0,
      pendingSettlements,
      recentOrders,
      activeReceivables,
      ...(isManager(user.role) && { salespeoplePerformance })
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
