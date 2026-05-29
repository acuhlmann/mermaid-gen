/**
 * Lightweight Mermaid graph metrics for transform policy checks.
 * Mirrors apps/server/src/mcp/diagramDiffSummary.js (kept in shared for patch validation).
 */

const MERMAID_EDGE_RE =
  /(\b[A-Za-z][\w-]*)\s*(?:-->|---->|---o|--o|-.->|==>|--x|x--|--)\s*(?:\|[^|\n]*\|\s*)?(\b[A-Za-z][\w-]*)/g;

const MERMAID_RESERVED = new Set([
  'graph',
  'flowchart',
  'subgraph',
  'end',
  'style',
  'linkStyle',
  'click',
  'classDef',
  'class',
  'direction',
  'TB',
  'TD',
  'BT',
  'RL',
  'LR'
]);

/** @param {string} source */
export function inferMermaidTopKeyword(source: string) {
  const text = typeof source === 'string' ? source : '';
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('%%')) continue;
    const token = t.split(/\s+/)[0] ?? '';
    return token.replace(/[:`'"]+$/, '') || 'diagram';
  }
  return 'diagram';
}

/** @param {string} source */
export function extractMermaidNodeIds(source: string) {
  const ids = new Set();
  if (!source) return ids;
  const patterns = [
    /\b([A-Za-z][\w-]*)\s*\[/g,
    /\b([A-Za-z][\w-]*)\s*\(/g,
    /\b([A-Za-z][\w-]*)\s*\{\{/g
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(source)) !== null) {
      const id = m[1];
      if (!MERMAID_RESERVED.has(id)) ids.add(id);
    }
  }
  for (const edge of extractMermaidEdges(source)) {
    ids.add(edge.from);
    ids.add(edge.to);
  }
  return ids;
}

/** @param {string} source @returns {{ from: string, to: string }[]} */
export function extractMermaidEdges(source: string) {
  if (!source) return [];
  const edges = [];
  const seen = new Set();
  MERMAID_EDGE_RE.lastIndex = 0;
  let m;
  while ((m = MERMAID_EDGE_RE.exec(source)) !== null) {
    const from = m[1];
    const to = m[2];
    if (MERMAID_RESERVED.has(from) || MERMAID_RESERVED.has(to)) continue;
    const key = `${from}->${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from, to });
  }
  return edges;
}

/** @param {string} source */
export function countMermaidGraphElements(source: string) {
  return {
    nodes: extractMermaidNodeIds(source).size,
    edges: extractMermaidEdges(source).length
  };
}
