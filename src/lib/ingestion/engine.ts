import { IngestFormat, IngestResult, IngestRequest, IngestResponse, IngestItem } from './types';
import { parseCSV } from './parsers/csv';
import { parseUnstructuredText } from './parsers/text';
import { parseJSON } from './parsers/json';
import { getAvailableProviders, getDefaultProvider, AIProviderConfig } from '@/lib/ai-provider';

function detectFormat(fileName: string, text: string): IngestFormat {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  
  switch (ext) {
    case 'csv':
      return 'csv';
    case 'tsv':
      return 'tsv';
    case 'psv':
      return 'psv';
    case 'json':
      return 'json';
    case 'txt':
    case 'text':
      return 'text';
    case 'pdf':
      return 'pdf';
    case 'xlsx':
    case 'xls':
    case 'excel':
      return 'excel';
    default:
      // Detect from content. Use per-line averages like the universal extractor: a single
      // '|' inside a bullet line ("Quantity: 180 | MRP: ₹10.00") or ',' inside a number
      // ("8,247.74") must not misroute the whole document as PSV/CSV.
      if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
        return 'json';
      }
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      const lineCount = lines.length || 1;
      const countDelim = (ch: string) =>
        lines.reduce((acc, line) => acc + (line.match(new RegExp(ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0);
      if (countDelim('\t') / lineCount >= 2) return 'tsv';
      if (countDelim('|') / lineCount >= 2) return 'psv';
      if (countDelim(',') / lineCount >= 2) return 'csv';
      return 'unstructured';
  }
}

function normalizeToStandard(result: IngestResult): IngestResult {
  return {
    ...result,
    items: result.items.map(item => ({
      ...item,
      unit: item.unit || 'PCS',
      quantity: Math.max(0, item.quantity),
      gstRate: Math.min(28, Math.max(0, item.gstRate)),
    })),
  };
}

export async function ingestData(request: IngestRequest): Promise<IngestResponse> {
  const startTime = Date.now();
  const text = request.text || '';
  const fileName = request.fileName || 'input';

  if (!text && !request.fileName) {
    return {
      success: false,
      result: {
        format: 'text',
        header: {},
        items: [],
        confidence: 0,
        warnings: ['No input data provided'],
        processingTimeMs: 0,
      },
      error: 'No input data provided',
    };
  }

  const format = detectFormat(fileName, text);
  let result: IngestResult;

  try {
    switch (format) {
      case 'json':
        result = parseJSON(text);
        break;
      case 'csv':
      case 'tsv':
      case 'psv':
        result = parseCSV(text, fileName);
        break;
      case 'pdf':
        // PDF needs buffer, handled in API route
        result = {
          format: 'pdf',
          header: {},
          items: [],
          confidence: 0,
          warnings: ['PDF parsing requires file upload via API'],
          processingTimeMs: 0,
        };
        break;
      case 'excel':
        // Excel needs buffer, handled in API route
        result = {
          format: 'excel',
          header: {},
          items: [],
          confidence: 0,
          warnings: ['Excel parsing requires file upload via API'],
          processingTimeMs: 0,
        };
        break;
      case 'text':
      default:
        result = parseUnstructuredText(text);
        break;
    }
  } catch (error) {
    return {
      success: false,
      result: {
        format,
        header: {},
        items: [],
        confidence: 0,
        warnings: [`Parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        processingTimeMs: Date.now() - startTime,
      },
      error: `Parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }

  // If unstructured text and low confidence, try AI enhancement
  if (format === 'unstructured' && result.confidence < 70 && text.length > 20) {
    const providers = getAvailableProviders();
    let aiConfig: AIProviderConfig | undefined;

    if (request.preferredProvider) {
      aiConfig = providers.find(p => p.type === request.preferredProvider);
    }
    
    if (!aiConfig) {
      if (request.deploymentMode === 'local') {
        aiConfig = providers.find(p => p.type === 'ollama');
      } else {
        aiConfig = getDefaultProvider() || undefined;
      }
    }

    if (aiConfig) {
      try {
        let aiResult;
        if (request.deploymentMode === 'local' && aiConfig.type === 'ollama') {
          const { extractWithLocalAI } = await import('./ai/local');
          aiResult = await extractWithLocalAI(text, aiConfig);
        } else {
          const { extractWithCloudAI } = await import('./ai/cloud');
          aiResult = await extractWithCloudAI(text, aiConfig);
        }

        if (aiResult.confidence > result.confidence && aiResult.items.length > 0) {
          result = {
            ...result,
            items: aiResult.items.map(item => ({
              ...item,
              unit: item.unit || 'PCS',
              quantity: Math.max(0, item.quantity || 1),
              gstRate: Math.min(28, Math.max(0, item.gstRate || 5)),
            })) as IngestItem[],
            confidence: aiResult.confidence,
            provider: aiResult.provider,
            warnings: [...result.warnings, `AI-enhanced extraction via ${aiResult.provider}`],
          };
        }
      } catch {
        // AI enhancement failed, keep regex result
        result.warnings.push('AI enhancement failed, using regex-based extraction');
      }
    }
  }

  result = normalizeToStandard(result);
  result.processingTimeMs = Date.now() - startTime;

  return {
    success: true,
    result,
  };
}
