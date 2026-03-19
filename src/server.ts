import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import { normalizeSearchResult, type Recommendation } from './shared/searchSchema';
import { classifyError } from './shared/errorHandling';
import { z } from 'zod';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY is not set. Please set it in your .env file.');
}

const app = express();
const port = Number(process.env.PORT || 4000);

const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const openRouterModel = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';
if (!openRouterApiKey) {
  console.warn('OPENROUTER_API_KEY is missing. Fallback provider is disabled.');
}

const ai = new GoogleGenAI({ apiKey });

app.use(cors({
  origin: (origin, callback) => {
    // Allow local development origins and deployed Vercel frontends.
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:4000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:4000',
      'http://0.0.0.0:3000',
      'http://0.0.0.0:3001',
      'https://product-deal-finder.vercel.app',
    ];

    // Requests proxied by Vercel/Render may not include Origin.
    if (!origin) {
      callback(null, true);
      return;
    }

    const isVercelPreview = /https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
    if (allowedOrigins.includes(origin) || isVercelPreview) {
      callback(null, true);
      return;
    }

    console.warn(`CORS rejected request from origin: ${origin}`);
    // Do not throw from CORS callback; keep API responses JSON and predictable.
    callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req: Request, res: Response) => {
  return res.json({
    service: 'product-deal-finder-api',
    status: 'ok',
    message: 'Backend is running. Use POST /api/search or POST /api/identify-product.',
  });
});

app.get('/health', (_req: Request, res: Response) => {
  return res.json({ status: 'ok' });
});

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const IP_COOLDOWN_MS = 4_000;
const DAILY_MODEL_CALL_CAP = Number(process.env.DAILY_MODEL_CALL_CAP || 120);
const requestLog = new Map<string, number[]>();
const lastRequestByScope = new Map<string, number>();
const domainLinkHealth = new Map<string, { success: number; failure: number }>();

// Query cache: stores results for 6 hours.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
interface CacheEntry {
  result: ReturnType<typeof normalizeSearchResult> & { recommendations: Recommendation[] };
  timestamp: number;
}
const queryCache = new Map<string, CacheEntry>();

const dailyUsage = {
  dayKey: new Date().toISOString().slice(0, 10),
  modelCalls: 0,
};

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

function isInCooldown(ip: string, scope: 'search' | 'identify'): { blocked: boolean; retryAfterMs: number } {
  const now = Date.now();
  const key = `${ip}::${scope}`;
  const last = lastRequestByScope.get(key) || 0;
  const elapsed = now - last;

  if (elapsed < IP_COOLDOWN_MS) {
    return { blocked: true, retryAfterMs: IP_COOLDOWN_MS - elapsed };
  }

  lastRequestByScope.set(key, now);
  return { blocked: false, retryAfterMs: 0 };
}

function consumeDailyModelBudget(units = 1): boolean {
  const currentDay = new Date().toISOString().slice(0, 10);
  if (dailyUsage.dayKey !== currentDay) {
    dailyUsage.dayKey = currentDay;
    dailyUsage.modelCalls = 0;
  }

  if (dailyUsage.modelCalls + units > DAILY_MODEL_CALL_CAP) {
    return false;
  }

  dailyUsage.modelCalls += units;
  return true;
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
      "bestReason": "Why this is your best choice (price, availability, service, etc.)",
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

CRITICAL RELEVANCE INSTRUCTION: You MUST return ONLY products that clearly match the user's search query ("${query}"). Do NOT include unrelated products.

CRITICAL RESULT COUNT INSTRUCTION: Return 5-8 recommendations whenever possible, with at least 3 recommendations unless the product is truly unavailable in the selected region.

CRITICAL DIVERSITY INSTRUCTION: Prefer diverse sources (official store + marketplaces + specialist retailers + price comparison/listing sites where buyers can reach a real offer).

CRITICAL BEST REASON INSTRUCTION: For EVERY recommendation, especially the isBest=true entry, populate bestReason with a 1-2 sentence explanation of why this specific deal is good (e.g., "Lowest price with Prime shipping" or "Official store with frequent discounts and excellent reviews"). This must be specific and actionable.

If fewer than 3 trustworthy stores are actually available for ${region}, you may return fewer, but explain why in summary.

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
      "bestReason": "string",
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

function extractFirstJsonObject(text: string): string | null {
  const source = text.trim();
  const start = source.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === '\\') {
        isEscaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  return null;
}

function toSafeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

function toSafeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toSafeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => toSafeString(item)).filter(Boolean).slice(0, 8);
}

