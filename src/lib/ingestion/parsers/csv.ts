import { IngestFormat, IngestItem, IngestHeader, IngestResult } from '../types';

function parseNumberStrict(val: string): number {
  if (!val) return 0;
  const cleaned = val
    .replace(/[₹\s]/g, '')
    .replace(/,/g, '')
    .replace(/[a-zA-Z%()]/g, '')
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[^\w\u20B9%]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchAlias(header: string, aliases: string[]): boolean {
  const norm = normalizeHeader(header);
  if (norm === '') return false;
  const normTokens = norm.split(' ').filter(Boolean);
  for (const alias of aliases) {
    const normAlias = normalizeHeader(alias);
    if (!normAlias) continue;
    if (norm === normAlias) return true;
    // Header is more specific and contains every alias token, e.g. header 'GST Amt. (₹)' vs alias 'gst amt'.
    // (The reverse direction is intentionally NOT matched: a short header like 'rate' must not
    // match the alias 'gst rate', and 'qty' must not match 'case qty'.)
    const aliasTokens = normAlias.split(' ').filter(Boolean);
    if (aliasTokens.length > 0 && aliasTokens.every(t => normTokens.includes(t))) return true;
  }
  return false;
}

const SR_NO_ALIASES = ['s no', 's.no', 's/no', 'sl', 'sl no', 'slno', 'sr no', 'srno', 'serial no', 'serial', 's. no', 's no.', 'sr. no', 'row', 'line', 'line no', 'line no.', 'item no', 'item no.', 'no', 'number'];
const ERP_ID_ALIASES = ['item erp id', 'erp id', 'erp', 'item code', 'item code.', 'product code', 'product code.', 'sku', 'item sku', 'erp code', 'erp id.', 'item erp', 'erp id no'];
const PRODUCT_NAME_ALIASES = ['item name', 'product name', 'description', 'desc', 'product', 'description.', 'item description', 'product name.', 'name', 'item name.'];
const HSN_ALIASES = ['hsn code', 'hsn', 'hsncode', 'hsn code.', 'hsn no', 'hsn number', 'hsn code no'];
const MRP_ALIASES = ['mrp (₹)', 'mrp', 'mrp ₹', 'mrp (inr)', 'maximum retail price', 'mrp (₹)', 'mrp.'];
const UNIT_ALIASES = ['standard unit', 'unit', 'uom', 'uom.', 'unit of measure', 'standard unit.', 'unit.'];
const CASES_ALIASES = ['cases', 'case', 'no of cases', 'number of cases', 'case qty', 'cases.'];
const QTY_ALIASES = ['invoice/delivery qty', 'invoice qty', 'delivery qty', 'qty', 'quantity', 'qty.', 'quantity.', 'invoice/Delivery Qty', 'invoice/delivery', 'qty (pcs)', 'qty (kg)', 'qty (units)', 'invoice qty.'];
const PTR_ALIASES = ['ptr', 'ptr.', 'purchase trade rate', 'purchase trade rate.', 'ptr (₹)', 'ptr (inr)'];
const PRICE_STD_ALIASES = ['price/std', 'price/std.', 'price per std', 'price per standard', 'price/unit', 'price/std unit', 'price per unit', 'unit price', 'rate', 'price', 'price.'];
const DISCOUNT_ALIASES = ['primary dis. (%)', 'discount (%)', 'discount', 'disc (%)', 'primary discount', 'discount %', 'primary dis.', 'disc'];
const TAXABLE_ALIASES = ['taxable value (₹)', 'taxable value', 'taxable', 'taxable amount', 'taxable value.', 'taxable amount.', 'taxable value (inr)'];
const GST_RATE_ALIASES = ['gst (%)', 'gst', 'gst %', 'gst rate', 'tax %', 'tax rate', 'gst rate.', 'gst %.', 'tax %'];
const GST_AMT_ALIASES = ['gst amt. (₹)', 'gst amount', 'gst amt', 'gst amt.', 'tax amount', 'gst tax', 'gst amount.', 'gst amt (₹)'];
const TOTAL_ALIASES = ['total value (₹)', 'total value', 'total', 'total amount', 'total value.', 'grand total', 'total value (inr)'];

interface ColumnMapping {
  srNo?: number;
  erpId?: number;
  productName?: number;
  hsnCode?: number;
  mrp?: number;
  unit?: number;
  cases?: number;
  quantity?: number;
  ptr?: number;
  pricePerStd?: number;
  discount?: number;
  taxableAmount?: number;
  gstRate?: number;
  gstAmount?: number;
  totalAmount?: number;
}

function mapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalized = headers.map(h => normalizeHeader(h));

  for (let i = 0; i < normalized.length; i++) {
    const h = normalized[i];
    const raw = headers[i].toLowerCase();

    if (!mapping.srNo && (matchAlias(h, SR_NO_ALIASES) || matchAlias(raw, SR_NO_ALIASES))) mapping.srNo = i;
    if (!mapping.erpId && (matchAlias(h, ERP_ID_ALIASES) || matchAlias(raw, ERP_ID_ALIASES))) mapping.erpId = i;
    if (!mapping.productName && (matchAlias(h, PRODUCT_NAME_ALIASES) || matchAlias(raw, PRODUCT_NAME_ALIASES))) mapping.productName = i;
    if (!mapping.hsnCode && (matchAlias(h, HSN_ALIASES) || matchAlias(raw, HSN_ALIASES))) mapping.hsnCode = i;
    if (!mapping.mrp && (matchAlias(h, MRP_ALIASES) || matchAlias(raw, MRP_ALIASES))) mapping.mrp = i;
    if (!mapping.unit && (matchAlias(h, UNIT_ALIASES) || matchAlias(raw, UNIT_ALIASES))) mapping.unit = i;
    if (!mapping.cases && (matchAlias(h, CASES_ALIASES) || matchAlias(raw, CASES_ALIASES))) mapping.cases = i;
    if (!mapping.quantity && (matchAlias(h, QTY_ALIASES) || matchAlias(raw, QTY_ALIASES))) mapping.quantity = i;
    if (!mapping.ptr && (matchAlias(h, PTR_ALIASES) || matchAlias(raw, PTR_ALIASES))) mapping.ptr = i;
    if (!mapping.pricePerStd && (matchAlias(h, PRICE_STD_ALIASES) || matchAlias(raw, PRICE_STD_ALIASES))) mapping.pricePerStd = i;
    if (!mapping.discount && (matchAlias(h, DISCOUNT_ALIASES) || matchAlias(raw, DISCOUNT_ALIASES))) mapping.discount = i;
    if (!mapping.taxableAmount && (matchAlias(h, TAXABLE_ALIASES) || matchAlias(raw, TAXABLE_ALIASES))) mapping.taxableAmount = i;
    if (!mapping.gstRate && (matchAlias(h, GST_RATE_ALIASES) || matchAlias(raw, GST_RATE_ALIASES))) mapping.gstRate = i;
    if (!mapping.gstAmount && (matchAlias(h, GST_AMT_ALIASES) || matchAlias(raw, GST_AMT_ALIASES))) mapping.gstAmount = i;
    if (!mapping.totalAmount && (matchAlias(h, TOTAL_ALIASES) || matchAlias(raw, TOTAL_ALIASES))) mapping.totalAmount = i;
  }

  if (!mapping.productName) {
    for (let i = 0; i < normalized.length; i++) {
      if (normalized[i].includes('name') || normalized[i].includes('desc') || normalized[i].includes('item')) {
        mapping.productName = i;
        break;
      }
    }
  }
  if (!mapping.quantity && mapping.quantity === undefined) {
    for (let i = 0; i < normalized.length; i++) {
      if (normalized[i].includes('qty') || normalized[i].includes('quantity')) {
        mapping.quantity = i;
        break;
      }
    }
  }
  if (!mapping.totalAmount && mapping.totalAmount === undefined) {
    for (let i = 0; i < normalized.length; i++) {
      if (normalized[i].includes('total') || normalized[i].includes('amount')) {
        mapping.totalAmount = i;
        break;
      }
    }
  }

  return mapping;
}

