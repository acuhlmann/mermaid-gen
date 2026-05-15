/**
 * Diagram diff for MCP Apps: line-level, Mermaid graph (nodes + edges), Infographic structural.
 */

import { diffInfographicSources } from '@archislop/shared';

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
export function extractMermaidNodeIds(source) {
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

/** @param {string} source @returns {{ from: string, to: string, label?: string }[]} */
export function extractMermaidEdges(source) {
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

function edgeKey(e) {
  return `${e.from}->${e.to}`;
}

/**
 * Graph-level diff (nodes + edges) for Mermaid sources.
 * @param {string} before
 * @param {string} after
 */
export function buildMermaidGraphDiff(before, after) {
  const beforeNodes = extractMermaidNodeIds(before);
  const afterNodes = extractMermaidNodeIds(after);
  const nodesAdded = [];
  const nodesRemoved = [];
  let nodesUnchanged = 0;
  for (const id of afterNodes) {
    if (!beforeNodes.has(id)) nodesAdded.push(id);
    else nodesUnchanged += 1;
  }
  for (const id of beforeNodes) {
    if (!afterNodes.has(id)) nodesRemoved.push(id);
  }
  nodesAdded.sort();
  nodesRemoved.sort();

  const beforeEdges = new Map(extractMermaidEdges(before).map((e) => [edgeKey(e), e]));
  const afterEdges = new Map(extractMermaidEdges(after).map((e) => [edgeKey(e), e]));
  const edgesAdded = [];
  const edgesRemoved = [];
  for (const [key, e] of afterEdges) {
    if (!beforeEdges.has(key)) edgesAdded.push(e);
  }
  for (const [key, e] of beforeEdges) {
    if (!afterEdges.has(key)) edgesRemoved.push(e);
  }

  return {
    nodesAdded,
    nodesRemoved,
    nodesUnchanged,
    edgesAdded,
    edgesRemoved
  };
}

/**
 * @param {string} before
 * @param {string} after
 * @param {{ contentType?: string }} [options]
 */
export function buildDiagramDiffSummary(before, after, { contentType = 'mermaid' } = {}) {
  const a = (before ?? '').split('\n');
  const b = (after ?? '').split('\n');
  const max = Math.max(a.length, b.length);
  const unified = [];
  let linesAdded = 0;
  let linesRemoved = 0;
  let linesChanged = 0;

  for (let i = 0; i < max; i++) {
    const left = a[i];
    const right = b[i];
    if (left === undefined && right !== undefined) {
      unified.push({ kind: 'add', text: right });
      linesAdded += 1;
    } else if (right === undefined && left !== undefined) {
      unified.push({ kind: 'del', text: left });
      linesRemoved += 1;
    } else if (left === right) {
      unified.push({ kind: 'same', text: left });
    } else {
      unified.push({ kind: 'del', text: left });
      unified.push({ kind: 'add', text: right });
      linesChanged += 1;
    }
  }

  /** @type {Record<string, unknown>} */
  const graphDiff =
    contentType === 'mermaid'
      ? buildMermaidGraphDiff(before, after)
      : contentType === 'infographic'
        ? diffInfographicSources(before, after)
        : null;

  const legacyNodes =
    contentType === 'mermaid' && graphDiff
      ? {
          nodesAdded: graphDiff.nodesAdded,
          nodesRemoved: graphDiff.nodesRemoved,
          nodesUnchanged: graphDiff.nodesUnchanged
        }
      : { nodesAdded: [], nodesRemoved: [], nodesUnchanged: 0 };

  return {
    linesAdded,
    linesRemoved,
    linesChanged,
    unified,
    graphDiff,
    ...legacyNodes
  };
}

/**
 * @param {string} sessionId
 */
export function buildWebCanvasUrl(sessionId) {
  const fromWeb = process.env.ARCHISLOP_WEB_URL?.trim();
  const fromPublic = process.env.PUBLIC_BASE_URL?.trim();
  const base = fromWeb || fromPublic || process.env.OPENROUTER_SITE_URL || 'http://localhost:5173';
  const trimmed = base.replace(/\/$/, '');
  return `${trimmed}/sessions/${encodeURIComponent(sessionId)}`;
}
