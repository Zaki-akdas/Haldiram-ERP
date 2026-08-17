export interface UniversalItem {
  srNo?: number;
  erpId?: string;
  productName: string;
  hsnCode?: string;
  mrp?: number;
  unit?: string;
  cases?: number;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxableAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
}

export interface UniversalExtractionResult {
  detectedFormat: 'TSV (Excel Paste)' | 'CSV' | 'PSV (Pipe Separated)' | 'JSON' | 'Space Aligned Table' | 'Bullet List' | 'Unstructured Invoice Text';
  invoiceNumber?: string;
  invoiceDate?: string;
  sellerName?: string;
  sellerGSTIN?: string;
  customerName?: string;
  customerGSTIN?: string;
  items: UniversalItem[];
  subtotal: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  grandTotal: number;
  confidence: number;
  rawText: string;
  warnings: string[];
}

export function parseUniversalData(rawInput: string): UniversalExtractionResult {
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
      warnings: ['Input text is empty']
    };
  }

  // 1. Check if input is JSON
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      const parsed = JSON.parse(text);
      return parseFromJsonObject(parsed, text);
    } catch {
      // Not valid JSON, continue
    }
  }

  // 2. Check if TSV (Excel / Google Sheets Copy-Paste)
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const tabCount = lines.reduce((acc, line) => acc + (line.match(/\t/g) || []).length, 0);
  const avgTabs = lines.length > 0 ? tabCount / lines.length : 0;

  if (avgTabs >= 2) {
    return parseDelimitedTable(lines, '\t', 'TSV (Excel Paste)', text);
  }

  // 3. Check if PSV (Pipe Separated `|`)
  const pipeCount = lines.reduce((acc, line) => acc + (line.match(/\|/g) || []).length, 0);
  const avgPipes = lines.length > 0 ? pipeCount / lines.length : 0;
  if (avgPipes >= 2) {
    return parseDelimitedTable(lines, '|', 'PSV (Pipe Separated)', text);
  }

  // 4. Check if CSV (Comma Separated `,`)
  const commaCount = lines.reduce((acc, line) => acc + (line.match(/,/g) || []).length, 0);
  const avgCommas = lines.length > 0 ? commaCount / lines.length : 0;
  if (avgCommas >= 2 && !text.toLowerCase().includes('invoice/bill number')) {
    return parseDelimitedTable(lines, ',', 'CSV', text);
  }

  // 5. Check if Bullet List format (e.g. "**1. Item Name**" + "* Quantity: X | MRP: ₹Y | Total Value: ₹Z")
  if (detectBulletListFormat(lines)) {
    return parseBulletList(text);
  }

  // 6. Fallback: Parse Unstructured / OCR Invoice Text (Headers + Space aligned / Tabular rows)
  return parseUnstructuredInvoice(text);
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
function parseBulletList(text: string): UniversalExtractionResult {
  const headerMeta = extractHeaderMeta(text);
  const items: UniversalItem[] = [];
  const warnings: string[] = [];

  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);

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
      if (qtyMatch) currentItem.quantity = parseNumber(qtyMatch[1]);

      const mrpMatch = trimmed.match(/MRP:\s*₹?\s*([\d,]+\.?\d*)/i);
      if (mrpMatch) currentItem.mrp = parseNumber(mrpMatch[1]);

      const totalMatch = trimmed.match(/Total Value:\s*₹?\s*([\d,]+\.\d{2})/i);
      if (totalMatch) currentItem.totalAmount = parseNumber(totalMatch[1]);
    }
  }

  // Save last item
  if (currentItem && currentItem.productName) {
    items.push(finalizeBulletItem(currentItem, items.length + 1));
  }

  const calculatedTaxable = items.reduce((sum, item) => sum + item.taxableAmount, 0);
  const calculatedGst = items.reduce((sum, item) => sum + item.gstAmount, 0);
  const calculatedGrandTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);

  return {
    detectedFormat: 'Bullet List',
    invoiceNumber: headerMeta.invoiceNumber,
    invoiceDate: headerMeta.invoiceDate,
    sellerName: headerMeta.sellerName,
    sellerGSTIN: headerMeta.sellerGSTIN,
    customerName: headerMeta.customerName,
    customerGSTIN: headerMeta.customerGSTIN,
    items,
    subtotal: calculatedTaxable,
    taxableAmount: headerMeta.taxableAmount || calculatedTaxable,
    cgst: headerMeta.cgst || (calculatedGst / 2),
    sgst: headerMeta.sgst || (calculatedGst / 2),
    igst: 0,
    totalGst: headerMeta.totalGst || calculatedGst,
    grandTotal: headerMeta.grandTotal || calculatedGrandTotal,
    confidence: items.length > 0 ? 90 : 40,
    rawText: text,
    warnings: items.length === 0 ? ['No line items detected from bullet list format.'] : warnings,
  };
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