function toSafeSpecifications(value: unknown): Array<{ feature: string; value: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const input = item as Record<string, unknown>;
      const feature = toSafeString(input.feature);
      const specValue = toSafeString(input.value);
      if (!feature || !specValue) return null;
      return { feature, value: specValue };
    })
    .filter((item): item is { feature: string; value: string } => item !== null)
    .slice(0, 12);
}

function coerceModelPayload(value: unknown): unknown {
  const rootCandidate = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const root = rootCandidate.data && typeof rootCandidate.data === 'object'
    ? rootCandidate.data as Record<string, unknown>
    : rootCandidate;

  const recommendationsRaw = Array.isArray(root.recommendations) ? root.recommendations : [];
  const recommendations = recommendationsRaw.map((item) => {
    const rec = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const priceValue = toSafeNumber(rec.priceValue, 0);

    return {
      storeName: toSafeString(rec.storeName, 'Unknown Store'),
      productName: toSafeString(rec.productName, ''),
      price: toSafeString(rec.price, priceValue > 0 ? `$${priceValue.toFixed(2)}` : 'Price unavailable'),
      priceValue,
      url: toSafeString(rec.url, ''),
      domain: toSafeString(rec.domain, ''),
      serviceRating: toSafeString(rec.serviceRating, 'No rating details available'),
      ratingScore: toSafeNumber(rec.ratingScore, 0),
      isBest: Boolean(rec.isBest),
      imageUrl: toSafeString(rec.imageUrl, ''),
      stockStatus: toSafeString(rec.stockStatus, 'Unknown'),
      shippingInfo: toSafeString(rec.shippingInfo, 'Unknown'),
      pros: toSafeStringArray(rec.pros),
      cons: toSafeStringArray(rec.cons),
      specifications: toSafeSpecifications(rec.specifications),
    };
  });

  return {
    recommendations,
    summary: toSafeString(root.summary, ''),
  };
}

function parseAndValidateModelResponse(rawText: string) {
  const cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

  const candidates = [
    cleanText,
    extractFirstJsonObject(cleanText),
  ].filter((candidate): candidate is string => Boolean(candidate));

  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const coerced = coerceModelPayload(parsed);
      return modelResponseSchema.parse(coerced);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Model response was not valid JSON.');
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

function shouldTryFallbackProvider(error: unknown): boolean {
  const message = String((error as any)?.message || '').toLowerCase();
  const status = (error as any)?.status;
  const code = (error as any)?.error?.code;

  return (
    status === 429 ||
    code === 429 ||
    message.includes('quota') ||
    message.includes('resource_exhausted') ||
    message.includes('rate limit') ||
    message.includes('timed out') ||
    (typeof status === 'number' && status >= 500)
  );
}

async function fetchModelContentFromOpenRouter(prompt: string): Promise<string> {
  if (!openRouterApiKey) {
    throw new Error('OpenRouter fallback is not configured.');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openRouterApiKey}`,
      'HTTP-Referer': 'https://product-deal-finder.vercel.app',
      'X-Title': 'Deal Finder',
    },
    body: JSON.stringify({
      model: openRouterModel,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter request failed (${response.status}): ${errorBody.slice(0, 200)}`);
  }

  const payload = (await response.json()) as any;
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('OpenRouter returned no text content.');
  }

  return text.trim();
}

