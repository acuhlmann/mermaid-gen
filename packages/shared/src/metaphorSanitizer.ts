import {
  CITY_CONDITION,
  CITY_LIGHTING,
  CITY_MAX_ITEMS,
  GALAXY_MAX_ITEMS,
  GARDEN_HEALTH,
  GARDEN_MAX_ITEMS,
  LAYERCAKE_MAX_ITEMS,
  METAPHOR_GLYPH_KINDS,
  METAPHOR_KINDS,
  METAPHOR_LINK_KINDS,
  METAPHOR_MAX_LINKS,
  MetaphorDslSchema,
  ORRERY_MAX_ITEMS,
  RIVER_MAX_ITEMS,
  TERRAIN_MAX_ITEMS,
  TREE_MAX_ITEMS,
  type MetaphorDsl,
  type MetaphorKind
} from './metaphorSchema.js';

export interface SanitizeMetaphorResult {
  text: string;
  applied: string[];
  dsl: MetaphorDsl | null;
  /**
   * Root-cause diagnostic when `dsl` is null: the JSON.parse message or the
   * formatted Zod issues (`path: message; …`). Callers must relay it verbatim
   * so the fixer/repair prompts see WHICH field failed, not a generic notice.
   */
  error?: string;
}

export interface SanitizeMetaphorOptions {
  /** When true, structural rescue (defaulting missing metaphor, dropping malformed items). */
  allowStructureRewrite?: boolean;
}

const MAX_ITEMS_BY_KIND: Record<MetaphorKind, number> = {
  city: CITY_MAX_ITEMS,
  layercake: LAYERCAKE_MAX_ITEMS,
  galaxy: GALAXY_MAX_ITEMS,
  tree: TREE_MAX_ITEMS,
  terrain: TERRAIN_MAX_ITEMS,
  orrery: ORRERY_MAX_ITEMS,
  river: RIVER_MAX_ITEMS,
  garden: GARDEN_MAX_ITEMS
};

const LIGHTING_SET = new Set<string>(CITY_LIGHTING);
const CONDITION_SET = new Set<string>(CITY_CONDITION);
const GARDEN_HEALTH_SET = new Set<string>(GARDEN_HEALTH);
const GLYPH_SET = new Set<string>(METAPHOR_GLYPH_KINDS);
const LINK_KIND_SET = new Set<string>(METAPHOR_LINK_KINDS);
const NOTE_MAX_LENGTH = 140;

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

