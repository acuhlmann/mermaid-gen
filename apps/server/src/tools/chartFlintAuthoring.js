import { assembleVegaLite } from 'flint-chart/vegalite';
import { stripPrivateKeys, validateChart } from 'flint-chart/validate';
import { parseJsonTrimmingSurplusClosers } from '@archislop/shared';
import { listFlintChartTypes } from '../prompts/chartFlintSystemPrompt.js';

/**
 * Flint authoring trial for chart mode (flag: `CHART_AUTHORING=flint`).
 *
 * The model writes a compact Flint spec (data + semantic types + chart type + field
 * mappings) inside the usual archislop wrapper, under `flint` instead of `spec`. This
 * module validates it with Flint's own validator and compiles it to Vega-Lite, so the
 * slot still stores a plain `{archislopVersion, theme, spec}` wrapper and nothing past
 * the server tool — renderer, themes, hit-testing, canvas edits, MCP Apps — changes.
 *
 * A Vega-Lite wrapper is still accepted while the flag is on, because Style mode edits the
 * stored spec's `config` directly.
 */

export const CHART_VEGA_LITE_SCHEMA_URL = 'https://vega.github.io/schema/vega-lite/v5.json';

/** Flint's own target size is 400×320; plan for the size ChartRenderer draws at instead. */
const DEFAULT_FLINT_BASE_SIZE = { width: 720, height: 440 };

export function isFlintChartAuthoringEnabled(env = process.env) {
  return String(env?.CHART_AUTHORING ?? '').toLowerCase() === 'flint';
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
    if (!channel || !Array.isArray(channel.sort) || typeof channel.field !== 'string') continue;
    if (channel.sort.every(isEnglishCalendarName)) continue;
    if (!channel.sort.some(isEnglishCalendarName)) continue;
    const seen = [];
    for (const row of rows) {
      const value = row?.[channel.field];
      if (value !== undefined && !seen.includes(value)) seen.push(value);
    }
    if (seen.length === channel.sort.length) channel.sort = seen;
  }
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

/** Shape errors Flint's validator would report less helpfully, or null when the shape is fine. */
function checkWrapperShape(raw) {
  if ('spec' in raw) return 'Chart DSL must carry either "flint" or "spec", not both.';
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

/**
 * Turn a Flint-authored wrapper into a Vega-Lite wrapper.
 *
 * Returns `{ handled: false }` when the source is not a Flint wrapper (let the normal
 * Vega-Lite ladder see it untouched, including its own JSON errors), `{ handled: true,
 * ok: true, text }` with the compiled wrapper JSON, or `{ handled: true, ok: false,
 * error }` with a message a repair turn can act on.
 */
export function compileFlintChartWrapper(source) {
  const raw = parseFlintWrapper(source);
  if (!raw) return { handled: false };
  const shapeError = checkWrapperShape(raw);
  if (shapeError) return { handled: true, ok: false, error: shapeError };

  // Inline data only: a `url` would make the compiler (and later the renderer) fetch.
  const { flint } = raw;
  const input = {
    data: { values: flint.data.values },
    ...(flint.semantic_types ? { semantic_types: flint.semantic_types } : {}),
    chart_spec: { baseSize: DEFAULT_FLINT_BASE_SIZE, ...flint.chart_spec }
  };
  const assembled = assembleFlint(input);
  if (assembled.error) return { handled: true, ok: false, error: assembled.error };

  const wrapper = {
    archislopVersion: raw.archislopVersion ?? 1,
    ...(raw.theme !== undefined ? { theme: raw.theme } : {}),
    spec: { $schema: CHART_VEGA_LITE_SCHEMA_URL, ...assembled.spec }
  };
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