// Handler for Delimited Tables (TSV, CSV, PSV)
function parseDelimitedTable(lines: string[], delimiter: string, formatName: UniversalExtractionResult['detectedFormat'], rawText: string): UniversalExtractionResult {
  const warnings: string[] = [];
  const items: UniversalItem[] = [];

  let headerIndex = -1;
  const colIndexes: Record<string, number> = {};

  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim().toLowerCase());
    const isHeader = cols.some(c => c.includes('item') || c.includes('product') || c.includes('description') || c.includes('hsn') || c.includes('qty'));
    if (isHeader) {
      headerIndex = i;
      cols.forEach((col, idx) => {
        // else-if chain: a column is assigned to its first matching role so
        // ambiguous names (e.g. 'HSN Code', 'GST Rate %') can't steal erpId/unitPrice.
        if (col.includes('sr') || col === 's.no' || col === 's no') colIndexes.srNo = idx;
        else if (col.includes('item') || col.includes('product') || col.includes('description') || col.includes('name')) colIndexes.productName = idx;
        else if (col.includes('hsn')) colIndexes.hsnCode = idx;
        else if (col.includes('sku') || col.includes('code') || col.includes('erp')) colIndexes.erpId = idx;
        else if (col.includes('mrp')) colIndexes.mrp = idx;
        else if (col.includes('case')) colIndexes.cases = idx;
        else if (col.includes('qty') || col.includes('quantity')) colIndexes.quantity = idx;
        else if (col.includes('gst %') || col.includes('tax %') || col.includes('rate %')) colIndexes.gstRate = idx;
        else if (col.includes('unit price') || col.includes('price') || col.includes('rate')) colIndexes.unitPrice = idx;
        else if (col.includes('taxable') || col.includes('base')) colIndexes.taxableAmount = idx;
        else if (col.includes('gst amt') || col.includes('tax amt')) colIndexes.gstAmount = idx;
        else if (col.includes('total')) colIndexes.totalAmount = idx;
      });
      break;
    }
  }

  const startRow = headerIndex >= 0 ? headerIndex + 1 : 0;
  for (let i = startRow; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim());
    if (cols.length < 2) continue;

    const prodNameIndex = colIndexes.productName ?? (cols.length > 2 ? 1 : 0);
    const productName = cols[prodNameIndex] || `Item ${i - startRow + 1}`;
    if (!productName || productName.toLowerCase().includes('total') || productName.toLowerCase().includes('summary')) continue;

    const quantity = parseNumber(cols[colIndexes.quantity ?? 2]) || 1;
    const unitPrice = parseNumber(cols[colIndexes.unitPrice ?? 3]) || 0;
    const taxableAmount = parseNumber(cols[colIndexes.taxableAmount]) || (quantity * unitPrice);
    const gstRate = parseNumber(cols[colIndexes.gstRate]) || 5;
    const gstAmount = parseNumber(cols[colIndexes.gstAmount]) || (taxableAmount * gstRate / 100);
    const totalAmount = parseNumber(cols[colIndexes.totalAmount]) || (taxableAmount + gstAmount);

    items.push({
      srNo: parseNumber(cols[colIndexes.srNo]) || (items.length + 1),
      erpId: cols[colIndexes.erpId] || undefined,
      productName,
      hsnCode: cols[colIndexes.hsnCode] || undefined,
      mrp: parseNumber(cols[colIndexes.mrp]) || undefined,
      cases: parseNumber(cols[colIndexes.cases]) || undefined,
      quantity,
      unitPrice,
      taxableAmount,
      gstRate,
      gstAmount,
      totalAmount,
    });
  }

  const headerMeta = extractHeaderMeta(rawText);
  const calculatedTaxable = items.reduce((sum, item) => sum + item.taxableAmount, 0);
  const calculatedGst = items.reduce((sum, item) => sum + item.gstAmount, 0);
  const calculatedGrandTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);

  return {
    detectedFormat: formatName,
    invoiceNumber: headerMeta.invoiceNumber,
    invoiceDate: headerMeta.invoiceDate,
    sellerName: headerMeta.sellerName,
    sellerGSTIN: headerMeta.sellerGSTIN,
    customerName: headerMeta.customerName,
    customerGSTIN: headerMeta.customerGSTIN,
    items,
    subtotal: calculatedTaxable,
    taxableAmount: headerMeta.taxableAmount || calculatedTaxable,
    cgst: headerMeta.cgst || (calculatedGst / 2),
    sgst: headerMeta.sgst || (calculatedGst / 2),
    igst: 0,
    totalGst: headerMeta.totalGst || calculatedGst,
    grandTotal: headerMeta.grandTotal || calculatedGrandTotal,
    confidence: items.length > 0 ? 95 : 50,
    rawText,
    warnings
  };
}

