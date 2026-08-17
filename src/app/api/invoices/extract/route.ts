import { NextResponse } from 'next/server';
import { extractWithProvider } from '@/lib/ai-service';
import { extractWithRegex } from '@/lib/extraction';
import { getDefaultProvider } from '@/lib/ai-provider';
import { validateInvoiceData } from '@/lib/validation';
import { convertPDFToText } from '@/lib/converters';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { invoices, activityLogs } from '@/db/schema';
import type { ExtractionResult } from '@/lib/ai-provider';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') || 'ai';
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = '';
    
    if (file.type === 'application/pdf') {
      text = await convertPDFToText(buffer);
    } else {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    let extraction: ExtractionResult;
    if (mode === 'fast') {
      extraction = extractWithRegex(text) as ExtractionResult;
    } else {
      const provider = getDefaultProvider();
      if (!provider) {
        return NextResponse.json({ error: 'No AI provider available' }, { status: 500 });
      }
      extraction = await extractWithProvider(text, provider);
    }

    const validation = validateInvoiceData(extraction);

    const [invoice] = await db.insert(invoices).values({
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      extractedData: extraction,
      status: 'processed',
      uploadedById: user?.id ?? null,
      validationResult: validation,
    }).returning();

    if (user) {
      await db.insert(activityLogs).values({
        userId: user.id,
        activityType: 'invoice_uploaded',
        entityType: 'invoice',
        entityId: invoice.id,
        description: `Invoice ${file.name} uploaded and extracted`
      });
    }

    return NextResponse.json({
      invoice,
      extraction,
      validation
    });

  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
