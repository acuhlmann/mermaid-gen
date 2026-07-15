/**
 * Detect Mermaid, Infographic, Chart, Metaphor 3D, or Anything HTML pasted after prose
 * in agent "thinking" text and split it so the UI can render a read-only preview
 * instead of monospace paragraphs.
 */

import {
  parseAnythingHtml,
  parseChartDsl,
  parseFormsA2ui,
  sanitizeMetaphorDsl
} from '@archislop/shared';
import { findBalancedBraceEnd } from './insightThinkingEnrich.js';

const CHART_MARKER = '"archislopVersion"';
const VEGA_LITE_SCHEMA_MARKER = 'vega.github.io/schema/vega-lite';
const METAPHOR_MARKER = '"metaphor"';
const FORMS_MARKER = '"archislopFormsVersion"';
const JSON_FENCE_START = /```(?:json)?\s*\n?/gi;
const HTML_FENCE_START = /```(?:html)?\s*\n?/gi;
/** Untagged or mermaid-tagged fences (peer context often omits a language tag). */
const GENERIC_DIAGRAM_FENCE_START = /```(?!\s*json\b)(?!\s*html\b)[^\n]*\n?/gi;

const HTML_DOCUMENT_START =
  /^(?:<!DOCTYPE\s+html|<html\b|<head\b|<body\b|<div\b|<section\b|<main\b|<canvas\b|<svg\b)/i;

const INFOGRAPHIC_FIRST_LINE = /^infographic\s+[a-z0-9][a-z0-9-]*\s*$/i;

const MERMAID_FIRST_LINE = /^(?:flowchart|graph)\s+(?:TD|TB|BT|RL|LR|td|tb|bt|rl|lr)\b/i;

const MERMAID_BLOCK_START =
  /^(?:sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|sankey-beta|block-beta|gitGraph|requirementDiagram|quadrantChart|gitgraph|zenuml|packet-beta|radar|treemap|block|packet)\b/i;

const MERMAID_C4 = /^C4(?:Context|Container|Component|Dynamic|Deployment)\b/i;

const MERMAID_BARE_FLOW = /^(?:flowchart|graph)\b/i;

/** Leading `%%{init: …}%%` or other full-line `%% … %%` Mermaid directives. */
const MERMAID_DIRECTIVE_LINE = /^%%[\s\S]*%%\s*$/;

export function classifyDiagramStartLine(trimmedLine) {
  if (!trimmedLine) return null;
  if (INFOGRAPHIC_FIRST_LINE.test(trimmedLine)) return 'infographic';
  if (MERMAID_FIRST_LINE.test(trimmedLine)) return 'mermaid';
  if (MERMAID_BLOCK_START.test(trimmedLine)) return 'mermaid';
  if (MERMAID_C4.test(trimmedLine)) return 'mermaid';
  if (MERMAID_BARE_FLOW.test(trimmedLine)) return 'mermaid';
  return null;
}

function nonEmptyLineCount(text) {
  return text.split('\n').reduce((n, line) => (line.trim() ? n + 1 : n), 0);
}

function isSubstantialDsl(dsl, kind) {
  if (!dsl?.trim()) return false;
  const lines = nonEmptyLineCount(dsl);
  if (kind === 'anything') {
    // Streaming pages often start as a short `<!DOCTYPE html>\n<html>` stub — still previewable.
    return lines >= 1 && dsl.length >= 10;
  }
  if (dsl.length < 28) return false;
  if (kind === 'infographic') return lines >= 2;
  if (lines >= 2) return true;
  return dsl.length >= 48;
}

/** @param {string} candidate */
function tryParseAnythingHtml(candidate) {
  if (!candidate?.trim()) return null;
  const result = parseAnythingHtml(candidate);
  return result.ok ? result.text : null;
}

/**
 * Include `%%{init: …}%%` (and similar) lines that precede the diagram header.
 * @param {string[]} lines
 * @param {number} diagramLineIndex
 * @returns {number}
 */
export function mermaidDslStartIndex(lines, diagramLineIndex) {
  let startIndex = diagramLineIndex;
  for (let j = diagramLineIndex - 1; j >= 0; j--) {
    const t = lines[j].trim();
    if (!t) {
      startIndex = j;
      continue;
    }
    if (MERMAID_DIRECTIVE_LINE.test(t)) {
      startIndex = j;
      continue;
    }
    break;
  }
  return startIndex;
}

function joinProseSegments(before, after) {
  const head = (before ?? '').trimEnd();
  const tail = (after ?? '').trim();
  if (head && tail) return `${head}\n\n${tail}`;
  return head || tail;
}

/** @param {string} candidate */
function tryParseChartDsl(candidate) {
  if (!candidate?.trim()) return null;
  if (candidate.includes(CHART_MARKER)) {
    const result = parseChartDsl(candidate);
    return result.ok ? result.text : null;
  }
  if (!candidate.includes(VEGA_LITE_SCHEMA_MARKER) && !candidate.includes('"spec"')) {
    return null;
  }
  let raw;
  try {
    raw = JSON.parse(candidate);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const schema = raw.$schema;
  if (typeof schema === 'string' && schema.includes('vega-lite')) {
    const wrapped = { archislopVersion: 1, theme: 'whiteboard', spec: raw };
    const result = parseChartDsl(JSON.stringify(wrapped));
    return result.ok ? result.text : null;
  }
  if (raw.spec && typeof raw.spec === 'object' && !raw.archislopVersion) {
    const schemaInSpec = raw.spec.$schema;
    if (typeof schemaInSpec === 'string' && schemaInSpec.includes('vega-lite')) {
      const wrapped = { archislopVersion: 1, theme: raw.theme ?? 'whiteboard', spec: raw.spec };
      const result = parseChartDsl(JSON.stringify(wrapped));
      return result.ok ? result.text : null;
    }
  }
  return null;
}

/** @param {string} candidate */
function tryParseMetaphorDsl(candidate) {
  if (!candidate?.includes(METAPHOR_MARKER)) return null;
  const result = sanitizeMetaphorDsl(candidate);
  return result.dsl ? result.text : null;
}

/** @param {string} candidate */
function tryParseFormsDsl(candidate) {
  if (!candidate?.includes(FORMS_MARKER)) return null;
  const result = parseFormsA2ui(candidate);
  return result.ok ? result.text : null;
}

/**
 * Shared shape for the two JSON-object DSLs (chart, metaphor3d): find the DSL in a
 * ```json fence first, then as a bare `{ … }` object located via its marker key.
 *
 * @param {string} text
 * @param {string} marker
 * @param {(candidate: string) => string | null} tryParse
 * @param {'chart' | 'metaphor3d'} kind
 * @returns {{ prose: string, dsl: string, kind: 'chart' | 'metaphor3d' } | null}
 */
