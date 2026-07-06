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
