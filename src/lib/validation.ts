// Validation utilities for Indian tax invoices

// GSTIN checksum validation
export function validateGSTIN(gstin: string): { valid: boolean; message: string } {
  if (!gstin || typeof gstin !== 'string') {
    return { valid: false, message: 'GSTIN is required' };
  }
  
  const cleaned = gstin.toUpperCase().replace(/\s/g, '');
  
  // Length check
  if (cleaned.length !== 15) {
    return { valid: false, message: `GSTIN must be 15 characters (got ${cleaned.length})` };
  }
  
  // Format: 2 digits state code + 10 char PAN + 1 digit entity + Z + 1 checksum
  const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
  if (!pattern.test(cleaned)) {
    return { valid: false, message: 'Invalid GSTIN format' };
  }
  
  // State code validation (01-37 + some special codes)
  const stateCode = parseInt(cleaned.substring(0, 2), 10);
  const validStateCodes = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 97, 99
  ];
  if (!validStateCodes.includes(stateCode)) {
    return { valid: false, message: `Invalid state code: ${stateCode}` };
  }
  
  // Checksum validation using Luhn algorithm for GSTIN
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const idx = chars.indexOf(cleaned[i]);
    let factor = (i % 2 === 0) ? 1 : 2;
    let product = idx * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const checkDigit = (36 - (sum % 36)) % 36;
  const expectedCheckChar = chars[checkDigit];
  
  if (cleaned[14] !== expectedCheckChar) {
    return { valid: false, message: `Invalid checksum (expected ${expectedCheckChar})` };
  }
  
  return { valid: true, message: 'Valid GSTIN' };
}

// PAN validation
export function validatePAN(pan: string): { valid: boolean; message: string } {
  if (!pan || typeof pan !== 'string') {
    return { valid: false, message: 'PAN is required' };
  }
  
  const cleaned = pan.toUpperCase().replace(/\s/g, '');
  
  if (cleaned.length !== 10) {
    return { valid: false, message: `PAN must be 10 characters (got ${cleaned.length})` };
  }
  
  // Format: 5 letters + 4 digits + 1 letter
  const pattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  if (!pattern.test(cleaned)) {
    return { valid: false, message: 'Invalid PAN format' };
  }
  
  // 4th character indicates entity type
  const entityTypes: Record<string, string> = {
    'A': 'Association of Persons',
    'B': 'Body of Individuals',
    'C': 'Company',
    'F': 'Firm',
    'G': 'Government',
    'H': 'HUF',
    'L': 'Local Authority',
    'J': 'Artificial Juridical Person',
    'P': 'Individual',
    'T': 'Trust',
    'K': 'Krishi (Agriculture)',
  };
  
  const entityChar = cleaned[3];
  if (!entityTypes[entityChar]) {
    return { valid: false, message: `Invalid entity type: ${entityChar}` };
  }
  
  return { valid: true, message: `Valid PAN (${entityTypes[entityChar]})` };
}

// Phone validation (Indian)
export function validatePhone(phone: string): { valid: boolean; message: string } {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, message: 'Phone is required' };
  }
  
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Accept 10-digit or with +91/91 prefix
  const pattern = /^(?:\+?91)?[6-9][0-9]{9}$/;
  if (!pattern.test(cleaned)) {
    return { valid: false, message: 'Invalid Indian phone number' };
  }
  
  return { valid: true, message: 'Valid phone number' };
}

// ERP ID validation (common patterns)
export function validateERPId(erpId: string): { valid: boolean; message: string } {
  if (!erpId || typeof erpId !== 'string') {
    return { valid: false, message: 'ERP ID is required' };
  }
  
  // Common ERP ID patterns
  const patterns = [
    /^[A-Z]{2}[0-9]{15,18}[A-Z]?$/,  // Like FE089200180756601D
    /^[A-Z]{1,3}[0-9]{6,12}$/,        // Simple alphanumeric
    /^[0-9]{8,15}$/,                   // Pure numeric
    /^SKU-[A-Z0-9]+$/i,               // SKU prefix
    /^PROD-[A-Z0-9]+$/i,              // PROD prefix
  ];
  
  const cleaned = erpId.toUpperCase().trim();
  const isValid = patterns.some(p => p.test(cleaned));
  
  return {
    valid: isValid,
    message: isValid ? 'Valid ERP ID format' : 'Unrecognized ERP ID format'
  };
}

// GST calculation validation
export function validateGSTCalculation(
  taxableAmount: number,
  gstRate: number,
  expectedGst: number,
  tolerance: number = 0.50
): { valid: boolean; message: string; calculatedGst: number; difference: number } {
  const calculatedGst = (taxableAmount * gstRate) / 100;
  const difference = Math.abs(calculatedGst - expectedGst);
  
  return {
    valid: difference <= tolerance,
    message: difference <= tolerance 
      ? 'GST calculation correct' 
      : `GST mismatch: calculated ₹${calculatedGst.toFixed(2)} vs provided ₹${expectedGst.toFixed(2)}`,
    calculatedGst,
    difference
  };
}

// Total validation
export function validateTotalCalculation(
  subtotal: number,
  gst: number,
  grandTotal: number,
  tolerance: number = 0.50
): { valid: boolean; message: string; calculatedTotal: number; difference: number } {
  const calculatedTotal = subtotal + gst;
  const difference = Math.abs(calculatedTotal - grandTotal);
  
  return {
    valid: difference <= tolerance,
    message: difference <= tolerance 
      ? 'Total calculation correct' 
      : `Total mismatch: calculated ₹${calculatedTotal.toFixed(2)} vs provided ₹${grandTotal.toFixed(2)}`,
    calculatedTotal,
    difference
  };
}

