/**
 * Deterministic Connect / Delete / Rename for AntV infographic families that
 * behave like a graph: hierarchy trees (root + children), relation maps
 * (nodes + relations), and flat lists / sequences (sibling items). Indexes
 * match what AntV stamps on `data-indexes` (`"0"` is the hierarchy root or
 * first list item; tree children are `"0,0"`, `"0,1"`, …).
 */

const LABEL_REF_PREFIX = '~label:';
const ITEM_KV_RE = /^(label|desc|value|icon|illus|id|category|text|weight)\s+(.*)$/i;

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

function parseInlineKv(stripped) {
  const match = ITEM_KV_RE.exec(String(stripped ?? '').trim());
  if (!match) return null;
  return { key: match[1].toLowerCase(), value: match[2].trim() };
}

/**
 * @param {string} source
 * @returns {string | null}
 */
export function readInfographicTemplate(source) {
  const first = String(source ?? '')
    .split(/\r?\n/)
    .find((line) => line.trim());
  if (!first) return null;
  const match = /^\s*infographic\s+([a-z0-9][a-z0-9-]*)\s*$/i.exec(first);
  return match ? match[1].toLowerCase() : null;
}

/**
 * @param {string} source
 * @returns {'hierarchy' | 'relation' | 'list' | 'sequence' | null}
 */
export function infographicGraphFamily(source) {
  const template = readInfographicTemplate(source);
  if (!template) return null;
  const family = template.split('-')[0];
  if (family === 'hierarchy' && template !== 'hierarchy-structure') return 'hierarchy';
  if (template === 'hierarchy-structure') return 'flat';
  if (family === 'relation') return 'relation';
  if (family === 'list') return 'list';
  if (family === 'sequence') return 'sequence';
  if (family === 'chart') return 'flat';
  return null;
}

/**
 * @param {string} template
 * @returns {'lists' | 'sequences' | null}
 */
function listArrayFieldForTemplate(template) {
  const normalized = String(template ?? '').toLowerCase();
  const family = normalized.split('-')[0];
  if (normalized === 'hierarchy-structure') return 'items';
  if (family === 'list') return 'lists';
  if (family === 'sequence') return 'sequences';
  if (family === 'chart') return 'values';
  return null;
}

/** @param {string | null | undefined} template */
function flatItemLabelKey(template) {
  const normalized = String(template ?? '').toLowerCase();
  return normalized.includes('wordcloud') ? 'text' : 'label';
}

/** @param {string | null | undefined} template */
function flatItemDefaultAttrs(template) {
  const normalized = String(template ?? '').toLowerCase();
  if (normalized.includes('wordcloud')) return { weight: '1' };
  if (normalized.startsWith('chart-')) return { value: '0' };
  return null;
}

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isInfographicGraphSource(source) {
  return infographicGraphFamily(source) != null;
}

/**
 * @param {string} source
 * @returns {boolean}
 */
export function infographicGraphAllowsLink(source) {
  const template = readInfographicTemplate(source) ?? '';
  return /^relation-dagre-/.test(template);
}

export function infographicLabelRef(label) {
  const text = String(label ?? '').trim();
  return text ? `${LABEL_REF_PREFIX}${text}` : null;
}

export function parseInfographicGraphId(id) {
  const raw = String(id ?? '').trim();
  if (!raw) return { indexes: null, label: null };
  if (raw.startsWith(LABEL_REF_PREFIX)) {
    return { indexes: null, label: raw.slice(LABEL_REF_PREFIX.length) };
  }
  const indexes = raw.split(',').map((part) => Number.parseInt(part.trim(), 10));
  if (indexes.length === 0 || indexes.some((n) => !Number.isInteger(n) || n < 0)) {
    return { indexes: null, label: raw };
  }
  return { indexes, label: null };
}

function indexPathOf(indexes) {
  return indexes.join(',');
}

function childPath(parentPath, childIndex) {
  return parentPath ? `${parentPath},${childIndex}` : String(childIndex);
}

function skipBlanks(lines, start) {
  let i = start;
  while (i < lines.length && !String(lines[i]).trim()) i += 1;
  return i;
}

function blockEnd(lines, start, indent) {
  let i = start + 1;
  while (i < lines.length) {
    const raw = lines[i];
    if (raw.trim()) {
      if (indentOf(raw) <= indent) break;
    }
    i += 1;
  }
  return i;
}

