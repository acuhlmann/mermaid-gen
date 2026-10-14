/**
 * In-memory sliding-window rate limiter keyed by client IP.
 */

/**
 * The first `X-Forwarded-For` entry. Note the client controls that header, so on Cloud Run this key
 * is spoofable; new limiters pass `keyFn: keyByRequestIp` instead.
 */
function firstForwardedFor(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof raw === 'string' && raw.trim()) return raw.split(',')[0].trim();
  return req?.socket?.remoteAddress ?? 'unknown';
}

/**
 * Express's `req.ip`, which honours `trust proxy` (set to 1 in `bootstrapServer.js`): the address
 * the trusted front proxy saw, not a header the client wrote.
 */
export function keyByRequestIp(req) {
  return req?.ip || req?.socket?.remoteAddress || 'unknown';
}

/**
 * @param {{ windowMs?: number, maxHits?: number, keyFn?: (req: any) => string }} [options]
 */
export function createIpRateLimiter({
  windowMs = 60_000,
  maxHits = 30,
  keyFn = firstForwardedFor
} = {}) {
  /** @type {Map<string, number[]>} */
  const byKey = new Map();

  function clientKey(req) {
    return keyFn(req);
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
