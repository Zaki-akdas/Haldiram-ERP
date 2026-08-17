import { IngestFormat, IngestItem, IngestResult } from '../types';

function parseNumber(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function getField(obj: unknown, keys: string[]): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    if (rec[k] !== undefined && rec[k] !== null) return rec[k];
  }
  return undefined;
}

function getString(obj: unknown, keys: string[]): string | undefined {
  const val = getField(obj, keys);
  return val == null ? undefined : String(val);
}

export function parseJSON(rawText: string): IngestResult {
  const startTime = Date.now();
  const warnings: string[] = [];

  if (!rawText) {
    return {
      format: 'json',
      header: {},
      items: [],
      confidence: 0,
      warnings: ['Input is empty'],
      processingTimeMs: Date.now() - startTime,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      format: 'json',
      header: {},
      items: [],
      confidence: 0,
      warnings: ['Invalid JSON format'],
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Support both flat JSON and the real-world nested invoice shape:
  // { invoice: { invoice_number, bill_date }, seller: { firm_name, gstin },
  //   buyer: { firm_name, gstin }, items: [{ sno, erp_id, item_name, taxable_value,
  //   gst_percent, gst_amount, total_value }], summary: { taxable_value, gst_amount, total_value } }
  const root = (parsed && typeof parsed === 'object') ? parsed as Record<string, unknown> : undefined;
  const inv = (root && typeof root.invoice === 'object') ? root.invoice as Record<string, unknown> : root;
  const seller = (root && typeof root.seller === 'object') ? root.seller as Record<string, unknown> : root;
  const buyer = (root && typeof root.buyer === 'object') ? root.buyer as Record<string, unknown> : root;
  const summary = (root && typeof root.summary === 'object') ? root.summary as Record<string, unknown> : root;

  const items: IngestItem[] = [];
  const firstArray = (...vals: unknown[]): unknown[] => {
    for (const v of vals) {
      if (Array.isArray(v)) return v as unknown[];
    }
    return [];
  };
  const rawItems = firstArray(parsed, root?.items, root?.data, root?.lineItems);

  rawItems.forEach((it: unknown, index: number) => {
    const gstRateField = getField(it, ['gstRate', 'gst_rate', 'gstPercent', 'gst_percent', 'gst%', 'gst']);
    const gstRate = parseNumber(gstRateField);
    items.push({
      srNo: parseNumber(getField(it, ['srNo', 'sr', 'sno', 'slNo'])) || index + 1,
      erpId: getString(it, ['erpId', 'erp_id', 'sku', 'code', 'itemCode', 'item_code']),
      productName: getString(it, ['productName', 'product_name', 'product', 'name', 'itemName', 'item_name', 'description']) || `Item ${index + 1}`,
      hsnCode: getString(it, ['hsnCode', 'hsn_code', 'hsn']),
      mrp: parseNumber(getField(it, ['mrp'])),
      quantity: parseNumber(getField(it, ['quantity', 'qty'])) || 1,
      unitPrice: parseNumber(getField(it, ['unitPrice', 'unit_price', 'price', 'rate'])) || 0,
      discount: parseNumber(getField(it, ['discount', 'disc'])),
      taxableAmount: parseNumber(getField(it, ['taxableAmount', 'taxable_amount', 'taxable', 'taxableValue', 'taxable_value'])),
      gstRate: gstRate || 5,
      gstAmount: parseNumber(getField(it, ['gstAmount', 'gst_amount', 'gstAmt', 'gst_amt'])),
      totalAmount: parseNumber(getField(it, ['totalAmount', 'total_amount', 'totalValue', 'total_value', 'total'])) || 0,
      ...(gstRateField !== undefined ? { gstRateExplicit: true as const } : {}),
      ...(getField(it, ['unit', 'uom']) !== undefined ? { unitExplicit: true as const } : {}),
    });
  });

  return {
    format: 'json',
    header: {
      invoiceNumber: getString(inv, ['invoiceNumber', 'invoice_number', 'invoiceNo', 'invoice_no', 'billNumber', 'bill_number']),
      invoiceDate: getString(inv, ['invoiceDate', 'invoice_date', 'billDate', 'bill_date', 'date']),
      sellerName: getString(seller, ['sellerName', 'seller_name', 'firmName', 'firm_name', 'name']),
      sellerGSTIN: getString(seller, ['sellerGSTIN', 'seller_gstin', 'gstin']),
      customerName: getString(buyer, ['customerName', 'customer_name', 'buyerName', 'buyer_name', 'firmName', 'firm_name', 'name']),
      customerGSTIN: getString(buyer, ['customerGSTIN', 'customer_gstin', 'gstin']),
      taxableAmount: parseNumber(getField(summary, ['taxableAmount', 'taxable_amount', 'taxable', 'grossAmount', 'gross_amount'])) || parseNumber(getField(parsed, ['taxableAmount', 'taxable_amount', 'subtotal'])),
      cgst: parseNumber(getField(summary, ['cgst', 'cgstAmount', 'cgst_amount'])),
      sgst: parseNumber(getField(summary, ['sgst', 'sgstAmount', 'sgst_amount'])),
      igst: parseNumber(getField(summary, ['igst', 'igstAmount', 'igst_amount'])),
      totalGst: parseNumber(getField(summary, ['totalGst', 'total_gst', 'gstAmount', 'gst_amount'])) || parseNumber(getField(parsed, ['totalGst', 'total_gst'])),
      grandTotal: parseNumber(getField(summary, ['grandTotal', 'grand_total', 'totalValue', 'total_value', 'totalAmount', 'total_amount', 'total'])) || parseNumber(getField(parsed, ['grandTotal', 'grand_total', 'totalAmount', 'total_amount', 'total'])),
    },
    items,
    confidence: 100,
    warnings,
    processingTimeMs: Date.now() - startTime,
  };
}
