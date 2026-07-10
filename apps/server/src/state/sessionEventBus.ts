/**
 * Per-session pub/sub with a bounded in-memory log for collaboration SSE.
 */

const DEFAULT_MAX_HISTORY = 200;

export type SessionEventEnvelope = {
  type: string;
  seq: number;
  eventId: string;
  at: string;
  [key: string]: unknown;
};

type SessionHistory = {
  nextSeq: number;
  events: SessionEventEnvelope[];
};

export type SessionEventListener = (envelope: SessionEventEnvelope) => void;

export type SessionEventBus = ReturnType<typeof createSessionEventBus>;

export function createSessionEventBus({ maxHistoryPerSession = DEFAULT_MAX_HISTORY } = {}) {
  const listenersBySession = new Map<string, Set<SessionEventListener>>();
  const historyBySession = new Map<string, SessionHistory>();

  function getOrCreateHistory(sessionId: string): SessionHistory {
    if (!historyBySession.has(sessionId)) {
      historyBySession.set(sessionId, { nextSeq: 1, events: [] });
    }
    return historyBySession.get(sessionId)!;
  }

  function stampEnvelope(sessionId: string, event: Record<string, unknown>): SessionEventEnvelope {
    const hist = getOrCreateHistory(sessionId);
    const seq = hist.nextSeq++;
    const envelope: SessionEventEnvelope = {
      ...event,
      type: String(event.type ?? 'unknown'),
      seq,
      eventId: String(seq),
      at: typeof event.at === 'string' ? event.at : new Date().toISOString()
    };
    hist.events.push(envelope);
    while (hist.events.length > maxHistoryPerSession) {
      hist.events.shift();
    }
    return envelope;
  }

  function subscribe(sessionId: string, listener: SessionEventListener) {
    if (!listenersBySession.has(sessionId)) {
      listenersBySession.set(sessionId, new Set());
    }
    const set = listenersBySession.get(sessionId)!;
    set.add(listener);
    return () => {
      const current = listenersBySession.get(sessionId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) listenersBySession.delete(sessionId);
    };
  }

  function publish(sessionId: string, event: Record<string, unknown>): SessionEventEnvelope {
    const envelope = stampEnvelope(sessionId, event);
    const set = listenersBySession.get(sessionId);
    if (!set || set.size === 0) return envelope;
    for (const listener of set) {
      try {
        listener(envelope);
      } catch {
        // Listener errors must not break sibling listeners or the publisher.
      }
    }
    return envelope;
  }

  function getHistory(sessionId: string, { sinceSeq = 0 }: { sinceSeq?: number } = {}) {
    const hist = historyBySession.get(sessionId);
    if (!hist) return [];
    const floor = Number(sinceSeq);
    if (!Number.isFinite(floor) || floor < 0) return [...hist.events];
    return hist.events.filter((e) => e.seq > floor);
  }

  function getSessionMeta(sessionId: string) {
    const hist = historyBySession.get(sessionId);
    if (!hist || hist.events.length === 0) {
      return { latestSeq: 0, bufferedCount: 0, oldestSeq: 0 };
    }
    const oldest = hist.events[0]!;
    const newest = hist.events[hist.events.length - 1]!;
    return {
      latestSeq: newest.seq,
      oldestSeq: oldest.seq,
      bufferedCount: hist.events.length
    };
  }

  function parseSinceSeq(value: unknown): number {
    if (value == null || value === '') return 0;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  function waitForEvent(
    sessionId: string,
    {
      sinceSeq = 0,
      types,
      timeoutMs = 50000
    }: { sinceSeq?: number; types?: string[]; timeoutMs?: number } = {}
  ): Promise<SessionEventEnvelope | null> {
    const floor = parseSinceSeq(sinceSeq);
    const pending = getHistory(sessionId, { sinceSeq: floor }).filter(
      (e) => !types?.length || types.includes(e.type)
    );
    if (pending.length > 0) {
      return Promise.resolve(pending[0]!);
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (value: SessionEventEnvelope | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        resolve(value);
      };

      const unsubscribe = subscribe(sessionId, (envelope) => {
        if (envelope.seq <= floor) return;
        if (types?.length && !types.includes(envelope.type)) return;
        finish(envelope);
      });

      const timer = setTimeout(() => finish(null), timeoutMs);
      timer.unref?.();
    });
  }

  return {
    subscribe,
    publish,
    getHistory,
    getSessionMeta,
    parseSinceSeq,
    waitForEvent
  };
}
