import { IS_TEST, IP_COOLDOWN_MS } from '../config';

const lastRequestByScope = new Map<string, number>();

/**
 * Checks if a client IP is in cooldown for a specific scope.
 */
export function isInCooldown(ip: string, scope: 'search' | 'identify'): { blocked: boolean; retryAfterMs: number } {
  if (IS_TEST) return { blocked: false, retryAfterMs: 0 };

  const key = `${ip}:${scope}`;
  const last = lastRequestByScope.get(key) || 0;
  const now = Date.now();
  const elapsed = now - last;

  if (elapsed < IP_COOLDOWN_MS) {
    return { blocked: true, retryAfterMs: IP_COOLDOWN_MS - elapsed };
  }

  lastRequestByScope.set(key, now);
  return { blocked: false, retryAfterMs: 0 };
}

/**
 * Helper to get client IP from Express request.
 */
export function getClientIp(req: any): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}
