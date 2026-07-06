import { useMemo } from 'react';
import { ANYTHING_IFRAME_SANDBOX, parseAnythingHtml } from '@archislop/shared';

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
 */
export default function AnythingRenderer({ diagramSource, streamingPreview = false }) {
  const parsed = useMemo(() => {
    if (!diagramSource || !diagramSource.trim()) return { ok: false, empty: true };
    const result = parseAnythingHtml(diagramSource);
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, html: result.text };
  }, [diagramSource]);

  if (!parsed.ok && parsed.empty) {
    return null;
  }
  if (!parsed.ok) {
    return <AnythingErrorState error={parsed.error ?? 'Invalid HTML.'} />;
  }

  return (
    <div className="anything-renderer-root">
      <iframe
        className="anything-frame"
        title="Anything canvas (sandboxed)"
        sandbox={ANYTHING_IFRAME_SANDBOX}
        referrerPolicy="no-referrer"
        loading="lazy"
        srcDoc={parsed.html}
        // While a stream is in flight the document may be mid-edit; keep it
        // inert so half-written scripts don't grab pointer focus.
        style={streamingPreview ? { pointerEvents: 'none' } : undefined}
      />
    </div>
  );
}