// Helper: Extract financial amounts from tail string using decimal boundaries
function extractTailAmounts(tailStr: string) {
  const matches = tailStr.match(/([\d,]+\.\d{2})/g);
  if (!matches || matches.length < 3) return null;

  const totalAmountStr = matches[matches.length - 1];
  const gstAmountStr = matches[matches.length - 2];
  const firstMatch = matches[matches.length - 3];
  
  const totalAmount = parseNumber(totalAmountStr);
  const gstAmount = parseNumber(gstAmountStr);
  
  const expectedTaxable = Math.round((totalAmount - gstAmount) * 100) / 100;
  let taxableAmount = expectedTaxable;

  let numBlob = tailStr.substring(0, tailStr.lastIndexOf(firstMatch));
  const expectedTaxableStr = expectedTaxable.toFixed(2);
  const expectedTaxableStrWithCommas = expectedTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  if (firstMatch.endsWith(expectedTaxableStrWithCommas)) {
    numBlob += firstMatch.slice(0, -expectedTaxableStrWithCommas.length);
  } else if (firstMatch.endsWith(expectedTaxableStr)) {
    numBlob += firstMatch.slice(0, -expectedTaxableStr.length);
  } else {
    // If it doesn't match expected exactly, fallback to removing the last .2f from firstMatch using a strict regex
    const taxMatch = firstMatch.match(/([\d,]+\.\d{2})$/);
    if (taxMatch) {
      taxableAmount = parseNumber(taxMatch[1]);
      numBlob += firstMatch.slice(0, -taxMatch[1].length);
    }
  }

  // Remove any non-digits from numBlob
  numBlob = numBlob.replace(/[^\d]/g, '');

  return { numBlob, taxableAmount, gstAmount, totalAmount };
}