function splitEmbeddedJsonDsl(text, marker, tryParse, kind) {
  JSON_FENCE_START.lastIndex = 0;
  let fenceMatch;
  while ((fenceMatch = JSON_FENCE_START.exec(text)) !== null) {
    const contentStart = fenceMatch.index + fenceMatch[0].length;
    const closeIdx = text.indexOf('```', contentStart);
    const inner = (
      closeIdx >= 0 ? text.slice(contentStart, closeIdx) : text.slice(contentStart)
    ).trim();
    const dsl = tryParse(inner);
    if (!dsl) continue;
    return {
      prose: joinProseSegments(
        text.slice(0, fenceMatch.index),
        closeIdx >= 0 ? text.slice(closeIdx + 3) : ''
      ),
      dsl,
      kind
    };
  }

  const markerIdx = text.indexOf(marker);
  if (markerIdx < 0) return null;
  const open = text.lastIndexOf('{', markerIdx);
  if (open < 0) return null;
  const end = findBalancedBraceEnd(text, open);
  if (end < 0) return null;
  const dsl = tryParse(text.slice(open, end));
  if (!dsl) return null;
  return {
    prose: joinProseSegments(text.slice(0, open), text.slice(end)),
    dsl,
    kind
  };
}

function splitEmbeddedChartDsl(text) {
  const wrapped = splitEmbeddedJsonDsl(text, CHART_MARKER, tryParseChartDsl, 'chart');
  if (wrapped) return wrapped;
  if (!text.includes(VEGA_LITE_SCHEMA_MARKER)) return null;
  return splitEmbeddedJsonDsl(text, VEGA_LITE_SCHEMA_MARKER, tryParseChartDsl, 'chart');
}

