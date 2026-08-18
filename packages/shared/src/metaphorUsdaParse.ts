/**
 * Inverse of `authorMetaphorUsda`: parse the v0.2 mapping subset back into a
 * Metaphor3D DSL document. This is not a general USDA parser and not a USD
 * Core 1.0.1 conformance boundary — it only understands the interchange stub
 * we emit. See `docs/guide/metaphor-usda-mapping.md`.
 */

import {
  METAPHOR_BASE_KINDS,
  METAPHOR_LINK_KINDS,
  MetaphorDslSchema,
  type MetaphorBaseKind,
  type MetaphorDsl,
  type MetaphorLink
} from './metaphorSchema.js';
import {
  MetaphorUsdaParseError,
  extractXforms,
  parseCustomLayerData,
  parseTopLevelCustomAttrs,
  readQuoted,
  type XformSpec
} from './metaphorUsdaScan.js';

export { MetaphorUsdaParseError };

const BASE_KIND_SET = new Set<string>(METAPHOR_BASE_KINDS);
const LINK_KIND_SET = new Set<string>(METAPHOR_LINK_KINDS);

interface LooseItem extends Record<string, unknown> {
  id: string;
  label: string;
}

type AttrValue = { usdType: string; value: unknown };

function parseRelPath(raw: string): string {
  const match = /^<([^>]+)>$/.exec(raw.trim());
  if (!match) throw new MetaphorUsdaParseError(`invalid relationship path: ${raw}`);
  return match[1];
}

function parseRelArray(raw: string): string[] {
  const inner = raw.trim().slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(',').map((part) => parseRelPath(part.trim()));
}

function parseStringArray(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    throw new MetaphorUsdaParseError(`invalid string array: ${raw}`);
  }
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  const values: string[] = [];
  let i = 0;
  while (i < inner.length) {
    while (i < inner.length && (inner[i] === ',' || /\s/.test(inner[i]))) i += 1;
    if (i >= inner.length) break;
    const read = readQuoted(inner, i);
    values.push(read.value);
    i = read.end;
  }
  return values;
}

function parseDouble3(raw: string): [number, number, number] {
  const match = /^\(\s*([^,]+),\s*([^,]+),\s*([^)]+)\)$/.exec(raw.trim());
  if (!match) throw new MetaphorUsdaParseError(`invalid double3: ${raw}`);
  const nums = match.slice(1, 4).map(Number);
  if (nums.some((n) => !Number.isFinite(n))) {
    throw new MetaphorUsdaParseError(`invalid double3: ${raw}`);
  }
  return [nums[0], nums[1], nums[2]];
}

function parseDouble(raw: string): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) throw new MetaphorUsdaParseError(`invalid double: ${raw}`);
  return num;
}

function parseAttrValue(usdType: string, raw: string): unknown {
  if (usdType === 'rel') {
    return raw.trim().startsWith('[') ? parseRelArray(raw) : parseRelPath(raw);
  }
  if (usdType.endsWith('[]')) {
    return raw.includes('<') ? parseRelArray(raw) : parseStringArray(raw);
  }
  if (usdType === 'double3') return parseDouble3(raw);
  if (usdType === 'bool') return raw === 'true' || raw === '1';
  if (usdType === 'double') return parseDouble(raw);
  if (raw.startsWith('"')) return readQuoted(raw, 0).value;
  return raw;
}

function isBaseKind(value: string): value is MetaphorBaseKind {
  return BASE_KIND_SET.has(value);
}

