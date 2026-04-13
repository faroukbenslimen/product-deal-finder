import { 
  getAiClient, 
  apiKey, 
  openRouterApiKey, 
  IS_TEST 
} from '../config';
import { buildSearchPrompt } from '../../prompts/searchPrompt';
import { 
  modelResponseSchema, 
  type ModelResponse,
  type Recommendation
} from '../types/schemas';
import { 
  extractFirstJsonObject, 
  toSafeString, 
  toSafeNumber, 
  toSafeCurrency, 
  toSafeStringArray, 
  toSafeSpecifications 
} from '../utils/htmlUtils';

/**
 * Builds Repair Prompt.
 */
function buildRepairPrompt(invalidText: string): string {
  return `You are a JSON repair assistant. Return ONLY valid JSON. No markdown. No explanations.
Input to repair: ${invalidText}`;
}

/**
 * Coerce Model Payload.
 */
function coerceModelPayload(value: unknown): any {
  const rootCandidate = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const root = rootCandidate.data && typeof rootCandidate.data === 'object' ? rootCandidate.data as Record<string, unknown> : rootCandidate;

  const recommendationsRaw = Array.isArray(root.recommendations) ? root.recommendations : [];
  return {
    recommendations: recommendationsRaw.map((rec: any) => ({
      storeName: toSafeString(rec.storeName, 'Unknown Store'),
      productName: toSafeString(rec.productName, ''),
      price: toSafeString(rec.price, 'Price unavailable'),
      priceValue: toSafeNumber(rec.priceValue, 0),
      url: toSafeString(rec.url, ''),
      domain: toSafeString(rec.domain, ''),
      serviceRating: toSafeString(rec.serviceRating, 'No rating details available'),
      ratingScore: toSafeNumber(rec.ratingScore, 0),
      isBest: Boolean(rec.isBest),
      bestReason: toSafeString(rec.bestReason, ''),
      imageUrl: toSafeString(rec.imageUrl, ''),
      stockStatus: toSafeString(rec.stockStatus, 'Unknown'),
      shippingInfo: toSafeString(rec.shippingInfo, 'Unknown'),
      pros: toSafeStringArray(rec.pros),
      cons: toSafeStringArray(rec.cons),
      specifications: toSafeSpecifications(rec.specifications),
    })),
    summary: toSafeString(root.summary, ''),
    detectedCurrency: toSafeCurrency(root.detectedCurrency, 'USD'),
  };
}

/**
 * Parses and validates model response.
 */
export function parseAndValidateModelResponse(rawText: string): ModelResponse {
  const cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  const candidates = [cleanText, extractFirstJsonObject(cleanText)].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const coerced = coerceModelPayload(parsed);
      return modelResponseSchema.parse(coerced);
    } catch {}
  }
  throw new Error('Model response was not valid JSON.');
}

/**
 * Fetches Model Content from Gemini.
 */
export async function fetchModelContent(query: string, region: string, storePatterns: any): Promise<string> {
  const result = await getAiClient().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: buildSearchPrompt(query, region, storePatterns),
    config: { tools: [{ googleSearch: {} }] as any },
  });

  if (!result.text) throw new Error('No response text from Gemini.');
  return result.text;
}

/**
 * Repars Model Content.
 */
export async function repairModelContent(invalidText: string): Promise<string> {
  const result = await getAiClient().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: buildRepairPrompt(invalidText),
  });

  if (!result.text) throw new Error('Repair failed.');
  return result.text;
}
