// Test the markdown-style invoice parsing
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

// Test the markdown regex pattern
const markdownItemRegex = /\*{0,2}\s*(\d+)\.\s+([^*\n]+?)\s*\*{0,2}\s*\n+\s*\*?\s*Quantity:\s*([\d,]+)\s*\|\s*MRP:\s*₹?([\d,]+\.?\d*)\s*\|\s*Total Value:\s*₹?([\d,]+\.?\d*)/gi;
const matches = Array.from(text.matchAll(markdownItemRegex));
console.log(`Found ${matches.length} items via markdown regex`);
matches.forEach((m, i) => {
  console.log(`  ${i+1}. ${m[1]}. ${m[2].trim()} | Qty: ${m[3]} | MRP: ${m[4]} | Total: ${m[5]}`);
});

// Also test header extraction
const invMatch = text.match(/(?:Invoice\/Bill Number|Invoice Number|Bill Number|Invoice No|Bill No|Inv No|RS\/\d{2}-\d{2}\/\d+)[.:\s]*([A-Z0-9\-\/]+)/i);
console.log('\nInvoice Number:', invMatch ? invMatch[1] : 'NOT FOUND');

const dateMatch = text.match(/(?:Bill\/Invoice Date|Invoice Date|Bill Date|Date|Dt)[.:\s]*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}(?:,\s*\d{1,2}:\d{2}\s*(?:am|pm)?)?|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
console.log('Invoice Date:', dateMatch ? dateMatch[1] : 'NOT FOUND');

const buyerMatch = text.match(/(?:Buyer Details|Billed To)[^\r\n]*?Firm Name:\s*([^\r\n\t]+?)(?=\s{2}|\s*Address|\s*City|\s*State|\s*GSTIN|$)/i) ||
                   text.match(/Buyer:\s*([^\r\n\t]+?)(?=\s{2}|\s*ITEMS|\s*BILLING|\s*$)/i);
console.log('Buyer:', buyerMatch ? buyerMatch[1].trim() : 'NOT FOUND');

const grandTotalMatch = text.match(/(?:Total Value|Grand Total|Total Amount)[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
console.log('Grand Total:', grandTotalMatch ? grandTotalMatch[1] : 'NOT FOUND');

const taxableMatch = text.match(/(?:Taxable Value|Gross Amt)[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
console.log('Taxable:', taxableMatch ? taxableMatch[1] : 'NOT FOUND');

const totalGstMatch = text.match(/(?:Total GST Amount|GST Amt\.?|GST Amount)[.:\s]*(?:₹|Rs\.?)?\s*([\d,]+\.\d{2})/i);
console.log('Total GST:', totalGstMatch ? totalGstMatch[1] : 'NOT FOUND');