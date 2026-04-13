/**
 * To Safe String.
 */
export function toSafeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

/**
 * To Safe Number.
 */
export function toSafeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/**
 * To Safe Currency.
 */
export function toSafeCurrency(value: unknown, fallback = 'USD'): string {
  const raw = toSafeString(value, fallback).trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(raw)) return raw;
  return fallback;
}

/**
 * To Safe String Array.
 */
export function toSafeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => toSafeString(item)).filter(Boolean).slice(0, 8);
}

/**
 * To Safe Specifications.
 */
export function toSafeSpecifications(value: unknown): Array<{ feature: string; value: string }> {
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

/**
 * Fetches Page Text.
 */
export function extractFirstJsonObject(text: string): string | null {
  const source = text.trim();
  const start = source.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (isEscaped) isEscaped = false;
      else if (ch === '\\') isEscaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Fetches Page Text.
 */
export async function fetchPageText(url: string, timeoutMs = 5000): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; DealFinder/1.0)' },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parses Ld Json For Product.
 */
export function parseLdJsonForProduct(html: string): boolean {
  try {
    const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;
    while ((match = scriptRegex.exec(html))) {
      const payload = match[1];
      try {
        const parsed = JSON.parse(payload);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const it of items) {
          if (!it) continue;
          const type = (it['@type'] || it['@type']?.toString?.() || '').toString().toLowerCase();
          if (type === 'product' || (Array.isArray(it['@type']) && it['@type'].map((s:any)=>String(s).toLowerCase()).includes('product'))) return true;
        }
      } catch {}
    }
  } catch {}
  return false;
}

/**
 * Checks if HTML looks like a product page.
 */
export function htmlLooksLikeProductPage(html: string): boolean {
  if (!html) return false;
  const lowered = html.toLowerCase();
  if (parseLdJsonForProduct(html)) return true;
  if (/(itemtype\s*=\s*["']https?:\/\/(schema\.org\/|schema.org\/)?product)/i.test(html)) return true;
  if (/(add to cart|add to basket|buy now|product details)/i.test(lowered)) return true;
  if (/meta\s+property=["']og:type["']\s+content=["']product["']/i.test(html)) return true;
  return false;
}
