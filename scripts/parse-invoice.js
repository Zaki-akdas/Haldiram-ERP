const fs = require('fs');

function parseInvoiceText(text) {
  const invoiceNumberMatch = text.match(/Invoice No[\s:]*([A-Z0-9\-]+)/i);
  const dateMatch = text.match(/Date[\s:]*(\d{2}\/\d{2}\/\d{4})/i);
  const partyMatch = text.match(/Party Name[\s:]*(.+)/i);
  const gstinMatch = text.match(/GSTIN[\s:]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/i);

  const invoiceNumber = invoiceNumberMatch ? invoiceNumberMatch[1] : '';
  const date = dateMatch ? dateMatch[1] : '';
  const partyName = partyMatch ? partyMatch[1].trim() : '';
  const gstin = gstinMatch ? gstinMatch[1] : '';

  const sampleItems = [
    { sr: 1, product: 'Aloo Bhujia 400g', hsn: '210690', qty: 50, rate: 85, taxable: 4250, cgst: 255, sgst: 255, total: 4760 },
    { sr: 2, product: 'Moong Dal 400g', hsn: '210690', qty: 30, rate: 90, taxable: 2700, cgst: 162, sgst: 162, total: 3024 },
    { sr: 3, product: 'Khatta Meetha 400g', hsn: '210690', qty: 40, rate: 85, taxable: 3400, cgst: 204, sgst: 204, total: 3808 },
    { sr: 4, product: 'Navratan Mix 400g', hsn: '210690', qty: 60, rate: 95, taxable: 5700, cgst: 342, sgst: 342, total: 6384 },
    { sr: 5, product: 'Bhujia Sev 400g', hsn: '210690', qty: 100, rate: 80, taxable: 8000, cgst: 480, sgst: 480, total: 8960 },
  ];

  let csv = 'Sr,Product,HSN,Qty,Rate,Taxable,CGST,SGST,Total\n';
  sampleItems.forEach(item => {
    csv += `${item.sr},${item.product},${item.hsn},${item.qty},${item.rate},${item.taxable},${item.cgst},${item.sgst},${item.total}\n`;
  });

  return csv;
}

const text = `
Rajshree Snacks Distributor
Invoice No: RS-2023-452
Date: 15/07/2023
Party Name: Sharma General Store
GSTIN: 07AADCS2398N1Z2
...
`;

console.log(parseInvoiceText(text));
