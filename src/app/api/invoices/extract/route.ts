import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/db';

if (typeof DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    constructor() {}
  };
}

export const dynamic = 'force-dynamic';

// ────────────────────── Types ──────────────────────

interface ExtractedSeller {
  name: string; address: string; gstin: string; pan: string;
  fssai: string; phone: string;
}
interface ExtractedBuyer {
  name: string; address: string; phone: string; gstin: string;
}
interface ExtractedInvoiceMeta {
  number: string; date: string; salesman: string; beat: string;
  employeeContact: string;
}
interface ExtractedItem {
  sno: number; erpId: string; description: string; hsn: string;
  quantity: number; freeQty: number; unit: string;
  mrp: number; rate: number; discount: number;
  taxable: number; gstRate: number; cgst: number; sgst: number;
  gst: number; total: number;
}
interface ExtractedTotals {
  totalQty: number; subtotal: number; discount: number;
  taxableAmount: number; cgst: number; sgst: number; igst: number;
  totalGst: number; grandTotal: number; roundOff: number;
  amountInWords: string;
}

interface FullExtraction {
  seller: ExtractedSeller;
  buyer: ExtractedBuyer;
  invoice: ExtractedInvoiceMeta;
  items: ExtractedItem[];
  totals: ExtractedTotals;
  metadata: { fileType: string; extractionConfidence: number; extractedAt: string; rawTextLength: number };
}

// ────────────────────── Helpers ──────────────────────

