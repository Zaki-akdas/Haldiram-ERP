import { IngestFormat, IngestItem, IngestResult } from '../types';

function parseNumber(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function stripMarkdown(val: string): string {
  return val.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^[-_>#\s]+|[-_>#\s]+$/g, '').trim();
}

function extractHeaderMeta(text: string) {
  // Match invoice/bill number formats including RS/YY-YY/NNNN pattern first
  const invMatch = text.match(/RS\/\d{2}-\d{2}\/\d+/i) ||
                   text.match(/(?:Invoice\/Bill Number|Invoice Number|Bill Number|Invoice No|Bill No|Inv No)[.:\s]*\*{0,2}\s*([A-Z0-9\-\/]+)/i) ||
                   text.match(/\*{0,2}\s*Bill Number:\s*\*{0,2}\s*([A-Z0-9\-\/]+)/i);
  
  // Match various date formats including "22 Jul 2026, 10:35 am"
  const dateMatch = text.match(/(?:Bill\/Invoice Date|Invoice Date|Bill Date|Date|Dt)[.:\s]*\*{0,2}\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}(?:,\s*\d{1,2}:\d{2}\s*(?:am|pm)?)?|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i) ||
                    text.match(/\*{0,2}\s*Date:\s*\*{0,2}\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}(?:,\s*\d{1,2}:\d{2}\s*(?:am|pm)?)?|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  
  const gstins = Array.from(text.matchAll(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/g)).map(m => m[1]);
  
  const sellerMatch = text.match(/Seller Details[^\r\n]*?Firm Name:\s*([^\r\n\t]+?)(?=\s{2}|\s*Address|\s*State|\s*GSTIN|$)/i) ||
                      text.match(/Seller Firm Name:\s*([^\r\n\t]+?)(?=\s{2}|\s*Address|\s*State|\s*GSTIN|$)/i) ||
                      text.match(/\*{0,2}\s*Seller:\s*\*{0,2}\s*([^\r\n\t]+?)(?=\s*$)/i) ||
                      text.match(/Seller:\s*\*{0,2}\s*([^\r\n\t]+?)(?=\s*$)/i) ||
                      text.match(/Seller:\s*([^\r\n\t]+?)(?=\s*$)/i);

  let customerName: string | undefined;
  const buyerMatch = text.match(/\b(?:Buyer Details|Billed To)\b[^\r\n]*?Firm Name:\s*([^\r\n\t]+?)(?=\s{2}|\s*Address|\s*City|\s*State|\s*GSTIN|$)/i) ||
                     text.match(/\*{0,2}\s*Buyer:\s*\*{0,2}\s*([^\r\n\t]+?)(?=\s*$)/i) ||
                     text.match(/Buyer:\s*([^\r\n\t]+?)(?=\s{2}|\s*ITEMS|\s*BILLING|\s*$)/i);
  if (buyerMatch) {
    customerName = stripMarkdown(buyerMatch[1].trim());
  }
  if (!customerName) {
    const allFirmNames = Array.from(text.matchAll(/(?:Firm Name:?)\s*([^\r\n]+?)(?=\s{2}|\s*Address|\s*City|\s*State|\s*GSTIN|$)/gi)).map(m => m[1].trim());
    customerName = allFirmNames.length > 1 ? allFirmNames[1] : allFirmNames[0];
  }

  // Skip bullet-list detail lines ("* Quantity: 180 | MRP: ₹10.00 | Total Value: ₹1,451.38")
  // when scanning for invoice-level totals so a line item's Total Value is not taken
  // as the invoice grand total.
  const totalsText = text.split(/\r?\n/).filter(l => !/Quantity:.*\|\s*MRP:.*\|\s*Total Value:/i.test(l)).join('\n');

  const grandTotalMatch = totalsText.match(/(?:Grand Total|Total Value|Total Amount)[.:\s]*\*{0,2}\s*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  const taxableMatch = totalsText.match(/(?:Taxable Value|Gross Amt)[.:\s]*\*{0,2}\s*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  const totalGstMatch = totalsText.match(/(?:Total GST Amount|Total GST:|GST Amt\.?|GST Amount)[.:\s]*\*{0,2}\s*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  const cgstMatch = totalsText.match(/(?:CGST Amount|CGST:)[.:\s]*\*{0,2}\s*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
  const sgstMatch = totalsText.match(/(?:SGST Amount|SGST:)[.:\s]*\*{0,2}\s*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);

  const invoiceNumber = invMatch ? invMatch[0].replace('RS/', '') : invMatch ? undefined : undefined;
  // If the match is just "RS/YY-YY/NNNN", use it directly, otherwise use captured group
  let finalInvoiceNumber: string | undefined;
  if (invMatch) {
    if (invMatch[0].match(/^RS\/\d{2}-\d{2}\/\d+$/i)) {
      finalInvoiceNumber = invMatch[0];
    } else if (invMatch[1]) {
      finalInvoiceNumber = invMatch[1].trim().replace(/\*{2}/g, '');
    }
  }

  return {
    invoiceNumber: finalInvoiceNumber || (invMatch ? (invMatch[0].match(/^RS\/\d{2}-\d{2}\/\d+$/i) ? invMatch[0] : undefined) : undefined),
    invoiceDate: dateMatch ? stripMarkdown(dateMatch[1].trim()) : undefined,
    sellerName: sellerMatch ? stripMarkdown(sellerMatch[1].trim()) : undefined,
    sellerGSTIN: gstins[0],
    customerName: customerName ? stripMarkdown(customerName) : undefined,
    customerGSTIN: gstins.length > 1 ? gstins[1] : undefined,
    taxableAmount: taxableMatch ? parseNumber(taxableMatch[1]) : undefined,
    cgst: cgstMatch ? parseNumber(cgstMatch[1] || cgstMatch[0]) : undefined,
    sgst: sgstMatch ? parseNumber(sgstMatch[1] || sgstMatch[0]) : undefined,
    totalGst: totalGstMatch ? parseNumber(totalGstMatch[1]) : undefined,
    grandTotal: grandTotalMatch ? parseNumber(grandTotalMatch[1]) : undefined,
  };
}

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
    const taxMatch = firstMatch.match(/([\d,]+\.\d{2})$/);
    if (taxMatch) {
      taxableAmount = parseNumber(taxMatch[1]);
      numBlob += firstMatch.slice(0, -taxMatch[1].length);
    }
  }

  numBlob = numBlob.replace(/[^\d]/g, '');

  return { numBlob, taxableAmount, gstAmount, totalAmount };
}

// Parse the markdown-style invoice format where each item is:
// **N. Product Name (may contain *)**
// * Quantity: X | MRP: ₹Y | Total Value: ₹Z
function parseMarkdownItems(text: string): IngestItem[] {
  const items: IngestItem[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Match item header line: **N. Product Name** or * N. Product Name *
    const itemHeader = line.match(/^\*{0,2}\s*(\d+)\.\s+(.+?)\s*\*{0,2}$/i);
    if (!itemHeader) continue;
    
    const srNo = parseInt(itemHeader[1]);
    const productNameRaw = itemHeader[2];
    if (!productNameRaw || productNameRaw.toLowerCase().includes('total') || 
        productNameRaw.toLowerCase().includes('items') || productNameRaw.toLowerCase().includes('bill')) continue;
    
    // Look ahead for the quantity line (usually on the next non-empty line)
    let qtyLine = '';
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j].trim();
      if (!nextLine) continue;
      if (nextLine.match(/^\d+\./) || nextLine.match(/^[-_*]{3,}/)) break; // next item or divider
      if (nextLine.toLowerCase().includes('quantity')) {
        qtyLine = nextLine;
        break;
      }
    }
    
    if (!qtyLine) continue;
    
    // Parse: * Quantity: 180 | MRP: ₹10.00 | Total Value: ₹1,451.38
    const qtyMatch = qtyLine.match(/Quantity:\s*([\d,]+)/i);
    const mrpMatch = qtyLine.match(/MRP:\s*₹?([\d,]+\.?\d*)/i);
    const totalMatch = qtyLine.match(/Total Value:\s*₹?([\d,]+\.?\d*)/i);
    
    if (!qtyMatch || !mrpMatch || !totalMatch) continue;
    
    const quantity = parseNumber(qtyMatch[1]);
    const mrp = parseNumber(mrpMatch[1]);
    const totalAmount = parseNumber(totalMatch[1]);
    
    const taxableAmount = totalAmount / 1.05; // Assuming 5% GST
    const gstAmount = totalAmount - taxableAmount;
    const gstRate = 5;
    const unitPrice = mrp || (quantity > 0 ? taxableAmount / quantity : 0);
    
    items.push({
      srNo,
      productName: stripMarkdown(productNameRaw),
      quantity: Math.max(0, quantity),
      unitPrice: parseFloat(unitPrice.toFixed(4)),
      mrp: mrp || undefined,
      taxableAmount: parseFloat(taxableAmount.toFixed(2)),
      gstRate,
      gstAmount: parseFloat(gstAmount.toFixed(2)),
      totalAmount: parseFloat(totalAmount.toFixed(2)),
    });
  }
  
  return items;
}

export function parseUnstructuredText(text: string): IngestResult {
  const startTime = Date.now();
  const warnings: string[] = [];
  const items: IngestItem[] = [];
  const headerMeta = extractHeaderMeta(text);

  // Normalize line endings and split into lines
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedText.split('\n');

  // Pattern D: Pipe-separated invoice format (single-line items)
  // Example:
  // 1. Product Name  Quantity: 180 | MRP: ₹10.00 | Total Value: ₹1,451.38
  const pipeItemRegex = /(\d+)\.\s+(.+?)\s+Quantity:\s+(\d+)\s+\|\s+MRP:\s+₹?([\d,]+\.?\d*)\s+\|\s+Total Value:\s+₹?([\d,]+\.?\d*)/gi;
  
  const pipeMatches = text.matchAll(pipeItemRegex);
  for (const match of pipeMatches) {
    const srNo = parseInt(match[1]);
    const productName = match[2].trim();
    const quantity = parseNumber(match[3]);
    const mrp = parseNumber(match[4]);
    const totalAmount = parseNumber(match[5]);
    
    const taxableAmount = totalAmount / 1.05; // Assuming 5% GST
    const gstAmount = totalAmount - taxableAmount;
    const gstRate = 5;
    const unitPrice = mrp || (quantity > 0 ? taxableAmount / quantity : 0);

    items.push({
      srNo,
      productName,
      quantity: Math.max(0, quantity),
      unitPrice: parseFloat(unitPrice.toFixed(4)),
      mrp: mrp || undefined,
      taxableAmount: parseFloat(taxableAmount.toFixed(2)),
      gstRate,
      gstAmount: parseFloat(gstAmount.toFixed(2)),
      totalAmount: parseFloat(totalAmount.toFixed(2)),
    });
  }

  // Pattern E: Markdown-style invoice format where each item spans two lines:
  // **N. Product Name**  (product name can contain *)
  // * Quantity: X | MRP: ₹Y | Total Value: ₹Z
  if (items.length === 0) {
    items.push(...parseMarkdownItems(text));
  }

  if (items.length > 0) {
    // Extract totals from BILLING SUMMARY if present
    const taxableTotalMatch = text.match(/Taxable Value:\s*\*{0,2}\s*₹?([\d,]+\.\d{2})/i);
    const gstTotalMatch = text.match(/(?:Total GST|GST Amount|GST:).*?:\s*\*{0,2}\s*₹?([\d,]+\.\d{2})/i);
    const grandTotalMatch = text.match(/Grand Total:\s*\*{0,2}\s*₹?([\d,]+\.\d{2})/i);
    const cgstMatchFinal = text.match(/CGST:\s*\*{0,2}\s*₹?([\d,]+\.\d{2})/i);
    const sgstMatchFinal = text.match(/SGST:\s*\*{0,2}\s*₹?([\d,]+\.\d{2})/i);
    
    if (taxableTotalMatch) headerMeta.taxableAmount = parseNumber(taxableTotalMatch[1]);
    if (gstTotalMatch) headerMeta.totalGst = parseNumber(gstTotalMatch[1]);
    if (grandTotalMatch) headerMeta.grandTotal = parseNumber(grandTotalMatch[1]);
    if (cgstMatchFinal) headerMeta.cgst = parseNumber(cgstMatchFinal[1]);
    if (sgstMatchFinal) headerMeta.sgst = parseNumber(sgstMatchFinal[1]);
  }

  // Fallback to original concatenated regex if pipe format found nothing
  if (items.length === 0) {
    // Find where the first item starts
    const startMatch = text.match(/(?:^|[^0-9])(1[A-Za-z][A-Za-z0-9\s.*\/|()\-]+?\d{6,8}\s*\d+\.\d{2}.+)/);
    if (startMatch) {
      let remStr = text.substring(startMatch.index || 0).trim();
      if (!remStr.startsWith('1')) {
        const exactStart = remStr.match(/1[A-Za-z]/);
        if (exactStart) remStr = remStr.substring(exactStart.index || 0);
      }
      
      let currentSrNo = 1;

      while (remStr.length > 0) {
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
          break;
        }
      }
    }
  }

  // Fallback to line-by-line parsing if concatRegex found no items
  if (items.length === 0) {
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

  // Restore natural bill order: PDF extractors (pdf2json) can emit text bottom-up
  // (y ascending), which would reverse the line items. Numbered items keep their
  // original position via srNo.
  if (items.length > 0 && items.every((item) => typeof item.srNo === 'number')) {
    items.sort((a, b) => (a.srNo ?? 0) - (b.srNo ?? 0));
  }

  const calculatedTaxable = items.reduce((sum, item) => sum + item.taxableAmount, 0);
  const calculatedGst = items.reduce((sum, item) => sum + item.gstAmount, 0);
  const calculatedGrandTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);

  if (items.length === 0) {
    warnings.push('No line items automatically detected from text. You can edit or upload structured CSV/TSV.');
  }

  return {
    format: 'unstructured',
    header: headerMeta,
    items,
    confidence: items.length > 0 ? (headerMeta.invoiceNumber ? 98 : 90) : 40,
    warnings,
    processingTimeMs: Date.now() - startTime,
  };
}