function splitEmbeddedMetaphorDsl(text) {
  return splitEmbeddedJsonDsl(text, METAPHOR_MARKER, tryParseMetaphorDsl, 'metaphor3d');
}

function splitEmbeddedFormsDsl(text) {
  return splitEmbeddedJsonDsl(text, FORMS_MARKER, tryParseFormsDsl, 'forms');
}

/**
 * Line-started Mermaid / Infographic DSL (no fence handling).
 *
 * @param {string} text
 * @returns {{ prose: string, dsl: string, kind: 'mermaid' | 'infographic' } | null}
 */
function splitLineStartedDiagramDsl(text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    const kind = classifyDiagramStartLine(trimmed);
    if (!kind) continue;

    const dslStart = kind === 'mermaid' ? mermaidDslStartIndex(lines, i) : i;
    const dsl = lines.slice(dslStart).join('\n').trim();
    if (!isSubstantialDsl(dsl, kind)) continue;

    if (
      kind === 'mermaid' &&
      MERMAID_BARE_FLOW.test(trimmed) &&
      !MERMAID_FIRST_LINE.test(trimmed)
    ) {
      const looksLikeFlowchartBody =
        /-->|---/.test(dsl) ||
        dsl.includes('[') ||
        dsl.includes('(') ||
        nonEmptyLineCount(dsl) >= 3;
      if (!looksLikeFlowchartBody) continue;
    }

    return { prose: lines.slice(0, dslStart).join('\n'), dsl, kind };
  }
  return null;
}

/**
 * Mermaid / infographic inside an untagged ``` fence (common in peer-context prompts).
 *
 * @param {string} text
 * @returns {{ prose: string, dsl: string, kind: DiagramPreviewKind } | null}
 */
function splitGenericFencedDiagramDsl(text) {
  GENERIC_DIAGRAM_FENCE_START.lastIndex = 0;
  let fenceMatch;
  while ((fenceMatch = GENERIC_DIAGRAM_FENCE_START.exec(text)) !== null) {
    const contentStart = fenceMatch.index + fenceMatch[0].length;
    const closeIdx = text.indexOf('```', contentStart);
    const inner = (
      closeIdx >= 0 ? text.slice(contentStart, closeIdx) : text.slice(contentStart)
    ).trim();
    if (!inner) continue;

    const innerSplit = splitLineStartedDiagramDsl(inner);
    if (!innerSplit) continue;

    return {
      prose: joinProseSegments(
        text.slice(0, fenceMatch.index),
        closeIdx >= 0 ? text.slice(closeIdx + 3) : ''
      ),
      dsl: innerSplit.dsl,
      kind: innerSplit.kind
    };
  }
  return null;
}

/**
 * @param {string} text
 * @returns {{ prose: string, dsl: string, kind: 'anything' } | null}
 */
