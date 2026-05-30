import type { NextFunction, Request, Response } from 'express';
import { createIpRateLimiter } from '../utils/ipRateLimit.js';

const JOIN_WINDOW_MS = Number(process.env.API_JOIN_RATE_LIMIT_WINDOW_MS) || 60_000;
const JOIN_MAX = Number(process.env.API_JOIN_RATE_LIMIT_MAX) || 60;
const LLM_WINDOW_MS = Number(process.env.API_LLM_RATE_LIMIT_WINDOW_MS) || 60_000;
const LLM_MAX = Number(process.env.API_LLM_RATE_LIMIT_MAX) || 60;

const joinLimiter = createIpRateLimiter({ windowMs: JOIN_WINDOW_MS, maxHits: JOIN_MAX });
const llmLimiter = createIpRateLimiter({ windowMs: LLM_WINDOW_MS, maxHits: LLM_MAX });

const LLM_PATHS = new Set(['/intent', '/transform', '/analyze', '/agent-stream', '/style']);

function rateLimitResponse(res: Response): void {
  res.status(429).json({ error: 'Too many requests. Try again later.' });
}

export function createApiRateLimitMiddleware(kind: 'join' | 'llm') {
  const limiter = kind === 'join' ? joinLimiter : llmLimiter;
  return (req: Request, res: Response, next: NextFunction): void => {
    if (limiter.isLimited(req)) {
      rateLimitResponse(res);
      return;
    }
    limiter.recordHit(req);
    next();
  };
}

export function apiLlmRateLimitIfNeeded(req: Request, res: Response, next: NextFunction): void {
  const suffix = req.path?.replace(/\/$/, '') ?? '';
  if (!LLM_PATHS.has(suffix)) {
    next();
    return;
  }
  createApiRateLimitMiddleware('llm')(req, res, next);
}
