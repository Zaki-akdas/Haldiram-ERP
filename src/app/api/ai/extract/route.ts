import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/db';
import { extractTextFromFile } from '@/lib/ai-extract';
import { extractWithProvider, getDefaultConfig } from '@/lib/ai-service';

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
      const provider = (formData.get('provider') as string) || 'bazaarlink';

      if (textContent) {
        text = textContent;
      } else if (file) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        try {
          text = await extractTextFromFile(buffer, ext);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Text extraction failed';
          return NextResponse.json({
            extracted: null,
            validation: {
              passed: [],
              warnings: [message],
              errors: [`Text extraction failed for "${file.name}": ${message}`],
              score: 0,
            },
            recommendation: {
              format: provider,
              confidence: 0,
              reason: `Could not read file: ${message}`,
              tips: ['Try Fast/regex mode instead', 'Ensure file is not password-protected', 'Use text-based PDFs or Excel files'],
            },
            fileName: file.name,
            fileSize: text.length,
            aiError: message,
            fallbackToRegex: true,
          });
        }
      }

      if (!text || text.trim().length === 0) {
        return NextResponse.json({
          extracted: null,
          validation: {
            passed: [],
            warnings: ['File appears to be empty or image-only'],
            errors: [`Could not extract text from "${file?.name || 'file'}". It may be image-only/scanned, password-protected, or corrupted.`],
            score: 0,
          },
          recommendation: {
            format: provider,
            confidence: 0,
            reason: 'No readable text found in file',
            tips: ['Try Fast/regex mode instead', 'Use OCR-enabled tools for scanned PDFs', 'Ensure file is not password-protected'],
          },
          fileName: file?.name || 'unknown',
          fileSize: 0,
          aiError: 'Empty or unreadable file',
          fallbackToRegex: true,
        });
      }

      const result = await extractWithProvider(text, getDefaultConfig(provider as any));

      if (result.error || !result.normalized) {
        return NextResponse.json({
          extracted: null,
          validation: {
            passed: [],
            warnings: [result.error || 'AI extraction failed'],
            errors: [result.error || 'AI extraction failed'],
            score: 0,
          },
          recommendation: {
            format: provider,
            confidence: 0,
            reason: result.error || 'AI extraction failed',
            tips: ['Try Fast/regex mode instead', 'Ensure AI provider is configured'],
          },
          fileName: file?.name || 'ai-upload',
          fileSize: text.length,
          aiError: result.error,
          fallbackToRegex: true,
        });
      }

      let invoiceId: number | null = null;
      try {
        const supabase = getSupabaseAdmin();
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            file_name: 'ai-upload',
            file_type: `ai-${provider}`,
            file_size: text.length,
            extracted_data: result.normalized as any,
            validation_result: { aiError: null } as any,
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
        extracted: result.normalized,
        validation: {
          passed: [],
          warnings: [],
          errors: [],
          score: result.confidence,
        },
        recommendation: {
          format: provider,
          confidence: result.confidence,
          reason: `Extracted using ${provider}`,
          tips: ['Review extracted items before importing'],
        },
        fileName: file?.name || 'ai-upload',
        fileSize: text.length,
        invoiceId,
        aiError: null,
      });
    } else {
      const body = await request.json();
      text = body.text || body.content || '';
      const provider = body.provider || 'bazaarlink';

      if (!text || text.trim().length === 0) {
        return NextResponse.json({ error: 'No text provided' }, { status: 400 });
      }

      const result = await extractWithProvider(text, getDefaultConfig(provider as any));

      if (result.error || !result.normalized) {
        return NextResponse.json({
          extracted: null,
          validation: {
            passed: [],
            warnings: [result.error || 'AI extraction failed'],
            errors: [result.error || 'AI extraction failed'],
            score: 0,
          },
          recommendation: {
            format: provider,
            confidence: 0,
            reason: result.error || 'AI extraction failed',
            tips: ['Try Fast/regex mode instead'],
          },
          aiError: result.error,
          fallbackToRegex: true,
        });
      }

      return NextResponse.json({
        extracted: result.normalized,
        validation: {
          passed: [],
          warnings: [],
          errors: [],
          score: result.confidence,
        },
        recommendation: {
          format: provider,
          confidence: result.confidence,
          reason: `Extracted using ${provider}`,
          tips: ['Review extracted items before importing'],
        },
        aiError: null,
      });
    }
  } catch (error) {
    console.error('AI extraction error:', error);
    return NextResponse.json({
      error: 'Failed to extract with AI: ' + (error instanceof Error ? error.message : 'Unknown error'),
      aiError: error instanceof Error ? error.message : 'Unknown error',
      fallbackToRegex: true,
    }, { status: 500 });
  }
}
