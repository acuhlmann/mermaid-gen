import { METAPHOR_BASE_KINDS, METAPHOR_KINDS, sanitizeMetaphorDsl } from '@archislop/shared';

/** Human-readable labels for the fullscreen metaphor switcher. */
export const METAPHOR_KIND_LABELS = {
  city: 'City',
  layercake: 'Layer cake',
  galaxy: 'Galaxy',
  tree: 'Tree',
  terrain: 'Terrain',
  orrery: 'Orrery',
  river: 'River',
  garden: 'Garden',
  archipelago: 'Archipelago',
  machine: 'Machine',
  composite: 'Composite'
};

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Primary spatial encoding for an item in its current metaphor kind. */
function primaryMagnitude(item, kind) {
  switch (kind) {
    case 'city':
      return finiteNumber(item.height, 10);
    case 'layercake':
      return finiteNumber(item.thickness, 1);
    case 'galaxy':
      return finiteNumber(item.magnitude, 5);
    case 'tree':
      return finiteNumber(item.weight, 3);
    case 'terrain':
      return finiteNumber(item.elevation, 3);
    case 'orrery':
      return finiteNumber(item.size, 3);
    case 'river':
      return finiteNumber(item.flow, 5);
    case 'garden':
      return finiteNumber(item.impact, 3);
    case 'archipelago':
      return finiteNumber(item.mass, 4);
    case 'machine':
      return finiteNumber(item.size, 3);
    default:
      return 10;
  }
}

/** Secondary encoding when the target kind supports one (footprint / intensity). */
function secondaryMagnitude(item, kind) {
  switch (kind) {
    case 'city':
      return finiteNumber(item.footprint, 2);
    case 'terrain':
      return finiteNumber(item.intensity, 3);
    case 'orrery':
      return finiteNumber(item.orbit, 3);
    case 'archipelago':
      return finiteNumber(item.relief, 0.45);
    case 'machine':
      return finiteNumber(item.speed, 3);
    default:
      return null;
  }
}

function groupingLabel(item, kind) {
  if (kind === 'city' && typeof item.district === 'string' && item.district.trim()) {
    return item.district.trim();
  }
  if (kind === 'galaxy' && typeof item.cluster === 'string' && item.cluster.trim()) {
    return item.cluster.trim();
  }
  if (kind === 'garden' && typeof item.bed === 'string' && item.bed.trim()) {
    return item.bed.trim();
  }
  if (kind === 'archipelago' && typeof item.chain === 'string' && item.chain.trim()) {
    return item.chain.trim();
  }
  if (kind === 'machine' && typeof item.axle === 'string' && item.axle.trim()) {
    return item.axle.trim();
  }
  return '';
}

function mapItemToKind(item, fromKind, toKind, index) {
  const primary = primaryMagnitude(item, fromKind);
  const secondary = secondaryMagnitude(item, fromKind);
  const group = groupingLabel(item, fromKind);

  const next = {
    id: item.id,
    label: item.label
  };

  if (Array.isArray(item.position) && item.position.length === 3) {
    next.position = item.position;
  }
  if (typeof item.glyph === 'string' && item.glyph.trim()) {
    next.glyph = item.glyph.trim();
  }
  if (typeof item.note === 'string' && item.note.trim()) {
    next.note = item.note.trim();
  }

  switch (toKind) {
    case 'city':
      next.height = primary;
      next.footprint = secondary ?? 2;
      if (group) next.district = group;
      break;
    case 'layercake':
      next.thickness = primary;
      if (Array.isArray(item.components) && item.components.length > 0) {
        next.components = item.components.filter(
          (entry) => typeof entry === 'string' && entry.trim()
        );
      } else if (group) {
        next.components = [group];
      } else {
        next.components = [];
      }
      break;
    case 'galaxy':
      next.magnitude = primary;
      if (group) next.cluster = group;
      break;
    case 'tree':
      next.weight = primary;
      break;
    case 'terrain':
      next.elevation = primary;
      next.intensity = secondary ?? 3;
      break;
    case 'orrery':
      next.size = Math.max(0.5, Math.min(10, primary));
      // Bigger/more central things orbit closer to the core.
      next.orbit = Math.max(1, Math.min(12, Math.round(12 - Math.min(primary, 11))));
      break;
    case 'river':
      next.stage = index;
      next.flow = Math.max(0.1, Math.min(20, primary));
      break;
    case 'garden':
      next.maturity = 0.35 + (index % 4) * 0.18;
      next.impact = Math.max(0.1, Math.min(10, primary));
      next.health = 'steady';
      if (group) next.bed = group;
      break;
    case 'archipelago':
      next.mass = Math.max(0.5, Math.min(20, primary));
      next.relief =
        secondary != null
          ? Math.max(0, Math.min(1, secondary > 1 ? secondary / 12 : secondary))
          : 0.35 + (index % 5) * 0.12;
      if (group) next.chain = group;
      break;
    case 'machine':
      next.size = Math.max(0.1, Math.min(10, primary));
      next.speed =
        secondary != null
          ? Math.max(0, Math.min(10, secondary > 1 ? secondary : secondary * 10))
          : 2 + (index % 5);
      if (group) next.axle = group;
      break;
    default:
      break;
  }

  return next;
}

