import { createIpRateLimiter } from '../utils/ipRateLimit.js';

const WINDOW_MS = Number(process.env.MCP_RATE_LIMIT_WINDOW_MS) || 60_000;
const MAX_FAILURES = Number(process.env.MCP_RATE_LIMIT_MAX_FAILURES) || 30;

/**
 * In-memory sliding-window rate limiter for failed MCP pairing / join attempts.
 */
export function createMcpRateLimiter({ windowMs = WINDOW_MS, maxFailures = MAX_FAILURES } = {}) {
  const limiter = createIpRateLimiter({ windowMs, maxHits: maxFailures });
  return {
    isLimited: (req) => limiter.isLimited(req),
    recordFailure: (req) => limiter.recordHit(req),
    reset: (req) => limiter.reset(req),
    clientKey: (req) => limiter.clientKey(req)
  };
}
