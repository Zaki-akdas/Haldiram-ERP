import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { orders, orderItems, customers, users, activityLogs, settlements, orderStatusEnum, products, type NewOrder, type OrderItem } from '@/db/schema';
import { eq, desc, and, count, gte, lte, like, or, sql, type SQL } from 'drizzle-orm';
import { aggregateStockDeductions } from '@/lib/product-match';

type OrderStatus = (typeof orderStatusEnum.enumValues)[number];

interface OrderItemPayload {
  productId?: number | string | null;
  erpId?: string | null;
  productName?: string;
  quantity?: number | string;
  unitPrice?: number | string;
  discount?: number | string;
  taxableAmount?: number | string;
  gstRate?: number | string;
  gstAmount?: number | string;
  totalAmount?: number | string;
  shortQuantity?: number | string;
  returnQuantity?: number | string;
}

interface OrderPayload {
  customerId?: number | string;
  customerName?: string;
  customerGSTIN?: string;
  salespersonId?: number | string;
  invoiceNumber?: string;
  orderDate?: string | Date;
  deliveryDate?: string | Date;
  dueDate?: string | Date;
  status?: OrderStatus | string;
  items?: OrderItemPayload[];
  beat?: string;
  notes?: string;
  creditDays?: number | string;
  subtotal?: number | string;
  taxableAmount?: number | string;
  totalGst?: number | string;
  cgst?: number | string;
  sgst?: number | string;
  igst?: number | string;
  grandTotal?: number | string;
  id?: number | string;
  ids?: (number | string)[];
}

function parseSafeDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  const str = String(val).trim();
  if (!str) return null;
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatSafeNum(val: unknown): string {
  const num = Number(val);
  return isNaN(num) ? '0.00' : num.toFixed(2);
}

