import { UniversalItem, UniversalExtractionResult } from './universal-extractor';

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

interface BillHeader {
  invoiceNumber?: string;
  invoiceDate?: string;
  sellerName?: string;
  sellerGSTIN?: string;
  customerName?: string;
  customerGSTIN?: string;
  billType?: string;
  taxableAmount?: number;
  cgst?: number;
  sgst?: number;
  totalGst?: number;
  grandTotal?: number;
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
    // Header is more specific and contains every alias token, e.g. 'GST Amt. (₹)' vs 'gst amt'.
    // The reverse direction is intentionally NOT matched: a short header like 'rate' must not
    // match the alias 'gst rate', and 'qty' must not match 'case qty'.
    const aliasTokens = normAlias.split(' ').filter(Boolean);
    if (aliasTokens.length > 0 && aliasTokens.every(t => normTokens.includes(t))) return true;
  }
  return false;
}

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

function parseNumberLoose(val: string): number {
  if (!val) return 0;
  const cleaned = val
    .replace(/[₹\s]/g, '')
    .replace(/,/g, '')
    .replace(/[a-zA-Z%()]/g, '')
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function preprocessLine(line: string, delimiter: string): string {
  if (delimiter !== ',') return line;
  return line.replace(/(\d),(\d{3})(\.\d+)?/g, '$1$2$3');
}

// Split a CSV row without corrupting numeric cells containing thousands separators.
// Only merge \d,\d{3} pairs when the raw split does not produce the expected column count.
function splitRow(line: string, delimiter: string, expectedCols: number): string[] {
  if (delimiter !== ',') return line.split(delimiter);
  const raw = line.split(',');
  if (raw.length === expectedCols) return raw;
  const merged = line.replace(/(\d),(\d{3})(\.\d+)?/g, '$1$2$3').split(',');
  return merged.length === expectedCols ? merged : raw;
}

function detectDelimiter(lines: string[]): { delimiter: string; format: string } {
  if (lines.length === 0) return { delimiter: ',', format: 'CSV' };

  const firstLine = lines[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const pipeCount = (firstLine.match(/\|/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  // Don't count commas between digits (thousands separators like "8,247.74")
  const commaCount = (firstLine.match(/,(?!\d)|(?<!\d),/g) || []).length;

  if (tabCount >= 2) return { delimiter: '\t', format: 'TSV (Excel Paste)' };
  if (pipeCount >= 2) return { delimiter: '|', format: 'PSV (Pipe Separated)' };
  if (semicolonCount >= 2 && commaCount < 2) return { delimiter: ';', format: 'CSV (Semicolon)' };
  if (commaCount >= 2) return { delimiter: ',', format: 'CSV' };

  const spaceAligned = firstLine.match(/\s{2,}/);
  if (spaceAligned) return { delimiter: ' ', format: 'Space Aligned Table' };

  return { delimiter: ',', format: 'CSV' };
}

function detectHeaderRow(lines: string[], delimiter: string): number {
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const processedLine = preprocessLine(lines[i], delimiter);
    const cols = processedLine.split(delimiter).map(c => c.trim().toLowerCase());
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

function mapColumns(headers: string[], delimiter: string): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalized = headers.map(h => normalizeHeader(h));

  for (let i = 0; i < normalized.length; i++) {
    const h = normalized[i];
    const raw = headers[i].toLowerCase();

    if (!mapping.srNo && (matchAlias(h, SR_NO_ALIASES) || matchAlias(raw, SR_NO_ALIASES))) {
      mapping.srNo = i;
    }
    if (!mapping.erpId && (matchAlias(h, ERP_ID_ALIASES) || matchAlias(raw, ERP_ID_ALIASES))) {
      mapping.erpId = i;
    }
    if (!mapping.productName && (matchAlias(h, PRODUCT_NAME_ALIASES) || matchAlias(raw, PRODUCT_NAME_ALIASES))) {
      mapping.productName = i;
    }
    if (!mapping.hsnCode && (matchAlias(h, HSN_ALIASES) || matchAlias(raw, HSN_ALIASES))) {
      mapping.hsnCode = i;
    }
    if (!mapping.mrp && (matchAlias(h, MRP_ALIASES) || matchAlias(raw, MRP_ALIASES))) {
      mapping.mrp = i;
    }
    if (!mapping.unit && (matchAlias(h, UNIT_ALIASES) || matchAlias(raw, UNIT_ALIASES))) {
      mapping.unit = i;
    }
    if (!mapping.cases && (matchAlias(h, CASES_ALIASES) || matchAlias(raw, CASES_ALIASES))) {
      mapping.cases = i;
    }
    if (!mapping.quantity && (matchAlias(h, QTY_ALIASES) || matchAlias(raw, QTY_ALIASES))) {
      mapping.quantity = i;
    }
    if (!mapping.ptr && (matchAlias(h, PTR_ALIASES) || matchAlias(raw, PTR_ALIASES))) {
      mapping.ptr = i;
    }
    if (!mapping.pricePerStd && (matchAlias(h, PRICE_STD_ALIASES) || matchAlias(raw, PRICE_STD_ALIASES))) {
      mapping.pricePerStd = i;
    }
    if (!mapping.discount && (matchAlias(h, DISCOUNT_ALIASES) || matchAlias(raw, DISCOUNT_ALIASES))) {
      mapping.discount = i;
    }
    if (!mapping.taxableAmount && (matchAlias(h, TAXABLE_ALIASES) || matchAlias(raw, TAXABLE_ALIASES))) {
      mapping.taxableAmount = i;
    }
    if (!mapping.gstRate && (matchAlias(h, GST_RATE_ALIASES) || matchAlias(raw, GST_RATE_ALIASES))) {
      mapping.gstRate = i;
    }
    if (!mapping.gstAmount && (matchAlias(h, GST_AMT_ALIASES) || matchAlias(raw, GST_AMT_ALIASES))) {
      mapping.gstAmount = i;
    }
    if (!mapping.totalAmount && (matchAlias(h, TOTAL_ALIASES) || matchAlias(raw, TOTAL_ALIASES))) {
      mapping.totalAmount = i;
    }
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

function parseConcatenatedRow(row: string): UniversalItem | null {
  const erpMatch = row.match(/^(\d+)([A-Z]{2}\d{14,22}[A-Z])/);
  if (!erpMatch) return null;

  const srNo = parseInt(erpMatch[1]);
  const erpId = erpMatch[2];
  const restAfterErp = row.substring(erpMatch[0].length);

  const hsnMatch = restAfterErp.match(/(\d{8})/);
  if (!hsnMatch) return null;

  const hsnCode = hsnMatch[1];
  const itemName = restAfterErp.substring(0, hsnMatch.index!).trim();
  const afterHsn = restAfterErp.substring(hsnMatch.index! + 8);

  const primaryDisMatch = afterHsn.match(/([\d.]+)\s*\([\d.]+\)/);
  if (!primaryDisMatch) return null;

  const beforeDis = afterHsn.substring(0, primaryDisMatch.index!);
  const afterDis = afterHsn.substring(primaryDisMatch.index! + primaryDisMatch[0].length);

  const rightMatch = afterDis.match(/([\d,]+\.\d{2})(\d{1,2})([\d,]+\.\d{2})([\d,]+\.\d{2})$/);
  if (!rightMatch) return null;
  const taxableAmount = parseNumberStrict(rightMatch[1]);
  const gstRate = parseInt(rightMatch[2]);
  const gstAmount = parseNumberStrict(rightMatch[3]);
  const totalAmount = parseNumberStrict(rightMatch[4]);

  let pricePerStd: number | undefined;
  let ptr: number | undefined;
  let quantity = 0;
  let cases = 0;
  let stdUnit = 0;
  let mrp: number | undefined;

  if (beforeDis.length > 0) {
    let bd = beforeDis;

    const priceStdMatch = bd.match(/([\d,]+\.\d{2,4})$/);
    if (priceStdMatch) {
      pricePerStd = parseNumberStrict(priceStdMatch[1]);
      bd = bd.substring(0, priceStdMatch.index!);
    }

    const ptrMatch = bd.match(/(\d+\.\d{2})$/);
    if (ptrMatch) {
      ptr = parseNumberStrict(ptrMatch[1]);
      bd = bd.substring(0, ptrMatch.index!);
    }

    const qtyMatch = bd.match(/(\d+)$/);
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1]);
      bd = bd.substring(0, qtyMatch.index!);
    }

    const casesMatch = bd.match(/(\d+)$/);
    if (casesMatch) {
      cases = parseInt(casesMatch[1]);
      bd = bd.substring(0, casesMatch.index!);
    }

    const stdUnitMatch = bd.match(/(\d+)$/);
    if (stdUnitMatch) {
      stdUnit = parseInt(stdUnitMatch[1]);
      bd = bd.substring(0, stdUnitMatch.index!);
    }

    if (bd.length > 0) {
      mrp = parseNumberStrict(bd);
    }
  }

  return {
    srNo,
    erpId,
    productName: itemName,
    hsnCode,
    mrp,
    unit: stdUnit > 0 ? 'PCS' : undefined,
    cases: cases > 0 ? cases : undefined,
    quantity,
    unitPrice: parseFloat((ptr || (quantity > 0 ? taxableAmount / quantity : 0)).toFixed(4)),
    taxableAmount: parseFloat(taxableAmount.toFixed(2)),
    gstRate,
    gstAmount: parseFloat(gstAmount.toFixed(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2)),
  };
}

function detectConcatenatedFormat(lines: string[]): boolean {
  const concatenatedHeaderPatterns = [
    /S\.No\.Item ERP IdItem NameHSN Code/i,
    /S\.No\.\s*Item ERP Id\s*Item Name/i,
    /SNoItem ERP IdItem NameHSN Code/i,
  ];

  for (const line of lines) {
    for (const pattern of concatenatedHeaderPatterns) {
      if (pattern.test(line)) return true;
    }
  }
  return false;
}

// Detect if the text is in bullet list format (e.g. "**1. Item Name**" followed by "* Quantity: X | MRP: ₹Y | Total Value: ₹Z")
function detectBulletListFormat(lines: string[]): boolean {
  let itemCount = 0;
  let detailCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    // Item header: "**1. Item Name**" or "1. Item Name" or "* Item Name"
    if (/^\*{0,2}\s*\d+[\.\)]\s+[A-Za-z]/.test(trimmed) || /^\*\*\d+[\.\)]/.test(trimmed)) {
      itemCount++;
    }
    // Detail line: "* Quantity: X | MRP: ₹Y | Total Value: ₹Z"
    if (/^\*?\s*Quantity:/.test(trimmed) || /Quantity:.*\|.*MRP:.*\|.*Total Value:/.test(trimmed)) {
      detailCount++;
    }
  }

  // Require at least 2 items and at least 1 detail line to consider it a bullet list
  return itemCount >= 2 && detailCount >= 1;
}

