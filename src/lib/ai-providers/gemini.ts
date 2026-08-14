import { AIProviderConfig, ExtractionResult } from '../ai-provider';
import { normalizeExtraction, computeConfidence, buildExtractionPrompt } from '../ai-extract';

export async function extractWithGemini(text: string, config: AIProviderConfig): Promise<ExtractionResult> {
  const prompt = buildExtractionPrompt(text);
  
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-2.0-flash-lite'}:generateContent?key=${config.apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
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
      provider: 'Google Gemini',
      rawResponse: rawText
    };
    
    result.confidence = computeConfidence(result);
    return result;
  } catch (error) {
    return {
      items: [],
      confidence: 0,
      provider: 'Google Gemini',
      rawResponse: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
