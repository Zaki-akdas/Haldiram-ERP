import { AIProviderConfig, ExtractionResult } from './ai-provider';
import { extractWithOllama } from './ai-providers/ollama';
import { extractWithGemini } from './ai-providers/gemini';
import { extractWithAzure } from './ai-providers/azure';
import { extractWithBazaarLink } from './ai-providers/bazaarlink';

export async function extractWithProvider(text: string, provider: AIProviderConfig): Promise<ExtractionResult> {
  try {
    switch (provider.type) {
      case 'ollama': return await extractWithOllama(text, provider);
      case 'gemini': return await extractWithGemini(text, provider);
      case 'azure': return await extractWithAzure(text, provider);
      case 'bazaarlink': return await extractWithBazaarLink(text, provider);
      default:
        return { items: [], confidence: 0, provider: 'unknown' };
    }
  } catch (error) {
    return {
      items: [], confidence: 0, provider: provider.name,
      rawResponse: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
