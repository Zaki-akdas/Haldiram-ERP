import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUniversalData } from '@/lib/universal-extractor';
import { normalizeExtraction, computeConfidence } from '@/lib/ai-extract';
import type { ExtractionResult } from '@/lib/ai-provider';

test('parseUniversalData parses TSV paste with the app-generated header', () => {
  const tsv = [
    'Invoice No: INV-1001',
    'Date: 01/02/2026',
    '',
    'S No\tERP ID\tProduct Name\tHSN Code\tMRP\tQuantity\tUnit Price\tTaxable Amount\tGST Rate %\tGST Amount\tTotal Amount',
    '1\tP001\tCola 500ml\t220210\t40\t10\t30\t300\t18\t54\t354',
    '2\tP002\tWater 1L\t220110\t25\t5\t20\t100\t12\t12\t112',
  ].join('\n');

  const result = parseUniversalData(tsv);

  assert.equal(result.detectedFormat, 'TSV (Excel Paste)');
  assert.equal(result.invoiceNumber, 'INV-1001');
  assert.equal(result.invoiceDate, '01/02/2026');
  assert.equal(result.items.length, 2);

  const [first, second] = result.items;
  assert.equal(first.erpId, 'P001');
  assert.equal(first.hsnCode, '220210');
  assert.equal(first.productName, 'Cola 500ml');
  assert.equal(first.quantity, 10);
  assert.equal(first.unitPrice, 30);
  assert.equal(first.taxableAmount, 300);
  assert.equal(first.gstRate, 18);
  assert.equal(first.gstAmount, 54);
  assert.equal(first.totalAmount, 354);

  assert.equal(second.erpId, 'P002');
  assert.equal(second.unitPrice, 20);
  assert.equal(second.totalAmount, 112);

  assert.equal(result.subtotal, 400);
  assert.equal(result.taxableAmount, 400);
  assert.equal(result.grandTotal, 466);
  assert.equal(result.cgst, 33); // 66 / 2
  assert.equal(result.sgst, 33);
});

test('parseUniversalData parses CSV files', () => {
  const csv = [
    'S No,ERP ID,Product Name,HSN Code,MRP,Quantity,Unit Price,Taxable Amount,GST Rate %,GST Amount,Total Amount',
    '1,P101,Chips 90g,210690,20,3,15,45,18,8.1,53.1',
  ].join('\n');

  const result = parseUniversalData(csv);

  assert.equal(result.detectedFormat, 'CSV');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].productName, 'Chips 90g');
  assert.equal(result.items[0].unitPrice, 15);
  assert.equal(result.items[0].totalAmount, 53.1);
  assert.equal(result.grandTotal, 53.1);
});

test('normalizeExtraction maps field aliases and parses numbers from strings', () => {
  const normalized = normalizeExtraction({
    invoice_no: 'INV-9',
    date: '15/03/2026',
    customer_name: 'Sharma Traders',
    items: [
      { item: 'Biscuit 100g', qty: '4', rate: '25.50', total_amount: '102' },
    ],
    grand_total: '₹102.00',
  });

  assert.equal(normalized.invoiceNumber, 'INV-9');
  assert.equal(normalized.invoiceDate, '15/03/2026');
  assert.equal(normalized.customerName, 'Sharma Traders');
  assert.ok(normalized.items);
  assert.equal(normalized.items.length, 1);
  assert.equal(normalized.items[0].productName, 'Biscuit 100g');
  assert.equal(normalized.items[0].quantity, 4);
  assert.equal(normalized.items[0].unitPrice, 25.5);
  assert.equal(normalized.items[0].totalAmount, 102);
  assert.equal(normalized.grandTotal, 102);
});

test('normalizeExtraction defaults unknown products and zero quantities', () => {
  const normalized = normalizeExtraction({ items: [{ unitPrice: 'x' }] });
  assert.ok(normalized.items);
  assert.equal(normalized.items[0].productName, 'Unknown Product');
  assert.equal(normalized.items[0].quantity, 0);
  assert.equal(normalized.items[0].srNo, 1);
});

test('computeConfidence rewards complete extractions and caps at 100', () => {
  const complete: ExtractionResult = {
    invoiceNumber: 'INV-1',
    invoiceDate: '01/01/2026',
    customerName: 'A',
    items: [
      { productName: 'P1', quantity: 1, unitPrice: 10, totalAmount: 10 },
      { productName: 'P2', quantity: 1, unitPrice: 10, totalAmount: 10 },
    ],
    grandTotal: 20,
    cgst: 1,
    sgst: 1,
    confidence: 0,
    provider: 'test',
  };
  assert.equal(computeConfidence(complete), 90); // 15+10+10+20+10+15+10

  const sparse: ExtractionResult = {
    items: [],
    confidence: 0,
    provider: 'test',
  };
  assert.equal(computeConfidence(sparse), 0);
});