// Unstructured / OCR Text Parser
function parseUnstructuredInvoice(text: string): UniversalExtractionResult {
  const headerMeta = extractHeaderMeta(text);
  const items: UniversalItem[] = [];

  // Find where the first item starts, usually after table headers like "Total Value"
  const startMatch = text.match(/(?:^|[^0-9])(1[A-Za-z][A-Za-z0-9\s.*\/|()\-]+?\d{6,8}\s*\d+\.\d{2}.+)/);
  if (startMatch) {
    let remStr = text.substring(startMatch.index || 0).trim();
    if (remStr.startsWith('1')) {
      // It might be preceded by whitespace or newlines, handled by trim()
    } else {
      // Find exactly where '1' starts
      const exactStart = remStr.match(/1[A-Za-z]/);
      if (exactStart) {
        remStr = remStr.substring(exactStart.index || 0);
      }
    }
    
    let currentSrNo = 1;

    while (remStr.length > 0) {
      // Exact sequential parser for concatenated item
      // srNo + Name + HSN + MRP + numBlob(Cases/Qty) + Taxable + GST + Total
      const regex = new RegExp(`^(${currentSrNo})([A-Za-z][A-Za-z0-9\\s.*\\/|()\\-]+?)(\\d{6,8})\\s*(\\d+\\.\\d{2})\\s*(\\d*)([\\d,]+\\.\\d{2})([\\d,]+\\.\\d{2})([\\d,]+\\.\\d{2})`);
      
      const itemMatch = remStr.match(regex);
      if (itemMatch) {
        const srNo = parseInt(itemMatch[1]);
        const productName = itemMatch[2].trim();
        const hsnCode = itemMatch[3];
        const mrp = parseNumber(itemMatch[4]);
        
        const rawNumBlob = itemMatch[5];
        const rawTaxable = itemMatch[6];
        const gstAmount = parseNumber(itemMatch[7]);
        const totalAmount = parseNumber(itemMatch[8]);
        
        // Reconstruct the fused numBlob + taxable string to separate them correctly
        const firstMatch = rawNumBlob + rawTaxable;
        
        const expectedTaxable = Math.round((totalAmount - gstAmount) * 100) / 100;
        let taxableAmount = expectedTaxable;
        let numBlob = "";

        const expectedTaxableStr = expectedTaxable.toFixed(2);
        const expectedTaxableStrWithCommas = expectedTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        if (firstMatch.endsWith(expectedTaxableStrWithCommas)) {
          numBlob = firstMatch.slice(0, -expectedTaxableStrWithCommas.length);
        } else if (firstMatch.endsWith(expectedTaxableStr)) {
          numBlob = firstMatch.slice(0, -expectedTaxableStr.length);
        } else {
          const taxMatch = firstMatch.match(/([\d,]+\.\d{2})$/);
          if (taxMatch) {
            taxableAmount = parseNumber(taxMatch[1]);
            numBlob = firstMatch.slice(0, -taxMatch[1].length);
          }
        }
        
        numBlob = numBlob.replace(/[^\d]/g, '');

        let cases = 0;
        let quantity = 0;

        if (numBlob.length >= 4) {
          if (numBlob.length === 6) {
            cases = parseInt(numBlob.substring(0, 2));
            quantity = parseInt(numBlob.substring(2));
          } else if (numBlob.length === 5) {
            cases = parseInt(numBlob.substring(0, 1));
            quantity = parseInt(numBlob.substring(1));
          } else if (numBlob.length === 4) {
            cases = parseInt(numBlob.substring(0, 1));
            quantity = parseInt(numBlob.substring(1));
          } else if (numBlob.length === 3) {
            cases = parseInt(numBlob.substring(0, 1));
            quantity = parseInt(numBlob.substring(1));
          } else {
            quantity = parseInt(numBlob) || 1;
          }
        } else {
          quantity = parseInt(numBlob) || 1;
        }

        quantity = Math.min(Math.max(1, quantity), 99999);
        const unitPrice = quantity > 0 ? (taxableAmount / quantity) : (totalAmount / (quantity || 1));
        let gstRate = taxableAmount > 0 ? Math.round((gstAmount / taxableAmount) * 100) : 5;
        if (gstRate > 28 || gstRate < 0) gstRate = 5;

        items.push({
          srNo,
          productName,
          hsnCode,
          mrp,
          cases,
          quantity,
          unitPrice: parseFloat(unitPrice.toFixed(4)),
          taxableAmount,
          gstRate,
          gstAmount,
          totalAmount
        });
        
        remStr = remStr.substring(itemMatch[0].length);
        currentSrNo++;
      } else {
        // If it failed to match the exact sequence, break out of this loop.
        break;
      }
    }
  }

  // Fallback to line-by-line parsing if concatRegex found no items
  if (items.length === 0) {
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Pattern A: Standard 15-column distribution line
      const mA = line.match(/^(\d+)\s+([A-Z0-9]{8,24})\s+(.+?)\s+(\d{4,8})\s+([\d,]+\.?\d*)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d.\s()%\-]+)\s+([\d,]+\.?\d*)\s+(\d+(?:\.\d+)?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)$/i);
      if (mA) {
        items.push({
          srNo: parseInt(mA[1]),
          erpId: mA[2],
          productName: mA[3].trim(),
          hsnCode: mA[4],
          mrp: parseNumber(mA[5]),
          cases: parseInt(mA[7]),
          quantity: parseNumber(mA[8]),
          unitPrice: parseNumber(mA[9]),
          taxableAmount: parseNumber(mA[12]),
          gstRate: parseNumber(mA[13]),
          gstAmount: parseNumber(mA[14]),
          totalAmount: parseNumber(mA[15]),
        });
        continue;
      }

      // Pattern B: Simplified distribution item line
      const mB = line.match(/^(\d+)\s+([A-Z0-9]{6,22})\s+(.+?)\s+(\d{4,8})?\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)$/i);
      if (mB && !line.toLowerCase().includes('total') && !line.toLowerCase().includes('invoice') && !line.toLowerCase().includes('tax')) {
        items.push({
          srNo: parseInt(mB[1]),
          erpId: mB[2],
          productName: mB[3].trim(),
          hsnCode: mB[4] || undefined,
          quantity: parseNumber(mB[5]) || 1,
          unitPrice: parseNumber(mB[6]) || 0,
          taxableAmount: (parseNumber(mB[5]) || 1) * (parseNumber(mB[6]) || 0),
          gstRate: 5,
          gstAmount: ((parseNumber(mB[5]) || 1) * (parseNumber(mB[6]) || 0)) * 0.05,
          totalAmount: parseNumber(mB[7]) || ((parseNumber(mB[5]) || 1) * (parseNumber(mB[6]) || 0) * 1.05),
        });
        continue;
      }

      // Pattern C: Generic tabular line
      const mC = line.match(/^([A-Za-z0-9\s.*\/|()-]{3,50})\s+(\d+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/);
      if (mC && !line.toLowerCase().includes('total') && !line.toLowerCase().includes('subtotal') && !line.toLowerCase().includes('page')) {
        const q = parseNumber(mC[2]);
        const rate = parseNumber(mC[3]);
        const tot = parseNumber(mC[4]);
        items.push({
          srNo: items.length + 1,
          productName: mC[1].trim(),
          quantity: q,
          unitPrice: rate,
          taxableAmount: rate * q,
          gstRate: 5,
          gstAmount: (tot - (rate * q)),
          totalAmount: tot,
        });
      }
    }
  }

  const calculatedTaxable = items.reduce((sum, item) => sum + item.taxableAmount, 0);
  const calculatedGst = items.reduce((sum, item) => sum + item.gstAmount, 0);
  const calculatedGrandTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);

  return {
    detectedFormat: 'Unstructured Invoice Text',
    invoiceNumber: headerMeta.invoiceNumber,
    invoiceDate: headerMeta.invoiceDate,
    sellerName: headerMeta.sellerName,
    sellerGSTIN: headerMeta.sellerGSTIN,
    customerName: headerMeta.customerName,
    customerGSTIN: headerMeta.customerGSTIN,
    items,
    subtotal: calculatedTaxable,
    taxableAmount: headerMeta.taxableAmount || calculatedTaxable,
    cgst: headerMeta.cgst || (calculatedGst / 2),
    sgst: headerMeta.sgst || (calculatedGst / 2),
    igst: 0,
    totalGst: headerMeta.totalGst || calculatedGst,
    grandTotal: headerMeta.grandTotal || calculatedGrandTotal,
    confidence: items.length > 0 ? (headerMeta.invoiceNumber ? 98 : 90) : 40,
    rawText: text,
    warnings: items.length === 0 ? ['No line items automatically detected from text. You can edit or upload structured CSV/TSV.'] : []
  };
}

