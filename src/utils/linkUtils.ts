export interface LinkInput {
  url?: string;
  domain?: string;
  productName?: string;
  storeName?: string;
  fallbackUrl?: string;
}

export function getDirectRecommendationHref(input: LinkInput): string {
  const candidateUrl = (input.url || '').trim();
  if (!candidateUrl) return '';

  const withProtocol = candidateUrl.startsWith('http://') || candidateUrl.startsWith('https://')
    ? candidateUrl
    : `https://${candidateUrl}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function normalizeDomain(domain: string): string {
  return domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

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
