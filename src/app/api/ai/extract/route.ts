import { NextResponse } from 'next/server';
import { extractWithProvider } from '@/lib/ai-service';
import { getAvailableProviders, getDefaultProvider } from '@/lib/ai-provider';
import { validateInvoiceData } from '@/lib/validation';
import { convertPDFToText } from '@/lib/converters';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const providerName = url.searchParams.get('provider');
    const providers = getAvailableProviders();
    const provider = providerName ? providers.find(p => p.type === providerName) : getDefaultProvider();

    if (!provider) {
      return NextResponse.json({ error: 'No AI providers available' }, { status: 500 });
    }

    let text = '';

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer());
        if (file.type === 'application/pdf') {
          text = await convertPDFToText(buffer);
        } else {
           return NextResponse.json({ error: 'Unsupported file type for this endpoint' }, { status: 400 });
        }
      } else {
        const textData = formData.get('text') as string;
        if (textData) text = textData;
      }
    } else {
      const json = await request.json();
      text = json.text;
    }

    if (!text) {
      return NextResponse.json({ error: 'No text or file provided' }, { status: 400 });
    }

    const extraction = await extractWithProvider(text, provider);
    const validation = validateInvoiceData(extraction);

    return NextResponse.json({
      extraction,
      validation,
      provider: provider.name
    });

  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