// JSON Object Parser
function parseFromJsonObject(obj: unknown, rawText: string): UniversalExtractionResult {
  const get = (o: unknown, keys: string[]): unknown => {
    if (!o || typeof o !== 'object') return undefined;
    const rec = o as Record<string, unknown>;
    for (const k of keys) {
      if (rec[k] !== undefined && rec[k] !== null) return rec[k];
    }
    return undefined;
  };
  const getString = (o: unknown, keys: string[]): string | undefined => {
    const val = get(o, keys);
    return val == null ? undefined : String(val);
  };

  // Support the real-world nested invoice shape: { invoice: { invoice_number, bill_date },
  //   seller/buyer: { firm_name, gstin }, items: [{ sno, erp_id, item_name, taxable_value,
  //   gst_percent, gst_amount, total_value }], summary: { taxable_value, gst_amount, total_value } }
  const root = (obj && typeof obj === 'object') ? obj as Record<string, unknown> : undefined;
  const inv = (root && typeof root.invoice === 'object') ? root.invoice as Record<string, unknown> : root;
  const seller = (root && typeof root.seller === 'object') ? root.seller as Record<string, unknown> : root;
  const buyer = (root && typeof root.buyer === 'object') ? root.buyer as Record<string, unknown> : root;
  const summary = (root && typeof root.summary === 'object') ? root.summary as Record<string, unknown> : root;

  const items: UniversalItem[] = [];
  const firstArray = (...vals: unknown[]): unknown[] => {
    for (const v of vals) {
      if (Array.isArray(v)) return v as unknown[];
    }
    return [];
  };
  const rawItems = firstArray(obj, root?.items, root?.data, root?.lineItems);

  rawItems.forEach((it: unknown, index: number) => {
    const gstRate = parseNumber(get(it, ['gstRate', 'gst_rate', 'gstPercent', 'gst_percent', 'gst%', 'gst']));
    items.push({
      srNo: parseNumber(get(it, ['srNo', 'sr', 'sno', 'slNo'])) || index + 1,
      erpId: getString(it, ['erpId', 'erp_id', 'sku', 'code', 'itemCode', 'item_code']),
      productName: getString(it, ['productName', 'product_name', 'product', 'name', 'itemName', 'item_name', 'description']) || `Item ${index + 1}`,
      hsnCode: getString(it, ['hsnCode', 'hsn_code', 'hsn']),
      mrp: parseNumber(get(it, ['mrp'])),
      quantity: parseNumber(get(it, ['quantity', 'qty'])) || 1,
      unitPrice: parseNumber(get(it, ['unitPrice', 'unit_price', 'price', 'rate'])) || 0,
      taxableAmount: parseNumber(get(it, ['taxableAmount', 'taxable_amount', 'taxable', 'taxableValue', 'taxable_value'])),
      gstRate: gstRate || 5,
      gstAmount: parseNumber(get(it, ['gstAmount', 'gst_amount', 'gstAmt', 'gst_amt'])),
      totalAmount: parseNumber(get(it, ['totalAmount', 'total_amount', 'totalValue', 'total_value', 'total'])) || 0,
    });
  });

  return {
    detectedFormat: 'JSON',
    invoiceNumber: getString(inv, ['invoiceNumber', 'invoice_number', 'invoiceNo', 'invoice_no', 'billNumber', 'bill_number']),
    invoiceDate: getString(inv, ['invoiceDate', 'invoice_date', 'billDate', 'bill_date', 'date']),
    sellerName: getString(seller, ['sellerName', 'seller_name', 'firmName', 'firm_name', 'name']),
    sellerGSTIN: getString(seller, ['sellerGSTIN', 'seller_gstin', 'gstin']),
    customerName: getString(buyer, ['customerName', 'customer_name', 'buyerName', 'buyer_name', 'firmName', 'firm_name', 'name']),
    customerGSTIN: getString(buyer, ['customerGSTIN', 'customer_gstin', 'gstin']),
    items,
    subtotal: parseNumber(get(summary, ['subtotal', 'sub_total', 'taxableAmount', 'taxable_amount', 'grossAmount', 'gross_amount'])) || parseNumber(get(obj, ['subtotal', 'taxableAmount'])),
    taxableAmount: parseNumber(get(summary, ['taxableAmount', 'taxable_amount', 'taxable', 'grossAmount', 'gross_amount'])) || parseNumber(get(obj, ['taxableAmount', 'taxable_amount'])),
    cgst: parseNumber(get(summary, ['cgst', 'cgstAmount', 'cgst_amount'])),
    sgst: parseNumber(get(summary, ['sgst', 'sgstAmount', 'sgst_amount'])),
    igst: parseNumber(get(summary, ['igst', 'igstAmount', 'igst_amount'])),
    totalGst: parseNumber(get(summary, ['totalGst', 'total_gst', 'gstAmount', 'gst_amount'])) || parseNumber(get(obj, ['totalGst', 'total_gst'])),
    grandTotal: parseNumber(get(summary, ['grandTotal', 'grand_total', 'totalValue', 'total_value', 'totalAmount', 'total_amount', 'total'])) || parseNumber(get(obj, ['grandTotal', 'grand_total', 'totalAmount', 'total_amount', 'total'])),
    confidence: 100,
    rawText,
    warnings: []
  };
}

