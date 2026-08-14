import { AIProviderConfig, ExtractionResult } from '../ai-provider';
import { normalizeExtraction, computeConfidence, buildExtractionPrompt } from '../ai-extract';

export async function extractWithBazaarLink(text: string, config: AIProviderConfig): Promise<ExtractionResult> {
  const prompt = buildExtractionPrompt(text);
  
  try {
    const url = `${config.url}/chat/completions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${config.apiKey}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        model: config.model || 'glm-4.7',
        messages: [
          { role: 'system', content: 'You are an expert at data extraction from invoices. Return exactly the JSON format requested.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      throw new Error(`BazaarLink API error: ${response.statusText}`);
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '{}';
    
    let parsedData = {};
    try {
      parsedData = JSON.parse(rawText);
    } catch (e) {
      const match = rawText.match(/```json\n([\s\S]*?)\n```/);
      if (match) {
        parsedData = JSON.parse(match[1]);
      }
    }

    const normalized = normalizeExtraction(parsedData as Record<string, unknown>);
    const result: ExtractionResult = {
      ...normalized,
      items: normalized.items || [],
      confidence: 0,
      provider: 'BazaarLink',
      rawResponse: rawText
    };
    
    result.confidence = computeConfidence(result);
    return result;
  } catch (error) {
    return {
      items: [],
      confidence: 0,
      provider: 'BazaarLink',
      rawResponse: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
