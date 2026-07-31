// Invoice data extraction utilities

export interface ExtractedInvoice {
  seller: {
    name: string;
    address: string;
    gstin: string;
    pan: string;
    fssai?: string;
    phone: string;
  };
  buyer: {
    name: string;
    address: string;
    phone: string;
  };
  invoice: {
    number: string;
    date: string;
    salesman: string;
    beat: string;
    employeeContact?: string;
  };
  items: Array<{
    sno: number;
    erpId: string;
    description: string;
    hsn?: string;
    quantity: number;
    unit: string;
    rate: number;
    discount: number;
    taxable: number;
    gstRate: number;
    gst: number;
    total: number;
  }>;
  totals: {
    totalQty: number;
    subtotal: number;
    discount: number;
    taxableAmount: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
    grandTotal: number;
    amountInWords: string;
    roundOff: number;
    bankName: string;
    bankAccountNumber: string;
    bankIfscCode: string;
    vehicleNumber: string;
    additionalTerms: string;
  };
  metadata: {
    fileType: string;
    extractionConfidence: number;
    extractedAt: string;
  };
}

// Parse date strings in various formats
export function parseInvoiceDate(dateStr: string): string {
  if (!dateStr) return '';
  
  // Common Indian date formats
  const patterns = [
    // 18 Jul 2026 1:34 pm
    /(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)?/i,
    // 18/07/2026
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    // 2026-07-18
    /(\d{4})-(\d{1,2})-(\d{1,2})/,
    // 18-Jul-2026
    /(\d{1,2})-([A-Za-z]{3,})-(\d{4})/i,
  ];
  
  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      return dateStr.trim();
    }
  }
  
  return dateStr.trim();
}

// Extract GSTIN from text
export function extractGSTIN(text: string): string | null {
  const pattern = /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b/g;
  const matches = text.match(pattern);
  return matches ? matches[0] : null;
}

// Extract PAN from text
export function extractPAN(text: string): string | null {
  const pattern = /\b([A-Z]{5}[0-9]{4}[A-Z])\b/g;
  const matches = text.match(pattern);
  return matches ? matches[0] : null;
}

// Extract phone numbers
export function extractPhones(text: string): string[] {
  const pattern = /\b(?:\+?91[-\s]?)?([6-9][0-9]{9})\b/g;
  const matches = [...text.matchAll(pattern)];
  return [...new Set(matches.map(m => m[1]))];
}

