export const STREAM_DEBUG_LS_KEY = 'archislop-stream-debug';

/** Stream-event debug is on if localStorage has the toggle or the URL carries `?streamDebug=1`. */
export function readStreamDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.localStorage?.getItem(STREAM_DEBUG_LS_KEY) === '1') return true;
    const q = new URLSearchParams(window.location.search);
    return q.get('streamDebug') === '1';
  } catch {
    return false;
  }
}

type StreamDebugEvent = Record<string, unknown> & {
  type?: string;
  text?: string;
  state?: { revisionId?: unknown; diagramSource?: unknown };
};

/** Truncate stream events before logging so the console isn't flooded with full diagrams/tokens. */
export function snapshotStreamEventForDebug(evt: unknown): unknown {
  if (!evt || typeof evt !== 'object') return evt;
  const e = evt as StreamDebugEvent;
  if (e.type === 'token' && typeof e.text === 'string') {
    const t = e.text;
    return { ...e, text: t.length > 160 ? `${t.slice(0, 160)}…` : t };
  }
  if (e.type === 'final' && e.state && typeof e.state === 'object') {
    return {
      ...e,
      state: { revisionId: e.state.revisionId, diagramSource: '[omitted]' }
    };
  }
  return evt;
}
