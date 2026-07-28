import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { pdfToCsv, excelToCsv, excelToCopyPaste, pdfToCopyPaste } from '@/lib/converters';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const targetFormat = (formData.get('targetFormat') as string) || 'csv';

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedInputs = ['pdf', 'xlsx', 'xls', 'csv'];
    if (!allowedInputs.includes(ext)) {
      return NextResponse.json({ error: `Unsupported input format: .${ext}` }, { status: 400 });
    }

    if (targetFormat !== 'csv' && targetFormat !== 'copy-paste') {
      return NextResponse.json({ error: `Unsupported target format: ${targetFormat}` }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let convertedText: string;
    let contentType: string;
    let extension: string;

    if (ext === 'pdf') {
      if (targetFormat === 'csv') {
        convertedText = await pdfToCsv(buffer);
        contentType = 'text/csv';
        extension = 'csv';
      } else {
        convertedText = await pdfToCopyPaste(buffer);
        contentType = 'text/plain';
        extension = 'txt';
      }
    } else if (ext === 'xlsx' || ext === 'xls') {
      if (targetFormat === 'csv') {
        convertedText = await excelToCsv(buffer);
        contentType = 'text/csv';
        extension = 'csv';
      } else {
        convertedText = await excelToCopyPaste(buffer);
        contentType = 'text/plain';
        extension = 'txt';
      }
    } else if (ext === 'csv') {
      if (targetFormat === 'csv') {
        convertedText = await file.text();
        contentType = 'text/csv';
        extension = 'csv';
      } else {
        convertedText = await excelToCopyPaste(buffer);
        contentType = 'text/plain';
        extension = 'txt';
      }
    } else {
      return NextResponse.json({ error: `Unsupported input format: .${ext}` }, { status: 400 });
    }

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const downloadName = `${baseName}_${targetFormat === 'csv' ? 'csv' : 'copy-paste'}.${extension}`;

    return new NextResponse(convertedText, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${downloadName}"`,
      },
    });
  } catch (error) {
    console.error('Conversion error:', error);
    return NextResponse.json({ error: 'Failed to convert file: ' + (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}
