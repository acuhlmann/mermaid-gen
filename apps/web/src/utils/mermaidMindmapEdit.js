import { peekDiagramDirective, stripLineComment } from './mermaidSourceLocate.js';
import { infographicLabelRef, parseInfographicGraphId } from './infographicGraphEdit.js';

const META_LINE_RE = /^(classDef|class|style|linkStyle)\b/i;
const DECORATION_RE = /^::(?:icon\(|:)/;
const NODE_REF_PREFIX = '~node:';

function fail(reason) {
  return { ok: false, reason };
}

function ok(source, extra = {}) {
  return { ok: true, source, ...extra };
}

function indentOf(line) {
  const match = String(line ?? '').match(/^[ \t]*/);
  return match ? match[0].length : 0;
}

function indentChars(line) {
  const match = String(line ?? '').match(/^[ \t]*/);
  return match ? match[0] : '';
}

function joinLines(source, lines) {
  const text = lines.join('\n');
  if (String(source).endsWith('\n') && !text.endsWith('\n')) return `${text}\n`;
  return text;
}

function indexPathOf(indexes) {
  return indexes.join(',');
}

function childPath(parentPath, childIndex) {
  return parentPath ? `${parentPath},${childIndex}` : String(childIndex);
}

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isMindmapFamilySource(source) {
  return peekDiagramDirective(source ?? '') === 'mindmap';
}

export { infographicLabelRef as mindmapLabelRef, parseInfographicGraphId as parseMindmapGraphId };

/**
 * Stable ref for a mindmap node by Mermaid's flat `node_N` render index.
 * @param {number} index
 */
export function mindmapNodeRef(index) {
  return `${NODE_REF_PREFIX}${index}`;
}

/**
 * @param {string} id
 * @returns {number | null}
 */
export function parseMindmapNodeIndex(id) {
  const raw = String(id ?? '').trim();
  if (raw.startsWith(NODE_REF_PREFIX)) {
    const n = Number.parseInt(raw.slice(NODE_REF_PREFIX.length), 10);
    return Number.isInteger(n) && n >= 0 ? n : null;
  }
  const match = /^node_(\d+)$/i.exec(raw);
  if (match) return Number.parseInt(match[1], 10);
  return null;
}

/**
 * @param {string} stripped
 * @returns {{ nodeId: string | null, label: string, kind: string } | null}
 */
export function parseMindmapNodeText(stripped) {
  const text = String(stripped ?? '').trim();
  if (!text || META_LINE_RE.test(text) || DECORATION_RE.test(text)) return null;

  let match = text.match(/^(\w[\w-]*)\(\((.+)\)\)$/);
  if (match) return { nodeId: match[1], label: match[2].trim(), kind: 'circle-id' };

  match = text.match(/^\(\((.+)\)\)$/);
  if (match) return { nodeId: null, label: match[1].trim(), kind: 'circle' };

  match = text.match(/^(\w[\w-]*)\[(.+)\]$/);
  if (match) return { nodeId: match[1], label: match[2].trim(), kind: 'square-id' };

  match = text.match(/^\[(.+)\]$/);
  if (match) return { nodeId: null, label: match[1].trim(), kind: 'square' };

  match = text.match(/^(\w[\w-]*)\(([^)]+)\)$/);
  if (match) return { nodeId: match[1], label: match[2].trim(), kind: 'round-id' };

  match = text.match(/^(\w[\w-]*)\)\)(.+)\(\($/);
  if (match) return { nodeId: match[1], label: match[2].trim(), kind: 'cloud-id' };

  match = text.match(/^(\w[\w-]*)\{(.+)\}$/);
  if (match) return { nodeId: match[1], label: match[2].trim(), kind: 'hex-id' };

  return { nodeId: null, label: text, kind: 'plain' };
}

/**
 * @param {{ nodeId: string | null, label: string, kind: string }} parsed
 * @param {string} label
 */
export function formatMindmapNodeText(parsed, label) {
  const next = String(label ?? '').trim();
  if (!next) return '';
  switch (parsed.kind) {
    case 'circle-id':
      return `${parsed.nodeId}((${next}))`;
    case 'circle':
      return `((${next}))`;
    case 'square-id':
      return `${parsed.nodeId}[${next}]`;
    case 'square':
      return `[${next}]`;
    case 'round-id':
      return `${parsed.nodeId}(${next})`;
    case 'cloud-id':
      return `${parsed.nodeId}))${next}((`;
    case 'hex-id':
      return `${parsed.nodeId}{${next}}`;
    default:
      return next;
  }
}

/**
 * @param {string} source
 * @returns {{ lines: string[], root: object, flat: object[] } | null}
 */