async function fetchModelContentWithFallback(query: string, region: string): Promise<{ text: string; provider: 'gemini' | 'openrouter' }> {
  try {
    const text = await fetchModelContent(query, region);
    return { text, provider: 'gemini' };
  } catch (error) {
    if (!openRouterApiKey || !shouldTryFallbackProvider(error)) {
      throw error;
    }
    const text = await fetchModelContentFromOpenRouter(buildPrompt(query, region));
    return { text, provider: 'openrouter' };
  }
}

async function repairModelContent(invalidText: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: buildRepairPrompt(invalidText),
    });

    if (!response.text) {
      throw new Error('No response text was returned during repair.');
    }

    return response.text;
  } catch (error) {
    if (!openRouterApiKey || !shouldTryFallbackProvider(error)) {
      throw error;
    }
    return fetchModelContentFromOpenRouter(buildRepairPrompt(invalidText));
  }
}

function getCacheKey(query: string, region: string): string {
  const normalizedQuery = query
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const normalizedRegion = region
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return `${normalizedQuery}|||${normalizedRegion}`;
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
  if (queryCache.size >= MAX_CACHE_ENTRIES) {
    let oldestKey = '';
    let oldestTime = Number.POSITIVE_INFINITY;
    for (const [entryKey, entry] of queryCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = entryKey;
      }
    }
    if (oldestKey) {
      queryCache.delete(oldestKey);
    }
  }
  queryCache.set(key, { result, timestamp: Date.now() });
}

app.post('/api/search', async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const cooldown = isInCooldown(ip, 'search');
  if (cooldown.blocked) {
    return res.status(429).json({
      error: `Please wait ${Math.ceil(cooldown.retryAfterMs / 1000)}s before searching again.`,
    });
  }

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many searches. Please wait a moment and try again.' });
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

    if (!consumeDailyModelBudget(1)) {
      return res.status(429).json({
        error: 'Daily AI budget reached. Please try again tomorrow.',
      });
    }

    const { text: rawText, provider } = await fetchModelContentWithFallback(query, region);
    let validated: z.infer<typeof modelResponseSchema>;

    try {
      validated = parseAndValidateModelResponse(rawText);
    } catch (firstError) {
      if (!consumeDailyModelBudget(1)) {
        return res.status(429).json({
          error: 'Daily AI budget reached during recovery step. Please try again tomorrow.',
        });
      }
      const repairedText = await repairModelContent(rawText);
      try {
        validated = parseAndValidateModelResponse(repairedText);
      } catch {
        return res.status(502).json({ error: 'Model returned invalid structured JSON after retry.' });
      }
    }

    const primaryNormalized = normalizeSearchResult(validated, { query, minConfidence: 40 });
    const normalized = primaryNormalized.recommendations.length >= 3
      ? primaryNormalized
      : normalizeSearchResult(validated, { query, minConfidence: 20 });
    const recommendations = applyLinkFixesAndRanking(normalized.recommendations, query);

    // Cache the result
    setCachedResult(query, region, normalized);

    return res.json({
      data: {
        ...normalized,
        recommendations,
      },
      provider,
      cached: false,
    });
  } catch (error: any) {
    const { status, message } = classifyError(error);
    return res.status(status).json({ error: message });
  }
});

app.post('/api/identify-product', async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const cooldown = isInCooldown(ip, 'identify');
  if (cooldown.blocked) {
    return res.status(429).json({
      error: `Please wait ${Math.ceil(cooldown.retryAfterMs / 1000)}s before analyzing another image.`,
    });
  }

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many searches. Please wait a moment and try again.' });
  }

  const imageBase64 = typeof req.body?.image === 'string' ? req.body.image.trim() : '';
  const region = typeof req.body?.region === 'string' && req.body.region.trim() ? req.body.region.trim() : 'Global';

  if (!imageBase64) {
    return res.status(400).json({ error: 'An image is required.' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' });
  }

  if (!consumeDailyModelBudget(1)) {
    return res.status(429).json({
      error: 'Daily AI budget reached. Please try again tomorrow.',
    });
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

app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  console.error('Unhandled API error:', error);
  res.status(500).json({ error: 'Internal server error. Please try again.' });
});

app.listen(port, () => {
  console.log(`Deal Finder API running on http://localhost:${port}`);
});
