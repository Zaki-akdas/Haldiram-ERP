import { ExtractionResult, ExtractionItem } from './ai-provider';

export function buildExtractionPrompt(text: string): string {
  return `Extract invoice data from the following text and return ONLY valid JSON with this exact structure:
{
  "invoiceNumber": "string or null",
  "invoiceDate": "string (DD/MM/YYYY) or null",
  "customerName": "string or null",
  "customerGSTIN": "string or null",
  "customerAddress": "string or null",
  "items": [
    {
      "srNo": number,
      "erpId": "string or null",
      "productName": "string",
      "hsnCode": "string or null",
      "quantity": number,
      "unit": "string",
      "unitPrice": number,
      "discount": number,
      "taxableAmount": number,
      "gstRate": number,
      "gstAmount": number,
      "totalAmount": number
    }
  ],
  "subtotal": number or null,
  "taxableAmount": number or null,
  "cgst": number or null,
  "sgst": number or null,
  "igst": number or null,
  "totalGst": number or null,
  "grandTotal": number or null
}

Invoice text:
${text}`;
}

export function normalizeExtraction(raw: Record<string, any>): Partial<ExtractionResult> {
  const parseNumber = (val: any): number | undefined => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const num = parseFloat(val.replace(/[^\d.-]/g, ''));
      if (!isNaN(num)) return num;
    }
    return undefined;
  };

  const parseString = (val: any): string | undefined => {
    if (typeof val === 'string') return val;
    if (val != null) return String(val);
    return undefined;
  };

  const getField = (obj: any, keys: string[]) => {
    for (const key of keys) {
      if (obj[key] !== undefined) return obj[key];
    }
    return undefined;
  };

  let items: ExtractionItem[] = [];
  const rawItems = getField(raw, ['items', 'Items', 'lineItems', 'line_items']);
  if (Array.isArray(rawItems)) {
    items = rawItems.map((item: any, index: number) => ({
      srNo: parseNumber(getField(item, ['srNo', 'sr_no', 'slNo', 'sl_no'])) ?? index + 1,
      erpId: parseString(getField(item, ['erpId', 'erp_id', 'itemId', 'item_code'])),
      productName: parseString(getField(item, ['productName', 'product_name', 'description', 'item'])) || 'Unknown Product',
      hsnCode: parseString(getField(item, ['hsnCode', 'hsn_code', 'hsn'])),
      quantity: parseNumber(getField(item, ['quantity', 'qty'])) || 0,
      unit: parseString(getField(item, ['unit', 'uom', 'measure'])) || 'pcs',
      unitPrice: parseNumber(getField(item, ['unitPrice', 'unit_price', 'rate', 'price'])) || 0,
      discount: parseNumber(getField(item, ['discount', 'disc'])),
      taxableAmount: parseNumber(getField(item, ['taxableAmount', 'taxable_amount', 'taxable'])),
      gstRate: parseNumber(getField(item, ['gstRate', 'gst_rate', 'gst%'])),
      gstAmount: parseNumber(getField(item, ['gstAmount', 'gst_amount', 'taxAmount', 'tax_amount'])),
      totalAmount: parseNumber(getField(item, ['totalAmount', 'total_amount', 'amount', 'total'])) || 0,
    }));
  }

  return {
    invoiceNumber: parseString(getField(raw, ['invoiceNumber', 'invoice_number', 'invoiceNo', 'invoice_no'])),
    invoiceDate: parseString(getField(raw, ['invoiceDate', 'invoice_date', 'date'])),
    customerName: parseString(getField(raw, ['customerName', 'customer_name', 'partyName', 'party_name', 'billedTo', 'billed_to'])),
    customerGSTIN: parseString(getField(raw, ['customerGSTIN', 'customer_gstin', 'gstin'])),
    customerAddress: parseString(getField(raw, ['customerAddress', 'customer_address', 'address'])),
    items,
    subtotal: parseNumber(getField(raw, ['subtotal', 'sub_total'])),
    taxableAmount: parseNumber(getField(raw, ['taxableAmount', 'taxable_amount'])),
    cgst: parseNumber(getField(raw, ['cgst', 'CGST'])),
    sgst: parseNumber(getField(raw, ['sgst', 'SGST'])),
    igst: parseNumber(getField(raw, ['igst', 'IGST'])),
    totalGst: parseNumber(getField(raw, ['totalGst', 'total_gst', 'taxTotal', 'tax_total'])),
    grandTotal: parseNumber(getField(raw, ['grandTotal', 'grand_total', 'totalAmount', 'total_amount', 'total'])),
  };
}

export function computeConfidence(result: ExtractionResult): number {
  let score = 0;
  if (result.invoiceNumber) score += 15;
  if (result.invoiceDate) score += 10;
  if (result.customerName) score += 10;
  if (result.items && result.items.length > 0) {
    score += 20;
    const itemScore = Math.min(20, result.items.filter(i => i.productName && i.productName !== 'Unknown Product').length * 5);
    score += itemScore;
  }
  if (result.grandTotal) score += 15;
  if (result.cgst || result.sgst || result.igst || result.totalGst) score += 10;
  return Math.min(100, score);
}
