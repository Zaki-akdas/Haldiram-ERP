import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import {
  orders,
  orderItems,
  customers,
  users,
  products,
  companySettings,
} from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Default company fallback (used when no settings row exists) ──
const DEFAULT_COMPANY = {
  companyName: 'PRO SWAMI SHARNAM ENTERPRISES',
  tagline: 'Haldiram Distribution Hub',
  gstin: '23AMFPV5397L1ZB',
  address: 'Bhopal, Madhya Pradesh – 462001',
  phone: '+91 98765 43210',
  email: 'accounts@swamisharanam.in',
  bankName: 'State Bank of India',
  bankAccount: '3987 6543 2109',
  bankIfsc: 'SBIN0001234',
  bankBranch: 'MP Nagar, Bhopal',
};

async function getCompanySettings() {
  const rows = await db.select().from(companySettings).limit(1);
  if (rows.length === 0) return DEFAULT_COMPANY;
  const r = rows[0];
  return {
    companyName: r.companyName || DEFAULT_COMPANY.companyName,
    tagline: r.tagline || DEFAULT_COMPANY.tagline,
    gstin: r.gstin || DEFAULT_COMPANY.gstin,
    address: r.address || DEFAULT_COMPANY.address,
    phone: r.phone || DEFAULT_COMPANY.phone,
    email: r.email || DEFAULT_COMPANY.email,
    bankName: r.bankName || DEFAULT_COMPANY.bankName,
    bankAccount: r.bankAccount || DEFAULT_COMPANY.bankAccount,
    bankIfsc: r.bankIfsc || DEFAULT_COMPANY.bankIfsc,
    bankBranch: r.bankBranch || DEFAULT_COMPANY.bankBranch,
  };
}

// ── Helpers ────────────────────────────────────────────────────────
function inr(n: number): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toWords(num: number): string {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  }

  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);
  let result = convert(intPart) + ' Rupees';
  if (decPart > 0) result += ' and ' + convert(decPart) + ' Paise';
  return result + ' Only';
}

