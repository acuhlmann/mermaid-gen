import { peekDiagramDirective, stripLineComment } from './mermaidSourceLocate.js';
import { infographicLabelRef, parseInfographicGraphId } from './infographicGraphEdit.js';

const HEADER_RE = /^pie(?:\s+showData)?\b/i;
const TITLE_RE = /^title\s+/i;
const SLICE_RE = /^(?:"((?:[^"\\]|\\.)*)"|([^:]+?))\s*:\s*(\d+(?:\.\d+)?)\s*$/;

function fail(reason) {
  return { ok: false, reason };
}

function ok(source, extra = {}) {
  return { ok: true, source, ...extra };
}

function indentOf(line) {
  const match = String(line ?? '').match(/^[ \t]*/);
  return match ? match[0].length : 0;
}

function indentChars(line) {
  const match = String(line ?? '').match(/^[ \t]*/);
  return match ? match[0] : '';
}

function joinLines(source, lines) {
  const text = lines.join('\n');
  if (String(source).endsWith('\n') && !text.endsWith('\n')) return `${text}\n`;
  return text;
}

function unquoteLabel(label) {
  return String(label ?? '')
    .replace(/\\"/g, '"')
    .trim();
}

function quoteLabel(label) {
  const text = String(label ?? '').trim();
  if (!text) return '""';
  if (/^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(text) && !text.includes(':')) return `"${text}"`;
  return `"${text.replace(/"/g, '\\"')}"`;
}

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isPieFamilySource(source) {
  return peekDiagramDirective(source ?? '') === 'pie';
}

export { infographicLabelRef as pieLabelRef, parseInfographicGraphId as parsePieGraphId };

/**
 * @param {string} stripped
 * @returns {{ label: string, value: string } | null}
 */
export function parsePieSliceLine(stripped) {
  const text = String(stripped ?? '').trim();
  if (!text || text.startsWith('%%')) return null;
  if (HEADER_RE.test(text) || TITLE_RE.test(text)) return null;
  const match = SLICE_RE.exec(text);
  if (!match) return null;
  const label = unquoteLabel(match[1] ?? match[2] ?? '');
  if (!label) return null;
  return { label, value: match[3] };
}

/**
 * @typedef {{ index: number, start: number, end: number, indent: number, label: string, value: string }} PieSlice
 */

/**
 * @param {string} source
 * @returns {{ lines: string[], slices: PieSlice[] } | null}
 */
export function parsePieDoc(source) {
  const lines = String(source ?? '').split(/\r?\n/);
  let sawHeader = false;
  /** @type {PieSlice[]} */
  const slices = [];

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const stripped = stripLineComment(raw).trim();
    if (!stripped) continue;
    if (HEADER_RE.test(stripped)) {
      sawHeader = true;
      continue;
    }
    if (!sawHeader) continue;
    const parsed = parsePieSliceLine(stripped);
    if (!parsed) continue;
    slices.push({
      index: slices.length,
      start: i,
      end: i + 1,
      indent: indentOf(raw),
      label: parsed.label,
      value: parsed.value
    });
  }

  if (!sawHeader || slices.length === 0) return null;
  return { lines, slices };
}

/**
 * @param {PieSlice[]} slices
 * @param {{ indexes?: number[] | null, label?: string | null }} ref
 * @returns {PieSlice | null}
 */
function findPieSlice(slices, ref) {
  if (ref.indexes && ref.indexes.length === 1) {
    const hit = slices.find((slice) => slice.index === ref.indexes[0]);
    if (hit) return hit;
  }
  if (ref.label) {
    return slices.find((slice) => slice.label === ref.label) ?? null;
  }
  return null;
}

/**
 * @param {PieSlice[]} slices
 */
function collectPieLabels(slices) {
  const labels = new Set();
  for (const slice of slices) labels.add(slice.label);
  return labels;
}

function allocateLabel(existing) {
  let n = 1;
  while (existing.has(`Slice ${n}`)) n += 1;
  return `Slice ${n}`;
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} [label]
 */
export function addLinkedPieNode(source, fromId, label = '') {
  const doc = parsePieDoc(source);
  if (!doc) return fail('not-graph');
  const from = findPieSlice(doc.slices, parseInfographicGraphId(fromId));
  if (!from) return fail('missing');
  const text = String(label || '').trim() || allocateLabel(collectPieLabels(doc.slices));
  const next = [...doc.lines];
  const pad = indentChars(doc.lines[from.start]);
  next.splice(from.end, 0, `${pad}${quoteLabel(text)} : ${from.value}`);
  return ok(joinLines(source, next), { newId: String(from.index + 1), newLabel: text });
}

/**
 * @param {string} source
 * @param {string} nodeId
 */
export function deletePieNode(source, nodeId) {
  const doc = parsePieDoc(source);
  if (!doc) return fail('not-graph');
  const slice = findPieSlice(doc.slices, parseInfographicGraphId(nodeId));
  if (!slice) return fail('missing');
  if (doc.slices.length <= 1) return fail('last');
  const next = [...doc.lines];
  next.splice(slice.start, 1);
  return ok(joinLines(source, next));
}

/**
 * @param {string} source
 * @param {string} nodeId
 * @param {string} label
 */
export function renamePieNode(source, nodeId, label) {
  const doc = parsePieDoc(source);
  if (!doc) return fail('not-graph');
  const text = String(label ?? '').trim();
  if (!text) return fail('empty');
  const slice = findPieSlice(doc.slices, parseInfographicGraphId(nodeId));
  if (!slice) return fail('missing');
  const next = [...doc.lines];
  const pad = indentChars(doc.lines[slice.start]);
  next[slice.start] = `${pad}${quoteLabel(text)} : ${slice.value}`;
  return ok(joinLines(source, next));
}

export function connectPieNodes() {
  return fail('no-link');
}

export function deletePieEdge() {
  return fail('not-graph');
}

export function renamePieEdge() {
  return fail('not-graph');
}
