import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ANYTHING_IFRAME_CSP,
  ANYTHING_IFRAME_SANDBOX,
  ANYTHING_RUNTIME_ERROR_MESSAGE_TYPE,
  parseAnythingHtml,
  wrapAnythingSrcDoc
} from '@archislop/shared';

const MAX_DISPLAYED_RUNTIME_ERRORS = 3;

function AnythingErrorState({ error }) {
  return (
    <div className="anything-error-state" role="alert">
      <p>Page could not render.</p>
      <pre className="anything-error-detail">{error}</pre>
    </div>
  );
}

/**
 * Renders Anything-mode content (freeform agent-authored HTML/CSS/JS) inside a
 * sandboxed iframe. This iframe IS the security boundary — the document is
 * untrusted LLM output, so:
 *
 * - `sandbox` is exactly `ANYTHING_IFRAME_SANDBOX` ("allow-scripts") and MUST
 *   NOT gain `allow-same-origin`. With `srcDoc` + no same-origin flag the
 *   document runs in an opaque origin: scripts execute, but they cannot reach
 *   the host app's DOM, cookies, or storage, cannot navigate the top window,
 *   and cannot open popups, submit forms, or trigger downloads.
 * - `srcDoc` (not a blob/object URL) keeps the content inline and re-renders
 *   atomically when the source changes.
 * - No `allow` attribute: no camera, mic, geolocation, or other permissions.
 *
 * Do not "fix" a broken page by loosening the sandbox; fix the page.
 *
 * Runtime errors: `wrapAnythingSrcDoc` injects a bridge that relays uncaught
 * errors and unhandled rejections via postMessage. Messages are only accepted
 * from this component's own iframe (`event.source` check) and are rendered as
 * inert text — never markup — so a hostile page cannot spoof or inject
 * through this channel. Errors surface as a dismissible banner and through
 * the optional `onRuntimeError` callback.
 */
export default function AnythingRenderer({
  diagramSource,
  streamingPreview = false,
  onRuntimeError
}) {
  const iframeRef = useRef(null);
  const [runtimeErrors, setRuntimeErrors] = useState([]);
  const [errorsDismissed, setErrorsDismissed] = useState(false);

  // Refs keep the message listener stable across renders and streaming.
  const onRuntimeErrorRef = useRef(onRuntimeError);
  onRuntimeErrorRef.current = onRuntimeError;
  const streamingPreviewRef = useRef(streamingPreview);
  streamingPreviewRef.current = streamingPreview;

  const parsed = useMemo(() => {
    if (!diagramSource || !diagramSource.trim()) return { ok: false, empty: true };
    const result = parseAnythingHtml(diagramSource);
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, html: wrapAnythingSrcDoc(result.text) };
  }, [diagramSource]);

  // A new document starts with a clean slate.
  useEffect(() => {
    setRuntimeErrors([]);
    setErrorsDismissed(false);
  }, [diagramSource]);

  useEffect(() => {
    function handleMessage(event) {
      const frame = iframeRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      const data = event.data;
      if (!data || data.type !== ANYTHING_RUNTIME_ERROR_MESSAGE_TYPE) return;
      // Mid-stream documents are partially written; their errors are noise.
      if (streamingPreviewRef.current) return;

      const entry = {
        kind: typeof data.kind === 'string' ? data.kind : 'error',
        message: String(data.message ?? 'Unknown error').slice(0, 500),
        detail: data.detail == null ? null : String(data.detail).slice(0, 300),
        sinceLoadMs: typeof data.sinceLoadMs === 'number' ? data.sinceLoadMs : null
      };

      setRuntimeErrors((previous) => {
        if (previous.some((e) => e.message === entry.message)) return previous;
        if (previous.length >= MAX_DISPLAYED_RUNTIME_ERRORS) return previous;
        return [...previous, entry];
      });
      onRuntimeErrorRef.current?.(entry);
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (!parsed.ok && parsed.empty) {
    return null;
  }
  if (!parsed.ok) {
    return <AnythingErrorState error={parsed.error ?? 'Invalid HTML.'} />;
  }

  const showRuntimeBanner = !streamingPreview && !errorsDismissed && runtimeErrors.length > 0;

  return (
    <div className="anything-renderer-root">
      <iframe
        ref={iframeRef}
        className="anything-frame"
        title="Anything canvas (sandboxed)"
        sandbox={ANYTHING_IFRAME_SANDBOX}
        csp={ANYTHING_IFRAME_CSP}
        referrerPolicy="no-referrer"
        loading="lazy"
        srcDoc={parsed.html}
        // While a stream is in flight the document may be mid-edit; keep it
        // inert so half-written scripts don't grab pointer focus.
        style={streamingPreview ? { pointerEvents: 'none' } : undefined}
      />
      {showRuntimeBanner ? (
        <div className="anything-runtime-banner" role="status">
          <span className="anything-runtime-banner-text">
            Page runtime error: {runtimeErrors[0].message}
            {runtimeErrors.length > 1 ? ` (+${runtimeErrors.length - 1} more)` : ''}
          </span>
          <button
            type="button"
            className="anything-runtime-banner-dismiss"
            aria-label="Dismiss runtime error"
            onClick={() => setErrorsDismissed(true)}
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
