/**
 * Deterministic Add / Delete / Rename / Link for Metaphor3D city scenes.
 * Node identity is each item's `id`. Add inserts a sibling after the selection.
 */

import {
  allocateFlatItemId,
  allocateFlatItemLabel,
  appendLink,
  deleteLinkedEdge,
  fail,
  hasDirectedLink,
  insertSiblingAfter,
  isMetaphorFlatSource,
  itemsById,
  ok,
  parseMetaphorFlatDoc,
  purgeLinksForNode,
  renameLinkedEdge,
  serializeMetaphorFlatDoc
} from './metaphorFlatItemsCore.js';

const METAPHOR = 'city';

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isCityFamilySource(source) {
  return isMetaphorFlatSource(source, METAPHOR);
}

function requireCity(source) {
  if (!isCityFamilySource(source)) return fail('not-city');
  return null;
}

/**
 * @param {Record<string, unknown>} template
 * @param {string} id
 * @param {string} label
 */
function defaultCityItem(template, id, label) {
  const height = typeof template?.height === 'number' && template.height > 0 ? template.height : 10;
  const footprint =
    typeof template?.footprint === 'number' && template.footprint > 0 ? template.footprint : 2;
  const item = { id, label, height, footprint };
  if (typeof template?.district === 'string' && template.district.trim()) {
    item.district = template.district.trim();
  }
  return item;
}

/**
 * @param {string} source
 * @param {string} afterId
 * @param {string} [label]
 */
export function addLinkedCityNode(source, afterId, label = '') {
  const blocked = requireCity(source);
  if (blocked) return blocked;
  const doc = parseMetaphorFlatDoc(source, METAPHOR);
  if (!doc) return fail('not-graph');
  const ids = itemsById(doc);
  if (!ids.has(afterId)) return fail('missing');

  const newId = allocateFlatItemId(doc);
  const newLabel = String(label ?? '').trim() || allocateFlatItemLabel(doc);
  const template = ids.get(afterId);
  const newItem = defaultCityItem(template, newId, newLabel);
  insertSiblingAfter(doc, afterId, newItem);
  return ok(serializeMetaphorFlatDoc(doc, source), { newId, newLabel });
}

/**
 * @param {string} source
 * @param {string} nodeId
 */
export function deleteCityNode(source, nodeId) {
  const blocked = requireCity(source);
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
export function renameCityNode(source, nodeId, label) {
  const blocked = requireCity(source);
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

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 */
export function connectCityNodes(source, fromId, toId) {
  const blocked = requireCity(source);
  if (blocked) return blocked;
  const doc = parseMetaphorFlatDoc(source, METAPHOR);
  if (!doc) return fail('not-graph');
  const ids = itemsById(doc);
  if (!ids.has(fromId) || !ids.has(toId)) return fail('missing');
  if (fromId === toId) return fail('self');
  if (hasDirectedLink(doc, fromId, toId)) return fail('duplicate');
  appendLink(doc, fromId, toId);
  return ok(serializeMetaphorFlatDoc(doc, source));
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 */
export function deleteCityEdge(source, fromId, toId) {
  const blocked = requireCity(source);
  if (blocked) return blocked;
  const doc = parseMetaphorFlatDoc(source, METAPHOR);
  if (!doc) return fail('not-graph');
  return deleteLinkedEdge(doc, source, fromId, toId);
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 * @param {string} label new link label; empty clears it
 */
export function renameCityEdge(source, fromId, toId, label) {
  const blocked = requireCity(source);
  if (blocked) return blocked;
  const doc = parseMetaphorFlatDoc(source, METAPHOR);
  if (!doc) return fail('not-graph');
  return renameLinkedEdge(doc, source, fromId, toId, label);
}