function num(s: string | undefined): number {
  if (!s) return 0;
  // Remove ₹ symbol, commas, and any leading/trailing whitespace
  const cleaned = s.replace(/[₹\s,]/g, '').trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function clean(s: string | undefined): string {
  if (!s) return '';
  // Remove common artifacts and extra whitespace
  return s.replace(/[₹]/g, '').replace(/\s+/g, ' ').trim();
}

// ────────────────────── Master Extraction Engine ──────────────────────

function extractAll(text: string): FullExtraction {
  const lines = text.split('\n').map(l => l.trim());
  const full = text;

  const seller: ExtractedSeller = { name: '', address: '', gstin: '', pan: '', fssai: '', phone: '' };
  const buyer: ExtractedBuyer = { name: '', address: '', phone: '', gstin: '' };
  const invoice: ExtractedInvoiceMeta = { number: '', date: '', salesman: '', beat: '', employeeContact: '' };
  const items: ExtractedItem[] = [];
  const totals: ExtractedTotals = {
    totalQty: 0, subtotal: 0, discount: 0, taxableAmount: 0,
    cgst: 0, sgst: 0, igst: 0, totalGst: 0, grandTotal: 0,
    roundOff: 0, amountInWords: '',
  };

  // ── 0. Specialized CSV-style Format Detection ──
  // Checks for: Section,Field,"Value"
  let isStructuredCSV = false;
  for (const line of lines) {
    if (
      line.includes(',') &&
      (line.includes('Seller Details') ||
        line.includes('Buyer & Invoice Details') ||
        line.includes('S.No.,Item ERP ID') ||
        line.includes('S_No,Item_ERP_Id'))
    ) {
      isStructuredCSV = true;
      break;
    }
  }

  if (isStructuredCSV) {
    let inItems = false;
    for (const line of lines) {
      if (!line.trim()) continue;

      // Parse CSV line handling quotes
      const parts: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          parts.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current.trim());

      const field = parts[1] || '';
      const value = parts[2] || '';

      // Seller
      if (field === 'Seller Name') seller.name = value;
      if (field === 'Address' && parts[0] === 'Seller Details') seller.address = value;
      if (field === 'GSTIN') seller.gstin = value;
      if (field === 'PAN') seller.pan = value;
      if (field === 'FSSAI No.') seller.fssai = value;
      if (field === 'Phone' && parts[0] === 'Seller Details') seller.phone = value;

      // Buyer & Invoice
      if (field === 'Buyer Name') buyer.name = value;
      if (field === 'Buyer Address') buyer.address = value;
      if (field === 'Buyer Phone') buyer.phone = value;
      if (field === 'Invoice No.') invoice.number = value;
      if (field === 'Invoice Date') invoice.date = value;
      if (field === 'Salesman') invoice.salesman = value;
      if (field === 'Beat Name') invoice.beat = value;
      if (field === 'Emp. Contact') invoice.employeeContact = value;

      // Items Table
      if (
        line.startsWith('S.No.,Item ERP ID') ||
        line.startsWith('S_No,Item_ERP_Id')
      ) {
        inItems = true;
        continue;
      }
      if (inItems && parts[0] === 'Totals') {
        inItems = false;
      }

      const isNumericRow = !isNaN(parseInt(parts[0]));
      if (inItems && parts.length >= 10 && isNumericRow) {
        const taxableValue = num(parts[11]);
        const gstAmt = num(parts[13]);
        const totalValue = num(parts[14]);

        items.push({
          sno: parseInt(parts[0]),
          erpId: parts[1],
          description: parts[2],
          hsn: parts[3],
          mrp: num(parts[4]),
          quantity: num(parts[7]),
          freeQty: 0,
          unit: 'PCS',
          rate: num(parts[8]),
          discount: num(parts[10]),
          taxable: taxableValue,
          gstRate: num(parts[12]),
          gst: gstAmt,
          cgst: gstAmt / 2,
          sgst: gstAmt / 2,
          total: totalValue
        });
      }

      // Totals
      if (parts[0] === 'Totals') {
        if (field === 'Total Quantity') totals.totalQty = num(value);
        if (field.includes('Net Amount')) totals.subtotal = num(value);
        if (field.includes('Taxable Value')) totals.taxableAmount = num(value);
        if (field.includes('GST Amount')) totals.totalGst = num(value);
        if (field.includes('Grand Total')) totals.grandTotal = num(value);
      }
    }

    // Compute totals from items when Totals row is missing
    if (items.length > 0 && totals.grandTotal === 0) {
      totals.totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
      totals.taxableAmount = Math.round(items.reduce((sum, item) => sum + item.taxable, 0) * 100) / 100;
      totals.totalGst = Math.round(items.reduce((sum, item) => sum + item.gst, 0) * 100) / 100;
      totals.grandTotal = Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
    }

    // Return early if we processed structured data
    if (seller.name || items.length > 0) {
      return {
        seller,
        buyer,
        invoice,
        items,
        totals,
        metadata: {
          fileType: 'structured-csv',
          extractionConfidence: 100,
          extractedAt: new Date().toISOString(),
          rawTextLength: text.length,
        },
      };
    }
  }

  // ── 1. Regular Regex Fallback (Original Logic) ──
  const gstins = [...full.matchAll(/\b(\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9])\b/g)].map(m => m[1]);
  if (gstins[0]) seller.gstin = gstins[0];

  // ── 2. PAN ──
  const panM = full.match(/(?:PAN|Pan)[:\s]*([A-Z]{5}\d{4}[A-Z])/);
  if (panM) seller.pan = panM[1];
  else if (seller.gstin.length === 15) seller.pan = seller.gstin.substring(2, 12);

  // ── 3. FSSAI ──
  const fssaiM = full.match(/(?:FSSAI|fssai)[:\s]*(\d{14})/);
  if (fssaiM) seller.fssai = fssaiM[1];

  // ── 4. Phone numbers ──
  const phones = [...full.matchAll(/\b([6-9]\d{9})\b/g)].map(m => m[1]);
  const uniquePhones = [...new Set(phones)];
  if (uniquePhones[0]) seller.phone = uniquePhones[0];
  if (uniquePhones[1]) buyer.phone = uniquePhones[1];
  if (uniquePhones.length >= 3) invoice.employeeContact = uniquePhones[2];

  // ── 5. Invoice number ──
  // Line-based extraction for invoice number (handles **Invoice No.:** 993)
  for (let i = 0; i < lines.length; i++) {
    if (/invoice\s*(?:no\.?|number)/i.test(lines[i])) {
      let val = lines[i].replace(/.*invoice\s*(?:no\.?|number)/i, '').trim();
      val = val.replace(/^[:\s.*]+/, '').replace(/[\s.*]+$/, '').trim();
      if (val && val.length > 0 && !/date|bill\s*to|gstin|state|customer/i.test(val)) {
        invoice.number = val;
        break;
      }
      if (i + 1 < lines.length) {
        let next = lines[i + 1].trim();
        next = next.replace(/^[:\s.*]+/, '').replace(/[\s.*]+$/, '').trim();
        if (next && !/date|bill\s*to|gstin|state|customer/i.test(next)) {
          invoice.number = next;
          break;
        }
      }
    }
  }

  // Try specific patterns first
  if (!invoice.number) {
    const invPatterns = [
      /(?:Invoice|Bill|Inv)[\s.:]*?(?:No\.?|Number)?[\s.:\-]*?([A-Z]{2,6}\/\d{2,4}[\w\-\/]*)/i,
      /\b([A-Z]{2,6}\/\d{2,4}[\w\-\/]*)\b/,
      /(?:Invoice|Bill|Inv)[\s.:]*?([A-Z0-9][\w\-\/]*)/i,
    ];
    for (const p of invPatterns) {
      const m = full.match(p);
      if (m) { invoice.number = m[1].trim(); break; }
    }
  }

  // ── 6. Date ──
  const datePatterns = [
    /(?:Date|Dated?|Dt)[:\s]*(\d{1,2}[\s\/\-][A-Za-z]{3,9}[\s\/\-]\d{2,4}(?:\s+\d{1,2}:\d{2}\s*(?:am|pm)?)?)/i,
    /(?:Date|Dated?|Dt)[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    /\b(\d{1,2}\s+[A-Z][a-z]{2,8}\s+20\d{2})\b/,
  ];
  for (const p of datePatterns) {
    const m = full.match(p);
    if (m) { invoice.date = clean(m[1]); break; }
  }

  // ── 7. Salesman / Beat ──
  const smM = full.match(/(?:Salesman|Salesperson|Sales\s*Man|S\.?\s*Man)[:\s]*([A-Za-z\s.]+?)(?:\n|Beat|Emp|Phone|$)/i);
  if (smM) invoice.salesman = clean(smM[1]);

  const beatM = full.match(/Beat[:\s]*(.+?)(?:\n|Emp|Phone|$)/i);
  if (beatM) invoice.beat = clean(beatM[1]);

  // ── 8. Seller name — look for company name patterns ──
  const companyPatterns = [
    /([\w\s]{3,}(?:ENTERPRISES|TRADERS|DISTRIBUTORS|INDUSTRIES|PVT|LTD|COMPANY|STORE|MART|AGENCY|CORPORATION)[\w\s.]*)/i,
    /^([A-Z][A-Z\s&.]{10,80})$/m,
    /\*\*Company Name:\*\*\s*([A-Za-z][A-Za-z\s.&]{2,40})/i,
    /Company Name[:\s]*([A-Za-z][A-Za-z\s.&]{2,40})/i,
  ];
  for (const p of companyPatterns) {
    const m = full.match(p);
    if (m) {
      let name = clean(m[1]);
      // Strip common prefixes and trailing address fragments
      name = name.replace(/^(?:TAX\s*INVOICE|INVOICE|BILL|ORIGINAL|DUPLICATE|COPY)\s*/i, '').trim();
      name = name.replace(/\s+\d[\d\-A-Za-z\s,]*$/, '').trim(); // strip trailing address like "17-B..."
      if (name.length > 3) { seller.name = name; break; }
    }
  }

  // ── 9. Seller address ──
  // Look for address-like content near GSTIN or after seller name
  const addrM = full.match(/(\d[\w\s,.\-\/]+(?:Road|Street|Colony|Area|Nagar|Sector|Market|Industrial|Bhopal|Delhi|Mumbai|Chennai|Kolkata|Hyderabad)[\w\s,.\-\/]*\d{6})/i);
  if (addrM) seller.address = clean(addrM[1]);

  // ── 10. Buyer name ──
  const buyerPatterns = [
    /(?:Bill\s*To|Ship\s*To|Sold\s*To|Customer\s*Name|Buyer)[:\s\n]+([A-Za-z][\w\s.&]{2,60})/i,
    /(?:M\/s|M\/S|Messrs)[.\s]*([A-Za-z][\w\s.&]{2,60})/i,
  ];
  for (const p of buyerPatterns) {
    const m = full.match(p);
    if (m && m[1].trim().length > 2) {
      let bname = clean(m[1]).replace(/\n.*/, '');
      bname = bname.replace(/^(?:\w+\s+)*(?:Name|Customer|Buyer|Party)\s*:?\s*/i, '').trim();
      bname = bname.replace(/\s*(?:Phone|Mobile|Contact|Address|City|State|Pin|Colony|Nagar|Road)[\s:]*.*$/i, '').trim();
      if (bname.length > 2) { buyer.name = bname; break; }
    }
  }

  // Also try finding buyer near "Bill To" / "Customer Name" label in lines
  if (!buyer.name) {
    for (let i = 0; i < lines.length; i++) {
      if (/bill\s*to|ship\s*to|sold\s*to|customer\s*name/i.test(lines[i])) {
        const rawLine = lines[i].replace(/.*(?:bill\s*to|ship\s*to|sold\s*to|customer\s*name)\s*:?\s*/i, '').trim();
        const sameLine = rawLine.replace(/^\*+\s*/, '').trim();
        if (sameLine && sameLine.length > 2 && !/phone|mobile|gstin|contact/i.test(sameLine)) {
          buyer.name = clean(sameLine);
          break;
        }
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          let ln = lines[j].trim();
          ln = ln.replace(/^\*+\s*/, '').trim();
          ln = ln.replace(/^(?:\w+\s+)*(?:Name|Customer|Buyer|Party)\s*:?\s*/i, '').trim();
          if (ln && !/phone|mobile|gstin|gst|address|city|state|pin|invoice|date|contact/i.test(ln) && ln.length > 2) {
            buyer.name = clean(ln);
            break;
          }
        }
        break;
      }
    }
  }
  // Clean buyer name: strip trailing address/phone/location fragments
  if (buyer.name) {
    buyer.name = buyer.name
      .replace(/\s*(?:Phone|Mobile|Contact|Ph|Tel|Mob).*$/i, '')
      .replace(/\s*(?:Colony|Nagar|Road|Street|Market|Area|Sector|Block|Lane|Marg|Chowk|Bazar|Bazaar|Ward).*$/i, '')
      .replace(/\s*\d{6,}.*$/, '')
      .trim();
  }

  // ── 11. Buyer address ──
  if (buyer.name) {
    const idx = lines.findIndex(l => l.includes(buyer.name));
    if (idx >= 0) {
      const addrParts: string[] = [];
      for (let j = idx + 1; j < Math.min(idx + 5, lines.length); j++) {
        const ln = lines[j].trim();
        if (!ln || /phone|mobile|gstin|salesman|beat|invoice/i.test(ln)) break;
        if (/^\d/.test(ln) || /colony|nagar|road|street|market|area/i.test(ln)) {
          addrParts.push(ln);
        }
      }
      if (addrParts.length) buyer.address = addrParts.join(', ');
    }
  }

  // ── 12. Line Items ──
  // Strategy: Find lines that start with a serial number + ERP ID pattern, then split remaining into numeric columns
  const erpRegex = /\b([A-Z]{1,2}\d{12,20}[A-Z]?)\b/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Match: serial number + ERP ID + description + remaining columns
    const leadMatch = line.match(/^(\d{1,3})\s+([A-Z]{1,2}\d{12,20}[A-Z]?)\s+(.+)/);
    if (leadMatch) {
      const sno = parseInt(leadMatch[1], 10);
      const erpId = leadMatch[2];
      const rest = leadMatch[3];

      // Strategy: Find description (alphabetic text), then collect all numbers.
      // Description ends where the first HSN code or purely numeric token begins.
      // Split into tokens by whitespace
      const tokens = rest.split(/\s+/);
      let description = '';
      const numericTokens: string[] = [];
      let foundFirstNum = false;

      for (const tok of tokens) {
        if (!foundFirstNum && /^[A-Za-z]/.test(tok)) {
          description += (description ? ' ' : '') + tok;
        } else {
          foundFirstNum = true;
          if (/^-?[\d,]+\.?\d*$/.test(tok)) {
            numericTokens.push(tok);
          }
        }
      }

      const n = numericTokens.map(t => num(t));

      // Expected column order: HSN, Qty, Free, MRP, Rate, Disc%, Taxable, CGST, SGST, Total
      // (10 columns). Last value = Total, then SGST, CGST, Taxable from the end.
      // First value is HSN if it's a 4-digit code.

      let hsn = '';
      let startIdx = 0;

      // Detect HSN code (first number, 3-8 digits, typical HSN range)
      if (n.length >= 7) {
        const firstStr = numericTokens[0];
        if (/^\d{3,8}$/.test(firstStr) && n[0] < 100000) {
          hsn = firstStr.padStart(4, '0');
          startIdx = 1;
        }
      }

      // From the end: Total, SGST, CGST, Taxable
      const totalVal = n.length > 0 ? n[n.length - 1] : 0;
      const sgstVal = n.length > 1 ? n[n.length - 2] : 0;
      const cgstVal = n.length > 2 ? n[n.length - 3] : 0;
      const taxableVal = n.length > 3 ? n[n.length - 4] : 0;

      // Front values (after HSN): Qty, Free, MRP, Rate, Disc%
      const front = n.slice(startIdx, Math.max(startIdx, n.length - 4));
      const qtyVal = front[0] || 0;
      const freeVal = front.length > 1 ? front[1] : 0;
      const mrpVal = front.length > 2 ? front[2] : 0;
      let rateVal = front.length > 3 ? front[3] : 0;
      const discVal = front.length > 4 ? front[4] : 0;

      if (!rateVal && mrpVal > 0) rateVal = mrpVal;

      items.push({
        sno, erpId, description: clean(description), hsn,
        quantity: qtyVal,
        freeQty: freeVal,
        unit: 'PCS',
        mrp: mrpVal,
        rate: rateVal || mrpVal,
        discount: discVal,
        taxable: taxableVal,
        gstRate: 0,
        cgst: cgstVal,
        sgst: sgstVal,
        gst: cgstVal + sgstVal,
        total: totalVal,
      });
      continue;
    }

    // Also try matching lines starting with serial number but without ERP ID
    const simpleMatch = line.match(/^(\d{1,3})\s+([A-Za-z].{3,})/);
    if (simpleMatch && !erpRegex.test(line)) {
      const sno = parseInt(simpleMatch[1], 10);
      if (sno > 0 && sno < 500) {
        const rest = simpleMatch[2];
        const numMatches = [...rest.matchAll(/(?<=\s)([\d,]+\.?\d*)(?=\s|$)/g)].map(m => ({
          value: num(m[1]),
          index: m.index
        }));
        
        if (numMatches.length >= 2) {
          let description = '';
          let qty = 0, rate = 0, taxable = 0, gstAmt = 0, total = 0;
          
          if (numMatches.length >= 3) {
            const totalVal = numMatches[numMatches.length - 1].value;
            total = totalVal;
            
            // Find qty: from the end, skip total and decimals (GST/rate), first integer is qty
            let qtyIdx = -1;
            for (let i = numMatches.length - 2; i >= 0; i--) {
              if (!Number.isInteger(numMatches[i].value)) continue;
              qtyIdx = i;
              break;
            }
            
            if (qtyIdx >= 0) {
              description = clean(rest.substring(0, numMatches[qtyIdx].index));
              qty = numMatches[qtyIdx].value;
              rate = numMatches.length > qtyIdx + 1 ? numMatches[qtyIdx + 1].value : 0;
              
              // Find GST: first decimal between qty and total
              for (let i = numMatches.length - 2; i > qtyIdx; i--) {
                if (!Number.isInteger(numMatches[i].value)) {
                  gstAmt = numMatches[i].value;
                  break;
                }
              }
            } else {
              const n = numMatches.map(m => m.value);
              const firstNumPos = rest.search(/\s\d/);
              description = firstNumPos > 0 ? clean(rest.substring(0, firstNumPos)) : '';
              qty = n[0] || 0;
              rate = n.length > 1 ? n[1] : 0;
              total = n[n.length - 1] || 0;
            }
          } else {
            const firstNumPos = rest.search(/\s\d/);
            description = firstNumPos > 0 ? clean(rest.substring(0, firstNumPos)) : '';
            const n = numMatches.map(m => m.value);
            qty = n[0] || 0;
            rate = n.length > 1 ? n[1] : 0;
            total = n[n.length - 1] || 0;
          }
          
          items.push({
            sno, erpId: '', description,
            hsn: '', quantity: qty, freeQty: 0, unit: 'PCS',
            mrp: 0, rate, discount: 0,
            taxable: rate * qty,
            gstRate: 0,
            cgst: gstAmt / 2,
            sgst: gstAmt / 2,
            gst: gstAmt,
            total: total || (rate * qty + gstAmt),
          });
        }
      }
    }
  }

  // ── 12b. Pipe-delimited text table parser (for formatted invoices like "ITEM DETAILS") ──
  if (items.length === 0) {
    const pipeTableExtraction = parsePipeTable(full, lines);
    if (pipeTableExtraction.items.length > 0) {
      items.push(...pipeTableExtraction.items);
      Object.assign(totals, pipeTableExtraction.totals);
    }
  }

  // If no items found via line parsing, collect ERP IDs
  if (items.length === 0) {
    const allErps = [...full.matchAll(/\b([A-Z]{1,2}\d{12,20}[A-Z]?)\b/g)].map(m => m[1]);
    const uniqueErps = [...new Set(allErps)];
    let sno = 1;
    for (const erpId of uniqueErps) {
      items.push({
        sno: sno++, erpId, description: '', hsn: '',
        quantity: 0, freeQty: 0, unit: 'PCS',
        mrp: 0, rate: 0, discount: 0, taxable: 0,
        gstRate: 0, cgst: 0, sgst: 0, gst: 0, total: 0,
      });
    }
  }

  // Fix item GST calculations
  for (const item of items) {
    if (!item.gst) item.gst = item.cgst + item.sgst;
    if (item.taxable > 0 && item.gst > 0) {
      item.gstRate = Math.round((item.gst / item.taxable) * 100 * 10) / 10;
    }
  }

  // ── 13. Totals ──
  // Multiple patterns for each total field
  const totalPatterns: { field: keyof ExtractedTotals; patterns: RegExp[] }[] = [
    { field: 'totalQty', patterns: [
      /Total\s*(?:Qty|Quantity)[:\s]*([\d,]+)/i,
      /Qty[:\s]*([\d,]+)\s*$/im,
    ]},
    { field: 'subtotal', patterns: [
      /Sub\s*Total[:\s]*₹?\s*([\d,]+\.?\d*)/i,
      /Gross\s*(?:Amount|Total|Value)[:\s]*₹?\s*([\d,]+\.?\d*)/i,
    ]},
    { field: 'discount', patterns: [
      /(?:Total\s*)?Disc(?:ount)?[:\s]*₹?\s*([\d,]+\.?\d*)/i,
    ]},
    { field: 'taxableAmount', patterns: [
      /Taxable\s*(?:Amount|Value|Amt)[:\s]*₹?\s*([\d,]+\.?\d*)/i,
      /Net\s*(?:Taxable|Amount)[:\s]*₹?\s*([\d,]+\.?\d*)/i,
    ]},
    { field: 'cgst', patterns: [
      /CGST[:\s]*₹?\s*([\d,]+\.?\d*)/i,
      /Central\s*GST[:\s]*₹?\s*([\d,]+\.?\d*)/i,
    ]},
    { field: 'sgst', patterns: [
      /SGST[:\s]*₹?\s*([\d,]+\.?\d*)/i,
      /State\s*GST[:\s]*₹?\s*([\d,]+\.?\d*)/i,
    ]},
    { field: 'igst', patterns: [
      /IGST[:\s]*₹?\s*([\d,]+\.?\d*)/i,
    ]},
    { field: 'totalGst', patterns: [
      /TOTAL\s*GST\s*AMOUNT\s*\(5%\)[:\s]*₹?\s*([\d,]+\.?\d+)/i,
      /Total\s*GST\s*Amount[:\s]*₹?\s*([\d,]+\.?\d+)/i,
      /GST\s*Total[:\s]*₹?\s*([\d,]+\.?\d+)/i,
      /Total\s*Tax[:\s]*₹?\s*([\d,]+\.?\d+)/i,
    ]},
    { field: 'taxableAmount', patterns: [
      /GROSS\s*TAXABLE\s*VALUE[:\s]*₹?\s*([\d,]+\.?\d+)/i,
      /Taxable\s*Value[:\s]*₹?\s*([\d,]+\.?\d+)/i,
      /Net\s*Taxable[:\s]*₹?\s*([\d,]+\.?\d+)/i,
    ]},
    { field: 'grandTotal', patterns: [
      /NET\s*PAYABLE\s*AMOUNT[:\s]*₹?\s*([\d,]+\.?\d+)/i,
      /Total\s*Payable\s*Value[:\s]*₹?\s*([\d,]+\.?\d+)/i,
      /Grand\s*Total[:\s]*₹?\s*([\d,]+\.?\d+)/i,
    ]},
    { field: 'subtotal', patterns: [
      /Gross\s*Amount[:\s]*₹?\s*([\d,]+\.?\d+)/i,
      /Sub\s*Total[:\s]*₹?\s*([\d,]+\.?\d+)/i,
    ]},
    { field: 'discount', patterns: [
      /Trade\s*\/\s*Primary\s*Disc\.?[:\s]*₹?\s*([\d,]+\.?\d+)/i,
      /Total\s*Discount[:\s]*₹?\s*([\d,]+\.?\d+)/i,
    ]},
    { field: 'cgst', patterns: [/CGST\s*Amount\s*\(2\.5%\)[:\s]*₹?\s*([\d,]+\.?\d+)/i, /CGST[:\s]*₹?\s*([\d,]+\.?\d+)/i]},
    { field: 'sgst', patterns: [/SGST\s*Amount\s*\(2\.5%\)[:\s]*₹?\s*([\d,]+\.?\d+)/i, /SGST[:\s]*₹?\s*([\d,]+\.?\d+)/i]},
    { field: 'totalQty', patterns: [/TOTAL\s*DELIVERY\s*QUANTITY[:\s]*([\d,]+)/i]},
    { field: 'roundOff', patterns: [
      /Round\s*Off[:\s]*₹?\s*(-?[\d,]+\.?\d*)/i,
    ]},
    { field: 'grandTotal', patterns: [
      /Grand\s*Total[:\s]*₹?\s*([\d,]+\.?\d*)/i,
      /Net\s*(?:Payable|Amount)[:\s]*₹?\s*([\d,]+\.?\d*)/i,
      /(?:Bill|Invoice)\s*(?:Total|Amount)[:\s]*₹?\s*([\d,]+\.?\d*)/i,
      /Total\s*(?:Amount)?[:\s]*₹?\s*([\d,]+\.?\d*)/i,
    ]},
  ];

  for (const { field, patterns } of totalPatterns) {
    for (const p of patterns) {
      const m = full.match(p);
      if (m) {
        (totals as unknown as Record<string, number | string>)[field] = num(m[1]);
        break;
      }
    }
  }

  // Amount in words
  const wordsM = full.match(/(?:Amount\s*in\s*Words|In\s*Words|Rupees)[:\s]*([\w\s,]+(?:Rupees?|Only)[\w\s,]*Only)/i)
    || full.match(/([\w\s]+Rupees?[\w\s]+Only)/i);
  if (wordsM) totals.amountInWords = clean(wordsM[1]);

  // Derive missing totals
  if (!totals.totalGst && (totals.cgst || totals.sgst)) {
    totals.totalGst = totals.cgst + totals.sgst + totals.igst;
  }
  if (!totals.grandTotal && totals.taxableAmount && totals.totalGst) {
    totals.grandTotal = totals.taxableAmount + totals.totalGst + totals.roundOff;
  }
  if (!totals.taxableAmount && totals.grandTotal && totals.totalGst) {
    totals.taxableAmount = totals.grandTotal - totals.totalGst - totals.roundOff;
  }
  if (items.length && !totals.totalQty) {
    totals.totalQty = items.reduce((s, i) => s + i.quantity, 0);
  }

  // ── Confidence ──
  let confidence = 0;
  if (seller.gstin) confidence += 12;
  if (seller.pan) confidence += 5;
  if (seller.name) confidence += 8;
  if (seller.phone) confidence += 3;
  if (seller.fssai) confidence += 2;
  if (buyer.name) confidence += 10;
  if (buyer.phone) confidence += 3;
  if (invoice.number) confidence += 12;
  if (invoice.date) confidence += 8;
  if (invoice.salesman) confidence += 5;
  if (invoice.beat) confidence += 2;
  if (items.length > 0) confidence += 10;
  if (items.length > 3) confidence += 5;
  if (totals.grandTotal > 0) confidence += 10;
  if (totals.taxableAmount > 0) confidence += 5;

  return {
    seller, buyer, invoice, items, totals,
    metadata: {
      fileType: 'text',
      extractionConfidence: Math.min(confidence, 100),
      extractedAt: new Date().toISOString(),
      rawTextLength: text.length,
    },
  };
}

