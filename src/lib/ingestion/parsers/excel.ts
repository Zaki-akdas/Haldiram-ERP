import { IngestFormat, IngestResult } from '../types';

export async function parseExcel(fileBuffer: Buffer, fileName: string): Promise<IngestResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  try {
    const xlsxModule = await import('xlsx');
    const XLSX = (xlsxModule as any).default || xlsxModule;
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    if (!worksheet) {
      return {
        format: 'excel',
        header: {},
        items: [],
        confidence: 0,
        warnings: ['No sheets found in Excel file'],
        processingTimeMs: Date.now() - startTime,
      };
    }

    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[];
    
    if (jsonData.length === 0) {
      return {
        format: 'excel',
        header: {},
        items: [],
        confidence: 0,
        warnings: ['Excel sheet is empty'],
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Convert to CSV-like format for unified parsing
    const headers = Object.keys(jsonData[0]);
    const csvLines = [
      headers.join(','),
      ...jsonData.map(row => headers.map(h => String(row[h] || '')).join(','))
    ];

    // Import CSV parser dynamically to avoid circular deps
    const { parseCSV } = await import('./csv');
    const csvText = csvLines.join('\n');
    const result = parseCSV(csvText, fileName);
    
    return {
      ...result,
      format: 'excel',
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      format: 'excel',
      header: {},
      items: [],
      confidence: 0,
      warnings: [`Excel parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      processingTimeMs: Date.now() - startTime,
    };
  }
}
