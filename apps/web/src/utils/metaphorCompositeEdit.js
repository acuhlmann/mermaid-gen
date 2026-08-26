/**
 * Deterministic Add / Delete / Rename / Link for Metaphor3D composite scenes.
 * Each layer keeps its own `as` kind and item encoding; edits delegate to that
 * kind's mutator on a mini-document, then merge back. Cross-layer relations live
 * on the composite's top-level `links[]`.
 */

import {
  appendLink,
  fail,
  hasDirectedLink,
  ok,
  purgeLinksForNode
} from './metaphorFlatItemsCore.js';
import {
  addLinkedTreeNode,
  connectTreeNodes,
  deleteTreeEdge,
  deleteTreeNode,
  renameTreeEdge,
  renameTreeNode
} from './metaphorTreeEdit.js';
import {
  addLinkedCityNode,
  connectCityNodes,
  deleteCityEdge,
  deleteCityNode,
  renameCityEdge,
  renameCityNode
} from './metaphorCityEdit.js';
import {
  addLinkedGardenNode,
  connectGardenNodes,
  deleteGardenEdge,
  deleteGardenNode,
  renameGardenEdge,
  renameGardenNode
} from './metaphorGardenEdit.js';
import { METAPHOR_FLAT_GRAPH_EDIT_KINDS } from './metaphorFlatKindEdit.js';

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isCompositeFamilySource(source) {
  try {
    const doc = JSON.parse(String(source ?? '').trim());
    return (
      doc?.metaphor === 'composite' &&
      Array.isArray(doc.layers) &&
      doc.layers.length > 0 &&
      doc.layers.every(
        (layer) =>
          layer &&
          typeof layer === 'object' &&
          typeof layer.as === 'string' &&
          Array.isArray(layer.items)
      )
    );
  } catch {
    return false;
  }
}

/**
 * @param {string} source
 * @returns {Record<string, unknown> | null}
 */
