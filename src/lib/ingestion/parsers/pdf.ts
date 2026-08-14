import { IngestFormat, IngestResult } from '../types';
import { convertPDFToText } from '@/lib/converters';

export async function parsePDF(fileBuffer: Buffer): Promise<IngestResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  try {
    const text = await convertPDFToText(fileBuffer);

    if (!text || text.trim().length === 0) {
      return {
        format: 'pdf',
        header: {},
        items: [],
        confidence: 0,
        warnings: ['Unable to extract text from PDF'],
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Run the extracted text through the unstructured invoice parser so PDF
    // uploads produce line items (header, items, totals) instead of raw text.
    const { parseUnstructuredText } = await import('./text');
    const parsed = parseUnstructuredText(text);

    return {
      ...parsed,
      format: 'pdf' as IngestFormat,
      confidence: parsed.items.length > 0 ? parsed.confidence : 0,
      warnings: parsed.items.length > 0
        ? warnings
        : ['PDF text extracted but no line items detected. Use AI extraction for structured data.'],
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      format: 'pdf',
      header: {},
      items: [],
      confidence: 0,
      warnings: [`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      processingTimeMs: Date.now() - startTime,
    };
  }
}
