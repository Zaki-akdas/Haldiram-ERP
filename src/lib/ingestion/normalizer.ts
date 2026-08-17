import { IngestResult, IngestItem } from './types';
import { normalizeExtraction } from '@/lib/ai-extract';

export function normalizeAIResult(aiResult: unknown): IngestResult {
  const normalized = normalizeExtraction((aiResult ?? {}) as Record<string, unknown>);
  
  return {
    format: 'unstructured',
    header: {
      invoiceNumber: normalized.invoiceNumber,
      invoiceDate: normalized.invoiceDate,
      customerName: normalized.customerName,
      customerGSTIN: normalized.customerGSTIN,
      customerAddress: normalized.customerAddress,
      taxableAmount: normalized.taxableAmount,
      cgst: normalized.cgst,
      sgst: normalized.sgst,
      totalGst: normalized.totalGst,
      grandTotal: normalized.grandTotal,
    },
    items: (normalized.items || []).map((item) => ({
      srNo: item.srNo,
      erpId: item.erpId,
      productName: item.productName || 'Unknown Product',
      hsnCode: item.hsnCode,
      quantity: Math.max(0, item.quantity || 0),
      unit: item.unit || 'PCS',
      unitPrice: item.unitPrice || 0,
      discount: item.discount,
      taxableAmount: item.taxableAmount || 0,
      gstRate: Math.min(28, Math.max(0, item.gstRate || 5)),
      gstAmount: item.gstAmount || 0,
      totalAmount: item.totalAmount || 0,
      gstRateExplicit: item.gstRate !== undefined,
    })) as IngestItem[],
    confidence: normalized.confidence || 0,
    warnings: [],
    processingTimeMs: 0,
  };
}
