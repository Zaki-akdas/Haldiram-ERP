import { PDFParse } from 'pdf-parse';
import fs from 'fs';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node pdf-extract.mjs <pdf-file-path>');
  process.exit(1);
}

try {
  const buf = fs.readFileSync(inputPath);
  const parser = new PDFParse(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
  const result = await parser.getText();
  console.log(result.text || '');
} catch (err) {
  console.error('PDF_EXTRACT_ERROR:', err instanceof Error ? err.message : String(err));
  process.exit(1);
}
