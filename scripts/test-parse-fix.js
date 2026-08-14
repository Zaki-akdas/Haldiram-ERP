// Standalone test of the markdown parsing logic (replicates text.ts logic)

function parseNumber(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function stripMarkdown(val) {
  return val.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^[-_>#\s]+|[-_>#\s]+$/g, '').trim();
}

// Parse markdown-style items
function parseMarkdownItems(text) {
  const items = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    const itemHeader = line.match(/^\*{0,2}\s*(\d+)\.\s+(.+?)\s*\*{0,2}$/i);
    if (!itemHeader) continue;
    
    const srNo = parseInt(itemHeader[1]);
    const productNameRaw = itemHeader[2];
    if (!productNameRaw || productNameRaw.toLowerCase().includes('total') || 
        productNameRaw.toLowerCase().includes('items') || productNameRaw.toLowerCase().includes('bill')) continue;
    
    let qtyLine = '';
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j].trim();
      if (!nextLine) continue;
      if (nextLine.match(/^\d+\./) || nextLine.match(/^[-_*]{3,}/)) break;
      if (nextLine.toLowerCase().includes('quantity')) {
        qtyLine = nextLine;
        break;
      }
    }
    
    if (!qtyLine) continue;
    
    const qtyMatch = qtyLine.match(/Quantity:\s*([\d,]+)/i);
    const mrpMatch = qtyLine.match(/MRP:\s*₹?([\d,]+\.?\d*)/i);
    const totalMatch = qtyLine.match(/Total Value:\s*₹?([\d,]+\.?\d*)/i);
    
    if (!qtyMatch || !mrpMatch || !totalMatch) continue;
    
    const quantity = parseNumber(qtyMatch[1]);
    const mrp = parseNumber(mrpMatch[1]);
    const totalAmount = parseNumber(totalMatch[1]);
    
    const taxableAmount = totalAmount / 1.05;
    const gstAmount = totalAmount - taxableAmount;
    const gstRate = 5;
    const unitPrice = mrp || (quantity > 0 ? taxableAmount / quantity : 0);
    
    items.push({
      srNo,
      productName: stripMarkdown(productNameRaw),
      quantity: Math.max(0, quantity),
      unitPrice: parseFloat(unitPrice.toFixed(4)),
      mrp: mrp || undefined,
      taxableAmount: parseFloat(taxableAmount.toFixed(2)),
      gstRate,
      gstAmount: parseFloat(gstAmount.toFixed(2)),
      totalAmount: parseFloat(totalAmount.toFixed(2)),
    });
  }
  
  return items;
}

const text = `**INVOICE DETAILS**

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

const items = parseMarkdownItems(text);
console.log(`=== ITEMS EXTRACTED: ${items.length} ===`);
items.forEach((item, i) => {
  console.log(`  ${i+1}. [${item.srNo}] ${item.productName} | Qty: ${item.quantity} | MRP: ${item.mrp} | Taxable: ${item.taxableAmount} | GST: ${item.gstAmount} | Total: ${item.totalAmount}`);
});

// Test header extraction
console.log('\n=== HEADER EXTRACTION ===');
const invMatch = text.match(/RS\/\d{2}-\d{2}\/\d+/i) ||
                 text.match(/(?:Invoice\/Bill Number|Invoice Number|Bill Number|Invoice No|Bill No|Inv No)[.:\s]*\*{0,2}\s*([A-Z0-9\-\/]+)/i) ||
                 text.match(/\*{0,2}\s*Bill Number:\s*\*{0,2}\s*([A-Z0-9\-\/]+)/i);
console.log('Invoice Number:', invMatch ? (invMatch[0].match(/^RS\/\d{2}-\d{2}\/\d+$/i) ? invMatch[0] : (invMatch[1] || invMatch[0])) : 'NOT FOUND');

const dateMatch = text.match(/(?:Bill\/Invoice Date|Invoice Date|Bill Date|Date|Dt)[.:\s]*\*{0,2}\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}(?:,\s*\d{1,2}:\d{2}\s*(?:am|pm)?)?|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i) ||
                    text.match(/\*{0,2}\s*Date:\s*\*{0,2}\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}(?:,\s*\d{1,2}:\d{2}\s*(?:am|pm)?)?|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
console.log('Invoice Date:', dateMatch ? stripMarkdown(dateMatch[1]) : 'NOT FOUND');

const sellerMatch = text.match(/Seller Details[^\r\n]*?Firm Name:\s*([^\r\n\t]+?)(?=\s{2}|\s*Address|\s*State|\s*GSTIN|$)/i) ||
                    text.match(/Seller Firm Name:\s*([^\r\n\t]+?)(?=\s{2}|\s*Address|\s*State|\s*GSTIN|$)/i) ||
                    text.match(/\*{0,2}\s*Seller:\s*\*{0,2}\s*([^\r\n\t]+?)(?=\s*$)/i);
console.log('Seller:', sellerMatch ? stripMarkdown(sellerMatch[1]) : 'NOT FOUND');

const buyerMatch = text.match(/(?:Buyer Details|Billed To)[^\r\n]*?Firm Name:\s*([^\r\n\t]+?)(?=\s{2}|\s*Address|\s*City|\s*State|\s*GSTIN|$)/i) ||
                   text.match(/\*{0,2}\s*Buyer:\s*\*{0,2}\s*([^\r\n\t]+?)(?=\s*$)/i) ||
                   text.match(/Buyer:\s*([^\r\n\t]+?)(?=\s{2}|\s*ITEMS|\s*BILLING|\s*$)/i);
console.log('Buyer:', buyerMatch ? stripMarkdown(buyerMatch[1]) : 'NOT FOUND');

// Billing summary extraction
const taxableTotalMatch = text.match(/Taxable Value:\s*\*{0,2}\s*₹?([\d,]+\.\d{2})/i);
const gstTotalMatch = text.match(/(?:Total GST|GST Amount|GST:).*?:\s*\*{0,2}\s*₹?([\d,]+\.\d{2})/i);
const grandTotalMatch = text.match(/Grand Total:\s*\*{0,2}\s*₹?([\d,]+\.\d{2})/i);
const cgstMatchFinal = text.match(/CGST:\s*\*{0,2}\s*₹?([\d,]+\.\d{2})/i);
const sgstMatchFinal = text.match(/SGST:\s*\*{0,2}\s*₹?([\d,]+\.\d{2})/i);

console.log('Taxable:', taxableTotalMatch ? parseNumber(taxableTotalMatch[1]) : 'NOT FOUND');
console.log('Total GST:', gstTotalMatch ? parseNumber(gstTotalMatch[1]) : 'NOT FOUND');
console.log('Grand Total:', grandTotalMatch ? parseNumber(grandTotalMatch[1]) : 'NOT FOUND');
console.log('CGST:', cgstMatchFinal ? parseNumber(cgstMatchFinal[1]) : 'NOT FOUND');
console.log('SGST:', sgstMatchFinal ? parseNumber(sgstMatchFinal[1]) : 'NOT FOUND');

// Sum validation
const totalTaxable = items.reduce((s, i) => s + i.taxableAmount, 0);
const totalGst = items.reduce((s, i) => s + i.gstAmount, 0);
const totalAmt = items.reduce((s, i) => s + i.totalAmount, 0);
console.log(`\n=== SUMS ===`);
console.log(`Sum Taxable: ${totalTaxable.toFixed(2)}`);
console.log(`Sum GST: ${totalGst.toFixed(2)}`);
console.log(`Sum Total: ${totalAmt.toFixed(2)}`);
console.log(`Expected Taxable: 69764.21, Total GST: 3488.24, Grand Total: 73252.00`);