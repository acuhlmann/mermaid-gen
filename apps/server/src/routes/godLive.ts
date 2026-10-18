/**
 * Live harness events: `POST /api/god/live` (HMAC, runner) and `GET /api/god/live/:runId` (owner cookie).
 */
import express, { type Request, type Response } from 'express';
import { verifyGodIngestRequest } from '../god/godIngestAuth.js';
import {
  appendGodLiveBatch,
  parseGodLiveBatchBody,
  readGodLiveEvents
} from '../god/godLiveStore.js';

type Env = Record<string, string | undefined>;

export type GodLiveRouterOptions = {
  env?: Env;
  nowMs?: () => number;
};

function readRawBody(req: Request): string {
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  return '';
}

/**
 * Runner ingest — mounted **before** the owner cookie gate. Authenticated only by `GOD_INGEST_SECRET`.
 */
export function createGodLiveIngestHandler(options: GodLiveRouterOptions = {}) {
  const env = options.env ?? process.env;
  const nowMs = options.nowMs ?? (() => Date.now());

  return (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    const raw = readRawBody(req);
    const verified = verifyGodIngestRequest({
      secret: env.GOD_INGEST_SECRET,
      timestampHeader: req.headers['x-god-timestamp'],
      signatureHeader: req.headers['x-god-signature'],
      body: raw,
      nowSec: Math.floor(nowMs() / 1000)
    });
    if (verified.ok === false) {
      const reason = verified.reason;
      const status =
        reason === 'misconfigured'
          ? 503
          : reason === 'stale' || reason === 'bad_signature'
            ? 401
            : 400;
      res.status(status).json({ error: reason });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(400).json({ error: 'invalid_json' });
      return;
    }

    const batch = parseGodLiveBatchBody(parsed);
    if (!batch.success) {
      res.status(400).json({ error: 'invalid_batch' });
      return;
    }

    const result = appendGodLiveBatch(batch.data.runId, batch.data.events, nowMs());
    if (result.ok === false) {
      const reason = result.reason;
      res.status(reason === 'replay' ? 409 : 400).json({ error: reason });
      return;
    }

    res.status(204).end();
  };
}

/** Owner read — mounted behind `createGodWindowGate`. */
export function createGodLiveReadRouter(options: GodLiveRouterOptions = {}) {
  const router = express.Router();

  router.get('/live/:runId', (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    const runId = typeof req.params.runId === 'string' ? req.params.runId.trim() : '';
    if (!/^\d{1,20}$/.test(runId)) {
      res.status(400).json({ error: 'invalid_run_id' });
      return;
    }
    const afterRaw = typeof req.query.after === 'string' ? Number(req.query.after) : -1;
    const afterSeq = Number.isFinite(afterRaw) && afterRaw >= -1 ? Math.floor(afterRaw) : -1;
    const { events, lastSeq } = readGodLiveEvents(runId, afterSeq);
    res.status(200).json({ v: 1, runId, afterSeq, lastSeq, events });
  });

  return router;
}
