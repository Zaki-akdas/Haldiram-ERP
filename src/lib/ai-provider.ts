export type AIProvider = 'ollama' | 'gemini' | 'azure' | 'bazaarlink';

export interface AIConfig {
  provider: AIProvider;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface AIExtractionResult {
  raw: any;
  normalized: any;
  confidence: number;
  error?: string;
}

export function getDefaultConfig(provider: AIProvider): AIConfig {
  switch (provider) {
    case 'ollama':
      return {
        provider: 'ollama',
        model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
        temperature: 0.1,
        maxTokens: 4096,
      };
    case 'gemini':
      return {
        provider: 'gemini',
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite',
        temperature: 0.1,
        maxTokens: 8192,
      };
    case 'azure':
      return {
        provider: 'azure',
        model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini',
        temperature: 0.1,
        maxTokens: 4096,
      };
    case 'bazaarlink':
      return {
        provider: 'bazaarlink',
        model: process.env.AI_MODEL || 'glm-4.7',
        temperature: 0.1,
        maxTokens: 4096,
      };
  }
}

export function isProviderConfigured(provider: AIProvider): boolean {
  switch (provider) {
    case 'ollama':
      return true; // always available locally
    case 'gemini':
      return !!process.env.GEMINI_API_KEY;
    case 'azure':
      return !!(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT);
    case 'bazaarlink':
      return !!process.env.AI_API_KEY && !!process.env.AI_BASE_URL;
  }
}

export function getAvailableProviders(): AIProvider[] {
  const providers: AIProvider[] = ['ollama'];
  if (process.env.GEMINI_API_KEY) providers.push('gemini');
  if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) providers.push('azure');
  if (process.env.AI_API_KEY && process.env.AI_BASE_URL) providers.push('bazaarlink');
  return providers;
}
