/**
 * USDA author for the canonical Metaphor3D DSL.
 *
 * Implements migration steps 1–2 of ADR-0009: the JSON DSL stays the semantic
 * source; this module emits a USDA (ASCII) interchange stub with items, fields,
 * and relationships in USD vocabulary. Pure text generation — no OpenUSD
 * dependency, no geometry, no planner output. The versioned mapping contract
 * lives in `docs/guide/metaphor-usda-mapping.md`; bump
 * METAPHOR_USDA_MAPPING_VERSION and the doc together.
 */

import type {
  CompositeMetaphor,
  MetaphorBaseKind,
  MetaphorCompositeLayer,
  MetaphorDsl,
  MetaphorLink,
  MetaphorScene
} from './metaphorSchema.js';

export const METAPHOR_USDA_MAPPING_VERSION = '0.1.0';

type ItemFieldType = 'double' | 'string' | 'token' | 'string[]' | 'rel';

interface ItemFieldMapping {
  field: string;
  type: ItemFieldType;
}

/**
 * Per-kind item fields beyond the common id/label/position/glyph/note, in
 * stable emission order. `rel` fields reference another item id and become
 * UsdRelationship targets when they resolve.
 */
const KIND_ITEM_FIELDS: Record<MetaphorBaseKind, ItemFieldMapping[]> = {
  city: [
    { field: 'height', type: 'double' },
    { field: 'footprint', type: 'double' },
    { field: 'district', type: 'string' },
    { field: 'lighting', type: 'token' },
    { field: 'condition', type: 'token' }
  ],
  layercake: [
    { field: 'thickness', type: 'double' },
    { field: 'components', type: 'string[]' },
    { field: 'cracks', type: 'double' },
    { field: 'tilt', type: 'double' }
  ],
  galaxy: [
    { field: 'magnitude', type: 'double' },
    { field: 'cluster', type: 'string' },
    { field: 'binary', type: 'rel' }
  ],
  tree: [
    { field: 'parent', type: 'rel' },
    { field: 'weight', type: 'double' },
    { field: 'kind', type: 'token' }
  ],
  terrain: [
    { field: 'elevation', type: 'double' },
    { field: 'intensity', type: 'double' }
  ],
  orrery: [
    { field: 'orbit', type: 'double' },
    { field: 'size', type: 'double' },
    { field: 'moon', type: 'rel' }
  ],
  river: [
    { field: 'stage', type: 'double' },
    { field: 'flow', type: 'double' },
    { field: 'hazard', type: 'double' }
  ],
  garden: [
    { field: 'maturity', type: 'double' },
    { field: 'impact', type: 'double' },
    { field: 'bed', type: 'string' },
    { field: 'health', type: 'token' }
  ],
  archipelago: [
    { field: 'mass', type: 'double' },
    { field: 'relief', type: 'double' },
    { field: 'chain', type: 'string' }
  ],
  machine: [
    { field: 'size', type: 'double' },
    { field: 'speed', type: 'double' },
    { field: 'axle', type: 'string' },
    { field: 'torque', type: 'double' },
    { field: 'mesh', type: 'rel' }
  ],
  bridge: [
    { field: 'span', type: 'double' },
    { field: 'load', type: 'double' },
    { field: 'side', type: 'string' },
    { field: 'strain', type: 'double' }
  ],
  cycle: [
    { field: 'phase', type: 'double' },
    { field: 'size', type: 'double' },
    { field: 'friction', type: 'double' }
  ]
};

type ItemRecord = Record<string, unknown>;

interface CollectedItem {
  kind: MetaphorBaseKind;
  item: ItemRecord;
  /** Original DSL id — link/rel endpoints resolve against this. */
  sourceId: string;
  primName: string;
  primPath: string;
}

interface CollectedScope {
  name: string;
  doc: string;
  kind: MetaphorBaseKind;
  layer: MetaphorCompositeLayer | null;
  items: CollectedItem[];
}

function usdaEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * USD names allow [A-Za-z_][A-Za-z0-9_]*; DSL ids also allow dashes. Sanitize,
 * then dedupe within one parent scope. Original ids survive in archislop:id.
 */
function toUsdName(raw: string, usedNames: Set<string>): string {
  let base = raw.replace(/[^A-Za-z0-9_]/g, '_');
  if (!/^[A-Za-z_]/.test(base)) base = `_${base}`;
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositionTuple(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);
}

