import type {
  CompositeLayout,
  CompositeSeed,
  MetaphorCamera,
  MetaphorKind,
  MetaphorTheme
} from './metaphorSchema.js';
import {
  COMPOSITE_LAYOUTS,
  METAPHOR_CAMERAS,
  METAPHOR_KINDS,
  METAPHOR_THEMES
} from './metaphorSchema.js';

export interface PartialMetaphorDsl {
  metaphor?: MetaphorKind;
  scene?: {
    theme?: MetaphorTheme;
    camera?: MetaphorCamera;
    title?: string;
  };
  layout?: CompositeLayout;
  seed?: CompositeSeed;
  novelty?: number;
  motionIntensity?: number;
  layers?: Array<Record<string, unknown>>;
  items: Array<Record<string, unknown>>;
  links: Array<Record<string, unknown>>;
}

function isCompleteItem(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && typeof item.label === 'string';
}

function isCompleteLink(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const link = value as Record<string, unknown>;
  return typeof link.from === 'string' && typeof link.to === 'string';
}

function isCompleteLayer(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const layer = value as Record<string, unknown>;
  return (
    typeof layer.id === 'string' &&
    typeof layer.as === 'string' &&
    Array.isArray(layer.items) &&
    layer.items.every(isCompleteItem)
  );
}

function coerceMetaphorKind(raw: unknown): MetaphorKind | undefined {
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim().toLowerCase();
  return (METAPHOR_KINDS as readonly string[]).includes(normalized)
    ? (normalized as MetaphorKind)
    : undefined;
}

function coerceTheme(raw: unknown): MetaphorTheme | undefined {
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim().toLowerCase();
  return (METAPHOR_THEMES as readonly string[]).includes(normalized)
    ? (normalized as MetaphorTheme)
    : undefined;
}

function coerceCamera(raw: unknown): MetaphorCamera | undefined {
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim().toLowerCase();
  return (METAPHOR_CAMERAS as readonly string[]).includes(normalized)
    ? (normalized as MetaphorCamera)
    : undefined;
}

function coerceCompositeLayout(raw: unknown): CompositeLayout | undefined {
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim().toLowerCase();
  return (COMPOSITE_LAYOUTS as readonly string[]).includes(normalized)
    ? (normalized as CompositeLayout)
    : undefined;
}

/** Extract top-level string property from partial JSON text. */
function extractJsonStringField(source: string, key: string): string | undefined {
  const re = new RegExp(`"${key}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`);
  const match = source.match(re);
  if (!match) return undefined;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1];
  }
}

function extractJsonNumberField(source: string, key: string): number | undefined {
  const match = source.match(new RegExp(`"${key}"\\s*:\\s*(-?(?:\\d+\\.?\\d*|\\.\\d+))`));
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

/** Walk a partial JSON buffer and collect complete objects from a named array. */
function extractCompleteObjectsFromPartialJson(
  source: string,
  key: string,
  isComplete: (value: unknown) => value is Record<string, unknown>
): Array<Record<string, unknown>> {
  const arrayKey = `"${key}"`;
  const start = source.indexOf(arrayKey);
  if (start < 0) return [];

  let i = start + arrayKey.length;
  while (i < source.length && /[\s:]/.test(source[i] ?? '')) i += 1;
  if (source[i] !== '[') return [];

  i += 1;
  const values: Array<Record<string, unknown>> = [];

  while (i < source.length) {
    while (i < source.length && /[\s,]/.test(source[i] ?? '')) i += 1;
    if (source[i] === ']') break;
    if (source[i] !== '{') break;

    let depth = 0;
    let inString = false;
    let escaped = false;
    const objStart = i;

    for (; i < source.length; i += 1) {
      const ch = source[i];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          i += 1;
          const slice = source.slice(objStart, i);
          try {
            const parsed = JSON.parse(slice) as unknown;
            if (isComplete(parsed)) values.push(parsed);
          } catch {
            /* incomplete object — stop */
          }
          break;
        }
      }
    }
    if (depth !== 0) break;
  }

  return values;
}

function extractCompleteItemsFromPartialJson(source: string): Array<Record<string, unknown>> {
  return extractCompleteObjectsFromPartialJson(source, 'items', isCompleteItem);
}

function extractCompleteLinksFromPartialJson(source: string): Array<Record<string, unknown>> {
  return extractCompleteObjectsFromPartialJson(source, 'links', isCompleteLink);
}

function extractCompleteLayersFromPartialJson(source: string): Array<Record<string, unknown>> {
  return extractCompleteObjectsFromPartialJson(source, 'layers', isCompleteLayer);
}

function parseScenePartial(source: string): PartialMetaphorDsl['scene'] | undefined {
  const sceneMatch = source.match(/"scene"\s*:\s*\{/);
  if (!sceneMatch || sceneMatch.index == null) return undefined;

  let i = sceneMatch.index + sceneMatch[0].length - 1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  const objStart = i;

  for (; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        const slice = source.slice(objStart, i + 1);
        try {
          const parsed = JSON.parse(slice) as Record<string, unknown>;
          const scene: PartialMetaphorDsl['scene'] = {};
          const theme = coerceTheme(parsed.theme);
          const camera = coerceCamera(parsed.camera);
          if (theme) scene.theme = theme;
          if (camera) scene.camera = camera;
          if (typeof parsed.title === 'string') scene.title = parsed.title;
          return Object.keys(scene).length > 0 ? scene : {};
        } catch {
          return undefined;
        }
      }
    }
  }

  const theme = coerceTheme(extractJsonStringField(source, 'theme'));
  const camera = coerceCamera(extractJsonStringField(source, 'camera'));
  const title = extractJsonStringField(source, 'title');
  if (!theme && !camera && !title) return undefined;
  return {
    ...(theme ? { theme } : {}),
    ...(camera ? { camera } : {}),
    ...(title ? { title } : {})
  };
}