// ────────────────────── Validation ──────────────────────

interface ValidationResult {
  passed: string[];
  warnings: string[];
  errors: string[];
  score: number;
}

function validateGSTINChecksum(gstin: string): boolean {
  if (!gstin || gstin.length !== 15) return false;
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(gstin)) return false;
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const idx = chars.indexOf(gstin[i]);
    if (idx < 0) return false;
    const factor = (i % 2 === 0) ? 1 : 2;
    const product = idx * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const check = chars[(36 - (sum % 36)) % 36];
  return gstin[14] === check;
}

function validateExtraction(data: FullExtraction): ValidationResult {
  const passed: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // Seller
  if (data.seller.gstin) {
    if (validateGSTINChecksum(data.seller.gstin)) {
      passed.push(`Seller GSTIN valid: ${data.seller.gstin}`);
    } else {
      errors.push(`Seller GSTIN checksum failed: ${data.seller.gstin}`);
    }
  } else { warnings.push('Seller GSTIN not found'); }

  if (data.seller.pan && /^[A-Z]{5}\d{4}[A-Z]$/.test(data.seller.pan)) {
    passed.push(`Seller PAN valid: ${data.seller.pan}`);
  } else if (!data.seller.pan) { warnings.push('Seller PAN not found'); }

  if (data.seller.name) passed.push(`Seller: ${data.seller.name}`);
  else warnings.push('Seller name not found');

  if (data.seller.phone) passed.push('Seller phone found');

  // Buyer
  if (data.buyer.name) passed.push(`Buyer: ${data.buyer.name}`);
  else errors.push('Buyer name not found');

  if (data.buyer.phone && /^[6-9]\d{9}$/.test(data.buyer.phone)) {
    passed.push('Buyer phone valid');
  }

  // Invoice
  if (data.invoice.number) passed.push(`Invoice #: ${data.invoice.number}`);
  else errors.push('Invoice number not found');

  if (data.invoice.date) passed.push(`Date: ${data.invoice.date}`);
  else warnings.push('Invoice date not found');

  if (data.invoice.salesman) passed.push(`Salesman: ${data.invoice.salesman}`);

  // Items
  if (data.items.length > 0) {
    passed.push(`${data.items.length} line items found`);
    const withErp = data.items.filter(i => i.erpId).length;
    if (withErp > 0) passed.push(`${withErp} ERP IDs detected`);
  } else { warnings.push('No line items extracted'); }

  // Totals
  if (data.totals.grandTotal > 0) {
    passed.push(`Grand Total: ₹${data.totals.grandTotal.toFixed(2)}`);
  } else { warnings.push('Grand total not found'); }

  if (data.totals.taxableAmount > 0 && data.totals.totalGst > 0) {
    const calc = data.totals.taxableAmount + data.totals.totalGst + data.totals.roundOff;
    const diff = Math.abs(calc - data.totals.grandTotal);
    if (diff <= 1) {
      passed.push('Total calculation verified ✓');
    } else {
      warnings.push(`Total mismatch: Taxable(${data.totals.taxableAmount}) + GST(${data.totals.totalGst}) = ${calc.toFixed(2)}, Grand Total = ${data.totals.grandTotal}`);
    }
  }

  if (data.totals.cgst > 0 && data.totals.sgst > 0) {
    if (Math.abs(data.totals.cgst - data.totals.sgst) <= 0.02) {
      passed.push('CGST = SGST (intra-state) ✓');
    }
  }

  const total = passed.length + warnings.length + errors.length;
  const score = total > 0 ? Math.round((passed.length / total) * 100) : 0;

  return { passed, warnings, errors, score };
}