// Parse bullet list format: "**1. Item Name**" + "* Quantity: X | MRP: ₹Y | Total Value: ₹Z"
function parseBulletListFormat(lines: string[], fullText: string): UniversalExtractionResult {
  const items: UniversalItem[] = [];
  const headerMeta = extractBillHeader(lines, ',');

  let currentItem: Partial<UniversalItem> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Item header: "**1. Item Name**" or "1. Item Name" or "* Item Name"
    const itemHeaderMatch = trimmed.match(/^\*{0,2}\s*(\d+)[\.\)]\s+(.+?)\*{0,2}$/);
    if (itemHeaderMatch) {
      // Save previous item
      if (currentItem && currentItem.productName) {
        items.push(finalizeBulletItem(currentItem, items.length + 1));
      }
      currentItem = {
        srNo: parseInt(itemHeaderMatch[1]),
        productName: itemHeaderMatch[2].trim(),
      };
      continue;
    }

    // Detail line: "* Quantity: X | MRP: ₹Y | Total Value: ₹Z"
    if (currentItem && /Quantity:/.test(trimmed)) {
      const qtyMatch = trimmed.match(/Quantity:\s*([\d,]+)/i);
      if (qtyMatch) currentItem.quantity = parseNumberStrict(qtyMatch[1]);

      const mrpMatch = trimmed.match(/MRP:\s*₹?\s*([\d,]+\.?\d*)/i);
      if (mrpMatch) currentItem.mrp = parseNumberStrict(mrpMatch[1]);

      const totalMatch = trimmed.match(/Total Value:\s*₹?\s*([\d,]+\.\d{2})/i);
      if (totalMatch) currentItem.totalAmount = parseNumberStrict(totalMatch[1]);
    }
  }

  // Save last item
  if (currentItem && currentItem.productName) {
    items.push(finalizeBulletItem(currentItem, items.length + 1));
  }

  return buildResult(items, headerMeta, 'Bullet List');
}