function parseDashItem(lines, start, itemIndent, path) {
  const raw = lines[start];
  if (!raw || indentOf(raw) !== itemIndent) return null;
  const stripped = raw.slice(itemIndent);
  if (!stripped.startsWith('- ')) return null;
  const node = {
    path,
    start,
    end: start + 1,
    indent: itemIndent,
    id: null,
    label: null,
    childrenKeyLine: -1,
    children: []
  };
  const first = parseInlineKv(stripped.slice(2));
  if (first?.key === 'label' || first?.key === 'text') node.label = first.value;
  if (first?.key === 'id') node.id = first.value;

  let i = start + 1;
  const attrIndent = itemIndent + 2;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const ind = indentOf(line);
    if (ind <= itemIndent) break;
    const inner = line.slice(ind);
    if (/^children\s*$/i.test(inner)) {
      node.childrenKeyLine = i;
      i += 1;
      let childIndent = -1;
      for (let j = i; j < lines.length; j += 1) {
        const childLine = lines[j];
        if (!childLine.trim()) continue;
        const childInd = indentOf(childLine);
        if (childInd <= ind) break;
        if (childLine.slice(childInd).startsWith('- ')) {
          childIndent = childInd;
          break;
        }
      }
      if (childIndent > 0) {
        let childIdx = 0;
        while (i < lines.length) {
          const child = parseDashItem(
            lines,
            skipBlanks(lines, i),
            childIndent,
            childPath(path, childIdx)
          );
          if (!child) break;
          node.children.push(child);
          childIdx += 1;
          i = child.end;
        }
      }
      continue;
    }
    const kv = parseInlineKv(inner);
    if (kv) {
      if ((kv.key === 'label' || kv.key === 'text') && node.label == null) node.label = kv.value;
      if (kv.key === 'id' && node.id == null) node.id = kv.value;
    }
    if (ind < attrIndent && !kv) break;
    i += 1;
  }
  node.end = i;
  return node;
}

function parseHierarchyTree(source) {
  const lines = String(source ?? '').split(/\r?\n/);
  let rootLine = -1;
  let rootIndent = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^root\s*$/i.test(lines[i].trim()) && indentOf(lines[i]) > 0) {
      rootLine = i;
      rootIndent = indentOf(lines[i]);
      break;
    }
  }
  if (rootLine < 0) return null;

  const root = {
    path: '0',
    start: rootLine,
    end: blockEnd(lines, rootLine, rootIndent),
    indent: rootIndent,
    id: null,
    label: null,
    childrenKeyLine: -1,
    children: [],
    isRoot: true
  };
  let i = rootLine + 1;
  const attrIndent = rootIndent + 2;
  while (i < root.end) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const ind = indentOf(line);
    if (ind <= rootIndent) break;
    const inner = line.slice(ind);
    if (/^children\s*$/i.test(inner)) {
      root.childrenKeyLine = i;
      i += 1;
      let childIndent = -1;
      for (let j = i; j < root.end; j += 1) {
        const childLine = lines[j];
        if (!childLine.trim()) continue;
        const childInd = indentOf(childLine);
        if (childInd <= ind) break;
        if (childLine.slice(childInd).startsWith('- ')) {
          childIndent = childInd;
          break;
        }
      }
      if (childIndent > 0) {
        let childIdx = 0;
        while (i < root.end) {
          const child = parseDashItem(
            lines,
            skipBlanks(lines, i),
            childIndent,
            childPath(root.path, childIdx)
          );
          if (!child || child.start >= root.end) break;
          root.children.push(child);
          childIdx += 1;
          i = child.end;
        }
      }
      continue;
    }
    const kv = parseInlineKv(inner);
    if (kv) {
      if (kv.key === 'label' && root.label == null) root.label = kv.value;
      if (kv.key === 'id' && root.id == null) root.id = kv.value;
    }
    if (ind < attrIndent && !kv) break;
    i += 1;
  }
  return { lines, root };
}

function flattenTree(node, into = []) {
  into.push(node);
  for (const child of node.children ?? []) flattenTree(child, into);
  return into;
}

