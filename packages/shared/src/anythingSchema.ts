/**
 * "Anything" mode: freeform HTML/CSS/JS emitted by agents and rendered inside a
 * sandboxed iframe on the web client. Unlike the other slots there is no DSL —
 * the diagramSource IS the document. Safety therefore does not come from parsing
 * or sanitizing here; it comes from the renderer's iframe sandbox (no
 * `allow-same-origin`, so scripts run in an opaque origin with no access to the
 * host app's DOM, cookies, or storage). This module only enforces cheap
 * deterministic invariants: it's a string, it's not empty, it's markup-shaped,
 * and it fits the wire budget.
 */

export const ANYTHING_HTML_MAX_LENGTH = 200_000;

/**
 * iframe sandbox tokens the web renderer must use for Anything content.
 * `allow-scripts` alone: scripts run, but in an opaque origin — no same-origin
 * access to the parent, no storage, no top navigation, no popups, no forms.
 * Kept in shared so tests on both sides can assert the renderer never drifts
 * to a looser sandbox.
 */
export const ANYTHING_IFRAME_SANDBOX = 'allow-scripts';

/**
 * Content-Security-Policy applied to the Anything iframe (via the iframe `csp`
 * attribute and an injected meta tag in srcDoc). Blocks outbound network and
 * external subresources while keeping inline scripts/styles working.
 */
export const ANYTHING_IFRAME_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";

/**
 * postMessage `type` used by the runtime-error bridge injected into Anything
 * srcDoc documents. The renderer listens for messages of this type coming
 * from its own iframe and surfaces them (error banner + auto-fix plumbing).
 */
export const ANYTHING_RUNTIME_ERROR_MESSAGE_TYPE = 'archislop:anything-runtime-error';

/**
 * Error-capture harness injected into the document at wrap time — AFTER
 * validation, so the policy lint's ban on `window.parent` in agent-authored
 * code never sees it. Runs before any page script (it is inserted at the top
 * of <head>), captures uncaught errors and unhandled rejections, and relays
 * them to the parent frame. postMessage is the one channel that crosses the
 * opaque-origin boundary; targetOrigin must be '*' because an opaque origin
 * cannot name the parent. The payload is plain data and the renderer verifies
 * `event.source` is its own iframe, so this does not weaken the sandbox.
 */
const ANYTHING_RUNTIME_ERROR_BRIDGE = `<script>(function () {
  var START = Date.now();
  var MAX_REPORTS = 12;
  var sent = 0;
  var seen = {};
  function report(kind, message, detail) {
    message = String(message || 'Unknown error').slice(0, 500);
    if (sent >= MAX_REPORTS || seen[message]) return;
    seen[message] = true;
    sent += 1;
    try {
      window.parent.postMessage({
        type: '${ANYTHING_RUNTIME_ERROR_MESSAGE_TYPE}',
        kind: kind,
        message: message,
        detail: detail ? String(detail).slice(0, 300) : null,
        sinceLoadMs: Date.now() - START
      }, '*');
    } catch (e) { /* reporting must never break the page */ }
  }
  window.addEventListener('error', function (ev) {
    if (!ev || !ev.message) return;
    report('error', ev.message, ev.lineno ? 'line ' + ev.lineno + ':' + (ev.colno || 0) : null);
  });
  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev && ev.reason;
    report(
      'unhandledrejection',
      (r && (r.message || String(r))) || 'Unhandled promise rejection',
      r && r.name ? r.name : null
    );
  });
})();</script>`;

/**
 * Inject a CSP meta tag and the runtime-error bridge into an Anything HTML
 * document before it is passed to iframe srcDoc. Does not mutate the page's
 * own scripts or styles — containment and observation only.
 */
export function wrapAnythingSrcDoc(html: string, csp: string = ANYTHING_IFRAME_CSP): string {
  const injected = `<meta http-equiv="Content-Security-Policy" content="${csp}">${ANYTHING_RUNTIME_ERROR_BRIDGE}`;
  const headMatch = html.match(/<head(\s[^>]*)?>/i);
  if (headMatch && headMatch.index != null) {
    const insertAt = headMatch.index + headMatch[0].length;
    return `${html.slice(0, insertAt)}${injected}${html.slice(insertAt)}`;
  }
  const htmlMatch = html.match(/<html(\s[^>]*)?>/i);
  if (htmlMatch && htmlMatch.index != null) {
    const insertAt = htmlMatch.index + htmlMatch[0].length;
    return `${html.slice(0, insertAt)}<head>${injected}</head>${html.slice(insertAt)}`;
  }
  return `<!DOCTYPE html><html><head>${injected}</head><body>${html}</body></html>`;
}

export interface ParseAnythingHtmlSuccess {
  ok: true;
  /** Normalized document text (code fence stripped, trimmed). */
  text: string;
}

export interface ParseAnythingHtmlFailure {
  ok: false;
  error: string;
}

export type ParseAnythingHtmlResult = ParseAnythingHtmlSuccess | ParseAnythingHtmlFailure;

function stripHtmlCodeFence(raw: string): string {
  const trimmed = raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim();
  const fenced = trimmed.match(/^```(?:html)?\s*\n?([\s\S]*?)\n?```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

/**
 * Validate a freeform HTML document for the `anything` slot. Deterministic
 * only — no DOM parse (browsers accept almost anything; a strict parser here
 * would reject documents that render fine in the sandbox).
 */
export function parseAnythingHtml(source: unknown): ParseAnythingHtmlResult {
  if (typeof source !== 'string') {
    return { ok: false, error: 'Anything HTML must be a string.' };
  }
  const text = stripHtmlCodeFence(source);
  if (!text) {
    return { ok: false, error: 'Anything HTML was empty.' };
  }
  if (text.length > ANYTHING_HTML_MAX_LENGTH) {
    return {
      ok: false,
      error: `Anything HTML is too large (${text.length} chars; max ${ANYTHING_HTML_MAX_LENGTH}).`
    };
  }
  // Must contain at least one tag-like construct — catches the model emitting
  // prose or a JSON blob into the HTML slot.
  if (!/<[a-zA-Z!/]/.test(text)) {
    return {
      ok: false,
      error:
        'Anything HTML does not look like markup (no HTML tags found). Emit a full HTML document.'
    };
  }
  return { ok: true, text };
}
