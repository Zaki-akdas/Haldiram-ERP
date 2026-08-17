import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { orders, orderItems, customers, users, activityLogs, orderStatusEnum, products, type NewOrder } from '@/db/schema';

type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
import { eq, sql } from 'drizzle-orm';
import { ingestData } from '@/lib/ingestion/engine';
import { validateIngestionResult } from '@/lib/ingestion/validator';
import { IngestRequest, IngestResult } from '@/lib/ingestion/types';
import { matchItemsToCatalog, enrichItemFromCatalog, aggregateStockDeductions } from '@/lib/product-match';

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
    // Structured result from a parsed PDF/Excel file upload, used when the
    // request carries no client-reviewed extraction.
    let fileParseResult: IngestResult | undefined;
    // Optional client-reviewed extraction (the user may have edited items and
    // header fields after the initial parse). When present, it is used as the
    // source of truth instead of re-parsing the raw input.
    let review: Partial<IngestResult> | undefined;

    if (contentType.includes('application/json')) {
      const json = await req.json();
      textToParse = json.text || '';
      fileName = json.fileName || 'input';
      deploymentMode = json.deploymentMode || 'cloud';
      preferredProvider = json.preferredProvider;
      createOrder = json.createOrder || false;
      orderData = json.orderData;
      review = json.review;
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
          fileParseResult = await parsePDF(buffer);
        } else if (['xlsx', 'xls', 'excel'].includes(ext)) {
          const { parseExcel } = await import('@/lib/ingestion/parsers/excel');
          fileParseResult = await parseExcel(buffer, fileName);
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
      const reviewStr = formData.get('review') as string;
      if (reviewStr) {
        try {
          review = JSON.parse(reviewStr);
        } catch {
          review = undefined;
        }
      }
    } else {
      textToParse = await req.text();
    }

    let ingestResponse: { success: boolean; result: IngestResult; error?: string };

    if (review && Array.isArray(review.items) && review.items.length > 0) {
      // Client-reviewed extraction (edits applied in the review UI) — use it
      // as-is so the order matches exactly what the user confirmed, without
      // re-parsing (or re-invoking billable AI providers) on the raw input.
      ingestResponse = {
        success: true,
        result: {
          format: review.format || 'text',
          header: review.header || {},
          items: review.items as IngestResult['items'],
          confidence: Number(review.confidence) || 0,
          warnings: Array.isArray(review.warnings) ? review.warnings : [],
          provider: typeof review.provider === 'string' ? review.provider : 'manual-review',
          processingTimeMs: 0,
        },
      };
    } else if (fileParseResult) {
      // Direct PDF/Excel upload: the parsed result flows into the shared
      // validation and (optionally) order-creation path below.
      ingestResponse = { success: true, result: fileParseResult };
    } else {
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

      ingestResponse = await ingestData(ingestRequest);

      if (!ingestResponse.success) {
        return NextResponse.json({ error: ingestResponse.error || 'Ingestion failed' }, { status: 400 });
      }
    }

    const validation = validateIngestionResult(ingestResponse.result);

    // Create order if requested and the (possibly reviewed) extraction is valid
    let orderId: number | undefined;
    let orderCreationSkipped: string | undefined;
    if (createOrder) {
      if (ingestResponse.result.items.length === 0) {
        orderCreationSkipped = 'No line items to create an order from.';
      } else if (!validation.isValid) {
        orderCreationSkipped = `Validation score ${validation.score}/100 is below the 60% threshold required to create an order.`;
      } else {
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
          // Resolve the bill's customer: match by GSTIN, then by name, then
          // create it from the bill. Only fall back to an arbitrary customer
          // when the bill carries no customer details at all, so an order is
          // never silently attached to the wrong account.
          const billGstin = (body.customerGSTIN || result.header.customerGSTIN || '').trim();
          const billName = (body.customerName || result.header.customerName || '').trim();

          if (billGstin) {
            const byGstin = await db.select({ id: customers.id }).from(customers).where(eq(customers.gstin, billGstin)).limit(1);
            if (byGstin.length > 0) {
              targetCustomerId = byGstin[0].id;
              customerExists = true;
            }
          }

          if (!customerExists && billName) {
            const byName = await db.select({ id: customers.id }).from(customers).where(eq(customers.name, billName)).limit(1);
            if (byName.length > 0) {
              targetCustomerId = byName[0].id;
              customerExists = true;
            }
          }

          if (!customerExists) {
            if (billName || billGstin) {
              const [newCust] = await db.insert(customers).values({
                name: billName || 'Unknown Customer',
                gstin: billGstin || null,
                city: 'Bhopal',
                state: 'Madhya Pradesh',
                creditLimit: '500000.00'
              }).returning();
              targetCustomerId = newCust.id;
            } else {
              const anyCust = await db.select({ id: customers.id }).from(customers).limit(1);
              if (anyCust.length > 0) {
                targetCustomerId = anyCust[0].id;
              } else {
                const [newCust] = await db.insert(customers).values({
                  name: 'PRO SWAMI (SHARNAM ENTERPRISES)',
                  gstin: '23AMFPV5397L1ZB',
                  city: 'Bhopal',
                  state: 'Madhya Pradesh',
                  creditLimit: '500000.00'
                }).returning();
                targetCustomerId = newCust.id;
              }
            }
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
        let matchedProductCount = 0;

        // Load the product catalog once so extracted line items link to real
        // product records when the bill references them (ERP ID, then name),
        // and so assumed GST rates / units can be filled from the catalog.
        const catalogProducts = await db.select({
          id: products.id,
          erpId: products.erpId,
          name: products.name,
          gstRate: products.gstRate,
          unit: products.unit,
        }).from(products);
        const matchedProductIds = matchItemsToCatalog(result.items, catalogProducts);
        const productById = new Map(catalogProducts.map((p) => [p.id, p]));

        const processedItems = result.items.map((item, index) => {
          const quantity = Math.round(item.quantity || 1);
          const unitPrice = Number(item.unitPrice) || 0;
          const discount = Number(item.discount) || 0;

          // A product the user linked manually in the review UI wins; fall back
          // to the automatic ERP ID / name match when absent or stale.
          let productId = item.productId != null ? Number(item.productId) : null;
          if (productId !== null && !productById.has(productId)) productId = null;
          if (productId === null) productId = matchedProductIds[index] ?? null;
          if (productId !== null) matchedProductCount += 1;

          const taxableAmount = item.taxableAmount || ((quantity * unitPrice) - discount);
          const enriched = enrichItemFromCatalog(
            { ...item, taxableAmount },
            productId !== null ? productById.get(productId) : undefined
          );

          subtotalCalc += (quantity * unitPrice);
          totalTaxableAmountCalc += taxableAmount;
          totalGstAmountCalc += enriched.gstAmount;

          return {
            productId,
            erpId: item.erpId || null,
            productName: item.productName || 'Item',
            quantity,
            unitPrice: clampNum(unitPrice, 999999.99, 2),
            discount: clampNum(discount, 99999.99, 2),
            taxableAmount: clampNum(taxableAmount, 9999999.99, 2),
            gstRate: clampNum(enriched.gstRate, 28.00, 2),
            gstAmount: clampNum(enriched.gstAmount, 999999.99, 2),
            totalAmount: clampNum(enriched.totalAmount, 9999999.99, 2),
            shortQuantity: 0,
            returnQuantity: 0,
            unit: enriched.unit,
          };
        });

        const finalSubtotal = subtotalCalc;
        const finalTaxable = totalTaxableAmountCalc;
        const finalTotalGst = totalGstAmountCalc;
        const finalGrandTotal = finalTaxable + finalTotalGst;

        const orderValues: NewOrder = {
          customerId: targetCustomerId,
          salespersonId: actualSalespersonId,
          invoiceNumber: actualInvoiceNumber,
          orderDate: actualOrderDate,
          dueDate: actualDueDate,
          status: (body.status as OrderStatus) || 'pending',
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
          creditDays: Number(creditDays) || 0,
          notes: body.notes || null,
          metadata: {
            ingestionFormat: result.format,
            ingestionProvider: result.provider,
            ingestionConfidence: result.confidence,
            ingestionWarnings: result.warnings,
            matchedProducts: matchedProductCount,
          },
        };

        const newOrder = await db.transaction(async (tx) => {
          const [created] = await tx.insert(orders).values(orderValues).returning();

          for (const item of processedItems) {
            await tx.insert(orderItems).values({
              orderId: created.id,
              ...item,
            });
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
            description: `Order ${actualInvoiceNumber} created via AI ingestion`,
          });

          return created;
        });

        orderId = newOrder.id;
        } catch (orderError) {
          console.error('Order creation after ingestion failed:', orderError);
          orderCreationSkipped = 'Order creation failed on the server — check the logs.';
        }
      }
    }

    return NextResponse.json({
      success: true,
      result: ingestResponse.result,
      validation,
      orderId,
      orderCreationSkipped,
    });

  } catch (error) {
    console.error('Ingestion error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
