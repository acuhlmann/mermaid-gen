import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ANYTHING_IFRAME_CSP,
  ANYTHING_IFRAME_SANDBOX,
  ANYTHING_RUNTIME_ERROR_MESSAGE_TYPE,
  findAnythingLibMarkers,
  getAnythingLibInfo,
  parseAnythingHtml,
  wrapAnythingSrcDoc
} from '@archislop/shared';

const MAX_DISPLAYED_RUNTIME_ERRORS = 3;

// Vendored library bytes for `@lib:` markers live in a separate chunk
// (~280KB with d3) behind the shared package's subpath export. Load it at most
// once, and only when a document actually opts into a library — documents
// without markers keep the fully synchronous render path.
let anythingLibVendorPromise = null;
function loadAnythingLibVendor() {
  anythingLibVendorPromise ??= import('@archislop/shared/anythingLibVendor.js');
  return anythingLibVendorPromise;
}

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
 *
 * Library markers: documents may opt into allowlisted vendored libraries with
 * `<!-- @lib:d3 -->` comments. The slot keeps the marker form; this component
 * expands markers into inline <script> tags (pinned bytes from the shared
 * vendor chunk) just before srcDoc — vendored code only, never a network
 * load, and the sandbox/CSP above are unchanged. A corner badge names the
 * injected libs and versions (from the registry metadata, which is
 * main-bundle-safe), so the otherwise-invisible injection is observable. See
 * docs/decisions/0008-anything-inline-libraries.md.
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
    const markers = findAnythingLibMarkers(result.text);
    // Registry metadata (name/version) for the lib badge — allowlisted ids
    // only, deduped. Unknown markers still trigger the expansion path, where
    // they pass through as inert comments.
    const libs = [];
    for (const marker of markers) {
      const info = getAnythingLibInfo(marker.id);
      if (info && !libs.some((lib) => lib.id === info.id)) libs.push(info);
    }
    return { ok: true, text: result.text, needsLibs: markers.length > 0, libs };
  }, [diagramSource]);

  // Marker expansion is async (the vendor chunk loads on demand); tag the
  // result with the text it was computed from so a stale expansion is never
  // rendered against a newer document.
  const [libExpansion, setLibExpansion] = useState(null);
  useEffect(() => {
    if (!parsed.ok || !parsed.needsLibs) return undefined;
    let cancelled = false;
    loadAnythingLibVendor()
      .then((vendor) => {
        if (cancelled) return;
        setLibExpansion({ source: parsed.text, html: vendor.expandAnythingLibs(parsed.text).html });
      })
      .catch(() => {
        if (cancelled) return;
        // Vendor chunk failed to load: render the marker form. The marker is
        // an inert comment, so the page still renders; if its scripts need
        // the library, the runtime-error bridge surfaces that visibly.
        setLibExpansion({ source: parsed.text, html: parsed.text });
      });
    return () => {
      cancelled = true;
    };
  }, [parsed]);

  const srcDoc = useMemo(() => {
    if (!parsed.ok) return null;
    if (!parsed.needsLibs) return wrapAnythingSrcDoc(parsed.text);
    if (libExpansion && libExpansion.source === parsed.text) {
      return wrapAnythingSrcDoc(libExpansion.html);
    }
    return null; // vendor chunk still loading for this document
  }, [parsed, libExpansion]);

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
  if (srcDoc == null) {
    // Vendor chunk loading — keep the canvas region mounted, iframe comes next paint.
    return <div className="anything-renderer-root" />;
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
        srcDoc={srcDoc}
        // While a stream is in flight the document may be mid-edit; keep it
        // inert so half-written scripts don't grab pointer focus.
        style={streamingPreview ? { pointerEvents: 'none' } : undefined}
      />
      {parsed.libs.length > 0 && !streamingPreview ? (
        <div
          className="anything-lib-badge"
          role="note"
          title={`This page uses ${parsed.libs
            .map((lib) => `${lib.name} ${lib.version}`)
            .join(
              ' and '
            )}. Library code is pinned, vendored, and injected at render time — nothing loads from the network.`}
        >
          {parsed.libs.map((lib) => `${lib.id} v${lib.version}`).join(' · ')}
        </div>
      ) : null}
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
