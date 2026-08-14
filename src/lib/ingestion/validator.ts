import { IngestResult } from './types';

export interface ValidationResult {
  score: number;
  issues: string[];
  suggestions: string[];
  isValid: boolean;
}

export function validateIngestionResult(result: IngestResult): ValidationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Header validation
  if (result.header.invoiceNumber) score += 15;
  else issues.push('Missing invoice number');
  
  if (result.header.invoiceDate) score += 10;
  else issues.push('Missing invoice date');
  
  if (result.header.customerName) score += 10;
  else issues.push('Missing customer name');

  // Items validation
  if (result.items.length > 0) {
    score += 20;
    const validItems = result.items.filter(item => 
      item.productName && item.productName !== 'Unknown Product' && item.quantity > 0
    );
    score += Math.min(20, validItems.length * 5);
    
    if (validItems.length === 0) {
      issues.push('No valid line items found');
    }
  } else {
    issues.push('No line items extracted');
  }

  // Financial validation
  if (result.header.grandTotal) score += 15;
  else issues.push('Missing grand total');
  
  if (result.header.totalGst || result.header.cgst || result.header.sgst) score += 10;
  else issues.push('Missing GST breakdown');

  // Calculate item totals
  const calculatedTotal = result.items.reduce((sum, item) => sum + item.totalAmount, 0);
  const headerTotal = result.header.grandTotal || 0;
  
  if (headerTotal > 0 && calculatedTotal > 0) {
    const diff = Math.abs(headerTotal - calculatedTotal);
    if (diff > headerTotal * 0.1) {
      issues.push(`Line item total (${calculatedTotal.toFixed(2)}) differs significantly from header total (${headerTotal.toFixed(2)})`);
      suggestions.push('Review line item amounts');
    } else {
      score += 10;
    }
  }

  // GST validation
  const calculatedGst = result.items.reduce((sum, item) => sum + item.gstAmount, 0);
  const headerGst = result.header.totalGst || 0;
  if (headerGst > 0 && calculatedGst > 0) {
    const gstDiff = Math.abs(headerGst - calculatedGst);
    if (gstDiff > 1) {
      issues.push(`GST amount mismatch: calculated ${calculatedGst.toFixed(2)}, header shows ${headerGst.toFixed(2)}`);
      suggestions.push('Verify GST rates and amounts');
    } else {
      score += 5;
    }
  }

  score = Math.min(100, score);

  return {
    score,
    issues,
    suggestions,
    isValid: score >= 60 && result.items.length > 0,
  };
}
