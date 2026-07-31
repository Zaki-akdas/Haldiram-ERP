const invoiceText = `Invoice OverviewInvoice/Bill Number: RS/26-27/1577  Bill/Invoice Date: 22 Jul 2026, 2:08 pm  Sales Order Number: SO/41103/1689  Seller DetailsSeller Firm Name: RAJSHREE SNACKS AND FOODS PRIVATE LIMITED  Address: KHASRA NO 725/1/1 GRAM PIPALIYA JAHEER, Bhopal-462010  State & Code: MADHYA PRADESH, 23  GSTIN: 23AAPCR5371M1ZT  PAN Number: AAPCR5371M  Seller Email ID: Rajshreesnacksandfoods@gmail.com  FSSAI Number: 11426999000165  Buyer Details (Billed To & Shipped To)Firm Name: PRO SWAMI (SHARNAM ENTERPRISES)  Address: 17-B, D Sector, Govindpura Industrial Area, Bhopal, Madhya Pradesh 462023, India  City & Pincode: BHOPAL, 462022  State & Code: MADHYA PRADESH, 23  GSTIN: 23AMFPV5397L1ZB  PAN Number: AMFPV5397L  Mobile: 9589408202  FSSAI Number: 11423010000093  Itemized DetailsThe following table contains the billing items extracted from the invoice:  S No.Item NameHSN CodeMRP (₹)CasesQtyTaxable Value (₹)GST Amt. (₹)Total Value (₹)1All In One MRP 5 16 GM 6.912 KG (NGP)210690995.00521608,247.74412.388,660.122Aloo Bhujia 400 GM 12.40 KG21069099109.002625,189.64259.485,449.123Aloo Bhujia MRP 10/42 GM 10.584 KG2106909910.00512609,675.92483.8010,159.724Aloo Bhujia MRP 5 19 GM 7.296 KG210690995.00519207,331.33366.567,697.895Boondi MRP 10 35GM 7.56KG NGP2106909910.0024323,317.41165.883,483.296Boondi MRP 10 35GM 7.56KG NGP2106909910.0012161,658.7182.941,741.657Chana Jor Garam MRP 10/50 GM 9 KG NGP2106909910.0059006,911.28345.567,256.848Chana Jor Garam MRP 5/25 GM 7.2 KG NGP210690995.0038643,299.10164.963,464.069Chips Masala MRP 10/30 GM 4.5 KG2005200010.0023002,303.76115.182,418.9410Chips Pudina Treat MRP 10 30GM 4.5KG NGP2005200010.0023002,303.76115.182,418.9411Chips Pudina Treat MRP 5 13GM 3.12KG NGP200520005.0037202,814.05140.702,954.7512Cream Cone Vanilla 30 GM 0.96 KG2106909910.00103202,500.10125.002,625.1013Dal Biji 200 GM 4.80 KG (NGP)2106909955.001241,013.6650.681,064.3414Falahari Chiwda 400 GM 12 KG NGP2106909995.002604,377.17218.864,596.0315Falahari Chiwda MRP 10/42 GM 10.08 KG2106909910.0030720055,290.242,764.5258,054.7616Falahari Chiwda MRP 5 18GM 5.4KG210690995.0030900034,365.601,718.2836,083.8817Gathiya MRP 5/20 GM 6 KG NGP210690995.00515005,727.60286.386,013.9818H. F. Plain Wafer MRP 10/32 GM 3.840 KG2005200010.0022401,843.0192.161,935.1719Instant Bhel MRP 10/41 GM 8.364 KG2106909910.008163212,532.62626.6413,159.2620Lemon Bhel MRP 10/44 GM 7.92 KG (NGP)2005200010.0015270020,733.841,036.7021,770.5421Milk Bread Toast 250 GM 5 KG NGP1905400045.003602,114.05105.702,219.7522Mini Samosa 200 GM 4.0 KG (NGP)2106909970.001201,075.1053.761,128.8623Mixture MRP 5 21 GM 9.072 KG210690995.0010432016,495.49824.7817,320.2724Papad Chavanu MRP 10/42 GM 6.552 KG2106909910.0057805,989.78299.486,289.2625Papdi Gathiya MRP 10/40 GM 5.76 KG2106909910.0022882,211.64110.582,322.2226Ratlami Sev MRP 10 42 GM 9.576 KG2106909910.0010228017,508.80875.4418,384.2427Salted Peanut 200 GM 4.80 KG (NGP)2008110060.0071687,740.70387.048,127.7428Salted Peanut 200 GM 4.80 KG (NGP)2008110060.003723,317.44165.883,483.3229Soan Cake Mini 200 GM 14.4 KG NGP2106909999.0021445,473.77273.685,747.4530Woka Instant Noodles 220 Gm 5.280 Kg1902190040.002481,466.4073.321,539.7231Woka Instant Noodles MRP10 55 GM 7.92 KG1902190010.001447205,499.00274.945,773.94Note: The total quantities sum to 188 Cases and 40,710.00 Invoice/Delivery Qty. All items carry a 5% GST rate.  Invoice SummaryGross Amt: ₹2,60,328.71  Trade / Primary / Secondary Discount Value: 0.00  Taxable Value: ₹2,60,328.71  CGST Amount: ₹6,508.22  SGST Amount: ₹6,508.22  IGST / UTGST Amount: ₹0.00  Total GST Amount: ₹13,016.44  Round Off: ₹0.15  Total Value: ₹2,73,345.00  Total Amount in Words: Two Lakh Seventy Three Thousand Three Hundred Forty Five Rupees  Bank & Transportation DetailsBank Name: Kotak bank  Bank Account Number: 9953962212  Bank IFSC Code: Kkbk0004661  Vehicle Number: MP21G2494  Additional Information & Terms not show data extracter correctly`;

