import { NextResponse } from 'next/server';
import { convertPDFToText, convertExcelToCSV, convertCSVToJSON } from '@/lib/converters';
import { parseUniversalData } from '@/lib/universal-extractor';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let textToParse = '';
    let targetFormat = 'json';
    let originalFileName = 'Pasted Text';

    if (contentType.includes('application/json')) {
      const json = await request.json();
      textToParse = json.text || '';
      targetFormat = (json.targetFormat || 'json').toLowerCase();
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      targetFormat = ((formData.get('targetFormat') as string) || 'json').toLowerCase();
      
      if (file) {
        originalFileName = file.name;
        const filename = file.name.toLowerCase();
        const buffer = Buffer.from(await file.arrayBuffer());

        if (file.type === 'application/pdf' || filename.endsWith('.pdf')) {
          textToParse = await convertPDFToText(buffer);
        } else if (file.type.includes('spreadsheetml') || file.type.includes('ms-excel') || filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
          textToParse = convertExcelToCSV(buffer);
        } else {
          textToParse = buffer.toString('utf-8');
        }
      } else {
        textToParse = (formData.get('text') as string) || '';
      }
    } else {
      textToParse = await request.text();
    }

    if (!textToParse) {
      return NextResponse.json({ error: 'No content or file provided for extraction' }, { status: 400 });
    }

    const extracted = parseUniversalData(textToParse);

    let result: any;
    if (targetFormat === 'text') {
      result = textToParse;
    } else if (targetFormat === 'json') {
      result = extracted;
    } else if (targetFormat === 'csv') {
      if (extracted.items && extracted.items.length > 0) {
        const csvLines = [
          'S No,ERP ID,Product Name,HSN Code,MRP,Quantity,Unit Price,Taxable Amount,GST Rate %,GST Amount,Total Amount'
        ];
        extracted.items.forEach(item => {
          csvLines.push(
            `"${item.srNo || ''}","${item.erpId || ''}","${(item.productName || '').replace(/"/g, '""')}","${item.hsnCode || ''}",${item.mrp || 0},${item.quantity || 0},${item.unitPrice || 0},${item.taxableAmount || 0},${item.gstRate || 0},${item.gstAmount || 0},${item.totalAmount || 0}`
          );
        });
        result = csvLines.join('\n');
      } else {
        result = textToParse.split(/\r?\n/).filter(l => l.trim()).map(line => `"${line.replace(/"/g, '""')}"`).join('\n');
      }
    }

    return NextResponse.json({
      result,
      extraction: extracted,
      format: targetFormat.toUpperCase(),
      originalFile: originalFileName
    });

  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
