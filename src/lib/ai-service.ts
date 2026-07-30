import { callOllama } from './ai-providers/ollama';
import { callGemini } from './ai-providers/gemini';
import { callAzureOpenAI } from './ai-providers/azure';
import { callBazaarLink } from './ai-providers/bazaarlink';
import { computeConfidence, normalizeExtraction } from './ai-extract';
import type { AIProvider, AIConfig, AIExtractionResult } from './ai-provider';
import { getDefaultConfig } from './ai-provider';

export { type AIProvider, type AIConfig, type AIExtractionResult } from './ai-provider';
export { getDefaultConfig } from './ai-provider';

export async function extractWithProvider(text: string, config: AIConfig): Promise<AIExtractionResult> {
  const truncated = text.length > 20000 ? text.substring(0, 20000) + '\n\n[TRUNCATED]' : text;

  switch (config.provider) {
    case 'ollama': {
      const result = await callOllama(truncated, config.model, 60000);
      if (result.error || !result.raw) return result;
      return {
        ...result,
        normalized: normalizeExtraction(result.raw),
        confidence: computeConfidence(normalizeExtraction(result.raw)),
      };
    }
    case 'gemini': {
      const result = await callGemini(truncated, config.model, config.maxTokens);
      if (result.error || !result.raw) return result;
      return {
        ...result,
        normalized: normalizeExtraction(result.raw),
        confidence: computeConfidence(normalizeExtraction(result.raw)),
      };
    }
    case 'azure': {
      const result = await callAzureOpenAI(truncated, config.model, config.maxTokens);
      if (result.error || !result.raw) return result;
      return {
        ...result,
        normalized: normalizeExtraction(result.raw),
        confidence: computeConfidence(normalizeExtraction(result.raw)),
      };
    }
    case 'bazaarlink': {
      const result = await callBazaarLink(truncated, config.model, 60000);
      if (result.error || !result.raw) return result;
      return {
        ...result,
        normalized: normalizeExtraction(result.raw),
        confidence: computeConfidence(normalizeExtraction(result.raw)),
      };
    }
    default:
      return { raw: null, normalized: null, confidence: 0, error: `Unknown provider: ${config.provider}` };
  }
}
