import { ExtractionResult } from './ai-provider';

export function validateGSTIN(gstin: string) {
  const format = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]Z[A-Z\d]$/;
  const errors: string[] = [];
  if (!gstin) return { valid: false, errors: ['GSTIN is required'] };
  if (gstin.length !== 15) errors.push('GSTIN must be 15 characters long');
  if (!format.test(gstin)) errors.push('Invalid GSTIN format');
  return { valid: errors.length === 0, errors };
}

export function validatePAN(pan: string) {
  const format = /^[A-Z]{5}\d{4}[A-Z]$/;
  const errors: string[] = [];
  if (!pan) return { valid: false, errors: ['PAN is required'] };
  if (pan.length !== 10) errors.push('PAN must be 10 characters long');
  if (!format.test(pan)) errors.push('Invalid PAN format');
  return { valid: errors.length === 0, errors };
}

export function validatePhone(phone: string) {
  const stripped = phone.replace(/[\s\-+]/g, '');
  const format = /^(?:91)?[6-9]\d{9}$/;
  const errors: string[] = [];
  if (!phone) return { valid: false, errors: ['Phone is required'] };
  if (!format.test(stripped)) errors.push('Invalid Indian phone number');
  return { valid: errors.length === 0, errors };
}

export function validateERPId(erpId: string) {
  const format = /^[a-zA-Z0-9\-_]{3,50}$/;
  const errors: string[] = [];
  if (!erpId) return { valid: false, errors: ['ERP ID is required'] };
  if (!format.test(erpId)) errors.push('Invalid ERP ID format');
  return { valid: errors.length === 0, errors };
}

export function validateGSTCalculation(taxableAmount: number, gstRate: number, expectedGst: number) {
  const calculated = (taxableAmount * gstRate) / 100;
  const difference = Math.abs(calculated - expectedGst);
  return { valid: difference <= 1.0, expected: calculated, difference };
}

export function validateTotalCalculation(items: { totalAmount: number }[], expectedTotal: number) {
  const calculated = items.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  const difference = Math.abs(calculated - expectedTotal);
  return { valid: difference <= 1.0, calculated, difference };
}

export function validateInvoiceNumber(invoiceNumber: string) {
  const format = /^[a-zA-Z0-9\-\/]+$/;
  const valid = !!invoiceNumber && format.test(invoiceNumber);
  return { valid, format: valid ? 'valid' : 'invalid' };
}

export function validateInvoiceData(data: ExtractionResult) {
  let score = 100;
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!data.invoiceNumber) {
    score -= 20;
    issues.push('Missing invoice number');
  }
  
  if (!data.invoiceDate) {
    score -= 10;
    warnings.push('Missing invoice date');
  }
  
  if (data.customerGSTIN) {
    const { valid, errors } = validateGSTIN(data.customerGSTIN);
    if (!valid) {
      score -= 10;
      issues.push(...errors);
    }
  } else {
    score -= 10;
    warnings.push('Missing customer GSTIN');
  }

  if (!data.items || data.items.length === 0) {
    score -= 30;
    issues.push('No line items found');
  } else {
    data.items.forEach((item, index) => {
      if (!item.productName || item.productName === 'Unknown Product') {
        warnings.push(`Item ${index + 1} is missing a product name`);
      }
      if (item.quantity <= 0) {
        warnings.push(`Item ${index + 1} has zero or negative quantity`);
      }
      if (item.totalAmount <= 0) {
        warnings.push(`Item ${index + 1} has zero or negative total amount`);
      }
      if (item.taxableAmount && item.gstRate && item.gstAmount) {
        const { valid } = validateGSTCalculation(item.taxableAmount, item.gstRate, item.gstAmount);
        if (!valid) {
          warnings.push(`Item ${index + 1} GST calculation mismatch`);
        }
      }
    });

    if (data.grandTotal) {
      const { valid } = validateTotalCalculation(data.items, data.grandTotal);
      if (!valid) {
        score -= 20;
        issues.push('Grand total does not match sum of items');
      }
    } else {
      score -= 15;
      issues.push('Missing grand total');
    }
  }

  return { score: Math.max(0, score), issues, warnings };
}

export function numberToWords(num: number): string {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const numStr = num.toString();
  if (numStr.length > 9) return 'overflow';
  const match = ('000000000' + numStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!match) return ''; 
  const n = match as RegExpMatchArray;
  let str = '';
  str += (n[1] != '00') ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
  str += (n[2] != '00') ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
  str += (n[3] != '00') ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
  str += (n[4] != '0') ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
  str += (n[5] != '00') ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) : '';
  return str ? `Rupees ${str}Only` : 'Rupees Zero Only';
}