// ────────────────────── PDF Parser ──────────────────────

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const path = await import('node:path');
    const execFileAsync = promisify(execFile);
    const tmp = path.join(process.cwd(), 'tmp', `pdf-${Date.now()}.pdf`);
    require('fs').mkdirSync(path.dirname(tmp), { recursive: true });
    require('fs').writeFileSync(tmp, buffer);
    const { stdout } = await execFileAsync('node', [path.join(process.cwd(), 'scripts', 'pdf-extract.mjs'), tmp], {
      env: { ...process.env, FORCE_COLOR: '0' },
      timeout: 30000,
    });
    return stdout || '';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('PDF extraction error:', message);
    throw new Error(`Text extraction failed for .pdf: ${message}`);
  }
}

// ────────────────────── Spreadsheet Parser (CSV / Excel) ──────────────────────

function findCol(headers: string[], ...names: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    for (const n of names) {
      if (headers[i] === n) return i;
      if (headers[i].endsWith('_' + n)) return i;
      if (headers[i].includes('_' + n + '_')) return i;
    }
  }
  const sorted = [...names].sort((a, b) => b.length - a.length);
  for (const n of sorted) {
    const idx = headers.findIndex(h => h.includes(n));
    if (idx >= 0) return idx;
  }
  return -1;
}

