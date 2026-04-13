// File role: URL normalization and safe link generation for recommendation actions.
export interface LinkInput {
  url?: string;
  domain?: string;
  productName?: string;
  storeName?: string;
  fallbackUrl?: string;
}

const TRACKING_QUERY_PREFIXES = ['utm_', 'mc_'];
const TRACKING_QUERY_KEYS = new Set([
  'gclid',
  'fbclid',
  'msclkid',
  'ref',
  'ref_',
  'source',
  'campaign',
  'affiliate',
  'affid',
]);
const PRODUCT_IDENTIFIER_QUERY_KEYS = new Set(['id', 'pid', 'productid', 'sku', 'skuid', 'asin', 'item', 'model', 'variant']);
const SEARCH_QUERY_KEYS = new Set(['q', 'query', 'search', 'keyword', 'k']);
const GENERIC_LISTING_SEGMENTS = new Set(['search', 's', 'shop', 'store', 'category', 'categories', 'collections', 'products', 'deals']);
const SEARCH_OR_AGGREGATOR_HOST_PATTERNS = [
  /(^|\.)google\./,
  /(^|\.)bing\.com$/,
  /(^|\.)search\.yahoo\.com$/,
  /(^|\.)duckduckgo\.com$/,
  /(^|\.)baidu\.com$/,
  /(^|\.)yandex\./,
  /(^|\.)facebook\.com$/,
  /(^|\.)instagram\.com$/,
  /(^|\.)tiktok\.com$/,
  /(^|\.)reddit\.com$/,
  /(^|\.)pinterest\./,
  /(^|\.)youtube\.com$/,
  /(^|\.)x\.com$/,
  /(^|\.)twitter\.com$/,
  /(^|\.)t\.co$/,
];

/**
 * Checks whether Likely Cdn Host.
 *
 * @param hostname - Value supplied by the caller.
 * @returns True when the condition is met so callers can branch safely.
 */
function isLikelyCdnHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host.endsWith('cloudfront.net') ||
    host.endsWith('akamaihd.net') ||
    host.endsWith('fastly.net') ||
    host.endsWith('edgekey.net')
  );
}

/**
 * Checks whether Search Or Aggregator Host.
 *
 * @param hostname - Value supplied by the caller.
 * @returns True when the condition is met so callers can branch safely.
 */
function isSearchOrAggregatorHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, '').trim();
  return SEARCH_OR_AGGREGATOR_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

/**
 * Checks whether Generic Listing Path.
 *
 * @param pathname - Value supplied by the caller.
 * @returns True when the condition is met so callers can branch safely.
 */
function isGenericListingPath(pathname: string): boolean {
  const normalized = pathname.toLowerCase().replace(/\/+/g, '/').replace(/\/$/, '');
  if (!normalized || normalized === '/') return true;

  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) return true;
  if (GENERIC_LISTING_SEGMENTS.has(segments[0]) && segments.length <= 2) return true;
  if ((segments[0] === 'search' || segments[0] === 's') && segments.length <= 2) return true;

  return false;
}

/**
 * Checks whether Search Intent Query.
 *
 * @param parsed - Value supplied by the caller.
 * @returns True when the condition is met so callers can branch safely.
 */
function hasSearchIntentQuery(parsed: URL): boolean {
  for (const key of parsed.searchParams.keys()) {
    if (SEARCH_QUERY_KEYS.has(key.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Gets Direct Recommendation Href.
 *
 * @param input - Value supplied by the caller.
 * @returns Computed value used by downstream logic.
 */
export function getDirectRecommendationHref(input: LinkInput): string {
  const candidateUrl = (input.url || '').trim();
  if (!candidateUrl) return '';

  const withProtocol = candidateUrl.startsWith('http://') || candidateUrl.startsWith('https://')
    ? candidateUrl
    : `https://${candidateUrl}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    if (isLikelyCdnHost(parsed.hostname)) return '';
    if (isSearchOrAggregatorHost(parsed.hostname)) return '';

    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      const lowerKey = key.toLowerCase();
      const isTrackingPrefix = TRACKING_QUERY_PREFIXES.some((prefix) => lowerKey.startsWith(prefix));
      const isTrackingKey = TRACKING_QUERY_KEYS.has(lowerKey) || lowerKey.startsWith('ref_') || lowerKey.endsWith('_source');
      if (isTrackingPrefix || isTrackingKey) {
        parsed.searchParams.delete(key);
      }
    }

    const hasIdentifierParam = [...parsed.searchParams.keys()].some((key) => PRODUCT_IDENTIFIER_QUERY_KEYS.has(key.toLowerCase()));
    if (hasSearchIntentQuery(parsed) && !hasIdentifierParam) return '';
    if (isGenericListingPath(parsed.pathname) && !hasIdentifierParam) return '';

    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Normalizes Domain.
 *
 * @param domain - Value supplied by the caller.
 * @returns Computed value used by downstream logic.
 */
function normalizeDomain(domain: string): string {
  return domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/**
 * Gets Reliable Recommendation Href.
 *
 * @param input - Value supplied by the caller.
 * @param query - Value supplied by the caller.
 * @returns Computed value used by downstream logic.
 */
export function getReliableRecommendationHref(input: LinkInput, query: string): string {
  const direct = getDirectRecommendationHref(input);
  if (direct) {
    return direct;
  }

  if (input.fallbackUrl && input.fallbackUrl.startsWith('https://www.google.com/search?q=')) {
    return input.fallbackUrl;
  }

  let safeDomain = normalizeDomain(input.domain || '');

  if (!safeDomain && direct) {
    try {
      safeDomain = new URL(direct).hostname;
    } catch {
      safeDomain = '';
    }
  }

  if (!safeDomain && input.url) {
    const candidateUrl = input.url.trim();
    const withProtocol = candidateUrl.startsWith('http://') || candidateUrl.startsWith('https://')
      ? candidateUrl
      : `https://${candidateUrl}`;
    try {
      const parsed = new URL(withProtocol);
      if (!isSearchOrAggregatorHost(parsed.hostname)) {
        safeDomain = parsed.hostname;
      }
    } catch {
      safeDomain = '';
    }
  }

  const productTerm = (input.productName || query || '').trim();
  const storeTerm = (input.storeName || '').trim();

  // Region-aware fallback for local stores (e.g. Tunisia)
  const isTunisia = (input.fallbackUrl?.includes('Tunisie') || query.toLowerCase().includes('tunisie'));
  const regionTag = isTunisia ? 'Tunisie prix' : 'buy';

  const searchQuery = [
    safeDomain ? `site:${safeDomain}` : '',
    productTerm,
    storeTerm,
    regionTag,
  ].filter(Boolean).join(' ') || query;

  return `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
}

