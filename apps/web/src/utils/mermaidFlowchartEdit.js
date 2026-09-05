import { pickParallelEdgeRef } from './mermaidEdgeDisambiguation.js';
import { peekDiagramDirective, stripLineComment } from './mermaidSourceLocate.js';

const NODE_ID_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;
const NODE_TOKEN_RE =
  /^([A-Za-z][A-Za-z0-9_-]*)(\["(?:[^"\\]|\\.)*"\]|\("(?:[^"\\]|\\.)*"\)|\[\[[^\]]*\]\]|\[\([^)]*\)\]|\(\([^)]*\)\)|\{\{[^}]*\}\}|\{[^}]*\}|\[[^\]]*\]|\([^)]*\))?/;
const LINK_RE =
  /^\s*(<)?(?:-->|---|-\.->|==>|~~~|<-->|--o|--x|==o|==x|-.->|(?:-{2,}|\.{2,}|={2,}|~{2,})[xo.]?>?)\s*(?:\|([^|]*)\|)?\s*/;
const META_LINE_RE =
  /^(?:subgraph|end|classDef|class|linkStyle|click|style|direction|flowchart|graph)\b/i;
const RESERVED_IDS = new Set([
  'end',
  'subgraph',
  'flowchart',
  'graph',
  'class',
  'classDef',
  'style',
  'click',
  'direction',
  'TB',
  'TD',
  'BT',
  'RL',
  'LR'
]);

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isFlowchartFamilySource(source) {
  return peekDiagramDirective(source ?? '') === 'flowchart';
}

/**
 * @param {string} text
 * @returns {string}
 */
export function formatMermaidNodeShape(text) {
  const label = String(text ?? '').trim();
  if (!label) return '';
  if (/^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(label) && !label.includes(']')) {
    return `[${label}]`;
  }
  return `["${label.replace(/"/g, '#quot;')}"]`;
}

/**
 * @param {string} shape
 * @returns {string}
 */
