import { 
  SEARCH_OR_AGGREGATOR_HOST_PATTERNS, 
  STORE_ALLOWLIST, 
  TRACKING_QUERY_PREFIXES, 
  TRACKING_QUERY_KEYS, 
  PRODUCT_IDENTIFIER_QUERY_KEYS,
  GENERIC_LISTING_SEGMENTS,
  SEARCH_QUERY_KEYS
} from '../config';
import { type Recommendation } from '../types/schemas';

/**
 * Normalizes Host.
 */
export function normalizeHost(value: string): string {
  return value.toLowerCase().replace(/^www\./, '').trim();
}

/**
 * Checks whether Search Or Aggregator Host.
 */
export function isSearchOrAggregatorHost(host: string): boolean {
  const safeHost = normalizeHost(host);
  return SEARCH_OR_AGGREGATOR_HOST_PATTERNS.some((pattern) => pattern.test(safeHost));
}

/**
 * Checks whether Generic Listing Path.
 */
export function isGenericListingPath(pathname: string): boolean {
  const safePath = pathname.toLowerCase().replace(/\/+/g, '/').replace(/\/$/, '');
  if (!safePath || safePath === '/') return true;

  const segments = safePath.split('/').filter(Boolean);
  if (segments.length === 0) return true;

  if (GENERIC_LISTING_SEGMENTS.has(segments[0]) && segments.length <= 2) {
    return true;
  }

  return false;
}

/**
 * Checks whether Search Intent Query.
 */
