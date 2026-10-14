/**
 * Live-event delivery from the God runner to production's `POST /api/god/live` (ADR-0019).
 *
 * Signature: `x-god-signature: sha256=<hex HMAC-SHA256(secret, "<timestamp>.<raw body>")>` with
 * `x-god-timestamp: <unix seconds>`; the server rejects stale timestamps and replayed sequence
 * numbers. Delivery is best-effort by design — the live view is a convenience, the durable record
 * is the run report on the `god-log` branch — so a failed POST is counted and dropped, never
 * retried, and an unconfigured client is a no-op.
 */
import { createHmac } from 'node:crypto';

export const GOD_INGEST_SIGNATURE_HEADER = 'x-god-signature';
export const GOD_INGEST_TIMESTAMP_HEADER = 'x-god-timestamp';

/** The canonical signature for one request body. */
export function signGodIngestBody(secret, timestamp, body) {
  const mac = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `sha256=${mac}`;
}

/**
 * @param {{
 *   url?: string | null,
 *   secret?: string | null,
 *   runId: string,
 *   fetchImpl?: typeof fetch,
 *   intervalMs?: number,
 *   maxBatch?: number,
 *   timeoutMs?: number,
 *   nowSeconds?: () => number
 * }} options
 */
export function createIngestClient({
  url,
  secret,
  runId,
  fetchImpl = fetch,
  intervalMs = 2000,
  maxBatch = 100,
  timeoutMs = 5000,
  nowSeconds = () => Math.floor(Date.now() / 1000)
}) {
  const stats = { sent: 0, failed: 0, dropped: 0 };
  if (!url || !secret) {
    return {
      enabled: false,
      push() {},
      flush: async () => {},
      close: async () => {},
      stats: () => ({ ...stats })
    };
  }

  let queue = [];
  let inFlight = Promise.resolve();

  const send = async (events) => {
    const body = JSON.stringify({ runId, events });
    const timestamp = String(nowSeconds());
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [GOD_INGEST_TIMESTAMP_HEADER]: timestamp,
          [GOD_INGEST_SIGNATURE_HEADER]: signGodIngestBody(secret, timestamp, body)
        },
        body,
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (res.ok) stats.sent += events.length;
      else stats.failed += events.length;
    } catch {
      stats.failed += events.length;
    }
  };

  const flush = () => {
    while (queue.length > 0) {
      const batch = queue.slice(0, maxBatch);
      queue = queue.slice(maxBatch);
      inFlight = inFlight.then(() => send(batch));
    }
    return inFlight;
  };

  const timer = setInterval(() => void flush(), intervalMs);
  timer.unref?.();

  return {
    enabled: true,
    push(event) {
      if (queue.length >= maxBatch * 20) {
        stats.dropped += 1;
        return;
      }
      queue.push(event);
    },
    flush,
    async close() {
      clearInterval(timer);
      await flush();
    },
    stats: () => ({ ...stats })
  };
}
