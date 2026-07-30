import * as XLSX from 'xlsx';

async function getPdfParse() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('pdf-parse');
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = await getPdfParse();
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('DOMMatrix') || message.includes('canvas')) {
      console.warn('pdf-parse failed, falling back to pdf2json');
      try {
        const PDFParser = require('pdf2json');
        return new Promise((resolve, reject) => {
          const pdfParser = new PDFParser();
          let fullText = '';
          pdfParser.on('pdfParserDataError', (e: Error) => reject(e));
          pdfParser.on('pdfParserDataReady', () => {
            if (pdfParser.pages) {
              fullText = pdfParser.pages.map((page: any) => {
                if (page.text && Array.isArray(page.text)) {
                  return page.text.map((t: any) => t.s || '').join(' ');
                }
                return '';
              }).join('\n');
            }
            resolve(fullText || '');
          });
          pdfParser.parseBuffer(buffer);
        });
      } catch {
        return '';
      }
    }
    return '';
  }
}

// ────────────────────── Types ──────────────────────

interface CsvItem {
  sno: number;
  description: string;
  hsn: string;
  quantity: number;
  freeQty: number;
  unit: string;
  mrp: number;
  rate: number;
  discount: number;
  taxable: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  gst: number;
  total: number;
}

// ────────────────────── Helpers ──────────────────────