function splitEmbeddedAnythingHtml(text) {
  HTML_FENCE_START.lastIndex = 0;
  let fenceMatch;
  while ((fenceMatch = HTML_FENCE_START.exec(text)) !== null) {
    const contentStart = fenceMatch.index + fenceMatch[0].length;
    const closeIdx = text.indexOf('```', contentStart);
    const inner = (
      closeIdx >= 0 ? text.slice(contentStart, closeIdx) : text.slice(contentStart)
    ).trim();
    const dsl = tryParseAnythingHtml(inner);
    if (!dsl) continue;
    // Fenced blocks are intentional markup — preview even while the closing fence is still streaming.
    if (closeIdx < 0 && !isSubstantialDsl(dsl, 'anything')) continue;
    return {
      prose: joinProseSegments(
        text.slice(0, fenceMatch.index),
        closeIdx >= 0 ? text.slice(closeIdx + 3) : ''
      ),
      dsl,
      kind: 'anything'
    };
  }

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || !HTML_DOCUMENT_START.test(trimmed)) continue;
    const dsl = lines.slice(i).join('\n').trim();
    if (!isSubstantialDsl(dsl, 'anything')) continue;
    const parsed = tryParseAnythingHtml(dsl);
    if (!parsed) continue;
    return { prose: lines.slice(0, i).join('\n'), dsl: parsed, kind: 'anything' };
  }
  return null;
}

/**
 * Remove embedded DSL / fenced code blocks from thinking text when a live draft preview
 * is shown separately (avoids duplicate raw ```json / ```html in the content lane).
 *
 * @param {string} text
 * @param {'mermaid' | 'infographic' | 'chart' | 'metaphor3d' | 'forms' | 'anything' | null} [kind]
 * @returns {string}
 */
export function stripEmbeddedDslFromThinkingText(text, kind = null) {
  if (typeof text !== 'string' || !text.trim()) return text ?? '';
  let next = text;

  const stripFence = (pattern) => {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(next)) !== null) {
      const contentStart = match.index + match[0].length;
      const closeIdx = next.indexOf('```', contentStart);
      const tail = closeIdx >= 0 ? next.slice(closeIdx + 3) : '';
      next = joinProseSegments(next.slice(0, match.index), tail);
      pattern.lastIndex = 0;
    }
  };

  if (!kind || kind === 'chart' || kind === 'metaphor3d' || kind === 'forms') {
    stripFence(JSON_FENCE_START);
  }
  if (!kind || kind === 'anything') stripFence(HTML_FENCE_START);
  if (!kind || kind === 'mermaid' || kind === 'infographic') {
    stripFence(GENERIC_DIAGRAM_FENCE_START);
  }

  const stripBareJsonObject = (marker) => {
    const markerIdx = next.indexOf(marker);
    if (markerIdx < 0) return;
    const open = next.lastIndexOf('{', markerIdx);
    if (open < 0) return;
    const end = findBalancedBraceEnd(next, open);
    if (end < 0) return;
    next = joinProseSegments(next.slice(0, open), next.slice(end));
  };

  if (!kind || kind === 'chart') stripBareJsonObject(CHART_MARKER);
  if (!kind || kind === 'metaphor3d') stripBareJsonObject(METAPHOR_MARKER);
  if (!kind || kind === 'forms') stripBareJsonObject(FORMS_MARKER);

  if (!kind || kind === 'anything') {
    const lines = next.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed || !HTML_DOCUMENT_START.test(trimmed)) continue;
      const dsl = lines.slice(i).join('\n').trim();
      if (tryParseAnythingHtml(dsl)) {
        next = lines.slice(0, i).join('\n');
        break;
      }
    }
  }

  return next.trim();
}

/**
 * @param {string} text
 * @param {DiagramPreviewKind | null} [expectedKind] when set, only return a split for that slot
 * @returns {{ prose: string, dsl: string, kind: DiagramPreviewKind } | null}
 */