function findTreeNode(root, { indexes, label }) {
  const nodes = flattenTree(root);
  if (indexes) {
    const path = indexPathOf(indexes);
    const hit = nodes.find((node) => node.path === path);
    if (hit) return hit;
  }
  if (label) {
    return nodes.find((node) => node.label === label || node.id === label) ?? null;
  }
  return null;
}

function collectTreeLabels(root) {
  const labels = new Set();
  for (const node of flattenTree(root)) {
    if (node.label) labels.add(node.label);
  }
  return labels;
}

function allocateLabel(existing) {
  let n = 1;
  while (existing.has(`Item ${n}`)) n += 1;
  return `Item ${n}`;
}

function setLabelOnSpan(lines, node, label, labelKey = 'label') {
  const next = [...lines];
  for (let i = node.start; i < node.end; i += 1) {
    const raw = next[i];
    const ind = indentOf(raw);
    const stripped = raw.slice(ind);
    if (stripped.startsWith('- ')) {
      const rest = stripped.slice(2);
      const kv = parseInlineKv(rest);
      if (kv?.key === labelKey) {
        next[i] = `${indentChars(raw)}- ${labelKey} ${label}`;
        return next;
      }
      continue;
    }
    const kv = parseInlineKv(stripped);
    if (kv?.key === labelKey) {
      next[i] = `${indentChars(raw)}${labelKey} ${label}`;
      return next;
    }
  }
  const pad = ' '.repeat(node.indent + 2);
  next.splice(node.start + 1, 0, `${pad}${labelKey} ${label}`);
  return next;
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} [label]
 */
export function addLinkedInfographicNode(source, fromId, label = '') {
  const family = infographicGraphFamily(source);
  if (!family) return fail('not-graph');
  if (family === 'hierarchy') return addHierarchyChild(source, fromId, label);
  if (family === 'list' || family === 'sequence' || family === 'flat') {
    return addListSibling(source, fromId, label);
  }
  return addRelationNode(source, fromId, label);
}

function addHierarchyChild(source, fromId, label) {
  const tree = parseHierarchyTree(source);
  if (!tree) return fail('not-graph');
  const parent = findTreeNode(tree.root, parseInfographicGraphId(fromId));
  if (!parent) return fail('missing');
  const text = String(label || '').trim() || allocateLabel(collectTreeLabels(tree.root));
  const next = [...tree.lines];
  const childIndex = parent.children.length;
  const newPath = childPath(parent.path, childIndex);

  if (parent.childrenKeyLine >= 0 && parent.children.length > 0) {
    const sibling = parent.children[parent.children.length - 1];
    const itemIndent = indentChars(tree.lines[sibling.start]);
    next.splice(sibling.end, 0, `${itemIndent}- label ${text}`);
    return ok(joinLines(source, next), { newId: newPath, newLabel: text });
  }

  const childIndent = parent.isRoot ? parent.indent + 2 : parent.indent + 2;
  const itemIndent = childIndent + 2;
  const childrenPad = ' '.repeat(childIndent);
  const itemPad = ' '.repeat(itemIndent);
  const insertAt = parent.end;
  const block = [];
  if (parent.childrenKeyLine < 0) block.push(`${childrenPad}children`);
  block.push(`${itemPad}- label ${text}`);
  next.splice(insertAt, 0, ...block);
  return ok(joinLines(source, next), { newId: newPath, newLabel: text });
}

/**
 * @param {string} source
 * @param {string} nodeId
 */
export function deleteInfographicNode(source, nodeId) {
  const family = infographicGraphFamily(source);
  if (!family) return fail('not-graph');
  if (family === 'hierarchy') return deleteHierarchyNode(source, nodeId);
  if (family === 'list' || family === 'sequence' || family === 'flat') {
    return deleteListItem(source, nodeId);
  }
  return deleteRelationNode(source, nodeId);
}

