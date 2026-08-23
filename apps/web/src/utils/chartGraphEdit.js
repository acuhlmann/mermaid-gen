/**
 * Deterministic Add / Delete / Rename for chart DSL rows in spec.data.values.
 * Node identity is the Vega datum row index ("0"…"n-1"). Link stays off.
 */

import { parseChartDsl } from '@archislop/shared';

const ENCODING_CHANNELS = [
  'x',
  'y',
  'color',
  'theta',
  'size',
  'shape',
  'opacity',
  'text',
  'detail',
  'order',
  'facet',
  'row',
  'column'
];

function fail(reason) {
  return { ok: false, reason };
}

function ok(source, extra = {}) {
  return { ok: true, source, ...extra };
}

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isChartValuesFamilySource(source) {
  const doc = parseChartValuesDoc(source);
  return doc != null && doc.values.length > 0;
}

/**
 * @param {string} source
 * @returns {{ dsl: object, values: Record<string, unknown>[] } | null}
 */
function parseChartValuesDoc(source) {
  const parsed = parseChartDsl(source);
  if (!parsed.ok) return null;
  const data = parsed.dsl.spec?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const values = data.values;
  if (!Array.isArray(values) || values.length === 0) return null;
  if (!values.every((row) => row && typeof row === 'object' && !Array.isArray(row))) return null;
  return { dsl: parsed.dsl, values };
}

/**
 * @param {object} dsl
 * @param {string} source
 */
function serializeChartDoc(dsl, source) {
  const text = JSON.stringify(dsl, null, 2);
  return String(source).endsWith('\n') ? `${text}\n` : text;
}

/**
 * @param {Record<string, unknown>} spec
 * @returns {Array<{ field: string, type: string }>}
 */
function encodingFieldDefs(spec) {
  const enc = spec?.encoding;
  if (!enc || typeof enc !== 'object') return [];
  const out = [];
  for (const channel of ENCODING_CHANNELS) {
    const def = enc[channel];
    if (!def || typeof def !== 'object') continue;
    const field = def.field;
    if (typeof field !== 'string' || !field) continue;
    const type = typeof def.type === 'string' ? def.type : 'nominal';
    out.push({ field, type });
  }
  return out;
}

/**
 * @param {Record<string, unknown>} spec
 * @param {Record<string, unknown>} row
 */
function labelFieldForRow(spec, row) {
  const encodings = encodingFieldDefs(spec);
  const categorical = encodings.filter(
    (entry) => entry.type === 'nominal' || entry.type === 'ordinal'
  );
  for (const { field } of categorical) {
    if (Object.prototype.hasOwnProperty.call(row, field)) return field;
  }
  for (const key of Object.keys(row)) {
    if (typeof row[key] === 'string') return key;
  }
  if (encodings.length) return encodings[0].field;
  const keys = Object.keys(row);
  return keys[0] ?? null;
}

/**
 * @param {Record<string, unknown>[]} values
 * @param {string | null} labelField
 */
function collectRowLabels(values, labelField) {
  const labels = new Set();
  if (!labelField) return labels;
  for (const row of values) {
    const text = row[labelField];
    if (typeof text === 'string' && text.trim()) labels.add(text.trim());
  }
  return labels;
}

/**
 * @param {Set<string>} labels
 */
function allocateRowLabel(labels) {
  let n = 1;
  while (labels.has(`Item ${n}`)) n += 1;
  return `Item ${n}`;
}

/**
 * @param {Record<string, unknown>} template
 * @param {string | null} labelField
 * @param {string} label
 */
function cloneRow(template, labelField, label) {
  const next = {};
  for (const key of Object.keys(template)) {
    const val = template[key];
    if (key === labelField) {
      next[key] = label;
      continue;
    }
    if (typeof val === 'number') {
      next[key] = 0;
    } else if (typeof val === 'string') {
      next[key] = '';
    } else if (typeof val === 'boolean') {
      next[key] = false;
    } else {
      next[key] = val;
    }
  }
  if (labelField && !(labelField in next)) next[labelField] = label;
  return next;
}

/**
 * @param {string} nodeId
 */
function parseRowIndex(nodeId) {
  const index = Number.parseInt(String(nodeId ?? '').trim(), 10);
  if (!Number.isInteger(index) || index < 0) return null;
  return index;
}

function requireValues(source) {
  const doc = parseChartValuesDoc(source);
  if (!doc) return { doc: null, blocked: fail('not-graph') };
  return { doc, blocked: null };
}

/**
 * @param {string} source
 * @param {string} fromId row index
 * @param {string} [label]
 */
export function addLinkedChartRow(source, fromId, label = '') {
  const { doc, blocked } = requireValues(source);
  if (blocked) return blocked;
  const index = parseRowIndex(fromId);
  if (index == null || index >= doc.values.length) return fail('missing');

  const labelField = labelFieldForRow(doc.dsl.spec, doc.values[index]);
  const text =
    String(label ?? '').trim() || allocateRowLabel(collectRowLabels(doc.values, labelField));
  const insertAt = index + 1;
  const newRow = cloneRow(doc.values[index], labelField, text);
  doc.values.splice(insertAt, 0, newRow);

  return ok(serializeChartDoc(doc.dsl, source), {
    newId: String(insertAt),
    newLabel: text
  });
}

/**
 * @param {string} source
 * @param {string} nodeId row index
 */
export function deleteChartRow(source, nodeId) {
  const { doc, blocked } = requireValues(source);
  if (blocked) return blocked;
  const index = parseRowIndex(nodeId);
  if (index == null || index >= doc.values.length) return fail('missing');
  if (doc.values.length <= 1) return fail('last');

  doc.values.splice(index, 1);
  return ok(serializeChartDoc(doc.dsl, source));
}

/**
 * @param {string} source
 * @param {string} nodeId row index
 * @param {string} label
 */
export function renameChartRow(source, nodeId, label) {
  const { doc, blocked } = requireValues(source);
  if (blocked) return blocked;
  const index = parseRowIndex(nodeId);
  if (index == null || index >= doc.values.length) return fail('missing');

  const next = String(label ?? '').trim();
  if (!next) return fail('empty');

  const row = doc.values[index];
  const labelField = labelFieldForRow(doc.dsl.spec, row);
  if (!labelField) return fail('missing');

  const current = row[labelField];
  if (typeof current === 'string' && current.trim() === next) return ok(source);

  row[labelField] = next;
  return ok(serializeChartDoc(doc.dsl, source));
}

export function connectChartRows() {
  return fail('no-link');
}

export function deleteChartEdge() {
  return fail('not-graph');
}

export function renameChartEdge() {
  return fail('not-graph');
}
