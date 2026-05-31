import { METAPHOR_KINDS, sanitizeMetaphorDsl } from '@archislop/shared';

/** Human-readable labels for the fullscreen metaphor switcher. */
export const METAPHOR_KIND_LABELS = {
  city: 'City',
  layercake: 'Layer cake',
  galaxy: 'Galaxy',
  tree: 'Tree',
  terrain: 'Terrain'
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
  return '';
}

function mapItemToKind(item, fromKind, toKind) {
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
    default:
      break;
  }

  return next;
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
  if (!(METAPHOR_KINDS).includes(kind)) {
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

  const working = {
    metaphor: kind,
    scene: isObject(sanitized.dsl.scene) ? { ...sanitized.dsl.scene } : {},
    items: sanitized.dsl.items.map((item) => mapItemToKind(item, currentKind, kind)),
    links: Array.isArray(sanitized.dsl.links) ? [...sanitized.dsl.links] : []
  };

  const next = sanitizeMetaphorDsl(JSON.stringify(working), { allowStructureRewrite: true });
  if (!next.dsl) {
    return { ok: false, error: 'Could not switch metaphor type.' };
  }

  return { ok: true, text: next.text };
}

export { METAPHOR_KINDS };
