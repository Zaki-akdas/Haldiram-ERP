import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isManager } from '@/lib/auth';
import { db } from '@/db';
import { orders, settlements, customers, users } from '@/db/schema';
import { eq, and, sql, gte, lte, count, inArray } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') || 'sales';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const dateConditions = [];
    if (startDate) dateConditions.push(gte(orders.orderDate, new Date(startDate)));
    if (endDate) dateConditions.push(lte(orders.orderDate, new Date(endDate)));

    if (type === 'sales') {
      const orderWhere = dateConditions.length > 0 ? and(...dateConditions) : undefined;
      const data = await db
        .select({
          date: sql<string>`DATE(${orders.orderDate})`,
          totalSales: sql<number>`sum(CAST(${orders.grandTotal} AS DECIMAL))`,
          orderCount: sql<number>`count(*)`
        })
        .from(orders)
        .where(orderWhere)
        .groupBy(sql`DATE(${orders.orderDate})`)
        .orderBy(sql`DATE(${orders.orderDate})`);
        
      const summary = {
        totalSales: data.reduce((acc, curr) => acc + Number(curr.totalSales || 0), 0),
        totalOrders: data.reduce((acc, curr) => acc + Number(curr.orderCount || 0), 0)
      };
      
      return NextResponse.json({ data, summary });
    }
    
    if (type === 'collections') {
      const sDateConds = [];
      if (startDate) sDateConds.push(gte(settlements.settledAt, new Date(startDate)));
      if (endDate) sDateConds.push(lte(settlements.settledAt, new Date(endDate)));
      
      const sWhere = sDateConds.length > 0 ? and(...sDateConds) : undefined;
      
      const data = await db
        .select({
          date: sql<string>`DATE(${settlements.settledAt})`,
          paymentMode: settlements.paymentMode,
          totalAmount: sql<number>`sum(CAST(${settlements.amount} AS DECIMAL))`
        })
        .from(settlements)
        .where(sWhere)
        .groupBy(sql`DATE(${settlements.settledAt})`, settlements.paymentMode);
        
      const summary = {
        totalCollections: data.reduce((acc, curr) => acc + Number(curr.totalAmount || 0), 0)
      };
      
      return NextResponse.json({ data, summary });
    }
    
    if (type === 'customers') {
      const allCustomers = await db.select().from(customers);
      const customerIds = allCustomers.map(c => c.id);

      const customerOrders = customerIds.length > 0 ? await db
        .select({ customerId: orders.customerId, orderCount: count(), totalSpent: sql<number>`sum(CAST(${orders.grandTotal} AS DECIMAL))`, totalPaid: sql<number>`sum(CAST(${orders.amountPaid} AS DECIMAL))` })
        .from(orders)
        .where(inArray(orders.customerId, customerIds))
        .groupBy(orders.customerId) : [];

      const result = allCustomers.map((c) => {
        const custData = customerOrders.find(co => co.customerId === c.id);
        const totalSpent = Number(custData?.totalSpent || 0);
        const totalPaid = Number(custData?.totalPaid || 0);
        return {
          ...c,
          orderCount: custData?.orderCount || 0,
          totalSpent,
          outstanding: totalSpent - totalPaid
        };
      });

      return NextResponse.json({ data: result, summary: {} });
    }
    
    if (type === 'salespeople') {
      if (!isManager(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      
      const salespeople = await db.select().from(users).where(eq(users.role, 'salesperson'));
      const spIds = salespeople.map(s => s.id);

      const spOrders = spIds.length > 0 ? await db
        .select({ salespersonId: orders.salespersonId, orderCount: count(), totalSales: sql<number>`sum(CAST(${orders.grandTotal} AS DECIMAL))`, totalCollections: sql<number>`sum(CAST(${orders.amountPaid} AS DECIMAL))` })
        .from(orders)
        .where(inArray(orders.salespersonId, spIds))
        .groupBy(orders.salespersonId) : [];

      const result = salespeople.map((u) => {
        const spData = spOrders.find(so => so.salespersonId === u.id);
        return {
          ...u,
          orderCount: spData?.orderCount || 0,
          totalSales: Number(spData?.totalSales || 0),
          totalCollections: Number(spData?.totalCollections || 0)
        };
      });
      
      return NextResponse.json({ data: result, summary: {} });
    }

    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
