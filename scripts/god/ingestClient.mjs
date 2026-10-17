/**
 * Live-event delivery from the God runner to the owner's **Now** view (ADR-0019 §10).
 *
 * NOT WIRED TO ANYTHING YET. There is no `POST /api/god/live` route in `apps/server/src`, and
 * `.github/workflows/god.yml` passes neither `--ingest-url` nor `--ingest-secret-file`, so in CI this
 * client always takes the unconfigured no-op branch below. Read the rest as the *intended* receiver
 * contract — a spec for whoever builds the route — not as behaviour that exists. It used to be written
 * as fact ("the server rejects stale timestamps and replayed sequence numbers"), which is how a
 * phantom endpoint survives review.
 *
 * Signature: `x-god-signature: sha256=<hex HMAC-SHA256(secret, "<timestamp>.<raw body>")>` with
 * `x-god-timestamp: <unix seconds>`; the receiver is to reject stale timestamps and replayed sequence
 * numbers. Delivery is best-effort by design — the live view is a convenience, the durable record
 * is the run report on the `god-log` branch — so a failed POST is counted and dropped, never
 * retried, and an unconfigured client is a no-op. Because it never throws, `send` keeps "nothing is
 * listening at this URL" separate from "the network hiccuped": see `stats.misconfigured`.
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
  const stats = { sent: 0, failed: 0, dropped: 0, misconfigured: 0 };
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
      if (res.ok) {
        stats.sent += events.length;
      } else {
        stats.failed += events.length;
        // Best-effort delivery never throws, so a URL that answers 404 looks exactly like a network
        // hiccup in `failed` — and today that is the *expected* outcome, since the route does not
        // exist. Counting it separately means an owner who wires up `--ingest-url` and mints the
        // secret sees "nothing is listening" in the run report instead of a silent zero-event run.
        if (res.status === 404 || res.status === 405 || res.status === 501) {
          stats.misconfigured += events.length;
        }
      }
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