// Extract invoice number
export function extractInvoiceNumber(text: string): string | null {
  const patterns = [
    /Invoice\s*(?:No\.?|Number|#)?\s*:?\s*([A-Z]{2,5}\/\d{2}-\d{2}\/\d+)/i,
    /(?:Invoice|Bill)\s*(?:No\.?|#)?\s*:?\s*([A-Z0-9\-\/]+)/i,
    /\b([A-Z]{2,5}\/\d{2}-\d{2}\/\d+)\b/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  
  return null;
}

// Extract amounts with rupee symbol
export function extractAmounts(text: string): number[] {
  const pattern = /₹?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
  const matches = [...text.matchAll(pattern)];
  return matches.map(m => parseFloat(m[1].replace(/,/g, '')));
}

// Parse line items from text
export function parseLineItems(lines: string[]): ExtractedInvoice['items'] {
  const items: ExtractedInvoice['items'] = [];
  
  // Common line item patterns
  const itemPattern = /^(\d+)\s+([A-Z0-9]{10,20})\s+(.+?)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i;
  
  let sno = 1;
  for (const line of lines) {
    const match = line.match(itemPattern);
    if (match) {
      items.push({
        sno: sno++,
        erpId: match[2],
        description: match[3].trim(),
        quantity: parseInt(match[4], 10),
        unit: 'PCS',
        rate: parseFloat(match[5]),
        discount: 0,
        taxable: parseFloat(match[6]),
        gstRate: 5, // Default, should be parsed
        gst: 0,
        total: parseFloat(match[7]),
      });
    }
  }
  
  return items;
}

// Heuristic text extraction (simulates PDF text extraction)
export function extractFromText(text: string): Partial<ExtractedInvoice> {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  const result: Partial<ExtractedInvoice> = {
    seller: {
      name: '',
      address: '',
      gstin: '',
      pan: '',
      phone: '',
    },
    buyer: {
      name: '',
      address: '',
      phone: '',
    },
    invoice: {
      number: '',
      date: '',
      salesman: '',
      beat: '',
    },
    items: [],
    totals: {
      totalQty: 0,
      subtotal: 0,
      discount: 0,
      taxableAmount: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalGst: 0,
      grandTotal: 0,
      amountInWords: '',
      roundOff: 0,
      bankName: '',
      bankAccountNumber: '',
      bankIfscCode: '',
      vehicleNumber: '',
      additionalTerms: '',
    },
    metadata: {
      fileType: 'text',
      extractionConfidence: 0,
      extractedAt: new Date().toISOString(),
    },
  };
  
  // Extract GSTIN (first one is usually seller, second is buyer if present)
  const gstins = text.match(/\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b/g) || [];
  if (gstins[0] && result.seller) result.seller.gstin = gstins[0];
  
  // Extract PAN
  const pans = text.match(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g) || [];
  if (pans[0] && result.seller) result.seller.pan = pans[0];
  
  // Extract phones
  const phones = extractPhones(text);
  if (phones[0] && result.seller) result.seller.phone = phones[0];
  if (phones[1] && result.buyer) result.buyer.phone = phones[1];
  
  // Extract invoice number
  const invoiceNo = extractInvoiceNumber(text);
  if (invoiceNo && result.invoice) result.invoice.number = invoiceNo;
  
  // Look for common patterns
  for (const line of lines) {
    // Seller name (usually at the top, in caps)
    if (/^[A-Z\s]{10,50}$/.test(line) && !result.seller?.name) {
      result.seller!.name = line;
    }
    
    // Bill To / Ship To
    if (/Bill\s*To|Ship\s*To|Customer/i.test(line)) {
      const idx = lines.indexOf(line);
      if (idx >= 0 && lines[idx + 1]) {
        result.buyer!.name = lines[idx + 1];
      }
    }
    
    // Salesman
    const salesmanMatch = line.match(/Salesman\s*:?\s*(.+)/i);
    if (salesmanMatch && result.invoice) {
      result.invoice.salesman = salesmanMatch[1].trim();
    }
    
    // Beat
    const beatMatch = line.match(/Beat\s*:?\s*(.+)/i);
    if (beatMatch && result.invoice) {
      result.invoice.beat = beatMatch[1].trim();
    }
    
    // Date
    const dateMatch = line.match(/Date\s*:?\s*(.+)/i);
    if (dateMatch && result.invoice) {
      result.invoice.date = parseInvoiceDate(dateMatch[1]);
    }
    
    // Grand Total
    const totalMatch = line.match(/(?:Grand\s*)?Total\s*:?\s*₹?\s*([\d,]+\.?\d*)/i);
    if (totalMatch && result.totals) {
      result.totals.grandTotal = parseFloat(totalMatch[1].replace(/,/g, ''));
    }
    
    // Amount in words
    if (/Rupees?.*Only/i.test(line) && result.totals) {
      result.totals.amountInWords = line;
    }
  }
  
  // Calculate confidence based on extracted fields
  let confidence = 0;
  if (result.seller?.gstin) confidence += 15;
  if (result.seller?.name) confidence += 10;
  if (result.buyer?.name) confidence += 10;
  if (result.invoice?.number) confidence += 15;
  if (result.invoice?.date) confidence += 10;
  if (result.totals?.grandTotal && result.totals.grandTotal > 0) confidence += 20;
  if (result.items && result.items.length > 0) confidence += 20;
  
  if (result.metadata) {
    result.metadata.extractionConfidence = Math.min(confidence, 100);
  }
  
  return result;
}

// Format recommendation based on file type
export interface FormatRecommendation {
  format: 'pdf' | 'excel' | 'image';
  confidence: number;
  reason: string;
  tips: string[];
}

export function getFormatRecommendation(fileType: string, hasText: boolean): FormatRecommendation {
  if (fileType === 'excel' || fileType === 'xlsx' || fileType === 'xls' || fileType === 'csv') {
    return {
      format: 'excel',
      confidence: 99,
      reason: 'Excel files provide structured data that can be parsed with near-perfect accuracy.',
      tips: [
        'Ensure column headers match expected fields',
        'Use consistent date format (DD/MM/YYYY)',
        'Include GSTIN in a dedicated column',
      ],
    };
  }
  
  if (fileType === 'pdf') {
    if (hasText) {
      return {
        format: 'pdf',
        confidence: 85,
        reason: 'Text-based PDF can be parsed with good accuracy using pattern matching.',
        tips: [
          'Ensure PDF is not password-protected',
          'Text-selectable PDFs work best',
          'Consistent formatting improves extraction',
        ],
      };
    } else {
      return {
        format: 'image',
        confidence: 60,
        reason: 'Image-based PDF requires OCR which has lower accuracy.',
        tips: [
          'High resolution improves OCR accuracy',
          'Clear, unrotated images work best',
          'Consider converting to text PDF if possible',
        ],
      };
    }
  }
  
  return {
    format: 'image',
    confidence: 50,
    reason: 'Image files require OCR processing.',
    tips: [
      'Upload high-resolution images',
      'Ensure good lighting and contrast',
      'Avoid shadows and reflections',
    ],
  };
}
