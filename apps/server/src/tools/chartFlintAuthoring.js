import { assembleVegaLite } from 'flint-chart/vegalite';
import { stripPrivateKeys, validateChart } from 'flint-chart/validate';
import { parseJsonTrimmingSurplusClosers } from '@archislop/shared';
import { listFlintChartTypes } from '../prompts/chartFlintSystemPrompt.js';

/**
 * Flint as the chart slot's source format.
 *
 * The model writes a compact Flint spec (data + semantic types + chart type + field
 * mappings). The stored wrapper keeps that spec as the source of truth and carries the
 * compiled Vega-Lite beside it, so the renderer, themes, hit-testing, canvas edits and MCP
 * Apps keep reading `spec` unchanged while exports can compile `flint` to other backends:
 *
 *   { archislopVersion, theme, flint, vegaConfig?, spec }
 *
 * - `flint`      — the Flint input (`data`, `semantic_types`, `chart_spec`). Source of truth.
 * - `vegaConfig` — Vega-Lite `config` overrides from Style edits, merged over Flint's own
 *                  config on every compile, so a restyle survives the next content edit.
 * - `spec`       — derived. Recompiled from `flint` on every write; never edited directly.
 *
 * One exception keeps hand edits honest: when `spec` changed but `flint` and `vegaConfig`
 * did not, someone edited the Vega-Lite itself (the source editor), so the chart becomes a
 * plain Vega-Lite chart rather than having their edit silently recompiled away.
 *
 * `CHART_AUTHORING` only chooses which format the agent is prompted to write (Flint unless
 * set to `vegalite`); the validator always understands both.
 */

export const CHART_VEGA_LITE_SCHEMA_URL = 'https://vega.github.io/schema/vega-lite/v5.json';

/** Flint's own target size is 400×320; plan for the size ChartRenderer draws at instead. */
const DEFAULT_FLINT_BASE_SIZE = { width: 720, height: 440 };

export function isFlintChartAuthoringEnabled(env = process.env) {
  return String(env?.CHART_AUTHORING ?? '').toLowerCase() !== 'vegalite';
}

