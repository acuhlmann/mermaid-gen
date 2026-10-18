/**
 * HMAC verification for `POST /api/god/live`. Signing for the runner lives in
 * `scripts/god/ingestClient.mjs` (same `"<timestamp>.<body>"` contract).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { GOD_INGEST_MAX_SKEW_SEC } from '@archislop/shared';

export type GodIngestVerifyResult =
  | { ok: true; timestampSec: number }
  | {
      ok: false;
      reason: 'misconfigured' | 'missing_headers' | 'bad_timestamp' | 'stale' | 'bad_signature';
    };

function parseTimestamp(header: unknown): number | null {
  if (typeof header !== 'string' || !/^\d{1,12}$/.test(header)) return null;
  const sec = Number(header);
  if (!Number.isFinite(sec) || sec <= 0) return null;
  return sec;
}

function parseSignature(header: unknown): string | null {
  if (typeof header !== 'string') return null;
  const match = header.match(/^sha256=([0-9a-f]{64})$/i);
  return match ? match[1].toLowerCase() : null;
}

export function signGodIngestBody(
  secret: string,
  timestampSec: number | string,
  body: string
): string {
  const mac = createHmac('sha256', secret).update(`${timestampSec}.${body}`).digest('hex');
  return `sha256=${mac}`;
}

export function verifyGodIngestRequest(options: {
  secret: string | null | undefined;
  timestampHeader: unknown;
  signatureHeader: unknown;
  body: string;
  nowSec?: number;
  maxSkewSec?: number;
}): GodIngestVerifyResult {
  const configured = String(options.secret ?? '').trim();
  if (!configured) return { ok: false, reason: 'misconfigured' };

  const timestampSec = parseTimestamp(options.timestampHeader);
  const sigHex = parseSignature(options.signatureHeader);
  if (timestampSec === null || !sigHex) return { ok: false, reason: 'missing_headers' };

  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  const maxSkew = options.maxSkewSec ?? GOD_INGEST_MAX_SKEW_SEC;
  if (Math.abs(nowSec - timestampSec) > maxSkew) return { ok: false, reason: 'stale' };

  const expected = createHmac('sha256', configured)
    .update(`${timestampSec}.${options.body}`)
    .digest('hex');
  const a = Buffer.from(sigHex, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }

  return { ok: true, timestampSec };
}
