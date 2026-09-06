import { pickParallelEdgeRef } from './mermaidEdgeDisambiguation.js';
import { peekDiagramDirective, stripLineComment } from './mermaidSourceLocate.js';

const CLASS_ID_RE = /^[A-Za-z][A-Za-z0-9_~]*$/;
const CLASS_MEMBER_RE = /^\s*(\S+)\s*:\s+(.+)$/;
const CLASS_BLOCK_OPEN_RE = /^\s*class\s+(\S+)\s*\{\s*$/i;
const CLASS_ANNOTATION_RE = /^\s*<<\S+>>\s+(\S+)\s*$/;
const META_LINE_RE =
  /^(?:classDiagram|classDef|class|direction|note|namespace|hide\s+empty|style|linkStyle)\b/i;
const RESERVED_IDS = new Set(['class', 'classDef', 'direction', 'note', 'namespace', 'style']);

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
export function isClassFamilySource(source) {
  return peekDiagramDirective(source ?? '') === 'class';
}

const CLASS_RELATION_ARROW_RE = /^[<|*ox.~\->]+$/i;

/**
 * @param {string} token
 * @returns {boolean}
 */
function isClassRelationArrow(token) {
  const arrow = String(token ?? '').trim();
  if (!arrow) return false;
  if (!CLASS_RELATION_ARROW_RE.test(arrow)) return false;
  return arrow.includes('--') || arrow.includes('..');
}

/**
 * @param {string} line
 * @returns {{ from: string, arrow: string, to: string, label: string } | null}
 */
export function parseClassRelation(line) {
  const stripped = stripLineComment(line).trim();
  if (!stripped || stripped.startsWith('%%')) return null;
  if (META_LINE_RE.test(stripped) || CLASS_BLOCK_OPEN_RE.test(stripped) || stripped === '}') {
    return null;
  }
  if (CLASS_ANNOTATION_RE.test(stripped)) return null;
  const colonIdx = stripped.indexOf(':');
  const head = colonIdx === -1 ? stripped : stripped.slice(0, colonIdx).trim();
  const label = colonIdx === -1 ? '' : stripped.slice(colonIdx + 1).trim();
  const parts = head.split(/\s+/);
  if (parts.length !== 3) return null;
  const [from, arrow, to] = parts;
  if (!isClassRelationArrow(arrow)) return null;
  return { from, arrow, to, label };
}

/**
 * @param {string} source
 * @returns {Set<string>}
 */
function collectClassIds(source) {
  const ids = new Set();
  let inBlock = false;
  for (const line of String(source ?? '').split(/\r?\n/)) {
    const stripped = stripLineComment(line).trim();
    const open = stripped.match(CLASS_BLOCK_OPEN_RE);
    if (open) {
      ids.add(open[1]);
      inBlock = true;
      continue;
    }
    if (inBlock) {
      if (stripped === '}') inBlock = false;
      continue;
    }
    const relation = parseClassRelation(line);
    if (relation) {
      ids.add(relation.from);
      ids.add(relation.to);
      continue;
    }
    const member = stripped.match(CLASS_MEMBER_RE);
    if (member) ids.add(member[1]);
    const annotation = stripped.match(CLASS_ANNOTATION_RE);
    if (annotation) ids.add(annotation[1]);
  }
  return ids;
}

function indentOf(line) {
  const match = String(line ?? '').match(/^[ \t]*/);
  return match ? match[0] : '  ';
}

function lastNonEmptyIndex(lines) {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].trim()) return i;
  }
  return lines.length - 1;
}

function requireClass(source) {
  if (!isClassFamilySource(source)) return fail('not-class');
  return null;
}

function requireClassId(id) {
  if (!id || !CLASS_ID_RE.test(id)) return fail('bad-id');
  if (RESERVED_IDS.has(id)) return fail('special');
  return null;
}

function requireExistingClass(source, id) {
  if (!collectClassIds(source).has(id)) return fail('missing');
  return null;
}