function stripJsonCodeFence(raw) {
  const trimmed = raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

/**
 * The archislop theme owns the categorical palette (`config.range.category`), but Flint
 * pins one per nominal color encoding (`scale.scheme: "tableau10"`), which would win.
 * Sequential and diverging schemes on quantitative color are Flint's real value-add and
 * the themes do not set one, so those stay.
 */
function releaseCategoricalSchemes(node) {
  if (!node || typeof node !== 'object') return;
  const color = node.encoding?.color;
  if (color && color.type === 'nominal' && color.scale && 'scheme' in color.scale) {
    const { scheme: _scheme, ...rest } = color.scale;
    if (Object.keys(rest).length > 0) color.scale = rest;
    else delete color.scale;
  }
  for (const key of ['layer', 'hconcat', 'vconcat', 'concat']) {
    if (Array.isArray(node[key])) node[key].forEach(releaseCategoricalSchemes);
  }
  if (node.spec) releaseCategoricalSchemes(node.spec);
}

const ENGLISH_CALENDAR_NAMES = new Set(
  [
    'january february march april may june july august september october november december',
    'jan feb mar apr jun jul aug sep sept oct nov dec',
    'monday tuesday wednesday thursday friday saturday sunday',
    'mon tue tues wed thu thur thurs fri sat sun'
  ]
    .join(' ')
    .split(' ')
);

const isEnglishCalendarName = (value) =>
  typeof value === 'string' &&
  ENGLISH_CALENDAR_NAMES.has(value.trim().replace(/\.$/, '').toLowerCase());

/**
 * Flint (1.0.1) orders month and weekday names it recognises — English ones — and pushes
 * the rest to the end, so German "Mär, Mai, Okt, Dez" land after "Dez"'s neighbours.
 * When a channel's computed sort contains a name Flint cannot know, the model's own row
 * order is the better signal: use first-appearance order instead.
 */
function keepDataOrderForLocalizedCalendarNames(spec) {
  const rows = spec?.data?.values;
  if (!Array.isArray(rows) || !spec.encoding) return;
  for (const channel of Object.values(spec.encoding)) {
    const order = dataOrderForLocalizedSort(channel, rows);
    if (order) channel.sort = order;
  }
}

/** First-appearance order of `channel.field`, when its computed sort mixes in unknown names. */
function dataOrderForLocalizedSort(channel, rows) {
  if (!channel || !Array.isArray(channel.sort) || typeof channel.field !== 'string') return null;
  const known = channel.sort.filter(isEnglishCalendarName).length;
  if (known === 0 || known === channel.sort.length) return null;
  const seen = [];
  for (const row of rows) {
    const value = row?.[channel.field];
    if (value !== undefined && !seen.includes(value)) seen.push(value);
  }
  return seen.length === channel.sort.length ? seen : null;
}

function describeErrors(errors, chartType) {
  const lines = errors.map((e) => e.message || e.code || 'unknown error');
  if (lines.some((line) => /Unknown chart type/i.test(line))) {
    const names = listFlintChartTypes()
      .map((t) => t.chart)
      .join(', ');
    lines.push(`chart_spec.chartType "${chartType}" must be one of: ${names}.`);
  }
  return lines.join('; ');
}

/** Parse `source` as a Flint wrapper, or return null when it is not one. */
function parseFlintWrapper(source) {
  if (typeof source !== 'string') return null;
  let raw;
  try {
    raw = parseJsonTrimmingSurplusClosers(stripJsonCodeFence(source));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !('flint' in raw)) return null;
  return raw;
}

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** JSON with sorted keys, so two parses of the same document compare equal. */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

const sameJson = (a, b) => stableStringify(a ?? null) === stableStringify(b ?? null);

/** Shape errors Flint's validator would report less helpfully, or null when the shape is fine. */
function checkWrapperShape(raw) {
  if (raw.vegaConfig !== undefined && !isPlainObject(raw.vegaConfig)) {
    return 'Chart DSL "vegaConfig" must be an object of Vega-Lite config overrides.';
  }
  const flint = raw.flint;
  if (!flint || typeof flint !== 'object' || Array.isArray(flint)) {
    return 'Chart DSL "flint" must be an object.';
  }
  if (!Array.isArray(flint.data?.values) || flint.data.values.length === 0) {
    return 'flint.data.values must be a non-empty array of row objects (inline data only).';
  }
  if (!flint.chart_spec || typeof flint.chart_spec !== 'object') {
    return 'flint.chart_spec is required: { "chartType": ..., "encodings": { ... } }.';
  }
  return null;
}

/** Run Flint's validator then its Vega-Lite assembler. */
function assembleFlint(input) {
  let validation;
  try {
    validation = validateChart(input, 'vegalite');
  } catch (err) {
    return {
      error: `Flint validateChart() threw: ${err instanceof Error ? err.message : String(err)}`
    };
  }
  if (!validation.valid) {
    return {
      error: `Flint rejected the chart: ${describeErrors(validation.errors, input.chart_spec.chartType)}`
    };
  }
  try {
    const spec = stripPrivateKeys(assembleVegaLite(input));
    releaseCategoricalSchemes(spec);
    keepDataOrderForLocalizedCalendarNames(spec);
    return { spec, validation };
  } catch (err) {
    return {
      error: `Flint assembleVegaLite() failed: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

/** One level deep: `{ axis: { gridColor } }` over `{ axis: { labelFontSize } }` keeps both. */
function mergeVegaConfig(base, overrides) {
  if (!isPlainObject(overrides)) return base;
  const merged = { ...(isPlainObject(base) ? base : {}) };
  for (const [key, value] of Object.entries(overrides)) {
    merged[key] =
      isPlainObject(value) && isPlainObject(merged[key]) ? { ...merged[key], ...value } : value;
  }
  return merged;
}

/** The Flint input as stored: only the parts this slot uses, in a fixed shape. */
function normalizeFlintInput(flint) {
  return {
    data: { values: flint.data.values },
    ...(flint.semantic_types ? { semantic_types: flint.semantic_types } : {}),
    chart_spec: flint.chart_spec
  };
}

/** The stored Flint wrapper this write replaces, or null. */
function parsePrevious(previousSource) {
  if (typeof previousSource !== 'string' || !previousSource.trim()) return null;
  const previous = parseFlintWrapper(previousSource);
  return previous && isPlainObject(previous.flint) ? previous : null;
}

/**
 * True when the incoming wrapper changed only its Vega-Lite `spec` relative to the stored
 * one — a hand edit of the derived spec, which must win over recompiling.
 */
function isHandEditedSpec(raw, previous) {
  if (!previous || !('spec' in raw)) return false;
  return (
    sameJson(normalizeFlintInput(previous.flint), normalizeFlintInput(raw.flint)) &&
    sameJson(previous.vegaConfig, raw.vegaConfig) &&
    !sameJson(previous.spec, raw.spec)
  );
}

/**
 * The stored `{ archislopVersion, theme, flint, vegaConfig?, spec }`. A content edit that
 * leaves `vegaConfig` out keeps the chart's style; `"vegaConfig": {}` is how a restyle
 * clears it.
 */
function buildStoredWrapper(raw, flint, assembledSpec, previous) {
  const vegaConfig = 'vegaConfig' in raw ? raw.vegaConfig : previous?.vegaConfig;
  const keepStyle = isPlainObject(vegaConfig) && Object.keys(vegaConfig).length > 0;
  const spec = { $schema: CHART_VEGA_LITE_SCHEMA_URL, ...assembledSpec };
  if (keepStyle) spec.config = mergeVegaConfig(spec.config, vegaConfig);
  return {
    archislopVersion: raw.archislopVersion ?? 1,
    ...(raw.theme !== undefined ? { theme: raw.theme } : {}),
    flint,
    ...(keepStyle ? { vegaConfig } : {}),
    spec
  };
}

/**
 * Compile a Flint-sourced wrapper into the stored shape.
 *
 * Returns `{ handled: false }` when the source is not a Flint wrapper (the Vega-Lite ladder
 * sees it untouched, including its own JSON errors). Returns `{ handled: true, ok: true,
 * text }` with the stored wrapper JSON — or, for a hand edit of the derived spec, the plain
 * Vega-Lite wrapper with `flint` dropped — else `{ handled: true, ok: false, error }` with a
 * message a repair turn can act on.
 *
 * @param {string} source
 * @param {{ previousSource?: string }} [options] the slot's current source, to detect hand edits
 */
export function compileFlintChartWrapper(source, { previousSource } = {}) {
  const raw = parseFlintWrapper(source);
  if (!raw) return { handled: false };
  const shapeError = checkWrapperShape(raw);
  if (shapeError) return { handled: true, ok: false, error: shapeError };

  const previous = parsePrevious(previousSource);
  if (isHandEditedSpec(raw, previous)) {
    const { flint: _flint, vegaConfig: _vegaConfig, ...vegaLiteWrapper } = raw;
    return { handled: true, ok: true, text: JSON.stringify(vegaLiteWrapper), droppedFlint: true };
  }

  // Inline data only: a `url` would make the compiler (and later the renderer) fetch.
  const flint = normalizeFlintInput(raw.flint);
  const input = {
    ...flint,
    chart_spec: { baseSize: DEFAULT_FLINT_BASE_SIZE, ...flint.chart_spec }
  };
  const assembled = assembleFlint(input);
  if (assembled.error) return { handled: true, ok: false, error: assembled.error };

  const wrapper = buildStoredWrapper(raw, flint, assembled.spec, previous);
  const warnings = (assembled.validation.warnings ?? [])
    .filter((w) => w.severity === 'warning')
    .map((w) => w.message);

  return {
    handled: true,
    ok: true,
    text: JSON.stringify(wrapper),
    chartType: assembled.validation.chartType,
    warnings
  };
}

/**
 * What the model is shown of a stored chart: the Flint source and style overrides without
 * the derived Vega-Lite, which it must not edit (and which is several times larger).
 * A plain Vega-Lite chart is returned unchanged.
 */
export function chartSourceForModel(source) {
  const raw = parseFlintWrapper(source);
  if (!raw || !isPlainObject(raw.flint)) return source;
  const { spec: _spec, ...rest } = raw;
  return JSON.stringify(rest, null, 2);
}