function deleteHierarchyNode(source, nodeId) {
  const tree = parseHierarchyTree(source);
  if (!tree) return fail('not-graph');
  const node = findTreeNode(tree.root, parseInfographicGraphId(nodeId));
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
export function renameInfographicNode(source, nodeId, label) {
  const family = infographicGraphFamily(source);
  if (!family) return fail('not-graph');
  const text = String(label ?? '').trim();
  if (!text) return fail('empty');
  if (family === 'hierarchy') {
    const tree = parseHierarchyTree(source);
    if (!tree) return fail('not-graph');
    const node = findTreeNode(tree.root, parseInfographicGraphId(nodeId));
    if (!node) return fail('missing');
    return ok(joinLines(source, setLabelOnSpan(tree.lines, node, text)));
  }
  if (family === 'list' || family === 'sequence' || family === 'flat') {
    return renameListItem(source, nodeId, text);
  }
  return renameRelationNode(source, nodeId, text);
}

/**
 * Hierarchy has no free edges. Relation-dagre can grow an edge between two nodes.
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 */
export function connectInfographicNodes(source, fromId, toId) {
  const family = infographicGraphFamily(source);
  if (family !== 'relation') return fail('not-graph');
  if (!infographicGraphAllowsLink(source)) return fail('no-link');
  return connectRelationNodes(source, fromId, toId);
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 */
export function deleteInfographicEdge(source, fromId, toId) {
  if (infographicGraphFamily(source) !== 'relation') return fail('not-graph');
  return deleteRelationEdge(source, fromId, toId);
}

function parseArrayItems(lines, fieldName) {
  let fieldLine = -1;
  let fieldIndent = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim().toLowerCase() === fieldName && indentOf(lines[i]) > 0) {
      fieldLine = i;
      fieldIndent = indentOf(lines[i]);
      break;
    }
  }
  if (fieldLine < 0) return null;
  const end = blockEnd(lines, fieldLine, fieldIndent);
  let itemIndent = -1;
  for (let i = fieldLine + 1; i < end; i += 1) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const ind = indentOf(raw);
    if (ind <= fieldIndent) break;
    if (raw.slice(ind).startsWith('- ')) {
      itemIndent = ind;
      break;
    }
  }
  const items = [];
  if (itemIndent > 0) {
    let i = fieldLine + 1;
    let idx = 0;
    while (i < end) {
      const item = parseDashItem(lines, skipBlanks(lines, i), itemIndent, String(idx));
      if (!item || item.start >= end) break;
      items.push(item);
      idx += 1;
      i = item.end;
    }
  }
  return { fieldLine, fieldIndent, end, itemIndent, items };
}

function parseRelationsBlock(lines) {
  let fieldLine = -1;
  let fieldIndent = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim().toLowerCase() === 'relations' && indentOf(lines[i]) > 0) {
      fieldLine = i;
      fieldIndent = indentOf(lines[i]);
      break;
    }
  }
  if (fieldLine < 0) return { fieldLine: -1, fieldIndent: -1, end: -1, edges: [] };
  const end = blockEnd(lines, fieldLine, fieldIndent);
  const edges = [];
  for (let i = fieldLine + 1; i < end; i += 1) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    if (indentOf(raw) <= fieldIndent) break;
    const parsed = parseRelationLine(raw.trim().replace(/^- /, ''));
    if (parsed) edges.push({ line: i, ...parsed, raw });
  }
  return { fieldLine, fieldIndent, end, edges };
}

function parseRelationLine(text) {
  const match = String(text ?? '').match(/^(\S+)\s+(?:-\s*(.*?)\s*)?->\s+(\S+)\s*$/);
  if (!match) return null;
  return { from: match[1], to: match[3], label: (match[2] || '').trim() };
}

function parseRelationDoc(source) {
  const lines = String(source ?? '').split(/\r?\n/);
  const nodes = parseArrayItems(lines, 'nodes');
  if (!nodes) return null;
  const relations = parseRelationsBlock(lines);
  return { lines, nodes, relations };
}

function nodeRef(node) {
  return node.id || node.label || node.path;
}

function findRelationNode(doc, id) {
  const parsed = parseInfographicGraphId(id);
  if (parsed.indexes) {
    const path = indexPathOf(parsed.indexes);
    const hit = doc.nodes.items.find((node) => node.path === path);
    if (hit) return hit;
  }
  const key = parsed.label || String(id ?? '').trim();
  return (
    doc.nodes.items.find((node) => node.id === key || node.label === key || node.path === key) ??
    null
  );
}

function collectRelationIds(doc) {
  const ids = new Set();
  for (const node of doc.nodes.items) {
    if (node.id) ids.add(node.id);
    if (node.label) ids.add(node.label);
  }
  return ids;
}

