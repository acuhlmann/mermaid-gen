/**
 * `POST /api/signals` — content-free usage signals from the browser (ADR-0019).
 *
 * The body is validated against the *client* signal union only, so a browser can neither widen a
 * signal with free text (the objects are strict) nor forge a server-side kind. Each accepted
 * signal becomes one `ux_signal` stdout line via `recordUxSignal`, which validates again. Nothing
 * here stores, aggregates or triggers anything: the route records, ArchiSlop God reads the logs
 * off-box, on its own schedule.
 *
 * Beacons sent on `pagehide` use a `text/plain` Blob (a CORS-safelisted type browsers will send
 * without fuss), so the route parses that as well as `application/json`. Responses never echo the
 * payload or validation detail. When signals are switched off the route still answers 204, so a
 * client never retries into a disabled server.
 */
import express, { type Request, type Response } from 'express';
import { UxClientSignalBatchSchema, type UxClientSignal } from '@archislop/shared';
import { createIpRateLimiter, keyByRequestIp } from '../utils/ipRateLimit.js';
import { isUxSignalsEnabled, recordUxSignal } from '../metrics/uxSignalMetrics.js';

/** A full 50-signal batch is ~6 KB; anything near this cap is not a browser following the schema. */
export const SIGNALS_BODY_LIMIT_BYTES = 16 * 1024;

type Env = Record<string, string | undefined>;

export type SignalsRouterOptions = {
  env?: Env;
  /** Test seam: where each accepted signal goes. Defaults to the stdout metric line. */
  record?: (signal: UxClientSignal) => unknown;
  windowMs?: number;
  /** Batches per client IP per window. */
  maxBatches?: number;
};

function parseBody(body: unknown): unknown {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

export function createSignalsRouter({
  env = process.env,
  record = (signal) => recordUxSignal(signal, { env }),
  windowMs = 60_000,
  maxBatches = 30
}: SignalsRouterOptions = {}) {
  const limiter = createIpRateLimiter({ windowMs, maxHits: maxBatches, keyFn: keyByRequestIp });
  const router = express.Router();

  router.post(
    '/',
    express.text({ type: 'text/plain', limit: SIGNALS_BODY_LIMIT_BYTES }),
    (req: Request, res: Response) => {
      if (!isUxSignalsEnabled(env)) {
        res.status(204).end();
        return;
      }
      if (Number(req.headers['content-length']) > SIGNALS_BODY_LIMIT_BYTES) {
        res.status(413).json({ error: 'Payload too large' });
        return;
      }
      if (limiter.isLimited(req)) {
        res.status(429).json({ error: 'Too many requests. Try again later.' });
        return;
      }
      limiter.recordHit(req);

      const parsed = UxClientSignalBatchSchema.safeParse(parseBody(req.body));
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid signals payload' });
        return;
      }
      for (const signal of parsed.data.signals) record(signal);
      res.status(204).end();
    }
  );

  return router;
}
