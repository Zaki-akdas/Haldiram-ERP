import { AIProviderConfig, ExtractionResult } from '../ai-provider';
import { normalizeExtraction, computeConfidence, buildExtractionPrompt } from '../ai-extract';

export async function extractWithOllama(text: string, config: AIProviderConfig): Promise<ExtractionResult> {
  const prompt = buildExtractionPrompt(text);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout || 60000);

  try {
    const response = await fetch(`${config.url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model || 'llama3:latest',
        prompt: prompt,
        stream: false,
        format: 'json'
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    let parsedData = {};
    try {
      parsedData = JSON.parse(data.response);
    } catch (e) {
      if (typeof data.response === 'object') {
        parsedData = data.response;
      }
    }

    const normalized = normalizeExtraction(parsedData as Record<string, unknown>);
    const result: ExtractionResult = {
      ...normalized,
      items: normalized.items || [],
      confidence: 0,
      provider: 'Ollama (Local)',
      rawResponse: data.response
    };
    
    result.confidence = computeConfidence(result);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      items: [],
      confidence: 0,
      provider: 'Ollama (Local)',
      rawResponse: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