function labelFromShape(shape) {
  if (!shape) return '';
  const inner = shape.replace(/^\(\(/, '').replace(/\)\)$/, '');
  if (shape.startsWith('["') && shape.endsWith('"]')) {
    return shape.slice(2, -2).replace(/#quot;/g, '"');
  }
  if (shape.startsWith('("') && shape.endsWith('")')) {
    return shape.slice(2, -2).replace(/#quot;/g, '"');
  }
  if (shape.startsWith('[') && shape.endsWith(']')) {
    return shape.slice(1, -1);
  }
  if (shape.startsWith('(') && shape.endsWith(')')) {
    return inner.startsWith('(') ? inner.slice(1, -1) : shape.slice(1, -1);
  }
  if (shape.startsWith('{') && shape.endsWith('}')) {
    return shape.replace(/^\{\{?/, '').replace(/\}\}?$/, '');
  }
  return '';
}

/**
 * @param {string} line
 * @returns {{ nodes: Array<{ id: string, shape: string, label: string }>, edges: Array<{ from: string, to: string, text: string }> } | null}
 */
export function parseFlowchartStatement(line) {
  const stripped = stripLineComment(line).trim();
  if (!stripped || stripped.startsWith('%%')) return null;
  if (META_LINE_RE.test(stripped)) return null;

  /** @type {Array<{ id: string, shape: string, label: string }>} */
  const nodes = [];
  /** @type {Array<{ from: string, to: string, text: string }>} */
  const edges = [];
  let rest = stripped;
  while (rest) {
    const nodeMatch = rest.match(NODE_TOKEN_RE);
    if (!nodeMatch) break;
    const id = nodeMatch[1];
    const shape = nodeMatch[2] || '';
    nodes.push({ id, shape, label: labelFromShape(shape) });
    rest = rest.slice(nodeMatch[0].length);
    const linkMatch = rest.match(LINK_RE);
    if (!linkMatch) break;
    const text = (linkMatch[2] || '').trim();
    rest = rest.slice(linkMatch[0].length);
    const next = rest.match(NODE_TOKEN_RE);
    if (!next) break;
    edges.push({ from: id, to: next[1], text });
  }
  if (nodes.length === 0) return null;
  return { nodes, edges };
}

function collectIds(source) {
  const ids = new Set();
  for (const line of String(source ?? '').split(/\r?\n/)) {
    const stmt = parseFlowchartStatement(line);
    if (stmt) {
      for (const node of stmt.nodes) ids.add(node.id);
      for (const edge of stmt.edges) {
        ids.add(edge.from);
        ids.add(edge.to);
      }
    }
    const header = line.match(/^\s*subgraph\s+(\w+)/i);
    if (header) ids.add(header[1]);
  }
  return ids;
}

/**
 * @param {string} source
 * @returns {string}
 */
export function allocateFlowchartNodeId(source) {
  const ids = collectIds(source);
  let n = 1;
  while (ids.has(`n${n}`) || RESERVED_IDS.has(`n${n}`)) n += 1;
  return `n${n}`;
}

function hasDirectedEdge(source, fromId, toId) {
  for (const line of String(source ?? '').split(/\r?\n/)) {
    const stmt = parseFlowchartStatement(line);
    if (!stmt) continue;
    if (stmt.edges.some((edge) => edge.from === fromId && edge.to === toId)) return true;
  }
  return false;
}

/**
 * @param {string} source
 * @param {string} nodeId
 * @returns {number} 0-based index of the `end` that closes the subgraph containing the node, or -1
 */
function subgraphEndIndexForNode(source, nodeId) {
  const lines = String(source ?? '').split(/\r?\n/);
  /** @type {number[]} */
  const stack = [];
  /** @type {number | null} */
  let containingStart = null;
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = stripLineComment(lines[i]).trim();
    if (/^subgraph\b/i.test(trimmed)) {
      stack.push(i);
      continue;
    }
    if (/^end\b/i.test(trimmed)) {
      const start = stack.pop();
      if (containingStart != null && start === containingStart) return i;
      continue;
    }
    const stmt = parseFlowchartStatement(lines[i]);
    if (stmt && stack.length > 0 && stmt.nodes.some((node) => node.id === nodeId)) {
      containingStart = stack[stack.length - 1];
    }
  }
  return -1;
}

function indentOf(line) {
  const match = String(line ?? '').match(/^[ \t]*/);
  return match ? match[0] : '  ';
}

function lastNonEmptyIndex(lines) {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].trim()) return i;
  }
  return lines.length - 1;
}

function fail(reason) {
  return { ok: false, reason };
}

function ok(source, extra = {}) {
  return { ok: true, source, ...extra };
}

function requireFlowchart(source) {
  if (!isFlowchartFamilySource(source)) return fail('not-flowchart');
  return null;
}

function requireNodeId(id) {
  if (!id || !NODE_ID_RE.test(id)) return fail('bad-id');
  return null;
}