// Finalize a bullet list item by computing derived fields
function finalizeBulletItem(item: Partial<UniversalItem>, srNo: number): UniversalItem {
  const quantity = item.quantity || 1;
  const totalAmount = item.totalAmount || 0;
  const mrp = item.mrp;

  // GST is 5% on all items per the invoice summary
  const gstRate = 5;
  const taxableAmount = totalAmount > 0 ? Math.round((totalAmount / 1.05) * 100) / 100 : 0;
  const gstAmount = totalAmount > 0 ? Math.round((totalAmount - taxableAmount) * 100) / 100 : 0;
  const unitPrice = quantity > 0 ? taxableAmount / quantity : 0;

  return {
    srNo: item.srNo || srNo,
    productName: item.productName || `Item ${srNo}`,
    mrp,
    quantity,
    unitPrice: parseFloat(unitPrice.toFixed(4)),
    taxableAmount: parseFloat(taxableAmount.toFixed(2)),
    gstRate,
    gstAmount: parseFloat(gstAmount.toFixed(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2)),
  };
}

export function extractBillFromText(rawInput: string): UniversalExtractionResult {
  const text = (rawInput || '').trim();
  const warnings: string[] = [];

  if (!text) {
    return {
      detectedFormat: 'Unstructured Invoice Text',
      items: [],
      subtotal: 0,
      taxableAmount: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalGst: 0,
      grandTotal: 0,
      confidence: 0,
      rawText: '',
      warnings: ['Input text is empty'],
    };
  }

  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);

  if (lines.length === 0) {
    return {
      detectedFormat: 'Unstructured Invoice Text',
      items: [],
      subtotal: 0,
      taxableAmount: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalGst: 0,
      grandTotal: 0,
      confidence: 0,
      rawText: text,
      warnings: ['No data lines found'],
    };
  }

  if (detectConcatenatedFormat(lines)) {
    return parseConcatenatedFormat(lines, text);
  }

  if (detectBulletListFormat(lines)) {
    return parseBulletListFormat(lines, text);
  }

  const { delimiter, format } = detectDelimiter(lines);
  const headerRowIdx = detectHeaderRow(lines, delimiter);
  const headerLine = preprocessLine(lines[headerRowIdx], delimiter);
  const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
  const colMap = mapColumns(headers, delimiter);

  const items: UniversalItem[] = [];
  const headerMeta = extractBillHeader(lines, delimiter);

  const startRow = headerRowIdx + 1;
  for (let i = startRow; i < lines.length; i++) {
    const rawCols = splitRow(lines[i], delimiter, headers.length);
    const cols = rawCols.map(c => c.trim().replace(/^["']|["']$/g, ''));

    if (cols.length < 2) continue;

    const firstCol = cols[0].trim().toLowerCase();
    const rowText = cols.join(' ').toLowerCase();

    if (firstCol === 'total' || firstCol === 'grand total' || firstCol === 'subtotal') continue;
    if (rowText.includes('grand total') || rowText.includes('subtotal')) continue;
    if (rowText.includes('s no') || rowText.includes('sr no') || rowText.includes('sl no')) continue;

    const nonEmptyCols = cols.filter(c => c.trim().length > 0).length;
    if (nonEmptyCols <= 3) continue;

    const productName = cols[colMap.productName ?? 1] || `Item ${items.length + 1}`;
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

  return buildResult(items, headerMeta, format);
}

function parseConcatenatedFormat(lines: string[], fullText: string): UniversalExtractionResult {
  const items: UniversalItem[] = [];
  const headerMeta = extractBillHeader(lines, ',');

  let dataStarted = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (!dataStarted) {
      if (/^S\.No\.Item ERP Id/.test(trimmed) || /^SNoItem ERP Id/.test(trimmed)) {
        dataStarted = true;
      }
      continue;
    }

    if (/^Total/.test(trimmed)) continue;
    if (/^Invoice Summary/.test(trimmed)) continue;
    if (/^Gross Amt:/i.test(trimmed)) continue;

    const item = parseConcatenatedRow(trimmed);
    if (item) {
      items.push(item);
    }
  }

  return buildResult(items, headerMeta, 'Concatenated Table');
}

function buildResult(items: UniversalItem[], headerMeta: BillHeader, format: string): UniversalExtractionResult {
  const calculatedTaxable = items.reduce((sum, item) => sum + item.taxableAmount, 0);
  const calculatedGst = items.reduce((sum, item) => sum + item.gstAmount, 0);
  const calculatedGrandTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);

  const grandTotal = headerMeta.grandTotal || calculatedGrandTotal;

  const filteredItems = headerMeta.grandTotal
    ? items.filter(item => Math.abs(item.totalAmount - headerMeta.grandTotal!) > 1)
    : items;

  const finalTaxable = filteredItems.reduce((sum, item) => sum + item.taxableAmount, 0);
  const finalGst = filteredItems.reduce((sum, item) => sum + item.gstAmount, 0);
  const finalGrandTotal = filteredItems.reduce((sum, item) => sum + item.totalAmount, 0);

  return {
    detectedFormat: format as UniversalExtractionResult['detectedFormat'],
    invoiceNumber: headerMeta.invoiceNumber,
    invoiceDate: headerMeta.invoiceDate,
    sellerName: headerMeta.sellerName,
    sellerGSTIN: headerMeta.sellerGSTIN,
    customerName: headerMeta.customerName,
    customerGSTIN: headerMeta.customerGSTIN,
    items: filteredItems,
    subtotal: finalTaxable,
    taxableAmount: headerMeta.taxableAmount || finalTaxable,
    cgst: headerMeta.cgst || (finalGst / 2),
    sgst: headerMeta.sgst || (finalGst / 2),
    igst: 0,
    totalGst: headerMeta.totalGst || finalGst,
    grandTotal: grandTotal,
    confidence: filteredItems.length > 0 ? 95 : 50,
    rawText: '',
    warnings: [],
  };
}

function extractBillHeader(lines: string[], delimiter: string): BillHeader {
  const header: BillHeader = {};

  const fullText = lines.join('\n');

  const invMatch = fullText.match(/(RS\/\d{2}-\d{2}\/\d+)|(?:Invoice\/Bill Number|Invoice Number|Bill Number|Invoice No|Bill No|Bill\/Invoice No|Inv No)[.:\s]*\*{0,2}\s*([A-Z0-9\-\/]{3,30})/i);
  if (invMatch) header.invoiceNumber = (invMatch[1] || invMatch[2]).trim();

  const dateMatch = fullText.match(/(?:Date|Invoice Date|Bill Date|Dt)[.:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  if (dateMatch) header.invoiceDate = dateMatch[1].trim();

  const gstins = Array.from(fullText.matchAll(/\b(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/g)).map(m => m[1]);
  if (gstins.length > 0) header.sellerGSTIN = gstins[0];
  if (gstins.length > 1) header.customerGSTIN = gstins[1];

  const sellerMatch = fullText.match(/\b(?:Seller|From|Supplier)\b[^\n]*?Firm Name[:\s]*([^\n\t]+)/i)
    || fullText.match(/\b(?:Seller|From|Supplier)\b[:\s]*([^\n\t]+)/i);
  if (sellerMatch) header.sellerName = sellerMatch[1].trim();

  const buyerMatch = fullText.match(/\b(?:Billed To|Customer|To|Buyer)\b[^\n]*?Firm Name[:\s]*([^\n\t]+)/i)
    || fullText.match(/\b(?:Billed To|Customer|To|Buyer)\b[:\s]*([^\n\t]+)/i);
  if (buyerMatch) header.customerName = buyerMatch[1].trim();

  // Skip bullet-list detail lines ("* Quantity: 180 | MRP: ₹10.00 | Total Value: ₹1,451.38")
  // when scanning for invoice-level totals so a line item's Total Value is not taken
  // as the invoice grand total.
  const totalsText = fullText.split(/\r?\n/).filter(l => !/Quantity:.*\|\s*MRP:.*\|\s*Total Value:/i.test(l)).join('\n');

  const taxableMatch = totalsText.match(/(?:Taxable Value|Taxable Amount|Gross Amt)[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  if (taxableMatch) header.taxableAmount = parseNumberLoose(taxableMatch[1]);

  const cgstMatch = totalsText.match(/CGST Amount[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  if (cgstMatch) header.cgst = parseNumberLoose(cgstMatch[1]);

  const sgstMatch = totalsText.match(/SGST Amount[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  if (sgstMatch) header.sgst = parseNumberLoose(sgstMatch[1]);

  const totalGstMatch = totalsText.match(/(?:Total GST Amount|GST Amt\.?|GST Amount|Total GST)[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  if (totalGstMatch) header.totalGst = parseNumberLoose(totalGstMatch[1]);

  const grandTotalMatch = totalsText.match(/(?:Grand Total|Total Value|Total Amount|Invoice Total)[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  if (grandTotalMatch) header.grandTotal = parseNumberLoose(grandTotalMatch[1]);

  return header;
}

export function extractBillFromCSV(csvText: string): UniversalExtractionResult {
  return extractBillFromText(csvText);
}

export function extractBillFromTSV(tsvText: string): UniversalExtractionResult {
  return extractBillFromText(tsvText);
}

export function extractBillFromPaste(pasteText: string): UniversalExtractionResult {
  return extractBillFromText(pasteText);
}

export function extractBillFromFileContent(fileName: string, content: string): UniversalExtractionResult {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  switch (ext) {
    case 'tsv':
      return extractBillFromTSV(content);
    case 'csv':
      return extractBillFromCSV(content);
    case 'txt':
    case 'text':
      return extractBillFromPaste(content);
    default:
      return extractBillFromText(content);
  }
}