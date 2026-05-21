export const STREAM_DEBUG_LS_KEY = 'archislop-stream-debug';

/** Stream-event debug is on if localStorage has the toggle or the URL carries `?streamDebug=1`. */
export function readStreamDebugEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.localStorage?.getItem(STREAM_DEBUG_LS_KEY) === '1') return true;
    const q = new URLSearchParams(window.location.search);
    return q.get('streamDebug') === '1';
  } catch {
    return false;
  }
}

/** Truncate stream events before logging so the console isn't flooded with full diagrams/tokens. */
export function snapshotStreamEventForDebug(evt) {
  if (!evt || typeof evt !== 'object') return evt;
  if (evt.type === 'token' && typeof evt.text === 'string') {
    const t = evt.text;
    return { ...evt, text: t.length > 160 ? `${t.slice(0, 160)}…` : t };
  }
  if (evt.type === 'final' && evt.state && typeof evt.state === 'object') {
    return {
      ...evt,
      state: { revisionId: evt.state.revisionId, diagramSource: '[omitted]' }
    };
  }
  return evt;
}
