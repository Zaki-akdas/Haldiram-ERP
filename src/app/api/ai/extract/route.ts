import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/db';
import { callOllama, normalizeExtraction, computeConfidence, extractTextFromFile } from '@/lib/ai-extract';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    let text = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const textContent = formData.get('textContent') as string | null;
      
      if (textContent) {
        text = textContent;
      } else if (file) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        text = await extractTextFromFile(buffer, ext);
      }
    } else {
      const body = await request.json();
      text = body.text || body.content || '';
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text or file provided' }, { status: 400 });
    }

    const truncated = text.length > 20000 ? text.substring(0, 20000) + '\n\n[TRUNCATED]' : text;

    let rawAi = null;
    let aiError = null;
    try {
      rawAi = await callOllama(truncated);
    } catch (err) {
      console.warn('Ollama extraction failed:', err);
      aiError = err instanceof Error ? err.message : 'Ollama unavailable';
    }

    let extracted: any;
    if (rawAi) {
      extracted = normalizeExtraction(rawAi);
      extracted.metadata.rawTextLength = text.length;
      extracted.metadata.extractionConfidence = computeConfidence(extracted);
    } else {
      extracted = {
        seller: { name: '', address: '', gstin: '', pan: '', fssai: '', phone: '' },
        buyer: { name: '', address: '', phone: '', gstin: '' },
        invoice: { number: '', date: '', salesman: '', beat: '', employeeContact: '' },
        items: [],
        totals: {
          totalQty: 0, subtotal: 0, discount: 0, taxableAmount: 0,
          cgst: 0, sgst: 0, igst: 0, totalGst: 0, grandTotal: 0,
          roundOff: 0, amountInWords: '',
        },
        metadata: {
          fileType: 'ai-fallback',
          extractionConfidence: 0,
          extractedAt: new Date().toISOString(),
          rawTextLength: text.length,
        },
      };
    }

    let invoiceId: number | null = null;
    try {
      const supabase = getSupabaseAdmin();
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          file_name: 'ai-upload',
          file_type: 'ai-ollama',
          file_size: text.length,
          extracted_data: extracted as any,
          validation_result: { aiError: aiError || null } as any,
          uploaded_by_id: user.id,
          status: 'pending',
        })
        .select()
        .single();
      if (!invoiceError && invoice) {
        invoiceId = invoice.id;
      }
    } catch {
      // ignore save errors
    }

    return NextResponse.json({
      extracted,
      validation: { 
        passed: [], 
        warnings: aiError ? [`AI model error: ${aiError}`] : [], 
        errors: aiError ? ['Ollama unavailable, showing empty result'] : [], 
        score: extracted.metadata.extractionConfidence 
      },
      recommendation: {
        format: 'ai-ollama',
        confidence: extracted.metadata.extractionConfidence,
        reason: rawAi ? 'Extracted using local Ollama model.' : 'Ollama unavailable. Please try Fast mode or ensure Ollama is running.',
        tips: ['Ensure Ollama is running locally', 'Install a fast model like llama3.2:3b or qwen2.5:3b', 'Set OLLAMA_MODEL env var to change model', 'Use Fast mode for instant conversion without AI'],
      },
      fileName: 'ai-upload',
      fileSize: text.length,
      invoiceId,
    });
  } catch (error) {
    console.error('AI extraction error:', error);
    return NextResponse.json({ error: 'Failed to extract with AI: ' + (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}
