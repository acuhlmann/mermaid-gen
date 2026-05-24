import {
  CITY_MAX_ITEMS,
  GALAXY_MAX_ITEMS,
  LAYERCAKE_MAX_ITEMS,
  METAPHOR_KINDS,
  METAPHOR_MAX_LINKS,
  MetaphorDslSchema,
  type MetaphorDsl,
  type MetaphorKind
} from './metaphorSchema.js';

export interface SanitizeMetaphorResult {
  text: string;
  applied: string[];
  dsl: MetaphorDsl | null;
}

export interface SanitizeMetaphorOptions {
  /** When true, structural rescue (defaulting missing metaphor, dropping malformed items). */
  allowStructureRewrite?: boolean;
}

const MAX_ITEMS_BY_KIND: Record<MetaphorKind, number> = {
  city: CITY_MAX_ITEMS,
  layercake: LAYERCAKE_MAX_ITEMS,
  galaxy: GALAXY_MAX_ITEMS
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coerceMetaphorKind(raw: unknown): MetaphorKind | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase();
  return (METAPHOR_KINDS as readonly string[]).includes(normalized)
    ? (normalized as MetaphorKind)
    : null;
}

function rescueMetaphorField(
  working: Record<string, unknown>,
  applied: string[],
  allowStructureRewrite: boolean
): boolean {
  const kind = coerceMetaphorKind(working.metaphor);
  if (!kind) {
    if (!allowStructureRewrite) return false;
    working.metaphor = 'city';
    applied.push('default-metaphor-city');
    return true;
  }
  if (working.metaphor !== kind) {
    working.metaphor = kind;
    applied.push('normalize-metaphor-case');
  }
  return true;
}

function rescueItemsField(
  working: Record<string, unknown>,
  applied: string[],
  allowStructureRewrite: boolean
): void {
  if (!Array.isArray(working.items)) {
    working.items = [];
    applied.push('default-items');
    return;
  }
  if (!allowStructureRewrite) return;

  const original = working.items as unknown[];
  const filtered = original.filter(
    (item) =>
      isObject(item) &&
      typeof (item as Record<string, unknown>).id === 'string' &&
      typeof (item as Record<string, unknown>).label === 'string'
  );
  if (filtered.length !== original.length) {
    applied.push('drop-malformed-items');
  }
  const cap = MAX_ITEMS_BY_KIND[working.metaphor as MetaphorKind] ?? CITY_MAX_ITEMS;
  if (filtered.length > cap) {
    filtered.length = cap;
    applied.push('cap-items');
  }
  working.items = filtered;
}

const POSITION_CLAMP = 30;

function clampPositionAxis(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(-POSITION_CLAMP, Math.min(POSITION_CLAMP, value));
}

function rescueItemPositions(
  working: Record<string, unknown>,
  applied: string[]
): void {
  if (!Array.isArray(working.items)) return;
  for (const item of working.items) {
    if (!isObject(item) || !Array.isArray(item.position)) continue;
    const coords = item.position as unknown[];
    if (coords.length !== 3) {
      delete item.position;
      applied.push('drop-invalid-position');
      continue;
    }
    const x = clampPositionAxis(coords[0]);
    const y = clampPositionAxis(coords[1]);
    const z = clampPositionAxis(coords[2]);
    if (x == null || y == null || z == null) {
      delete item.position;
      applied.push('drop-invalid-position');
      continue;
    }
    if (x !== coords[0] || y !== coords[1] || z !== coords[2]) {
      item.position = [x, y, z];
      applied.push('clamp-position');
    }
  }
}

function rescueLinksField(
  working: Record<string, unknown>,
  applied: string[],
  allowStructureRewrite: boolean
): void {
  if (!Array.isArray(working.links)) {
    working.links = [];
    applied.push('default-links');
    return;
  }
  if (!allowStructureRewrite) return;

  const itemIds = new Set(
    (Array.isArray(working.items) ? working.items : [])
      .filter(isObject)
      .map((item) => (item as Record<string, unknown>).id)
      .filter((id): id is string => typeof id === 'string')
  );

  const seen = new Set<string>();
  const filtered = (working.links as unknown[]).filter((link) => {
    if (!isObject(link)) return false;
    const from = link.from;
    const to = link.to;
    if (typeof from !== 'string' || typeof to !== 'string') return false;
    if (!itemIds.has(from) || !itemIds.has(to) || from === to) return false;
    const key = `${from}→${to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (filtered.length !== (working.links as unknown[]).length) {
    applied.push('sanitize-links');
  }
  if (filtered.length > METAPHOR_MAX_LINKS) {
    filtered.length = METAPHOR_MAX_LINKS;
    applied.push('cap-links');
  }
  working.links = filtered;
}

export function sanitizeMetaphorDsl(
  source: string,
  options: SanitizeMetaphorOptions = {}
): SanitizeMetaphorResult {
  const { allowStructureRewrite = true } = options;
  const applied: string[] = [];
  const trimmed = source.trim();

  if (!trimmed) {
    return { text: '', applied, dsl: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { text: trimmed, applied, dsl: null };
  }

  if (!isObject(parsed)) {
    return { text: trimmed, applied, dsl: null };
  }

  const working: Record<string, unknown> = { ...parsed };

  if (!rescueMetaphorField(working, applied, allowStructureRewrite)) {
    return { text: trimmed, applied, dsl: null };
  }

  if (!isObject(working.scene)) {
    working.scene = {};
    applied.push('default-scene');
  }

  rescueItemsField(working, applied, allowStructureRewrite);
  rescueItemPositions(working, applied);
  rescueLinksField(working, applied, allowStructureRewrite);

  const result = MetaphorDslSchema.safeParse(working);
  if (!result.success) {
    return { text: trimmed, applied, dsl: null };
  }

  return {
    text: JSON.stringify(result.data, null, 2),
    applied,
    dsl: result.data
  };
}