export function splitEmbeddedDiagramDsl(text, expectedKind = null) {
  if (typeof text !== 'string' || !text.trim()) return null;

  const acceptSplit = (split) => {
    if (!split) return null;
    if (!expectedKind || split.kind === expectedKind) return split;
    return split;
  };

  const chartSplit = acceptSplit(splitEmbeddedChartDsl(text));
  if (chartSplit) return chartSplit;

  const metaphorSplit = acceptSplit(splitEmbeddedMetaphorDsl(text));
  if (metaphorSplit) return metaphorSplit;

  const formsSplit = acceptSplit(splitEmbeddedFormsDsl(text));
  if (formsSplit) return formsSplit;

  const anythingSplit = acceptSplit(splitEmbeddedAnythingHtml(text));
  if (anythingSplit) return anythingSplit;

  const fencedSplit = acceptSplit(splitGenericFencedDiagramDsl(text));
  if (fencedSplit) return fencedSplit;

  const lineSplit = acceptSplit(splitLineStartedDiagramDsl(text));
  if (lineSplit) return lineSplit;

  return null;
}

/**
 * @typedef {'mermaid' | 'infographic' | 'chart' | 'metaphor3d' | 'forms' | 'anything'} DiagramPreviewKind
 */

/**
 * @typedef {{ kind: DiagramPreviewKind, source: string, prose?: string }} DiagramPreviewMeta
 */

/**
 * When a run targets a specific slot (e.g. metaphor3d after a mode switch), ignore
 * incidental Mermaid/DSL fragments in plan beats or prose — they are subject context,
 * not the artifact being produced.
 *
 * @param {DiagramPreviewMeta | null} preview
 * @param {DiagramPreviewKind | null | undefined} expectedKind
 * @returns {DiagramPreviewMeta | null}
 */
export function filterDiagramPreviewForContentType(preview, expectedKind) {
  if (!preview) return null;
  if (!expectedKind || preview.kind === expectedKind) return preview;
  // Cross-mode peer context during mode conversion — still previewable; callers
  // label it via the source-context badge when kinds differ.
  return preview;
}

/**
 * Detect embeddable diagram DSL inside a single plan step or ordered-list line so the
 * Thinking pane can render a read-only preview instead of raw JSON / Mermaid text.
 *
 * @param {string} text
 * @param {{ expectedKind?: DiagramPreviewKind | null }} [options]
 * @returns {DiagramPreviewMeta | null}
 */
export function tryExtractDiagramPreviewFromText(text, options = {}) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const { expectedKind = null } = options;

  const split = splitEmbeddedDiagramDsl(text, expectedKind);
  if (split?.dsl) {
    return filterDiagramPreviewForContentType(
      {
        kind: split.kind,
        source: split.dsl,
        ...(split.prose?.trim() ? { prose: split.prose.trim() } : {})
      },
      expectedKind
    );
  }

  const trimmed = text.trim();
  if (trimmed.includes(CHART_MARKER) || trimmed.includes(VEGA_LITE_SCHEMA_MARKER)) {
    const result = parseChartDsl(trimmed);
    if (result.ok) {
      return filterDiagramPreviewForContentType(
        { kind: 'chart', source: result.text },
        expectedKind
      );
    }
    const bare = tryParseChartDsl(trimmed);
    if (bare) {
      return filterDiagramPreviewForContentType({ kind: 'chart', source: bare }, expectedKind);
    }
  }
  const metaphorDsl = tryParseMetaphorDsl(trimmed);
  if (metaphorDsl) {
    return filterDiagramPreviewForContentType(
      { kind: 'metaphor3d', source: metaphorDsl },
      expectedKind
    );
  }

  const anythingHtml = tryParseAnythingHtml(trimmed);
  if (anythingHtml && isSubstantialDsl(anythingHtml, 'anything')) {
    return filterDiagramPreviewForContentType(
      { kind: 'anything', source: anythingHtml },
      expectedKind
    );
  }

  const formsDsl = tryParseFormsDsl(trimmed);
  if (formsDsl) {
    return filterDiagramPreviewForContentType({ kind: 'forms', source: formsDsl }, expectedKind);
  }

  return null;
}