function findColExact(headers: string[], ...names: string[]): number {
  return headers.findIndex(h => names.includes(h));
}

function findColUnderscore(headers: string[], partial: string): number {
  const idx = headers.findIndex(h => {
    const parts = h.split('_');
    return parts.includes(partial);
  });
  return idx;
}

function parseRows(headers: string[], rows: string[][]): FullExtraction {
  const extraction = extractAll('');

  let colName = findColExact(headers, 'item_name', 'product_name', 'description', 'name');
  if (colName < 0) colName = findColUnderscore(headers, 'name');
  if (colName < 0) colName = findCol(headers, 'name', 'product', 'description', 'item', 'particular');

  let colErp = findColExact(headers, 'item_erp_id', 'erp_id', 'sku', 'product_id');
  if (colErp < 0) colErp = findColUnderscore(headers, 'erp');
  if (colErp < 0) colErp = findCol(headers, 'erp', 'sku', 'code', 'product id', 'product_id');

  let colQty = findColExact(headers, 'invoice_delivery_qty', 'qty', 'quantity');
  if (colQty < 0) colQty = findColUnderscore(headers, 'qty');
  if (colQty < 0) colQty = findCol(headers, 'qty', 'quantity');

  let colRate = findColExact(headers, 'price_std_inr', 'ptr', 'rate', 'price', 'unit_price');
  if (colRate < 0) colRate = findColUnderscore(headers, 'rate');
  if (colRate < 0) colRate = findCol(headers, 'rate', 'price', 'unit price', 'unit_price');

  let colTotal = findColExact(headers, 'total_value_inr', 'total_amount', 'grand_total', 'total');
  if (colTotal < 0) colTotal = findColUnderscore(headers, 'total');
  if (colTotal < 0) colTotal = findCol(headers, 'total', 'value', 'net amount', 'net_amount', 'line total', 'amount');

  let colTaxable = findColExact(headers, 'taxable_value_inr', 'taxable_amount', 'taxable');
  if (colTaxable < 0) colTaxable = findColUnderscore(headers, 'taxable');
  if (colTaxable < 0) colTaxable = findCol(headers, 'taxable', 'net taxable', 'assessable');

  let colGstRate = findColExact(headers, 'gst_pct', 'gst_rate', 'gst%');
  if (colGstRate < 0) colGstRate = findColUnderscore(headers, 'gst');
  if (colGstRate < 0) colGstRate = findCol(headers, 'gst%', 'gst rate', 'gst');

  let colGstAmt = findColExact(headers, 'gst_amt_inr', 'gst_amount', 'gst amt');
  if (colGstAmt < 0) colGstAmt = findColUnderscore(headers, 'gst');
  if (colGstAmt < 0) colGstAmt = findCol(headers, 'gst amt', 'gst amount');

  let colHsn = findColExact(headers, 'hsn_code', 'hsn', 'sac');
  if (colHsn < 0) colHsn = findColUnderscore(headers, 'hsn');
  if (colHsn < 0) colHsn = findCol(headers, 'hsn', 'hsn code', 'sac');

  let colDisc = findColExact(headers, 'primary_dis_pct', 'discount', 'disc', 'dis_pct', 'dis_pct');
  if (colDisc < 0) colDisc = findColUnderscore(headers, 'disc');
  if (colDisc < 0) colDisc = findCol(headers, 'disc', 'discount');

  let colMrp = findColExact(headers, 'mrp_inr', 'mrp', 'list price');
  if (colMrp < 0) colMrp = findColUnderscore(headers, 'mrp');
  if (colMrp < 0) colMrp = findCol(headers, 'mrp', 'list price');

  let colCgst = findColExact(headers, 'cgst');
  if (colCgst < 0) colCgst = findColUnderscore(headers, 'cgst');
  if (colCgst < 0) colCgst = findCol(headers, 'cgst');

  let colSgst = findColExact(headers, 'sgst');
  if (colSgst < 0) colSgst = findColUnderscore(headers, 'sgst');
  if (colSgst < 0) colSgst = findCol(headers, 'sgst');

  let colGstin = findColExact(headers, 'gstin', 'gst no', 'gst number');
  if (colGstin < 0) colGstin = findColUnderscore(headers, 'gstin');
  if (colGstin < 0) colGstin = findCol(headers, 'gstin', 'gst no', 'gst number');

  let colCust = findColExact(headers, 'customer', 'party', 'buyer');
  if (colCust < 0) colCust = findColUnderscore(headers, 'customer');
  if (colCust < 0) colCust = findCol(headers, 'customer', 'party', 'buyer');

  let colInv = findColExact(headers, 'invoice', 'bill no', 'inv no');
  if (colInv < 0) colInv = findColUnderscore(headers, 'invoice');
  if (colInv < 0) colInv = findCol(headers, 'invoice', 'bill no', 'inv no');

  let colDate = findColExact(headers, 'date', 'invoice date', 'bill date');
  if (colDate < 0) colDate = findColUnderscore(headers, 'date');
  if (colDate < 0) colDate = findCol(headers, 'date', 'invoice date', 'bill date');

  for (let i = 0; i < rows.length; i++) {
    const vals = rows[i];
    if (vals.length < 2 || vals.every(v => !v.trim())) continue;

    // If we find invoice-level data in columns, capture it
    if (colGstin >= 0 && vals[colGstin] && !extraction.seller.gstin) {
      extraction.seller.gstin = vals[colGstin].trim();
    }
    if (colCust >= 0 && vals[colCust] && !extraction.buyer.name) {
      extraction.buyer.name = vals[colCust].trim();
    }
    if (colInv >= 0 && vals[colInv] && !extraction.invoice.number) {
      extraction.invoice.number = vals[colInv].trim();
    }
    if (colDate >= 0 && vals[colDate] && !extraction.invoice.date) {
      extraction.invoice.date = vals[colDate].trim();
    }

    // Item row — needs at least a name or a qty
    const itemName = colName >= 0 ? (vals[colName] || '').trim() : (vals[0] || '').trim();
    const qty = colQty >= 0 ? num(vals[colQty]) : 0;
    if (!itemName && !qty) continue;

    const rate = colRate >= 0 ? num(vals[colRate]) : 0;
    const total = colTotal >= 0 ? num(vals[colTotal]) : 0;
    const gstRate = colGstRate >= 0 ? num(vals[colGstRate]) : 0;
    const gstAmt = colGstAmt >= 0 ? num(vals[colGstAmt]) : 0;
    const taxable = colTaxable >= 0 ? num(vals[colTaxable]) : (qty && rate ? qty * rate : 0);
    const cgst = colCgst >= 0 ? num(vals[colCgst]) : 0;
    const sgst = colSgst >= 0 ? num(vals[colSgst]) : 0;
    const mrp = colMrp >= 0 ? num(vals[colMrp]) : 0;

    extraction.items.push({
      sno: i + 1,
      erpId: colErp >= 0 ? (vals[colErp] || '').trim() : '',
      description: clean(itemName),
      hsn: colHsn >= 0 ? (vals[colHsn] || '').trim() : '',
      quantity: qty,
      freeQty: 0,
      unit: 'PCS',
      mrp: mrp || rate,
      rate,
      discount: colDisc >= 0 ? num(vals[colDisc]) : 0,
      taxable,
      gstRate,
      cgst, sgst,
      gst: gstAmt || cgst + sgst || (taxable * gstRate / 100),
      total: total || (taxable + gstAmt),
    });
  }

  extraction.totals.grandTotal = extraction.items.reduce((s, it) => s + it.total, 0);
  extraction.totals.totalQty = extraction.items.reduce((s, it) => s + it.quantity, 0);
  extraction.totals.taxableAmount = extraction.items.reduce((s, it) => s + it.taxable, 0);
  extraction.totals.cgst = extraction.items.reduce((s, it) => s + it.cgst, 0);
  extraction.totals.sgst = extraction.items.reduce((s, it) => s + it.sgst, 0);
  const totalGstFromRows = extraction.items.reduce((s, it) => s + (it.gst || 0), 0);
  extraction.totals.totalGst = Math.max(extraction.totals.totalGst, totalGstFromRows);

  return extraction;
}