function collectScopes(dsl: MetaphorDsl): CollectedScope[] {
  if (dsl.metaphor === 'composite') {
    const usedScopeNames = new Set<string>();
    return dsl.layers.map((layer) => {
      const scopeName = toUsdName(layer.id, usedScopeNames);
      return {
        name: scopeName,
        doc: layer.label ?? `composite layer: ${layer.id}`,
        kind: layer.as,
        layer,
        items: collectItems(layer.as, layer.items, scopeName)
      };
    });
  }
  const kind = dsl.metaphor;
  return [
    {
      name: kind,
      doc: `archislop metaphor kind: ${kind}`,
      kind,
      layer: null,
      items: collectItems(kind, dsl.items, kind)
    }
  ];
}

function collectItems(
  kind: MetaphorBaseKind,
  items: ItemRecord[],
  scopeName: string
): CollectedItem[] {
  const usedPrimNames = new Set<string>();
  return items.map((item) => {
    const sourceId = typeof item.id === 'string' ? item.id : '';
    const primName = toUsdName(sourceId, usedPrimNames);
    return {
      kind,
      item,
      sourceId,
      primName,
      primPath: `/World/${scopeName}/${primName}`
    };
  });
}

function buildItemPathIndex(scopes: CollectedScope[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const scope of scopes) {
    for (const item of scope.items) {
      // First id wins: base-kind schemas do not enforce item-id uniqueness.
      if (!index.has(item.sourceId)) {
        index.set(item.sourceId, item.primPath);
      }
    }
  }
  return index;
}

function collectCompositeLayerData(composite: CompositeMetaphor): Array<[string, string]> {
  return [
    ['archislop:layout', composite.layout],
    ['archislop:seed', String(composite.seed)],
    ['archislop:novelty', String(composite.novelty)],
    ['archislop:motionIntensity', String(composite.motionIntensity)]
  ];
}

function collectSceneLayerData(scene: MetaphorScene): Array<[string, string]> {
  const entries: Array<[string, string]> = [
    ['archislop:sceneTheme', scene.theme ?? 'whiteboard'],
    ['archislop:sceneCamera', scene.camera ?? 'orbit']
  ];
  if (scene.title) entries.push(['archislop:sceneTitle', scene.title]);
  if (scene.subtitle) entries.push(['archislop:sceneSubtitle', scene.subtitle]);
  if (scene.legend && Object.keys(scene.legend).length > 0) {
    entries.push(['archislop:sceneLegend', JSON.stringify(scene.legend)]);
  }
  if (Array.isArray(scene.nebula) && scene.nebula.length > 0) {
    entries.push(['archislop:sceneNebula', JSON.stringify(scene.nebula)]);
  }
  if (scene.surface) {
    entries.push(['archislop:sceneSurface', JSON.stringify(scene.surface)]);
  }
  return entries;
}

function collectCustomLayerData(dsl: MetaphorDsl): Array<[string, string]> {
  const entries: Array<[string, string]> = [
    ['archislop:mappingVersion', METAPHOR_USDA_MAPPING_VERSION],
    ['archislop:metaphor', dsl.metaphor]
  ];
  if (dsl.metaphor === 'composite') {
    entries.push(...collectCompositeLayerData(dsl));
  }
  entries.push(...collectSceneLayerData(dsl.scene));
  return entries;
}

/** Shared emission state: output buffer plus link/reference resolution data. */
interface EmitContext {
  lines: string[];
  links: MetaphorLink[];
  itemPathIndex: Map<string, string>;
}

function formatScalarAttr(mapping: ItemFieldMapping, value: unknown): string | null {
  const attr = `archislop:${mapping.field}`;
  if (mapping.type === 'double') {
    return isFiniteNumber(value) ? `custom double ${attr} = ${String(value)}` : null;
  }
  if (mapping.type === 'string' || mapping.type === 'token') {
    return typeof value === 'string'
      ? `custom ${mapping.type} ${attr} = "${usdaEscape(value)}"`
      : null;
  }
  if (mapping.type === 'string[]' && Array.isArray(value)) {
    const entries = value.filter((entry): entry is string => typeof entry === 'string');
    return `custom string[] ${attr} = [${entries.map((entry) => `"${usdaEscape(entry)}"`).join(', ')}]`;
  }
  return null;
}

function formatRelAttr(
  field: string,
  value: unknown,
  itemPathIndex: Map<string, string>
): string | null {
  if (typeof value !== 'string') return null;
  const targetPath = itemPathIndex.get(value);
  if (targetPath) return `custom rel archislop:${field} = <${targetPath}>`;
  // Dangling reference: keep the raw id so no authored data is lost.
  return `custom string archislop:${field} = "${usdaEscape(value)}"`;
}

function emitKindField(
  ctx: EmitContext,
  indent: string,
  mapping: ItemFieldMapping,
  value: unknown
): void {
  const line =
    mapping.type === 'rel'
      ? formatRelAttr(mapping.field, value, ctx.itemPathIndex)
      : formatScalarAttr(mapping, value);
  if (line) ctx.lines.push(`${indent}${line}`);
}