function parseCompositeDoc(source) {
  if (!isCompositeFamilySource(source)) return null;
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
function serializeCompositeDoc(doc, source) {
  const text = JSON.stringify(doc, null, 2);
  return String(source).endsWith('\n') ? `${text}\n` : text;
}

/**
 * @param {Record<string, unknown>} doc
 * @param {number} [skipLayerIndex]
 * @returns {Set<string>}
 */
function globalItemIds(doc, skipLayerIndex = -1) {
  const ids = new Set();
  doc.layers.forEach((layer, index) => {
    if (index === skipLayerIndex) return;
    for (const item of layer.items ?? []) {
      if (item && typeof item === 'object' && typeof item.id === 'string') {
        ids.add(item.id);
      }
    }
  });
  return ids;
}

/**
 * @param {Record<string, unknown>} doc
 * @param {string} itemId
 * @returns {{ index: number, layer: Record<string, unknown> } | null}
 */
function findLayerForItem(doc, itemId) {
  for (let index = 0; index < doc.layers.length; index += 1) {
    const layer = doc.layers[index];
    if (layer.items?.some((item) => item && typeof item === 'object' && item.id === itemId)) {
      return { index, layer };
    }
  }
  return null;
}

/**
 * @param {Record<string, unknown>} layer
 */
function layerMiniSource(layer) {
  return JSON.stringify({
    metaphor: layer.as,
    scene: {},
    items: layer.items ?? [],
    links: []
  });
}

/**
 * @param {string} layerAs
 */
function layerDelegate(layerAs) {
  switch (layerAs) {
    case 'tree':
      return {
        addLinked: addLinkedTreeNode,
        deleteNode: deleteTreeNode,
        renameNode: renameTreeNode,
        connect: connectTreeNodes,
        deleteEdge: deleteTreeEdge,
        renameEdge: renameTreeEdge
      };
    case 'city':
      return {
        addLinked: addLinkedCityNode,
        deleteNode: deleteCityNode,
        renameNode: renameCityNode,
        connect: connectCityNodes,
        deleteEdge: deleteCityEdge,
        renameEdge: renameCityEdge
      };
    case 'garden':
      return {
        addLinked: addLinkedGardenNode,
        deleteNode: deleteGardenNode,
        renameNode: renameGardenNode,
        connect: connectGardenNodes,
        deleteEdge: deleteGardenEdge,
        renameEdge: renameGardenEdge
      };
    default: {
      const flat = METAPHOR_FLAT_GRAPH_EDIT_KINDS[layerAs];
      if (!flat) return null;
      return {
        addLinked: flat.addLinked,
        deleteNode: flat.deleteNode,
        renameNode: flat.renameNode,
        connect: flat.connect,
        deleteEdge: flat.deleteEdge,
        renameEdge: flat.renameEdge
      };
    }
  }
}

/**
 * @param {Record<string, unknown>} doc
 * @param {number} layerIndex
 * @param {string} itemId
 * @returns {string}
 */
function ensureGloballyUniqueId(doc, layerIndex, itemId) {
  const taken = globalItemIds(doc, layerIndex);
  if (!taken.has(itemId)) return itemId;
  const layer = doc.layers[layerIndex];
  const item = layer.items?.find((row) => row && typeof row === 'object' && row.id === itemId);
  if (!item) return itemId;
  let n = 1;
  const all = globalItemIds(doc);
  while (all.has(`n${n}`)) n += 1;
  item.id = `n${n}`;
  return `n${n}`;
}

/**
 * @param {string} source
 * @returns {boolean}
 */
export function compositeGraphAllowsLink(source) {
  const doc = parseCompositeDoc(source);
  if (!doc) return false;
  const count = doc.layers.reduce((total, layer) => total + (layer.items?.length ?? 0), 0);
  return count >= 2;
}

/**
 * @param {string} source
 * @param {string} afterId
 * @param {string} [label]
 */
export function addLinkedCompositeNode(source, afterId, label = '') {
  const doc = parseCompositeDoc(source);
  if (!doc) return fail('not-graph');
  const found = findLayerForItem(doc, afterId);
  if (!found) return fail('missing');
  const delegate = layerDelegate(found.layer.as);
  if (!delegate) return fail('not-graph');

  const result = delegate.addLinked(layerMiniSource(found.layer), afterId, label);
  if (!result.ok) return result;

  const miniDoc = JSON.parse(result.source);
  found.layer.items = miniDoc.items;
  let newId = result.newId;
  if (typeof newId === 'string') {
    newId = ensureGloballyUniqueId(doc, found.index, newId);
  }
  return ok(serializeCompositeDoc(doc, source), {
    newId,
    newLabel: result.newLabel,
    metaphorKind: found.layer.as
  });
}

/**
 * @param {string} source
 * @param {string} nodeId
 */
export function deleteCompositeNode(source, nodeId) {
  const doc = parseCompositeDoc(source);
  if (!doc) return fail('not-graph');
  const found = findLayerForItem(doc, nodeId);
  if (!found) return fail('missing');
  const delegate = layerDelegate(found.layer.as);
  if (!delegate) return fail('not-graph');

  const beforeIds = new Set(
    (found.layer.items ?? [])
      .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
      .map((item) => item.id)
  );
  const result = delegate.deleteNode(layerMiniSource(found.layer), nodeId);
  if (!result.ok) return result;

  const miniDoc = JSON.parse(result.source);
  found.layer.items = miniDoc.items;
  const afterIds = new Set(
    (found.layer.items ?? [])
      .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
      .map((item) => item.id)
  );
  for (const id of beforeIds) {
    if (!afterIds.has(id)) purgeLinksForNode(doc, id);
  }
  return ok(serializeCompositeDoc(doc, source), { metaphorKind: found.layer.as });
}

/**
 * @param {string} source
 * @param {string} nodeId
 * @param {string} label
 */
export function renameCompositeNode(source, nodeId, label) {
  const doc = parseCompositeDoc(source);
  if (!doc) return fail('not-graph');
  const found = findLayerForItem(doc, nodeId);
  if (!found) return fail('missing');
  const delegate = layerDelegate(found.layer.as);
  if (!delegate) return fail('not-graph');

  const result = delegate.renameNode(layerMiniSource(found.layer), nodeId, label);
  if (!result.ok) return result;
  found.layer.items = JSON.parse(result.source).items;
  return ok(serializeCompositeDoc(doc, source), { metaphorKind: found.layer.as });
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 */
export function connectCompositeNodes(source, fromId, toId) {
  if (!compositeGraphAllowsLink(source)) return fail('no-link');
  const doc = parseCompositeDoc(source);
  if (!doc) return fail('not-graph');
  const ids = globalItemIds(doc);
  if (!ids.has(fromId) || !ids.has(toId)) return fail('missing');
  if (fromId === toId) return fail('self');
  if (hasDirectedLink(doc, fromId, toId)) return fail('duplicate');
  appendLink(doc, fromId, toId);
  return ok(serializeCompositeDoc(doc, source));
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 */
export function deleteCompositeEdge(source, fromId, toId) {
  const doc = parseCompositeDoc(source);
  if (!doc) return fail('not-graph');
  if (!Array.isArray(doc.links)) return fail('missing');
  const before = doc.links.length;
  doc.links = doc.links.filter(
    (link) => !(link && typeof link === 'object' && link.from === fromId && link.to === toId)
  );
  if (doc.links.length === before) return fail('missing');
  return ok(serializeCompositeDoc(doc, source));
}

export function renameCompositeEdge() {
  return fail('not-graph');
}
