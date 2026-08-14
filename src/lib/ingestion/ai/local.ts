import { AIProviderConfig } from '@/lib/ai-provider';
import { extractWithProvider } from './provider';

export async function extractWithLocalAI(text: string, config: AIProviderConfig): Promise<{
  items: any[];
  confidence: number;
  provider: string;
  rawResponse?: string;
}> {
  return extractWithProvider(text, config);
}