function rescueItemPositions(working: Record<string, unknown>, applied: string[]): void {
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

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rescueNumericRanges(working: Record<string, unknown>, applied: string[]): void {
  if (!Array.isArray(working.items)) return;
  const kind = working.metaphor as MetaphorKind | undefined;

  for (const item of working.items as unknown[]) {
    if (!isObject(item)) continue;

    if (kind === 'terrain') {
      if (typeof item.elevation === 'number' && Number.isFinite(item.elevation)) {
        const clamped = clampNumber(item.elevation, -10, 20);
        if (clamped !== item.elevation) {
          item.elevation = clamped;
          applied.push('clamp-elevation');
        }
      }
      if (typeof item.intensity === 'number' && Number.isFinite(item.intensity)) {
        const clamped = clampNumber(item.intensity, 0.1, 10);
        if (clamped !== item.intensity) {
          item.intensity = clamped;
          applied.push('clamp-intensity');
        }
      }
    }

    if (kind === 'tree' && typeof item.weight === 'number' && Number.isFinite(item.weight)) {
      const clamped = clampNumber(item.weight, 0.1, 20);
      if (clamped !== item.weight) {
        item.weight = clamped;
        applied.push('clamp-weight');
      }
    }

    if (kind === 'layercake') {
      if (typeof item.cracks === 'number' && Number.isFinite(item.cracks)) {
        const clamped = clampNumber(item.cracks, 0, 1);
        if (clamped !== item.cracks) {
          item.cracks = clamped;
          applied.push('clamp-cracks');
        }
      }
      if (typeof item.tilt === 'number' && Number.isFinite(item.tilt)) {
        const clamped = clampNumber(item.tilt, 0, 15);
        if (clamped !== item.tilt) {
          item.tilt = clamped;
          applied.push('clamp-tilt');
        }
      }
    }

    if (kind === 'orrery') {
      if (typeof item.orbit === 'number' && Number.isFinite(item.orbit)) {
        const clamped = clampNumber(item.orbit, 0, 12);
        if (clamped !== item.orbit) {
          item.orbit = clamped;
          applied.push('clamp-orbit');
        }
      }
      if (typeof item.size === 'number' && Number.isFinite(item.size)) {
        const clamped = clampNumber(item.size, 0.1, 10);
        if (clamped !== item.size) {
          item.size = clamped;
          applied.push('clamp-size');
        }
      }
    }

    if (kind === 'river') {
      if (typeof item.stage === 'number' && Number.isFinite(item.stage)) {
        const clamped = clampNumber(item.stage, 0, 100);
        if (clamped !== item.stage) {
          item.stage = clamped;
          applied.push('clamp-stage');
        }
      }
      if (typeof item.flow === 'number' && Number.isFinite(item.flow)) {
        const clamped = clampNumber(item.flow, 0.1, 20);
        if (clamped !== item.flow) {
          item.flow = clamped;
          applied.push('clamp-flow');
        }
      }
      if (typeof item.hazard === 'number' && Number.isFinite(item.hazard)) {
        const clamped = clampNumber(item.hazard, 0, 1);
        if (clamped !== item.hazard) {
          item.hazard = clamped;
          applied.push('clamp-hazard');
        }
      }
    }

    if (kind === 'garden') {
      if (typeof item.maturity === 'number' && Number.isFinite(item.maturity)) {
        const clamped = clampNumber(item.maturity, 0, 1);
        if (clamped !== item.maturity) {
          item.maturity = clamped;
          applied.push('clamp-maturity');
        }
      }
      if (typeof item.impact === 'number' && Number.isFinite(item.impact)) {
        const clamped = clampNumber(item.impact, 0.1, 10);
        if (clamped !== item.impact) {
          item.impact = clamped;
          applied.push('clamp-impact');
        }
      }
    }
  }
}

function rescueGlyphField(working: Record<string, unknown>, applied: string[]): void {
  if (!Array.isArray(working.items)) return;
  for (const item of working.items as unknown[]) {
    if (!isObject(item)) continue;
    if (!('glyph' in item)) continue;
    if (typeof item.glyph !== 'string') {
      delete item.glyph;
      applied.push('drop-invalid-glyph');
      continue;
    }
    const lower = item.glyph.trim().toLowerCase();
    if (GLYPH_SET.has(lower)) {
      if (item.glyph !== lower) {
        item.glyph = lower;
        applied.push('normalize-glyph-case');
      }
    } else {
      delete item.glyph;
      applied.push('drop-invalid-glyph');
    }
  }
}

function rescueItemNotes(working: Record<string, unknown>, applied: string[]): void {
  if (!Array.isArray(working.items)) return;
  for (const item of working.items as unknown[]) {
    if (!isObject(item)) continue;
    if (!('note' in item)) continue;
    if (typeof item.note !== 'string' || !item.note.trim()) {
      delete item.note;
      applied.push('drop-invalid-note');
      continue;
    }
    const trimmed = item.note.trim();
    if (trimmed.length > NOTE_MAX_LENGTH) {
      item.note = trimmed.slice(0, NOTE_MAX_LENGTH);
      applied.push('clamp-note');
    } else if (item.note !== trimmed) {
      item.note = trimmed;
    }
  }
}

function rescueSceneLegend(working: Record<string, unknown>, applied: string[]): void {
  if (!isObject(working.scene)) return;
  const legend = working.scene.legend;
  if (legend === undefined) return;
  if (!isObject(legend)) {
    delete working.scene.legend;
    applied.push('drop-invalid-legend');
    return;
  }
  const allowed: ReadonlyArray<string> = [
    'height',
    'footprint',
    'district',
    'magnitude',
    'cluster',
    'thickness',
    'weight',
    'elevation',
    'intensity',
    'orbit',
    'size',
    'stage',
    'flow',
    'maturity',
    'impact',
    'bed',
    'health'
  ];
  const kept: Record<string, string> = {};
  let droppedUnknown = false;
  for (const [key, value] of Object.entries(legend)) {
    if (!allowed.includes(key)) {
      droppedUnknown = true;
      continue;
    }
    if (typeof value !== 'string') {
      droppedUnknown = true;
      continue;
    }
    kept[key] = value;
  }
  if (droppedUnknown) {
    applied.push('drop-invalid-legend-axis');
  }
  if (Object.keys(kept).length === 0) {
    delete working.scene.legend;
  } else {
    working.scene.legend = kept;
  }
}

function rescueCityEnumCase(working: Record<string, unknown>, applied: string[]): void {
  if (working.metaphor !== 'city' || !Array.isArray(working.items)) return;
  for (const item of working.items as unknown[]) {
    if (!isObject(item)) continue;
    if (typeof item.lighting === 'string') {
      const lower = item.lighting.trim().toLowerCase();
      if (LIGHTING_SET.has(lower)) {
        if (item.lighting !== lower) {
          item.lighting = lower;
          applied.push('normalize-lighting-case');
        }
      } else {
        delete item.lighting;
        applied.push('drop-invalid-lighting');
      }
    }
    if (typeof item.condition === 'string') {
      const lower = item.condition.trim().toLowerCase();
      if (CONDITION_SET.has(lower)) {
        if (item.condition !== lower) {
          item.condition = lower;
          applied.push('normalize-condition-case');
        }
      } else {
        delete item.condition;
        applied.push('drop-invalid-condition');
      }
    }
  }
}

function rescueGardenHealth(working: Record<string, unknown>, applied: string[]): void {
  if (working.metaphor !== 'garden' || !Array.isArray(working.items)) return;
  for (const item of working.items as unknown[]) {
    if (!isObject(item) || !('health' in item)) continue;
    if (typeof item.health === 'string') {
      const lower = item.health.trim().toLowerCase();
      if (GARDEN_HEALTH_SET.has(lower)) {
        if (item.health !== lower) {
          item.health = lower;
          applied.push('normalize-garden-health-case');
        }
        continue;
      }
    }
    delete item.health;
    applied.push('drop-invalid-garden-health');
  }
}

function rescueTreeStructure(working: Record<string, unknown>, applied: string[]): void {
  if (working.metaphor !== 'tree' || !Array.isArray(working.items)) return;
  const items = working.items as Array<Record<string, unknown>>;
  const ids = new Set(
    items
      .filter(isObject)
      .map((item) => item.id)
      .filter((id): id is string => typeof id === 'string')
  );
  const itemById = new Map<string, Record<string, unknown>>();
  for (const item of items) {
    if (isObject(item) && typeof item.id === 'string') {
      itemById.set(item.id, item);
    }
  }

  for (const item of items) {
    if (!isObject(item)) continue;
    if (typeof item.parent !== 'string') {
      if ('parent' in item && item.parent != null) {
        delete item.parent;
        applied.push('drop-invalid-parent');
      }
      continue;
    }
    const parentId = item.parent;
    if (parentId === item.id) {
      delete item.parent;
      applied.push('break-tree-self-parent');
      continue;
    }
    if (!ids.has(parentId)) {
      delete item.parent;
      applied.push('orphan-parent-to-root');
      continue;
    }
  }

  for (const item of items) {
    if (!isObject(item) || typeof item.parent !== 'string') continue;
    const visited = new Set<string>([item.id as string]);
    let cursor: string | undefined = item.parent;
    let cycle = false;
    let safety = items.length + 1;
    while (cursor && safety-- > 0) {
      if (visited.has(cursor)) {
        cycle = true;
        break;
      }
      visited.add(cursor);
      const parentItem = itemById.get(cursor);
      const nextParent = parentItem?.parent;
      cursor = typeof nextParent === 'string' ? nextParent : undefined;
    }
    if (cycle) {
      delete item.parent;
      applied.push('break-tree-cycle');
    }
  }
}

function rescueGalaxyBinary(working: Record<string, unknown>, applied: string[]): void {
  if (working.metaphor !== 'galaxy' || !Array.isArray(working.items)) return;
  const items = working.items as Array<Record<string, unknown>>;
  const ids = new Set(
    items
      .filter(isObject)
      .map((item) => item.id)
      .filter((id): id is string => typeof id === 'string')
  );
  for (const item of items) {
    if (!isObject(item)) continue;
    if (typeof item.binary !== 'string') {
      if ('binary' in item && item.binary != null) {
        delete item.binary;
        applied.push('drop-invalid-binary');
      }
      continue;
    }
    if (!ids.has(item.binary) || item.binary === item.id) {
      delete item.binary;
      applied.push('drop-orphan-binary');
    }
  }
}

function rescueOrreryMoons(working: Record<string, unknown>, applied: string[]): void {
  if (working.metaphor !== 'orrery' || !Array.isArray(working.items)) return;
  const items = working.items as Array<Record<string, unknown>>;
  const ids = new Set(
    items
      .filter(isObject)
      .map((item) => item.id)
      .filter((id): id is string => typeof id === 'string')
  );
  for (const item of items) {
    if (!isObject(item)) continue;
    if (typeof item.moon !== 'string') {
      if ('moon' in item && item.moon != null) {
        delete item.moon;
        applied.push('drop-invalid-moon');
      }
      continue;
    }
    if (!ids.has(item.moon) || item.moon === item.id) {
      delete item.moon;
      applied.push('drop-orphan-moon');
      continue;
    }
    const parent = items.find((it) => isObject(it) && it.id === item.moon);
    // A moon of a moon has no stable anchor — flatten to a planet.
    if (parent && typeof parent.moon === 'string') {
      delete item.moon;
      applied.push('flatten-nested-moon');
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

function rescueLinkKinds(working: Record<string, unknown>, applied: string[]): void {
  if (!Array.isArray(working.links)) return;
  for (const link of working.links as unknown[]) {
    if (!isObject(link)) continue;
    if (!('kind' in link)) continue;
    if (typeof link.kind === 'string') {
      const lower = link.kind.trim().toLowerCase();
      if (LINK_KIND_SET.has(lower)) {
        if (link.kind !== lower) {
          link.kind = lower;
          applied.push('normalize-link-kind');
        }
        continue;
      }
    }
    delete link.kind;
    applied.push('drop-invalid-link-kind');
  }
}

function formatZodIssues(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): string {
  return issues
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('; ');
}

export function sanitizeMetaphorDsl(
  source: string,
  options: SanitizeMetaphorOptions = {}
): SanitizeMetaphorResult {
  const { allowStructureRewrite = true } = options;
  const applied: string[] = [];
  const trimmed = source.trim();

  if (!trimmed) {
    return { text: '', applied, dsl: null, error: 'Metaphor DSL is empty.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return {
      text: trimmed,
      applied,
      dsl: null,
      error: `Metaphor DSL is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    };
  }

  if (!isObject(parsed)) {
    return {
      text: trimmed,
      applied,
      dsl: null,
      error: 'Metaphor DSL must be a JSON object, not an array or primitive.'
    };
  }

  const working: Record<string, unknown> = { ...parsed };

  if (!rescueMetaphorField(working, applied, allowStructureRewrite)) {
    return {
      text: trimmed,
      applied,
      dsl: null,
      error: `metaphor: must be one of ${METAPHOR_KINDS.join(' | ')} (got ${JSON.stringify(working.metaphor ?? null)}).`
    };
  }

  if (!isObject(working.scene)) {
    working.scene = {};
    applied.push('default-scene');
  }

  rescueItemsField(working, applied, allowStructureRewrite);
  rescueItemPositions(working, applied);
  rescueNumericRanges(working, applied);
  rescueCityEnumCase(working, applied);
  rescueGardenHealth(working, applied);
  rescueGlyphField(working, applied);
  rescueItemNotes(working, applied);
  rescueSceneLegend(working, applied);
  rescueTreeStructure(working, applied);
  rescueGalaxyBinary(working, applied);
  rescueOrreryMoons(working, applied);
  rescueLinksField(working, applied, allowStructureRewrite);
  rescueLinkKinds(working, applied);

  const result = MetaphorDslSchema.safeParse(working);
  if (!result.success) {
    return {
      text: trimmed,
      applied,
      dsl: null,
      error: `Metaphor DSL did not match schema: ${formatZodIssues(result.error.issues)}`
    };
  }

  return {
    text: JSON.stringify(result.data, null, 2),
    applied,
    dsl: result.data
  };
}