// Helper: Extract Header Meta fields from text
function extractHeaderMeta(text: string) {
  const invMatch = text.match(/(RS\/\d{2}-\d{2}\/\d+)|(?:Invoice\/Bill Number|Invoice Number|Bill Number|Invoice No|Bill No|Bill\/Invoice No|Inv No)[.:\s]*\*{0,2}\s*([A-Z0-9\-\/]+)/i);
  const dateMatch = text.match(/(?:Bill\/Invoice Date|Invoice Date|Bill Date|Date|Dt)[.:\s]*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}(?:,\s*\d{1,2}:\d{2}\s*(?:am|pm)?)?|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  
  const gstins = Array.from(text.matchAll(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/g)).map(m => m[1]);
  
  const sellerMatch = text.match(/Seller Details[^\r\n]*?Firm Name:\s*([^\r\n\t]+?)(?=\s{2}|\s*Address|\s*State|\s*GSTIN|$)/i) ||
                      text.match(/Seller Firm Name:\s*([^\r\n\t]+?)(?=\s{2}|\s*Address|\s*State|\s*GSTIN|$)/i);

  let customerName: string | undefined;
  const buyerMatch = text.match(/\b(?:Buyer Details|Billed To)\b[^\r\n]*?Firm Name:\s*([^\r\n\t]+?)(?=\s{2}|\s*Address|\s*City|\s*State|\s*GSTIN|$)/i) ||
                      text.match(/\b(?:Billed To|Customer|To|Buyer)\b[:\s]*\*{0,2}\s*([^\r\n\t]+?)(?=\s{2}|\s*Address|\s*City|\s*State|\s*GSTIN|$)/i);
  if (buyerMatch) {
    customerName = buyerMatch[1].trim();
  }
  if (!customerName) {
    const allFirmNames = Array.from(text.matchAll(/(?:Firm Name:?)\s*([^\r\n]+?)(?=\s{2}|\s*Address|\s*City|\s*State|\s*GSTIN|$)/gi)).map(m => m[1].trim());
    customerName = allFirmNames.length > 1 ? allFirmNames[1] : allFirmNames[0];
  }

  // Skip bullet-list detail lines ("* Quantity: 180 | MRP: ₹10.00 | Total Value: ₹1,451.38")
  // when scanning for invoice-level totals so a line item's Total Value is not taken
  // as the invoice grand total.
  const totalsText = text.split(/\r?\n/).filter(l => !/Quantity:.*\|\s*MRP:.*\|\s*Total Value:/i.test(l)).join('\n');

  const grandTotalMatch = totalsText.match(/(?:Grand Total|Total Value|Total Amount)[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  const taxableMatch = totalsText.match(/(?:Taxable Value|Gross Amt)[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  const totalGstMatch = totalsText.match(/(?:Total GST Amount|GST Amt\.?|GST Amount)[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  const cgstMatch = totalsText.match(/CGST Amount[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  const sgstMatch = totalsText.match(/SGST Amount[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);

  return {
    invoiceNumber: invMatch ? (invMatch[1] || invMatch[2]).trim() : undefined,
    invoiceDate: dateMatch ? dateMatch[1].trim() : undefined,
    sellerName: sellerMatch ? sellerMatch[1].trim() : undefined,
    sellerGSTIN: gstins[0],
    customerName: customerName,
    customerGSTIN: gstins.length > 1 ? gstins[1] : undefined,
    taxableAmount: taxableMatch ? parseNumber(taxableMatch[1]) : undefined,
    cgst: cgstMatch ? parseNumber(cgstMatch[1]) : undefined,
    sgst: sgstMatch ? parseNumber(sgstMatch[1]) : undefined,
    totalGst: totalGstMatch ? parseNumber(totalGstMatch[1]) : undefined,
    grandTotal: grandTotalMatch ? parseNumber(grandTotalMatch[1]) : undefined,
  };
}

function parseNumber(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