function num(s) {
  if (!s) return 0;
  const cleaned = s.replace(/[₹\s,]/g, '').trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

// Extract metadata
const invoiceNum = invoiceText.match(/Invoice\/Bill Number:\s*(\S+)/)?.[1] || '';
const invoiceDate = invoiceText.match(/Bill\/Invoice Date:\s*([^,]+)/)?.[1] || '';
const salesOrder = invoiceText.match(/Sales Order Number:\s*(\S+)/)?.[1] || '';

const sellerName = invoiceText.match(/Seller Firm Name:\s*(.+?)(?:\s+Address:|$)/s)?.[1]?.trim() || '';
const sellerGstin = invoiceText.match(/Seller.*?GSTIN:\s*(\S+)/)?.[1] || '';
const sellerPan = invoiceText.match(/Seller.*?PAN Number:\s*(\S+)/)?.[1] || '';
const sellerFssai = invoiceText.match(/Seller.*?FSSAI Number:\s*(\S+)/)?.[1] || '';
const sellerEmail = invoiceText.match(/Seller Email ID:\s*(\S+)/)?.[1] || '';

const buyerName = invoiceText.match(/Firm Name:\s*(.+?)(?:\s+Address:|$)/s)?.[1]?.trim() || '';
const buyerGstin = invoiceText.match(/Buyer.*?GSTIN:\s*(\S+)/)?.[1] || '';
const buyerPan = invoiceText.match(/Buyer.*?PAN Number:\s*(\S+)/)?.[1] || '';
const buyerPhone = invoiceText.match(/Mobile:\s*(\S+)/)?.[1] || '';
const buyerFssai = invoiceText.match(/Buyer.*?FSSAI Number:\s*(\S+)/)?.[1] || '';

const grossAmt = invoiceText.match(/Gross Amt:\s*₹\s*([\d,]+\.?\d*)/)?.[1] || '0';
const taxableValueStr = invoiceText.match(/Taxable Value:\s*₹\s*([\d,]+\.?\d*)/)?.[1] || '0';
const cgstStr = invoiceText.match(/CGST Amount:\s*₹\s*([\d,]+\.?\d*)/)?.[1] || '0';
const sgstStr = invoiceText.match(/SGST Amount:\s*₹\s*([\d,]+\.?\d*)/)?.[1] || '0';
const totalGstStr = invoiceText.match(/Total GST Amount:\s*₹\s*([\d,]+\.?\d*)/)?.[1] || '0';
const roundOffStr = invoiceText.match(/Round Off:\s*₹\s*(-?[\d,]+\.?\d*)/)?.[1] || '0';
const totalValueStr = invoiceText.match(/Total Value:\s*₹\s*([\d,]+\.?\d*)/)?.[1] || '0';

console.log('=== Invoice Metadata ===');
console.log('Invoice Number:', invoiceNum);
console.log('Invoice Date:', invoiceDate);
console.log('Sales Order:', salesOrder);
console.log('Seller:', sellerName);
console.log('Seller GSTIN:', sellerGstin);
console.log('Seller PAN:', sellerPan);
console.log('Seller FSSAI:', sellerFssai);
console.log('Seller Email:', sellerEmail);
console.log('Buyer:', buyerName);
console.log('Buyer GSTIN:', buyerGstin);
console.log('Buyer PAN:', buyerPan);
console.log('Buyer Phone:', buyerPhone);
console.log('Buyer FSSAI:', buyerFssai);
console.log('Gross Amount:', grossAmt);
console.log('Taxable Value:', taxableValueStr);
console.log('CGST:', cgstStr);
console.log('SGST:', sgstStr);
console.log('Total GST:', totalGstStr);
console.log('Round Off:', roundOffStr);
console.log('Total Value:', totalValueStr);
console.log('');

// Define item names in order
const itemNames = [
  'All In One MRP 5 16 GM 6.912 KG (NGP)',
  'Aloo Bhujia 400 GM 12.40 KG',
  'Aloo Bhujia MRP 10/42 GM 10.584 KG',
  'Aloo Bhujia MRP 5 19 GM 7.296 KG',
  'Boondi MRP 10 35GM 7.56KG NGP',
  'Boondi MRP 10 35GM 7.56KG NGP',
  'Chana Jor Garam MRP 10/50 GM 9 KG NGP',
  'Chana Jor Garam MRP 5/25 GM 7.2 KG NGP',
  'Chips Masala MRP 10/30 GM 4.5 KG',
  'Chips Pudina Treat MRP 10 30GM 4.5KG NGP',
  'Chips Pudina Treat MRP 5 13GM 3.12KG NGP',
  'Cream Cone Vanilla 30 GM 0.96 KG',
  'Dal Biji 200 GM 4.80 KG (NGP)',
  'Falahari Chiwda 400 GM 12 KG NGP',
  'Falahari Chiwda MRP 10/42 GM 10.08 KG',
  'Falahari Chiwda MRP 5 18GM 5.4KG',
  'Gathiya MRP 5/20 GM 6 KG NGP',
  'H. F. Plain Wafer MRP 10/32 GM 3.840 KG',
  'Instant Bhel MRP 10/41 GM 8.364 KG',
  'Lemon Bhel MRP 10/44 GM 7.92 KG (NGP)',
  'Milk Bread Toast 250 GM 5 KG NGP',
  'Mini Samosa 200 GM 4.0 KG (NGP)',
  'Mixture MRP 5 21 GM 9.072 KG',
  'Papad Chavanu MRP 10/42 GM 6.552 KG',
  'Papdi Gathiya MRP 10/40 GM 5.76 KG',
  'Ratlami Sev MRP 10 42 GM 9.576 KG',
  'Salted Peanut 200 GM 4.80 KG (NGP)',
  'Salted Peanut 200 GM 4.80 KG (NGP)',
  'Soan Cake Mini 200 GM 14.4 KG NGP',
  'Woka Instant Noodles 220 Gm 5.280 Kg',
  'Woka Instant Noodles MRP10 55 GM 7.92 KG',
];

// For each item, find the raw data segment after HSN
// Strategy: find each item name in the text, then find the HSN (8 digits) after it,
// then the data segment extends until the next item name (or "Note:")

const itemSegments = [];

for (let i = 0; i < itemNames.length; i++) {
  const name = itemNames[i];
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameRegex = new RegExp(escapedName);
  const nameMatch = invoiceText.match(nameRegex);

  if (!nameMatch) {
    console.log(`ERROR: Could not find item ${i + 1}: ${name}`);
    continue;
  }

  const nameEnd = nameMatch.index + name.length;
  const afterName = invoiceText.slice(nameEnd);

  // HSN code (8 digits)
  const hsnMatch = afterName.match(/^(\d{8})/);
  if (!hsnMatch) {
    console.log(`ERROR: Could not find HSN for item ${i + 1}: ${name}`);
    continue;
  }

  const hsn = hsnMatch[1];
  const afterHsn = afterName.slice(hsn.length);

  // Find where this item's data ends (next item name or "Note:")
  let dataEnd = afterHsn.length;
  if (i + 1 < itemNames.length) {
    const nextName = itemNames[i + 1];
    const escapedNext = nextName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nextRegex = new RegExp(escapedNext);
    const nextMatch = afterHsn.match(nextRegex);
    if (nextMatch) {
      dataEnd = nextMatch.index;
    }
  }
  const noteIdx = afterHsn.indexOf('Note:');
  if (noteIdx >= 0 && noteIdx < dataEnd) {
    dataEnd = noteIdx;
  }

  const rawData = afterHsn.slice(0, dataEnd);

  itemSegments.push({
    sno: i + 1,
    name: name,
    hsn: hsn,
    rawData: rawData,
  });
}

// Now parse each item's raw data
// The raw data contains: MRP Cases Qty Taxable GST Total (concatenated)
// Constraints: GST = 5% of Taxable, Total = Taxable + GST

function parseItemNumbers(rawData) {
  // Remove any trailing whitespace
  rawData = rawData.trim();

  // The data ends with Total (XX,XXX.XX format with 2 decimal places)
  // We need to find 6 values: MRP, Cases, Qty, Taxable, GST, Total
  // Total = Taxable + GST, GST = 5% of Taxable

  // Strategy: Find all possible currency amounts (numbers with .XX) from the right
  // Then use the 5% GST constraint to validate

  // First, find all numbers (with or without commas) in the data
  // We'll try to find Total, GST, Taxable from the end

  // Find all decimal numbers (with .XX)
  const decMatches = [];
  const decRegex = /(\d{1,3}(?:,\d{3})*\.\d{2})/g;
  let m;
  while ((m = decRegex.exec(rawData)) !== null) {
    decMatches.push({ value: m[1], start: m.index, end: m.index + m[1].length });
    if (m.index === decRegex.lastIndex) decRegex.lastIndex++;
  }

  // We need at least 3 decimal values for Taxable, GST, Total
  if (decMatches.length < 3) {
    return null;
  }

  // Try to find Total (last decimal), GST (second-to-last), Taxable (third-to-last)
  // But we need to check if they satisfy: Total = Taxable + GST and GST = 5% of Taxable

  // Work from the end
  for (let t = decMatches.length - 1; t >= 2; t--) {
    const total = num(decMatches[t].value);
    const gst = num(decMatches[t - 1].value);
    const taxable = num(decMatches[t - 2].value);

    // Check constraints
    if (Math.abs(taxable + gst - total) <= 0.02) {
      // Check GST rate
      const gstRate = taxable > 0 ? (gst / taxable * 100) : 0;
      if (Math.abs(gstRate - 5) <= 0.1) {
        // Found valid split!
        // Now parse MRP, Cases, Qty from the text before Taxable
        const beforeTaxable = rawData.slice(0, decMatches[t - 2].start);

        // Find all numbers in beforeTaxable
        const beforeNums = [];
        const beforeRegex = /(\d+\.\d{2}|\d+)/g;
        while ((m = beforeRegex.exec(beforeTaxable)) !== null) {
          beforeNums.push({ value: m[1], start: m.index, end: m.index + m[1].length });
          if (m.index === beforeRegex.lastIndex) beforeRegex.lastIndex++;
        }

        // MRP is the first number (with .XX)
        // Cases is the next small integer
        // Qty is the remaining
        let mrp = 0, cases = 0, qty = 0;

        if (beforeNums.length >= 3) {
          mrp = num(beforeNums[0].value);
          cases = parseInt(beforeNums[1].value) || 0;
          // Qty is everything between Cases and Taxable
          qty = num(beforeTaxable.slice(beforeNums[1].end));
        } else if (beforeNums.length >= 2) {
          mrp = num(beforeNums[0].value);
          cases = parseInt(beforeNums[1].value) || 0;
        } else if (beforeNums.length >= 1) {
          mrp = num(beforeNums[0].value);
        }

        return { mrp, cases, qty, taxable, gst, total };
      }
    }

    // Also try: maybe the taxable value includes a leading digit from Qty
    // e.g., Qty=2, Taxable=5,189.64 but the "5" is concatenated
    // So the decimal match for taxable might be "189.64" and the "5" is part of qty
    if (t >= 3) {
      // Try combining decMatches[t-3] and decMatches[t-2] as taxable
      const combinedTaxableStr = decMatches[t - 3].value + decMatches[t - 2].value.replace(/[,\.]/g, '');
      // Actually, let's try: the text between gst and total might contain both taxable and part of qty
      // This is getting too complex. Let's try a different approach.
    }
  }

  // Fallback: try to find Total as the last number, and compute Taxable/GST from it
  if (decMatches.length >= 1) {
    const total = num(decMatches[decMatches.length - 1].value);
    const taxable = Math.round(total / 1.05 * 100) / 100;
    const gst = Math.round((total - taxable) * 100) / 100;

    // Find where taxable+gst appear in the text
    const gstStr = decMatches[decMatches.length - 2]?.value || '';
    const taxableStr = decMatches[decMatches.length - 3]?.value || '';

    // Check if the computed values match
    if (Math.abs(num(gstStr) - gst) <= 0.02 && Math.abs(num(taxableStr) - taxable) <= 0.02) {
      const beforeTaxable = rawData.slice(0, decMatches[decMatches.length - 3].start);
      const beforeNums = [];
      const beforeRegex = /(\d+\.\d{2}|\d+)/g;
      while ((m = beforeRegex.exec(beforeTaxable)) !== null) {
        beforeNums.push({ value: m[1], start: m.index, end: m.index + m[1].length });
        if (m.index === beforeRegex.lastIndex) beforeRegex.lastIndex++;
      }

      let mrp = 0, cases = 0, qty = 0;
      if (beforeNums.length >= 3) {
        mrp = num(beforeNums[0].value);
        cases = parseInt(beforeNums[1].value) || 0;
        qty = num(beforeTaxable.slice(beforeNums[1].end));
      } else if (beforeNums.length >= 2) {
        mrp = num(beforeNums[0].value);
        cases = parseInt(beforeNums[1].value) || 0;
      } else if (beforeNums.length >= 1) {
        mrp = num(beforeNums[0].value);
      }

      return { mrp, cases, qty, taxable, gst, total };
    }
  }

  return null;
}

// Parse all items
const items = [];
for (const seg of itemSegments) {
  const parsed = parseItemNumbers(seg.rawData);
  if (parsed) {
    items.push({
      sno: seg.sno,
      itemName: seg.name,
      erpId: seg.hsn,
      hsn: seg.hsn,
      mrp: parsed.mrp,
      cases: parsed.cases,
      qty: parsed.qty,
      taxable: parsed.taxable,
      gst: parsed.gst,
      total: parsed.total,
      rawData: seg.rawData,
    });
  } else {
    console.log(`ERROR: Could not parse item ${seg.sno}: ${seg.name}`);
    console.log(`  Raw data: ${seg.rawData}`);
  }
}

// Print parsed items
console.log('=== Parsed Items ===');
for (const item of items) {
  const check = (item.taxable + item.gst).toFixed(2);
  const match = Math.abs(check - item.total.toFixed(2)) < 0.02 ? '✓' : '✗ MISMATCH';
  console.log(`${item.sno}. ${item.itemName} | HSN: ${item.hsn} | MRP: ${item.mrp} | Cases: ${item.cases} | Qty: ${item.qty} | Taxable: ${item.taxable} | GST: ${item.gst} | Total: ${item.total} | ${match}`);
}

// Verify totals
let sumTaxable = 0;
let sumGst = 0;
let sumTotal = 0;
let sumCases = 0;
let sumQty = 0;

for (const item of items) {
  sumTaxable += item.taxable;
  sumGst += item.gst;
  sumTotal += item.total;
  sumCases += item.cases;
  sumQty += item.qty;
}

console.log('\n=== Verification ===');
console.log(`Total Taxable: ${sumTaxable.toFixed(2)} (expected: ${num(taxableValueStr)})`);
console.log(`Total GST: ${sumGst.toFixed(2)} (expected: ${num(totalGstStr)})`);
console.log(`Total Total: ${sumTotal.toFixed(2)} (expected: ${num(totalValueStr)})`);
console.log(`Total Cases: ${sumCases} (expected: 188)`);
console.log(`Total Qty: ${sumQty.toFixed(2)} (expected: 40710.00)`);

// Generate CSV
const csvRows = [
  'S.No,Item Name,ERP ID,HSN Code,MRP (₹),Cases,Qty,Taxable Value (₹),GST Amt. (₹),Total Value (₹),GST Rate (%)',
];

for (const item of items) {
  const gstRate = item.taxable > 0 ? (item.gst / item.taxable * 100).toFixed(1) : '5.0';
  csvRows.push([
    item.sno,
    `"${item.itemName}"`,
    item.erpId,
    item.hsn,
    item.mrp.toFixed(2),
    item.cases,
    item.qty.toFixed(2),
    item.taxable.toFixed(2),
    item.gst.toFixed(2),
    item.total.toFixed(2),
    gstRate,
  ].join(','));
}

csvRows.push([
  '',
  'TOTAL',
  '',
  '',
  '',
  sumCases,
  sumQty.toFixed(2),
  sumTaxable.toFixed(2),
  sumGst.toFixed(2),
  sumTotal.toFixed(2),
  '5.0',
].join(','));

console.log('\n=== Generated CSV ===');
console.log(csvRows.join('\n'));
