import { AIExtractionResult } from '../ai-provider';

export async function callBazaarLink(text: string, model: string, timeoutMs: number): Promise<AIExtractionResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const baseUrl = process.env.AI_BASE_URL || 'https://bazaarlink.ai/api/v1';
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    const message = 'AI_API_KEY is not configured';
    return { raw: null, normalized: null, confidence: 0, error: message };
  }

  const systemPrompt = `You are an expert invoice data extractor for Indian tax invoices. Extract structured data from invoice/bill/document text and return ONLY valid JSON.

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

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || process.env.AI_MODEL || 'llama3.2:3b',
        messages: [
          { role: 'system', content: 'You are an expert invoice data extractor.' },
          { role: 'user', content: systemPrompt },
        ],
        temperature: 0.1,
        max_tokens: 4096,
        stop: ['\n\n\n', '```'],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`BazaarLink error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const jsonMatch = raw.trim().match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON object found in model response');

    const parsed = JSON.parse(jsonMatch[0]);
    return { raw: parsed, normalized: parsed, confidence: 0, error: undefined };
  } catch (err) {
    clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : 'BazaarLink request failed';
    return { raw: null, normalized: null, confidence: 0, error: message };
  }
}