function emitOutgoingLinks(ctx: EmitContext, indent: string, sourceId: string): void {
  const resolved = ctx.links
    .filter((link) => link.from === sourceId)
    .map((link) => ({ link, targetPath: ctx.itemPathIndex.get(link.to) }))
    .filter((entry): entry is { link: MetaphorLink; targetPath: string } =>
      Boolean(entry.targetPath)
    );
  if (resolved.length === 0) return;
  ctx.lines.push(
    `${indent}custom rel archislop:links = [${resolved.map((entry) => `<${entry.targetPath}>`).join(', ')}]`
  );
  ctx.lines.push(
    `${indent}custom uniform token[] archislop:linkKinds = [${resolved
      .map((entry) => `"${usdaEscape(entry.link.kind ?? '')}"`)
      .join(', ')}]`
  );
  ctx.lines.push(
    `${indent}custom string[] archislop:linkLabels = [${resolved
      .map((entry) => `"${usdaEscape(entry.link.label ?? '')}"`)
      .join(', ')}]`
  );
}

function emitItem(ctx: EmitContext, collected: CollectedItem): void {
  const { item, kind } = collected;
  const { lines } = ctx;
  const label = typeof item.label === 'string' ? item.label : collected.sourceId;
  lines.push(`        def Xform "${collected.primName}" (`);
  lines.push(`            doc = "${usdaEscape(label)}"`);
  lines.push('        )');
  lines.push('        {');
  lines.push(`            custom string archislop:id = "${usdaEscape(collected.sourceId)}"`);
  lines.push(`            custom string archislop:label = "${usdaEscape(label)}"`);
  if (isPositionTuple(item.position)) {
    lines.push(
      `            custom double3 archislop:position = (${item.position.map(String).join(', ')})`
    );
  }
  if (typeof item.glyph === 'string') {
    lines.push(`            custom token archislop:glyph = "${usdaEscape(item.glyph)}"`);
  }
  if (typeof item.note === 'string') {
    lines.push(`            custom string archislop:note = "${usdaEscape(item.note)}"`);
  }
  for (const mapping of KIND_ITEM_FIELDS[kind]) {
    const value = item[mapping.field];
    if (value === undefined || value === null) continue;
    emitKindField(ctx, '            ', mapping, value);
  }
  emitOutgoingLinks(ctx, '            ', collected.sourceId);
  lines.push('        }');
}

function emitLayerAttributes(lines: string[], layer: MetaphorCompositeLayer): void {
  lines.push(`        custom string archislop:layerId = "${usdaEscape(layer.id)}"`);
  lines.push(`        custom token archislop:layerAs = "${layer.as}"`);
  if (layer.label) {
    lines.push(`        custom string archislop:layerLabel = "${usdaEscape(layer.label)}"`);
  }
  if (layer.transform) {
    if (isPositionTuple(layer.transform.position)) {
      lines.push(
        `        custom double3 archislop:layerPosition = (${layer.transform.position.map(String).join(', ')})`
      );
    }
    if (isFiniteNumber(layer.transform.scale)) {
      lines.push(`        custom double archislop:layerScale = ${String(layer.transform.scale)}`);
    }
  }
}

/**
 * Serialize a validated Metaphor3D DSL document to USDA text. Deterministic:
 * the same document always produces the same bytes.
 */
export function authorMetaphorUsda(dsl: MetaphorDsl): string {
  const scopes = collectScopes(dsl);
  const ctx: EmitContext = {
    lines: [],
    links: dsl.links ?? [],
    itemPathIndex: buildItemPathIndex(scopes)
  };
  const { lines } = ctx;

  lines.push(
    '#usda 1.0',
    '(',
    '    defaultPrim = "World"',
    '    upAxis = "Y"',
    '    metersPerUnit = 1',
    '    customLayerData = {'
  );
  for (const [key, value] of collectCustomLayerData(dsl)) {
    lines.push(`        string "${key}" = "${usdaEscape(value)}"`);
  }
  lines.push('    }', ')', '', 'def Xform "World"', '{');

  scopes.forEach((scope, scopeIndex) => {
    if (scopeIndex > 0) lines.push('');
    lines.push(`    def Xform "${scope.name}" (`);
    lines.push(`        doc = "${usdaEscape(scope.doc)}"`);
    lines.push('    )');
    lines.push('    {');
    if (scope.layer) {
      emitLayerAttributes(lines, scope.layer);
    }
    scope.items.forEach((item, itemIndex) => {
      if (scope.layer || itemIndex > 0) lines.push('');
      emitItem(ctx, item);
    });
    lines.push('    }');
  });

  lines.push('}', '');
  return lines.join('\n');
}
