import { peekDiagramDirective, stripLineComment } from './mermaidSourceLocate.js';

const STATE_ID_RE = /^(\[\*\]|[A-Za-z][A-Za-z0-9_-]*)$/;
const TRANSITION_RE =
  /^\s*(<)?(\[\*\]|[A-Za-z][A-Za-z0-9_-]*)\s*-->\s*(\[\*\]|[A-Za-z][A-Za-z0-9_-]*)(?:\s*:\s*(.+))?$/;
const STATE_DESC_RE = /^\s*(\[\*\]|[A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.+)$/;
const STATE_ALIAS_RE = /^\s*state\s+"((?:[^"\\]|\\.)*)"\s+as\s+([A-Za-z][A-Za-z0-9_-]*)\s*$/i;
const META_LINE_RE =
  /^(?:stateDiagram(?:-v2)?|classDef|class|style|direction|note|hide\s+empty)\b/i;
const COMPOSITE_OPEN_RE = /^\s*state\s+(\S+)\s*\{\s*$/i;
const RESERVED_IDS = new Set(['state', 'note', 'class', 'classDef', 'style', 'direction', 'end']);

function fail(reason) {
  return { ok: false, reason };
}

function ok(source, extra = {}) {
  return { ok: true, source, ...extra };
}

function isSpecialState(id) {
  return id === '[*]';
}

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isStateFamilySource(source) {
  return peekDiagramDirective(source ?? '') === 'state';
}

/**
 * @param {string} line
 * @returns {{ from: string, to: string, text: string } | null}
 */
export function parseStateTransition(line) {
  const stripped = stripLineComment(line).trim();
  if (!stripped || stripped.startsWith('%%')) return null;
  if (META_LINE_RE.test(stripped) || COMPOSITE_OPEN_RE.test(stripped) || stripped === '}') {
    return null;
  }
  const alias = stripped.match(STATE_ALIAS_RE);
  if (alias) return null;
  const desc = stripped.match(STATE_DESC_RE);
  if (desc && !stripped.includes('-->')) return null;
  const match = stripped.match(TRANSITION_RE);
  if (!match) return null;
  return { from: match[2], to: match[3], text: (match[4] || '').trim() };
}

/**
 * @param {string} source
 * @returns {Set<string>}
 */
function collectStateIds(source) {
  const ids = new Set();
  for (const line of String(source ?? '').split(/\r?\n/)) {
    const stripped = stripLineComment(line).trim();
    if (!stripped) continue;
    const transition = parseStateTransition(line);
    if (transition) {
      ids.add(transition.from);
      ids.add(transition.to);
      continue;
    }
    const alias = stripped.match(STATE_ALIAS_RE);
    if (alias) {
      ids.add(alias[2]);
      continue;
    }
    const desc = stripped.match(STATE_DESC_RE);
    if (desc && !stripped.includes('-->')) {
      ids.add(desc[1]);
    }
  }
  return ids;
}

/**
 * @param {string} source
 * @returns {string}
 */
export function allocateStateNodeId(source) {
  const ids = collectStateIds(source);
  let n = 1;
  while (ids.has(`n${n}`) || RESERVED_IDS.has(`n${n}`)) n += 1;
  return `n${n}`;
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

function requireState(source) {
  if (!isStateFamilySource(source)) return fail('not-state');
  return null;
}

function requireStateId(id) {
  if (!id || !STATE_ID_RE.test(id)) return fail('bad-id');
  if (isSpecialState(id)) return fail('special');
  return null;
}

function requireExistingState(source, id) {
  if (!collectStateIds(source).has(id)) return fail('missing');
  return null;
}

function hasDirectedTransition(source, fromId, toId) {
  for (const line of String(source ?? '').split(/\r?\n/)) {
    const transition = parseStateTransition(line);
    if (transition && transition.from === fromId && transition.to === toId) return true;
  }
  return false;
}

function labelForState(source, stateId) {
  for (const line of String(source ?? '').split(/\r?\n/)) {
    const stripped = stripLineComment(line).trim();
    const alias = stripped.match(STATE_ALIAS_RE);
    if (alias && alias[2] === stateId) return alias[1];
    const desc = stripped.match(STATE_DESC_RE);
    if (desc && desc[1] === stateId && !stripped.includes('-->')) return desc[2].trim();
  }
  return stateId;
}

function allocateStateLabel(source) {
  const labels = new Set();
  for (const line of String(source ?? '').split(/\r?\n/)) {
    const stripped = stripLineComment(line).trim();
    const alias = stripped.match(STATE_ALIAS_RE);
    if (alias) labels.add(alias[1]);
    const desc = stripped.match(STATE_DESC_RE);
    if (desc && !stripped.includes('-->')) labels.add(desc[2].trim());
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
export function connectStateNodes(source, fromId, toId) {
  const blocked =
    requireState(source) ||
    requireStateId(fromId) ||
    requireStateId(toId) ||
    requireExistingState(source, fromId) ||
    requireExistingState(source, toId);
  if (blocked) return blocked;
  if (fromId === toId) return fail('self');
  if (hasDirectedTransition(source, fromId, toId)) return fail('duplicate');

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
export function addLinkedStateNode(source, fromId, label = '') {
  const blocked =
    requireState(source) || requireStateId(fromId) || requireExistingState(source, fromId);
  if (blocked) return blocked;
  const newId = allocateStateNodeId(source);
  const text = String(label || '').trim() || allocateStateLabel(source);
  const lines = String(source).split(/\r?\n/);
  const insertAt = lastNonEmptyIndex(lines) + 1;
  const indent = indentOf(lines[insertAt - 1] || lines[0]);
  const next = [...lines];
  next.splice(insertAt, 0, `${indent}${fromId} --> ${newId}`, `${indent}${newId} : ${text}`);
  return ok(next.join('\n'), { newId, newLabel: text });
}

/**
 * @param {string} source
 * @param {string} stateId
 */
export function deleteStateNode(source, stateId) {
  const blocked = requireState(source) || requireStateId(stateId);
  if (blocked) return blocked;
  const lines = String(source).split(/\r?\n/);
  /** @type {string[]} */
  const next = [];
  let removed = false;
  for (const line of lines) {
    const stripped = stripLineComment(line).trim();
    const transition = parseStateTransition(line);
    if (transition) {
      if (transition.from === stateId || transition.to === stateId) {
        removed = true;
        continue;
      }
      next.push(line);
      continue;
    }
    const alias = stripped.match(STATE_ALIAS_RE);
    if (alias && alias[2] === stateId) {
      removed = true;
      continue;
    }
    const desc = stripped.match(STATE_DESC_RE);
    if (desc && desc[1] === stateId && !stripped.includes('-->')) {
      removed = true;
      continue;
    }
    next.push(line);
  }
  if (!removed) return fail('missing');
  return ok(next.join('\n'));
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 */
export function deleteStateEdge(source, fromId, toId) {
  const blocked =
    requireState(source) ||
    requireStateId(fromId) ||
    requireStateId(toId) ||
    requireExistingState(source, fromId) ||
    requireExistingState(source, toId);
  if (blocked) return blocked;
  const lines = String(source).split(/\r?\n/);
  /** @type {string[]} */
  const next = [];
  let removed = false;
  for (const line of lines) {
    const transition = parseStateTransition(line);
    if (transition && transition.from === fromId && transition.to === toId) {
      removed = true;
      continue;
    }
    next.push(line);
  }
  if (!removed) return fail('missing');
  return ok(next.join('\n'));
}

/**
 * @param {string} source
 * @param {string} stateId
 * @param {string} label
 */
export function renameStateNode(source, stateId, label) {
  const blocked =
    requireState(source) || requireStateId(stateId) || requireExistingState(source, stateId);
  if (blocked) return blocked;
  const nextLabel = String(label ?? '').trim();
  if (!nextLabel) return fail('empty');
  if (nextLabel === labelForState(source, stateId)) return ok(source);

  const lines = String(source).split(/\r?\n/);
  let found = false;
  let hasDescLine = false;
  const next = lines.map((line) => {
    const stripped = stripLineComment(line).trim();
    const alias = stripped.match(STATE_ALIAS_RE);
    if (alias && alias[2] === stateId) {
      found = true;
      return line.replace(
        STATE_ALIAS_RE,
        `state "${nextLabel.replace(/"/g, '\\"')}" as ${stateId}`
      );
    }
    const desc = stripped.match(STATE_DESC_RE);
    if (desc && desc[1] === stateId && !stripped.includes('-->')) {
      found = true;
      hasDescLine = true;
      return `${indentOf(line)}${stateId} : ${nextLabel}`;
    }
    return line;
  });
  if (!found && !hasDescLine) {
    const insertAt = lastNonEmptyIndex(next) + 1;
    next.splice(insertAt, 0, `${indentOf(next[insertAt - 1] || next[0])}${stateId} : ${nextLabel}`);
    found = true;
  }
  if (!found) return fail('missing');
  return ok(next.join('\n'));
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 * @param {string} label
 */
export function renameStateEdge(source, fromId, toId, label) {
  const blocked =
    requireState(source) ||
    requireStateId(fromId) ||
    requireStateId(toId) ||
    requireExistingState(source, fromId) ||
    requireExistingState(source, toId);
  if (blocked) return blocked;
  const text = String(label ?? '').trim();
  const lines = String(source).split(/\r?\n/);
  let found = false;
  const next = lines.map((line) => {
    const transition = parseStateTransition(line);
    if (!transition || transition.from !== fromId || transition.to !== toId) return line;
    found = true;
    const indent = indentOf(line);
    const suffix = text ? ` : ${text}` : '';
    return `${indent}${fromId} --> ${toId}${suffix}`;
  });
  if (!found) return fail('missing');
  return ok(next.join('\n'));
}