export function parseMindmapTree(source) {
  const lines = String(source ?? '').split(/\r?\n/);
  let headerLine = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*mindmap\b/i.test(stripLineComment(lines[i]))) {
      headerLine = i;
      break;
    }
  }
  if (headerLine < 0) return null;

  /** @type {Array<{ lineIdx: number, indent: number, parsed?: object, isNode: boolean }>} */
  const items = [];
  for (let i = headerLine + 1; i < lines.length; i += 1) {
    const raw = lines[i];
    const stripped = stripLineComment(raw).trim();
    if (!stripped) continue;
    const indent = indentOf(raw);
    const parsed = parseMindmapNodeText(stripped);
    if (parsed) {
      items.push({ lineIdx: i, indent, parsed, isNode: true });
      continue;
    }
    if (DECORATION_RE.test(stripped)) {
      items.push({ lineIdx: i, indent, isNode: false });
    }
  }

  const nodeItems = items.filter((item) => item.isNode);
  if (nodeItems.length === 0) return null;

  /** @type {object[]} */
  const flat = [];
  /** @type {object[]} */
  const stack = [];

  for (let idx = 0; idx < items.length; idx += 1) {
    const item = items[idx];
    if (!item.isNode || !item.parsed) continue;

    while (stack.length > 0 && stack[stack.length - 1].indent >= item.indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    const childIndex = parent ? parent.children.length : 0;
    const path = parent ? childPath(parent.path, childIndex) : '0';

    let endLine = lines.length;
    for (let j = idx + 1; j < items.length; j += 1) {
      const next = items[j];
      if (next.isNode && next.indent <= item.indent) {
        endLine = next.lineIdx;
        break;
      }
    }

    const node = {
      path,
      start: item.lineIdx,
      end: endLine,
      indent: item.indent,
      label: item.parsed.label,
      nodeId: item.parsed.nodeId,
      parsed: item.parsed,
      isRoot: !parent,
      children: []
    };
    if (parent) parent.children.push(node);
    stack.push(node);
    flat.push(node);
  }

  return { lines, headerLine, root: flat[0], flat };
}

function findMindmapNode(tree, id) {
  const nodeIndex = parseMindmapNodeIndex(id);
  if (nodeIndex != null) {
    return tree.flat[nodeIndex] ?? null;
  }
  const { indexes, label } = parseInfographicGraphId(id);
  if (indexes) {
    const path = indexPathOf(indexes);
    return tree.flat.find((node) => node.path === path) ?? null;
  }
  if (label) {
    return tree.flat.find((node) => node.label === label || node.nodeId === label) ?? null;
  }
  return null;
}

function collectMindmapLabels(tree) {
  const labels = new Set();
  for (const node of tree.flat) {
    if (node.label) labels.add(node.label);
  }
  return labels;
}

function allocateMindmapLabel(existing) {
  let n = 1;
  while (existing.has(`Item ${n}`)) n += 1;
  return `Item ${n}`;
}

function childIndentFor(parent, lines) {
  if (parent.children.length > 0) {
    return indentOf(lines[parent.children[0].start]);
  }
  return parent.indent + 2;
}

function requireMindmap(source) {
  if (!isMindmapFamilySource(source)) return fail('not-mindmap');
  return null;
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} [label]
 */
export function addLinkedMindmapNode(source, fromId, label = '') {
  const blocked = requireMindmap(source);
  if (blocked) return blocked;
  const tree = parseMindmapTree(source);
  if (!tree) return fail('not-graph');
  const parent = findMindmapNode(tree, fromId);
  if (!parent) return fail('missing');

  const text = String(label || '').trim() || allocateMindmapLabel(collectMindmapLabels(tree));
  const childIndex = parent.children.length;
  const newPath = childPath(parent.path, childIndex);
  const pad = ' '.repeat(childIndentFor(parent, tree.lines));
  const next = [...tree.lines];
  next.splice(parent.end, 0, `${pad}${text}`);
  return ok(joinLines(source, next), { newId: newPath, newLabel: text });
}

/**
 * @param {string} source
 * @param {string} nodeId
 */
export function deleteMindmapNode(source, nodeId) {
  const blocked = requireMindmap(source);
  if (blocked) return blocked;
  const tree = parseMindmapTree(source);
  if (!tree) return fail('not-graph');
  const node = findMindmapNode(tree, nodeId);
  if (!node) return fail('missing');
  if (node.isRoot) return fail('root');

  const next = [...tree.lines];
  next.splice(node.start, node.end - node.start);
  return ok(joinLines(source, next));
}

/**
 * @param {string} source
 * @param {string} nodeId
 * @param {string} label
 */
export function renameMindmapNode(source, nodeId, label) {
  const blocked = requireMindmap(source);
  if (blocked) return blocked;
  const tree = parseMindmapTree(source);
  if (!tree) return fail('not-graph');
  const node = findMindmapNode(tree, nodeId);
  if (!node) return fail('missing');

  const nextLabel = String(label ?? '').trim();
  if (!nextLabel) return fail('empty');
  if (nextLabel === node.label) return ok(source);

  const formatted = formatMindmapNodeText(node.parsed, nextLabel);
  if (!formatted) return fail('empty');

  const next = [...tree.lines];
  const line = next[node.start];
  next[node.start] = `${indentChars(line)}${formatted}`;
  return ok(joinLines(source, next));
}

export function connectMindmapNodes() {
  return fail('no-link');
}

export function deleteMindmapEdge() {
  return fail('not-graph');
}

export function renameMindmapEdge() {
  return fail('not-graph');
}
