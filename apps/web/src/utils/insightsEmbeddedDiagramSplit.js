/**
 * Detect Mermaid, Infographic, or Chart DSL pasted after prose in agent "thinking" text
 * and split it so the UI can render a read-only preview instead of monospace paragraphs.
 */

import { parseChartDsl } from '@archislop/shared';
import { findBalancedBraceEnd } from './insightThinkingEnrich.js';

const CHART_MARKER = '"archislopVersion"';
const CHART_FENCE_START = /```(?:json)?\s*\n?/gi;

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
  if (!dsl || dsl.length < 28) return false;
  const lines = nonEmptyLineCount(dsl);
  if (kind === 'infographic') return lines >= 2;
  if (lines >= 2) return true;
  return dsl.length >= 48;
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

/**
 * @param {string} text
 * @returns {{ prose: string, dsl: string, kind: 'chart' } | null}
 */
function splitEmbeddedChartDsl(text) {
  CHART_FENCE_START.lastIndex = 0;
  let fenceMatch;
  while ((fenceMatch = CHART_FENCE_START.exec(text)) !== null) {
    const contentStart = fenceMatch.index + fenceMatch[0].length;
    const closeIdx = text.indexOf('```', contentStart);
    const inner = (closeIdx >= 0 ? text.slice(contentStart, closeIdx) : text.slice(contentStart)).trim();
    const dsl = tryParseChartDsl(inner);
    if (!dsl) continue;
    return {
      prose: joinProseSegments(text.slice(0, fenceMatch.index), closeIdx >= 0 ? text.slice(closeIdx + 3) : ''),
      dsl,
      kind: 'chart'
    };
  }

  const markerIdx = text.indexOf(CHART_MARKER);
  if (markerIdx < 0) return null;
  const open = text.lastIndexOf('{', markerIdx);
  if (open < 0) return null;
  const end = findBalancedBraceEnd(text, open);
  if (end < 0) return null;
  const dsl = tryParseChartDsl(text.slice(open, end));
  if (!dsl) return null;
  return {
    prose: joinProseSegments(text.slice(0, open), text.slice(end)),
    dsl,
    kind: 'chart'
  };
}

/**
 * @param {string} text
 * @returns {{ prose: string, dsl: string, kind: 'mermaid' | 'infographic' | 'chart' } | null}
 */
export function splitEmbeddedDiagramDsl(text) {
  if (typeof text !== 'string' || !text.trim()) return null;

  const chartSplit = splitEmbeddedChartDsl(text);
  if (chartSplit) return chartSplit;

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