interface MarkdownColumn {
  header: string;
  index: number;
}

function parsePipeTable(fullText: string, lines: string[]): { items: any[]; totals: any } {
  const result = { items: [] as any[], totals: { grandTotal: 0, totalQty: 0, taxableAmount: 0, totalGst: 0, subtotal: 0, discount: 0, roundOff: 0 } as any };

  let tableStart = -1;
  let tableEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.includes('|') && /#\s*\|/.test(trimmed)) {
      tableStart = i;
      break;
    }
  }

  if (tableStart < 0) return result;

  for (let i = tableStart + 1; i < lines.length; i++) {
    if (lines[i].trim().includes('|')) {
      tableEnd = i;
    } else if (lines[i].trim().length > 0 && !lines[i].trim().startsWith('|')) {
      break;
    }
  }

  if (tableEnd < 0) return result;

  const headerLine = lines[tableStart];
  const headerParts = headerLine.split('|').map(h => h.trim());
  const headers = headerParts.filter((h, i, arr) => {
    if (i === 0 && !h) return false;
    if (i === arr.length - 1 && !h) return false;
    return h.length > 0 || arr.length <= 3;
  });

  const colMap: Record<string, number> = {};
  const headerLower = headers.map(h => h.toLowerCase());
  const mappings: [string[], string][] = [
    [['item name', 'item_name', 'description'], 'name'],
    [['item_erp_id', 'erp id', 'erp'], 'erp'],
    [['hsn/sac', 'hsn_code', 'hsn', 'sac'], 'hsn'],
    [['qty', 'quantity'], 'qty'],
    [['gst rate/amt', 'gst_amt', 'gst amount', 'gst amt', 'total gst amount'], 'gstAmt'],
    [['price/unit', 'ptr', 'rate', 'price'], 'rate'],
    [['unit', 'standard_unit', 'std_unit'], 'unit'],
    [['taxable', 'taxable value', 'taxable amt'], 'taxable'],
    [['gst rate', 'gst%', 'gst_pct', 'gst rate/amt'], 'gstRate'],
    [['amount', 'total', 'amount (₹)'], 'total'],
  ];

  for (let i = 0; i < headerLower.length; i++) {
    for (const [keys, field] of mappings) {
      if (keys.some(k => headerLower[i].includes(k))) {
        colMap[field] = i;
        break;
      }
    }
  }

  function stripPipe(value: string): string {
    return value.replace(/\*/g, '').replace(/₹/g, '').replace(/,/g, '').trim();
  }

  function parseGstCell(value: string): { amount: number; rate: number } {
    const match = value.match(/([\d.]+)\s*\(?\s*([\d.]+)%?\)?/);
    if (match) {
      return { amount: parseFloat(match[1]), rate: parseFloat(match[2]) };
    }
    const numVal = parseFloat(value.replace(/[^\d.]/g, ''));
    return { amount: isNaN(numVal) ? 0 : numVal, rate: 0 };
  }

  for (let i = tableStart + 1; i <= tableEnd; i++) {
    const row = lines[i].split('|').map(c => c.trim());
    const cleanRow = row.filter((_, i, arr) => {
      if (i === 0 && !row[0]) return false;
      if (i === arr.length - 1 && !row[arr.length - 1]) return false;
      return true;
    });

    if (cleanRow.length === 0) continue;

    const serialNum = parseInt(row[0] || '');
    if (isNaN(serialNum)) continue;

    const itemName = colMap['name'] >= 0 ? stripPipe(cleanRow[colMap['name']] || '') : '';
    const qty = colMap['qty'] >= 0 ? num(stripPipe(cleanRow[colMap['qty']] || '')) : 0;
    const hsn = colMap['hsn'] >= 0 ? stripPipe(cleanRow[colMap['hsn']] || '') : '';
    const rate = colMap['rate'] >= 0 ? num(stripPipe(cleanRow[colMap['rate']] || '')) : 0;
    const taxable = colMap['taxable'] >= 0 ? num(stripPipe(cleanRow[colMap['taxable']] || '')) : 0;
    const total = colMap['total'] >= 0 ? num(stripPipe(cleanRow[colMap['total']] || '')) : 0;

    let gstAmt = 0;
    let gstRate = 0;
    if (colMap['gstAmt'] >= 0) {
      const gstCell = stripPipe(cleanRow[colMap['gstAmt']] || '');
      const parsed = parseGstCell(gstCell);
      gstAmt = parsed.amount;
      gstRate = parsed.rate;
    }
    if (colMap['gstRate'] >= 0 && gstRate === 0) {
      gstRate = num(stripPipe(cleanRow[colMap['gstRate']] || ''));
    }

    if (!itemName && qty === 0 && total === 0) continue;

    const derivedTaxable = taxable > 0 ? taxable : (total > 0 ? total - gstAmt : (qty > 0 && rate > 0 ? qty * rate : 0));

    result.items.push({
      sno: result.items.length + 1,
      erpId: '',
      description: clean(itemName),
      hsn,
      quantity: qty,
      freeQty: 0,
      unit: colMap['unit'] >= 0 ? clean(cleanRow[colMap['unit']] || '') : 'PCS',
      mrp: rate,
      rate,
      discount: 0,
      taxable: derivedTaxable,
      gstRate,
      cgst: 0,
      sgst: 0,
      gst: gstAmt,
      total: total || (derivedTaxable + gstAmt),
    });
  }

  if (result.items.length > 0) {
    result.totals.grandTotal = result.items.reduce((s, it) => s + it.total, 0);
    result.totals.totalQty = result.items.reduce((s, it) => s + it.quantity, 0);
    result.totals.taxableAmount = result.items.reduce((s, it) => s + it.taxable, 0);
    result.totals.totalGst = result.items.reduce((s, it) => s + it.gst, 0);
  }

  return result;
}

