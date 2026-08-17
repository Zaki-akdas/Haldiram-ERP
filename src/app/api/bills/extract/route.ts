import { NextResponse } from 'next/server';
import { extractBillFromText, extractBillFromFileContent } from '@/lib/bill-extractor';
import { validateInvoiceData } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let textToParse = '';
    let fileName = 'Pasted Text';
    let fileType = 'text';

    if (contentType.includes('application/json')) {
      const json = await request.json();
      textToParse = json.text || '';
      fileName = json.fileName || 'Pasted Text';
      fileType = json.fileType || 'text';
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const textData = formData.get('text') as string;

      if (file) {
        fileName = file.name;
        fileType = file.type;
        const buffer = Buffer.from(await file.arrayBuffer());
        textToParse = buffer.toString('utf-8');
      } else if (textData) {
        textToParse = textData;
      }
    } else {
      textToParse = await request.text();
    }

    if (!textToParse) {
      return NextResponse.json({ error: 'No content or file provided for extraction' }, { status: 400 });
    }

    const extracted = extractBillFromText(textToParse);
    const validation = validateInvoiceData(extracted);

    return NextResponse.json({
      extraction: extracted,
      validation,
      fileName,
      fileType,
    });

  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}