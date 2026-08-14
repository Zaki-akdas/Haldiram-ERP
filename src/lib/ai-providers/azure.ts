import { AIProviderConfig, ExtractionResult } from '../ai-provider';
import { normalizeExtraction, computeConfidence, buildExtractionPrompt } from '../ai-extract';

export async function extractWithAzure(text: string, config: AIProviderConfig): Promise<ExtractionResult> {
  const prompt = buildExtractionPrompt(text);
  
  try {
    const url = `${config.endpoint}/openai/deployments/${config.deployment || 'gpt-4o-mini'}/chat/completions?api-version=${config.apiVersion || '2024-06-01'}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'api-key': config.apiKey || '', 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'Extract invoice data and return JSON only.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      throw new Error(`Azure API error: ${response.statusText}`);
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '{}';
    
    let parsedData = {};
    try {
      parsedData = JSON.parse(rawText);
    } catch (e) {
       // fallback parsing if needed
    }

    const normalized = normalizeExtraction(parsedData as Record<string, unknown>);
    const result: ExtractionResult = {
      ...normalized,
      items: normalized.items || [],
      confidence: 0,
      provider: 'Azure OpenAI',
      rawResponse: rawText
    };
    
    result.confidence = computeConfidence(result);
    return result;
  } catch (error) {
    return {
      items: [],
      confidence: 0,
      provider: 'Azure OpenAI',
      rawResponse: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
