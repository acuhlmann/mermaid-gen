/**
 * In-memory buffer for God's live harness events (ADR-0019 §10). Ephemeral by design: the durable
 * record is the run report on `god-log`; this exists only so the owner window can watch a run.
 */
import { GodLiveBatchSchema, type GodLiveEvent } from '@archislop/shared';

export const GOD_LIVE_MAX_EVENTS_PER_RUN = 2_000;
export const GOD_LIVE_RUN_TTL_MS = 24 * 60 * 60 * 1000;
/** Runs with ingest activity newer than this appear on `GET /api/god/status`. */
export const GOD_LIVE_ACTIVE_MS = 30 * 60 * 1000;

type RunBuffer = {
  runId: string;
  events: GodLiveEvent[];
  lastSeq: number;
  updatedAtMs: number;
};

const runs = new Map<string, RunBuffer>();

function pruneExpired(nowMs: number) {
  for (const [runId, buf] of runs) {
    if (nowMs - buf.updatedAtMs > GOD_LIVE_RUN_TTL_MS) runs.delete(runId);
  }
}

export type GodLiveAppendResult =
  { ok: true; accepted: number; lastSeq: number } | { ok: false; reason: 'replay' | 'empty' };

/**
 * Append a validated batch. Every event `seq` must be strictly greater than the last stored seq for
 * this run, and strictly increasing within the batch.
 */
export function appendGodLiveBatch(
  runId: string,
  events: GodLiveEvent[],
  nowMs = Date.now()
): GodLiveAppendResult {
  pruneExpired(nowMs);
  if (!events.length) return { ok: false, reason: 'empty' };

  let buf = runs.get(runId);
  if (!buf) {
    buf = { runId, events: [], lastSeq: -1, updatedAtMs: nowMs };
    runs.set(runId, buf);
  }

  let last = buf.lastSeq;
  for (const event of events) {
    if (event.seq <= last) return { ok: false, reason: 'replay' };
    last = event.seq;
  }

  buf.events.push(...events);
  if (buf.events.length > GOD_LIVE_MAX_EVENTS_PER_RUN) {
    buf.events = buf.events.slice(-GOD_LIVE_MAX_EVENTS_PER_RUN);
  }
  buf.lastSeq = last;
  buf.updatedAtMs = nowMs;
  return { ok: true, accepted: events.length, lastSeq: buf.lastSeq };
}

export function listActiveGodLiveRuns(nowMs = Date.now()) {
  pruneExpired(nowMs);
  const out = [];
  for (const buf of runs.values()) {
    if (nowMs - buf.updatedAtMs > GOD_LIVE_ACTIVE_MS) continue;
    out.push({
      runId: buf.runId,
      updatedAt: new Date(buf.updatedAtMs).toISOString(),
      lastSeq: buf.lastSeq,
      eventCount: buf.events.length
    });
  }
  out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return out;
}

export function readGodLiveEvents(runId: string, afterSeq: number, limit = 100) {
  const buf = runs.get(runId);
  if (!buf) return { runId, events: [] as GodLiveEvent[], lastSeq: -1 };
  const events = buf.events.filter((e) => e.seq > afterSeq).slice(0, limit);
  return { runId, events, lastSeq: buf.lastSeq };
}

/** Test seam — drop all buffered runs. */
export function resetGodLiveStore() {
  runs.clear();
}

export function parseGodLiveBatchBody(raw: unknown) {
  return GodLiveBatchSchema.safeParse(raw);
}