function allocateRelationId(existing) {
  let n = 1;
  while (existing.has(`n${n}`) || existing.has(`Item ${n}`)) n += 1;
  return `n${n}`;
}

function addRelationNode(source, fromId, label) {
  const doc = parseRelationDoc(source);
  if (!doc) return fail('not-graph');
  const from = findRelationNode(doc, fromId);
  if (!from) return fail('missing');
  const ids = collectRelationIds(doc);
  const newId = allocateRelationId(ids);
  const text = String(label || '').trim() || newId;
  const next = [...doc.lines];
  const itemIndent =
    doc.nodes.itemIndent > 0
      ? ' '.repeat(doc.nodes.itemIndent)
      : `${indentChars(doc.lines[doc.nodes.fieldLine])}  `;
  const attrIndent = `${itemIndent}  `;
  const linkEdges = infographicGraphAllowsLink(source);
  const nodeLines = linkEdges
    ? [`${itemIndent}- id ${newId}`, `${attrIndent}label ${text}`]
    : [`${itemIndent}- label ${text}`];
  next.splice(doc.nodes.end, 0, ...nodeLines);

  if (linkEdges) {
    const fromRef = nodeRef(from);
    const edgeLine = `${itemIndent}${fromRef} -> ${newId}`;
    if (doc.relations.fieldLine >= 0) {
      const insertAt =
        doc.relations.end + (doc.nodes.end <= doc.relations.fieldLine ? nodeLines.length : 0);
      next.splice(insertAt, 0, edgeLine);
    } else {
      const relIndent = indentChars(doc.lines[doc.nodes.fieldLine]);
      const insertAt = doc.nodes.end + nodeLines.length;
      next.splice(insertAt, 0, `${relIndent}relations`, edgeLine);
    }
  }
  return ok(joinLines(source, next), {
    newId: String(doc.nodes.items.length),
    newLabel: text
  });
}

function connectRelationNodes(source, fromId, toId) {
  const doc = parseRelationDoc(source);
  if (!doc) return fail('not-graph');
  const from = findRelationNode(doc, fromId);
  const to = findRelationNode(doc, toId);
  if (!from || !to) return fail('missing');
  if (from === to) return fail('self');
  const fromRef = nodeRef(from);
  const toRef = nodeRef(to);
  const duplicate = doc.relations.edges.some(
    (edge) =>
      (edge.from === fromRef || edge.from === from.id || edge.from === from.label) &&
      (edge.to === toRef || edge.to === to.id || edge.to === to.label)
  );
  if (duplicate) return fail('duplicate');
  const next = [...doc.lines];
  const itemIndent =
    doc.nodes.itemIndent > 0
      ? ' '.repeat(doc.nodes.itemIndent)
      : `${indentChars(doc.lines[doc.nodes.fieldLine])}  `;
  const edgeLine = `${itemIndent}${fromRef} -> ${toRef}`;
  if (doc.relations.fieldLine >= 0) {
    next.splice(doc.relations.end, 0, edgeLine);
  } else {
    const relIndent = indentChars(doc.lines[doc.nodes.fieldLine]);
    next.splice(doc.nodes.end, 0, `${relIndent}relations`, edgeLine);
  }
  return ok(joinLines(source, next));
}

function mentionsNode(edge, node) {
  const keys = [node.id, node.label, node.path].filter(Boolean);
  return keys.includes(edge.from) || keys.includes(edge.to);
}

function deleteRelationNode(source, nodeId) {
  const doc = parseRelationDoc(source);
  if (!doc) return fail('not-graph');
  const node = findRelationNode(doc, nodeId);
  if (!node) return fail('missing');
  if (doc.nodes.items.length <= 1) return fail('last');
  const dropLines = new Set();
  for (let i = node.start; i < node.end; i += 1) dropLines.add(i);
  for (const edge of doc.relations.edges) {
    if (mentionsNode(edge, node)) dropLines.add(edge.line);
  }
  const next = doc.lines.filter((_, i) => !dropLines.has(i));
  return ok(joinLines(source, next));
}

