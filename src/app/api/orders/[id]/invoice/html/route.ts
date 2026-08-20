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

// ── Default company fallback ──
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

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderHTML(
  company: Awaited<ReturnType<typeof getCompanySettings>>,
  order: Record<string, unknown>,
  customer: Record<string, unknown> | null,
  salesperson: Record<string, unknown> | null,
  items: Record<string, unknown>[],
  productsMap: Map<number, Record<string, unknown>>,
) {
  const invNo = order.invoiceNumber || `INV-${order.id}`;
  const orderDate = order.orderDate ? new Date(String(order.orderDate)).toLocaleDateString('en-IN') : '—';
  const dueDate = order.dueDate ? new Date(String(order.dueDate)).toLocaleDateString('en-IN') : '—';
  const grandTotal = Number(order.grandTotal) || 0;
  const amountPaid = Number(order.amountPaid) || 0;
  const balance = grandTotal - amountPaid;
  const custName = customer?.name ? String(customer.name) : 'Walk-in Customer';
  const custGstin = customer?.gstin ? String(customer.gstin) : 'N/A';
  const custAddr = [customer?.address, customer?.city, customer?.state, customer?.pincode]
    .filter(Boolean).map(String).join(', ') || '—';
  const spName = salesperson?.name ? String(salesperson.name) : '—';

  // GST by rate
  const gstByRate = new Map<number, { taxable: number; cgst: number; sgst: number }>();
  for (const item of items) {
    const rate = Number(item.gstRate) || 0;
    const existing = gstByRate.get(rate) || { taxable: 0, cgst: 0, sgst: 0 };
    existing.taxable += Number(item.taxableAmount) || 0;
    existing.cgst += (Number(item.gstAmount) || 0) / 2;
    existing.sgst += (Number(item.gstAmount) || 0) / 2;
    gstByRate.set(rate, existing);
  }

  const totalTaxable = Number(order.taxableAmount) || 0;
  const totalCgst = Number(order.cgst) || 0;
  const totalSgst = Number(order.sgst) || 0;
  const totalGst = Number(order.totalGst) || 0;

  const itemRows = items.map((item, idx) => {
    const prod = item.productId ? productsMap.get(Number(item.productId)) : null;
    const hsn = prod?.hsnCode ? String(prod.hsnCode) : '21069099';
    return `<tr>
      <td class="c">${idx + 1}</td>
      <td>${esc(item.productName ? String(item.productName) : '')}${item.erpId ? ` <span class="muted">(${esc(String(item.erpId))})</span>` : ''}</td>
      <td class="mono">${esc(hsn)}</td>
      <td class="r">${item.quantity || 0}</td>
      <td class="c">${item.unit || prod?.unit || 'PCS'}</td>
      <td class="r">${inr(Number(item.unitPrice))}</td>
      <td class="r">${inr(Number(item.taxableAmount))}</td>
      <td class="c">${Number(item.gstRate) || 0}%</td>
      <td class="r">${inr(Number(item.gstAmount))}</td>
      <td class="r bold">${inr(Number(item.totalAmount))}</td>
    </tr>`;
  }).join('\n');

  const gstRows = Array.from(gstByRate.entries())
    .filter(([rate]) => rate > 0)
    .map(([rate, data]) => `<tr>
      <td>@${rate}%</td>
      <td class="r">${inr(data.taxable)}</td>
      <td class="c">${rate / 2}%</td>
      <td class="r">${inr(data.cgst)}</td>
      <td class="c">${rate / 2}%</td>
      <td class="r">${inr(data.sgst)}</td>
    </tr>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tax Invoice ${esc(String(invNo))}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 12px; color: #1e293b; background: #f8fafc; padding: 16px; }
  .invoice { max-width: 800px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
  .header { background: #1e293b; color: #fff; padding: 20px 24px; }
  .header h1 { font-size: 18px; font-weight: 800; margin-bottom: 2px; }
  .header .tagline { font-size: 11px; color: #94a3b8; }
  .header .gstin { font-size: 11px; color: #94a3b8; margin-top: 4px; }
  .header .contact { font-size: 10px; color: #64748b; margin-top: 2px; }
  .title-bar { background: #6366f1; color: #fff; padding: 8px 24px; display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 13px; }
  .body { padding: 20px 24px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .col-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 4px; }
  .col-name { font-weight: 700; font-size: 13px; }
  .col-detail { font-size: 11px; color: #475569; line-height: 1.5; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 11px; color: #64748b; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
  th { background: #1e293b; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
  td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
  tr:nth-child(even) { background: #f8fafc; }
  .r { text-align: right; }
  .c { text-align: center; }
  .bold { font-weight: 700; }
  .mono { font-family: 'Cascadia Code', 'Fira Code', monospace; font-size: 10px; }
  .muted { color: #94a3b8; font-size: 10px; }
  .summary-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; background: #f8fafc; }
  .summary-box h3 { font-size: 11px; font-weight: 700; margin-bottom: 8px; }
  .summary-box table { margin-bottom: 0; }
  .summary-box th { background: #334155; }
  .grand-total { background: #1e293b; color: #fff; padding: 10px 24px; display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 14px; border-radius: 6px; margin-bottom: 12px; }
  .words { font-size: 11px; margin-bottom: 12px; }
  .words strong { font-weight: 700; }
  .payment-line { font-size: 11px; margin-bottom: 8px; display: flex; gap: 24px; }
  .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
  .footer-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; background: #f8fafc; font-size: 11px; }
  .footer-card h4 { font-size: 10px; font-weight: 700; margin-bottom: 4px; }
  .footer-card p { line-height: 1.6; color: #475569; }
  .sig { display: flex; justify-content: flex-end; margin-top: 24px; padding-top: 8px; }
  .sig-line { text-align: right; }
  .sig-line .line { width: 160px; border-top: 1px solid #94a3b8; margin-top: 32px; padding-top: 4px; font-size: 11px; color: #64748b; }

  /* ── Print styles ── */
  @media print {
    body { background: #fff; padding: 0; margin: 0; }
    .invoice { border: none; border-radius: 0; box-shadow: none; max-width: none; }
    .no-print { display: none !important; }
    .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .title-bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .grand-total { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .footer-card { break-inside: avoid; }
    .summary-box { break-inside: avoid; }
    table { break-inside: auto; }
    tr { break-inside: avoid; }
  }

  /* ── Print button ── */
  .print-bar { max-width: 800px; margin: 0 auto 12px; text-align: right; }
  .print-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 20px; background: #6366f1; color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .print-btn:hover { background: #4f46e5; }
</style>
</head>
<body>
<div class="print-bar no-print">
  <button class="print-btn" onclick="window.print()">
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
    Print Invoice
  </button>
</div>

<div class="invoice">
  <!-- Header -->
  <div class="header">
    <h1>${esc(company.companyName)}</h1>
    ${company.tagline ? `<div class="tagline">${esc(company.tagline)}</div>` : ''}
    ${company.gstin ? `<div class="gstin">GSTIN: ${esc(company.gstin)}</div>` : ''}
    <div class="contact">${esc(company.address)}${company.phone ? ` | ${esc(company.phone)}` : ''}${company.email ? ` | ${esc(company.email)}` : ''}</div>
  </div>

  <!-- Title bar -->
  <div class="title-bar">
    <span>TAX INVOICE</span>
    <span>Invoice #: ${esc(String(invNo))}</span>
  </div>

  <div class="body">
    <!-- Bill To / Ship To -->
    <div class="cols">
      <div>
        <div class="col-label">Bill To</div>
        <div class="col-name">${esc(custName)}</div>
        <div class="col-detail">GSTIN: ${esc(custGstin)}<br>${esc(custAddr)}</div>
      </div>
      <div>
        <div class="col-label">Ship To</div>
        <div class="col-name">${esc(custName)}</div>
        <div class="col-detail">${esc(custAddr)}</div>
      </div>
    </div>

    <!-- Meta -->
    <div class="meta">
      <div><strong>Date:</strong> ${orderDate}</div>
      <div><strong>Payment Status:</strong> ${balance > 0 ? 'UNPAID' : 'PAID'}</div>
      <div><strong>Salesperson:</strong> ${esc(spName)}</div>
      <div><strong>Beat:</strong> ${order.beat ? esc(String(order.beat)) : '—'}</div>
      <div><strong>Credit Days:</strong> ${order.creditDays || 0}</div>
      <div><strong>Due Date:</strong> ${dueDate}</div>
    </div>

    <!-- Items -->
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Product Description</th>
          <th>HSN/SAC</th>
          <th class="r">Qty</th>
          <th class="c">Unit</th>
          <th class="r">Rate</th>
          <th class="r">Taxable</th>
          <th class="c">GST %</th>
          <th class="r">GST Amt</th>
          <th class="r">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <!-- GST Summary -->
    <div class="summary-box">
      <h3>GST SUMMARY</h3>
      <table>
        <thead>
          <tr>
            <th>HSN/SAC</th>
            <th class="r">Taxable Value</th>
            <th class="c">CGST Rate</th>
            <th class="r">CGST Amt</th>
            <th class="c">SGST Rate</th>
            <th class="r">SGST Amt</th>
          </tr>
        </thead>
        <tbody>
          ${gstRows}
        </tbody>
      </table>
      <div style="margin-top:8px; padding-top:8px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; font-size:11px;">
        <span><strong>TOTAL</strong></span>
        <span>Taxable: <strong>${inr(totalTaxable)}</strong> &nbsp; CGST: <strong>${inr(totalCgst)}</strong> &nbsp; SGST: <strong>${inr(totalSgst)}</strong> &nbsp; GST: <strong>${inr(totalGst)}</strong></span>
      </div>
    </div>

    <!-- Grand Total -->
    <div class="grand-total">
      <span>GRAND TOTAL</span>
      <span>${inr(grandTotal)}</span>
    </div>

    <!-- Amount in words -->
    <div class="words"><strong>Amount in Words:</strong> ${esc(toWords(grandTotal))}</div>

    ${amountPaid > 0 ? `<div class="payment-line">
      <span>Amount Received: <strong>${inr(amountPaid)}</strong></span>
      <span>Balance Due: <strong>${inr(balance)}</strong></span>
    </div>` : ''}

    <!-- Footer -->
    <div class="footer-grid">
      <div class="footer-card">
        <h4>BANK DETAILS</h4>
        <p>
          Bank: ${esc(company.bankName)}<br>
          A/C: ${esc(company.bankAccount)}<br>
          IFSC: ${esc(company.bankIfsc)}<br>
          Branch: ${esc(company.bankBranch)}
        </p>
      </div>
      <div class="footer-card">
        <h4>TERMS &amp; CONDITIONS</h4>
        <p>
          1. Goods once sold will not be returned.<br>
          2. Interest @18% p.a. on overdue payments.<br>
          3. Subject to Bhopal jurisdiction.<br>
          4. Payment due within ${order.creditDays || 0} days.<br>
          5. E. &amp; O.E.
        </p>
      </div>
    </div>

    <!-- Signature -->
    <div class="sig">
      <div class="sig-line">
        <div class="line">For ${esc(company.companyName)}</div>
        <div style="margin-top: 4px; font-size: 11px; color: #64748b;">Authorized Signatory</div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ── GET /api/orders/[id]/invoice/html ──
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

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId));
    const [salesperson] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, order.salespersonId));

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

    const productIds = items.filter((i) => i.productId != null).map((i) => i.productId as number);
    const productsMap = new Map<number, Record<string, unknown>>();
    if (productIds.length) {
      const rows = await db.select().from(products).where(inArray(products.id, productIds));
      for (const r of rows) productsMap.set(r.id, r as unknown as Record<string, unknown>);
    }

    const company = await getCompanySettings();

    const html = renderHTML(
      company,
      order as unknown as Record<string, unknown>,
      customer as unknown as Record<string, unknown> | null,
      salesperson as unknown as Record<string, unknown> | null,
      items as unknown as Record<string, unknown>[],
      productsMap,
    );

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="invoice-${order.invoiceNumber || order.id}.html"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