function num(s: string | undefined): number {
  if (!s) return 0;
  const cleaned = s.replace(/[₹,\s]/g, '').trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function clean(s: string | undefined): string {
  if (!s) return '';
  return s.replace(/\s+/g, ' ').trim();
}

function parseItemsFromText(text: string): CsvItem[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const items: CsvItem[] = [];

  for (const line of lines) {
    const leadMatch = line.match(/^(\d{1,3})\s+([A-Z]{1,2}\d{12,20}[A-Z]?)\s+(.+)/);
    if (leadMatch) {
      const sno = parseInt(leadMatch[1], 10);
      const rest = leadMatch[3];
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
      let hsn = '';
      let startIdx = 0;

      if (n.length >= 7) {
        const firstStr = numericTokens[0];
        if (/^\d{3,8}$/.test(firstStr) && n[0] < 100000) {
          hsn = firstStr.padStart(4, '0');
          startIdx = 1;
        }
      }

      const totalVal = n.length > 0 ? n[n.length - 1] : 0;
      const sgstVal = n.length > 1 ? n[n.length - 2] : 0;
      const cgstVal = n.length > 2 ? n[n.length - 3] : 0;
      const taxableVal = n.length > 3 ? n[n.length - 4] : 0;

      const front = n.slice(startIdx, Math.max(startIdx, n.length - 4));
      const qtyVal = front[0] || 0;
      const mrpVal = front.length > 2 ? front[2] : 0;
      let rateVal = front.length > 3 ? front[3] : 0;
      const discVal = front.length > 4 ? front[4] : 0;

      if (!rateVal && mrpVal > 0) rateVal = mrpVal;

      items.push({
        sno,
        description: clean(description),
        hsn,
        quantity: qtyVal,
        freeQty: 0,
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

    const simpleMatch = line.match(/^(\d{1,3})\s+([A-Za-z].{3,})/);
    if (simpleMatch) {
      const sno = parseInt(simpleMatch[1], 10);
      if (sno > 0 && sno < 500) {
        const rest = simpleMatch[2];
        const allNums = [...rest.matchAll(/(?<=\s)([\d,]+\.?\d*)(?=\s|$)/g)].map(m => num(m[1]));
        if (allNums.length >= 2) {
          const firstNumPos = rest.search(/\s\d/);
          const description = firstNumPos > 0 ? clean(rest.substring(0, firstNumPos)) : '';
          items.push({
            sno,
            description,
            hsn: '',
            quantity: allNums[0] || 0,
            freeQty: 0,
            unit: 'PCS',
            mrp: 0,
            rate: allNums.length > 1 ? allNums[1] : 0,
            discount: 0,
            taxable: allNums.length > 3 ? allNums[allNums.length - 4] : 0,
            gstRate: 0,
            cgst: allNums.length > 2 ? allNums[allNums.length - 3] : 0,
            sgst: allNums.length > 1 ? allNums[allNums.length - 2] : 0,
            gst: 0,
            total: allNums[allNums.length - 1] || 0,
          });
        }
      }
    }
  }

  for (const item of items) {
    if (!item.gst) item.gst = item.cgst + item.sgst;
    if (item.taxable > 0 && item.gst > 0) {
      item.gstRate = Math.round((item.gst / item.taxable) * 100 * 10) / 10;
    }
  }

  return items;
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

// ────────────────────── Converters ──────────────────────

export async function pdfToCsv(buffer: Buffer): Promise<string> {
  try {
    const text = await extractPdfText(buffer);
    const items = parseItemsFromText(text);

    if (items.length === 0) {
      const safeText = text.replace(/"/g, '""').substring(0, 500);
      return 'sno,description,hsn,qty,unit,rate,taxable,gst,gstRate,total\n1,"' + safeText + '",,,0,PCS,0,0,0,0,0\n';
    }

    const headers = ['sno', 'description', 'hsn', 'qty', 'unit', 'rate', 'taxable', 'gst', 'gstRate', 'total'];
    const rows = items.map(it => [
      it.sno,
      escapeCsv(it.description),
      it.hsn,
      it.quantity,
      it.unit,
      it.rate,
      it.taxable,
      it.gst,
      it.gstRate,
      it.total,
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  } catch (err) {
    console.error('PDF to CSV conversion error:', err);
    return 'sno,description,hsn,qty,unit,rate,taxable,gst,gstRate,total\n';
  }
}

export async function excelToCsv(buffer: Buffer): Promise<string> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return 'sno,description,hsn,qty,unit,rate,taxable,gst,gstRate,total\n';

    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_csv(sheet);
  } catch (err) {
    console.error('Excel to CSV conversion error:', err);
    return 'sno,description,hsn,qty,unit,rate,taxable,gst,gstRate,total\n';
  }
}

export async function excelToCopyPaste(buffer: Buffer): Promise<string> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return '# | Item Name | HSN/SAC | Qty | Unit | Price/Unit (₹) | GST Rate/Amt (₹) | Amount (₹)\n';

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];

    if (jsonData.length === 0) {
      return '# | Item Name | HSN/SAC | Qty | Unit | Price/Unit (₹) | GST Rate/Amt (₹) | Amount (₹)\n';
    }

    const headers = jsonData[0];
    const colMap: Record<string, number> = {};
    const headerLower = headers.map((h: any) => String(h || '').toLowerCase().trim());

    const mappings: [string[], string][] = [
      [['item name', 'item_name', 'description', 'name'], 'name'],
      [['hsn/sac', 'hsn_code', 'hsn', 'sac'], 'hsn'],
      [['qty', 'quantity'], 'qty'],
      [['unit', 'standard_unit', 'std_unit'], 'unit'],
      [['price/unit', 'ptr', 'rate', 'price'], 'rate'],
      [['gst rate/amt', 'gst_amt', 'gst amount', 'gst amt'], 'gst'],
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

    const lines: string[] = [];
    lines.push('# | Item Name | HSN/SAC | Qty | Unit | Price/Unit (₹) | GST Rate/Amt (₹) | Amount (₹)');

    for (let r = 1; r < jsonData.length; r++) {
      const row = jsonData[r];
      const name = colMap['name'] >= 0 ? String(row[colMap['name']] || '').trim() : '';
      const hsn = colMap['hsn'] >= 0 ? String(row[colMap['hsn']] || '').trim() : '';
      const qty = colMap['qty'] >= 0 ? String(row[colMap['qty']] || '').trim() : '';
      const unit = colMap['unit'] >= 0 ? String(row[colMap['unit']] || '').trim() : 'PCS';
      const rate = colMap['rate'] >= 0 ? String(row[colMap['rate']] || '').trim() : '';
      const gst = colMap['gst'] >= 0 ? String(row[colMap['gst']] || '').trim() : '';
      const total = colMap['total'] >= 0 ? String(row[colMap['total']] || '').trim() : '';

      if (!name && !qty && !total) continue;

      lines.push(`# | ${name} | ${hsn} | ${qty} | ${unit} | ${rate} | ${gst} | ${total}`);
    }

    return lines.join('\n');
  } catch (err) {
    console.error('Excel to Copy-Paste conversion error:', err);
    return '# | Item Name | HSN/SAC | Qty | Unit | Price/Unit (₹) | GST Rate/Amt (₹) | Amount (₹)\n';
  }
}

export async function pdfToCopyPaste(buffer: Buffer): Promise<string> {
  try {
    const text = await extractPdfText(buffer);
    const items = parseItemsFromText(text);

    const lines: string[] = [];
    lines.push('# | Item Name | HSN/SAC | Qty | Unit | Price/Unit (₹) | GST Rate/Amt (₹) | Amount (₹)');

    if (items.length === 0) {
      const safeText = text.replace(/\|/g, '/').substring(0, 200);
      lines.push(`# | ${safeText} | | | | | |`);
    } else {
      for (const item of items) {
        const gstStr = item.gstRate > 0 ? `${item.gst.toFixed(2)} (${item.gstRate}%)` : String(item.gst);
        lines.push(`# | ${item.description} | ${item.hsn} | ${item.quantity} | ${item.unit} | ${item.rate.toFixed(2)} | ${gstStr} | ${item.total.toFixed(2)}`);
      }
    }

    return lines.join('\n');
  } catch (err) {
    console.error('PDF to Copy-Paste conversion error:', err);
    return '# | Item Name | HSN/SAC | Qty | Unit | Price/Unit (₹) | GST Rate/Amt (₹) | Amount (₹)\n';
  }
}
