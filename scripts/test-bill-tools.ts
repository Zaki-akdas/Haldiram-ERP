/**
 * Comprehensive test harness for the bill converter & extractor features.
 * Drives the REAL modules (not regex copies) against every supported format.
 * Run: npx tsx scripts/test-bill-tools.ts
 */
import { parseUniversalData } from '@/lib/universal-extractor';
import { extractBillFromText } from '@/lib/bill-extractor';
import { parseCSV } from '@/lib/ingestion/parsers/csv';
import { parseUnstructuredText } from '@/lib/ingestion/parsers/text';
import { parseJSON } from '@/lib/ingestion/parsers/json';
import { parseExcel } from '@/lib/ingestion/parsers/excel';
import { parsePDF } from '@/lib/ingestion/parsers/pdf';
import { convertPDFToText } from '@/lib/converters';
import { validateIngestionResult } from '@/lib/ingestion/validator';
import { ingestData } from '@/lib/ingestion/engine';
import * as XLSX from 'xlsx';

let pass = 0, fail = 0, crash = 0;

function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`); }
}

function safe(fn: () => any, label: string) {
  try { return fn(); }
  catch (e) { crash++; console.log(`  💥 CRASH in ${label}: ${(e as Error).message}`); return null; }
}

const MARKDOWN_INVOICE = `**INVOICE DETAILS**

* **Bill Number:** RS/26-27/1572

* **Date:** 22 Jul 2026, 10:35 am

* **Seller:** RAJSHREE SNACKS AND FOODS PRIVATE LIMITED (Bhopal, MP)

* **Buyer:** PRO SWAMI / SHARNAM ENTERPRISES (Bhopal, MP)

---

**ITEMS PURCHASED**

**1. Chana Jor Garam MRP 10/50 GM 9 KG NGP**

* Quantity: 180 | MRP: ₹10.00 | Total Value: ₹1,451.38

**2. Chips Cream N Onion MRP 20/55 GM 3.96 KG**

* Quantity: 72 | MRP: ₹20.00 | Total Value: ₹1,018.90

**3. Cream Cone Vanilla 30 GM * 0.96 KG**

* Quantity: 32 | MRP: ₹10.00 | Total Value: ₹262.51

**4. Gulab Jamun 500 GM 16 KG NGP**

* Quantity: 32 | MRP: ₹125.00 | Total Value: ₹3,225.28

**5. Instant Bhel 400 GM  8 KG**

* Quantity: 20 | MRP: ₹95.00 | Total Value: ₹1,532.02

**6. Instant Bhel MRP 10/41 GM 8.364 KG**

* Quantity: 816 | MRP: ₹10.00 | Total Value: ₹6,579.63

**7. Khari Boondi 200 Gm 4.8Kg**

* Quantity: 24 | MRP: ₹55.00 | Total Value: ₹1,064.34

**8. Masala Peanut MRP 10/34 GM * 10.2 KG (NGP)**

* Quantity: 300 | MRP: ₹10.00 | Total Value: ₹2,418.94

**9. Masala Sev Murmura MRP 5 24G * 4.608 (NGP)**

* Quantity: 1920 | MRP: ₹5.00 | Total Value: ₹7,697.89

**10. Mini Bhakharwadi MRP 10/35 GM 8.4 KG**

* Quantity: 240 | MRP: ₹10.00 | Total Value: ₹1,935.17

**11. Mini Punjabi Papad MRP 10 24G * 3.456 KG**

* Quantity: 144 | MRP: ₹10.00 | Total Value: ₹1,161.10

**12. Mini Samosa 200 GM * 4.0 KG (NGP)**

* Quantity: 20 | MRP: ₹70.00 | Total Value: ₹1,128.86

**13. Panchrattan MRP 10/23 GM 6.9 KG**

* Quantity: 2700 | MRP: ₹10.00 | Total Value: ₹21,770.81

**14. Papdi Gathiya MRP 10/40 GM * 5.76 KG**

* Quantity: 288 | MRP: ₹10.00 | Total Value: ₹2,322.22

**15. Rasgulla 500 GM * 16 KG NGP**