// ── GET /api/orders/[id]/invoice ──────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const orderId = Number(id);
    if (isNaN(orderId)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });

    // ── Fetch order + relations ──
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId));
    const [salesperson] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, order.salespersonId));

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

    // Attach product catalog info (HSN codes especially)
    const productIds = items.filter((i) => i.productId != null).map((i) => i.productId as number);
    const productsMap = new Map<number, (typeof products.$inferSelect)[][0]>();
    if (productIds.length) {
      const rows = await db.select().from(products).where(inArray(products.id, productIds));
      for (const r of rows) productsMap.set(r.id, r);
    }

    // ── Fetch company settings from DB ──
    const COMPANY = await getCompanySettings();

    // ── Build PDF ──
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const margin = 14;
    const contentW = pageW - margin * 2;
    let y = margin;

    // ── Header ──
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, pageW, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(COMPANY.companyName, margin, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(COMPANY.tagline, margin, 20);
    doc.text(`GSTIN: ${COMPANY.gstin}`, margin, 26);
    doc.text(`${COMPANY.address} | ${COMPANY.phone} | ${COMPANY.email}`, margin, 32);

    y = 44;

    // ── Invoice title bar ──
    doc.setFillColor(99, 102, 241); // indigo-500
    doc.rect(margin, y, contentW, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('TAX INVOICE', margin + 4, y + 7);
    doc.setFontSize(9);
    doc.text(`Invoice #: ${order.invoiceNumber || `INV-${order.id}`}`, pageW - margin - 4, y + 7, { align: 'right' });
    y += 14;

    // ── Bill To / Ship To ──
    const leftX = margin;
    const rightX = pageW / 2 + 4;

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('BILL TO', leftX, y);
    doc.text('SHIP TO', rightX, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const custName = customer?.name || 'Walk-in Customer';
    const custGstin = customer?.gstin || 'N/A';
    const custAddress = [customer?.address, customer?.city, customer?.state, customer?.pincode].filter(Boolean).join(', ') || '—';

    doc.text(custName, leftX, y); y += 4;
    doc.text(`GSTIN: ${custGstin}`, leftX, y); y += 4;
    doc.text(custAddress, leftX, y, { maxWidth: 80 });

    // Ship to (same)
    let sy = y - 8;
    doc.text(custName, rightX, sy); sy += 4;
    doc.text(custAddress, rightX, sy, { maxWidth: 80 });

    y = Math.max(y, sy) + 8;

    // ── Invoice meta ──
    const metaY = y;
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const meta = [
      [`Date: ${order.orderDate ? new Date(order.orderDate).toLocaleDateString('en-IN') : '—'}`, `Payment Status: ${(Number(order.grandTotal) - Number(order.amountPaid || 0)) > 0 ? 'UNPAID' : 'PAID'}`],
      [`Salesperson: ${salesperson?.name || '—'}`, `Beat: ${order.beat || '—'}`],
      [`Credit Days: ${order.creditDays || 0}`, `Due: ${order.dueDate ? new Date(order.dueDate).toLocaleDateString('en-IN') : '—'}`],
    ];
    for (const [left, right] of meta) {
      doc.text(left, leftX, y);
      doc.text(right, rightX, y);
      y += 4;
    }
    y = metaY + 16;

    // ── Items table ──
    const hsnCol = 'HSN/SAC';
    const tableHead = [['#', 'Product Description', hsnCol, 'Qty', 'Unit', 'Rate', 'Taxable', 'GST %', 'GST Amt', 'Total']];
    const tableBody = items.map((item, idx) => {
      const prod = item.productId ? productsMap.get(item.productId) : null;
      const hsn = prod?.hsnCode || '21069099';
      return [
        String(idx + 1),
        item.productName + (item.erpId ? ` (${item.erpId})` : ''),
        hsn,
        String(item.quantity || 0),
        item.unit || prod?.unit || 'PCS',
        inr(Number(item.unitPrice)),
        inr(Number(item.taxableAmount)),
        `${Number(item.gstRate) || 0}%`,
        inr(Number(item.gstAmount)),
        inr(Number(item.totalAmount)),
      ];
    });

    autoTable(doc, {
      startY: y,
      head: tableHead,
      body: tableBody,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        lineColor: [203, 213, 225],
        lineWidth: 0.3,
        textColor: [30, 41, 59],
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        3: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 12, halign: 'center' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 22, halign: 'right' },
        7: { cellWidth: 14, halign: 'center' },
        8: { cellWidth: 20, halign: 'right' },
        9: { cellWidth: 22, halign: 'right' },
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data) => {
        // Footer on every page
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${data.pageNumber}`, pageW / 2, pageH - 8, { align: 'center' });
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;

    // ── GST Summary ──
    const summaryLeft = margin;
    const summaryRight = pageW - margin;
    const boxW = contentW;
    const boxH = 38;

    // Check if we need a new page for the summary
    if (y + boxH + 30 > doc.internal.pageSize.getHeight()) {
      doc.addPage();
      y = margin;
    }

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(summaryLeft, y, boxW, boxH, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(summaryLeft, y, boxW, boxH, 2, 2, 'S');

    const summX = summaryLeft + 6;
    let summY = y + 6;

    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text('GST SUMMARY', summX, summY);
    summY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    // Calculate GST by rate
    const gstByRate = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number }>();
    for (const item of items) {
      const rate = Number(item.gstRate) || 0;
      const existing = gstByRate.get(rate) || { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      existing.taxable += Number(item.taxableAmount) || 0;
      existing.cgst += (Number(item.gstAmount) || 0) / 2;
      existing.sgst += (Number(item.gstAmount) || 0) / 2;
      gstByRate.set(rate, existing);
    }

    // Table header
    doc.setFont('helvetica', 'bold');
    doc.text('HSN/SAC', summX, summY);
    doc.text('Taxable Value', summX + 40, summY);
    doc.text('CGST Rate', summX + 70, summY);
    doc.text('CGST Amt', summX + 90, summY);
    doc.text('SGST Rate', summX + 110, summY);
    doc.text('SGST Amt', summX + 128, summY);
    summY += 4;

    doc.setFont('helvetica', 'normal');
    for (const [rate, data] of gstByRate) {
      if (rate === 0) continue;
      doc.text(`@${rate}%`, summX, summY);
      doc.text(inr(data.taxable), summX + 40, summY);
      doc.text(`${rate / 2}%`, summX + 70, summY);
      doc.text(inr(data.cgst), summX + 90, summY);
      doc.text(`${rate / 2}%`, summX + 110, summY);
      doc.text(inr(data.sgst), summX + 128, summY);
      summY += 4;
    }

    // Totals row
    const totalTaxable = Number(order.taxableAmount) || 0;
    const totalCgst = Number(order.cgst) || 0;
    const totalSgst = Number(order.sgst) || 0;
    const totalIgst = Number(order.igst) || 0;
    const totalGst = Number(order.totalGst) || 0;

    summY += 1;
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL', summX, summY);
    doc.text(inr(totalTaxable), summX + 40, summY);
    doc.text(inr(totalCgst), summX + 90, summY);
    doc.text(inr(totalSgst), summX + 128, summY);

    summY += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(`Total CGST: ${inr(totalCgst)}`, summX, summY);
    doc.text(`Total SGST: ${inr(totalSgst)}`, summX + 50, summY);
    if (totalIgst > 0) doc.text(`Total IGST: ${inr(totalIgst)}`, summX + 100, summY);
    summY += 4;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total GST: ${inr(totalGst)}`, summX, summY);

    y += boxH + 6;

    // ── Grand Total box ──
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(summaryLeft, y, boxW, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('GRAND TOTAL', summX, y + 8);
    doc.text(inr(Number(order.grandTotal) || 0), summaryRight - 6, y + 8, { align: 'right' });

    y += 16;

    // ── Amount in words ──
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Amount in Words:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(toWords(Number(order.grandTotal) || 0), margin + 30, y, { maxWidth: contentW - 30 });

    y += 10;

    // ── Payment received ──
    const amountPaid = Number(order.amountPaid) || 0;
    const balance = Number(order.grandTotal || 0) - amountPaid;
    if (amountPaid > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Amount Received: ${inr(amountPaid)}`, margin, y);
      doc.setFont('helvetica', 'bold');
      doc.text(`Balance Due: ${inr(balance)}`, margin + 60, y);
      y += 6;
    }

    // ── Bank Details ──
    if (y + 30 > doc.internal.pageSize.getHeight()) {
      doc.addPage();
      y = margin;
    }

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(summaryLeft, y, boxW / 2 - 4, 28, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(summaryLeft, y, boxW / 2 - 4, 28, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('BANK DETAILS', summX, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Bank: ${COMPANY.bankName}`, summX, y + 10);
    doc.text(`A/C: ${COMPANY.bankAccount}`, summX, y + 14);
    doc.text(`IFSC: ${COMPANY.bankIfsc}`, summX, y + 18);
    doc.text(`Branch: ${COMPANY.bankBranch}`, summX, y + 22);

    // ── Terms ──
    const termsX = summaryLeft + boxW / 2 + 4;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(termsX, y, boxW / 2 - 4, 28, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(termsX, y, boxW / 2 - 4, 28, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('TERMS & CONDITIONS', termsX + 4, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('1. Goods once sold will not be returned.', termsX + 4, y + 10);
    doc.text('2. Interest @18% p.a. on overdue payments.', termsX + 4, y + 14);
    doc.text('3. Subject to Bhopal jurisdiction.', termsX + 4, y + 18);
    doc.text(`4. Payment due within ${order.creditDays || 0} days.`, termsX + 4, y + 22);
    doc.text('5. E. & O.E.', termsX + 4, y + 26);

    y += 34;

    // ── Signature ──
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('For ' + COMPANY.companyName, summaryRight - 4, y, { align: 'right' });
    y += 16;
    doc.setDrawColor(148, 163, 184);
    doc.line(summaryRight - 60, y, summaryRight - 4, y);
    doc.text('Authorized Signatory', summaryRight - 4, y + 4, { align: 'right' });

    // ── Generate buffer ──
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${order.invoiceNumber || order.id}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
