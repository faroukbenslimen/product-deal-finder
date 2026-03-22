// File role: URL normalization and safe link generation for recommendation actions.
export interface LinkInput {
  url?: string;
  domain?: string;
  productName?: string;
  storeName?: string;
  fallbackUrl?: string;
}

/**
 * Checks whether Likely Cdn Host so this file stays easier to maintain for the next developer.
 *
 * @param hostname - hostname provided by the caller to control this behavior.
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
 * Gets Direct Recommendation Href so this file stays easier to maintain for the next developer.
 *
 * @param input - input provided by the caller to control this behavior.
 * @returns The computed value this helper produces for downstream logic.
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
 * Normalizes Domain so this file stays easier to maintain for the next developer.
 *
 * @param domain - domain provided by the caller to control this behavior.
 * @returns The computed value this helper produces for downstream logic.
 */
function normalizeDomain(domain: string): string {
  return domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/**
 * Gets Reliable Recommendation Href so this file stays easier to maintain for the next developer.
 *
 * @param input - input provided by the caller to control this behavior.
 * @param query - query provided by the caller to control this behavior.
 * @returns The computed value this helper produces for downstream logic.
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

