import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { gte, lte, and } from 'drizzle-orm';
import { generateInvoicePdf } from '@/lib/invoice-pdf';
import { ZipArchive } from 'archiver';
import { PassThrough } from 'stream';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate query parameters are required (YYYY-MM-DD)' },
        { status: 400 },
      );
    }

    // Build date range (end of day for endDate)
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    // Fetch all orders in the date range
    const matchedOrders = await db
      .select({ id: orders.id, invoiceNumber: orders.invoiceNumber })
      .from(orders)
      .where(and(gte(orders.orderDate, start), lte(orders.orderDate, end)))
      .orderBy(orders.orderDate);

    if (matchedOrders.length === 0) {
      return NextResponse.json(
        { error: 'No orders found in the specified date range' },
        { status: 404 },
      );
    }

    // Cap at 200 orders to prevent abuse
    if (matchedOrders.length > 200) {
      return NextResponse.json(
        { error: `Too many orders (${matchedOrders.length}). Maximum is 200 per export.` },
        { status: 400 },
      );
    }

    // Create a streaming ZIP archive
    const passThrough = new PassThrough();
    const archive = new ZipArchive({ zlib: { level: 6 } });

    archive.on('error', (err: Error) => {
      passThrough.destroy(err);
    });

    archive.pipe(passThrough);

    // Generate PDFs sequentially (jsPDF is not async, but DB queries are)
    let successCount = 0;
    for (const order of matchedOrders) {
      try {
        const { buffer, filename } = await generateInvoicePdf(order.id);
        archive.append(buffer, { name: filename });
        successCount++;
      } catch (genErr) {
        // Skip orders that fail to generate (e.g., missing customer)
        // Add an error marker file instead
        const errName = `ERROR-order-${order.id}-${order.invoiceNumber || 'unknown'}.txt`;
        archive.append(
          `Failed to generate invoice for order ${order.id} (${order.invoiceNumber || 'unknown'})`,
          { name: errName },
        );
      }
    }

    // Finalize the archive
    await archive.finalize();

    const zipFilename = `invoices-${startDate}-to-${endDate}.zip`;

    // Convert stream to buffer for NextResponse
    const chunks: Buffer[] = [];
    for await (const chunk of passThrough) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const zipBuffer = Buffer.concat(chunks);

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'X-Total-Orders': String(matchedOrders.length),
        'X-Successful-Invoices': String(successCount),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
