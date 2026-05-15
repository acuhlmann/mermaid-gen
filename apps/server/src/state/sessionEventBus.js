/**
 * Per-session pub/sub with a bounded in-memory log. Used to push collaboration
 * events (handshakes, proposals, presence, reactions, attributed insights,
 * state changes from external agents) to the web client over the always-open
 * /api/copilotkit/session-events SSE channel.
 *
 * Each published envelope gets a monotonic `seq` and `eventId` (the SSE `id`
 * field). Browsers resend Last-Event-ID on reconnect; the session-events route
 * replays buffered events after `sinceSeq`.
 */
const DEFAULT_MAX_HISTORY = 200;

export function createSessionEventBus({ maxHistoryPerSession = DEFAULT_MAX_HISTORY } = {}) {
  const listenersBySession = new Map();
  /** @type {Map<string, { nextSeq: number, events: object[] }>} */
  const historyBySession = new Map();

  function getOrCreateHistory(sessionId) {
    if (!historyBySession.has(sessionId)) {
      historyBySession.set(sessionId, { nextSeq: 1, events: [] });
    }
    return historyBySession.get(sessionId);
  }

  function stampEnvelope(sessionId, event) {
    const hist = getOrCreateHistory(sessionId);
    const seq = hist.nextSeq++;
    const envelope = {
      ...event,
      seq,
      eventId: String(seq),
      at: event.at ?? new Date().toISOString()
    };
    hist.events.push(envelope);
    while (hist.events.length > maxHistoryPerSession) {
      hist.events.shift();
    }
    return envelope;
  }

  function subscribe(sessionId, listener) {
    if (!listenersBySession.has(sessionId)) {
      listenersBySession.set(sessionId, new Set());
    }
    const set = listenersBySession.get(sessionId);
    set.add(listener);
    return () => {
      const current = listenersBySession.get(sessionId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) listenersBySession.delete(sessionId);
    };
  }

  /**
   * Append to the session log and notify live SSE subscribers.
   * @returns {object} stamped envelope (includes seq, eventId, at)
   */
  function publish(sessionId, event) {
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

  function getHistory(sessionId, { sinceSeq = 0 } = {}) {
    const hist = historyBySession.get(sessionId);
    if (!hist) return [];
    const floor = Number(sinceSeq);
    if (!Number.isFinite(floor) || floor < 0) return [...hist.events];
    return hist.events.filter((e) => e.seq > floor);
  }

  function getSessionMeta(sessionId) {
    const hist = historyBySession.get(sessionId);
    if (!hist || hist.events.length === 0) {
      return { latestSeq: 0, bufferedCount: 0, oldestSeq: 0 };
    }
    const oldest = hist.events[0];
    const newest = hist.events[hist.events.length - 1];
    return {
      latestSeq: newest.seq,
      oldestSeq: oldest.seq,
      bufferedCount: hist.events.length
    };
  }

  function parseSinceSeq(value) {
    if (value == null || value === '') return 0;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  /**
   * Wait for the next event after `sinceSeq`, optionally filtered by type.
   * @param {string} sessionId
   * @param {{ sinceSeq?: number, types?: string[], timeoutMs?: number }} [options]
   */
  function waitForEvent(sessionId, { sinceSeq = 0, types, timeoutMs = 50000 } = {}) {
    const floor = parseSinceSeq(sinceSeq);
    const pending = getHistory(sessionId, { sinceSeq: floor }).filter(
      (e) => !types?.length || types.includes(e.type)
    );
    if (pending.length > 0) {
      return Promise.resolve(pending[0]);
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
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
