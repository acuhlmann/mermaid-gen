/** Shared SSE + long-poll bridge for MCP Apps (session-events feed). */

export const MCP_APP_SESSION_BRIDGE_SCRIPT = `
function parseToolJson(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

/**
 * @param {{ onEvent: (envelope: object) => void, onSnapshot?: (payload: object) => void }} handlers
 */
export function createSessionEventBridge(handlers) {
  let sinceSeq = 0;
  let es = null;
  let pollActive = false;
  let stopped = false;

  function handleEnvelope(envelope) {
    if (!envelope || stopped) return;
    if (typeof envelope.seq === "number" && envelope.seq > sinceSeq) sinceSeq = envelope.seq;
    if (envelope.type === "snapshot" && handlers.onSnapshot) {
      handlers.onSnapshot(envelope.payload ?? {});
    }
    handlers.onEvent?.(envelope);
  }

  async function pollOnce() {
    if (stopped || !pollActive) return;
    try {
      const result = await app.callServerTool({
        name: "wait_for_session_event",
        arguments: { sinceSeq, timeoutMs: 4000 },
      });
      const body = parseToolJson(result);
      if (body?.status === "ok" && body.event) handleEnvelope(body.event);
    } catch {
      /* ignore poll errors */
    }
    if (!stopped && pollActive) setTimeout(pollOnce, 200);
  }

  function startPolling() {
    if (pollActive || stopped) return;
    pollActive = true;
    pollOnce();
  }

  async function start() {
    if (stopped) return;
    let sub = null;
    try {
      const result = await app.callServerTool({ name: "subscribe_session_events", arguments: {} });
      sub = parseToolJson(result);
    } catch {
      startPolling();
      return;
    }
    if (!sub?.sessionEventsUrl) {
      startPolling();
      return;
    }
    let url = sub.sessionEventsUrl;
    if (sub.agentToken) {
      const sep = url.includes("?") ? "&" : "?";
      url += sep + "agentToken=" + encodeURIComponent(sub.agentToken);
    }
    try {
      es = new EventSource(url);
      es.onmessage = (ev) => {
        if (!ev?.data) return;
        try { handleEnvelope(JSON.parse(ev.data)); } catch { /* ignore */ }
      };
      es.onerror = () => {
        try { es?.close(); } catch { /* ignore */ }
        es = null;
        startPolling();
      };
    } catch {
      startPolling();
    }
  }

  function stop() {
    stopped = true;
    pollActive = false;
    try { es?.close(); } catch { /* ignore */ }
    es = null;
  }

  return { start, stop };
}
`;
