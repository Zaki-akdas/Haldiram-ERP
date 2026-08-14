import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { orders, orderItems, customers, users, activityLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ingestData } from '@/lib/ingestion/engine';
import { validateIngestionResult } from '@/lib/ingestion/validator';
import { IngestRequest } from '@/lib/ingestion/types';

function parseSafeDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  const str = String(val).trim();
  if (!str) return null;
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatSafeNum(val: any): string {
  const num = Number(val);
  return isNaN(num) ? '0.00' : num.toFixed(2);
}

function clampNum(val: any, maxVal = 9999999.99, decimals = 2): string {
  const num = Number(val);
  if (isNaN(num)) return (0).toFixed(decimals);
  const clamped = Math.min(Math.max(0, num), maxVal);
  return clamped.toFixed(decimals);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const contentType = req.headers.get('content-type') || '';
    let textToParse = '';
    let fileName = 'input';
    let deploymentMode: IngestRequest['deploymentMode'] = 'cloud';
    let preferredProvider: IngestRequest['preferredProvider'];
    let createOrder = false;
    let orderData: IngestRequest['orderData'];

    if (contentType.includes('application/json')) {
      const json = await req.json();
      textToParse = json.text || '';
      fileName = json.fileName || 'input';
      deploymentMode = json.deploymentMode || 'cloud';
      preferredProvider = json.preferredProvider;
      createOrder = json.createOrder || false;
      orderData = json.orderData;
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const textData = formData.get('text') as string;
      const mode = formData.get('deploymentMode') as string;
      const provider = formData.get('preferredProvider') as string;
      const shouldCreateOrder = formData.get('createOrder') === 'true';
      const orderDataStr = formData.get('orderData') as string;

      if (file) {
        fileName = file.name;
        const buffer = Buffer.from(await file.arrayBuffer());
        const ext = fileName.toLowerCase().split('.').pop() || '';
        
        if (ext === 'pdf') {
          const { parsePDF } = await import('@/lib/ingestion/parsers/pdf');
          const pdfResult = await parsePDF(buffer);
          const validation = validateIngestionResult(pdfResult);
          return NextResponse.json({
            success: true,
            result: pdfResult,
            validation,
          });
        } else if (['xlsx', 'xls', 'excel'].includes(ext)) {
          const { parseExcel } = await import('@/lib/ingestion/parsers/excel');
          const excelResult = await parseExcel(buffer, fileName);
          const validation = validateIngestionResult(excelResult);
          return NextResponse.json({
            success: true,
            result: excelResult,
            validation,
          });
        } else {
          textToParse = buffer.toString('utf-8');
        }
      } else if (textData) {
        textToParse = textData;
      }

      deploymentMode = (mode === 'local' ? 'local' : 'cloud') as IngestRequest['deploymentMode'];
      preferredProvider = provider as IngestRequest['preferredProvider'];
      createOrder = shouldCreateOrder;
      if (orderDataStr) {
        try {
          orderData = JSON.parse(orderDataStr);
        } catch {
          orderData = {};
        }
      }
    } else {
      textToParse = await req.text();
    }

    if (!textToParse) {
      return NextResponse.json({ error: 'No content provided for ingestion' }, { status: 400 });
    }

    const ingestRequest: IngestRequest = {
      text: textToParse,
      fileName,
      deploymentMode,
      preferredProvider,
      createOrder,
      orderData,
    };

    const ingestResponse = await ingestData(ingestRequest);

    if (!ingestResponse.success) {
      return NextResponse.json({ error: ingestResponse.error || 'Ingestion failed' }, { status: 400 });
    }

    const validation = validateIngestionResult(ingestResponse.result);

    // Create order if requested and extraction is valid
    let orderId: number | undefined;
    if (createOrder && validation.isValid && ingestResponse.result.items.length > 0) {
      try {
        const result = ingestResponse.result;
        const body = orderData || {};

        let targetCustomerId = Number(body.customerId) || 0;
        let customerExists = false;

        if (targetCustomerId > 0) {
          const existingCust = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, targetCustomerId)).limit(1);
          if (existingCust.length > 0) customerExists = true;
        }

        if (!customerExists) {
          const anyCust = await db.select({ id: customers.id }).from(customers).limit(1);
          if (anyCust.length > 0) {
            targetCustomerId = anyCust[0].id;
          } else {
            const [newCust] = await db.insert(customers).values({
              name: body.customerName || result.header.customerName || 'PRO SWAMI (SHARNAM ENTERPRISES)',
              gstin: body.customerGSTIN || result.header.customerGSTIN || '23AMFPV5397L1ZB',
              city: 'Bhopal',
              state: 'Madhya Pradesh',
              creditLimit: '500000.00'
            }).returning();
            targetCustomerId = newCust.id;
          }
        }

        let actualSalespersonId = body.salespersonId ? Number(body.salespersonId) : user.id;
        const existingUser = await db.select({ id: users.id }).from(users).where(eq(users.id, actualSalespersonId)).limit(1);
        if (existingUser.length === 0) {
          actualSalespersonId = user.id;
        }

        let actualInvoiceNumber = result.header.invoiceNumber || `AI-${Date.now()}`;
        const existingOrder = await db.select({ id: orders.id }).from(orders).where(eq(orders.invoiceNumber, actualInvoiceNumber)).limit(1);
        if (existingOrder.length > 0) {
          actualInvoiceNumber = `${actualInvoiceNumber}-${Date.now().toString().slice(-4)}`;
        }

        const actualOrderDate = parseSafeDate(result.header.invoiceDate) || new Date();
        const creditDays = Number(body.creditDays || 0);
        const actualDueDate = new Date(actualOrderDate.getTime() + (creditDays * 86400000));

        let subtotalCalc = 0;
        let totalTaxableAmountCalc = 0;
        let totalGstAmountCalc = 0;

        const processedItems = result.items.map((item) => {
          const quantity = Math.round(item.quantity || 1);
          const unitPrice = Number(item.unitPrice) || 0;
          const discount = Number(item.discount) || 0;
          let gstRate = Number(item.gstRate) || 5;
          if (gstRate > 28 || gstRate < 0) gstRate = 5;

          const taxableAmount = item.taxableAmount || ((quantity * unitPrice) - discount);
          const gstAmount = item.gstAmount || (taxableAmount * (gstRate / 100));
          const totalAmount = item.totalAmount || (taxableAmount + gstAmount);

          subtotalCalc += (quantity * unitPrice);
          totalTaxableAmountCalc += taxableAmount;
          totalGstAmountCalc += gstAmount;

          return {
            productId: null,
            erpId: item.erpId || null,
            productName: item.productName || 'Item',
            quantity,
            unitPrice: clampNum(unitPrice, 999999.99, 2),
            discount: clampNum(discount, 99999.99, 2),
            taxableAmount: clampNum(taxableAmount, 9999999.99, 2),
            gstRate: clampNum(gstRate, 28.00, 2),
            gstAmount: clampNum(gstAmount, 999999.99, 2),
            totalAmount: clampNum(totalAmount, 9999999.99, 2),
            shortQuantity: 0,
            returnQuantity: 0,
            unit: 'PCS',
          };
        });

        const finalSubtotal = subtotalCalc;
        const finalTaxable = totalTaxableAmountCalc;
        const finalTotalGst = totalGstAmountCalc;
        const finalGrandTotal = finalTaxable + finalTotalGst;

        const orderValues: any = {
          customerId: targetCustomerId,
          salespersonId: actualSalespersonId,
          invoiceNumber: actualInvoiceNumber,
          orderDate: actualOrderDate,
          dueDate: actualDueDate,
          status: body.status || 'pending',
          subtotal: clampNum(finalSubtotal, 9999999.99, 2),
          taxableAmount: clampNum(finalTaxable, 9999999.99, 2),
          cgst: clampNum(finalTotalGst / 2, 999999.99, 2),
          sgst: clampNum(finalTotalGst / 2, 999999.99, 2),
          igst: '0.00',
          totalGst: clampNum(finalTotalGst, 999999.99, 2),
          grandTotal: clampNum(finalGrandTotal, 9999999.99, 2),
          amountPaid: '0.00',
          balance: clampNum(finalGrandTotal, 9999999.99, 2),
          settlementStatus: 'pending',
          notes: body.notes || null,
          metadata: {
            ingestionFormat: result.format,
            ingestionProvider: result.provider,
            ingestionConfidence: result.confidence,
            ingestionWarnings: result.warnings,
          },
        };

        const [newOrder] = await db.insert(orders).values(orderValues).returning();

        for (const item of processedItems) {
          await db.insert(orderItems).values({
            orderId: newOrder.id,
            ...item,
          });
        }

        await db.insert(activityLogs).values({
          userId: user.id,
          activityType: 'order_created',
          entityType: 'order',
          entityId: newOrder.id,
          description: `Order ${actualInvoiceNumber} created via AI ingestion`,
        });

        orderId = newOrder.id;
      } catch (orderError) {
        console.error('Order creation after ingestion failed:', orderError);
        // Don't fail the whole request, just report the ingestion result
      }
    }

    return NextResponse.json({
      success: true,
      result: ingestResponse.result,
      validation,
      orderId,
    });

  } catch (error) {
    console.error('Ingestion error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
