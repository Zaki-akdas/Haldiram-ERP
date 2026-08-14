#!/usr/bin/env node
import { readFileSync } from 'fs';
import pdf from 'pdf-parse/lib/pdf-parse.js';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/pdf-extract.mjs <pdf-path>');
  process.exit(1);
}

try {
  const buffer = readFileSync(filePath);
  const data = await pdf(buffer);
  console.log(data.text);
} catch (error) {
  console.error(`PDF_EXTRACT_ERROR: ${error.message}`);
  process.exit(1);
}
