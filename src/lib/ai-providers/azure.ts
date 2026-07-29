import { AIExtractionResult } from '../ai-provider';

export async function callAzureOpenAI(text: string, model: string, maxTokens: number): Promise<AIExtractionResult> {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-06-01';

  if (!apiKey || !endpoint) {
    return { raw: null, normalized: null, confidence: 0, error: 'Azure OpenAI credentials are not configured' };
  }

  const url = `${endpoint}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: buildPrompt(text).split('\n\n')[0],
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.1,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Azure OpenAI error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.trim().match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON object found in Azure OpenAI response');

    const parsed = JSON.parse(jsonMatch[0]);
    return { raw: parsed, normalized: parsed, confidence: 0, error: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Azure OpenAI request failed';
    return { raw: null, normalized: null, confidence: 0, error: message };
  }
}

function buildPrompt(text: string): string {
  return `You are an expert invoice data extractor for Indian tax invoices. Extract structured data from invoice/bill/document text and return ONLY valid JSON.

Output schema:
{
  "seller": { "name": "", "address": "", "gstin": "", "pan": "", "fssai": "", "phone": "" },
  "buyer": { "name": "", "address": "", "phone": "", "gstin": "" },
  "invoice": { "number": "", "date": "", "salesman": "", "beat": "", "employeeContact": "" },
  "items": [
    {
      "sno": 0, "erpId": "", "description": "", "hsn": "",
      "quantity": 0, "freeQty": 0, "unit": "PCS", "mrp": 0, "rate": 0,
      "discount": 0, "taxable": 0, "gstRate": 0, "cgst": 0, "sgst": 0,
      "gst": 0, "total": 0
    }
  ],
  "totals": {
    "totalQty": 0, "subtotal": 0, "discount": 0, "taxableAmount": 0,
    "cgst": 0, "sgst": 0, "igst": 0, "totalGst": 0, "grandTotal": 0,
    "roundOff": 0, "amountInWords": ""
  }
}

Rules:
- Return ONLY the JSON object. No markdown fences, no explanations.
- If a field is missing, use "" for strings, 0 for numbers, [] for arrays.
- "gst" = cgst + sgst + igst for each item.
- "total" = taxable + gst for each item.
- Extract ALL line items from item tables.
- For totals, prefer explicit "Grand Total" / "Total Amount" / "Balance Due" labels.
- Date format: keep as found.
- Phone numbers: extract 10-digit Indian numbers starting with 6-9.
- GSTIN: 15 character alphanumeric like 23AFOFS4394E1ZP.
- PAN: 10 character like AFOFS4394E.
- Product names: extract FULL product names including sizes like "BANSAL OIL 750", "MAIDA 30 KG", etc. Do NOT truncate at numbers.

Extract data from this document text:

${text}`;
}
