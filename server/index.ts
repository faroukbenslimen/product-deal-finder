import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { normalizeSearchResult, type Recommendation } from '../src/shared/searchSchema';
import { classifyError } from '../src/shared/errorHandling';
import { z } from 'zod';

const app = express();
const port = Number(process.env.PORT || 8787);

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('GEMINI_API_KEY is missing. /api/search will fail until it is set.');
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

app.use(express.json({ limit: '1mb' }));

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const requestLog = new Map<string, number[]>();
const domainLinkHealth = new Map<string, { success: number; failure: number }>();

// Query cache: stores results for 1 hour (3600000 ms)
const CACHE_TTL_MS = 60 * 60 * 1000;
interface CacheEntry {
  result: ReturnType<typeof normalizeSearchResult> & { recommendations: Recommendation[] };
  timestamp: number;
}
const queryCache = new Map<string, CacheEntry>();

const specificationSchema = z.object({
  feature: z.string(),
  value: z.string(),
}).strict();

const recommendationSchema = z.object({
  storeName: z.string(),
  productName: z.string().optional().default(''),
  price: z.union([z.string(), z.number()]),
  priceValue: z.union([z.number(), z.string()]),
  url: z.string().optional().default(''),
  domain: z.string().optional().default(''),
  serviceRating: z.string().optional().default('No rating details available'),
  ratingScore: z.union([z.number(), z.string()]).optional().default(0),
  isBest: z.boolean().optional().default(false),
  imageUrl: z.string().optional().default(''),
  stockStatus: z.string().optional().default('Unknown'),
  shippingInfo: z.string().optional().default('Unknown'),
  pros: z.array(z.string()).optional().default([]),
  cons: z.array(z.string()).optional().default([]),
  specifications: z.array(specificationSchema).optional().default([]),
}).strict();

const modelResponseSchema = z.object({
  recommendations: z.array(recommendationSchema),
  summary: z.string(),
}).strict();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = requestLog.get(ip) || [];
  const inWindow = timestamps.filter((timestamp) => timestamp > windowStart);

  if (inWindow.length >= RATE_LIMIT_MAX) {
    requestLog.set(ip, inWindow);
    return true;
  }

  inWindow.push(now);
  requestLog.set(ip, inWindow);
  return false;
}

function buildPrompt(query: string, region: string): string {
  const regionContext =
    region !== 'Global'
      ? `\nCRITICAL REGION CONSTRAINT: You MUST ONLY return stores that are physically located in ${region} OR explicitly state they ship to ${region}. If the product is completely unavailable for purchase or shipping in ${region}, you MUST return an empty "recommendations" array [] and explain the unavailability in the "summary". Do NOT fallback to US/Global stores if they do not ship to ${region}. Prices MUST be converted to the local currency of ${region} if possible. If you are unsure if a store ships to ${region}, DO NOT include it.`
      : ' globally';

  return `Find the best places to buy "${query}"${region !== 'Global' ? '' : ' globally'}. ${regionContext}

CRITICAL: You MUST return ONLY a valid JSON object. Do NOT wrap it in \`\`\`json markdown. Just return the raw JSON starting with { and ending with }.

The JSON must have this exact structure:
{
  "recommendations": [
    {
      "storeName": "Name",
      "productName": "Specific Product Name",
      "price": "$99.99",
      "priceValue": 99.99,
      "url": "https://...",
      "domain": "store.com",
      "serviceRating": "Good",
      "ratingScore": 4.5,
      "isBest": true,
      "imageUrl": "https://...",
      "stockStatus": "In Stock",
      "shippingInfo": "Free Shipping",
      "pros": ["pro1"],
      "cons": ["con1"],
      "specifications": [{"feature": "Color", "value": "Black"}]
    }
  ],
  "summary": "Brief summary of findings"
}

CRITICAL RELEVANCE INSTRUCTION: You MUST ONLY return products that EXACTLY match the user's search query ("${query}"). If a store does not sell the requested product, DO NOT include that store in the results. DO NOT return completely unrelated products. If you can only find the exact product on ONE single site, then ONLY return that one site.

CRITICAL URL INSTRUCTION: DO NOT GUESS OR CONSTRUCT URLs. If you do not have the EXACT, VERIFIED url directly from your search results, you MUST leave the 'url' field EMPTY ("").`;
}