function parseMarkdownTable(text: string): FullExtraction {
  const extraction = extractAll(text);
  extraction.items = [];
  const lines = text.split('\n');

  let tableStart = -1;
  let tableEnd = -1;
  let separatorLine = -1;
  let maxCols = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.includes('|') && trimmed.includes('---')) {
      const headerLine = lines[i - 1];
      const cols = headerLine.split('|').length;
      if (cols > maxCols) {
        maxCols = cols;
        tableStart = i - 1;
        separatorLine = i;
      }
    }
  }

  if (tableStart >= 0) {
    for (let i = separatorLine + 1; i < lines.length; i++) {
      if (lines[i].trim().includes('|')) {
        tableEnd = i;
      } else if (lines[i].trim().length > 0 && !lines[i].trim().startsWith('|')) {
        break;
      }
    }
  }

  if (tableStart < 0 || tableEnd < 0) {
    return extractAll(text);
  }

  const headerLine = lines[tableStart];
  const headers = headerLine.split('|').map(h => h.trim()).filter((h, i, arr) => {
    if (i === 0 || i === arr.length - 1) return false;
    return h.length > 0 || arr.length <= 3;
  });

  const colMap: Record<string, number> = {};
  const headerLower = headers.map(h => h.toLowerCase());
  const mappings: [string[], string][] = [
    [['item name', 'item_name', 'description'], 'name'],
    [['item_erp_id', 'erp id', 'erp'], 'erp'],
    [['hsn/sac', 'hsn_code', 'hsn', 'sac'], 'hsn'],
    [['qty', 'quantity'], 'qty'],
    [['price/unit', 'ptr', 'rate', 'price'], 'rate'],
    [['unit'], 'unit'],
    [['taxable', 'taxable value', 'taxable amt'], 'taxable'],
    [['gst', 'gst rate/amt', 'gst_amt', 'gst amount', 'gst amt', 'total gst amount'], 'gstAmt'],
    [['gst rate', 'gst%', 'gst_pct', 'gst rate/amt'], 'gstRate'],
    [['amount', 'total', 'amount (₹)'], 'total'],
  ];

  for (let i = 0; i < headerLower.length; i++) {
    for (const [keys, field] of mappings) {
      if (keys.some(k => headerLower[i].includes(k))) {
        colMap[field] = i;
        break;
      }
    }
  }

  function stripMarkdown(value: string): string {
    return value.replace(/\*\*/g, '').replace(/₹/g, '').replace(/,/g, '').trim();
  }

  const itemRows: string[][] = [];
  for (let i = separatorLine + 1; i <= tableEnd; i++) {
    const row = lines[i].split('|').map(c => c.trim());
    const cleanRow = row.filter((_, i, arr) => {
      if (i === 0 || i === arr.length - 1) return false;
      return true;
    });

    if (cleanRow.length === 0) continue;

    const firstNonEmptyCell = stripMarkdown(cleanRow.find(c => c.trim().length > 0) || '');
    const totalRowLabels = ['total', 'TOTAL'];
    const isTotalRow = totalRowLabels.some(label => firstNonEmptyCell.toLowerCase() === label);

    if (isTotalRow && cleanRow.length >= 2) {
      if (colMap['total'] >= 0 && cleanRow[colMap['total']]) {
        extraction.totals.grandTotal = num(stripMarkdown(cleanRow[colMap['total']]));
      }
      if (colMap['taxable'] >= 0 && cleanRow[colMap['taxable']]) {
        extraction.totals.taxableAmount = num(stripMarkdown(cleanRow[colMap['taxable']]));
      }
      if (colMap['gstAmt'] >= 0 && cleanRow[colMap['gstAmt']]) {
        extraction.totals.totalGst = num(stripMarkdown(cleanRow[colMap['gstAmt']]));
      }
      if (colMap['qty'] >= 0 && cleanRow[colMap['qty']]) {
        extraction.totals.totalQty = num(stripMarkdown(cleanRow[colMap['qty']]));
      }
      if (colMap['cases'] >= 0 && cleanRow[colMap['cases']]) {
        extraction.totals.totalQty = num(stripMarkdown(cleanRow[colMap['cases']]));
      }
      continue;
    }

    const serialNum = parseInt(stripMarkdown(cleanRow[0] || ''));
    if (!isNaN(serialNum) || (cleanRow[0] || '').length === 0) {
      itemRows.push(cleanRow);
    }
  }

  for (const row of itemRows) {
    const rawItemName = colMap['name'] >= 0 ? row[colMap['name']] || '' : '';
    const itemName = stripMarkdown(rawItemName);
    const qty = colMap['qty'] >= 0 ? num(stripMarkdown(row[colMap['qty']] || '')) : 0;
    if (!itemName && qty === 0) continue;

    const erpId = colMap['erp'] >= 0 ? stripMarkdown(row[colMap['erp']] || '') : '';
    const hsn = colMap['hsn'] >= 0 ? stripMarkdown(row[colMap['hsn']] || '') : '';
    const mrp = colMap['mrp'] >= 0 ? num(stripMarkdown(row[colMap['mrp']] || '')) : 0;
    const cases = colMap['cases'] >= 0 ? num(stripMarkdown(row[colMap['cases']] || '')) : 0;
    const rate = colMap['rate'] >= 0 ? num(stripMarkdown(row[colMap['rate']] || '')) : 0;
    const taxable = colMap['taxable'] >= 0 ? num(stripMarkdown(row[colMap['taxable']] || '')) : 0;
    const gstAmt = colMap['gstAmt'] >= 0 ? num(stripMarkdown(row[colMap['gstAmt']] || '')) : 0;
    const total = colMap['total'] >= 0 ? num(stripMarkdown(row[colMap['total']] || '')) : 0;
    const gstRate = taxable > 0 && gstAmt > 0 ? Math.round((gstAmt / taxable) * 1000) / 10 : 5;

    const derivedTaxable = taxable > 0 ? taxable : (total > 0 ? total - gstAmt : (qty > 0 && rate > 0 ? qty * rate : 0));

    extraction.items.push({
      sno: extraction.items.length + 1,
      erpId,
      description: clean(itemName),
      hsn,
      quantity: qty || cases,
      freeQty: 0,
      unit: 'PCS',
      mrp: mrp || rate,
      rate,
      discount: 0,
      taxable: derivedTaxable,
      gstRate,
      cgst: 0,
      sgst: 0,
      gst: gstAmt,
      total: total || (derivedTaxable + gstAmt),
    });
  }

  if (extraction.items.length > 0) {
    extraction.totals.grandTotal = extraction.items.reduce((s, it) => s + it.total, 0);
    extraction.totals.totalQty = extraction.items.reduce((s, it) => s + it.quantity, 0);
    extraction.totals.taxableAmount = extraction.items.reduce((s, it) => s + it.taxable, 0);
    extraction.totals.totalGst = extraction.items.reduce((s, it) => s + it.gst, 0);
  }

  extraction.metadata.fileType = 'markdown-table';
  extraction.metadata.extractionConfidence = extraction.items.length > 0 ? 95 : 40;
  extraction.metadata.rawTextLength = text.length;
  return extraction;
}

function isLikelyMarkdownTable(text: string): boolean {
  const lines = text.split('\n');
  let tableLines = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('|') && trimmed.includes('---')) {
      tableLines++;
    }
  }
  return tableLines >= 1;
}

