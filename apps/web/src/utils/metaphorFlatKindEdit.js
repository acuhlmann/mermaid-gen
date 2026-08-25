/**
 * Parameterized Add / Delete / Rename / Link for Metaphor3D flat `items[]` scenes
 * beyond city and garden (which keep dedicated modules). Each kind declares its
 * default-item clone shape and whether free `links[]` edits are meaningful.
 */

import {
  allocateFlatItemId,
  allocateFlatItemLabel,
  appendLink,
  fail,
  hasDirectedLink,
  insertSiblingAfter,
  isMetaphorFlatSource,
  itemsById,
  ok,
  parseMetaphorFlatDoc,
  purgeLinksForNode,
  serializeMetaphorFlatDoc
} from './metaphorFlatItemsCore.js';

/** @typedef {(template: Record<string, unknown> | undefined, id: string, label: string) => Record<string, unknown>} DefaultItemFn */

/**
 * @param {string} metaphor
 * @param {string} rejectReason
 * @param {DefaultItemFn} defaultItem
 * @param {boolean} canLink
 */
export function createMetaphorFlatGraphEdit(metaphor, rejectReason, defaultItem, canLink) {
  function requireKind(source) {
    if (!isMetaphorFlatSource(source, metaphor)) return fail(rejectReason);
    return null;
  }

  function isFamilySource(source) {
    return isMetaphorFlatSource(source, metaphor);
  }

  function addLinked(source, afterId, label = '') {
    const blocked = requireKind(source);
    if (blocked) return blocked;
    const doc = parseMetaphorFlatDoc(source, metaphor);
    if (!doc) return fail('not-graph');
    const ids = itemsById(doc);
    if (!ids.has(afterId)) return fail('missing');

    const newId = allocateFlatItemId(doc);
    const newLabel = String(label ?? '').trim() || allocateFlatItemLabel(doc);
    const template = ids.get(afterId);
    const newItem = defaultItem(template, newId, newLabel);
    insertSiblingAfter(doc, afterId, newItem);
    return ok(serializeMetaphorFlatDoc(doc, source), { newId, newLabel });
  }

  function deleteNode(source, nodeId) {
    const blocked = requireKind(source);
    if (blocked) return blocked;
    const doc = parseMetaphorFlatDoc(source, metaphor);
    if (!doc) return fail('not-graph');
    const ids = itemsById(doc);
    if (!ids.has(nodeId)) return fail('missing');
    if (doc.items.length <= 1) return fail('last');

    doc.items = doc.items.filter(
      (item) => !(item && typeof item === 'object' && item.id === nodeId)
    );
    purgeLinksForNode(doc, nodeId);
    return ok(serializeMetaphorFlatDoc(doc, source));
  }

  function renameNode(source, nodeId, label) {
    const blocked = requireKind(source);
    if (blocked) return blocked;
    const doc = parseMetaphorFlatDoc(source, metaphor);
    if (!doc) return fail('not-graph');
    const item = itemsById(doc).get(nodeId);
    if (!item) return fail('missing');
    const next = String(label ?? '').trim();
    if (!next) return fail('empty');
    if (item.label === next) return ok(source);
    item.label = next;
    return ok(serializeMetaphorFlatDoc(doc, source));
  }

  function connect(source, fromId, toId) {
    if (!canLink) return fail('no-link');
    const blocked = requireKind(source);
    if (blocked) return blocked;
    const doc = parseMetaphorFlatDoc(source, metaphor);
    if (!doc) return fail('not-graph');
    const ids = itemsById(doc);
    if (!ids.has(fromId) || !ids.has(toId)) return fail('missing');
    if (fromId === toId) return fail('self');
    if (hasDirectedLink(doc, fromId, toId)) return fail('duplicate');
    appendLink(doc, fromId, toId);
    return ok(serializeMetaphorFlatDoc(doc, source));
  }

  function deleteEdge(source, fromId, toId) {
    if (!canLink) return fail('not-graph');
    const blocked = requireKind(source);
    if (blocked) return blocked;
    const doc = parseMetaphorFlatDoc(source, metaphor);
    if (!doc) return fail('not-graph');
    if (!Array.isArray(doc.links)) return fail('missing');
    const before = doc.links.length;
    doc.links = doc.links.filter(
      (link) => !(link && typeof link === 'object' && link.from === fromId && link.to === toId)
    );
    if (doc.links.length === before) return fail('missing');
    return ok(serializeMetaphorFlatDoc(doc, source));
  }

  function renameEdge() {
    return fail('not-graph');
  }

  function connectNodes(source, fromId, toId) {
    return connect(source, fromId, toId);
  }

  return {
    metaphor,
    canLink,
    isFamilySource,
    addLinked,
    deleteNode,
    renameNode,
    connect: connectNodes,
    deleteEdge,
    renameEdge
  };
}

function copyOptionalString(template, key, item) {
  if (typeof template?.[key] === 'string' && template[key].trim()) {
    item[key] = template[key].trim();
  }
}

function copyOptionalNumber(template, key, item) {
  if (typeof template?.[key] === 'number' && !Number.isNaN(template[key])) {
    item[key] = template[key];
  }
}

function positiveNumber(template, key, fallback) {
  return typeof template?.[key] === 'number' && template[key] > 0 ? template[key] : fallback;
}

function boundedNumber(template, key, min, max, fallback) {
  const value = template?.[key];
  if (typeof value === 'number' && value >= min && value <= max) return value;
  return fallback;
}

