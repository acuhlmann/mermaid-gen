/**
 * Deterministic Add / Delete / Rename for Metaphor3D garden scenes.
 * Node identity is each item's `id`. Link stays off — bed grouping is not an edge graph.
 */

import {
  allocateFlatItemId,
  allocateFlatItemLabel,
  fail,
  insertSiblingAfter,
  isMetaphorFlatSource,
  itemsById,
  ok,
  parseMetaphorFlatDoc,
  purgeLinksForNode,
  serializeMetaphorFlatDoc
} from './metaphorFlatItemsCore.js';

const METAPHOR = 'garden';

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isGardenFamilySource(source) {
  return isMetaphorFlatSource(source, METAPHOR);
}

function requireGarden(source) {
  if (!isGardenFamilySource(source)) return fail('not-garden');
  return null;
}

/**
 * @param {Record<string, unknown>} template
 * @param {string} id
 * @param {string} label
 */
function defaultGardenItem(template, id, label) {
  const maturity = typeof template?.maturity === 'number' ? template.maturity : 0.5;
  const impact = typeof template?.impact === 'number' && template.impact > 0 ? template.impact : 3;
  const health =
    template?.health === 'thriving' ||
    template?.health === 'steady' ||
    template?.health === 'at-risk'
      ? template.health
      : 'steady';
  const item = { id, label, maturity, impact, health };
  if (typeof template?.bed === 'string' && template.bed.trim()) {
    item.bed = template.bed.trim();
  }
  return item;
}

/**
 * @param {string} source
 * @param {string} afterId
 * @param {string} [label]
 */
export function addLinkedGardenNode(source, afterId, label = '') {
  const blocked = requireGarden(source);
  if (blocked) return blocked;
  const doc = parseMetaphorFlatDoc(source, METAPHOR);
  if (!doc) return fail('not-graph');
  const ids = itemsById(doc);
  if (!ids.has(afterId)) return fail('missing');

  const newId = allocateFlatItemId(doc);
  const newLabel = String(label ?? '').trim() || allocateFlatItemLabel(doc);
  const template = ids.get(afterId);
  const newItem = defaultGardenItem(template, newId, newLabel);
  insertSiblingAfter(doc, afterId, newItem);
  return ok(serializeMetaphorFlatDoc(doc, source), { newId, newLabel });
}

/**
 * @param {string} source
 * @param {string} nodeId
 */
export function deleteGardenNode(source, nodeId) {
  const blocked = requireGarden(source);
  if (blocked) return blocked;
  const doc = parseMetaphorFlatDoc(source, METAPHOR);
  if (!doc) return fail('not-graph');
  const ids = itemsById(doc);
  if (!ids.has(nodeId)) return fail('missing');
  if (doc.items.length <= 1) return fail('last');

  doc.items = doc.items.filter((item) => !(item && typeof item === 'object' && item.id === nodeId));
  purgeLinksForNode(doc, nodeId);
  return ok(serializeMetaphorFlatDoc(doc, source));
}

/**
 * @param {string} source
 * @param {string} nodeId
 * @param {string} label
 */
export function renameGardenNode(source, nodeId, label) {
  const blocked = requireGarden(source);
  if (blocked) return blocked;
  const doc = parseMetaphorFlatDoc(source, METAPHOR);
  if (!doc) return fail('not-graph');
  const item = itemsById(doc).get(nodeId);
  if (!item) return fail('missing');
  const next = String(label ?? '').trim();
  if (!next) return fail('empty');
  if (item.label === next) return ok(source);
  item.label = next;
  return ok(serializeMetaphorFlatDoc(doc, source));
}

export function connectGardenNodes() {
  return fail('no-link');
}

export function deleteGardenEdge() {
  return fail('not-graph');
}

export function renameGardenEdge() {
  return fail('not-graph');
}