const COMPOSITE_LAYER_LABELS = {
  city: 'Systems',
  layercake: 'Stack',
  galaxy: 'Network',
  tree: 'Hierarchy',
  terrain: 'Risk field',
  orrery: 'Hub & spokes',
  river: 'Journey',
  garden: 'Portfolio',
  archipelago: 'Domains',
  machine: 'Mechanism'
};

/**
 * Wrap a base scene in the generic fused planner without inventing duplicate
 * actors or selecting from a pairwise metaphor matrix. The planner supplies a
 * shared substrate and kinetic composition even for one semantic layer.
 */
function wrapAsComposite(dsl) {
  if (dsl.metaphor === 'composite' && Array.isArray(dsl.layers) && dsl.layers.length >= 1) {
    return {
      metaphor: 'composite',
      scene: isObject(dsl.scene) ? { ...dsl.scene } : {},
      layout: ['fused', 'adjacent', 'overlay'].includes(dsl.layout) ? dsl.layout : 'fused',
      seed: dsl.seed ?? 0,
      novelty: finiteNumber(dsl.novelty, 0.55),
      motionIntensity: finiteNumber(dsl.motionIntensity, 0.65),
      layers: dsl.layers.map((layer) => ({ ...layer })),
      items: [],
      links: Array.isArray(dsl.links) ? [...dsl.links] : []
    };
  }

  const source = dsl.metaphor === 'composite' ? flattenComposite(dsl) : dsl;
  const primaryAs = METAPHOR_BASE_KINDS.includes(source.metaphor) ? source.metaphor : 'city';
  const primaryItems = Array.isArray(source.items) ? source.items.map((item) => ({ ...item })) : [];
  const links = Array.isArray(source.links) ? [...source.links] : [];

  return {
    metaphor: 'composite',
    scene: isObject(source.scene) ? { ...source.scene } : {},
    layout: 'fused',
    seed: 0,
    novelty: 0.55,
    motionIntensity: 0.65,
    layers: [
      {
        id: 'layer-primary',
        as: primaryAs,
        label: COMPOSITE_LAYER_LABELS[primaryAs] ?? METAPHOR_KIND_LABELS[primaryAs] ?? primaryAs,
        items: primaryItems
      }
    ],
    items: [],
    links
  };
}

/** Flatten a composite to its first layer (or empty city) before remapping. */
function flattenComposite(dsl) {
  const layer =
    Array.isArray(dsl.layers) && dsl.layers.length > 0 && isObject(dsl.layers[0])
      ? dsl.layers[0]
      : null;
  const as = layer && METAPHOR_BASE_KINDS.includes(layer.as) ? layer.as : METAPHOR_BASE_KINDS[0];
  return {
    metaphor: as,
    scene: isObject(dsl.scene) ? { ...dsl.scene } : {},
    items: layer && Array.isArray(layer.items) ? layer.items.map((item) => ({ ...item })) : [],
    links: Array.isArray(dsl.links) ? [...dsl.links] : []
  };
}

/**
 * Switch a metaphor DSL to another spatial kind, remapping item encodings and
 * re-validating through the shared sanitizer.
 *
 * @param {string} source Raw metaphor JSON
 * @param {string} nextKind One of METAPHOR_KINDS
 * @returns {{ ok: true, text: string } | { ok: false, error: string }}
 */
export function switchMetaphorKind(source, nextKind) {
  const kind = typeof nextKind === 'string' ? nextKind.trim().toLowerCase() : '';
  if (!METAPHOR_KINDS.includes(kind)) {
    return { ok: false, error: 'Unknown metaphor type.' };
  }

  const sanitized = sanitizeMetaphorDsl(source ?? '', { allowStructureRewrite: false });
  if (!sanitized.dsl) {
    return { ok: false, error: 'Metaphor DSL did not parse.' };
  }

  const currentKind = sanitized.dsl.metaphor;
  if (currentKind === kind) {
    return { ok: true, text: sanitized.text };
  }

  let working;
  if (kind === 'composite') {
    working = wrapAsComposite(sanitized.dsl);
  } else if (currentKind === 'composite') {
    const flat = flattenComposite(sanitized.dsl);
    working = {
      metaphor: kind,
      scene: flat.scene,
      items: flat.items.map((item, index) => mapItemToKind(item, flat.metaphor, kind, index)),
      links: flat.links
    };
  } else {
    working = {
      metaphor: kind,
      scene: isObject(sanitized.dsl.scene) ? { ...sanitized.dsl.scene } : {},
      items: sanitized.dsl.items.map((item, index) =>
        mapItemToKind(item, currentKind, kind, index)
      ),
      links: Array.isArray(sanitized.dsl.links) ? [...sanitized.dsl.links] : []
    };
  }

  const next = sanitizeMetaphorDsl(JSON.stringify(working), { allowStructureRewrite: true });
  if (!next.dsl) {
    return { ok: false, error: 'Could not switch metaphor type.' };
  }

  return { ok: true, text: next.text };
}

export { METAPHOR_KINDS, METAPHOR_BASE_KINDS };
