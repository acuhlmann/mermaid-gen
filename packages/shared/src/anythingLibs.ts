/**
 * Allowlisted inline libraries for Anything-mode documents.
 *
 * Agents opt into a library by placing an HTML comment marker in the document
 * (e.g. `<!-- @lib:d3 -->`). The stored document keeps the marker; the pinned,
 * vendored library source is spliced in only where the document is actually
 * executed — the client renderer just before iframe srcDoc, and the server's
 * jsdom runtime check (see docs/decisions/0008-anything-inline-libraries.md).
 * Nothing is ever fetched from a network, and the sandbox/CSP are unchanged.
 *
 * This module is registry METADATA only and is safe for the web main bundle.
 * The vendored bytes live behind the `@archislop/shared/anythingLibVendor.js`
 * subpath export so consumers load them on demand.
 */

export interface AnythingLibInfo {
  /** Marker id, lowercase (`<!-- @lib:d3 -->`). */
  id: string;
  /** Human/display name. */
  name: string;
  /** Pinned version — must match the vendored source (a test enforces this). */
  version: string;
  /** Global the injected script defines (what page scripts should use). */
  global: string;
  /** One-line capability summary, injected into agent prompts. */
  promptSummary: string;
}

export const ANYTHING_LIBS: readonly AnythingLibInfo[] = [
  {
    id: 'd3',
    name: 'D3.js',
    version: '7.9.0',
    global: 'd3',
    promptSummary:
      'full d3 bundle — selections, scales, axes, shapes, force/hierarchy layouts, transitions, geo'
  }
];

export const ANYTHING_LIB_IDS: readonly string[] = ANYTHING_LIBS.map((lib) => lib.id);

const LIB_INFO_BY_ID = new Map(ANYTHING_LIBS.map((lib) => [lib.id, lib]));

export function getAnythingLibInfo(id: string): AnythingLibInfo | undefined {
  return LIB_INFO_BY_ID.get(normalizeAnythingLibId(id));
}

export function normalizeAnythingLibId(rawId: string): string {
  return rawId.trim().toLowerCase();
}

/**
 * Fresh RegExp per call — the `g` flag makes these stateful (`lastIndex`).
 * Accepts `<!--@lib:d3-->`, `<!-- @lib: d3 -->`, case-insensitive ids.
 */
export function createAnythingLibMarkerPattern(): RegExp {
  return /<!--\s*@lib:\s*([a-zA-Z0-9_.-]+)\s*-->/g;
}

export interface AnythingLibMarker {
  /** Normalized (lowercased) lib id as written in the marker. */
  id: string;
  /** The full marker text as it appears in the document. */
  marker: string;
  /** Character offset of the marker in the document. */
  index: number;
}

export function findAnythingLibMarkers(html: string): AnythingLibMarker[] {
  const markers: AnythingLibMarker[] = [];
  const pattern = createAnythingLibMarkerPattern();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    markers.push({
      id: normalizeAnythingLibId(match[1] ?? ''),
      marker: match[0],
      index: match.index
    });
  }
  return markers;
}

/** Cheap gate for render paths: does this document opt into any library? */
export function hasAnythingLibMarkers(html: string): boolean {
  return createAnythingLibMarkerPattern().test(html);
}

export interface AnythingLibMarkerLintSuccess {
  ok: true;
  /** Distinct allowlisted lib ids referenced, in first-appearance order. */
  libs: string[];
}

export interface AnythingLibMarkerLintFailure {
  ok: false;
  code: 'unknown_lib';
  error: string;
}

export type AnythingLibMarkerLintResult =
  | AnythingLibMarkerLintSuccess
  | AnythingLibMarkerLintFailure;

/**
 * Validate the `@lib:` markers themselves (the vendored source is trusted and
 * deliberately never linted — library comments contain URLs that would
 * false-positive the policy lint). Unknown ids are rejected with the allowlist
 * so repair turns can fix the marker instead of guessing.
 */
export function lintAnythingLibMarkers(html: string): AnythingLibMarkerLintResult {
  const libs: string[] = [];
  for (const marker of findAnythingLibMarkers(html)) {
    if (!LIB_INFO_BY_ID.has(marker.id)) {
      return {
        ok: false,
        code: 'unknown_lib',
        error:
          `Unknown library marker ${marker.marker}. Available libraries: ` +
          `${ANYTHING_LIB_IDS.map((id) => `@lib:${id}`).join(', ')}. ` +
          'Use an allowlisted id, or remove the marker and write vanilla JS.'
      };
    }
    if (!libs.includes(marker.id)) libs.push(marker.id);
  }
  return { ok: true, libs };
}

/**
 * Prompt fragment listing the available libraries — generated from the
 * registry so the system prompt can never drift from what validation accepts.
 */
export function describeAnythingLibsForPrompt(): string {
  return ANYTHING_LIBS.map(
    (lib) =>
      `  * <!-- @lib:${lib.id} --> — ${lib.name} v${lib.version}, exposed as \`${lib.global}\` (${lib.promptSummary})`
  ).join('\n');
}
