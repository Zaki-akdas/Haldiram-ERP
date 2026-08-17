import zlib from 'zlib';
import PDFParser from 'pdf2json';
import * as XLSX from 'xlsx';

interface PDFParseModule {
  PDFParse?: new (opts: { data: Buffer }) => {
    load(): Promise<void>;
    getText(): Promise<{ text: string }>;
  };
  default?: (buffer: Buffer) => Promise<{ text: string }>;
  (buffer: Buffer): Promise<{ text: string }>;
}

export async function convertPDFToText(buffer: Buffer): Promise<string> {
  let text = '';

  // Stage 1: Try pdf2json
  try {
    text = await new Promise<string>((resolve) => {
      const pdfParser = new PDFParser(null, true); // verbose mode
      pdfParser.on("pdfParser_dataError", () => resolve(''));
      pdfParser.on("pdfParser_dataReady", () => {
        try {
          const raw = pdfParser.getRawTextContent();
          resolve(raw || '');
        } catch {
          resolve('');
        }
      });
      pdfParser.parseBuffer(buffer);
    });
  } catch {
    text = '';
  }

  // Stage 2: Try pdf-parse if stage 1 was empty
  if (!text || text.trim().length === 0) {
    try {
      const pdfModule = (await import('pdf-parse')) as unknown as PDFParseModule;
      if (pdfModule.PDFParse) {
        const parser = new pdfModule.PDFParse({ data: buffer });
        await parser.load();
        const textData = await parser.getText();
        text = textData.text || '';
      } else {
        const fn = typeof pdfModule.default === 'function' ? pdfModule.default : (typeof pdfModule === 'function' ? pdfModule : null);
        if (fn) {
          const data = await fn(buffer);
          text = data.text || '';
        }
      }
    } catch {
      text = '';
    }
  }

  // Stage 3: Decompress Flate / PDF stream content if stage 1 & 2 failed
  if (!text || text.trim().length === 0 || text.includes('%PDF-')) {
    text = extractStreamTextFromPdfBuffer(buffer);
  } else {
    // pdf.js-based extractors truncate long text tokens at 128 chars, which silently
    // cuts real invoice lines mid-number, and append a "-- N of M --" page marker per
    // page that inflates their length. If raw stream extraction yields more real
    // content, prefer it so long distribution lines survive.
    const rawText = extractStreamTextFromPdfBuffer(buffer);
    const pdfTextWithoutMarkers = text.replace(/--\s*\d+\s+of\s+\d+\s*--/g, '').trim();
    if (rawText && rawText.length >= pdfTextWithoutMarkers.length) {
      text = rawText;
    }
  }

  // Stage 4: Sanitize to ensure no raw %PDF-1.7 bytecode is ever returned
  return sanitizeExtractedText(text);
}

function extractStreamTextFromPdfBuffer(buffer: Buffer): string {
  const raw = buffer.toString('binary');
  const textParts: string[] = [];

  // Match Tj / TJ text operators in uncompressed PDF streams. PDF string literals may
  // contain escaped parens (\( \)), so allow backslash-escaped sequences and don't
  // cap the length (pdf.js truncates long tokens; this fallback must not).
  const textOpRegex = /\(((?:\\.|[^\\()])*)\)\s*(?:Tj|TJ|'|")/g;

  const directText = Array.from(raw.matchAll(textOpRegex)).map(m => decodePdfString(m[1]));
  if (directText.length > 0) {
    textParts.push(...directText);
  }

  // Decompress zlib streams
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(raw)) !== null) {
    try {
      const streamBuf = Buffer.from(match[1], 'binary');
      const decompressed = zlib.inflateSync(streamBuf).toString('utf-8');
      const streamText = Array.from(decompressed.matchAll(textOpRegex)).map(m => decodePdfString(m[1]));
      if (streamText.length > 0) {
        textParts.push(...streamText);
      }
    } catch {
      // Ignore uncompressed / non-zlib streams
    }
  }

  return textParts.join('\n');
}

function decodePdfString(str: string): string {
  // Unescape PDF string literal escapes: \( \) \n \r \t and octal \ooo.
  // Implemented with char codes to keep the source readable (no regex escaping).
  const BS = 92; // backslash
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c !== BS) { out += str[i]; continue; }
    const n = str.charCodeAt(i + 1);
    if (n === 40) { out += '('; i++; }
    else if (n === 41) { out += ')'; i++; }
    else if (n === 110) { out += String.fromCharCode(10); i++; }
    else if (n === 114) { out += String.fromCharCode(13); i++; }
    else if (n === 116) { out += String.fromCharCode(9); i++; }
    else if (n >= 48 && n <= 55) {
      let oct = String.fromCharCode(n);
      let j = i + 2;
      while (j < str.length && oct.length < 3 && str.charCodeAt(j) >= 48 && str.charCodeAt(j) <= 55) {
        oct += str[j];
        j++;
      }
      out += String.fromCharCode(parseInt(oct, 8));
      i = j - 1;
    } else {
      out += String.fromCharCode(BS);
    }
  }
  return out;
}

function sanitizeExtractedText(text: string): string {
  if (!text) return '';

  // If text contains PDF header or object tags, clean them out
  let cleaned = text
    .replace(/%PDF-[\d.]+/g, '')
    .replace(/<<[\s\S]*?>>/g, '')
    .replace(/\d+\s+\d+\s+obj/g, '')
    .replace(/endobj/g, '')
    .replace(/stream[\s\S]*?endstream/g, '')
    .replace(/xref[\s\S]*?trailer/g, '')
    .replace(/startxref[\s\S]*?%%EOF/g, '')
    .replace(/[^\x20-\x7E\r\n\t]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  // URL decode if URL encoded
  if (cleaned.includes('%20') || cleaned.includes('%0A')) {
    try {
      cleaned = decodeURIComponent(cleaned);
    } catch {
      // ignore decode error
    }
  }

  return cleaned;
}

export function convertExcelToCSV(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheet = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet]);
}

export function convertCSVToJSON(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
}

export function detectFileType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  const types: Record<string, string> = {
    pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel', csv: 'text/csv',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  };
  return types[ext] || 'application/octet-stream';
}
