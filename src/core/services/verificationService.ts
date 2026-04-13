import { 
  VERIFICATION_TTL_MS, 
  URL_REACHABILITY_TTL_MS, 
  URL_CHECK_TIMEOUT_MS, 
  IS_TEST 
} from '../config';
import { fetchPageText, htmlLooksLikeProductPage } from '../utils/htmlUtils';
import { logger } from '../../utils/logger';

export const verificationCache = new Map<string, { verified: boolean; checkedAt: number; expiresAt: number }>();
export const urlReachabilityCache = new Map<string, { ok: boolean; checkedAt: number }>();
export const pendingVerifications = new Set<string>();
let verifierRunning = false;

/**
 * Probes URL status with timeout.
 */
async function probeUrlStatus(url: string, method: 'HEAD' | 'GET'): Promise<number | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), URL_CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: { Accept: 'text/html,*/*;q=0.8', 'User-Agent': 'Mozilla/5.0' },
    });
    return response.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Checks if a direct URL is reachable.
 */
export async function isDirectUrlReachable(url: string): Promise<boolean> {
  if (IS_TEST) return true;
  const now = Date.now();
  const cached = urlReachabilityCache.get(url);
  if (cached && now - cached.checkedAt < URL_REACHABILITY_TTL_MS) return cached.ok;

  const accepted = new Set([200, 201, 202, 203, 204, 206, 301, 302, 303, 307, 308, 401, 403, 405, 429]);
  const status = await probeUrlStatus(url, 'HEAD');
  let reachable = status !== null && accepted.has(status);

  if (status === null || status === 405) {
    const getStatus = await probeUrlStatus(url, 'GET');
    reachable = getStatus !== null && accepted.has(getStatus);
  }

  urlReachabilityCache.set(url, { ok: reachable, checkedAt: now });
  return reachable;
}

/**
 * Verifies URL metadata (background).
 */
export async function verifyUrlMetadata(url: string): Promise<boolean> {
  const now = Date.now();
  const cached = verificationCache.get(url);
  if (cached && cached.expiresAt > now) return cached.verified;

  const html = await fetchPageText(url, 6_000);
  const verified = html ? htmlLooksLikeProductPage(html) : false;
  verificationCache.set(url, { verified, checkedAt: now, expiresAt: now + VERIFICATION_TTL_MS });
  return verified;
}

/**
 * Starts the background verification loop.
 */
export async function startBackgroundVerifier() {
  if (verifierRunning) return;
  verifierRunning = true;
  try {
    while (pendingVerifications.size > 0) {
      const url = pendingVerifications.values().next().value;
      if (!url) {
        pendingVerifications.clear();
        break;
      }
      pendingVerifications.delete(url);
      try {
        await verifyUrlMetadata(url);
      } catch (e) {
        logger.warn('Verification error', { url, err: String(e) });
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  } finally {
    verifierRunning = false;
  }
}
