/**
 * Marker → vendored-source expansion for Anything-mode inline libraries.
 *
 * Deliberately NOT exported from the index barrel: this module carries the
 * full vendored library bytes (~280KB for d3 alone). The web client loads it
 * through the `@archislop/shared/anythingLibVendor.js` subpath export with a
 * dynamic import, so the main bundle only pays for it when a document actually
 * opts into a library. The server imports it statically for the jsdom runtime
 * check — a one-time module-load cost there.
 *
 * Expansion is a pure string transform of a VALIDATED document. It runs after
 * the whole validation ladder (shape, policy lint, quality lint, marker lint),
 * so the vendored source is never re-linted — its comments contain URLs that
 * would false-positive the policy lint — and never counts against the
 * ANYTHING_HTML_MAX_LENGTH budget, which applies to agent-authored text only.
 */

import {
  createAnythingLibMarkerPattern,
  getAnythingLibInfo,
  normalizeAnythingLibId
} from './anythingLibs.js';
import { ANYTHING_LIB_SOURCES } from './vendor/anythingLibSources.js';

export interface ExpandAnythingLibsResult {
  /** Document with each allowlisted marker replaced by an inline script tag. */
  html: string;
  /** Lib ids injected, in document order (each injected exactly once). */
  injected: string[];
}

/**
 * Replace `<!-- @lib:x -->` markers with the pinned vendored source wrapped in
 * `<script data-archislop-lib="x">`. Duplicate markers for the same lib are
 * stripped (the source is injected once, at the first marker). Markers for ids
 * that are not vendored are left in place as inert comments — upstream
 * validation rejects them for agent content, but expansion itself must never
 * throw on arbitrary input (the renderer calls it on whatever is in the slot).
 */
export function expandAnythingLibs(html: string): ExpandAnythingLibsResult {
  const injected: string[] = [];
  const expanded = html.replace(createAnythingLibMarkerPattern(), (marker, rawId: string) => {
    const id = normalizeAnythingLibId(rawId);
    const vendored = ANYTHING_LIB_SOURCES[id];
    const info = getAnythingLibInfo(id);
    if (!vendored || !info) return marker;
    if (injected.includes(id)) return '';
    injected.push(id);
    return `<script data-archislop-lib="${id}" data-lib-version="${vendored.version}">\n${vendored.source}\n</script>`;
  });
  return { html: expanded, injected };
}

/** Vendored source lookup (test/tooling use). */
export function getAnythingLibSource(id: string): { version: string; source: string } | undefined {
  return ANYTHING_LIB_SOURCES[normalizeAnythingLibId(id)];
}
