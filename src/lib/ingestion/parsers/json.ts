import { IngestFormat, IngestItem, IngestResult } from '../types';

function parseNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
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

  let parsed: any;
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
  const get = (obj: any, keys: string[]): any => {
    if (!obj || typeof obj !== 'object') return undefined;
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return undefined;
  };

  const inv = (parsed && typeof parsed === 'object' && typeof parsed.invoice === 'object') ? parsed.invoice : parsed;
  const seller = (parsed && typeof parsed === 'object' && typeof parsed.seller === 'object') ? parsed.seller : parsed;
  const buyer = (parsed && typeof parsed === 'object' && typeof parsed.buyer === 'object') ? parsed.buyer : parsed;
  const summary = (parsed && typeof parsed === 'object' && typeof parsed.summary === 'object') ? parsed.summary : parsed;

  const items: IngestItem[] = [];
  const rawItems = Array.isArray(parsed) ? parsed : (parsed.items || parsed.data || parsed.lineItems || []);

  rawItems.forEach((it: any, index: number) => {
    const gstRate = parseNumber(get(it, ['gstRate', 'gst_rate', 'gstPercent', 'gst_percent', 'gst%', 'gst']));
    items.push({
      srNo: parseNumber(get(it, ['srNo', 'sr', 'sno', 'slNo'])) || index + 1,
      erpId: get(it, ['erpId', 'erp_id', 'sku', 'code', 'itemCode', 'item_code']),
      productName: get(it, ['productName', 'product_name', 'product', 'name', 'itemName', 'item_name', 'description']) || `Item ${index + 1}`,
      hsnCode: get(it, ['hsnCode', 'hsn_code', 'hsn']) != null ? String(get(it, ['hsnCode', 'hsn_code', 'hsn'])) : undefined,
      mrp: parseNumber(get(it, ['mrp'])),
      quantity: parseNumber(get(it, ['quantity', 'qty'])) || 1,
      unitPrice: parseNumber(get(it, ['unitPrice', 'unit_price', 'price', 'rate'])) || 0,
      discount: parseNumber(get(it, ['discount', 'disc'])),
      taxableAmount: parseNumber(get(it, ['taxableAmount', 'taxable_amount', 'taxable', 'taxableValue', 'taxable_value'])),
      gstRate: gstRate || 5,
      gstAmount: parseNumber(get(it, ['gstAmount', 'gst_amount', 'gstAmt', 'gst_amt'])),
      totalAmount: parseNumber(get(it, ['totalAmount', 'total_amount', 'totalValue', 'total_value', 'total'])) || 0,
    });
  });

  return {
    format: 'json',
    header: {
      invoiceNumber: get(inv, ['invoiceNumber', 'invoice_number', 'invoiceNo', 'invoice_no', 'billNumber', 'bill_number']),
      invoiceDate: get(inv, ['invoiceDate', 'invoice_date', 'billDate', 'bill_date', 'date']),
      sellerName: get(seller, ['sellerName', 'seller_name', 'firmName', 'firm_name', 'name']),
      sellerGSTIN: get(seller, ['sellerGSTIN', 'seller_gstin', 'gstin']),
      customerName: get(buyer, ['customerName', 'customer_name', 'buyerName', 'buyer_name', 'firmName', 'firm_name', 'name']),
      customerGSTIN: get(buyer, ['customerGSTIN', 'customer_gstin', 'gstin']),
      taxableAmount: parseNumber(get(summary, ['taxableAmount', 'taxable_amount', 'taxable', 'grossAmount', 'gross_amount'])) || parseNumber(get(parsed, ['taxableAmount', 'taxable_amount', 'subtotal'])),
      cgst: parseNumber(get(summary, ['cgst', 'cgstAmount', 'cgst_amount'])),
      sgst: parseNumber(get(summary, ['sgst', 'sgstAmount', 'sgst_amount'])),
      igst: parseNumber(get(summary, ['igst', 'igstAmount', 'igst_amount'])),
      totalGst: parseNumber(get(summary, ['totalGst', 'total_gst', 'gstAmount', 'gst_amount'])) || parseNumber(get(parsed, ['totalGst', 'total_gst'])),
      grandTotal: parseNumber(get(summary, ['grandTotal', 'grand_total', 'totalValue', 'total_value', 'totalAmount', 'total_amount', 'total'])) || parseNumber(get(parsed, ['grandTotal', 'grand_total', 'totalAmount', 'total_amount', 'total'])),
    },
    items,
    confidence: 100,
    warnings,
    processingTimeMs: Date.now() - startTime,
  };
}
