import { AIProviderConfig, ExtractionResult } from '@/lib/ai-provider';
import { normalizeExtraction, computeConfidence, buildExtractionPrompt } from '@/lib/ai-extract';

export interface AIExtractionResult {
  items: any[];
  confidence: number;
  provider: string;
  rawResponse?: string;
}

export async function extractWithProvider(text: string, config: AIProviderConfig): Promise<AIExtractionResult> {
  const prompt = buildExtractionPrompt(text);
  const controller = new AbortController();
  const timeoutMs = config.timeout || 60000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;
    let parsedData: Record<string, any> = {};

    switch (config.type) {
      case 'ollama':
        response = await fetch(`${config.url}/api/generate`, {
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
        if (!response.ok) throw new Error(`Ollama API error: ${response.statusText}`);
        const ollamaData = await response.json();
        try {
          parsedData = JSON.parse(ollamaData.response);
        } catch {
          if (typeof ollamaData.response === 'object') parsedData = ollamaData.response;
        }
        break;

      case 'gemini':
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-2.0-flash-lite'}:generateContent?key=${config.apiKey}`;
        response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Gemini API error: ${response.statusText}`);
        const geminiData = await response.json();
        const geminiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        try {
          parsedData = JSON.parse(geminiText);
        } catch {
          parsedData = {};
        }
        break;

      case 'azure':
        const azureUrl = `${config.endpoint}/openai/deployments/${config.deployment}/chat/completions?api-version=${config.apiVersion || '2024-06-01'}`;
        response = await fetch(azureUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': config.apiKey || ''
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            response_format: { type: 'json_object' }
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Azure API error: ${response.statusText}`);
        const azureData = await response.json();
        const azureText = azureData.choices?.[0]?.message?.content || '';
        try {
          parsedData = JSON.parse(azureText);
        } catch {
          parsedData = {};
        }
        break;

      case 'bazaarlink':
        const bazaarUrl = `${config.url}/chat/completions`;
        response = await fetch(bazaarUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model || 'glm-4.7',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            response_format: { type: 'json_object' }
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`BazaarLink API error: ${response.statusText}`);
        const bazaarData = await response.json();
        const bazaarText = bazaarData.choices?.[0]?.message?.content || '';
        try {
          parsedData = JSON.parse(bazaarText);
        } catch {
          parsedData = {};
        }
        break;

      default:
        throw new Error(`Unsupported provider type: ${config.type}`);
    }

    clearTimeout(timeoutId);

    const normalized = normalizeExtraction(parsedData);
    const result: AIExtractionResult = {
      items: normalized.items || [],
      confidence: 0,
      provider: config.name || config.type,
      rawResponse: JSON.stringify(parsedData),
    };

    result.confidence = computeConfidence({
      ...normalized,
      confidence: 0,
      provider: config.name || config.type,
    } as ExtractionResult);

    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      items: [],
      confidence: 0,
      provider: config.name || config.type,
      rawResponse: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