function hasDirectedRelation(source, fromId, toId, arrow = '-->') {
  for (const line of String(source ?? '').split(/\r?\n/)) {
    const relation = parseClassRelation(line);
    if (relation && relation.from === fromId && relation.to === toId && relation.arrow === arrow) {
      return true;
    }
  }
  return false;
}

function allocateClassId(source) {
  const ids = collectClassIds(source);
  let n = 1;
  while (ids.has(`Class${n}`) || ids.has(`n${n}`) || RESERVED_IDS.has(`Class${n}`)) n += 1;
  return `Class${n}`;
}

function allocateClassLabel(source) {
  const labels = new Set(collectClassIds(source));
  let n = 1;
  while (labels.has(`Item ${n}`)) n += 1;
  return `Item ${n}`;
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 */
export function connectClassNodes(source, fromId, toId) {
  const blocked =
    requireClass(source) ||
    requireClassId(fromId) ||
    requireClassId(toId) ||
    requireExistingClass(source, fromId) ||
    requireExistingClass(source, toId);
  if (blocked) return blocked;
  if (fromId === toId) return fail('self');
  if (hasDirectedRelation(source, fromId, toId)) return fail('duplicate');

  const lines = String(source).split(/\r?\n/);
  const insertAt = lastNonEmptyIndex(lines) + 1;
  const next = [...lines];
  next.splice(insertAt, 0, `${indentOf(lines[insertAt - 1] || lines[0])}${fromId} --> ${toId}`);
  return ok(next.join('\n'));
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} [label]
 */
export function addLinkedClassNode(source, fromId, label = '') {
  const blocked =
    requireClass(source) || requireClassId(fromId) || requireExistingClass(source, fromId);
  if (blocked) return blocked;
  const newId = allocateClassId(source);
  const text = String(label || '').trim() || allocateClassLabel(source);
  const lines = String(source).split(/\r?\n/);
  const insertAt = lastNonEmptyIndex(lines) + 1;
  const indent = indentOf(lines[insertAt - 1] || lines[0]);
  const next = [...lines];
  next.splice(insertAt, 0, `${indent}${fromId} --> ${newId}`, `${indent}${newId} : ${text}`);
  return ok(next.join('\n'), { newId, newLabel: text });
}

/**
 * @param {string} source
 * @param {string} classId
 */
export function deleteClassNode(source, classId) {
  const blocked = requireClass(source) || requireClassId(classId);
  if (blocked) return blocked;
  const lines = String(source).split(/\r?\n/);
  /** @type {string[]} */
  const next = [];
  let removed = false;
  let inTargetBlock = false;
  for (const line of lines) {
    const stripped = stripLineComment(line).trim();
    const open = stripped.match(CLASS_BLOCK_OPEN_RE);
    if (open && open[1] === classId) {
      removed = true;
      inTargetBlock = true;
      continue;
    }
    if (inTargetBlock) {
      if (stripped === '}') inTargetBlock = false;
      continue;
    }
    if (classEditLineMatchesId(line, stripped, classId)) {
      removed = true;
      continue;
    }
    next.push(line);
  }
  if (!removed) return fail('missing');
  return ok(next.join('\n'));
}

/**
 * @param {string} line
 * @param {string} stripped
 * @param {string} classId
 */
function classEditLineMatchesId(line, stripped, classId) {
  const relation = parseClassRelation(line);
  if (relation) return relation.from === classId || relation.to === classId;
  const member = stripped.match(CLASS_MEMBER_RE);
  if (member && member[1] === classId) return true;
  const annotation = stripped.match(CLASS_ANNOTATION_RE);
  return Boolean(annotation && annotation[1] === classId);
}

/**
 * @typedef {{ lineIndex: number, edgeIndex: number, text: string }} ClassEdgeRef
 */

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 * @returns {{ lines: string[], refs: ClassEdgeRef[] }}
 */
function collectClassEdgeRefs(source, fromId, toId) {
  const lines = String(source).split(/\r?\n/);
  /** @type {ClassEdgeRef[]} */
  const refs = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const relation = parseClassRelation(lines[lineIndex]);
    if (relation && relation.from === fromId && relation.to === toId) {
      refs.push({ lineIndex, edgeIndex: refs.length, text: relation.label ?? '' });
    }
  }
  return { lines, refs };
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 * @param {string} [edgeLabel]
 * @param {number} [edgeIndex]
 */
export function deleteClassEdge(source, fromId, toId, edgeLabel, edgeIndex) {
  const blocked =
    requireClass(source) ||
    requireClassId(fromId) ||
    requireClassId(toId) ||
    requireExistingClass(source, fromId) ||
    requireExistingClass(source, toId);
  if (blocked) return blocked;

  const { lines, refs } = collectClassEdgeRefs(source, fromId, toId);
  const picked = pickParallelEdgeRef(refs, { edgeLabel, edgeIndex });
  if (!picked) return fail('missing');

  const next = [...lines];
  next.splice(picked.lineIndex, 1);
  return ok(next.join('\n'));
}

function replaceClassIdToken(token, oldId, newId) {
  return token === oldId ? newId : token;
}

/**
 * Rewrite a relation line so either end reads `nextLabel` where it read
 * `classId`, or report that this line is not a relation at all.
 *
 * Split out of `renameClassNode`'s per-line callback, which had accumulated one
 * branch per line shape and stood at complexity 13 — the relation case was both
 * the largest and the only one with a "matched but nothing changed" outcome, so
 * it is the one that reports `changed` rather than relying on a `null` to mean
 * two different things.
 *
 * @returns {{ line: string, changed: boolean } | null} null when the line is not
 *   a relation, which is what lets the caller fall through to the member and
 *   annotation shapes below.
 */
function renameClassRelationLine(line, classId, nextLabel) {
  const relation = parseClassRelation(line);
  if (!relation) return null;
  const from = replaceClassIdToken(relation.from, classId, nextLabel);
  const to = replaceClassIdToken(relation.to, classId, nextLabel);
  if (from === relation.from && to === relation.to) return { line, changed: false };
  const suffix = relation.label ? ` : ${relation.label}` : '';
  return {
    line: `${indentOf(line)}${from} ${relation.arrow} ${to}${suffix}`,
    changed: true
  };
}

/**
 * @param {string} source
 * @param {string} classId
 * @param {string} label
 */
export function renameClassNode(source, classId, label) {
  const blocked =
    requireClass(source) || requireClassId(classId) || requireExistingClass(source, classId);
  if (blocked) return blocked;
  const nextLabel = String(label ?? '').trim();
  if (!nextLabel) return fail('empty');
  if (!CLASS_ID_RE.test(nextLabel)) return fail('bad-id');
  if (nextLabel === classId) return ok(source);
  if (collectClassIds(source).has(nextLabel)) return fail('duplicate');

  const lines = String(source).split(/\r?\n/);
  let found = false;
  let inTargetBlock = false;
  const next = lines.map((line) => {
    const stripped = stripLineComment(line).trim();
    const open = stripped.match(CLASS_BLOCK_OPEN_RE);
    if (open && open[1] === classId) {
      found = true;
      inTargetBlock = true;
      return line.replace(CLASS_BLOCK_OPEN_RE, `class ${nextLabel} {`);
    }
    if (inTargetBlock) {
      if (stripped === '}') inTargetBlock = false;
      return line;
    }
    const relation = renameClassRelationLine(line, classId, nextLabel);
    if (relation) {
      if (relation.changed) found = true;
      return relation.line;
    }
    const member = stripped.match(CLASS_MEMBER_RE);
    if (member && member[1] === classId) {
      found = true;
      return `${indentOf(line)}${nextLabel} : ${member[2]}`;
    }
    const annotation = stripped.match(CLASS_ANNOTATION_RE);
    if (annotation && annotation[1] === classId) {
      found = true;
      return line.replace(classId, nextLabel);
    }
    return line;
  });
  if (!found) return fail('missing');
  return ok(next.join('\n'), { newId: nextLabel });
}
