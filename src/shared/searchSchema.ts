export interface Specification {
  feature: string;
  value: string;
}

export interface Recommendation {
  storeName: string;
  productName: string;
  price: string;
  priceValue: number;
  url: string;
  domain: string;
  serviceRating: string;
  ratingScore: number;
  isBest: boolean;
  bestReason: string;
  imageUrl: string;
  stockStatus: string;
  shippingInfo: string;
  pros: string[];
  cons: string[];
  specifications: Specification[];
  confidenceScore: number;
  confidenceLevel: 'low' | 'medium' | 'high';
  linkSource?: 'direct' | 'fallback';
  linkQualityScore?: number;
  fallbackUrl?: string;
}

export interface SearchResult {
  recommendations: Recommendation[];
  summary: string;
}

export interface NormalizeOptions {
  query?: string;
  minConfidence?: number;
}

const MAX_TEXT_LENGTH = 500;

function toSafeString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  return value.trim().slice(0, MAX_TEXT_LENGTH);
}

function toSafeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const numeric = Number(value.replace(/[^\d.\-]/g, ''));
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => toSafeString(item))
    .filter(Boolean)
    .slice(0, 8);
}

function sanitizeUrl(value: unknown): string {
  const raw = toSafeString(value);
  if (!raw) {
    return '';
  }

  const withProtocol = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function sanitizeDomain(value: unknown): string {
  const domain = toSafeString(value).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return domain;
}

function normalizeSpecifications(value: unknown): Specification[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((spec) => {
      if (!spec || typeof spec !== 'object') {
        return null;
      }
      const feature = toSafeString((spec as Record<string, unknown>).feature);
      const specValue = toSafeString((spec as Record<string, unknown>).value);
      if (!feature || !specValue) {
        return null;
      }
      return { feature, value: specValue };
    })
    .filter((spec): spec is Specification => spec !== null)
    .slice(0, 12);
}

function normalizeRecommendation(value: unknown): Recommendation {
  const rec = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;

  const productName = toSafeString(rec.productName);
  const storeName = toSafeString(rec.storeName, 'Unknown Store');
  const priceValue = toSafeNumber(rec.priceValue);
  const price = toSafeString(rec.price, priceValue > 0 ? `$${priceValue.toFixed(2)}` : 'Price unavailable');
  const url = sanitizeUrl(rec.url);
  const domain = sanitizeDomain(rec.domain);

  let confidenceScore = 0;
  const query = toSafeString(rec.__query);
  const lowerProduct = productName.toLowerCase();
  const lowerQuery = query.toLowerCase();

  if (lowerQuery && lowerProduct) {
    if (lowerProduct.includes(lowerQuery)) {
      confidenceScore += 35;
    } else {
      const tokens = lowerQuery.split(/\s+/).filter((token) => token.length > 2);
      if (tokens.length > 0) {
        const matchedTokens = tokens.filter((token) => lowerProduct.includes(token)).length;
        const ratio = matchedTokens / tokens.length;
        if (ratio >= 0.6) {
          confidenceScore += 20;
        } else if (ratio >= 0.3) {
          confidenceScore += 10;
        }
      }
    }
  }

  if (url) confidenceScore += 20;
  if (domain) confidenceScore += 10;
  if (priceValue > 0) confidenceScore += 15;
  const ratingScore = Math.max(0, Math.min(5, toSafeNumber(rec.ratingScore)));
  if (ratingScore >= 4) confidenceScore += 10;
  else if (ratingScore >= 3) confidenceScore += 5;
  if (toSafeString(rec.shippingInfo, 'Unknown') !== 'Unknown') confidenceScore += 5;
  if (toSafeString(rec.stockStatus, 'Unknown') !== 'Unknown') confidenceScore += 5;

  confidenceScore = Math.max(0, Math.min(100, confidenceScore));
  const confidenceLevel: 'low' | 'medium' | 'high' =
    confidenceScore >= 75 ? 'high' : confidenceScore >= 50 ? 'medium' : 'low';

  return {
    storeName,
    productName,
    price,
    priceValue,
    url,
    domain,
    serviceRating: toSafeString(rec.serviceRating, 'No rating details available'),
    ratingScore,
    isBest: Boolean(rec.isBest),
    bestReason: toSafeString(rec.bestReason, ''),
    imageUrl: sanitizeUrl(rec.imageUrl),
    stockStatus: toSafeString(rec.stockStatus, 'Unknown'),
    shippingInfo: toSafeString(rec.shippingInfo, 'Unknown'),
    pros: toStringArray(rec.pros),
    cons: toStringArray(rec.cons),
    specifications: normalizeSpecifications(rec.specifications),
    confidenceScore,
    confidenceLevel,
  };
}

export function normalizeSearchResult(value: unknown, options: NormalizeOptions = {}): SearchResult {
  const root = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const recommendationsRaw = Array.isArray(root.recommendations) ? root.recommendations : [];
  const minConfidence = Number.isFinite(options.minConfidence as number) ? Number(options.minConfidence) : 0;

  const recommendations = recommendationsRaw
    .map((rec) => {
      if (!rec || typeof rec !== 'object') {
        return normalizeRecommendation(rec);
      }
      return normalizeRecommendation({ ...(rec as Record<string, unknown>), __query: options.query || '' });
    })
    .filter((rec) => rec.storeName || rec.productName)
    .filter((rec) => rec.confidenceScore >= minConfidence)
    .slice(0, 12);

  const summary = toSafeString(
    root.summary,
    recommendations.length > 0
      ? 'Found options from multiple stores. Compare price, shipping, and service before buying.'
      : 'No validated recommendations were returned for this search.'
  );

  return { recommendations, summary };
}