function buildRepairPrompt(invalidText: string): string {
  return `You are a JSON repair assistant.

Return ONLY valid JSON. No markdown. No explanations.

Target structure:
{
  "recommendations": [
    {
      "storeName": "string",
      "productName": "string",
      "price": "string",
      "priceValue": 0,
      "url": "string",
      "domain": "string",
      "serviceRating": "string",
      "ratingScore": 0,
      "isBest": false,
      "imageUrl": "string",
      "stockStatus": "string",
      "shippingInfo": "string",
      "pros": ["string"],
      "cons": ["string"],
      "specifications": [{"feature": "string", "value": "string"}]
    }
  ],
  "summary": "string"
}

Input to repair:
${invalidText}`;
}

function parseAndValidateModelResponse(rawText: string) {
  const cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleanText) as unknown;
  return modelResponseSchema.parse(parsed);
}

function buildFallbackSearchUrl(rec: Recommendation, query: string): string {
  const normalizedDomain = (rec.domain || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const terms = [rec.productName || query, rec.storeName].filter(Boolean).join(' ');
  const searchQuery = normalizedDomain ? `site:${normalizedDomain} ${terms}` : terms || query;
  return `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function evaluateUrlQuality(rec: Recommendation, query: string): { score: number; useDirect: boolean } {
  if (!rec.url) {
    return { score: 35, useDirect: false };
  }

  let parsed: URL;
  try {
    parsed = new URL(rec.url);
  } catch {
    return { score: 0, useDirect: false };
  }

  let score = 80;
  const path = parsed.pathname.toLowerCase();
  const genericPathPattern = /\/(search|category|categories|collections|products|shop|store|deals?)\b/;

  if (path === '/' || path.length <= 1) score -= 35;
  if (genericPathPattern.test(path)) score -= 25;
  if (parsed.search.includes('q=') || parsed.search.includes('search=')) score -= 20;

  const combinedTarget = `${rec.productName || ''} ${query}`;
  const queryTokens = tokenize(combinedTarget);
  const pathTokens = tokenize(path.replace(/\//g, ' '));
  if (queryTokens.length > 0 && pathTokens.length > 0) {
    const matched = queryTokens.filter((token) => pathTokens.includes(token)).length;
    const ratio = matched / queryTokens.length;
    if (ratio >= 0.45) score += 15;
    else if (ratio < 0.2) score -= 15;
  }

  const host = parsed.hostname;
  const stats = domainLinkHealth.get(host);
  if (stats) {
    const total = stats.success + stats.failure;
    if (total >= 3) {
      const failureRate = stats.failure / total;
      score -= Math.round(failureRate * 30);
    }
  }

  score = Math.max(0, Math.min(100, score));
  return { score, useDirect: score >= 55 };
}

function setLinkHealth(hostname: string, success: boolean): void {
  if (!hostname) return;
  const current = domainLinkHealth.get(hostname) || { success: 0, failure: 0 };
  if (success) current.success += 1;
  else current.failure += 1;
  domainLinkHealth.set(hostname, current);
}

function levelFromScore(score: number): 'low' | 'medium' | 'high' {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function applyLinkFixesAndRanking(recs: Recommendation[], query: string): Recommendation[] {
  return recs.map((rec) => {
    const domain = (rec.domain || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const { score, useDirect } = evaluateUrlQuality(rec, query);

    if (domain) {
      setLinkHealth(domain, useDirect);
    } else {
      try {
        if (rec.url) setLinkHealth(new URL(rec.url).hostname, useDirect);
      } catch {
        // Ignore missing/invalid hostname.
      }
    }

    const adjustedConfidence = Math.max(0, Math.min(100, rec.confidenceScore - (useDirect ? 0 : 8)));

    return {
      ...rec,
      // Force fallback generation in the client when direct URL quality is weak.
      url: useDirect ? rec.url : '',
      linkSource: useDirect ? 'direct' : 'fallback',
      linkQualityScore: score,
      fallbackUrl: buildFallbackSearchUrl(rec, query),
      confidenceScore: adjustedConfidence,
      confidenceLevel: levelFromScore(adjustedConfidence),
      isBest: useDirect ? rec.isBest : false,
    };
  });
}

async function fetchModelContent(query: string, region: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: buildPrompt(query, region),
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  if (!response.text) {
    throw new Error('No response text was returned by the model.');
  }

  return response.text;
}

async function repairModelContent(invalidText: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: buildRepairPrompt(invalidText),
  });

  if (!response.text) {
    throw new Error('No response text was returned during repair.');
  }

  return response.text;
}

function getCacheKey(query: string, region: string): string {
  return `${query.toLowerCase().trim()}|||${region.toLowerCase().trim()}`;
}

function getCachedResult(query: string, region: string): CacheEntry | null {
  const key = getCacheKey(query, region);
  const entry = queryCache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL_MS) {
    queryCache.delete(key);
    return null;
  }

  return entry;
}

function setCachedResult(query: string, region: string, result: CacheEntry['result']): void {
  const key = getCacheKey(query, region);
  queryCache.set(key, { result, timestamp: Date.now() });
}

app.post('/api/search', async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
  }

  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
  const region = typeof req.body?.region === 'string' && req.body.region.trim() ? req.body.region.trim() : 'Global';

  if (!query) {
    return res.status(400).json({ error: 'A product query is required.' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' });
  }

  try {
    // Check if result is cached
    const cached = getCachedResult(query, region);
    if (cached) {
      const recommendations = applyLinkFixesAndRanking(cached.result.recommendations, query);
      return res.json({
        data: {
          ...cached.result,
          recommendations,
        },
        cached: true,
      });
    }

    const rawText = await fetchModelContent(query, region);
    let validated: z.infer<typeof modelResponseSchema>;

    try {
      validated = parseAndValidateModelResponse(rawText);
    } catch (firstError) {
      const repairedText = await repairModelContent(rawText);
      try {
        validated = parseAndValidateModelResponse(repairedText);
      } catch {
        return res.status(502).json({ error: 'Model returned invalid structured JSON after retry.' });
      }
    }

    const normalized = normalizeSearchResult(validated, { query, minConfidence: 40 });
    const recommendations = applyLinkFixesAndRanking(normalized.recommendations, query);

    // Cache the result
    setCachedResult(query, region, normalized);

    return res.json({
      data: {
        ...normalized,
        recommendations,
      },
      cached: false,
    });
  } catch (error: any) {
    const { status, message } = classifyError(error);
    return res.status(status).json({ error: message });
  }
});

app.post('/api/identify-product', async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
  }

  const imageBase64 = typeof req.body?.image === 'string' ? req.body.image.trim() : '';
  const region = typeof req.body?.region === 'string' && req.body.region.trim() ? req.body.region.trim() : 'Global';

  if (!imageBase64) {
    return res.status(400).json({ error: 'An image is required.' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' });
  }

  try {
    // Extract base64 from data URL if needed
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data,
            },
          },
          {
            text: 'Identify the product in this image. Return ONLY the product name or type in a single line, nothing else. Be specific (e.g., "Sony WH-1000XM5 headphones" instead of just "headphones").',
          },
        ],
      },
    });

    if (!response.text) {
      throw new Error('Failed to identify product from image.');
    }

    const productName = response.text.trim();

    if (!productName || productName.length < 2) {
      return res.status(400).json({ error: 'Could not identify product. Try a clearer image.' });
    }

    return res.json({ productName });
  } catch (error: any) {
    const { status, message } = classifyError(error);
    return res.status(status).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`Deal Finder API running on http://localhost:${port}`);
});