export function hasSearchIntentQuery(parsed: URL): boolean {
  for (const key of parsed.searchParams.keys()) {
    if (SEARCH_QUERY_KEYS.has(key.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether Likely Cdn Host.
 */
export function isLikelyCdnHost(host: string): boolean {
  const safeHost = normalizeHost(host);
  return (
    safeHost.endsWith('cloudfront.net') ||
    safeHost.endsWith('akamaihd.net') ||
    safeHost.endsWith('fastly.net') ||
    safeHost.endsWith('edgekey.net')
  );
}

/**
 * Tokenize.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

/**
 * Host Matches Domain.
 */
export function hostMatchesDomain(host: string, domain: string): boolean {
  const safeHost = normalizeHost(host);
  const safeDomain = normalizeHost(domain);
  if (!safeHost || !safeDomain) return false;
  return safeHost === safeDomain || safeHost.endsWith(`.${safeDomain}`);
}

/**
 * Sanitizes Direct Recommendation Url.
 */
export function sanitizeDirectRecommendationUrl(rawUrl: string): string {
  const candidate = rawUrl.trim();
  if (!candidate) return '';

  const withProtocol = candidate.startsWith('http://') || candidate.startsWith('https://')
    ? candidate
    : `https://${candidate}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return '';
  }

  const host = normalizeHost(parsed.hostname);
  if (!host || isLikelyCdnHost(host) || isSearchOrAggregatorHost(host)) {
    return '';
  }

  parsed.hash = '';
  for (const key of [...parsed.searchParams.keys()]) {
    const lowerKey = key.toLowerCase();
    if (TRACKING_QUERY_PREFIXES.some((prefix) => lowerKey.startsWith(prefix)) || TRACKING_QUERY_KEYS.has(lowerKey)) {
      parsed.searchParams.delete(key);
    }
  }

  return parsed.toString();
}

/**
 * Match Store Allowlist.
 */
export function matchStoreAllowlist(host: string, pathname: string): string | null {
  const safeHost = normalizeHost(host);
  for (const entry of STORE_ALLOWLIST) {
    if (entry.host.test(safeHost) && entry.pathPatterns) {
      for (const p of entry.pathPatterns) {
        if (p.test(pathname)) return entry.name;
      }
    }
  }
  return null;
}

/**
 * Tries to resolve or reconstruct a direct product URL if the provided one is a search page.
 */
export function resolveBetterStoreUrl(currentUrl: string, storeName: string): string {
  const urlLower = currentUrl.toLowerCase();
  const nameLower = storeName.toLowerCase();
  
  try {
    const parsed = new URL(currentUrl);
    if (matchStoreAllowlist(parsed.hostname, parsed.pathname)) return currentUrl;

    if (nameLower === 'amazon' && urlLower.includes('/s?') && urlLower.includes('keywords=')) {
      const asinMatch = currentUrl.match(/([A-Z0-9]{10})/);
      if (asinMatch) return `https://www.amazon.com/dp/${asinMatch[1]}`;
    }
  } catch {
    // ignore
  }

  return currentUrl;
}

/**
 * Extracts Product Identifier from URL.
 */
export function extractProductIdFromUrl(parsed: URL): { type: 'asin' | 'gtin' | 'sku' | 'numeric' | 'none'; id?: string } {
  const path = parsed.pathname || '';
  const q = parsed.searchParams;

  const asinPatterns = [/\/dp\/([A-Z0-9]{10})/i, /\/gp\/product\/([A-Z0-9]{10})/i, /\/gp\/aw\/([A-Z0-9]{10})/i];
  for (const p of asinPatterns) {
    const m = p.exec(path);
    if (m && m[1]) return { type: 'asin', id: m[1] };
  }

  for (const key of [...q.keys()]) {
    const lower = key.toLowerCase();
    if (PRODUCT_IDENTIFIER_QUERY_KEYS.has(lower)) {
      const val = q.get(key) || '';
      if (/^[A-Z0-9\-]{6,}$/.test(val)) return { type: 'sku', id: val };
      if (/^\d{8,14}$/.test(val)) return { type: 'gtin', id: val };
    }
  }

  const gtinMatch = path.match(/\/(\d{8,14})(?:[\/\?]|$)/);
  if (gtinMatch && gtinMatch[1]) return { type: 'gtin', id: gtinMatch[1] };

  const ebayMatch = path.match(/\/itm\/(\d{6,20})(?:[\/\?]|$)/i);
  if (ebayMatch && ebayMatch[1]) return { type: 'numeric', id: ebayMatch[1] };

  return { type: 'none' };
}

/**
 * Canonicalize URLs for known stores.
 */
export function canonicalizeForStore(host: string, pathname: string, idInfo: { type: string; id?: string }): string | null {
  const h = normalizeHost(host);
  const id = idInfo.id || '';
  if (!id) return null;

  if (/(^|\.)amazon\./i.test(h) && idInfo.type === 'asin') return `https://www.amazon.com/dp/${id}`;
  if (/(^|\.)ebay\./i.test(h) && idInfo.type === 'numeric') return `https://www.ebay.com/itm/${id}`;
  if (/(^|\.)walmart\.com$/i.test(h) && idInfo.type === 'gtin') return `https://www.walmart.com/ip/${id}`;
  if (/(^|\.)bestbuy\.com$/i.test(h) && idInfo.type === 'sku') return `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(id)}`;
  if (/(^|\.)newegg\.(com|ca)/i.test(h) && idInfo.type === 'sku') return `https://www.newegg.com/p/${id}`;
  if (/(^|\.)bhphotovideo\.com$/i.test(h) && idInfo.type === 'sku') return `https://www.bhphotovideo.com/c/product/${id}`;

  return null;
}

/**
 * Evaluate URL Quality score.
 */
export function evaluateUrlQuality(rec: Recommendation, query: string, domainLinkHealth?: Map<string, { success: number; failure: number }>): { score: number; useDirect: boolean; cleanedUrl: string } {
  if (!rec.url) return { score: 35, useDirect: false, cleanedUrl: '' };

  const cleanedUrl = sanitizeDirectRecommendationUrl(rec.url);
  if (!cleanedUrl) return { score: 0, useDirect: false, cleanedUrl: '' };

  let parsed: URL;
  try {
    parsed = new URL(cleanedUrl);
  } catch {
    return { score: 0, useDirect: false, cleanedUrl: '' };
  }

  let score = 80;
  const path = parsed.pathname.toLowerCase();
  const host = parsed.hostname;
  const storeMatch = matchStoreAllowlist(host, path);
  const idInfo = extractProductIdFromUrl(parsed);

  if (idInfo.type !== 'none') {
    score += 10;
    if (storeMatch) {
      score += 20;
      const canonical = canonicalizeForStore(host, path, idInfo);
      if (canonical) {
        try { parsed = new URL(canonical); } catch {}
      }
    }
  }

  const normalizedRecDomain = (rec.domain || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (isSearchOrAggregatorHost(host)) score -= 55;
  if (isLikelyCdnHost(host)) score -= 40;
  if (normalizedRecDomain && !hostMatchesDomain(host, normalizedRecDomain)) score -= 35;
  if (path === '/' || path.length <= 1) score -= 35;
  if (isGenericListingPath(path)) score -= 35;

  const combinedTarget = `${rec.productName || ''} ${query}`;
  const queryTokens = tokenize(combinedTarget);
  const pathTokens = tokenize(path.replace(/\//g, ' '));
  if (queryTokens.length > 0) {
    const matched = queryTokens.filter((token) => pathTokens.includes(token)).length;
    const ratio = matched / queryTokens.length;
    if (ratio >= 0.45) score += 15;
    else if (ratio < 0.3) score -= 30;
  }

  if (domainLinkHealth) {
    const stats = domainLinkHealth.get(host);
    if (stats && stats.failure > stats.success * 2 && stats.failure > 5) score -= 30;
  }

  return { score, useDirect: score >= 60, cleanedUrl: parsed.toString() };
}

/**
 * Maps a numeric score to a confidence level label.
 */
export function levelFromScore(score: number): 'low' | 'medium' | 'high' {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

/**
 * Builds Fallback Search URL.
 */
export function buildFallbackSearchUrl(rec: Recommendation, query: string, region?: string): string {
  const rawHost = (rec.domain || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const productTerm = (rec.productName || query || '').trim();
  const storeTerm = (rec.storeName || '').trim();
  const regionTerm = region && region !== 'Global' ? String(region).trim() : '';

  const storeEntry = STORE_ALLOWLIST.find(s => s.host.test(rawHost));
  if (storeEntry?.searchUrl) {
    return `${storeEntry.searchUrl}${encodeURIComponent(productTerm)}`;
  }

  const searchParts: string[] = [productTerm, storeTerm];
  if (regionTerm === 'Tunisia') searchParts.push('Tunisie prix');
  else if (regionTerm && regionTerm !== 'Global') searchParts.push(regionTerm);
  
  if (rec.url && rawHost && !isSearchOrAggregatorHost(rawHost)) {
     if (rawHost.includes('.') && rawHost.length > 5) searchParts.push(`site:${rawHost}`);
  }

  return `https://www.google.com/search?q=${encodeURIComponent(searchParts.join(' '))}`;
}
