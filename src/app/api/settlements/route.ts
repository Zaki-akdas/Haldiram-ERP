import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { settlements, orders, customers, users, activityLogs } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;
    const isAdmin = user.role === 'admin';

    const whereClause = !isAdmin ? eq(settlements.salespersonId, user.id) : undefined;

    const [settlementList, countResult] = await Promise.all([
      db
        .select({
          id: settlements.id,
          orderId: settlements.orderId,
          invoiceNumber: orders.invoiceNumber,
          customerId: settlements.customerId,
          customerName: customers.name,
          salespersonId: settlements.salespersonId,
          salespersonName: users.name,
          amount: settlements.amount,
          paymentMode: settlements.paymentMode,
          referenceNumber: settlements.referenceNumber,
          notes: settlements.notes,
          settledAt: settlements.settledAt,
          createdAt: settlements.createdAt,
        })
        .from(settlements)
        .innerJoin(orders, eq(settlements.orderId, orders.id))
        .innerJoin(customers, eq(settlements.customerId, customers.id))
        .innerJoin(users, eq(settlements.salespersonId, users.id))
        .where(whereClause)
        .orderBy(desc(settlements.settledAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(settlements)
        .where(whereClause),
    ]);

    return NextResponse.json({
      settlements: settlementList.map(s => ({
        ...s,
        amount: Number(s.amount),
      })),
      pagination: {
        page,
        limit,
        total: Number(countResult[0]?.count || 0),
        totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Settlements fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, amount, paymentMode, cashAmount, onlineAmount, denominations, clearingDays, referenceNumber, notes } = body;

    if (!orderId || amount === undefined || !paymentMode) {
      return NextResponse.json(
        { error: 'Order ID, amount, and payment mode are required' },
        { status: 400 }
      );
    }

    const [orderWithCustomer] = await db
      .select({
        order: orders,
        customerName: customers.name,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(eq(orders.id, orderId));

    if (!orderWithCustomer) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const { order, customerName } = orderWithCustomer;
    const currentBalance = Number(order.balance);
    if (amount > currentBalance + 0.5) {
      return NextResponse.json(
        { error: `Amount exceeds balance (₹${currentBalance.toFixed(2)})` },
        { status: 400 }
      );
    }

    const [newSettlement] = await db.insert(settlements).values({
      orderId,
      customerId: order.customerId,
      salespersonId: user.id,
      amount: amount.toString(),
      cashAmount: (cashAmount || 0).toString(),
      onlineAmount: (onlineAmount || 0).toString(),
      paymentMode,
      denominations: denominations || null,
      clearingDays: parseInt(clearingDays) || 0,
      referenceNumber,
      notes: notes || null,
    }).returning();

    const newAmountPaid = Number(order.amountPaid) + amount;
    const newBalance = Math.max(0, Number(order.grandTotal) - newAmountPaid);
    const newStatus = newBalance <= 0 ? 'settled' : (newAmountPaid > 0 ? 'partial' : 'pending');

    await db.update(orders).set({
      amountPaid: newAmountPaid.toFixed(2),
      balance: newBalance.toFixed(2),
      settlementStatus: newStatus,
    }).where(eq(orders.id, orderId));

    await db.insert(activityLogs).values({
      userId: user.id,
      activityType: 'settlement',
      entityType: 'settlement',
      entityId: newSettlement.id,
      description: `Bill Punched: Collected ₹${amount} from ${customerName} for ${order.invoiceNumber} (${paymentMode})`,
      metadata: { orderId, amount, paymentMode, shop: customerName, invoice: order.invoiceNumber, denominations },
    });

    return NextResponse.json({ settlement: newSettlement }, { status: 201 });
  } catch (error) {
    console.error('Settlement create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
