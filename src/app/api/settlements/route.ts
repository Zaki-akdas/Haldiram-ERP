import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { settlements, orders, customers, users, activityLogs } from '@/db/schema';
import { eq, desc, and, count, gte, lte, like, or } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const orderId = searchParams.get('orderId');
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const mode = searchParams.get('mode');
    const search = searchParams.get('search');

    const offset = (page - 1) * limit;
    const conditions = [];

    if (user.role === 'salesperson') {
      conditions.push(eq(settlements.salespersonId, user.id));
    }

    if (orderId) conditions.push(eq(settlements.orderId, Number(orderId)));
    if (customerId) conditions.push(eq(settlements.customerId, Number(customerId)));
    if (mode && mode !== 'All') conditions.push(eq(settlements.paymentMode, mode));
    
    if (startDate) conditions.push(gte(settlements.settledAt, new Date(startDate)));
    if (endDate) conditions.push(lte(settlements.settledAt, new Date(endDate)));

    if (search) {
      conditions.push(
        or(
          like(settlements.referenceNumber, `%${search}%`),
          like(settlements.notes, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(settlements)
      .where(whereClause);

    const rawSettlements = await db
      .select()
      .from(settlements)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(settlements.settledAt));

    const settlementsWithDetails = await Promise.all(
      rawSettlements.map(async (s) => {
        const [order] = await db.select().from(orders).where(eq(orders.id, s.orderId));
        const [customer] = order ? await db.select().from(customers).where(eq(customers.id, order.customerId)) : [];
        const [salesperson] = order ? await db.select().from(users).where(eq(users.id, order.salespersonId)) : [];

        return {
          ...s,
          date: s.settledAt ? new Date(s.settledAt).toISOString().split('T')[0] : '',
          invoiceNumber: order?.invoiceNumber || '',
          customerName: customer?.name || '',
          salespersonName: salesperson?.name || '',
          mode: s.paymentMode || '',
        };
      })
    );

    return NextResponse.json({
      settlements: settlementsWithDetails,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { orderId, customerId, salespersonId, amount, cashAmount, onlineAmount, paymentMode, denominations, clearingDays, referenceNumber, notes } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }
    if (amount === undefined || amount === null || isNaN(Number(amount))) {
      return NextResponse.json({ error: 'amount is required' }, { status: 400 });
    }

    // Resolve the order first: its customer/salesperson back the settlement,
    // and it drives the balance update below (orderId may be a string).
    const [order] = await db.select().from(orders).where(eq(orders.id, Number(orderId)));
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const actualCustomerId = Number(customerId) || order.customerId;
    const actualSalespersonId = Number(salespersonId) || order.salespersonId;

    const [newSettlement] = await db.insert(settlements).values({
      orderId: order.id,
      customerId: actualCustomerId,
      salespersonId: actualSalespersonId,
      amount: amount.toString(),
      cashAmount: cashAmount?.toString() || '0',
      onlineAmount: onlineAmount?.toString() || '0',
      paymentMode,
      denominations,
      clearingDays,
      referenceNumber,
      notes,
    }).returning();

    const newAmountPaid = Number(order.amountPaid) + Number(amount);
    const balance = Number(order.grandTotal) - newAmountPaid;

    let settlementStatus = 'pending';
    if (balance <= 0) {
      settlementStatus = 'settled';
    } else if (newAmountPaid > 0) {
      settlementStatus = 'partial';
    }

    await db.update(orders)
      .set({
        amountPaid: newAmountPaid.toString(),
        balance: Math.max(0, balance).toString(),
        settlementStatus: settlementStatus as any,
        updatedAt: new Date()
      })
      .where(eq(orders.id, order.id));

    await db.insert(activityLogs).values({
      userId: user.id,
      activityType: 'settlement',
      entityType: 'settlement',
      entityId: newSettlement.id,
      description: `Settlement of ₹${amount} recorded for Order #${order.id}`
    });

    return NextResponse.json(newSettlement, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const ids: number[] = Array.isArray(body?.ids) ? body.ids.map(Number) : (body?.id ? [Number(body.id)] : []);

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No settlement IDs provided' }, { status: 400 });
    }

    const deletedSettlements = [];
    for (const id of ids) {
      const [deleted] = await db.delete(settlements).where(eq(settlements.id, id)).returning();
      if (deleted) {
        deletedSettlements.push(deleted);
      }
    }

    const orderIds = [...new Set(deletedSettlements.map((s: any) => s.orderId))];
    for (const orderId of orderIds) {
      const allSettlements = await db.select().from(settlements).where(eq(settlements.orderId, orderId));
      const totalPaid = allSettlements.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);

      const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
      if (order) {
        let settlementStatus = 'pending';
        if (totalPaid >= Number(order.grandTotal)) {
          settlementStatus = 'settled';
        } else if (totalPaid > 0) {
          settlementStatus = 'partial';
        }

        await db.update(orders)
          .set({
            amountPaid: totalPaid.toString(),
            balance: Math.max(0, Number(order.grandTotal) - totalPaid).toString(),
            settlementStatus: settlementStatus as any,
            updatedAt: new Date()
          })
          .where(eq(orders.id, orderId));
      }
    }

    return NextResponse.json({ success: true, count: ids.length });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
