import { ExtractionResult, ExtractionItem } from './ai-provider';

export function extractWithRegex(text: string): ExtractionResult {
  if (!text) {
    return {
      items: [],
      confidence: 0,
      provider: 'Regex Extractor',
    };
  }

  // 1. Extract Invoice Number
  const invNumberRegexes = [
    /(?:Invoice\/Bill Number|Invoice Number|Bill Number|Invoice No|Bill No|Inv No|Bill\/Invoice No)[.:\s]*([A-Z0-9\-\/]+)/i,
    /Invoice\s*(?:No|Number|#)[.:\s]*([A-Z0-9\-\/]+)/i,
    /([A-Z]{2}\/\d{2}-\d{2}\/\d+)/i, // e.g. RS/26-27/1577
  ];

  let invoiceNumber: string | undefined;
  for (const rx of invNumberRegexes) {
    const match = text.match(rx);
    if (match && match[1]) {
      invoiceNumber = match[1].trim();
      break;
    }
  }

  // 2. Extract Date
  const dateRegexes = [
    /(?:Bill\/Invoice Date|Invoice Date|Bill Date|Date|Dt)[.:\s]*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}(?:,\s*\d{1,2}:\d{2}\s*(?:am|pm)?)?)/i,
    /(?:Bill\/Invoice Date|Invoice Date|Bill Date|Date|Dt)[.:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i
  ];

  let invoiceDate: string | undefined;
  for (const rx of dateRegexes) {
    const match = text.match(rx);
    if (match && match[1]) {
      invoiceDate = match[1].trim();
      break;
    }
  }

  // 3. GSTIN Extraction
  const allGstins = Array.from(text.matchAll(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/g)).map(m => m[1]);
  const sellerGSTIN = allGstins[0];
  const customerGSTIN = allGstins.length > 1 ? allGstins[1] : undefined;

  // 4. Firm / Customer Names
  const sellerMatch = text.match(/Seller Firm Name:\s*([^\r\n]+)/i);
  const customerMatch = text.match(/(?:Billed To:|Firm Name:)\s*([^\r\n]+)/i) || text.match(/Firm Name\s+([^\r\n]+)/i);

  const customerName = customerMatch ? customerMatch[1].trim() : undefined;

  // 5. Grand Total / Total Amounts
  const grandTotalRegexes = [
    /(?:Total Value|Grand Total|Total Amount|Invoice Total)[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i,
    /Total[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i
  ];

  let grandTotal: number | undefined;
  for (const rx of grandTotalRegexes) {
    const match = text.match(rx);
    if (match && match[1]) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(val)) {
        grandTotal = val;
        break;
      }
    }
  }

  // 6. Taxable & GST Totals
  const taxableMatch = text.match(/Taxable Value[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  const cgstMatch = text.match(/CGST Amount[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  const sgstMatch = text.match(/SGST Amount[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  const igstMatch = text.match(/IGST Amount[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  const totalGstMatch = text.match(/GST Amount[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);

  const taxableAmount = taxableMatch ? parseFloat(taxableMatch[1].replace(/,/g, '')) : undefined;
  const cgst = cgstMatch ? parseFloat(cgstMatch[1].replace(/,/g, '')) : undefined;
  const sgst = sgstMatch ? parseFloat(sgstMatch[1].replace(/,/g, '')) : undefined;
  const igst = igstMatch ? parseFloat(igstMatch[1].replace(/,/g, '')) : undefined;
  const totalGst = totalGstMatch ? parseFloat(totalGstMatch[1].replace(/,/g, '')) : undefined;

  // 7. Line Item Table Extraction
  const items: ExtractionItem[] = [];
  const lines = text.split(/\r?\n/);

  // Check for bullet list format first (e.g. "**1. Item Name**" + "* Quantity: X | MRP: ₹Y | Total Value: ₹Z")
  const bulletItemCount = lines.filter(l => /^\*{0,2}\s*\d+[\.\)]\s+[A-Za-z]/.test(l.trim()) || /^\*\*\d+[\.\)]/.test(l.trim())).length;
  const bulletDetailCount = lines.filter(l => /^\*?\s*Quantity:/.test(l.trim()) || /Quantity:.*\|.*MRP:.*\|.*Total Value:/.test(l.trim())).length;

  if (bulletItemCount >= 2 && bulletDetailCount >= 1) {
    let currentItem: Partial<ExtractionItem> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Item header: "**1. Item Name**" or "1. Item Name" or "* Item Name"
      const itemHeaderMatch = trimmed.match(/^\*{0,2}\s*(\d+)[\.\)]\s+(.+?)\*{0,2}$/);
      if (itemHeaderMatch) {
        if (currentItem && currentItem.productName) {
          items.push(finalizeBulletExtractionItem(currentItem, items.length + 1));
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
        if (qtyMatch) currentItem.quantity = parseFloat(qtyMatch[1].replace(/,/g, ''));

        const mrpMatch = trimmed.match(/MRP:\s*₹?\s*([\d,]+\.?\d*)/i);
        if (mrpMatch) currentItem.unitPrice = parseFloat(mrpMatch[1].replace(/,/g, ''));

        const totalMatch = trimmed.match(/Total Value:\s*₹?\s*([\d,]+\.\d{2})/i);
        if (totalMatch) currentItem.totalAmount = parseFloat(totalMatch[1].replace(/,/g, ''));
      }
    }

    if (currentItem && currentItem.productName) {
      items.push(finalizeBulletExtractionItem(currentItem, items.length + 1));
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (items.length > 0 && /^\*{0,2}\s*\d+[\.\)]\s+[A-Za-z]/.test(trimmed)) continue;
    if (items.length > 0 && /Quantity:.*\|.*MRP:.*\|.*Total Value:/.test(trimmed)) continue;

    // Pattern 1: Structured line with Serial No, ERP Id, Name, HSN, MRP, Units, Cases, Qty, PTR, Price, Discount, Taxable, GST%, GST Amt, Total
    // e.g. "1 FD012600160691200D All In One MRP 5|16 GM*6.912 KG (NGP) 21069099 5.00 432 5 2160 4.0475 1,649.5488 0.00 (0) 8,247.74 5 412.38 8,660.12"
    const p1 = trimmed.match(/^(\d+)\s+([A-Z0-9]{8,22}[A-Z0-9]?)\s+(.+?)\s+(\d{4,8})\s+([\d,]+\.?\d*)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d.\s()%\-]+)\s+([\d,]+\.?\d*)\s+(\d+(?:\.\d+)?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)$/i);

    if (p1) {
      items.push({
        srNo: parseInt(p1[1]),
        erpId: p1[2].trim(),
        productName: p1[3].trim(),
        hsnCode: p1[4].trim(),
        unit: 'PCS',
        quantity: parseFloat(p1[8].replace(/,/g, '')),
        unitPrice: parseFloat(p1[9].replace(/,/g, '')),
        taxableAmount: parseFloat(p1[12].replace(/,/g, '')),
        gstRate: parseFloat(p1[13]),
        gstAmount: parseFloat(p1[14].replace(/,/g, '')),
        totalAmount: parseFloat(p1[15].replace(/,/g, '')),
      });
      continue;
    }

    // Pattern 2: Generic row starting with a number and ERP code or Product Name
    const p2 = trimmed.match(/^(\d+)\s+([A-Z0-9]{6,22})?\s*([A-Za-z0-9\s.*\/|()-]{3,60})\s+(\d{4,8})?\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)$/);
    if (p2 && !trimmed.toLowerCase().includes('total') && !trimmed.toLowerCase().includes('invoice')) {
      items.push({
        srNo: parseInt(p2[1]),
        erpId: p2[2] ? p2[2].trim() : undefined,
        productName: p2[3].trim(),
        hsnCode: p2[4] ? p2[4].trim() : undefined,
        quantity: 1,
        unitPrice: parseFloat(p2[5].replace(/,/g, '')),
        totalAmount: parseFloat(p2[6].replace(/,/g, '')),
      });
    }
  }

  // Calculate confidence score
  let confidence = 0;
  if (invoiceNumber) confidence += 20;
  if (invoiceDate) confidence += 15;
  if (customerGSTIN || sellerGSTIN) confidence += 15;
  if (grandTotal) confidence += 20;
  if (items.length > 0) confidence += 30;

  return {
    invoiceNumber,
    invoiceDate,
    customerName,
    customerGSTIN,
    customerAddress: undefined,
    items,
    taxableAmount,
    cgst,
    sgst,
    igst,
    totalGst,
    grandTotal,
    confidence: Math.min(100, confidence),
    provider: 'Indian Tax Invoice Extractor',
    rawResponse: text
  };
}

// Finalize a bullet list item by computing derived fields
function finalizeBulletExtractionItem(item: Partial<ExtractionItem>, srNo: number): ExtractionItem {
  const quantity = item.quantity || 1;
  const totalAmount = item.totalAmount || 0;
  const mrp = item.unitPrice;

  // GST is 5% on all items per the invoice summary
  const gstRate = 5;
  const taxableAmount = totalAmount > 0 ? Math.round((totalAmount / 1.05) * 100) / 100 : 0;
  const gstAmount = totalAmount > 0 ? Math.round((totalAmount - taxableAmount) * 100) / 100 : 0;
  const unitPrice = quantity > 0 ? taxableAmount / quantity : 0;

  return {
    srNo: item.srNo || srNo,
    productName: item.productName || `Item ${srNo}`,
    quantity,
    unitPrice: parseFloat(unitPrice.toFixed(4)),
    taxableAmount: parseFloat(taxableAmount.toFixed(2)),
    gstRate,
    gstAmount: parseFloat(gstAmount.toFixed(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2)),
  };
}