function requireExistingNode(source, id) {
  if (!collectIds(source).has(id)) return fail('missing');
  return null;
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 */
export function connectFlowchartNodes(source, fromId, toId) {
  const blocked =
    requireFlowchart(source) ||
    requireNodeId(fromId) ||
    requireNodeId(toId) ||
    requireExistingNode(source, fromId) ||
    requireExistingNode(source, toId);
  if (blocked) return blocked;
  if (fromId === toId) return fail('self');
  if (hasDirectedEdge(source, fromId, toId)) return fail('duplicate');

  const lines = String(source).split(/\r?\n/);
  const endIdx = subgraphEndIndexForNode(source, fromId);
  const insertAt = endIdx >= 0 ? endIdx : lastNonEmptyIndex(lines) + 1;
  const indent = endIdx >= 0 ? indentOf(lines[endIdx]) + '  ' : '  ';
  const next = [...lines];
  next.splice(insertAt, 0, `${indent}${fromId} --> ${toId}`);
  return ok(next.join('\n'));
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} [label]
 */
export function addLinkedFlowchartNode(source, fromId, label = '') {
  const blocked =
    requireFlowchart(source) || requireNodeId(fromId) || requireExistingNode(source, fromId);
  if (blocked) return blocked;
  const newId = allocateFlowchartNodeId(source);
  const shape = formatMermaidNodeShape(String(label || '').trim() || newId);
  const lines = String(source).split(/\r?\n/);
  const endIdx = subgraphEndIndexForNode(source, fromId);
  const insertAt = endIdx >= 0 ? endIdx : lastNonEmptyIndex(lines) + 1;
  const indent = endIdx >= 0 ? indentOf(lines[Math.max(0, endIdx - 1)] || lines[endIdx]) : '  ';
  const next = [...lines];
  next.splice(insertAt, 0, `${indent}${fromId} --> ${newId}${shape}`);
  return ok(next.join('\n'), { newId });
}

function reconstructStatement(stmt) {
  if (stmt.edges.length === 0) {
    return stmt.nodes
      .map((node) => `${node.id}${node.shape || ''}`)
      .filter((token, index, all) => all.indexOf(token) === index)
      .join('\n');
  }
  return stmt.edges
    .map((edge) => {
      const from = stmt.nodes.find((node) => node.id === edge.from);
      const to = stmt.nodes.find((node) => node.id === edge.to);
      const fromTok = `${edge.from}${from?.shape || ''}`;
      const toTok = `${edge.to}${to?.shape || ''}`;
      const mid = edge.text ? ` -->|${edge.text}| ` : ' --> ';
      return `${fromTok}${mid}${toTok}`;
    })
    .join('\n');
}

/**
 * @param {string} source
 * @param {string} nodeId
 */
export function deleteFlowchartNode(source, nodeId) {
  const blocked = requireFlowchart(source) || requireNodeId(nodeId);
  if (blocked) return blocked;
  const lines = String(source).split(/\r?\n/);
  /** @type {string[]} */
  const next = [];
  let removed = false;
  for (const line of lines) {
    const stmt = parseFlowchartStatement(line);
    if (!stmt) {
      next.push(line);
      continue;
    }
    const touched =
      stmt.nodes.some((node) => node.id === nodeId) ||
      stmt.edges.some((edge) => edge.from === nodeId || edge.to === nodeId);
    if (!touched) {
      next.push(line);
      continue;
    }
    const keptNodes = stmt.nodes.filter((node) => node.id !== nodeId);
    const keptEdges = stmt.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId);
    removed = true;
    if (keptEdges.length === 0 && keptNodes.length === 0) continue;
    const rebuilt = reconstructStatement({ nodes: keptNodes, edges: keptEdges });
    if (rebuilt) next.push(...rebuilt.split('\n').map((part) => prefixIndent(line, part)));
  }
  if (!removed) return fail('missing');
  return ok(next.join('\n'));
}

function prefixIndent(original, rebuilt) {
  const indent = indentOf(original);
  return rebuilt.startsWith(indent) ? rebuilt : `${indent}${rebuilt.trimStart()}`;
}

/**
 * @typedef {{ lineIndex: number, edgeIndex: number, text: string }} FlowchartEdgeRef
 */

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 * @returns {{ lines: string[], refs: FlowchartEdgeRef[] }}
 */
function collectFlowchartEdgeRefs(source, fromId, toId) {
  const lines = String(source).split(/\r?\n/);
  /** @type {FlowchartEdgeRef[]} */
  const refs = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const stmt = parseFlowchartStatement(lines[lineIndex]);
    if (!stmt) continue;
    stmt.edges.forEach((edge, edgeIndex) => {
      if (edge.from === fromId && edge.to === toId) {
        refs.push({ lineIndex, edgeIndex, text: edge.text || '' });
      }
    });
  }
  return { lines, refs };
}

/**
 * @param {string[]} lines
 * @param {number} lineIndex
 * @param {string} originalLine
 * @param {{ nodes: Array<{ id: string, shape: string, label: string }>, edges: Array<{ from: string, to: string, text: string }> }} stmt
 */
