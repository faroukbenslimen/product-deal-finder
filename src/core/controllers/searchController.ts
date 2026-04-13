import { Request, Response } from 'express';
import { 
  evaluateUrlQuality, 
  buildFallbackSearchUrl, 
  matchStoreAllowlist,
  levelFromScore
} from '../utils/urlUtils';
import { 
  fetchModelContent, 
  parseAndValidateModelResponse, 
  repairModelContent 
} from '../services/aiService';
import { 
  isDirectUrlReachable, 
  pendingVerifications, 
  startBackgroundVerifier 
} from '../services/verificationService';
import { consumeDailyModelBudget } from '../services/usageService';
import { isInCooldown, getClientIp } from '../services/rateLimitService';
import { STORE_ALLOWLIST, CACHE_TTL_MS, MAX_CACHE_ENTRIES, IS_TEST } from '../config';
import { type Recommendation, type ModelResponse } from '../types/schemas';

const queryCache = new Map<string, { result: ModelResponse; timestamp: number }>();

/**
 * Apply Link Fixes And Ranking.
 */
export async function applyLinkFixesAndRanking(recs: Recommendation[], query: string, region = 'Global'): Promise<Recommendation[]> {
  const processed = await Promise.all(recs.map(async (rec) => {
    const { score, useDirect, cleanedUrl } = evaluateUrlQuality(rec, query);
    
    let verified = false;
    if (cleanedUrl && useDirect) {
      verified = await isDirectUrlReachable(cleanedUrl);
      if (verified) pendingVerifications.add(cleanedUrl);
    }

    const finalUrl = verified ? cleanedUrl : buildFallbackSearchUrl(rec, query, region);
    
    return {
      ...rec,
      url: finalUrl,
      confidenceScore: Math.min(Math.max(score, 0), 100),
      confidenceLevel: levelFromScore(score),
      linkSource: (verified ? 'direct' : 'fallback') as 'direct' | 'fallback',
      linkVerified: verified,
    };
  }));

  if (processed.some(r => r.linkSource === 'direct')) startBackgroundVerifier();
  return processed.sort((a, b) => (b.confidenceScore || 0) - (a.confidenceScore || 0));
}

/**
 * Gets Cache Key.
 */
function getCacheKey(query: string, region: string): string {
  const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  return `${norm(query)}|||${norm(region)}`;
}

/**
 * Search Handler Logic.
 */
export async function handleSearch(req: Request, res: Response) {
  const ip = getClientIp(req);
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
  const region = typeof req.body?.region === 'string' ? req.body.region.trim() : 'Global';

  if (!query) return res.status(400).json({ error: 'A product query is required.' });

  // 1. IP Cooldown Check
  const cooldown = isInCooldown(ip, 'search');
  if (cooldown.blocked) {
    return res.status(429).json({ error: `Please wait ${Math.ceil(cooldown.retryAfterMs / 1000)}s before searching again.` });
  }

  try {
    // 2. Cache Check
    const cacheKey = getCacheKey(query, region);
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      const recommendations = await applyLinkFixesAndRanking(cached.result.recommendations, query, region);
      return res.json({ data: { ...cached.result, recommendations }, cached: true });
    }

    // 3. Daily Budget Check
    if (!consumeDailyModelBudget(1)) {
      return res.status(429).json({ error: 'Daily AI budget reached. Please try again tomorrow.' });
    }

    const storePatterns: Record<string, string[]> = {};
    STORE_ALLOWLIST.forEach(s => { 
      // Extract human-readable hints from Regex patterns (e.g., /\/dp\//i -> "/dp/")
      storePatterns[s.name] = (s.pathPatterns || []).map(p => {
        const str = String(p);
        return str.replace(/^\/|[\/\\][gimuy]*$/g, '').replace(/\\/g, '');
      });
    });

    const rawText = await fetchModelContent(query, region, storePatterns);
    const validated = parseAndValidateModelResponse(rawText);
    const recommendations = await applyLinkFixesAndRanking(validated.recommendations, query, region);

    // 4. Update Cache
    if (queryCache.size >= MAX_CACHE_ENTRIES) {
      const oldest = Array.from(queryCache.keys())[0];
      if (oldest) queryCache.delete(oldest);
    }
    queryCache.set(cacheKey, { result: validated, timestamp: Date.now() });

    return res.json({
      data: { ...validated, recommendations },
      cached: false
    });
  } catch (error: any) {
    console.error('[Search Error]', error);
    return res.status(500).json({ error: error.message || 'Search failed. Please try again.' });
  }
}