* Quantity: 64 | MRP: ₹125.00 | Total Value: ₹6,450.58

**16. Salted Peanut 200 GM 4.80 KG (NGP)**

* Quantity: 96 | MRP: ₹60.00 | Total Value: ₹4,644.42

**17. Soan Papdi Regular 250 GM 18 KG NGP**

* Quantity: 72 | MRP: ₹75.00 | Total Value: ₹4,354.14

**18. Woka Instant Noodles MRP 5/25 GM 6.0 KG**

* Quantity: 480 | MRP: ₹5.00 | Total Value: ₹1,924.68

**19. Woka Instant Noodles MRP10 55 GM 7.92 KG**

* Quantity: 288 | MRP: ₹10.00 | Total Value: ₹2,309.58

---

**BILLING SUMMARY**

* **Total Items:** 46 Cases (Total Qty: 7,788)

* **Taxable Value:** ₹69,764.21

* **Total GST (5% on all items):** ₹3,488.24 (CGST: ₹1,744.12 + SGST: ₹1,744.12)

* **Grand Total:** ₹73,252.00

* **Total in Words:** Seventy-Three Thousand Two Hundred Fifty-Two Rupees`;

const CONCAT_INVOICE = `Seller Firm Name: RAJSHREE SNACKS AND FOODS PRIVATE LIMITED
GSTIN: 23AAPCR5371M1ZT
Invoice/Bill Number: RS/26-27/1577
Bill/Invoice Date: 22 Jul 2026

Billed To: PRO SWAMI SHARNAM ENTERPRISES
GSTIN: 23AMFPV5397L1ZB

1 FD012600160691200D All In One MRP 5|16 GM*6.912 KG (NGP) 21069099 5.00 432 5 2160 4.0475 1,649.5488 0.00 (0) 8,247.74 5 412.38 8,660.12
2 FD092104001240001D Aloo Bhujia 400 GM*12.40 KG 21069099 109.00 31 2 62 88.7261 2,594.8209 0.00 (0) 5,189.64 5 259.48 5,449.12

Total Value: 2,73,345.00`;

const TSV_SAMPLE = `Item Code\tItem Name\tHSN\tMRP\tQty\tRate\tTaxable\tGST %\tTotal
FD0126001\tAll In One 16GM\t21069099\t5.00\t2160\t4.0475\t8247.74\t5\t8660.12
FD0921040\tAloo Bhujia 400GM\t21069099\t109.00\t62\t88.7261\t5189.64\t5\t5449.12
FD0180003\tBoondi MRP 10\t21069099\t10.00\t432\t8.1400\t3317.41\t5\t3483.29`;

const CSV_SAMPLE = `S No,Item ERP Id,Item Name,HSN Code,MRP,Qty,Unit Price,Taxable Value,GST %,GST Amt,Total Value
1,FD0126001,All In One 16GM,21069099,5.00,2160,4.0475,8247.74,5,412.38,8660.12
2,FD0921040,Aloo Bhujia 400GM,21069099,109.00,62,88.7261,5189.64,5,259.48,5449.12`;

const PSV_SAMPLE = `S No|Item ERP Id|Item Name|HSN|Qty|Rate|Taxable|GST %|Total
1|FD0126001|All In One 16GM|21069099|2160|4.0475|8247.74|5|8660.12
2|FD0921040|Aloo Bhujia 400GM|21069099|62|88.7261|5189.64|5|5449.12`;

const JSON_FLAT = JSON.stringify({
  invoiceNumber: 'RS/26-27/1572',
  invoiceDate: '22/07/2026',
  customerName: 'PRO SWAMI (SHARNAM ENTERPRISES)',
  customerGSTIN: '23AMFPV5397L1ZB',
  taxableAmount: 69764.21,
  totalGst: 3488.24,
  grandTotal: 73252.00,
  items: [
    { srNo: 1, productName: 'Chana Jor Garam', hsnCode: '21069099', quantity: 180, unitPrice: 10, taxableAmount: 1382.26, gstRate: 5, gstAmount: 69.12, totalAmount: 1451.38 },
    { srNo: 2, productName: 'Chips Cream N Onion', hsnCode: '20052000', quantity: 72, unitPrice: 20, taxableAmount: 970.38, gstRate: 5, gstAmount: 48.52, totalAmount: 1018.90 },
  ],
});

const JSON_NESTED = JSON.stringify({
  invoice: { invoice_number: 'RS/26-27/1572', bill_date: '2026-07-22T10:35:00+05:30', sales_order_number: 'SO/41103/1683' },
  seller: { firm_name: 'RAJSHREE SNACKS AND FOODS PRIVATE LIMITED', gstin: '23AAPCR5371M1ZT' },
  buyer: { firm_name: 'PRO SWAMI (SHARNAM ENTERPRISES)', gstin: '23AMFPV5397L1ZB' },
  items: [
    { sno: 1, erp_id: 'FD020400500900000D', item_name: 'Chana Jor Garam MRP 10/50 GM 9 KG NGP', hsn: 21069099, mrp: 10.00, taxable_value: 1382.26, gst_percent: 5, gst_amount: 69.12, total_value: 1451.38 },
    { sno: 2, erp_id: 'FI001800550396001D', item_name: 'Chips Cream N Onion MRP 20/55 GM 3.96 KG', hsn: 20052000, mrp: 20.00, taxable_value: 970.38, gst_percent: 5, gst_amount: 48.52, total_value: 1018.90 },
  ],
  summary: { gross_amount: 2352.64, taxable_value: 2352.64, cgst_amount: 58.82, sgst_amount: 58.82, gst_amount: 117.64, total_value: 2470.28 },
});

const BULLET_SAMPLE = `**1. Chana Jor Garam MRP 10/50 GM 9 KG NGP**
* Quantity: 180 | MRP: ₹10.00 | Total Value: ₹1,451.38

