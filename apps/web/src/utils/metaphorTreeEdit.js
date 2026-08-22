/**
 * Deterministic Add / Delete / Rename for Metaphor3D tree scenes (`metaphor: "tree"`).
 * Parentage is the edge — Link stays off. Node identity is each item's `id`.
 */

function fail(reason) {
  return { ok: false, reason };
}

function ok(source, extra = {}) {
  return { ok: true, source, ...extra };
}

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isTreeFamilySource(source) {
  try {
    const doc = JSON.parse(String(source ?? '').trim());
    return doc?.metaphor === 'tree' && Array.isArray(doc.items);
  } catch {
    return false;
  }
}

/**
 * @param {string} source
 * @returns {Record<string, unknown> | null}
 */
function parseTreeDoc(source) {
  if (!isTreeFamilySource(source)) return null;
  try {
    return JSON.parse(String(source ?? '').trim());
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>} doc
 * @param {string} source
 */
function serializeTreeDoc(doc, source) {
  const text = JSON.stringify(doc, null, 2);
  return String(source).endsWith('\n') ? `${text}\n` : text;
}

/**
 * @param {Record<string, unknown>} doc
 * @returns {Map<string, Record<string, unknown>>}
 */
function itemsById(doc) {
  const map = new Map();
  for (const item of doc.items) {
    if (item && typeof item === 'object' && typeof item.id === 'string') {
      map.set(item.id, item);
    }
  }
  return map;
}

/**
 * Root nodes have no parent, or a parent id that is not present in the scene.
 * @param {Record<string, unknown>} doc
 * @returns {string[]}
 */
function rootIds(doc) {
  const ids = itemsById(doc);
  const roots = [];
  for (const [id, item] of ids) {
    const parent = item.parent;
    if (typeof parent !== 'string' || !ids.has(parent)) {
      roots.push(id);
    }
  }
  return roots;
}

/**
 * @param {Record<string, unknown>} doc
 * @param {string} id
 * @returns {boolean}
 */
function isTreeRoot(doc, id) {
  return rootIds(doc).includes(id);
}

/**
 * @param {Record<string, unknown>} doc
 * @param {string} id
 * @returns {Set<string>}
 */
function collectDescendants(doc, id) {
  const byParent = new Map();
  for (const [itemId, item] of itemsById(doc)) {
    const parent = item.parent;
    if (typeof parent !== 'string') continue;
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(itemId);
  }
  const out = new Set();
  const stack = [...(byParent.get(id) ?? [])];
  while (stack.length) {
    const cur = stack.pop();
    if (out.has(cur)) continue;
    out.add(cur);
    stack.push(...(byParent.get(cur) ?? []));
  }
  return out;
}

/**
 * @param {Record<string, unknown>} doc
 */
function allocateTreeId(doc) {
  const ids = itemsById(doc);
  let n = 1;
  while (ids.has(`n${n}`)) n += 1;
  return `n${n}`;
}

/**
 * @param {Record<string, unknown>} doc
 */
function allocateTreeLabel(doc) {
  const labels = new Set();
  for (const item of itemsById(doc).values()) {
    if (typeof item.label === 'string' && item.label.trim()) {
      labels.add(item.label.trim());
    }
  }
  let n = 1;
  while (labels.has(`Item ${n}`)) n += 1;
  return `Item ${n}`;
}

function requireTree(source) {
  if (!isTreeFamilySource(source)) return fail('not-tree');
  return null;
}

/**
 * @param {string} source
 * @param {string} parentId
 * @param {string} [label]
 */
export function addLinkedTreeNode(source, parentId, label = '') {
  const blocked = requireTree(source);
  if (blocked) return blocked;
  const doc = parseTreeDoc(source);
  if (!doc) return fail('not-graph');
  const ids = itemsById(doc);
  if (!ids.has(parentId)) return fail('missing');

  const newId = allocateTreeId(doc);
  const newLabel = String(label ?? '').trim() || allocateTreeLabel(doc);
  doc.items.push({
    id: newId,
    label: newLabel,
    parent: parentId,
    weight: 3
  });
  return ok(serializeTreeDoc(doc, source), { newId, newLabel });
}

/**
 * @param {string} source
 * @param {string} nodeId
 */
export function deleteTreeNode(source, nodeId) {
  const blocked = requireTree(source);
  if (blocked) return blocked;
  const doc = parseTreeDoc(source);
  if (!doc) return fail('not-graph');
  const ids = itemsById(doc);
  if (!ids.has(nodeId)) return fail('missing');
  if (isTreeRoot(doc, nodeId)) return fail('root');

  const remove = new Set([nodeId, ...collectDescendants(doc, nodeId)]);
  doc.items = doc.items.filter(
    (item) =>
      !(item && typeof item === 'object' && typeof item.id === 'string' && remove.has(item.id))
  );
  if (Array.isArray(doc.links)) {
    doc.links = doc.links.filter((link) => {
      if (!link || typeof link !== 'object') return false;
      const from = link.from;
      const to = link.to;
      if (typeof from === 'string' && remove.has(from)) return false;
      if (typeof to === 'string' && remove.has(to)) return false;
      return true;
    });
  }
  return ok(serializeTreeDoc(doc, source));
}

/**
 * @param {string} source
 * @param {string} nodeId
 * @param {string} label
 */
export function renameTreeNode(source, nodeId, label) {
  const blocked = requireTree(source);
  if (blocked) return blocked;
  const doc = parseTreeDoc(source);
  if (!doc) return fail('not-graph');
  const item = itemsById(doc).get(nodeId);
  if (!item) return fail('missing');
  const next = String(label ?? '').trim();
  if (!next) return fail('empty');
  if (item.label === next) return ok(source);
  item.label = next;
  return ok(serializeTreeDoc(doc, source));
}

export function connectTreeNodes() {
  return fail('no-link');
}

export function deleteTreeEdge() {
  return fail('not-graph');
}

export function renameTreeEdge() {
  return fail('not-graph');
}
