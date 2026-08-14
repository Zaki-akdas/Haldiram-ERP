export type AIProviderType = 'ollama' | 'gemini' | 'azure' | 'bazaarlink';

export interface AIProviderConfig {
  type: AIProviderType;
  name: string;
  enabled: boolean;
  url?: string;
  apiKey?: string;
  model?: string;
  timeout?: number;
  endpoint?: string;
  deployment?: string;
  apiVersion?: string;
}

export interface ExtractionResult {
  invoiceNumber?: string;
  invoiceDate?: string;
  customerName?: string;
  customerGSTIN?: string;
  customerAddress?: string;
  items: ExtractionItem[];
  subtotal?: number;
  taxableAmount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalGst?: number;
  grandTotal?: number;
  confidence: number;
  provider: string;
  rawResponse?: string;
}

export interface ExtractionItem {
  srNo?: number;
  erpId?: string;
  productName: string;
  hsnCode?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discount?: number;
  taxableAmount?: number;
  gstRate?: number;
  gstAmount?: number;
  totalAmount: number;
}

export function getAvailableProviders(): AIProviderConfig[] {
  const providers: AIProviderConfig[] = [];
  
  if (process.env.GEMINI_API_KEY) {
    providers.push({
      type: 'gemini', name: 'Google Gemini', enabled: true,
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite',
    });
  }
  if (process.env.AZURE_OPENAI_API_KEY) {
    providers.push({
      type: 'azure', name: 'Azure OpenAI', enabled: true,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini',
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-06-01',
    });
  }
  if (process.env.AI_API_KEY) {
    providers.push({
      type: 'bazaarlink', name: 'BazaarLink', enabled: true,
      url: process.env.AI_BASE_URL || 'https://bazaarlink.ai/api/v1',
      apiKey: process.env.AI_API_KEY,
      model: process.env.AI_MODEL || 'glm-4.7',
    });
  }
  if (process.env.OLLAMA_URL) {
    providers.push({
      type: 'ollama', name: 'Ollama (Local)', enabled: true,
      url: process.env.OLLAMA_URL,
      model: process.env.OLLAMA_MODEL || 'llama3:latest',
      timeout: Number(process.env.OLLAMA_TIMEOUT) || 60000,
    });
  }
  return providers;
}

export function getDefaultProvider(): AIProviderConfig | null {
  const providers = getAvailableProviders();
  return providers.length > 0 ? providers[0] : null;
}