function resolveRelTarget(raw: string, pathToId: Map<string, string>): string {
  return pathToId.get(raw) ?? raw;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function resolveRel(value: unknown, pathToId: Map<string, string>): unknown {
  if (typeof value === 'string') return resolveRelTarget(value, pathToId);
  if (!isUnknownArray(value)) return value;
  return value.map((entry) =>
    typeof entry === 'string' ? resolveRelTarget(entry, pathToId) : entry
  );
}

function attrMap(body: string): Map<string, AttrValue> {
  const map = new Map<string, AttrValue>();
  for (const attr of parseTopLevelCustomAttrs(body)) {
    map.set(attr.name, { usdType: attr.usdType, value: parseAttrValue(attr.usdType, attr.raw) });
  }
  return map;
}

function shouldResolveRel(parsed: AttrValue): boolean {
  return parsed.usdType === 'rel' || parsed.usdType.endsWith('[]');
}

function applyItemField(
  item: LooseItem,
  field: string,
  parsed: AttrValue,
  pathToId: Map<string, string>
): void {
  if (field === 'id' || field === 'label' || field === 'links') return;
  if (field === 'linkKinds' || field === 'linkLabels') return;
  const resolved = shouldResolveRel(parsed) ? resolveRel(parsed.value, pathToId) : parsed.value;
  if (field === 'accent') {
    if (resolved === true) item.accent = true;
    return;
  }
  item[field] = resolved;
}

function itemFromAttrs(
  spec: XformSpec,
  attrs: Map<string, AttrValue>,
  pathToId: Map<string, string>
): LooseItem {
  const idValue = attrs.get('archislop:id')?.value;
  const id = typeof idValue === 'string' ? idValue : spec.name;
  const labelValue = attrs.get('archislop:label')?.value;
  const label = typeof labelValue === 'string' ? labelValue : (spec.doc ?? id);
  const item: LooseItem = { id, label };
  for (const [name, parsed] of attrs) {
    applyItemField(item, name.slice('archislop:'.length), parsed, pathToId);
  }
  return item;
}

function asLinkKind(value: unknown): MetaphorLink['kind'] | undefined {
  return typeof value === 'string' && LINK_KIND_SET.has(value)
    ? (value as MetaphorLink['kind'])
    : undefined;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function linkFromTarget(
  fromId: string,
  parts: { raw: unknown; kind: unknown; label: unknown },
  pathToId: Map<string, string>
): MetaphorLink | null {
  if (typeof parts.raw !== 'string') return null;
  const link: MetaphorLink = { from: fromId, to: resolveRelTarget(parts.raw, pathToId) };
  const kind = asLinkKind(parts.kind);
  const label = asOptionalString(parts.label);
  if (kind) link.kind = kind;
  if (label) link.label = label;
  return link;
}

function collectLinks(
  fromId: string,
  attrs: Map<string, AttrValue>,
  pathToId: Map<string, string>
): MetaphorLink[] {
  const linksValue = attrs.get('archislop:links')?.value;
  if (!isUnknownArray(linksValue) || linksValue.length === 0) return [];
  const kinds = attrs.get('archislop:linkKinds')?.value;
  const labels = attrs.get('archislop:linkLabels')?.value;
  const kindList = isUnknownArray(kinds) ? kinds : [];
  const labelList = isUnknownArray(labels) ? labels : [];
  const links: MetaphorLink[] = [];
  for (let i = 0; i < linksValue.length; i += 1) {
    const link = linkFromTarget(
      fromId,
      { raw: linksValue[i], kind: kindList[i], label: labelList[i] },
      pathToId
    );
    if (link) links.push(link);
  }
  return links;
}

function parseJsonField(raw: string | undefined): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new MetaphorUsdaParseError('invalid JSON in customLayerData');
  }
}

function assembleScene(layer: Record<string, string>): Record<string, unknown> {
  const scene: Record<string, unknown> = {
    theme: layer['archislop:sceneTheme'] ?? 'whiteboard',
    camera: layer['archislop:sceneCamera'] ?? 'orbit'
  };
  if (layer['archislop:sceneMood']) scene.mood = layer['archislop:sceneMood'];
  if (layer['archislop:sceneTitle']) scene.title = layer['archislop:sceneTitle'];
  if (layer['archislop:sceneSubtitle']) scene.subtitle = layer['archislop:sceneSubtitle'];
  const legend = parseJsonField(layer['archislop:sceneLegend']);
  if (legend) scene.legend = legend;
  const nebula = parseJsonField(layer['archislop:sceneNebula']);
  if (nebula) scene.nebula = nebula;
  const surface = parseJsonField(layer['archislop:sceneSurface']);
  if (surface) scene.surface = surface;
  return scene;
}

function parseSeed(raw: string | undefined): string | number {
  if (raw === undefined) return 0;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}

function indexItemPaths(scopes: XformSpec[]): Map<string, string> {
  const pathToId = new Map<string, string>();
  for (const scope of scopes) {
    for (const item of extractXforms(scope.body, scope.path)) {
      const idValue = attrMap(item.body).get('archislop:id')?.value;
      if (typeof idValue === 'string' && !pathToId.has(item.path)) {
        pathToId.set(item.path, idValue);
      }
    }
  }
  return pathToId;
}