function renameRelationNode(source, nodeId, label) {
  const doc = parseRelationDoc(source);
  if (!doc) return fail('not-graph');
  const node = findRelationNode(doc, nodeId);
  if (!node) return fail('missing');
  const previous = node.label;
  let next = setLabelOnSpan(doc.lines, node, label);
  if (!node.id && previous && previous !== label) {
    next = next.map((line) => {
      const parsed = parseRelationLine(line.trim().replace(/^- /, ''));
      if (!parsed) return line;
      const from = parsed.from === previous ? label : parsed.from;
      const to = parsed.to === previous ? label : parsed.to;
      if (from === parsed.from && to === parsed.to) return line;
      const mid = parsed.label ? ` - ${parsed.label} -> ` : ' -> ';
      return `${indentChars(line)}${line.trim().startsWith('- ') ? '- ' : ''}${from}${mid}${to}`;
    });
  }
  return ok(joinLines(source, next));
}

function deleteRelationEdge(source, fromId, toId) {
  const doc = parseRelationDoc(source);
  if (!doc) return fail('not-graph');
  const from = findRelationNode(doc, fromId);
  const to = findRelationNode(doc, toId);
  if (!from || !to) return fail('missing');
  const fromKeys = new Set([from.id, from.label, from.path].filter(Boolean));
  const toKeys = new Set([to.id, to.label, to.path].filter(Boolean));
  const hit = doc.relations.edges.find((edge) => fromKeys.has(edge.from) && toKeys.has(edge.to));
  if (!hit) return fail('missing');
  const next = [...doc.lines];
  next.splice(hit.line, 1);
  return ok(joinLines(source, next));
}

function parseListDoc(source) {
  const template = readInfographicTemplate(source);
  const field = listArrayFieldForTemplate(template);
  if (!field) return null;
  const lines = String(source ?? '').split(/\r?\n/);
  const block = parseArrayItems(lines, field);
  if (!block) return null;
  return { lines, field, ...block };
}

function findListItem(doc, id) {
  const parsed = parseInfographicGraphId(id);
  if (parsed.indexes) {
    const path = indexPathOf(parsed.indexes);
    const hit = doc.items.find((item) => item.path === path);
    if (hit) return hit;
  }
  const key = parsed.label || String(id ?? '').trim();
  return (
    doc.items.find((item) => item.label === key || item.id === key || item.path === key) ?? null
  );
}

function collectListLabels(doc) {
  const labels = new Set();
  for (const item of doc.items) {
    if (item.label) labels.add(item.label);
  }
  return labels;
}

function listItemIndent(doc) {
  return doc.itemIndent > 0
    ? ' '.repeat(doc.itemIndent)
    : `${indentChars(doc.lines[doc.fieldLine])}  `;
}

function addListSibling(source, fromId, label) {
  const doc = parseListDoc(source);
  if (!doc) return fail('not-graph');
  const item = findListItem(doc, fromId);
  if (!item) return fail('missing');
  const template = readInfographicTemplate(source);
  const labelKey = flatItemLabelKey(template);
  const defaults = flatItemDefaultAttrs(template);
  const text = String(label || '').trim() || allocateLabel(collectListLabels(doc));
  const next = [...doc.lines];
  const itemPad = listItemIndent(doc);
  const insertLines = [`${itemPad}- ${labelKey} ${text}`];
  if (defaults) {
    const attrPad = `${itemPad}  `;
    for (const [key, value] of Object.entries(defaults)) {
      insertLines.push(`${attrPad}${key} ${value}`);
    }
  }
  next.splice(item.end, 0, ...insertLines);
  const newIndex = Number.parseInt(item.path, 10) + 1;
  return ok(joinLines(source, next), { newId: String(newIndex), newLabel: text });
}

function deleteListItem(source, nodeId) {
  const doc = parseListDoc(source);
  if (!doc) return fail('not-graph');
  const item = findListItem(doc, nodeId);
  if (!item) return fail('missing');
  if (doc.items.length <= 1) return fail('last');
  const next = [...doc.lines];
  next.splice(item.start, item.end - item.start);
  return ok(joinLines(source, next));
}

function renameListItem(source, nodeId, label) {
  const doc = parseListDoc(source);
  if (!doc) return fail('not-graph');
  const item = findListItem(doc, nodeId);
  if (!item) return fail('missing');
  const labelKey = flatItemLabelKey(readInfographicTemplate(source));
  return ok(joinLines(source, setLabelOnSpan(doc.lines, item, label, labelKey)));
}

export const __internal = {
  parseHierarchyTree,
  parseRelationDoc,
  parseListDoc
};
