import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, orderItems, customers, users, settlements, activityLogs } from '@/db/schema';
import { eq, and, desc, sql, ilike } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;
    const isAdmin = user.role === 'admin';

    const conditions = [];
    if (!isAdmin) conditions.push(eq(orders.salespersonId, user.id));
    if (status && status !== 'all') conditions.push(eq(orders.status, status as any));

    const orderList = await db
      .select({
        id: orders.id,
        invoiceNumber: orders.invoiceNumber,
        customerId: orders.customerId,
        customerName: customers.name,
        salespersonId: orders.salespersonId,
        salespersonName: users.name,
        orderDate: orders.orderDate,
        deliveryDate: orders.deliveryDate,
        status: orders.status,
        subtotal: orders.subtotal,
        totalGst: orders.totalGst,
        grandTotal: orders.grandTotal,
        amountPaid: orders.amountPaid,
        balance: orders.balance,
        settlementStatus: orders.settlementStatus,
        beat: orders.beat,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .innerJoin(users, eq(orders.salespersonId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(orders.orderDate))
      .limit(limit)
      .offset(offset);

    const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(orders);
    const total = Number(countRow?.count || 0);

    return NextResponse.json({
      orders: orderList.map(o => ({
        ...o,
        subtotal: Number(o.subtotal || 0),
        totalGst: Number(o.totalGst || 0),
        grandTotal: Number(o.grandTotal || 0),
        amountPaid: Number(o.amountPaid || 0),
        balance: Number(o.balance || 0),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Orders fetch error:', error);
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
    let { invoiceNumber, customerId, customerName, orderDate, items, beat, notes, creditDays } = body;

    const orderDateObj = orderDate ? new Date(orderDate) : new Date();
    let dueDate = null;
    if (creditDays && !isNaN(parseInt(creditDays))) {
      dueDate = new Date(orderDateObj);
      dueDate.setDate(dueDate.getDate() + parseInt(creditDays));
    }

    let subtotal = 0;
    let totalGst = 0;

    if (items && Array.isArray(items)) {
      for (const item of items) {
        subtotal += Number(item.taxableAmount) || 0;
        totalGst += Number(item.gstAmount) || 0;
      }
    }

    const grandTotal = subtotal + totalGst;

    if (!customerId && customerName) {
      const existing = await db.select({ id: customers.id }).from(customers).where(ilike(customers.name, customerName)).limit(1);
      if (existing.length > 0) {
        customerId = existing[0].id;
      } else {
        const [newCust] = await db.insert(customers).values({
          name: customerName,
          beat: beat || 'New Beat',
          assignedSalespersonId: user.id,
        }).returning();
        customerId = newCust.id;
      }
    }

    const existingOrder = await db.select({ id: orders.id }).from(orders).where(eq(orders.invoiceNumber, invoiceNumber)).limit(1);
    let finalInvoiceNumber = invoiceNumber;
    if (existingOrder.length > 0) {
      finalInvoiceNumber = `${invoiceNumber}-${Date.now().toString().slice(-4)}`;
    }

    const [newOrder] = await db.insert(orders).values({
      invoiceNumber: finalInvoiceNumber,
      customerId: customerId as number,
      salespersonId: user.id,
      orderDate: orderDateObj,
      dueDate: dueDate || undefined,
      creditDays: creditDays ? parseInt(creditDays) : 0,
      status: 'pending',
      subtotal: subtotal.toFixed(2),
      taxableAmount: subtotal.toFixed(2),
      totalGst: totalGst.toFixed(2),
      cgst: (totalGst / 2).toFixed(2),
      sgst: (totalGst / 2).toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      amountPaid: '0.00',
      balance: grandTotal.toFixed(2),
      settlementStatus: 'pending',
      beat,
      notes: notes || null,
    }).returning();

    if (items && Array.isArray(items) && items.length > 0) {
      const itemsToInsert = items.map((item: any) => ({
        orderId: newOrder.id,
        productId: item.productId || null,
        erpId: String(item.erpId || '').substring(0, 50),
        productName: String(item.productName || 'Unnamed Item').substring(0, 255),
        quantity: Math.max(1, parseInt(item.quantity) || 0),
        unit: String(item.unit || 'PCS').substring(0, 20),
        unitPrice: (Number(item.unitPrice) || 0).toFixed(2),
        discount: (Number(item.discount) || 0).toFixed(2),
        taxableAmount: (Number(item.taxableAmount) || 0).toFixed(2),
        gstRate: (Number(item.gstRate) || 0).toFixed(2),
        gstAmount: (Number(item.gstAmount) || 0).toFixed(2),
        totalAmount: (Number(item.totalAmount) || 0).toFixed(2),
      }));

      await db.insert(orderItems).values(itemsToInsert);
    }

    await db.insert(activityLogs).values({
      userId: user.id,
      activityType: 'order_created',
      entityType: 'order',
      entityId: newOrder.id,
      description: `Created order ${finalInvoiceNumber}`,
    });

    return NextResponse.json({ order: newOrder }, { status: 201 });
  } catch (error) {
    console.error('Order create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
