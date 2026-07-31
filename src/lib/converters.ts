import * as XLSX from 'xlsx';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import fs from 'fs';

const execFileAsync = promisify(execFile);

const PDF_EXTRACT_SCRIPT = path.join(process.cwd(), 'scripts', 'pdf-extract.mjs');

async function extractPdfText(buffer: Buffer): Promise<string> {
  const tmp = path.join(os.tmpdir(), `pdf-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  try {
    fs.writeFileSync(tmp, buffer);
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    const { stdout } = await execFileAsync('node', [PDF_EXTRACT_SCRIPT, tmp], {
      cwd: process.cwd(),
      env: { ...process.env, FORCE_COLOR: '0', NODE_PATH: nodeModulesPath },
      timeout: 30000,
    });
    return stdout || '';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('PDF extraction error:', message);
    return '';
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* best effort cleanup */ }
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
  const trimmed = s.trim();
  const isNegative = trimmed.startsWith('(') && trimmed.endsWith(')');
  const match = trimmed.match(/-?[\d,]+\.?\d*/g);
  if (!match || !match[0]) return 0;
  const cleaned = match[0].replace(/[₹$,()]/g, '');
  const val = parseFloat(cleaned);
  return isNegative ? -val : (isNaN(val) ? 0 : val);
}

function clean(s: string | undefined): string {
  if (!s) return '';
  return s.replace(/\s+/g, ' ').trim();
}

// ────────────────────── Field Mapping & Header Detection ──────────────────────

const FIELD_ALIASES: Record<string, string[]> = {
  sno: ['sno', 'sr', 'serial', 'sl', 'line', 'line no'],
  description: ['item name', 'description', 'desc', 'particulars', 'product', 'name'],
  hsn: ['hsn', 'sac', 'hsn/sac'],
  quantity: ['qty', 'quantity', 'quant', 'count'],
  mrp: ['mrp', 'maximum retail'],
  discount: ['discount', 'disc', 'trade disc', 'trade discount'],
  taxable: ['taxable', 'assessable', 'base', 'taxable value'],
  cgst: ['cgst', 'central tax', 'cgst amt'],
  sgst: ['sgst', 'state tax', 'sgst amt'],
  gstRate: ['gst rate', 'gst%', 'gst %', 'tax rate', 'vat rate', 'gst rate%'],
  gst: ['gst', 'tax', 'cgst+sgst', 'igst', 'gst amount', 'tax amount', 'gst amt', 'tax amt'],
  rate: ['rate', 'price', 'price/unit', 'price unit', 'ptr', 'basic', 'per rate', 'unit rate', 'cost', 'basic rate'],
  unit: ['unit', 'uom'],
  total: ['total', 'amount', 'net', 'grand total', 'final', 'balance', 'net amount'],
};

const COPYPASTE_COL_MAP: Record<string, number> = {
  sno: 0, description: 1, hsn: 2, quantity: 3,
  unit: 4, rate: 5, gstRate: 6, total: 7,
};

function isCopyPasteLine(line: string): boolean {
  const cells = line.split('|').map(c => c.replace(/^#\s*/, '').trim());
  if (cells.length < 6) return false;
  const firstCell = cells[0];
  return firstCell === '' || firstCell === '#' || (/^\d+$/.test(firstCell) && parseInt(firstCell, 10) < 1000);
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim()
    .replace(/[₹()]/g, '')
    .replace(/[/]/g, ' ')
    .replace(/[^\w\s%]/g, '')
    .replace(/\s*%\s*/g, '%')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchAlias(normalized: string, alias: string): boolean {
  if (normalized === alias) return true;
  const words = normalized.split(/\s+/);
  const aliasWords = alias.split(/\s+/);
  if (aliasWords.length === 1) {
    return words.includes(alias);
  }
  return normalized.includes(alias);
}

function mapHeaderToField(header: string): string | null {
  const normalized = normalizeHeader(header);
  if (!normalized || normalized === '#') return 'sno';
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some(a => matchAlias(normalized, a))) return field;
  }
  // Fallback: pattern-based
  if (normalized.includes('cgst')) return 'cgst';
  if (normalized.includes('sgst')) return 'sgst';
  if (normalized.includes('gst') && normalized.includes('rate')) return 'gstRate';
  if (normalized.includes('gst') || (normalized.includes('tax') && normalized.includes('amt'))) return 'gst';
  if (normalized.includes('qty') || normalized.includes('quant')) return 'quantity';
  if (normalized.includes('rate') || normalized.includes('price')) return 'rate';
  if (normalized.includes('total') || normalized.includes('amount')) return 'total';
  if (normalized.includes('disc')) return 'discount';
  if (normalized.includes('hsn') || normalized.includes('sac')) return 'hsn';
  if (normalized.includes('unit')) return 'unit';
  if (normalized.includes('sno') || normalized.includes('serial') || normalized.includes('line') || normalized.includes('no')) return 'sno';
  if (normalized.includes('desc')) return 'description';
  if (normalized.includes('item') || normalized.includes('particular') || normalized.includes('product')) return 'description';
  if (normalized.includes('tax')) return 'taxable';
  return null;
}

function detectDelimiter(line: string): string {
  if (line.includes('\t')) return '\t';
  const commaCount = (line.match(/,/g) || []).length;
  if (commaCount >= 2) return ',';
  if (line.includes('|')) return '|';
  return '';
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function splitByDelimiter(line: string, delimiter: string): string[] {
  if (delimiter === '\t') return line.split('\t').map(c => c.trim());
  if (delimiter === ',') return splitCsvLine(line);
  if (delimiter === '|') {
    return line.split('|').map(c => c.replace(/^#\s*/, '').trim());
  }
  return line.split(delimiter).map(c => c.trim());
}

function isSeparatorRow(line: string, delimiter: string): boolean {
  let cells: string[];
  if (delimiter === '|') {
    cells = line.split('|').filter(c => c.trim());
  } else {
    cells = splitByDelimiter(line, delimiter);
  }
  if (cells.length <= 1) return false;
  return cells.every(c => /^[-:]+$/.test(c.trim()));
}

function tryParseGstCell(cell: string): { amount: number; rate: number } {
  const amount = num(cell);
  const rateMatch = cell.match(/\((\d+(?:\.\d+)?)%?\)/);
  const rate = rateMatch ? parseFloat(rateMatch[1]) : 0;
  return { amount, rate };
}

function getCell(cells: string[], idx: number | undefined): string {
  if (idx === undefined || idx < 0 || idx >= cells.length) return '';
  return cells[idx] || '';
}

function isLikelyHeader(line: string, delimiter: string): boolean {
  const cells = splitByDelimiter(line, delimiter).map(c => normalizeHeader(c || ''));
  if (cells.length < 2) return false;
  const mappedCount = cells.filter(c => mapHeaderToField(c) !== null).length;
  return mappedCount >= Math.ceil(cells.length / 2);
}

function tryDetectHeader(lines: string[], delimiter: string): { colMap: Record<string, number>; isHeader: boolean } | null {
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    if (isLikelyHeader(lines[i], delimiter)) {
      const cells = splitByDelimiter(lines[i], delimiter).map(c => normalizeHeader(c || ''));
      const colMap: Record<string, number> = {};
      for (let j = 0; j < cells.length; j++) {
        const field = mapHeaderToField(cells[j]);
        if (field && !(field in colMap)) colMap[field] = j;
      }
      return { colMap, isHeader: true };
    }
  }

  // Check for # | copy-paste format without header
  if (delimiter === '|' && lines.length > 0 && isCopyPasteLine(lines[0])) {
    return { colMap: { ...COPYPASTE_COL_MAP }, isHeader: false };
  }

  return null;
}

function parseRowByMap(cells: string[], colMap: Record<string, number>): CsvItem | null {
  const getCount = (field: string) => getCell(cells, colMap[field]);
  const getCountNum = (field: string) => num(getCell(cells, colMap[field]));

  const snoStr = getCount('sno');
  let sno = parseInt(snoStr.replace(/[^0-9]/g, ''), 10);
  if (isNaN(sno) || sno < 1) sno = 0;

  const description = clean(getCount('description'));
  const hsn = clean(getCount('hsn'));
  const quantity = getCountNum('quantity');
  const unit = clean(getCount('unit')) || 'PCS';
  const mrp = getCountNum('mrp');
  const rate = getCountNum('rate') || mrp;
  const discount = getCountNum('discount');
  let taxable = getCountNum('taxable');

  let gstRate = 0;
  let cgst = getCountNum('cgst');
  let sgst = getCountNum('sgst');
  let gstAmount = 0;

  const gstRateCell = getCount('gstRate');
  if (gstRateCell) {
    const parsed = tryParseGstCell(gstRateCell);
    if (parsed.rate > 0) gstRate = parsed.rate;
    if (parsed.amount > 0 && gstRateCell.includes('(') && !gstAmount) gstAmount = parsed.amount;
    if (!gstRate && num(gstRateCell) > 0 && num(gstRateCell) <= 100) {
      gstRate = num(gstRateCell);
    }
  }

  const gstCell = getCount('gst');
  if (gstCell) {
    const parsed = tryParseGstCell(gstCell);
    if (parsed.amount > 0 && !gstAmount) gstAmount = parsed.amount;
    if (parsed.rate > 0 && !gstRate) gstRate = parsed.rate;
  }

  if (cgst > 0 && sgst > 0) {
    gstAmount = cgst + sgst;
  } else if (gstAmount > 0) {
    cgst = gstAmount / 2;
    sgst = gstAmount / 2;
  }

  if (gstAmount > 0 && !gstRate && taxable > 0) {
    gstRate = Math.round((gstAmount / taxable) * 1000) / 10;
  }
  if (!gstAmount && gstRate > 0 && taxable > 0) {
    gstAmount = taxable * gstRate / 100;
    cgst = gstAmount / 2;
    sgst = gstAmount / 2;
  }

  const total = getCountNum('total');
  if (!taxable && total > 0 && gstAmount > 0) {
    taxable = total - gstAmount;
  }
  const finalTotal = total > 0 ? total : (taxable > 0 ? taxable + gstAmount : 0);

  if (!description && !quantity && !finalTotal) return null;

  return {
    sno, description, hsn, quantity, freeQty: 0, unit, mrp, rate: rate || mrp,
    discount, taxable, gstRate, cgst, sgst, gst: cgst + sgst, total: finalTotal,
  };
}

function parseRowPositional(cells: string[]): CsvItem | null {
  const nonEmpty = cells.map((c, i) => ({ val: c, idx: i })).filter(c => c.val !== '');
  if (nonEmpty.length < 3) return null;

  let startIdx = 0;
  const firstVal = nonEmpty[0].val;
  const firstNum = num(firstVal);
  if (!isNaN(firstNum) && firstNum > 0 && firstNum < 1000 && nonEmpty.length > 3) {
    startIdx = 1;
  } else if (firstVal.replace(/^#\s*/, '').trim() === '' && nonEmpty.length > 3) {
    startIdx = 1;
  }

  const remaining = nonEmpty.slice(startIdx);
  if (remaining.length < 2) return null;

  let description = clean(remaining[0].val);
  let hsn = '';
  const nums: number[] = [];
  const numLabels: string[] = [];

  for (let i = 1; i < remaining.length; i++) {
    const val = clean(remaining[i].val);
    if (/^\d{4,8}$/.test(val) && remaining.length > i + 1 && !hsn) {
      hsn = val;
      continue;
    }
    const n = num(remaining[i].val);
    if (!isNaN(n) && n > 0) {
      nums.push(n);
      numLabels.push(val);
    }
  }

  if (nums.length === 0) return null;

  let sno = startIdx > 0 ? firstNum : 0;
  if (isNaN(sno)) sno = 0;

  let qty = 0, rate = 0, taxable = 0, gstAmount = 0, total = 0, gstRate = 0;

  if (nums.length >= 3) {
    total = nums[nums.length - 1];

    let found = false;
    for (let offset = 1; offset <= Math.min(4, nums.length - 1); offset++) {
      const g = nums[nums.length - 1 - offset];
      const tx = nums[nums.length - 2 - offset];
      if (tx === undefined || g === undefined) continue;
      if (Math.abs(tx + g - total) < total * 0.15 && tx > 0 && g > 0) {
        taxable = tx;
        gstAmount = g;
        const beforeCount = nums.length - 2 - offset;
        const beforeNums = nums.slice(0, beforeCount);
        if (beforeNums.length >= 2) {
          qty = beforeNums[0];
          rate = beforeNums[beforeNums.length - 1];
        } else if (beforeNums.length === 1) {
          rate = beforeNums[0];
        }
        found = true;
        break;
      }
    }

    if (!found && nums.length >= 3) {
      for (let i = 1; i <= Math.min(2, nums.length - 3); i++) {
        const rateCandidate = nums[i];
        const gstCandidate = nums[nums.length - 2];
        if (rateCandidate > 0 && gstCandidate > 0 &&
            Math.abs(nums[0] * rateCandidate + gstCandidate - total) < total * 0.1) {
          qty = nums[0];
          rate = rateCandidate;
          gstAmount = gstCandidate;
          taxable = nums[0] * rateCandidate;
          found = true;
          break;
        }
      }
    }

    if (!found) {
      for (let j = 0; j < nums.length - 1; j++) {
        const potentialRate = nums[j];
        if (potentialRate > 0 && potentialRate <= 100 && nums.length >= 3) {
          const potentialTaxable = total / (1 + potentialRate / 100);
          const potentialGst = total - potentialTaxable;
          if (potentialTaxable > 0 && potentialGst > 0 && potentialGst < potentialTaxable) {
            taxable = potentialTaxable;
            gstAmount = potentialGst;
            gstRate = potentialRate;
            const beforeNums = nums.slice(0, j).concat(nums.slice(j + 1, nums.length - 1));
            if (beforeNums.length >= 2) {
              qty = beforeNums[0];
              rate = beforeNums[beforeNums.length - 1];
            } else if (beforeNums.length === 1) {
              rate = beforeNums[0];
            }
            found = true;
            break;
          }
        }
      }
    }

    if (!found) {
      taxable = 0;
      const secondLast = nums[nums.length - 2];
      if (secondLast > 0) {
        taxable = secondLast;
        gstAmount = total - taxable;
        if (gstAmount < 0) gstAmount = 0;
      }
      const beforeNums = nums.slice(0, nums.length - 2);
      if (beforeNums.length >= 2) {
        qty = beforeNums[0];
        rate = beforeNums[beforeNums.length - 1];
      } else if (beforeNums.length === 1) {
        rate = beforeNums[0];
      }
    }
  } else if (nums.length === 2) {
    qty = nums[0];
    total = nums[1];
    rate = total / (qty || 1);
    taxable = total;
  }

  if (taxable > 0 && !gstAmount && total > 0) {
    gstAmount = total - taxable;
    if (gstAmount < 0) gstAmount = 0;
  }
  if (taxable > 0 && gstAmount > 0 && !gstRate) {
    gstRate = Math.round((gstAmount / taxable) * 1000) / 10;
  }

  const cgst = gstAmount / 2;
  const sgst = gstAmount / 2;

  return {
    sno, description, hsn, quantity: qty, freeQty: 0, unit: 'PCS',
    mrp: rate, rate, discount: 0, taxable, gstRate, cgst, sgst,
    gst: cgst + sgst, total,
  };
}

function finalizeItems(items: CsvItem[]): CsvItem[] {
  for (const item of items) {
    if (!item.gst) item.gst = item.cgst + item.sgst;
    if (item.taxable > 0 && item.gst > 0) {
      item.gstRate = Math.round((item.gst / item.taxable) * 100 * 10) / 10;
    } else if (item.gst > 0 && !item.taxable && item.total > 0) {
      item.taxable = item.total - item.gst;
    }
    if (!item.rate && item.mrp) item.rate = item.mrp;
    if (!item.total && item.taxable > 0) {
      item.total = item.taxable + item.gst;
    }
  }
  return items;
}

function parseInvoiceLines(text: string): CsvItem[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const items: CsvItem[] = [];

  for (const line of lines) {
    if (line.startsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c && !/^-+$/.test(c));
      if (cells.length < 3) continue;
      const snoStr = cells[0].replace(/^#\s*/, '').trim();
      const sno = parseInt(snoStr, 10);
      if (!sno || sno > 1000) continue;
      const hsn = cells[2] || '';
      const nums = cells.slice(3).map(c => num(c.replace(/,/g, '')));
      if (nums.length < 3) continue;
      const qty = nums[0] || 0;
      const mrp = nums[1] || 0;
      const cases = nums[2] || 0;
      const taxable = nums[3] || 0;
      const gstAmt = nums[4] || 0;
      const total = nums[5] || 0;
      const description = cells[1] || '';
      items.push({ sno, description, hsn, quantity: qty, freeQty: 0, unit: 'PCS', mrp, rate: mrp || qty, discount: 0, taxable, gstRate: taxable > 0 ? Math.round((gstAmt / taxable) * 100 * 10) / 10 : 0, cgst: gstAmt / 2, sgst: gstAmt / 2, gst: gstAmt, total });
      continue;
    }

    const leadMatch = line.match(/^(\d{1,3})\s+([A-Z]{1,2}\d{1,12,20}[A-Z]?)\s+(.+)/);
    if (leadMatch) {
      const sno = parseInt(leadMatch[1], 10);
      const rest = leadMatch[3];
      let description = '';
      const numericTokens: string[] = [];
      let foundFirstNum = false;
      let hsn = '';
      let startIdx = 0;

      const hsnMatch = rest.match(/(?:^|\s)(\d{4,8})(?=\s|$)/);
      if (hsnMatch && hsnMatch.index !== undefined) {
        const hsnStart = hsnMatch.index + (hsnMatch[0].length - hsnMatch[1].length);
        hsn = hsnMatch[1];
        description = clean(rest.slice(0, hsnStart));
        numericTokens.push(hsn);
        const numericColumns = rest.slice(hsnStart + hsn.length).replace(/\([^)]*\)/g, '');
        numericTokens.push(...(numericColumns.match(/-?[\d,]+(?:\.\d+)?/g) || []));
        startIdx = 1;
      }

      if (!hsn) {
        for (const tok of rest.split(/\s+/)) {
          if (!foundFirstNum && /^[A-Za-z]/.test(tok)) {
            description += (description ? ' ' : '') + tok;
          } else {
            foundFirstNum = true;
            if (/^-?[\d,]+\.?\d*$/.test(tok)) {
              numericTokens.push(tok);
            }
          }
        }
      }

      const n = numericTokens.map(t => num(t));
      const front = n.slice(startIdx);
      const rajshreeFormat = startIdx === 1 && front.length >= 11;
      const qtyVal = rajshreeFormat ? front[3] : front[0] || 0;
      const mrpVal = rajshreeFormat ? front[0] : (front.length > 2 ? front[2] : 0);
      let rateVal = rajshreeFormat ? front[4] : (front.length > 3 ? front[3] : 0);
      const discVal = rajshreeFormat ? front[6] : (front.length > 4 ? front[4] : 0);
      const taxableVal = rajshreeFormat ? front[7] : (n.length > 3 ? n[n.length - 4] : 0);
      const gstRateVal = rajshreeFormat ? front[8] : 0;
      const gstVal = rajshreeFormat ? front[9] : (n.length > 2 ? n[n.length - 3] + n[n.length - 2] : 0);
      const totalVal = rajshreeFormat ? front[10] : (n.length > 0 ? n[n.length - 1] : 0);
      const cgstVal = rajshreeFormat ? gstVal / 2 : gstVal / 2;
      const sgstVal = cgstVal;

      if (!rateVal && mrpVal > 0) rateVal = mrpVal;

      items.push({
        sno, description: clean(description), hsn, quantity: qtyVal, freeQty: 0, unit: 'PCS',
        mrp: mrpVal, rate: rateVal || mrpVal, discount: discVal, taxable: taxableVal,
        gstRate: gstRateVal || (taxableVal > 0 && gstVal > 0 ? Math.round((gstVal / taxableVal) * 1000) / 10 : 0),
        cgst: cgstVal, sgst: sgstVal, gst: cgstVal + sgstVal, total: totalVal,
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
          const n = allNums.length;
          const total = allNums[n - 1] || 0;

          let qty = allNums[0] || 0;
          let rate = allNums[1] || 0;
          let taxable = 0;
          let gst = 0;
          let gstRate = 0;

          if (n >= 5) {
            let found = false;
            for (let offset = 1; offset <= Math.min(3, n - 3); offset++) {
              const g = allNums[n - 1 - offset];
              const tx = allNums[n - 2 - offset];
              if (tx > 0 && g > 0 && Math.abs(tx + g - total) < total * 0.15) {
                taxable = tx;
                gst = g;
                const beforeNums = allNums.slice(0, n - 2 - offset);
                if (beforeNums.length >= 1) rate = beforeNums[beforeNums.length - 1];
                if (beforeNums.length >= 2) qty = beforeNums[0];
                found = true;
                break;
              }
            }
            if (!found) {
              taxable = allNums[n - 2] || 0;
              gst = total - taxable;
              if (gst < 0) gst = 0;
            }
          } else if (n === 4) {
            taxable = allNums[2];
            gst = total - taxable;
            if (gst < 0) {
              taxable = total;
              gst = 0;
            }
          } else if (n === 3) {
            taxable = qty * rate;
            gst = total - taxable;
            if (gst < 0) {
              taxable = total;
              gst = 0;
            }
          }

          if (taxable > 0 && gst > 0 && !gstRate) {
            gstRate = Math.round((gst / taxable) * 1000) / 10;
          }

          items.push({
            sno, description, hsn: '', quantity: qty, freeQty: 0, unit: 'PCS',
            mrp: rate, rate, discount: 0, taxable, gstRate,
            cgst: gst / 2, sgst: gst / 2, gst, total,
          });
        }
      }
    }
  }

  return finalizeItems(items);
}

function parseItemsFromText(text: string): CsvItem[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const items: CsvItem[] = [];

  // ── Step 1: Try structured formats (CSV, TSV, pipe, copy-paste) ──
  const delimiter = detectDelimiter(lines[0] || '');
  if (delimiter && lines.length >= 2) {
    const headerInfo = tryDetectHeader(lines, delimiter);
    let dataLines = lines;
    let colMap: Record<string, number> | null = null;

    if (headerInfo && Object.keys(headerInfo.colMap).length >= 2) {
      colMap = headerInfo.colMap;
      if (headerInfo.isHeader) {
        dataLines = lines.slice(1);
      }
    }

    for (const line of dataLines) {
      if (isSeparatorRow(line, delimiter)) continue;
      const cells = splitByDelimiter(line, delimiter);
      if (cells.length < 3) continue;
      const maxColIdx = colMap ? Math.max(...Object.values(colMap)) : -1;
      const useMap = colMap && maxColIdx < cells.length;
      const item = useMap
        ? parseRowByMap(cells, colMap!)
        : parseRowPositional(cells);
      if (item) items.push(item);
    }

    if (items.length > 0) {
      return finalizeItems(items);
    }
  }

  // ── Step 2: Fallback to line-by-line invoice parsing ──
  return parseInvoiceLines(text);
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

export async function csvToCopyPaste(buffer: Buffer): Promise<string> {
  return excelToCopyPaste(buffer);
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
