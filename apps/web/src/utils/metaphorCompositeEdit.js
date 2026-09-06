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
  purgeLinksForNode,
  renameLinkedEdge
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
import { COMPOSITE_MAX_LAYERS } from '@archislop/shared';

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

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 * @param {string} label new link label; empty clears it
 */
export function renameCompositeEdge(source, fromId, toId, label) {
  const doc = parseCompositeDoc(source);
  if (!doc) return fail('not-graph');
  return renameLinkedEdge(doc, source, fromId, toId, label);
}

/**
 * Allocate a fresh item id against a running set of taken ids.
 *
 * `n<k>` is the same scheme the per-item path uses, but taken GLOBALLY rather
 * than per-layer: a copy that reused an existing id would not render as a second
 * object, it would be an ambiguous one, and `findLayerForItem` resolves an item
 * to the FIRST layer holding its id — so every edit aimed at the copy would land
 * on the original instead.
 */
function allocateFreshItemId(taken) {
  let n = 1;
  while (taken.has(`n${n}`)) n += 1;
  const id = `n${n}`;
  taken.add(id);
  return id;
}

/**
 * Deep-copy a layer's items with brand-new ids, keeping the copies internally
 * connected.
 *
 * The remap visits every value except an item's own `id` and `label`: a tree
 * node's `parent`, a city item's `links[]` and any other reference field are
 * per-kind, and this module must not learn their names — so anything that
 * pointed at a copied item is re-pointed at that item's copy. `label` is
 * excluded because prose is allowed to spell an id and is not a reference.
 */
function cloneItemsWithFreshIds(items, doc) {
  const taken = globalItemIds(doc);
  const remap = new Map();
  const clones = items.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const copy = { ...item };
    if (typeof copy.id === 'string') {
      const previous = copy.id;
      copy.id = allocateFreshItemId(taken);
      remap.set(previous, copy.id);
    }
    return copy;
  });
  for (const copy of clones) {
    if (!copy || typeof copy !== 'object') continue;
    for (const key of Object.keys(copy)) {
      if (key === 'id' || key === 'label') continue;
      const value = copy[key];
      if (typeof value === 'string' && remap.has(value)) {
        copy[key] = remap.get(value);
      } else if (Array.isArray(value)) {
        copy[key] = value.map((entry) =>
          typeof entry === 'string' && remap.has(entry) ? remap.get(entry) : entry
        );
      }
    }
  }
  return clones;
}

/** A layer id not already used by another layer of this document. */
function allocateLayerId(doc) {
  const used = new Set(doc.layers.map((layer) => (typeof layer.id === 'string' ? layer.id : '')));
  let n = doc.layers.length + 1;
  while (used.has(`layer-${n}`)) n += 1;
  return `layer-${n}`;
}

/**
 * Duplicate one of the scene's layers — a whole grammar, not just an item.
 *
 * Composite's Add has always resolved its target through `findLayerForItem`, so
 * the anchor had to be an existing item and every Add therefore grew a layer that
 * already had one. A scene authored with three layers could never gain a fourth,
 * and a kind missing from `layers[]` could never appear at all (#536).
 *
 * Seeding is by DUPLICATION, on the owner's decision, because a layer with
 * `items: []` is worse than no layer: it is unselectable (the bridge emits one
 * descriptor per item, and there are none) and un-growable (`addLinked` needs an
 * `afterId` inside the layer, so there is nothing to anchor a first item to).
 * Cloning also makes the copy valid for its kind by construction — this repo has
 * no per-kind item template table, and inventing one would duplicate
 * required-field knowledge that already lives in `metaphorSchema.ts`.
 *
 * The limitation is real and deliberate: you can only add MORE of a kind the
 * scene already has.
 *
 * @param {string} source
 * @param {number} layerIndex the layer to duplicate; the copy is inserted after it
 */
export function addCompositeLayer(source, layerIndex) {
  const doc = parseCompositeDoc(source);
  if (!doc) return fail('not-graph');
  const index = Number(layerIndex);
  if (!Number.isInteger(index) || index < 0 || index >= doc.layers.length) {
    return fail('missing');
  }
  if (doc.layers.length >= COMPOSITE_MAX_LAYERS) return fail('capacity');

  const origin = doc.layers[index];
  const copy = {
    id: allocateLayerId(doc),
    as: origin.as,
    items: cloneItemsWithFreshIds(Array.isArray(origin.items) ? origin.items : [], doc)
  };
  if (typeof origin.label === 'string') copy.label = origin.label;

  doc.layers.splice(index + 1, 0, copy);
  return ok(serializeCompositeDoc(doc, source), {
    newLayerId: copy.id,
    metaphorKind: copy.as,
    copiedItemCount: copy.items.length
  });
}

/**
 * Remove a whole layer and every top-level relation that touched it.
 *
 * There was no verb for this at all (#536). Per-item Delete can SHRINK a layer
 * but never retire it: each kind's delegate refuses its last item, so a layer
 * bottoms out at one item and stays — still holding its share of the fused
 * plan's layout area, still drawing a placard, with no way to get rid of it.
 * (The `{ as, items: [] }` husk this issue described as the symptom is not
 * reachable for city/tree/garden for exactly that reason; verified rather than
 * assumed.) Its links go the way `deleteCompositeNode` already handles them per
 * item, applied to each former member.
 *
 * Refusing the last layer is not a preference: `CompositeMetaphorSchema`
 * declares `layers.min(1)`, so removing it yields a document the validator
 * rejects — and an agent cannot write its way out of that.
 *
 * @param {string} source
 * @param {number} layerIndex
 */
export function removeCompositeLayer(source, layerIndex) {
  const doc = parseCompositeDoc(source);
  if (!doc) return fail('not-graph');
  const index = Number(layerIndex);
  if (!Number.isInteger(index) || index < 0 || index >= doc.layers.length) {
    return fail('missing');
  }
  if (doc.layers.length <= 1) return fail('last');

  const [removed] = doc.layers.splice(index, 1);
  const removedIds = (Array.isArray(removed.items) ? removed.items : [])
    .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
    .map((item) => item.id);
  for (const id of removedIds) purgeLinksForNode(doc, id);

  return ok(serializeCompositeDoc(doc, source), {
    removedLayerId: typeof removed.id === 'string' ? removed.id : null,
    removedItemCount: removedIds.length
  });
}