/** @type {Record<string, ReturnType<typeof createMetaphorFlatGraphEdit>>} */
export const METAPHOR_FLAT_GRAPH_EDIT_KINDS = {
  layercake: createMetaphorFlatGraphEdit(
    'layercake',
    'not-layercake',
    (template, id, label) => {
      const item = {
        id,
        label,
        thickness: positiveNumber(template, 'thickness', 1),
        components: Array.isArray(template?.components) ? [...template.components] : []
      };
      copyOptionalNumber(template, 'cracks', item);
      copyOptionalNumber(template, 'tilt', item);
      return item;
    },
    true
  ),
  galaxy: createMetaphorFlatGraphEdit(
    'galaxy',
    'not-galaxy',
    (template, id, label) => {
      const item = { id, label, magnitude: positiveNumber(template, 'magnitude', 5) };
      copyOptionalString(template, 'cluster', item);
      copyOptionalString(template, 'binary', item);
      return item;
    },
    true
  ),
  machine: createMetaphorFlatGraphEdit(
    'machine',
    'not-machine',
    (template, id, label) => {
      const item = {
        id,
        label,
        size: positiveNumber(template, 'size', 3),
        speed: boundedNumber(template, 'speed', 0, 10, 3)
      };
      copyOptionalString(template, 'axle', item);
      copyOptionalNumber(template, 'torque', item);
      copyOptionalString(template, 'mesh', item);
      return item;
    },
    true
  ),
  terrain: createMetaphorFlatGraphEdit(
    'terrain',
    'not-terrain',
    (template, id, label) => ({
      id,
      label,
      elevation: boundedNumber(template, 'elevation', -10, 20, 3),
      intensity: boundedNumber(template, 'intensity', 0.1, 10, 3)
    }),
    true
  ),
  orrery: createMetaphorFlatGraphEdit(
    'orrery',
    'not-orrery',
    (template, id, label) => {
      const item = {
        id,
        label,
        orbit: boundedNumber(template, 'orbit', 0, 12, 3),
        size: positiveNumber(template, 'size', 3)
      };
      copyOptionalString(template, 'moon', item);
      return item;
    },
    false
  ),
  river: createMetaphorFlatGraphEdit(
    'river',
    'not-river',
    (template, id, label) => {
      const item = {
        id,
        label,
        stage: boundedNumber(template, 'stage', 0, 100, 0),
        flow: positiveNumber(template, 'flow', 5)
      };
      copyOptionalNumber(template, 'hazard', item);
      return item;
    },
    false
  ),
  archipelago: createMetaphorFlatGraphEdit(
    'archipelago',
    'not-archipelago',
    (template, id, label) => {
      const item = {
        id,
        label,
        mass: positiveNumber(template, 'mass', 4),
        relief: boundedNumber(template, 'relief', 0, 1, 0.45)
      };
      copyOptionalString(template, 'chain', item);
      return item;
    },
    false
  ),
  bridge: createMetaphorFlatGraphEdit(
    'bridge',
    'not-bridge',
    (template, id, label) => {
      const item = {
        id,
        label,
        span: boundedNumber(template, 'span', 0, 100, 0),
        load: positiveNumber(template, 'load', 3)
      };
      copyOptionalString(template, 'side', item);
      copyOptionalNumber(template, 'strain', item);
      return item;
    },
    false
  ),
  cycle: createMetaphorFlatGraphEdit(
    'cycle',
    'not-cycle',
    (template, id, label) => {
      const item = {
        id,
        label,
        phase: boundedNumber(template, 'phase', 0, 100, 0),
        size: positiveNumber(template, 'size', 3)
      };
      copyOptionalNumber(template, 'friction', item);
      return item;
    },
    false
  ),
  subway: createMetaphorFlatGraphEdit(
    'subway',
    'not-subway',
    (template, id, label) => {
      const item = {
        id,
        label,
        stop: boundedNumber(template, 'stop', 0, 100, 0),
        traffic: positiveNumber(template, 'traffic', 5)
      };
      copyOptionalString(template, 'line', item);
      if (Array.isArray(template?.interchange) && template.interchange.length) {
        item.interchange = [...template.interchange];
      }
      return item;
    },
    false
  ),
  iceberg: createMetaphorFlatGraphEdit(
    'iceberg',
    'not-iceberg',
    (template, id, label) => {
      const item = {
        id,
        label,
        depth: boundedNumber(template, 'depth', -1, 1, 0.4),
        mass: positiveNumber(template, 'mass', 5)
      };
      copyOptionalString(template, 'berg', item);
      copyOptionalNumber(template, 'peril', item);
      return item;
    },
    false
  )
};

/**
 * @param {string} source
 * @returns {ReturnType<typeof createMetaphorFlatGraphEdit> | null}
 */
export function metaphorFlatGraphEditForSource(source) {
  try {
    const doc = JSON.parse(String(source ?? '').trim());
    const kind = doc?.metaphor;
    if (typeof kind !== 'string') return null;
    return METAPHOR_FLAT_GRAPH_EDIT_KINDS[kind] ?? null;
  } catch {
    return null;
  }
}

/**
 * @param {ReturnType<typeof createMetaphorFlatGraphEdit>} edit
 */
export function flatGraphEditAdapter(edit) {
  return {
    contentType: 'metaphor3d',
    canLink: edit.canLink,
    addLinked: edit.addLinked,
    connect: edit.connect,
    deleteNode: edit.deleteNode,
    deleteEdge: edit.deleteEdge,
    renameNode: edit.renameNode,
    renameEdge: edit.renameEdge
  };
}
