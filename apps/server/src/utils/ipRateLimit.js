/**
 * In-memory sliding-window rate limiter keyed by client IP.
 */

/**
 * @param {{ windowMs?: number, maxHits?: number }} [options]
 */
export function createIpRateLimiter({ windowMs = 60_000, maxHits = 30 } = {}) {
  /** @type {Map<string, number[]>} */
  const byKey = new Map();

  function clientKey(req) {
    const forwarded = req?.headers?.['x-forwarded-for'];
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (typeof raw === 'string' && raw.trim()) return raw.split(',')[0].trim();
    return req?.socket?.remoteAddress ?? 'unknown';
  }

  function pruneHits(hits, now) {
    return hits.filter((t) => now - t < windowMs);
  }

  function isLimited(req) {
    const key = clientKey(req);
    const now = Date.now();
    const hits = byKey.get(key);
    if (!hits) return false;
    const pruned = pruneHits(hits, now);
    byKey.set(key, pruned);
    return pruned.length >= maxHits;
  }

  function recordHit(req) {
    const key = clientKey(req);
    const now = Date.now();
    const existing = byKey.get(key) ?? [];
    const pruned = pruneHits(existing, now);
    pruned.push(now);
    byKey.set(key, pruned);
  }

  function reset(req) {
    byKey.delete(clientKey(req));
  }

  return { isLimited, recordHit, reset, clientKey };
}
