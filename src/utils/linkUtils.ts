// File role: URL normalization and safe link generation for recommendation actions.
export interface LinkInput {
  url?: string;
  domain?: string;
  productName?: string;
  storeName?: string;
  fallbackUrl?: string;
}

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
  if (input.fallbackUrl && input.fallbackUrl.startsWith('https://www.google.com/search?q=')) {
    return input.fallbackUrl;
  }

  const direct = getDirectRecommendationHref(input);
  let safeDomain = normalizeDomain(input.domain || '');

  if (!safeDomain && direct) {
    try {
      safeDomain = new URL(direct).hostname;
    } catch {
      safeDomain = '';
    }
  }

  const terms = [input.productName || query, input.storeName].filter(Boolean).join(' ');
  const searchQuery = safeDomain ? `site:${safeDomain} ${terms}` : terms || query;
  return `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
}

