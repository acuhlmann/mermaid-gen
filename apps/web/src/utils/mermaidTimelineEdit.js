import { peekDiagramDirective, stripLineComment } from './mermaidSourceLocate.js';
import { infographicLabelRef, parseInfographicGraphId } from './infographicGraphEdit.js';

const NODE_REF_PREFIX = '~node:';
const SECTION_RE = /^section\s+(.+)$/i;
const TITLE_RE = /^title\s+/i;
const HEADER_RE = /^timeline\b/i;

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

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isTimelineFamilySource(source) {
  return peekDiagramDirective(source ?? '') === 'timeline';
}

export { infographicLabelRef as timelineLabelRef, parseInfographicGraphId as parseTimelineGraphId };

/**
 * @param {number} index
 */
export function timelineNodeRef(index) {
  return `${NODE_REF_PREFIX}${index}`;
}

/**
 * @param {string} id
 * @returns {number | null}
 */
export function parseTimelineNodeIndex(id) {
  const raw = String(id ?? '').trim();
  if (raw.startsWith(NODE_REF_PREFIX)) {
    const n = Number.parseInt(raw.slice(NODE_REF_PREFIX.length), 10);
    return Number.isInteger(n) && n >= 0 ? n : null;
  }
  if (/^\d+$/.test(raw)) return Number.parseInt(raw, 10);
  const match = /^node[-_](\d+)$/i.exec(raw);
  if (match) return Number.parseInt(match[1], 10);
  return null;
}

/**
 * @param {string} stripped
 * @returns {{ primary: string, tail: string, lineKind: 'event' | 'section' | 'meta' } | null}
 */
export function parseTimelineLine(stripped) {
  const text = String(stripped ?? '').trim();
  if (!text || text.startsWith('%%')) return null;
  if (HEADER_RE.test(text) || TITLE_RE.test(text))
    return { primary: '', tail: '', lineKind: 'meta' };
  const sectionMatch = SECTION_RE.exec(text);
  if (sectionMatch) {
    return { primary: sectionMatch[1].trim(), tail: '', lineKind: 'section' };
  }
  const colonIdx = text.indexOf(':');
  if (colonIdx === -1) return null;
  const primary = text.slice(0, colonIdx).trim();
  const tail = text.slice(colonIdx + 1).trim();
  if (!primary) return null;
  return { primary, tail, lineKind: 'event' };
}

/**
 * @typedef {{ index: number, start: number, end: number, indent: number, primary: string, tail: string, sectionIndex: number }} TimelineEvent
 */

/**
 * @param {string} source
 * @returns {{ lines: string[], events: TimelineEvent[] } | null}
 */
export function parseTimelineDoc(source) {
  const lines = String(source ?? '').split(/\r?\n/);
  let sawHeader = false;
  /** @type {TimelineEvent[]} */
  const events = [];
  let sectionIndex = -1;
  let eventIndex = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const stripped = stripLineComment(raw).trim();
    if (!stripped) continue;
    if (HEADER_RE.test(stripped)) {
      sawHeader = true;
      continue;
    }
    if (!sawHeader) continue;
    const parsed = parseTimelineLine(stripped);
    if (!parsed || parsed.lineKind === 'meta') continue;
    if (parsed.lineKind === 'section') {
      sectionIndex += 1;
      eventIndex = 0;
      continue;
    }
    events.push({
      index: events.length,
      start: i,
      end: i + 1,
      indent: indentOf(raw),
      primary: parsed.primary,
      tail: parsed.tail,
      sectionIndex: Math.max(sectionIndex, 0)
    });
    eventIndex += 1;
  }

  if (!sawHeader || events.length === 0) return null;
  return { lines, events };
}

/**
 * @param {TimelineEvent[]} events
 * @param {{ indexes?: number[] | null, label?: string | null }} ref
 * @returns {TimelineEvent | null}
 */
function findTimelineEvent(events, ref) {
  if (ref.indexes && ref.indexes.length === 1) {
    const hit = events.find((event) => event.index === ref.indexes[0]);
    if (hit) return hit;
  }
  if (ref.label) {
    return events.find((event) => event.primary === ref.label) ?? null;
  }
  return null;
}

/**
 * @param {TimelineEvent[]} events
 */
function collectTimelineLabels(events) {
  const labels = new Set();
  for (const event of events) {
    if (event.primary) labels.add(event.primary);
  }
  return labels;
}

function allocateLabel(existing) {
  let n = 1;
  while (existing.has(`Event ${n}`)) n += 1;
  return `Event ${n}`;
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} [label]
 */
export function addLinkedTimelineNode(source, fromId, label = '') {
  const doc = parseTimelineDoc(source);
  if (!doc) return fail('not-graph');
  const from = findTimelineEvent(doc.events, parseInfographicGraphId(fromId));
  if (!from) return fail('missing');
  const text = String(label || '').trim() || allocateLabel(collectTimelineLabels(doc.events));
  const next = [...doc.lines];
  const pad = indentChars(doc.lines[from.start]);
  const tail = from.tail ? ` : ${from.tail}` : '';
  next.splice(from.end, 0, `${pad}${text}${tail}`);
  const newIndex = from.index + 1;
  return ok(joinLines(source, next), { newId: String(newIndex), newLabel: text });
}

/**
 * @param {string} source
 * @param {string} nodeId
 */
export function deleteTimelineNode(source, nodeId) {
  const doc = parseTimelineDoc(source);
  if (!doc) return fail('not-graph');
  const node = findTimelineEvent(doc.events, parseInfographicGraphId(nodeId));
  if (!node) return fail('missing');
  if (doc.events.length <= 1) return fail('last');
  const next = [...doc.lines];
  next.splice(node.start, 1);
  return ok(joinLines(source, next));
}

/**
 * @param {string} source
 * @param {string} nodeId
 * @param {string} label
 */
export function renameTimelineNode(source, nodeId, label) {
  const doc = parseTimelineDoc(source);
  if (!doc) return fail('not-graph');
  const text = String(label ?? '').trim();
  if (!text) return fail('empty');
  const node = findTimelineEvent(doc.events, parseInfographicGraphId(nodeId));
  if (!node) return fail('missing');
  const next = [...doc.lines];
  const pad = indentChars(doc.lines[node.start]);
  const tail = node.tail ? ` : ${node.tail}` : '';
  next[node.start] = `${pad}${text}${tail}`;
  return ok(joinLines(source, next));
}

export function connectTimelineNodes() {
  return fail('no-link');
}

export function deleteTimelineEdge() {
  return fail('not-graph');
}

export function renameTimelineEdge() {
  return fail('not-graph');
}