**2. Chips Cream N Onion MRP 20/55 GM 3.96 KG**
* Quantity: 72 | MRP: ₹20.00 | Total Value: ₹1,018.90

**3. Cream Cone Vanilla 30 GM * 0.96 KG**
* Quantity: 32 | MRP: ₹10.00 | Total Value: ₹262.51`;

const GARBAGE = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. 12345 not an invoice.';

function summarize(label: string, r: any) {
  if (!r) return;
  const items = r.items || [];
  const sum = items.reduce((s: number, i: any) => s + Number(i.totalAmount || 0), 0);
  console.log(`    [${label}] fmt=${r.format || r.detectedFormat} items=${items.length} conf=${r.confidence} inv=${r.header?.invoiceNumber || r.invoiceNumber || '-'} grand=${r.header?.grandTotal ?? r.grandTotal ?? '-'} sumItems=${sum.toFixed(2)} warnings=${(r.warnings || []).length}`);
  if (items.length > 0 && items.length <= 3) {
    items.forEach((i: any) => console.log(`      -> ${i.srNo || '?'}. ${i.productName} qty=${i.quantity} rate=${i.unitPrice} taxable=${i.taxableAmount} gst=${i.gstAmount} total=${i.totalAmount}`));
  }
}

async function main() {
  console.log('🧪 BILL CONVERTER / EXTRACTOR — FORMAT BATTTERY\n');

  const cases: [string, string][] = [
    ['MARKDOWN (RS/26-27/1572)', MARKDOWN_INVOICE],
    ['CONCATENATED RAW (RS/26-27/1577)', CONCAT_INVOICE],
    ['TSV', TSV_SAMPLE],
    ['CSV', CSV_SAMPLE],
    ['PSV', PSV_SAMPLE],
    ['BULLET LIST', BULLET_SAMPLE],
    ['GARBAGE', GARBAGE],
    ['EMPTY', ''],
  ];

  for (const [label, text] of cases) {
    console.log(`\n▶ ${label}`);

    const uni = safe(() => parseUniversalData(text), `${label} parseUniversalData`);
    if (uni) summarize('universal-extractor', uni);

    const bill = safe(() => extractBillFromText(text), `${label} extractBillFromText`);
    if (bill) summarize('bill-extractor', bill);

    if (label === 'TSV' || label === 'CSV' || label === 'PSV') {
      const csv = safe(() => parseCSV(text, label.toLowerCase()), `${label} parseCSV`);
      if (csv) summarize('ingestion.parseCSV', csv);
    }

    if (label === 'MARKDOWN (RS/26-27/1572)' || label === 'BULLET LIST' || label === 'CONCATENATED RAW (RS/26-27/1577)') {
      const txt = safe(() => parseUnstructuredText(text), `${label} parseUnstructuredText`);
      if (txt) summarize('ingestion.parseText', txt);
    }
  }

  console.log('\n▶ JSON (flat shape)');
  const jf = safe(() => parseJSON(JSON_FLAT), 'parseJSON flat');
  if (jf) { summarize('ingestion.parseJSON', jf); check('flat JSON: 2 items', jf.items.length === 2, `got ${jf.items.length}`); check('flat JSON: invoiceNumber', jf.header.invoiceNumber === 'RS/26-27/1572'); }
  const ju = safe(() => parseUniversalData(JSON_FLAT), 'parseUniversalData flat JSON');
  if (ju) { summarize('universal-extractor', ju); check('flat JSON (universal): 2 items', ju.items.length === 2, `got ${ju.items.length}`); }

  console.log('\n▶ JSON (real-world nested shape from tax_invoice_RS-26-27-1572.json)');
  const jn = safe(() => parseJSON(JSON_NESTED), 'parseJSON nested');
  if (jn) {
    summarize('ingestion.parseJSON', jn);
    check('nested JSON: item names extracted (not "Item N")', jn.items.length === 2 && jn.items[0].productName.includes('Chana'), `first=${jn.items[0]?.productName}`);
    check('nested JSON: erpId extracted', jn.items[0]?.erpId === 'FD020400500900000D', `got ${jn.items[0]?.erpId}`);
    check('nested JSON: invoiceNumber from invoice.invoice_number', jn.header.invoiceNumber === 'RS/26-27/1572', `got ${jn.header.invoiceNumber}`);
    check('nested JSON: grandTotal from summary.total_value', jn.header.grandTotal === 2470.28, `got ${jn.header.grandTotal}`);
  }
  const jun = safe(() => parseUniversalData(JSON_NESTED), 'parseUniversalData nested JSON');
  if (jun) { summarize('universal-extractor', jun); check('nested JSON (universal): item names', jun.items.length === 2 && jun.items[0].productName.includes('Chana'), `first=${jun.items[0]?.productName}`); }

  console.log('\n▶ Excel (.xlsx buffer)');
  const ws = XLSX.utils.json_to_sheet([
    { 'Item ERP Id': 'FD0126001', 'Item Name': 'All In One 16GM', HSN: '21069099', Qty: 2160, Rate: 4.0475, Taxable: 8247.74, 'GST %': 5, Total: 8660.12 },
    { 'Item ERP Id': 'FD0921040', 'Item Name': 'Aloo Bhujia 400GM', HSN: '21069099', Qty: 62, Rate: 88.7261, Taxable: 5189.64, 'GST %': 5, Total: 5449.12 },
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const xl = await safe(async () => parseExcel(xlsxBuf, 'test.xlsx'), 'parseExcel');
  if (xl) { summarize('ingestion.parseExcel', xl); check('excel: 2 items', xl.items.length === 2, `got ${xl.items.length}`); check('excel: product names', xl.items[0]?.productName.includes('All In One'), xl.items[0]?.productName); }

  console.log('\n▶ PDF');
  // Hand-crafted minimal PDF with an uncompressed text stream (exercises Stage 3 stream extraction)
  const streamBody = [
    'BT /F1 12 Tf 72 720 Td (Seller Firm Name: RAJSHREE SNACKS AND FOODS PRIVATE LIMITED) Tj ET',
    'BT /F1 12 Tf 72 700 Td (Invoice/Bill Number: RS/26-27/1577) Tj ET',
    'BT /F1 12 Tf 72 680 Td (1 FD012600160691200D All In One MRP 5/16 GM 6.912 KG \\(NGP\\) 21069099 5.00 432 5 2160 4.0475 1,649.5488 0.00 \\(0\\) 8,247.74 5 412.38 8,660.12) Tj ET',
    'BT /F1 12 Tf 72 660 Td (Total Value: 2,73,345.00) Tj ET',
  ].join('\n');
  const pdfContent = [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${Buffer.byteLength(streamBody, 'utf-8')} >> stream`,
    streamBody,
    'endstream endobj',
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    'trailer << /Root 1 0 R >>',
    '%%EOF',
  ].join('\n');
  const pdfBuf = Buffer.from(pdfContent, 'utf-8');
  const pdfText = await safe(async () => convertPDFToText(pdfBuf), 'convertPDFToText');
  if (pdfText !== null) {
    console.log(`    [convertPDFToText] -> ${JSON.stringify((pdfText as string).slice(0, 180))}`);
    check('pdf: text contains invoice number', (pdfText as string).includes('RS/26-27/1577'));
    check('pdf: long distribution line not truncated', (pdfText as string).includes('8,660.12'), `got ${JSON.stringify((pdfText as string).slice(-160))}`);
  }
  const p = await safe(async () => parsePDF(pdfBuf), 'parsePDF');
  if (p) { summarize('ingestion.parsePDF', p); check('pdf: items parsed from text', (p.items || []).length >= 1, `got ${(p.items || []).length}`); }

  console.log('\n▶ Engine (ingestData — used by /api/ingest, invoices page, bills extract tab)');
  const eng1 = await safe(async () => ingestData({ text: MARKDOWN_INVOICE, fileName: 'paste.txt', deploymentMode: 'cloud' }), 'engine markdown');
  if (eng1?.result) { summarize('engine', eng1.result); const v = validateIngestionResult(eng1.result); check('engine markdown valid order-ready', v.isValid, `score=${v.score} issues=${v.issues.length}`); }

  const eng2 = await safe(async () => ingestData({ text: TSV_SAMPLE, fileName: 'sample.tsv', deploymentMode: 'cloud' }), 'engine tsv');
  if (eng2?.result) { summarize('engine', eng2.result); check('engine tsv: 3 items', eng2.result.items.length === 3, `got ${eng2.result.items.length}`); }

  const eng3 = await safe(async () => ingestData({ text: JSON_NESTED, fileName: 'invoice.json', deploymentMode: 'cloud' }), 'engine nested json');
  if (eng3?.result) { summarize('engine', eng3.result); check('engine nested json: 2 items with names', eng3.result.items.length === 2 && eng3.result.items[0].productName.includes('Chana'), `first=${eng3.result.items[0]?.productName}`); }

  const eng4 = await safe(async () => ingestData({ text: CONCAT_INVOICE, fileName: 'Pasted Text', deploymentMode: 'cloud' }), 'engine concat');
  if (eng4?.result) { summarize('engine', eng4.result); check('engine concat: 2 items routed to unstructured', eng4.result.items.length === 2 && eng4.result.format === 'unstructured', `fmt=${eng4.result.format} items=${eng4.result.items.length}`); }

  const eng5 = await safe(async () => ingestData({ text: MARKDOWN_INVOICE, fileName: 'Pasted Text', deploymentMode: 'cloud' }), 'engine markdown via pasted-text');
  if (eng5?.result) { summarize('engine', eng5.result); check('engine markdown: 19 items (not misrouted as PSV)', eng5.result.items.length === 19, `got ${eng5.result.items.length}`); }

  const engTsv = await safe(async () => ingestData({ text: TSV_SAMPLE, fileName: 'sample.tsv', deploymentMode: 'cloud' }), 'engine tsv rate check');
  if (engTsv?.result && engTsv.result.items[0]) { check('engine tsv: unit price from Rate column', Math.abs(engTsv.result.items[0].unitPrice - 4.0475) < 0.001, `got ${engTsv.result.items[0].unitPrice}`); }

  console.log(`\n==============================================`);
  console.log(`🏁 RESULT: ${pass} passed, ${fail} failed, ${crash} crashes`);
  console.log(`==============================================\n`);
  process.exit(fail > 0 || crash > 0 ? 1 : 0);
}

main().catch((e) => { console.error('Harness error:', e); process.exit(1); });