// Invoice number validation
export function validateInvoiceNumber(invoiceNo: string): { valid: boolean; message: string } {
  if (!invoiceNo || typeof invoiceNo !== 'string') {
    return { valid: false, message: 'Invoice number is required' };
  }
  
  const cleaned = invoiceNo.trim();
  
  if (cleaned.length < 3) {
    return { valid: false, message: 'Invoice number too short' };
  }
  
  if (cleaned.length > 50) {
    return { valid: false, message: 'Invoice number too long' };
  }
  
  // Common patterns
  const patterns = [
    /^[A-Z]{2,5}\/\d{2}-\d{2}\/\d+$/,  // Like PSSE/26-27/15792
    /^INV-\d+$/i,
    /^[A-Z0-9\-\/]+$/,
  ];
  
  const isValid = patterns.some(p => p.test(cleaned));
  
  return {
    valid: isValid,
    message: isValid ? 'Valid invoice format' : 'Unusual invoice format (may still be valid)'
  };
}

// Full invoice validation
export interface ValidationResult {
  passed: string[];
  warnings: string[];
  errors: string[];
  score: number;
}

export function validateInvoiceData(data: {
  seller?: { gstin?: string; pan?: string; phone?: string };
  buyer?: { phone?: string; name?: string };
  invoice?: { number?: string; date?: string };
  totals?: { subtotal?: number; taxableAmount?: number; gst?: number; grandTotal?: number };
  items?: Array<{ erpId?: string; quantity?: number; unitPrice?: number; total?: number }>;
  gstRate?: number;
}): ValidationResult {
  const result: ValidationResult = {
    passed: [],
    warnings: [],
    errors: [],
    score: 0
  };
  
  // Seller validations
  if (data.seller?.gstin) {
    const gstinResult = validateGSTIN(data.seller.gstin);
    if (gstinResult.valid) {
      result.passed.push(`Seller GSTIN valid: ${data.seller.gstin}`);
    } else {
      result.errors.push(`Seller GSTIN: ${gstinResult.message}`);
    }
  } else {
    result.warnings.push('Seller GSTIN not found');
  }
  
  if (data.seller?.pan) {
    const panResult = validatePAN(data.seller.pan);
    if (panResult.valid) {
      result.passed.push(`Seller PAN valid: ${data.seller.pan}`);
    } else {
      result.warnings.push(`Seller PAN: ${panResult.message}`);
    }
  }
  
  if (data.seller?.phone) {
    const phoneResult = validatePhone(data.seller.phone);
    if (phoneResult.valid) {
      result.passed.push(`Seller phone valid`);
    } else {
      result.warnings.push(`Seller phone: ${phoneResult.message}`);
    }
  }
  
  // Buyer validations
  if (data.buyer?.name) {
    result.passed.push(`Buyer identified: ${data.buyer.name}`);
  } else {
    result.errors.push('Buyer name not found');
  }
  
  if (data.buyer?.phone) {
    const phoneResult = validatePhone(data.buyer.phone);
    if (phoneResult.valid) {
      result.passed.push(`Buyer phone valid`);
    } else {
      result.warnings.push(`Buyer phone: ${phoneResult.message}`);
    }
  }
  
  // Invoice validations
  if (data.invoice?.number) {
    const invResult = validateInvoiceNumber(data.invoice.number);
    if (invResult.valid) {
      result.passed.push(`Invoice number valid: ${data.invoice.number}`);
    } else {
      result.warnings.push(invResult.message);
    }
  } else {
    result.errors.push('Invoice number not found');
  }
  
  if (data.invoice?.date) {
    result.passed.push(`Invoice date found: ${data.invoice.date}`);
  } else {
    result.warnings.push('Invoice date not found');
  }
  
  // Totals validation
  if (data.totals) {
    const { subtotal, taxableAmount, gst, grandTotal } = data.totals;
    
    if (subtotal !== undefined && gst !== undefined && grandTotal !== undefined) {
      const totalResult = validateTotalCalculation(
        taxableAmount ?? subtotal,
        gst,
        grandTotal
      );
      if (totalResult.valid) {
        result.passed.push('Total calculation verified');
      } else {
        result.warnings.push(totalResult.message);
      }
    }
    
    if (taxableAmount !== undefined && gst !== undefined && data.gstRate) {
      const gstResult = validateGSTCalculation(taxableAmount, data.gstRate, gst);
      if (gstResult.valid) {
        result.passed.push(`GST @${data.gstRate}% verified`);
      } else {
        result.warnings.push(gstResult.message);
      }
    }
  }
  
  // Items validation
  if (data.items && data.items.length > 0) {
    result.passed.push(`${data.items.length} line items found`);
    
    let validErpCount = 0;
    for (const item of data.items) {
      if (item.erpId) {
        const erpResult = validateERPId(item.erpId);
        if (erpResult.valid) validErpCount++;
      }
    }
    
    if (validErpCount > 0) {
      result.passed.push(`${validErpCount} valid ERP IDs`);
    }
  } else {
    result.warnings.push('No line items found');
  }
  
  // Calculate score
  const totalChecks = result.passed.length + result.warnings.length + result.errors.length;
  if (totalChecks > 0) {
    result.score = Math.round((result.passed.length / totalChecks) * 100);
  }
  
  return result;
}

// Number to words (Indian format)
export function numberToWords(n: number): string {
  if (n === 0) return 'Zero';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  function inWords(num: number): string {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + inWords(num % 100) : '');
    if (num < 100000) return inWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + inWords(num % 1000) : '');
    if (num < 10000000) return inWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + inWords(num % 100000) : '');
    return inWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + inWords(num % 10000000) : '');
  }
  
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  
  let result = inWords(rupees) + ' Rupees';
  if (paise > 0) {
    result += ' and ' + inWords(paise) + ' Paise';
  }
  result += ' Only';
  
  return result;
}