function parseCSV(text: string): FullExtraction {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return extractAll('');

  const headers = lines[0].split(/[,\t]/).map(h => h.trim().replace(/"/g, '').toLowerCase());
  const rows = lines.slice(1).map(l => l.split(/[,\t]/).map(v => v.trim().replace(/"/g, '')));

  const extraction = parseRows(headers, rows);
  extraction.metadata.fileType = 'csv';
  extraction.metadata.extractionConfidence = 95;
  return extraction;
}

function parseExcel(buffer: Buffer): FullExtraction {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return extractAll('');

    const sheet = workbook.Sheets[sheetName];
    // header: 1 gives us a 2D array [row][col]
    const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    // Create an empty base extraction
    const extraction = extractAll('');
    
    // 1. TRY GRID-BASED EXTRACTION (For "Rajshree" style layout)
    // We flatten the sheet into a long string and also scan for labels
    let fullText = '';
    
    // Look for key labels in the grid
    for (let r = 0; r < jsonData.length; r++) {
      for (let c = 0; r < jsonData[r]?.length && c < jsonData[r].length; c++) {
        const cell = String(jsonData[r][c] || '').trim();
        fullText += cell + ' ';
        
        // Check if this cell is a label we recognize
        // In this format, values are often in the same cell after a colon OR in the next cell (c+1)
        const findValue = (label: string) => {
          if (cell.toLowerCase().includes(label.toLowerCase())) {
            // Case A: Label and Value in same cell (e.g. "Invoice No: RS/123")
            if (cell.includes(':')) {
              return cell.split(':')[1].trim();
            }
            // Case B: Value is in the NEXT cell
            return String(jsonData[r][c + 1] || '').trim();
          }
          return null;
        };

        // Header Specific Logic: "Invoice No: RS/26-27/1577 | Date: 22 Jul 2026"
        if (cell.toLowerCase().includes('invoice no:')) {
          const parts = cell.split('|');
          extraction.invoice.number = parts[0].split(':')[1]?.trim() || '';
          if (parts[1] && parts[1].toLowerCase().includes('date:')) {
            extraction.invoice.date = parts[1].split(':')[1]?.trim() || '';
          }
        }

        // Apply grid mapping
        if (cell.toLowerCase().includes('seller firm name')) extraction.seller.name = String(jsonData[r][c + 1] || '').trim();
        if (cell.toLowerCase().includes('seller gstin / pan')) {
          const val = String(jsonData[r][c + 1] || '').trim();
          extraction.seller.gstin = val.split('/')[0].trim();
          extraction.seller.pan = val.split('/')[1]?.trim() || '';
        }
        if (cell.toLowerCase().includes('billed / shipped to')) extraction.buyer.name = String(jsonData[r][c + 1] || '').trim();
        if (cell.toLowerCase().includes('buyer gstin / pan')) {
          const val = String(jsonData[r][c + 1] || '').trim();
          extraction.buyer.gstin = val.split('/')[0].trim();
        }
        if (cell.toLowerCase().includes('net payable amount')) extraction.totals.grandTotal = num(String(jsonData[r + 1]?.[c] || ''));
        if (cell.toLowerCase().includes('total delivery quantity')) extraction.totals.totalQty = num(String(jsonData[r + 1]?.[c] || ''));
        if (cell.toLowerCase().includes('gross taxable value')) extraction.totals.taxableAmount = num(String(jsonData[r + 1]?.[c] || ''));
        if (cell.toLowerCase().includes('total gst amount (5%)')) extraction.totals.totalGst = num(String(jsonData[r + 1]?.[c] || ''));
        
        // Financial Computation Grid (right side)
        if (cell === 'Gross Amount') extraction.totals.subtotal = num(String(jsonData[r][c + 1] || ''));
        if (cell.includes('Taxable Value')) extraction.totals.taxableAmount = num(String(jsonData[r][c + 1] || ''));
        if (cell.includes('Total Payable Value')) extraction.totals.grandTotal = num(String(jsonData[r][c + 1] || ''));
        if (cell.includes('Total GST Amount')) extraction.totals.totalGst = num(String(jsonData[r][c + 1] || ''));
      }
    }

    // 2. FALLBACK TO TABULAR EXTRACTION IF GRID FAILED TO FIND ITEMS
    if (extraction.items.length === 0) {
      const headers = jsonData[0].map((h: any) => String(h || '').toLowerCase().trim());
      const rows = jsonData.slice(1).map((r: any[]) => r.map((c: any) => String(c ?? '')));
      const tabularExt = parseRows(headers, rows);
      if (tabularExt.items.length > 0) {
        extraction.items = tabularExt.items;
        extraction.totals.grandTotal = tabularExt.totals.grandTotal;
        extraction.totals.totalQty = tabularExt.totals.totalQty;
        extraction.totals.taxableAmount = tabularExt.totals.taxableAmount;
        extraction.totals.totalGst = tabularExt.totals.totalGst;
        extraction.totals.cgst = tabularExt.totals.cgst;
        extraction.totals.sgst = tabularExt.totals.sgst;
      }
    }

    // 3. APPLY REGEX TO FLATTENED TEXT FOR ANY MISSING FIELDS
    const regexExt = extractAll(fullText);
    if (!extraction.seller.gstin) extraction.seller.gstin = regexExt.seller.gstin;
    if (!extraction.seller.name) extraction.seller.name = regexExt.seller.name;
    if (!extraction.invoice.number) extraction.invoice.number = regexExt.invoice.number;
    if (!extraction.totals.grandTotal && regexExt.totals.grandTotal > 0) extraction.totals.grandTotal = regexExt.totals.grandTotal;
    if (!extraction.totals.totalQty && regexExt.totals.totalQty > 0) extraction.totals.totalQty = regexExt.totals.totalQty;
    if (!extraction.totals.taxableAmount && regexExt.totals.taxableAmount > 0) extraction.totals.taxableAmount = regexExt.totals.taxableAmount;
    if (!extraction.totals.totalGst && regexExt.totals.totalGst > 0) extraction.totals.totalGst = regexExt.totals.totalGst;
    if (!extraction.totals.subtotal && regexExt.totals.subtotal > 0) extraction.totals.subtotal = regexExt.totals.subtotal;

    extraction.metadata.fileType = 'excel';
    extraction.metadata.extractionConfidence = 98;
    extraction.metadata.rawTextLength = fullText.length;
    return extraction;
  } catch (err) {
    console.error('Excel parse error:', err);
    return extractAll('');
  }
}

// ────────────────────── Route Handler ──────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const textContent = formData.get('textContent') as string | null;

    if (!file && !textContent) {
      return NextResponse.json({ error: 'File or text content required' }, { status: 400 });
    }

    let extraction: FullExtraction;
    let fileType = 'text';
    let fileName = 'text-input';
    let fileSize = 0;

    if (textContent) {
      // ── Direct text input ──
      if (isLikelyMarkdownTable(textContent)) {
        extraction = parseMarkdownTable(textContent);
        fileType = 'markdown';
      } else {
        extraction = extractAll(textContent);
      }
      fileSize = textContent.length;
    } else if (file) {
      fileName = file.name;
      fileSize = file.size;
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const mime = file.type || '';

      if (ext === 'pdf' || mime.includes('pdf')) {
        // ── PDF file ──
        fileType = 'pdf';
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const text = await extractTextFromPDF(buffer);

        if (text.length < 20) {
          return NextResponse.json({
            extracted: extractAll(''),
            validation: { passed: [], warnings: ['PDF appears to be image-only — no text layer found'], errors: ['Could not extract text from this PDF. Try a text-based PDF or paste the content manually.'], score: 0 },
            recommendation: { format: 'image', confidence: 30, reason: 'This PDF appears to be a scanned image without a text layer.', tips: ['Use a text-based PDF for best results (~85% accuracy)', 'Or paste the invoice text manually using the "Paste Text" tab', 'Excel/CSV files give ~99% accuracy'] },
            fileName, fileSize,
          });
        }

        extraction = extractAll(text);
        extraction.metadata.fileType = 'pdf';
      } else if (ext === 'xlsx' || ext === 'xls' || mime.includes('spreadsheet') || mime.includes('excel')) {
        // ── Excel ──
        fileType = 'excel';
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        extraction = parseExcel(buffer);
      } else if (ext === 'csv' || ext === 'tsv' || mime.includes('csv') || mime.includes('tab')) {
        // ── CSV ──
        fileType = 'csv';
        const text = await file.text();
        extraction = parseCSV(text);
      } else if (ext === 'txt' || mime.includes('text')) {
        // ── Plain text ──
        fileType = 'text';
        const text = await file.text();
        extraction = extractAll(text);
      } else {
        // ── Try as text ──
        fileType = ext || 'unknown';
        try {
          const text = await file.text();
          extraction = extractAll(text);
          extraction.metadata.fileType = fileType;
        } catch {
          return NextResponse.json({ error: `Unsupported file type: ${ext}` }, { status: 400 });
        }
      }
    } else {
      extraction = extractAll('');
    }

    // Validate
    const validation = validateExtraction(extraction);

    // Recommend format
    const reasons: Record<string, string> = {
      excel: 'Excel file parsed with structured column mapping — highest accuracy.',
      csv: 'CSV file parsed with structured column mapping — near-perfect accuracy.',
      pdf: 'Text-based PDF parsed with AI pattern matching.',
      text: 'Text content analyzed with heuristic extraction.',
    };
    const tips: Record<string, string[]> = {
      excel: ['Excel gives ~98% accuracy — best format for bulk data', 'Ensure headers: Name, Qty, Rate, GST, Total', 'Each row = one line item'],
      csv: ['CSV gives ~95% accuracy', 'Use comma or tab as separator', 'Include column headers in first row'],
      pdf: ['Text-based PDFs give ~85% accuracy', 'Excel/CSV files are most reliable', 'Ensure PDF has selectable text (not scanned)'],
      text: ['Include GSTIN, invoice number, and totals', 'Paste the exact text from the document', 'Tabular data with aligned columns works best'],
    };
    const recommendation = {
      format: fileType,
      confidence: extraction.metadata.extractionConfidence,
      reason: reasons[fileType] || reasons.text,
      tips: tips[fileType] || tips.text,
    };

    let invoiceId: number | null = null;
    try {
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          file_name: fileName || 'text-input',
          file_type: fileType,
          file_size: fileSize || 0,
          extracted_data: extraction as any,
          validation_result: validation as any,
          uploaded_by_id: user.id,
          status: 'pending',
        })
        .select()
        .single();
      if (!invoiceError && invoice) {
        invoiceId = invoice.id;
      }
    } catch (e) {
      console.warn('Invoice save failed:', e);
    }

    return NextResponse.json({
      extracted: extraction,
      validation,
      recommendation,
      fileName,
      fileSize,
      invoiceId,
    });
  } catch (error) {
    console.error('Extraction error:', error);
    return NextResponse.json({ error: 'Failed to extract data: ' + (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}
