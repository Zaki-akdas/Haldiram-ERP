import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { pdfToCsv, excelToCsv, excelToCopyPaste, pdfToCopyPaste, csvToCopyPaste } from '@/lib/converters';
import { extractTextFromFile } from '@/lib/ai-extract';
import { AIProvider, getDefaultConfig, extractWithProvider } from '@/lib/ai-service';

export const dynamic = 'force-dynamic';

async function convertFast(buffer: Buffer, ext: string, targetFormat: string): Promise<{ text: string; extension: string }> {
  if (ext === 'pdf') {
    return targetFormat === 'csv'
      ? { text: await pdfToCsv(buffer), extension: 'csv' }
      : { text: await pdfToCopyPaste(buffer), extension: 'txt' };
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return targetFormat === 'csv'
      ? { text: await excelToCsv(buffer), extension: 'csv' }
      : { text: await excelToCopyPaste(buffer), extension: 'txt' };
  }
  if (ext === 'csv') {
    return targetFormat === 'csv'
      ? { text: buffer.toString('utf8'), extension: 'csv' }
      : { text: await csvToCopyPaste(buffer), extension: 'txt' };
  }
  throw new Error(`Unsupported input format: .${ext}`);
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const targetFormat = (formData.get('targetFormat') as string) || 'csv';
    const mode = (formData.get('mode') as string) || 'fast';
    const providerParam = (formData.get('provider') as string) || 'bazaarlink';

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

    const aiProvider = providerParam as AIProvider;

    // AI mode
    if (mode === 'ai') {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      let text: string;
      try {
        text = await extractTextFromFile(buffer, ext);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Text extraction failed';
        return NextResponse.json({
          error: `Could not extract text from ${ext.toUpperCase()} file: ${message}. Try Fast mode instead, or ensure the file is not password-protected or image-only.`,
        }, { status: 422 });
      }

      if (!text || text.trim().length === 0) {
        return NextResponse.json({
          error: `The ${ext.toUpperCase()} file appears to be empty, image-only/scanned, or contains no readable text. Try Fast mode for direct parsing, or use a text-based ${ext.toUpperCase()} file.`,
        }, { status: 422 });
      }

      const config = getDefaultConfig(aiProvider);
      const result = await extractWithProvider(text, config);

      if (!result.normalized || !result.normalized.items || result.normalized.items.length === 0) {
        const errorMsg = result.error || 'AI extraction returned no items';
        const fallback = await convertFast(buffer, ext, targetFormat);
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        return NextResponse.json({
          text: fallback.text,
          filename: `${baseName}_${targetFormat === 'csv' ? 'csv' : 'copy-paste'}.${fallback.extension}`,
          format: targetFormat,
          aiFallback: true,
          warning: `AI provider unavailable: ${errorMsg}. Returned verified Fast-mode output instead.`,
        });
      }

      const selectedProvider = aiProvider;
      const extracted = result.normalized;
      const confidence = result.confidence;

      if (targetFormat === 'csv') {
        const headers = ['S.No', 'Item Name', 'HSN/SAC', 'Qty', 'Unit', 'Rate', 'Taxable', 'GST Rate', 'CGST', 'SGST', 'GST Amount', 'Total'];
        const rows = extracted.items.map((item: any, i: number) => [
          i + 1,
          `"${(item.description || '').replace(/"/g, '""')}"`,
          item.hsn || '',
          item.quantity || 0,
          item.unit || 'PCS',
          item.rate || 0,
          item.taxable || 0,
          item.gstRate || 0,
          item.cgst || 0,
          item.sgst || 0,
          item.gst || 0,
          item.total || 0,
        ]);

        if (extracted.totals) {
          rows.push([
            '', 'TOTAL', '', extracted.totals.totalQty || 0, '', '',
            extracted.totals.taxableAmount || 0, '', '', '',
            extracted.totals.totalGst || 0, extracted.totals.grandTotal || 0
          ]);
        }

        const csv = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
        const providerLabel = selectedProvider === 'gemini' ? 'Gemini' : selectedProvider === 'azure' ? 'Azure OpenAI' : selectedProvider === 'bazaarlink' ? 'BazaarLink' : 'Ollama';
        const finalCsv = `# AI ${providerLabel} Extracted from: ${file.name}\n# Confidence: ${confidence}%\n# Seller: ${extracted.seller.name || 'N/A'}\n# Buyer: ${extracted.buyer.name || 'N/A'}\n\n${csv}`;

        return NextResponse.json({
          text: finalCsv,
          filename: `${file.name.replace(/\.[^/.]+$/, '')}_ai_${selectedProvider}.csv`,
          format: 'csv',
        });
      } else {
        let text = `# Converted from: ${file.name}\n`;
        const providerLabel = selectedProvider === 'gemini' ? 'Google Gemini' : selectedProvider === 'azure' ? 'Azure OpenAI' : selectedProvider === 'bazaarlink' ? 'BazaarLink' : 'Local Ollama';
        text += `# AI Provider: ${providerLabel}\n`;
        text += `# Date: ${new Date().toLocaleDateString('en-IN')}\n`;
        text += `# Confidence: ${confidence}%\n\n`;

        if (extracted.seller.name) {
          text += `## Seller\n`;
          text += `Company: ${extracted.seller.name}\n`;
          if (extracted.seller.gstin) text += `GSTIN: ${extracted.seller.gstin}\n`;
          if (extracted.seller.phone) text += `Phone: ${extracted.seller.phone}\n`;
          if (extracted.seller.address) text += `Address: ${extracted.seller.address}\n`;
          text += '\n';
        }

        if (extracted.buyer.name) {
          text += `## Customer\n`;
          text += `Name: ${extracted.buyer.name}\n`;
          if (extracted.buyer.phone) text += `Phone: ${extracted.buyer.phone}\n`;
          if (extracted.buyer.address) text += `Address: ${extracted.buyer.address}\n`;
          text += '\n';
        }

        if (extracted.items?.length) {
          text += `## Items\n`;
          text += `# | Item Name | HSN/SAC | Qty | Unit | Rate | GST | Total\n`;
          text += `|---|-----------|---------|-----|------|------|-----|------|\n`;
          extracted.items.forEach((item: any, i: number) => {
            text += `| ${i + 1} | ${item.description || ''} | ${item.hsn || ''} | ${item.quantity || 0} | ${item.unit || 'PCS'} | ${item.rate || 0} | ${item.gst || 0} | ${item.total || 0} |\n`;
          });
          text += '\n';
        }

        if (extracted.totals) {
          text += `## Totals\n`;
          text += `Subtotal: ${extracted.totals.taxableAmount || 0}\n`;
          text += `GST: ${extracted.totals.totalGst || 0}\n`;
          text += `Grand Total: ${extracted.totals.grandTotal || 0}\n`;
        }

        return NextResponse.json({
          text: text,
          filename: `${file.name.replace(/\.[^/.]+$/, '')}_ai_${selectedProvider}_copy-paste.txt`,
          format: 'copy-paste',
        });
      }
    }

    // Fast mode: existing logic
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { text: convertedText, extension } = await convertFast(buffer, ext, targetFormat);

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const downloadName = `${baseName}_${targetFormat === 'csv' ? 'csv' : 'copy-paste'}.${extension}`;

    return NextResponse.json({
      text: convertedText,
      filename: downloadName,
      format: targetFormat,
    });
  } catch (error) {
    console.error('Conversion error:', error);
    return NextResponse.json({ error: 'Failed to convert file: ' + (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}
