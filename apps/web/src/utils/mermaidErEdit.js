import { pickParallelEdgeRef } from './mermaidEdgeDisambiguation.js';
import { peekDiagramDirective, stripLineComment } from './mermaidSourceLocate.js';

const ENTITY_ID_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;
const ENTITY_BLOCK_OPEN_RE = /^\s*(\S+)\s*\{\s*$/;
const ER_CARDINALITY_RE = /^[\|oxON{}.\-*]+$/i;
const META_LINE_RE = /^erDiagram\b/i;
const DEFAULT_CARDINALITY = '||--o{';
const RESERVED_IDS = new Set(['erDiagram']);

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
export function isErFamilySource(source) {
  return peekDiagramDirective(source ?? '') === 'er';
}

/**
 * @param {string} token
 * @returns {boolean}
 */
function isErCardinality(token) {
  const arrow = String(token ?? '').trim();
  if (!arrow || !ER_CARDINALITY_RE.test(arrow)) return false;
  return arrow.includes('--');
}

/**
 * @param {string} line
 * @returns {{ from: string, cardinality: string, to: string, label: string } | null}
 */
export function parseErRelation(line) {
  const stripped = stripLineComment(line).trim();
  if (!stripped || stripped.startsWith('%%')) return null;
  if (META_LINE_RE.test(stripped) || ENTITY_BLOCK_OPEN_RE.test(stripped) || stripped === '}') {
    return null;
  }
  const colonIdx = stripped.indexOf(':');
  const head = colonIdx === -1 ? stripped : stripped.slice(0, colonIdx).trim();
  const label = colonIdx === -1 ? '' : stripped.slice(colonIdx + 1).trim();
  const parts = head.split(/\s+/);
  if (parts.length !== 3) return null;
  const [from, cardinality, to] = parts;
  if (!isErCardinality(cardinality)) return null;
  return { from, cardinality, to, label };
}

/**
 * @param {string} source
 * @returns {Set<string>}
 */
function collectEntityIds(source) {
  const ids = new Set();
  let inBlock = false;
  for (const line of String(source ?? '').split(/\r?\n/)) {
    const stripped = stripLineComment(line).trim();
    const open = stripped.match(ENTITY_BLOCK_OPEN_RE);
    if (open) {
      ids.add(open[1]);
      inBlock = true;
      continue;
    }
    if (inBlock) {
      if (stripped === '}') inBlock = false;
      continue;
    }
    const relation = parseErRelation(line);
    if (relation) {
      ids.add(relation.from);
      ids.add(relation.to);
    }
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

function requireEr(source) {
  if (!isErFamilySource(source)) return fail('not-er');
  return null;
}

function requireEntityId(id) {
  if (!id || !ENTITY_ID_RE.test(id)) return fail('bad-id');
  if (RESERVED_IDS.has(id)) return fail('special');
  return null;
}

function requireExistingEntity(source, id) {
  if (!collectEntityIds(source).has(id)) return fail('missing');
  return null;
}

function hasDirectedRelation(source, fromId, toId, cardinality = DEFAULT_CARDINALITY) {
  for (const line of String(source ?? '').split(/\r?\n/)) {
    const relation = parseErRelation(line);
    if (
      relation &&
      relation.from === fromId &&
      relation.to === toId &&
      relation.cardinality === cardinality
    ) {
      return true;
    }
  }
  return false;
}

function allocateEntityId(source) {
  const ids = collectEntityIds(source);
  let n = 1;
  while (ids.has(`Entity${n}`) || RESERVED_IDS.has(`Entity${n}`)) n += 1;
  return `Entity${n}`;
}

function allocateRelationLabel(source) {
  const labels = new Set();
  for (const line of String(source ?? '').split(/\r?\n/)) {
    const relation = parseErRelation(line);
    if (relation?.label) labels.add(relation.label);
  }
  let n = 1;
  while (labels.has(`Item ${n}`)) n += 1;
  return `Item ${n}`;
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 */
export function connectErNodes(source, fromId, toId) {
  const blocked =
    requireEr(source) ||
    requireEntityId(fromId) ||
    requireEntityId(toId) ||
    requireExistingEntity(source, fromId) ||
    requireExistingEntity(source, toId);
  if (blocked) return blocked;
  if (fromId === toId) return fail('self');
  if (hasDirectedRelation(source, fromId, toId)) return fail('duplicate');

  const lines = String(source).split(/\r?\n/);
  const insertAt = lastNonEmptyIndex(lines) + 1;
  const indent = indentOf(lines[insertAt - 1] || lines[0]);
  const label = allocateRelationLabel(source);
  const next = [...lines];
  next.splice(insertAt, 0, `${indent}${fromId} ${DEFAULT_CARDINALITY} ${toId} : ${label}`);
  return ok(next.join('\n'));
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} [label]
 */
export function addLinkedErNode(source, fromId, label = '') {
  const blocked =
    requireEr(source) || requireEntityId(fromId) || requireExistingEntity(source, fromId);
  if (blocked) return blocked;
  const newId = allocateEntityId(source);
  const text = String(label || '').trim() || allocateRelationLabel(source);
  const lines = String(source).split(/\r?\n/);
  const insertAt = lastNonEmptyIndex(lines) + 1;
  const indent = indentOf(lines[insertAt - 1] || lines[0]);
  const next = [...lines];
  next.splice(
    insertAt,
    0,
    `${indent}${fromId} ${DEFAULT_CARDINALITY} ${newId} : ${text}`,
    `${indent}${newId} {`,
    `${indent}    string id`,
    `${indent}}`
  );
  return ok(next.join('\n'), { newId, newLabel: text });
}

/**
 * @param {string} line
 * @param {string} stripped
 * @param {string} entityId
 */
function erLineMatchesEntity(line, stripped, entityId) {
  const relation = parseErRelation(line);
  if (relation) return relation.from === entityId || relation.to === entityId;
  const open = stripped.match(ENTITY_BLOCK_OPEN_RE);
  return Boolean(open && open[1] === entityId);
}

/**
 * @param {string} source
 * @param {string} entityId
 */
export function deleteErNode(source, entityId) {
  const blocked = requireEr(source) || requireEntityId(entityId);
  if (blocked) return blocked;
  const lines = String(source).split(/\r?\n/);
  /** @type {string[]} */
  const next = [];
  let removed = false;
  let inTargetBlock = false;
  for (const line of lines) {
    const stripped = stripLineComment(line).trim();
    const open = stripped.match(ENTITY_BLOCK_OPEN_RE);
    if (open && open[1] === entityId) {
      removed = true;
      inTargetBlock = true;
      continue;
    }
    if (inTargetBlock) {
      if (stripped === '}') inTargetBlock = false;
      continue;
    }
    if (erLineMatchesEntity(line, stripped, entityId)) {
      removed = true;
      continue;
    }
    next.push(line);
  }
  if (!removed) return fail('missing');
  return ok(next.join('\n'));
}

/**
 * @typedef {{ lineIndex: number, edgeIndex: number, text: string }} ErEdgeRef
 */

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 * @returns {{ lines: string[], refs: ErEdgeRef[] }}
 */
function collectErEdgeRefs(source, fromId, toId) {
  const lines = String(source).split(/\r?\n/);
  /** @type {ErEdgeRef[]} */
  const refs = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const relation = parseErRelation(lines[lineIndex]);
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
export function deleteErEdge(source, fromId, toId, edgeLabel, edgeIndex) {
  const blocked =
    requireEr(source) ||
    requireEntityId(fromId) ||
    requireEntityId(toId) ||
    requireExistingEntity(source, fromId) ||
    requireExistingEntity(source, toId);
  if (blocked) return blocked;

  const { lines, refs } = collectErEdgeRefs(source, fromId, toId);
  const picked = pickParallelEdgeRef(refs, { edgeLabel, edgeIndex });
  if (!picked) return fail('missing');

  const next = [...lines];
  next.splice(picked.lineIndex, 1);
  return ok(next.join('\n'));
}

function replaceEntityToken(token, oldId, newId) {
  return token === oldId ? newId : token;
}

/**
 * @param {string} source
 * @param {string} entityId
 * @param {string} label
 */
export function renameErNode(source, entityId, label) {
  const blocked =
    requireEr(source) || requireEntityId(entityId) || requireExistingEntity(source, entityId);
  if (blocked) return blocked;
  const nextLabel = String(label ?? '').trim();
  if (!nextLabel) return fail('empty');
  if (!ENTITY_ID_RE.test(nextLabel)) return fail('bad-id');
  if (nextLabel === entityId) return ok(source);
  if (collectEntityIds(source).has(nextLabel)) return fail('duplicate');

  const lines = String(source).split(/\r?\n/);
  let found = false;
  let inTargetBlock = false;
  const next = lines.map((line) => {
    const stripped = stripLineComment(line).trim();
    const open = stripped.match(ENTITY_BLOCK_OPEN_RE);
    if (open && open[1] === entityId) {
      found = true;
      inTargetBlock = true;
      return line.replace(ENTITY_BLOCK_OPEN_RE, `${nextLabel} {`);
    }
    if (inTargetBlock) {
      if (stripped === '}') inTargetBlock = false;
      return line;
    }
    const relation = parseErRelation(line);
    if (relation) {
      const from = replaceEntityToken(relation.from, entityId, nextLabel);
      const to = replaceEntityToken(relation.to, entityId, nextLabel);
      if (from !== relation.from || to !== relation.to) {
        found = true;
        return `${indentOf(line)}${from} ${relation.cardinality} ${to} : ${relation.label}`;
      }
      return line;
    }
    return line;
  });
  if (!found) return fail('missing');
  return ok(next.join('\n'), { newId: nextLabel });
}