/**
 * Parse a (possibly incomplete) metaphor DSL JSON string for streaming preview.
 * Returns only complete item objects; holds partial scene/metaphor when known.
 */
export function parsePartialMetaphorDsl(raw: string): PartialMetaphorDsl | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      const items = Array.isArray(parsed.items) ? parsed.items.filter(isCompleteItem) : [];
      const links = Array.isArray(parsed.links) ? parsed.links.filter(isCompleteLink) : [];
      const metaphor = coerceMetaphorKind(parsed.metaphor);
      const layout = coerceCompositeLayout(parsed.layout);
      const layers = Array.isArray(parsed.layers)
        ? parsed.layers.filter(isCompleteLayer)
        : undefined;
      const seed =
        (typeof parsed.seed === 'string' && parsed.seed.trim()) ||
        (typeof parsed.seed === 'number' && Number.isFinite(parsed.seed) ? parsed.seed : undefined);
      const novelty =
        typeof parsed.novelty === 'number' && Number.isFinite(parsed.novelty)
          ? parsed.novelty
          : undefined;
      const motionIntensity =
        typeof parsed.motionIntensity === 'number' && Number.isFinite(parsed.motionIntensity)
          ? parsed.motionIntensity
          : undefined;
      const sceneRaw = parsed.scene;
      let scene: PartialMetaphorDsl['scene'];
      if (sceneRaw && typeof sceneRaw === 'object' && !Array.isArray(sceneRaw)) {
        const s = sceneRaw as Record<string, unknown>;
        scene = {
          ...(coerceTheme(s.theme) ? { theme: coerceTheme(s.theme) } : {}),
          ...(coerceCamera(s.camera) ? { camera: coerceCamera(s.camera) } : {}),
          ...(typeof s.title === 'string' ? { title: s.title } : {})
        };
      }
      return {
        ...(metaphor ? { metaphor } : {}),
        ...(scene ? { scene } : {}),
        ...(layout ? { layout } : {}),
        ...(seed !== undefined ? { seed } : {}),
        ...(novelty !== undefined ? { novelty } : {}),
        ...(motionIntensity !== undefined ? { motionIntensity } : {}),
        ...(layers ? { layers } : {}),
        items,
        links
      };
    }
  } catch {
    /* fall through to partial extraction */
  }

  const metaphor =
    coerceMetaphorKind(extractJsonStringField(trimmed, 'metaphor')) ??
    (() => {
      const m = trimmed.match(/"metaphor"\s*:\s*"(\w+)/);
      return m ? coerceMetaphorKind(m[1]) : undefined;
    })();

  const scene = parseScenePartial(trimmed);
  const items = extractCompleteItemsFromPartialJson(trimmed);
  const links = extractCompleteLinksFromPartialJson(trimmed);
  const layers = extractCompleteLayersFromPartialJson(trimmed);
  const layout = coerceCompositeLayout(extractJsonStringField(trimmed, 'layout'));
  const seedString = extractJsonStringField(trimmed, 'seed');
  const seedNumber = extractJsonNumberField(trimmed, 'seed');
  const seed = seedString ?? seedNumber;
  const novelty = extractJsonNumberField(trimmed, 'novelty');
  const motionIntensity = extractJsonNumberField(trimmed, 'motionIntensity');

  if (!metaphor && !scene && items.length === 0 && links.length === 0 && layers.length === 0) {
    return null;
  }
  return {
    ...(metaphor ? { metaphor } : {}),
    ...(scene ? { scene } : {}),
    ...(layout ? { layout } : {}),
    ...(seed !== undefined ? { seed } : {}),
    ...(novelty !== undefined ? { novelty } : {}),
    ...(motionIntensity !== undefined ? { motionIntensity } : {}),
    ...(layers.length > 0 ? { layers } : {}),
    items,
    links
  };
}

/**
 * Build a minimal renderable DSL object from partial parse output for the streaming path.
 */
export function partialToRenderableMetaphorDsl(
  partial: PartialMetaphorDsl
): Record<string, unknown> | null {
  if (!partial.metaphor) return null;
  if (partial.metaphor === 'composite') {
    if (!partial.layers?.length) return null;
    return {
      metaphor: 'composite',
      scene: partial.scene ?? {},
      layout: partial.layout ?? 'fused',
      ...(partial.seed !== undefined ? { seed: partial.seed } : {}),
      ...(partial.novelty !== undefined ? { novelty: partial.novelty } : {}),
      ...(partial.motionIntensity !== undefined
        ? { motionIntensity: partial.motionIntensity }
        : {}),
      layers: partial.layers,
      items: [],
      links: partial.links ?? []
    };
  }
  return {
    metaphor: partial.metaphor,
    scene: partial.scene ?? {},
    items: partial.items,
    links: partial.links ?? []
  };
}