function assembleBase(scope: XformSpec, pathToId: Map<string, string>) {
  const items: LooseItem[] = [];
  const links: MetaphorLink[] = [];
  for (const spec of extractXforms(scope.body, scope.path)) {
    const attrs = attrMap(spec.body);
    const item = itemFromAttrs(spec, attrs, pathToId);
    items.push(item);
    links.push(...collectLinks(item.id, attrs, pathToId));
  }
  return { items, links };
}

function layerTransform(position: unknown, scale: unknown): Record<string, unknown> | undefined {
  if (position === undefined && typeof scale !== 'number') return undefined;
  const transform: Record<string, unknown> = {};
  if (position !== undefined) transform.position = position;
  if (typeof scale === 'number') transform.scale = scale;
  return transform;
}

function requireLayerKind(scope: XformSpec, asValue: unknown): MetaphorBaseKind {
  if (typeof asValue !== 'string' || !isBaseKind(asValue)) {
    throw new MetaphorUsdaParseError(`invalid layerAs on "${scope.name}"`);
  }
  return asValue;
}

function assembleLayer(scope: XformSpec, pathToId: Map<string, string>) {
  const attrs = attrMap(scope.body);
  const asValue = requireLayerKind(scope, attrs.get('archislop:layerAs')?.value);
  const idValue = attrs.get('archislop:layerId')?.value;
  const assembled = assembleBase(scope, pathToId);
  const entry: Record<string, unknown> = {
    id: typeof idValue === 'string' ? idValue : scope.name,
    as: asValue,
    items: assembled.items
  };
  const label = attrs.get('archislop:layerLabel')?.value;
  if (typeof label === 'string') entry.label = label;
  const transform = layerTransform(
    attrs.get('archislop:layerPosition')?.value,
    attrs.get('archislop:layerScale')?.value
  );
  if (transform) entry.transform = transform;
  return { entry, links: assembled.links };
}

function assembleComposite(
  scopes: XformSpec[],
  pathToId: Map<string, string>,
  layer: Record<string, string>
) {
  const layers = scopes.map((scope) => assembleLayer(scope, pathToId));
  return {
    metaphor: 'composite' as const,
    scene: assembleScene(layer),
    layout: layer['archislop:layout'] ?? 'fused',
    seed: parseSeed(layer['archislop:seed']),
    novelty: Number(layer['archislop:novelty'] ?? 0.55),
    motionIntensity: Number(layer['archislop:motionIntensity'] ?? 0.65),
    layers: layers.map((row) => row.entry),
    items: [],
    links: layers.flatMap((row) => row.links)
  };
}

/**
 * Parse a Metaphor3D USDA interchange stub into a validated DSL document.
 * Unknown `archislop:*` attributes are ignored by the schema.
 */
export function parseMetaphorUsda(usda: string): MetaphorDsl {
  const text = usda.replace(/^\uFEFF/, '');
  if (!text.startsWith('#usda 1.0')) {
    throw new MetaphorUsdaParseError('missing #usda 1.0 header');
  }
  const layer = parseCustomLayerData(text);
  const metaphor = layer['archislop:metaphor'];
  if (!metaphor) throw new MetaphorUsdaParseError('missing archislop:metaphor');
  const worlds = extractXforms(text, '/');
  const world = worlds.find((spec) => spec.name === 'World');
  if (!world) throw new MetaphorUsdaParseError('missing def Xform "World"');
  const scopes = extractXforms(world.body, world.path);
  if (scopes.length === 0) throw new MetaphorUsdaParseError('World has no scopes');
  const pathToId = indexItemPaths(scopes);

  if (metaphor === 'composite') {
    return MetaphorDslSchema.parse(assembleComposite(scopes, pathToId, layer));
  }
  if (!isBaseKind(metaphor)) {
    throw new MetaphorUsdaParseError(`unknown metaphor kind: ${metaphor}`);
  }
  const assembled = assembleBase(scopes[0], pathToId);
  return MetaphorDslSchema.parse({
    metaphor,
    scene: assembleScene(layer),
    items: assembled.items,
    links: assembled.links
  });
}