function clampNum(val: unknown, maxVal = 9999999.99, decimals = 2): string {
  const num = Number(val);
  if (isNaN(num)) return (0).toFixed(decimals);
  const clamped = Math.min(Math.max(0, num), maxVal);
  return clamped.toFixed(decimals);
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    
    const offset = (page - 1) * limit;

    const conditions: (SQL | undefined)[] = [];

    if (user.role === 'salesperson') {
      conditions.push(eq(orders.salespersonId, user.id));
    }

    if (status) conditions.push(eq(orders.status, status as OrderStatus));
    if (customerId) conditions.push(eq(orders.customerId, Number(customerId)));
    
    if (startDate) {
      const parsedStart = parseSafeDate(startDate);
      if (parsedStart) conditions.push(gte(orders.orderDate, parsedStart));
    }
    if (endDate) {
      const parsedEnd = parseSafeDate(endDate);
      if (parsedEnd) conditions.push(lte(orders.orderDate, parsedEnd));
    }

    if (search) {
      conditions.push(
        or(
          like(orders.invoiceNumber, `%${search}%`),
          like(customers.name, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(whereClause);

const data = await db
       .select({
         id: orders.id,
         invoiceNumber: orders.invoiceNumber,
         customerId: orders.customerId,
         salespersonId: orders.salespersonId,
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
         creditDays: orders.creditDays,
         dueDate: orders.dueDate,
         metadata: orders.metadata,
         createdAt: orders.createdAt,
         updatedAt: orders.updatedAt,
         customer: customers,
         salesperson: users,
       })
       .from(orders)
       .leftJoin(customers, eq(orders.customerId, customers.id))
       .leftJoin(users, eq(orders.salespersonId, users.id))
       .where(whereClause)
       .limit(limit)
       .offset(offset)
       .orderBy(desc(orders.createdAt));

    return NextResponse.json({
      orders: data,
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

    const body = await req.json() as OrderPayload;
    const { customerId, salespersonId, invoiceNumber, orderDate, deliveryDate, status, items, beat, notes, creditDays = 0, dueDate } = body;

    // 1. Resolve or Auto-create Customer to prevent Foreign Key Violation
    let targetCustomerId = Number(customerId) || 0;
    let customerExists = false;

    if (targetCustomerId > 0) {
      const existingCust = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, targetCustomerId)).limit(1);
      if (existingCust.length > 0) {
        customerExists = true;
      }
    }

    if (!customerExists) {
      const anyCust = await db.select({ id: customers.id }).from(customers).limit(1);
      if (anyCust.length > 0) {
        targetCustomerId = anyCust[0].id;
      } else {
        const [newCust] = await db.insert(customers).values({
          name: body.customerName || 'PRO SWAMI (SHARNAM ENTERPRISES)',
          gstin: body.customerGSTIN || '23AMFPV5397L1ZB',
          city: 'Bhopal',
          state: 'Madhya Pradesh',
          creditLimit: '500000.00'
        }).returning();
        targetCustomerId = newCust.id;
      }
    }

    // 2. Resolve Salesperson ID safely
    let actualSalespersonId = salespersonId ? Number(salespersonId) : user.id;
    const existingUser = await db.select({ id: users.id }).from(users).where(eq(users.id, actualSalespersonId)).limit(1);
    if (existingUser.length === 0) {
      actualSalespersonId = user.id;
    }

    // 3. Ensure invoiceNumber is unique
    let actualInvoiceNumber = invoiceNumber || `INV-${Date.now()}`;
    const existingOrder = await db.select({ id: orders.id }).from(orders).where(eq(orders.invoiceNumber, actualInvoiceNumber)).limit(1);
    if (existingOrder.length > 0) {
      actualInvoiceNumber = `${actualInvoiceNumber}-${Date.now().toString().slice(-4)}`;
    }

    const actualOrderDate = parseSafeDate(orderDate) || new Date();
    const actualDeliveryDate = parseSafeDate(deliveryDate);
    const actualDueDate = parseSafeDate(dueDate) || new Date(actualOrderDate.getTime() + (Number(creditDays || 0) * 86400000));

    let subtotalCalc = 0;
    let totalTaxableAmountCalc = 0;
    let totalGstAmountCalc = 0;

    const processedItems = (items || []).map((item: OrderItemPayload) => {
      const quantity = Number(item.quantity) || 1;
      const unitPrice = Number(item.unitPrice) || 0;
      const discount = Number(item.discount) || 0;
      let gstRate = Number(item.gstRate) || 5;

      // Ensure gstRate never exceeds 28% GST scale
      if (gstRate > 28 || gstRate < 0) gstRate = 5;

      const taxableAmount = item.taxableAmount !== undefined ? Number(item.taxableAmount) : ((quantity * unitPrice) - discount);
      const gstAmount = item.gstAmount !== undefined ? Number(item.gstAmount) : (taxableAmount * (gstRate / 100));
      const totalAmount = item.totalAmount !== undefined ? Number(item.totalAmount) : (taxableAmount + gstAmount);

      subtotalCalc += (quantity * unitPrice);
      totalTaxableAmountCalc += taxableAmount;
      totalGstAmountCalc += gstAmount;

      return {
        ...item,
        productId: item.productId ? Number(item.productId) : null,
        erpId: item.erpId || null,
        productName: item.productName || 'Item',
        quantity: Math.round(Number(item.quantity) || 1),
        unitPrice: clampNum(unitPrice, 999999.99, 2),
        discount: clampNum(discount, 99999.99, 2),
        taxableAmount: clampNum(taxableAmount, 9999999.99, 2),
        gstRate: clampNum(gstRate, 28.00, 2),
        gstAmount: clampNum(gstAmount, 999999.99, 2),
        totalAmount: clampNum(totalAmount, 9999999.99, 2),
        shortQuantity: Math.round(Number(item.shortQuantity) || 0),
        returnQuantity: Math.round(Number(item.returnQuantity) || 0),
      };
    });

    const finalSubtotal = body.subtotal !== undefined ? Number(body.subtotal) : subtotalCalc;
    const finalTaxable = body.taxableAmount !== undefined ? Number(body.taxableAmount) : totalTaxableAmountCalc;
    const finalTotalGst = body.totalGst !== undefined ? Number(body.totalGst) : totalGstAmountCalc;
    const finalCgst = body.cgst !== undefined ? Number(body.cgst) : (finalTotalGst / 2);
    const finalSgst = body.sgst !== undefined ? Number(body.sgst) : (finalTotalGst / 2);
    const finalIgst = body.igst !== undefined ? Number(body.igst) : 0;
    const finalGrandTotal = body.grandTotal !== undefined ? Number(body.grandTotal) : (finalTaxable + finalTotalGst);

    const orderValues: NewOrder = {
      customerId: targetCustomerId,
      salespersonId: actualSalespersonId,
      invoiceNumber: actualInvoiceNumber,
      orderDate: actualOrderDate,
      dueDate: actualDueDate,
      status: (status as OrderStatus) || 'pending',
      subtotal: clampNum(finalSubtotal, 9999999.99, 2),
      taxableAmount: clampNum(finalTaxable, 9999999.99, 2),
      cgst: clampNum(finalCgst, 999999.99, 2),
      sgst: clampNum(finalSgst, 999999.99, 2),
      igst: clampNum(finalIgst, 999999.99, 2),
      totalGst: clampNum(finalTotalGst, 999999.99, 2),
      grandTotal: clampNum(finalGrandTotal, 9999999.99, 2),
      amountPaid: '0.00',
      balance: clampNum(finalGrandTotal, 9999999.99, 2),
      settlementStatus: 'pending',
      notes: notes || null,
    };

    if (actualDeliveryDate) {
      orderValues.deliveryDate = actualDeliveryDate;
    }
    if (beat && String(beat).trim() !== '') {
      orderValues.beat = String(beat).trim();
    }

    const insertedItems: OrderItem[] = [];
    const newOrder = await db.transaction(async (tx) => {
      const [created] = await tx.insert(orders).values(orderValues).returning();

      if (processedItems.length > 0) {
        for (const item of processedItems) {
          const orderItem = {
            orderId: created.id,
            productId: item.productId ? Number(item.productId) : null,
            erpId: item.erpId || null,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            taxableAmount: item.taxableAmount,
            gstRate: item.gstRate,
            gstAmount: item.gstAmount,
            totalAmount: item.totalAmount,
            shortQuantity: item.shortQuantity ?? 0,
            returnQuantity: item.returnQuantity ?? 0,
            unit: 'PCS',
          };
          const [inserted] = await tx.insert(orderItems).values(orderItem).returning();
          insertedItems.push(inserted);
        }
      }

      // Deduct catalog stock for items matched to a product record.
      for (const deduction of aggregateStockDeductions(processedItems)) {
        await tx.update(products).set({
          stockQty: sql`${products.stockQty} - ${deduction.quantity}`,
          updatedAt: new Date(),
        }).where(eq(products.id, deduction.productId));
      }

      await tx.insert(activityLogs).values({
        userId: user.id,
        activityType: 'order_created',
        entityType: 'order',
        entityId: created.id,
        description: `Order ${actualInvoiceNumber} created`
      });

      return created;
    });

    return NextResponse.json({ order: newOrder, items: insertedItems }, { status: 201 });
  } catch (error) {
    console.error('Order creation error:', error);
    const err = error as Error & { cause?: { message?: string; toString?: () => string } };
    const causeMessage = err.cause?.message || err.cause?.toString?.() || '';
    const baseMessage = err.message || 'Failed to create order';
    return NextResponse.json({ error: causeMessage ? `${baseMessage}: ${causeMessage}` : baseMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const ids: number[] = Array.isArray(body?.ids) ? body.ids.map(Number) : (body?.id ? [Number(body.id)] : []);

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No order IDs provided' }, { status: 400 });
    }

    for (const id of ids) {
      await db.delete(orderItems).where(eq(orderItems.orderId, id));
      // Payment records reference the order — remove them so no orphans remain.
      await db.delete(settlements).where(eq(settlements.orderId, id));
      await db.delete(orders).where(eq(orders.id, id));
    }

    return NextResponse.json({ success: true, count: ids.length });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
