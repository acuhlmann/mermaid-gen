/**
 * Detect Mermaid, Infographic, Chart, Metaphor 3D, or Anything HTML pasted after prose
 * in agent "thinking" text and split it so the UI can render a read-only preview
 * instead of monospace paragraphs.
 */

import { parseAnythingHtml, parseChartDsl, sanitizeMetaphorDsl } from '@archislop/shared';
import { findBalancedBraceEnd } from './insightThinkingEnrich.js';

const CHART_MARKER = '"archislopVersion"';
const METAPHOR_MARKER = '"metaphor"';
const JSON_FENCE_START = /```(?:json)?\s*\n?/gi;
const HTML_FENCE_START = /```(?:html)?\s*\n?/gi;

const HTML_DOCUMENT_START =
  /^(?:<!DOCTYPE\s+html|<html\b|<head\b|<body\b|<div\b|<section\b|<main\b|<canvas\b|<svg\b)/i;

const INFOGRAPHIC_FIRST_LINE = /^infographic\s+[a-z0-9][a-z0-9-]*\s*$/i;

const MERMAID_FIRST_LINE =
  /^(?:flowchart|graph)\s+(?:TD|TB|BT|RL|LR|td|tb|bt|rl|lr)\b/i;

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
  if (!candidate?.includes(CHART_MARKER)) return null;
  const result = parseChartDsl(candidate);
  return result.ok ? result.text : null;
}

/** @param {string} candidate */
function tryParseMetaphorDsl(candidate) {
  if (!candidate?.includes(METAPHOR_MARKER)) return null;
  const result = sanitizeMetaphorDsl(candidate);
  return result.dsl ? result.text : null;
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
    const inner = (closeIdx >= 0 ? text.slice(contentStart, closeIdx) : text.slice(contentStart)).trim();
    const dsl = tryParse(inner);
    if (!dsl) continue;
    return {
      prose: joinProseSegments(text.slice(0, fenceMatch.index), closeIdx >= 0 ? text.slice(closeIdx + 3) : ''),
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
  return splitEmbeddedJsonDsl(text, CHART_MARKER, tryParseChartDsl, 'chart');
}

function splitEmbeddedMetaphorDsl(text) {
  return splitEmbeddedJsonDsl(text, METAPHOR_MARKER, tryParseMetaphorDsl, 'metaphor3d');
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
    const inner = (closeIdx >= 0 ? text.slice(contentStart, closeIdx) : text.slice(contentStart)).trim();
    const dsl = tryParseAnythingHtml(inner);
    if (!dsl) continue;
    // Fenced blocks are intentional markup — preview even while the closing fence is still streaming.
    if (closeIdx < 0 && !isSubstantialDsl(dsl, 'anything')) continue;
    return {
      prose: joinProseSegments(text.slice(0, fenceMatch.index), closeIdx >= 0 ? text.slice(closeIdx + 3) : ''),
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
 * @param {'mermaid' | 'infographic' | 'chart' | 'metaphor3d' | 'anything' | null} [kind]
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

  if (!kind || kind === 'chart' || kind === 'metaphor3d') stripFence(JSON_FENCE_START);
  if (!kind || kind === 'anything') stripFence(HTML_FENCE_START);

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
 * @returns {{ prose: string, dsl: string, kind: 'mermaid' | 'infographic' | 'chart' | 'metaphor3d' | 'anything' } | null}
 */
export function splitEmbeddedDiagramDsl(text) {
  if (typeof text !== 'string' || !text.trim()) return null;

  const chartSplit = splitEmbeddedChartDsl(text);
  if (chartSplit) return chartSplit;

  const metaphorSplit = splitEmbeddedMetaphorDsl(text);
  if (metaphorSplit) return metaphorSplit;

  const anythingSplit = splitEmbeddedAnythingHtml(text);
  if (anythingSplit) return anythingSplit;

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    const kind = classifyDiagramStartLine(trimmed);
    if (!kind) continue;

    const dslStart = kind === 'mermaid' ? mermaidDslStartIndex(lines, i) : i;
    const dsl = lines.slice(dslStart).join('\n').trim();
    if (!isSubstantialDsl(dsl, kind)) continue;

    if (kind === 'mermaid' && MERMAID_BARE_FLOW.test(trimmed) && !MERMAID_FIRST_LINE.test(trimmed)) {
      const looksLikeFlowchartBody =
        /-->|---/.test(dsl) ||
        dsl.includes('[') ||
        dsl.includes('(') ||
        nonEmptyLineCount(dsl) >= 3;
      if (!looksLikeFlowchartBody) continue;
    }

    const prose = lines.slice(0, dslStart).join('\n');
    return { prose, dsl, kind };
  }
  return null;
}

/**
 * Detect embeddable diagram DSL inside a single plan step or ordered-list line so the
 * Thinking pane can render a read-only preview instead of raw JSON / Mermaid text.
 *
 * @param {string} text
 * @returns {{ kind: 'mermaid' | 'infographic' | 'chart' | 'metaphor3d' | 'anything', source: string, prose?: string } | null}
 */
export function tryExtractDiagramPreviewFromText(text) {
  if (typeof text !== 'string' || !text.trim()) return null;

  const split = splitEmbeddedDiagramDsl(text);
  if (split?.dsl) {
    return {
      kind: split.kind,
      source: split.dsl,
      ...(split.prose?.trim() ? { prose: split.prose.trim() } : {})
    };
  }

  const trimmed = text.trim();
  if (trimmed.includes(CHART_MARKER)) {
    const result = parseChartDsl(trimmed);
    if (result.ok) return { kind: 'chart', source: result.text };
  }
  const metaphorDsl = tryParseMetaphorDsl(trimmed);
  if (metaphorDsl) return { kind: 'metaphor3d', source: metaphorDsl };

  const anythingHtml = tryParseAnythingHtml(trimmed);
  if (anythingHtml && isSubstantialDsl(anythingHtml, 'anything')) {
    return { kind: 'anything', source: anythingHtml };
  }

  return null;
}