function replaceFlowchartStatementLine(lines, lineIndex, originalLine, stmt) {
  const next = [...lines];
  if (stmt.edges.length === 0) {
    const defs = [];
    for (const node of stmt.nodes) {
      const token = `${node.id}${node.shape || ''}`;
      if (!defs.includes(token)) defs.push(token);
    }
    if (defs.length === 0) {
      next.splice(lineIndex, 1);
      return next;
    }
    next.splice(lineIndex, 1, ...defs.map((part) => prefixIndent(originalLine, part)));
    return next;
  }
  const rebuilt = reconstructStatement(stmt);
  if (!rebuilt) {
    next.splice(lineIndex, 1);
    return next;
  }
  next.splice(lineIndex, 1, ...rebuilt.split('\n').map((part) => prefixIndent(originalLine, part)));
  return next;
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 * @param {string} [matchLabel]
 * @param {number} [matchIndex] Mermaid `L_<from>_<to>_<n>` index when known
 */
export function deleteFlowchartEdge(source, fromId, toId, matchLabel, matchIndex) {
  const blocked = requireFlowchart(source) || requireNodeId(fromId) || requireNodeId(toId);
  if (blocked) return blocked;

  const { lines, refs } = collectFlowchartEdgeRefs(source, fromId, toId);
  const picked = pickParallelEdgeRef(refs, { edgeLabel: matchLabel, edgeIndex: matchIndex });
  if (!picked) return fail('missing');

  const originalLine = lines[picked.lineIndex];
  const stmt = parseFlowchartStatement(originalLine);
  if (!stmt) return fail('missing');

  const remaining = stmt.edges.filter((_, index) => index !== picked.edgeIndex);
  const next = replaceFlowchartStatementLine(lines, picked.lineIndex, originalLine, {
    nodes: stmt.nodes,
    edges: remaining
  });
  return ok(next.join('\n'));
}

/**
 * @param {string} source
 * @param {string} nodeId
 * @param {string} label
 */
export function renameFlowchartNode(source, nodeId, label) {
  const blocked =
    requireFlowchart(source) || requireNodeId(nodeId) || requireExistingNode(source, nodeId);
  if (blocked) return blocked;
  const shape = formatMermaidNodeShape(String(label ?? '').trim() || nodeId);
  const lines = String(source).split(/\r?\n/);
  let found = false;
  const next = lines.map((line) => {
    const stmt = parseFlowchartStatement(line);
    if (!stmt || !stmt.nodes.some((node) => node.id === nodeId)) return line;
    found = true;
    const updatedNodes = stmt.nodes.map((node) =>
      node.id === nodeId ? { ...node, shape, label: String(label ?? '').trim() || nodeId } : node
    );
    const rebuilt = reconstructStatement({ nodes: updatedNodes, edges: stmt.edges });
    if (!rebuilt) return line;
    return rebuilt
      .split('\n')
      .map((part) => prefixIndent(line, part))
      .join('\n');
  });
  if (found) return ok(next.join('\n'));
  return fail('missing');
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 * @param {string} label new edge label
 * @param {{ edgeLabel?: string, edgeIndex?: number }} [match] existing edge identifying which parallel link to rename
 */
export function renameFlowchartEdge(source, fromId, toId, label, match = {}) {
  const blocked = requireFlowchart(source) || requireNodeId(fromId) || requireNodeId(toId);
  if (blocked) return blocked;
  const text = String(label ?? '').trim();
  const { edgeLabel: matchLabel, edgeIndex: matchIndex } = match;

  const { lines, refs } = collectFlowchartEdgeRefs(source, fromId, toId);
  const picked = pickParallelEdgeRef(refs, { edgeLabel: matchLabel, edgeIndex: matchIndex });
  if (!picked) return fail('missing');

  const originalLine = lines[picked.lineIndex];
  const stmt = parseFlowchartStatement(originalLine);
  if (!stmt) return fail('missing');

  const edges = stmt.edges.map((edge, index) =>
    index === picked.edgeIndex ? { ...edge, text } : edge
  );
  const next = replaceFlowchartStatementLine(lines, picked.lineIndex, originalLine, {
    nodes: stmt.nodes,
    edges
  });
  return ok(next.join('\n'));
}