function detectDelimiter(lines: string[]): { delimiter: string; format: IngestFormat } {
  if (lines.length === 0) return { delimiter: ',', format: 'csv' };

  const firstLine = lines[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const pipeCount = (firstLine.match(/\|/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  // Don't count commas that sit between digits (thousands separators like "8,247.74")
  const commaCount = (firstLine.match(/,(?!\d)|(?<!\d),/g) || []).length;

  if (tabCount >= 2) return { delimiter: '\t', format: 'tsv' };
  if (pipeCount >= 2) return { delimiter: '|', format: 'psv' };
  if (semicolonCount >= 2 && commaCount < 2) return { delimiter: ';', format: 'csv' };
  if (commaCount >= 2) return { delimiter: ',', format: 'csv' };

  const spaceAligned = firstLine.match(/\s{2,}/);
  if (spaceAligned) return { delimiter: ' ', format: 'csv' };

  return { delimiter: ',', format: 'csv' };
}

function detectHeaderRow(lines: string[], delimiter: string): number {
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim().toLowerCase());
    const headerScore = cols.filter(c =>
      c.includes('item') || c.includes('product') || c.includes('description') ||
      c.includes('hsn') || c.includes('qty') || c.includes('mrp') ||
      c.includes('gst') || c.includes('taxable') || c.includes('total') ||
      c.includes('erp') || c.includes('ptr') || c.includes('price') ||
      c.includes('discount') || c.includes('s no') || c.includes('sr') ||
      c.includes('unit') || c.includes('case') || c.includes('value')
    ).length;
    if (headerScore >= 3) return i;
  }
  return 0;
}

function preprocessLine(line: string, delimiter: string): string {
  if (delimiter !== ',') return line;
  return line.replace(/(\d),(\d{3})(\.\d+)?/g, '$1$2$3');
}

// Split a CSV row without corrupting numeric cells that contain thousands separators.
// Preprocessing the whole line (merging every \d,\d{3} pair) can wrongly fuse two real columns,
// e.g. "4.0475,8247.74" -> "4.04758247.74". Only apply the merge when the raw split does not
// produce the expected number of columns.
function splitRow(line: string, delimiter: string, expectedCols: number): string[] {
  if (delimiter !== ',') return line.split(delimiter);
  const raw = line.split(',');
  if (raw.length === expectedCols) return raw;
  const merged = line.replace(/(\d),(\d{3})(\.\d+)?/g, '$1$2$3').split(',');
  return merged.length === expectedCols ? merged : raw;
}

function extractHeaderMeta(text: string): IngestHeader {
  const header: IngestHeader = {};
  const fullText = text;

  const invMatch = fullText.match(/(?:Invoice|Bill|Invoice No|Bill No|Invoice Number|Bill Number|Inv No|Bill No)[.:\s]*([A-Z0-9\-\/]{3,30})/i);
  if (invMatch) header.invoiceNumber = invMatch[1].trim();

  const dateMatch = fullText.match(/(?:Date|Invoice Date|Bill Date|Dt)[.:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  if (dateMatch) header.invoiceDate = dateMatch[1].trim();

  const gstins = Array.from(fullText.matchAll(/\b(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/g)).map(m => m[1]);
  if (gstins.length > 0) header.sellerGSTIN = gstins[0];
  if (gstins.length > 1) header.customerGSTIN = gstins[1];

  const sellerMatch = fullText.match(/(?:Seller|From|Supplier)[^\n]*?Firm Name[:\s]*([^\n\t]+)/i)
    || fullText.match(/(?:Seller|From|Supplier)[:\s]*([^\n\t]+)/i);
  if (sellerMatch) header.sellerName = sellerMatch[1].trim();

  const buyerMatch = fullText.match(/\b(?:Billed To|Customer|To|Buyer)\b[^\n]*?Firm Name[:\s]*([^\n\t]+)/i)
    || fullText.match(/\b(?:Billed To|Customer|To|Buyer)\b[:\s]*([^\n\t]+)/i);
  if (buyerMatch) header.customerName = buyerMatch[1].trim();

  // Skip bullet-list detail lines ("* Quantity: 180 | MRP: ₹10.00 | Total Value: ₹1,451.38")
  // when scanning for invoice-level totals, otherwise the first item's Total Value is
  // mistaken for the invoice grand total.
  const totalsText = fullText.split(/\r?\n/).filter(l => !/Quantity:.*\|\s*MRP:.*\|\s*Total Value:/i.test(l)).join('\n');

  const taxableMatch = totalsText.match(/(?:Taxable Value|Taxable Amount|Gross Amt)[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  if (taxableMatch) header.taxableAmount = parseNumberStrict(taxableMatch[1]);

  const cgstMatch = totalsText.match(/CGST Amount[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  if (cgstMatch) header.cgst = parseNumberStrict(cgstMatch[1]);

  const sgstMatch = totalsText.match(/SGST Amount[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  if (sgstMatch) header.sgst = parseNumberStrict(sgstMatch[1]);

  const totalGstMatch = totalsText.match(/(?:Total GST Amount|GST Amt\.?|GST Amount|Total GST)[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  if (totalGstMatch) header.totalGst = parseNumberStrict(totalGstMatch[1]);

  const grandTotalMatch = totalsText.match(/(?:Grand Total|Total Value|Total Amount|Invoice Total)[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  if (grandTotalMatch) header.grandTotal = parseNumberStrict(grandTotalMatch[1]);

  // CSV-specific: look for a total row at the end of the file
  const lines = fullText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length > 1) {
    const lastLine = lines[lines.length - 1].trim();
    const lastCols = lastLine.split(',');
    // If the first column is "Total" and there are numeric values at the end, treat it as a total row
    if (lastCols[0].trim().toLowerCase() === 'total' && lastCols.length >= 3) {
      const numericValues = lastCols.map(c => parseNumberStrict(c)).filter(n => n > 0);
      if (numericValues.length >= 2) {
        // Typically the last numeric value in a total row is the grand total
        const possibleGrandTotal = numericValues[numericValues.length - 1];
        const possibleTaxable = numericValues[numericValues.length - 3] || 0;
        const possibleGst = numericValues[numericValues.length - 2] || 0;
        
        if (possibleGrandTotal > 0) {
          header.grandTotal = possibleGrandTotal;
        }
        if (possibleTaxable > 0) {
          header.taxableAmount = possibleTaxable;
        }
        if (possibleGst > 0) {
          header.totalGst = possibleGst;
        }
      }
    }
  }

  return header;
}

function buildResult(items: IngestItem[], header: IngestHeader, format: IngestFormat): IngestResult {
  const calculatedTaxable = items.reduce((sum, item) => sum + item.taxableAmount, 0);
  const calculatedGst = items.reduce((sum, item) => sum + item.gstAmount, 0);
  const calculatedGrandTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);

  const grandTotal = header.grandTotal || calculatedGrandTotal;

  const filteredItems = header.grandTotal
    ? items.filter(item => Math.abs(item.totalAmount - header.grandTotal!) > 1)
    : items;

  const finalTaxable = filteredItems.reduce((sum, item) => sum + item.taxableAmount, 0);
  const finalGst = filteredItems.reduce((sum, item) => sum + item.gstAmount, 0);
  const finalGrandTotal = filteredItems.reduce((sum, item) => sum + item.totalAmount, 0);

  return {
    format,
    header,
    items: filteredItems,
    confidence: filteredItems.length > 0 ? 95 : 50,
    warnings: [],
    processingTimeMs: 0,
  };
}

export function parseCSV(csvText: string, fileName: string): IngestResult {
  const startTime = Date.now();
  const text = (csvText || '').trim();
  const warnings: string[] = [];

  if (!text) {
    return {
      format: 'csv',
      header: {},
      items: [],
      confidence: 0,
      warnings: ['Input text is empty'],
      processingTimeMs: Date.now() - startTime,
    };
  }

  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) {
    return {
      format: 'csv',
      header: {},
      items: [],
      confidence: 0,
      warnings: ['No data lines found'],
      processingTimeMs: Date.now() - startTime,
    };
  }

  const { delimiter, format } = detectDelimiter(lines);
  const headerRowIdx = detectHeaderRow(lines, delimiter);
  const headerLine = preprocessLine(lines[headerRowIdx], delimiter);
  const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
  const colMap = mapColumns(headers);

  const items: IngestItem[] = [];
  const headerMeta = extractHeaderMeta(text);

  // Check if the last line is a total row and extract totals from it
  const totalRowMeta: { taxableAmount?: number; totalGst?: number; grandTotal?: number } = {};
  if (lines.length > headerRowIdx + 1) {
    const lastLine = lines[lines.length - 1].trim();
    const lastCols = lastLine.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    const firstCol = lastCols[0].trim().toLowerCase();
    
    if (firstCol === 'total' || firstCol === 'grand total' || firstCol === 'subtotal') {
      // Extract totals from the total row based on column positions
      if (colMap.taxableAmount !== undefined && lastCols[colMap.taxableAmount]) {
        totalRowMeta.taxableAmount = parseNumberStrict(lastCols[colMap.taxableAmount]);
      }
      if (colMap.gstAmount !== undefined && lastCols[colMap.gstAmount]) {
        totalRowMeta.totalGst = parseNumberStrict(lastCols[colMap.gstAmount]);
      }
      if (colMap.totalAmount !== undefined && lastCols[colMap.totalAmount]) {
        totalRowMeta.grandTotal = parseNumberStrict(lastCols[colMap.totalAmount]);
      }
      
      // Fallback: if column mapping didn't work, try to find totals by position
      // In the user's CSV, totals are typically in the last 3 numeric columns
      if (!totalRowMeta.grandTotal && lastCols.length >= 3) {
        const numericValues = lastCols.map(c => parseNumberStrict(c)).filter(n => n > 0);
        if (numericValues.length >= 3) {
          totalRowMeta.taxableAmount = numericValues[numericValues.length - 3];
          totalRowMeta.totalGst = numericValues[numericValues.length - 2];
          totalRowMeta.grandTotal = numericValues[numericValues.length - 1];
        }
      }
    }
  }

  const startRow = headerRowIdx + 1;
  for (let i = startRow; i < lines.length; i++) {
    const rawCols = splitRow(lines[i], delimiter, headers.length);
    const cols = rawCols.map(c => c.trim().replace(/^["']|["']$/g, ''));

    if (cols.length < 2) continue;

    const firstCol = cols[0].trim().toLowerCase();
    const rowText = cols.join(' ').toLowerCase();

    // Skip total/subtotal rows
    if (firstCol === 'total' || firstCol === 'grand total' || firstCol === 'subtotal') continue;
    if (rowText.includes('grand total') || rowText.includes('subtotal')) continue;
    if (rowText.includes('s no') || rowText.includes('sr no') || rowText.includes('sl no')) continue;

    // Skip rows that look like totals (empty product name + numeric totals)
    const productName = cols[colMap.productName ?? 1] || `Item ${items.length + 1}`;
    const hasEmptyProductName = !productName || productName.trim() === '';
    const hasNumericTotals = parseNumberStrict(cols[colMap.totalAmount ?? (cols.length - 1)]) > 0;
    if (hasEmptyProductName && hasNumericTotals) continue;

    const nonEmptyCols = cols.filter(c => c.trim().length > 0).length;
    if (nonEmptyCols <= 3) continue;

    if (!productName || productName.toLowerCase().includes('total')) continue;

    const erpId = colMap.erpId !== undefined ? cols[colMap.erpId] : undefined;
    const hsnCode = colMap.hsnCode !== undefined ? cols[colMap.hsnCode] : undefined;
    const mrp = colMap.mrp !== undefined ? parseNumberStrict(cols[colMap.mrp]) : undefined;
    const unit = colMap.unit !== undefined ? cols[colMap.unit] : undefined;
    const cases = colMap.cases !== undefined ? parseNumberStrict(cols[colMap.cases]) : undefined;
    const quantity = colMap.quantity !== undefined ? parseNumberStrict(cols[colMap.quantity]) : 1;
    const ptr = colMap.ptr !== undefined ? parseNumberStrict(cols[colMap.ptr]) : undefined;
    const pricePerStd = colMap.pricePerStd !== undefined ? parseNumberStrict(cols[colMap.pricePerStd]) : undefined;
    const discount = colMap.discount !== undefined ? parseNumberStrict(cols[colMap.discount]) : undefined;
    const taxableAmount = colMap.taxableAmount !== undefined
      ? parseNumberStrict(cols[colMap.taxableAmount])
      : (quantity * (pricePerStd || ptr || mrp || 0));
    const gstRate = colMap.gstRate !== undefined ? parseNumberStrict(cols[colMap.gstRate]) : 5;
    const gstAmount = colMap.gstAmount !== undefined
      ? parseNumberStrict(cols[colMap.gstAmount])
      : (taxableAmount * gstRate / 100);
    const totalAmount = colMap.totalAmount !== undefined
      ? parseNumberStrict(cols[colMap.totalAmount])
      : (taxableAmount + gstAmount);

    const unitPrice = pricePerStd || ptr || (quantity > 0 ? taxableAmount / quantity : 0);

    items.push({
      srNo: colMap.srNo !== undefined ? parseNumberStrict(cols[colMap.srNo]) : (items.length + 1),
      erpId: erpId || undefined,
      productName: productName.trim(),
      hsnCode: hsnCode || undefined,
      mrp: mrp,
      unit: unit || 'PCS',
      cases: cases,
      quantity: Math.max(0, quantity),
      unitPrice: parseFloat(unitPrice.toFixed(4)),
      discount: discount,
      taxableAmount: parseFloat(taxableAmount.toFixed(2)),
      gstRate: gstRate,
      gstAmount: parseFloat(gstAmount.toFixed(2)),
      totalAmount: parseFloat(totalAmount.toFixed(2)),
    });
  }

  // Merge total row metadata into header
  const finalHeader = {
    ...headerMeta,
    ...totalRowMeta,
  };

  return buildResult(items, finalHeader, format);
}
