import { getSupabaseAdmin } from '@/db';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import fs from 'fs';

if (typeof DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    constructor() {}
  };
}

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
    throw new Error(`Text extraction failed for .pdf: ${message}`);
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* best effort cleanup */ }
  }
}
export const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
export const OLLAMA_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT || '60000', 10);

const SYSTEM_PROMPT = `You are an expert invoice data extractor for Indian tax invoices. Extract structured data from invoice/bill/document text and return ONLY valid JSON.
 
Output schema:
{
  "seller": { "name": "", "address": "", "gstin": "", "pan": "", "fssai": "", "phone": "", "email": "" },
  "buyer": { "name": "", "address": "", "phone": "", "gstin": "", "fssai": "" },
  "invoice": { "number": "", "date": "", "salesman": "", "beat": "", "employeeContact": "" },
  "items": [
    {
      "sno": 0, "erpId": "", "description": "", "hsn": "",
      "quantity": 0, "freeQty": 0, "unit": "PCS", "mrp": 0, "rate": 0,
      "discount": 0, "taxable": 0, "gstRate": 0, "cgst": 0, "sgst": 0,
      "gst": 0, "total": 0
    }
  ],
  "totals": {
    "totalQty": 0, "subtotal": 0, "discount": 0, "taxableAmount": 0,
    "cgst": 0, "sgst": 0, "igst": 0, "totalGst": 0, "grandTotal": 0,
    "roundOff": 0, "amountInWords": "",
    "bankName": "", "bankAccountNumber": "", "bankIfscCode": "",
    "vehicleNumber": "", "additionalTerms": ""
  }
}

Rules:
- Return ONLY the JSON object. No markdown fences, no explanations.
- If a field is missing, use "" for strings, 0 for numbers, [] for arrays.
- "gst" = cgst + sgst + igst for each item.
- "total" = taxable + gst for each item.
- Extract ALL line items from item tables.
- For totals, prefer explicit "Grand Total" / "Total Amount" / "Balance Due" labels.
- Date format: keep as found.
- Phone numbers: extract 10-digit Indian numbers starting with 6-9.
- GSTIN: 15 character alphanumeric like 23AFOFS4394E1ZP.
- PAN: 10 character like AFOFS4394E.
- Product names: extract FULL product names including sizes like "BANSAL OIL 750", "MAIDA 30 KG", etc. Do NOT truncate at numbers.
- Bank details: extract Bank Name, Bank Account Number, and IFSC Code if present in the invoice.
- Vehicle Number: extract the vehicle/truck number used for transport if present.
- Additional Terms: extract any "Additional Information", "Terms & Conditions", or "Payment Terms" text if present.`;

export async function callOllama(text: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT);

  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: `${SYSTEM_PROMPT}\n\nExtract data from this document text:\n\n${text}`,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 4096,
          stop: ['\n\n\n', '```'],
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const raw = data.response || '';

    let jsonStr = raw.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in model response');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export function normalizeExtraction(raw: any): any {
  const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Number(String(value ?? '').replace(/[₹,\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const seller = {
    name: String(raw?.seller?.name || '').trim(),
    address: String(raw?.seller?.address || '').trim(),
    gstin: String(raw?.seller?.gstin || '').trim(),
    pan: String(raw?.seller?.pan || '').trim(),
    fssai: String(raw?.seller?.fssai || '').trim(),
    phone: String(raw?.seller?.phone || '').trim(),
  };
  const buyer = {
    name: String(raw?.buyer?.name || '').trim(),
    address: String(raw?.buyer?.address || '').trim(),
    phone: String(raw?.buyer?.phone || '').trim(),
    gstin: String(raw?.buyer?.gstin || '').trim(),
  };
  const invoice = {
    number: String(raw?.invoice?.number || '').trim(),
    date: String(raw?.invoice?.date || '').trim(),
    salesman: String(raw?.invoice?.salesman || '').trim(),
    beat: String(raw?.invoice?.beat || '').trim(),
    employeeContact: String(raw?.invoice?.employeeContact || '').trim(),
  };

  const items = Array.isArray(raw?.items)
    ? raw.items.map((it: any) => ({
        sno: toNumber(it.sno),
        erpId: String(it.erpId || '').trim(),
        description: String(it.description || '').trim(),
        hsn: String(it.hsn || '').trim(),
        quantity: toNumber(it.quantity),
        freeQty: toNumber(it.freeQty),
        unit: String(it.unit || 'PCS').trim(),
        mrp: toNumber(it.mrp),
        rate: toNumber(it.rate),
        discount: toNumber(it.discount),
        taxable: toNumber(it.taxable),
        gstRate: toNumber(it.gstRate),
        cgst: toNumber(it.cgst),
        sgst: toNumber(it.sgst),
        gst: toNumber(it.gst),
        total: toNumber(it.total),
      }))
    : [];

  const totals = {
    totalQty: toNumber(raw?.totals?.totalQty),
    subtotal: toNumber(raw?.totals?.subtotal),
    discount: toNumber(raw?.totals?.discount),
    taxableAmount: toNumber(raw?.totals?.taxableAmount),
    cgst: toNumber(raw?.totals?.cgst),
    sgst: toNumber(raw?.totals?.sgst),
    igst: toNumber(raw?.totals?.igst),
    totalGst: toNumber(raw?.totals?.totalGst),
    grandTotal: toNumber(raw?.totals?.grandTotal),
    roundOff: toNumber(raw?.totals?.roundOff),
    amountInWords: String(raw?.totals?.amountInWords || '').trim(),
    bankName: String(raw?.totals?.bankName || '').trim(),
    bankAccountNumber: String(raw?.totals?.bankAccountNumber || '').trim(),
    bankIfscCode: String(raw?.totals?.bankIfscCode || '').trim(),
    vehicleNumber: String(raw?.totals?.vehicleNumber || '').trim(),
    additionalTerms: String(raw?.totals?.additionalTerms || '').trim(),
  };

  return {
    seller,
    buyer,
    invoice,
    items,
    totals,
    metadata: {
      fileType: 'ai-ollama',
      extractionConfidence: items.length > 0 ? 90 : 40,
      extractedAt: new Date().toISOString(),
      rawTextLength: 0,
    },
  };
}

export function computeConfidence(data: any): number {
  let score = 0;
  if (data.seller.gstin) score += 12;
  if (data.seller.pan) score += 5;
  if (data.seller.name) score += 8;
  if (data.seller.phone) score += 3;
  if (data.seller.fssai) score += 2;
  if (data.buyer.name) score += 10;
  if (data.buyer.phone) score += 3;
  if (data.invoice.number) score += 12;
  if (data.invoice.date) score += 8;
  if (data.invoice.salesman) score += 5;
  if (data.items.length > 0) score += 10;
  if (data.items.length > 3) score += 5;
  if (data.totals.grandTotal > 0) score += 10;
  if (data.totals.taxableAmount > 0) score += 5;
  return Math.min(score, 100);
}

export async function extractTextFromFile(buffer: Buffer, ext: string): Promise<string> {
  try {
    if (ext === 'pdf') {
      return await extractPdfText(buffer);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const XLSX = require('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (sheetName) {
        const sheet = workbook.Sheets[sheetName];
        return XLSX.utils.sheet_to_csv(sheet);
      }
      return '';
    } else {
      return buffer.toString('utf-8');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Text extraction failed:', ext, message);
    throw new Error(`Text extraction failed for .${ext}: ${message}`);
  }
}
