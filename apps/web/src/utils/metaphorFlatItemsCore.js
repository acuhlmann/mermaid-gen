/**
 * Shared parse/serialize/helpers for Metaphor3D flat `items[]` scenes (city, garden, …).
 * Each kind keeps its own mutator module and adapter row — identity and defaults differ.
 */

export function fail(reason) {
  return { ok: false, reason };
}

export function ok(source, extra = {}) {
  return { ok: true, source, ...extra };
}

/**
 * @param {string} source
 * @param {string} metaphor
 * @returns {boolean}
 */
export function isMetaphorFlatSource(source, metaphor) {
  try {
    const doc = JSON.parse(String(source ?? '').trim());
    return doc?.metaphor === metaphor && Array.isArray(doc.items);
  } catch {
    return false;
  }
}

/**
 * @param {string} source
 * @param {string} metaphor
 * @returns {Record<string, unknown> | null}
 */
export function parseMetaphorFlatDoc(source, metaphor) {
  if (!isMetaphorFlatSource(source, metaphor)) return null;
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
export function serializeMetaphorFlatDoc(doc, source) {
  const text = JSON.stringify(doc, null, 2);
  return String(source).endsWith('\n') ? `${text}\n` : text;
}

/**
 * @param {Record<string, unknown>} doc
 * @returns {Map<string, Record<string, unknown>>}
 */
export function itemsById(doc) {
  const map = new Map();
  for (const item of doc.items) {
    if (item && typeof item === 'object' && typeof item.id === 'string') {
      map.set(item.id, item);
    }
  }
  return map;
}

/**
 * @param {Record<string, unknown>} doc
 */
export function allocateFlatItemId(doc) {
  const ids = itemsById(doc);
  let n = 1;
  while (ids.has(`n${n}`)) n += 1;
  return `n${n}`;
}

/**
 * @param {Record<string, unknown>} doc
 */
export function allocateFlatItemLabel(doc) {
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

/**
 * @param {Record<string, unknown>} doc
 * @param {string} afterId
 * @param {Record<string, unknown>} newItem
 * @returns {number | null} index of inserted item
 */
export function insertSiblingAfter(doc, afterId, newItem) {
  const items = doc.items;
  if (!Array.isArray(items)) return null;
  const index = items.findIndex((item) => item && typeof item === 'object' && item.id === afterId);
  const insertAt = index >= 0 ? index + 1 : items.length;
  items.splice(insertAt, 0, newItem);
  return insertAt;
}

/**
 * @param {Record<string, unknown>} doc
 * @param {string} nodeId
 */
export function purgeLinksForNode(doc, nodeId) {
  if (!Array.isArray(doc.links)) {
    doc.links = [];
    return;
  }
  doc.links = doc.links.filter((link) => {
    if (!link || typeof link !== 'object') return false;
    if (link.from === nodeId || link.to === nodeId) return false;
    return true;
  });
}

/**
 * @param {Record<string, unknown>} doc
 * @param {string} fromId
 * @param {string} toId
 */
export function hasDirectedLink(doc, fromId, toId) {
  if (!Array.isArray(doc.links)) return false;
  return doc.links.some(
    (link) => link && typeof link === 'object' && link.from === fromId && link.to === toId
  );
}

/**
 * @param {Record<string, unknown>} doc
 * @param {string} fromId
 * @param {string} toId
 */
export function appendLink(doc, fromId, toId) {
  if (!Array.isArray(doc.links)) doc.links = [];
  doc.links.push({ from: fromId, to: toId });
}
