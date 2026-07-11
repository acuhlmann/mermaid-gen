/**
 * Legend + metric vocabulary for metaphor3d scenes.
 *
 * The metaphor agent authors `scene.legend.<axis>` strings (e.g. height = "team
 * size") and per-item numeric encodings, but until now neither was surfaced to
 * the viewer. These helpers drive two overlays that finally show them:
 *   - the always-on legend panel (which axes a scene actually labelled), and
 *   - the hover tooltip (one item's encoded metrics, in the author's words).
 *
 * Axis keys mirror `MetaphorLegendSchema` and the per-metaphor item fields in
 * packages/shared/src/metaphorSchema.ts — keep them in sync if the schema moves.
 */

/** Ordered [legendKey, displayLabel] pairs per metaphor, in render order. */
export const METAPHOR_LEGEND_AXES = {
  city: [
    ['height', 'Height'],
    ['footprint', 'Footprint'],
    ['district', 'District']
  ],
  layercake: [['thickness', 'Thickness']],
  galaxy: [
    ['magnitude', 'Magnitude'],
    ['cluster', 'Cluster']
  ],
  tree: [['weight', 'Weight']],
  terrain: [
    ['elevation', 'Elevation'],
    ['intensity', 'Intensity']
  ],
  orrery: [
    ['orbit', 'Orbit'],
    ['size', 'Size']
  ],
  river: [
    ['stage', 'Stage'],
    ['flow', 'Flow']
  ],
  garden: [
    ['maturity', 'Maturity'],
    ['impact', 'Impact'],
    ['bed', 'Bed'],
    ['health', 'Health']
  ]
};

/**
 * Per-item metric specs for the hover tooltip. `number` rows show the encoded
 * value; `text` rows show a grouping name. Keys intentionally match the legend
 * keys above so a custom legend label can relabel the matching tooltip row.
 */
const ITEM_METRICS = {
  city: [
    { key: 'height', label: 'Height', type: 'number' },
    { key: 'footprint', label: 'Footprint', type: 'number' },
    { key: 'district', label: 'District', type: 'text' }
  ],
  layercake: [{ key: 'thickness', label: 'Thickness', type: 'number' }],
  galaxy: [
    { key: 'magnitude', label: 'Magnitude', type: 'number' },
    { key: 'cluster', label: 'Cluster', type: 'text' }
  ],
  tree: [{ key: 'weight', label: 'Weight', type: 'number' }],
  terrain: [
    { key: 'elevation', label: 'Elevation', type: 'number' },
    { key: 'intensity', label: 'Intensity', type: 'number' }
  ],
  orrery: [
    { key: 'orbit', label: 'Orbit', type: 'number' },
    { key: 'size', label: 'Size', type: 'number' }
  ],
  river: [
    { key: 'stage', label: 'Stage', type: 'number' },
    { key: 'flow', label: 'Flow', type: 'number' },
    { key: 'hazard', label: 'Hazard', type: 'number' }
  ],
  garden: [
    { key: 'maturity', label: 'Maturity', type: 'number' },
    { key: 'impact', label: 'Impact', type: 'number' },
    { key: 'bed', label: 'Bed', type: 'text' },
    { key: 'health', label: 'Health', type: 'text' }
  ]
};

function capitalizeFirst(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Round to one decimal, dropping a trailing ".0". */
function formatNumber(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * The label to show for an axis: the author's legend phrase when present (so the
 * tooltip reads "Monthly transaction volume: 12" not "Height: 12"), else the
 * generic axis label.
 */
function legendLabel(legend, key, fallback) {
  const custom =
    legend && typeof legend[key] === 'string' && legend[key].trim() ? legend[key].trim() : '';
  return custom ? capitalizeFirst(custom) : fallback;
}

/**
 * Legend rows to render for a scene: only the axes the author actually populated
 * (non-empty string). Unknown metaphor or missing legend → [].
 *
 * @param {string} metaphor
 * @param {Record<string, unknown> | null | undefined} legend
 * @returns {Array<{ key: string, label: string, text: string }>}
 */
export function legendAxesFor(metaphor, legend) {
  const axes = METAPHOR_LEGEND_AXES[metaphor] ?? [];
  if (!legend || typeof legend !== 'object') return [];
  return axes
    .filter(([key]) => typeof legend[key] === 'string' && legend[key].trim())
    .map(([key, label]) => ({ key, label, text: String(legend[key]).trim() }));
}

/** One tooltip row from a metric spec, or null when the field is absent/invalid. */
function buildMetricRow(spec, item, legend) {
  const raw = item[spec.key];
  if (spec.type === 'number') {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
    return { label: legendLabel(legend, spec.key, spec.label), value: formatNumber(raw) };
  }
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return { label: legendLabel(legend, spec.key, spec.label), value: raw.trim() };
}

/**
 * Tooltip content for one scene item: its label, the encoded metric rows present
 * on the item (numbers formatted, grouping names passed through), and its glyph.
 * Number rows use the author's legend phrase as their label when available.
 *
 * @param {string} metaphor
 * @param {Record<string, unknown> | null | undefined} item
 * @param {Record<string, unknown> | null | undefined} [legend]
 * @returns {{ label: string, rows: Array<{ label: string, value: string }>, glyph: string | undefined }}
 */
export function formatItemMetric(metaphor, item, legend = null) {
  if (!item || typeof item !== 'object') return { label: '', rows: [], glyph: undefined };
  const specs = ITEM_METRICS[metaphor] ?? [];
  const rows = specs.map((spec) => buildMetricRow(spec, item, legend)).filter(Boolean);
  return {
    label: typeof item.label === 'string' ? item.label : '',
    rows,
    glyph: typeof item.glyph === 'string' ? item.glyph : undefined
  };
}
