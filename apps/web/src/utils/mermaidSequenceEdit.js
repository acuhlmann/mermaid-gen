import {
  findSequenceMessageRange,
  peekDiagramDirective,
  stripLineComment
} from './mermaidSourceLocate.js';

const PARTICIPANT_ID_RE = /^[A-Za-z][A-Za-z0-9_]*(?:-[A-Za-z0-9_]+)*$/;
const PARTICIPANT_ID_CAPTURE = '([A-Za-z][A-Za-z0-9_]*(?:-[A-Za-z0-9_]+)*)';
const DECLARE_RE = new RegExp(
  `^\\s*(?:participant|actor)\\s+${PARTICIPANT_ID_CAPTURE}(?:\\s+as\\s+(.+))?\\s*$`,
  'i'
);
const MESSAGE_RE = new RegExp(
  `^\\s*${PARTICIPANT_ID_CAPTURE}\\s*([\\<\\-\\=\\~\\.\\[\\]\\(\\)xo>]+(?:\\+\\-|\\-\\+)?)\\s*${PARTICIPANT_ID_CAPTURE}(?:\\s*:\\s*(.*))?$`,
  'i'
);
const META_LINE_RE =
  /^(?:sequenceDiagram|participant|actor|autonumber|title|link|links|box|rect|activate|deactivate|note|alt|opt|loop|par|and|else|end|break|critical|option|also|create|destroy)\b/i;
const ACTIVATE_RE = /^\s*(?:activate|deactivate)\s+(\S+)\s*$/i;
const CREATE_PARTICIPANT_RE = /^\s*create\s+(?:(?:participant|actor)\s+)?(\S+)\s*$/i;
const DESTROY_PARTICIPANT_RE = /^\s*destroy\s+(\S+)\s*$/i;
const NOTE_PARTICIPANTS_RE = /^\s*note\s+(?:over|left of|right of)\s+([^:]+)/i;

function fail(reason) {
  return { ok: false, reason };
}

function ok(source, extra = {}) {
  return { ok: true, source, ...extra };
}

function indentOf(line) {
  const match = String(line ?? '').match(/^[ \t]*/);
  return match ? match[0] : '  ';
}

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isSequenceFamilySource(source) {
  return peekDiagramDirective(source ?? '') === 'sequence';
}

/**
 * @param {string} line
 * @returns {{ from: string, to: string, text: string } | null}
 */
export function parseSequenceMessage(line) {
  const stripped = stripLineComment(line).trim();
  if (!stripped || stripped.startsWith('%%')) return null;
  if (META_LINE_RE.test(stripped)) return null;
  const match = stripped.match(MESSAGE_RE);
  if (!match) return null;
  return { from: match[1], to: match[3], text: (match[4] || '').trim() };
}

/**
 * @param {string} source
 * @returns {Set<string>}
 */
function collectParticipantIds(source) {
  const ids = new Set();
  for (const line of String(source ?? '').split(/\r?\n/)) {
    const stripped = stripLineComment(line).trim();
    if (!stripped) continue;
    const declared = stripped.match(DECLARE_RE);
    if (declared) {
      ids.add(declared[1]);
      continue;
    }
    const message = parseSequenceMessage(line);
    if (message) {
      ids.add(message.from);
      ids.add(message.to);
    }
  }
  return ids;
}

/**
 * @param {string} source
 * @param {string} participantId
 * @returns {string}
 */
function aliasForParticipant(source, participantId) {
  for (const line of String(source ?? '').split(/\r?\n/)) {
    const stripped = stripLineComment(line).trim();
    const declared = stripped.match(DECLARE_RE);
    if (declared && declared[1] === participantId) {
      return (declared[2] || participantId).trim();
    }
  }
  return participantId;
}

/**
 * @param {string} source
 * @returns {string}
 */
export function allocateSequenceParticipantId(source) {
  const ids = collectParticipantIds(source);
  let n = 1;
  while (ids.has(`p${n}`)) n += 1;
  return `p${n}`;
}

/**
 * @param {string} source
 * @returns {string}
 */
function allocateSequenceLabel(source) {
  const labels = new Set();
  for (const line of String(source ?? '').split(/\r?\n/)) {
    const stripped = stripLineComment(line).trim();
    const declared = stripped.match(DECLARE_RE);
    if (declared?.[2]) labels.add(declared[2].trim());
    const message = parseSequenceMessage(line);
    if (message?.text) labels.add(message.text);
  }
  let n = 1;
  while (labels.has(`Item ${n}`)) n += 1;
  return `Item ${n}`;
}

function requireSequence(source) {
  if (!isSequenceFamilySource(source)) return fail('not-sequence');
  return null;
}

function requireParticipantId(id) {
  if (!id || !PARTICIPANT_ID_RE.test(id)) return fail('bad-id');
  return null;
}

function requireExistingParticipant(source, id) {
  if (!collectParticipantIds(source).has(id)) return fail('missing');
  return null;
}

/**
 * @param {string} stripped
 * @param {string} participantId
 */
function metaLineReferencesParticipant(stripped, participantId) {
  const created = stripped.match(CREATE_PARTICIPANT_RE);
  if (created && created[1] === participantId) return true;
  const destroyed = stripped.match(DESTROY_PARTICIPANT_RE);
  if (destroyed && destroyed[1] === participantId) return true;
  const note = stripped.match(NOTE_PARTICIPANTS_RE);
  if (note) {
    const ids = note[1].split(',').map((part) => part.trim());
    if (ids.includes(participantId)) return true;
  }
  return false;
}

/**
 * @param {string[]} lines
 * @returns {number}
 */
function lastParticipantDeclarationIndex(lines) {
  let last = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const stripped = stripLineComment(lines[i]).trim();
    if (DECLARE_RE.test(stripped)) last = i;
  }
  return last;
}

/**
 * @param {string[]} lines
 * @param {string} participantId
 * @returns {number}
 */
function insertIndexAfterParticipantActivity(lines, participantId) {
  let last = lastParticipantDeclarationIndex(lines);
  for (let i = 0; i < lines.length; i += 1) {
    const stripped = stripLineComment(lines[i]).trim();
    const message = parseSequenceMessage(lines[i]);
    if (message && (message.from === participantId || message.to === participantId)) {
      last = i;
      continue;
    }
    const activate = stripped.match(ACTIVATE_RE);
    if (activate && activate[1] === participantId) last = i;
  }
  return last + 1;
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 */
export function connectSequenceNodes(source, fromId, toId) {
  const blocked =
    requireSequence(source) ||
    requireParticipantId(fromId) ||
    requireParticipantId(toId) ||
    requireExistingParticipant(source, fromId) ||
    requireExistingParticipant(source, toId);
  if (blocked) return blocked;
  if (fromId === toId) return fail('self');

  const lines = String(source).split(/\r?\n/);
  const text = allocateSequenceLabel(source);
  const insertAt = insertIndexAfterParticipantActivity(lines, fromId);
  const indent = indentOf(lines[Math.max(0, insertAt - 1)] || lines[0]);
  const next = [...lines];
  next.splice(insertAt, 0, `${indent}${fromId}->>${toId}: ${text}`);
  return ok(next.join('\n'), { newLabel: text });
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} [label]
 */
export function addLinkedSequenceNode(source, fromId, label = '') {
  const blocked =
    requireSequence(source) ||
    requireParticipantId(fromId) ||
    requireExistingParticipant(source, fromId);
  if (blocked) return blocked;

  const newId = allocateSequenceParticipantId(source);
  const alias = String(label || '').trim() || allocateSequenceLabel(source);
  const messageText = alias;
  const lines = String(source).split(/\r?\n/);
  const declareAt = lastParticipantDeclarationIndex(lines) + 1;
  const declareIndent = indentOf(lines[declareAt - 1] || lines[0]);
  const next = [...lines];
  next.splice(declareAt, 0, `${declareIndent}participant ${newId} as ${alias}`);
  const messageAt = insertIndexAfterParticipantActivity(next, fromId);
  const messageIndent = indentOf(next[Math.max(0, messageAt - 1)] || next[0]);
  next.splice(messageAt, 0, `${messageIndent}${fromId}->>${newId}: ${messageText}`);
  return ok(next.join('\n'), { newId, newLabel: alias });
}

/**
 * @param {string} source
 * @param {string} participantId
 */
export function deleteSequenceNode(source, participantId) {
  const blocked = requireSequence(source) || requireParticipantId(participantId);
  if (blocked) return blocked;
  const lines = String(source).split(/\r?\n/);
  /** @type {string[]} */
  const next = [];
  let removed = false;
  for (const line of lines) {
    const stripped = stripLineComment(line).trim();
    const declared = stripped.match(DECLARE_RE);
    if (declared && declared[1] === participantId) {
      removed = true;
      continue;
    }
    const message = parseSequenceMessage(line);
    if (message && (message.from === participantId || message.to === participantId)) {
      removed = true;
      continue;
    }
    const activate = stripped.match(ACTIVATE_RE);
    if (activate && activate[1] === participantId) {
      removed = true;
      continue;
    }
    if (metaLineReferencesParticipant(stripped, participantId)) {
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
 * @param {string} [messageLabel]
 */
export function deleteSequenceEdge(source, fromId, toId, messageLabel) {
  const blocked =
    requireSequence(source) ||
    requireParticipantId(fromId) ||
    requireParticipantId(toId) ||
    requireExistingParticipant(source, fromId) ||
    requireExistingParticipant(source, toId);
  if (blocked) return blocked;
  const range = findSequenceMessageRange(source, {
    from: fromId,
    to: toId,
    label: messageLabel
  });
  if (!range) return fail('missing');
  const lines = String(source).split(/\r?\n/);
  const lineIndex = range.startLineNumber - 1;
  const next = lines.filter((_, index) => index !== lineIndex);
  return ok(next.join('\n'));
}

/**
 * @param {string} source
 * @param {string} participantId
 * @param {string} label
 */
export function renameSequenceNode(source, participantId, label) {
  const blocked =
    requireSequence(source) ||
    requireParticipantId(participantId) ||
    requireExistingParticipant(source, participantId);
  if (blocked) return blocked;
  const nextLabel = String(label ?? '').trim();
  if (!nextLabel) return fail('empty');
  if (nextLabel === aliasForParticipant(source, participantId)) return ok(source);

  const lines = String(source).split(/\r?\n/);
  let foundDeclaration = false;
  const next = lines.map((line) => {
    const stripped = stripLineComment(line).trim();
    const declared = stripped.match(DECLARE_RE);
    if (declared && declared[1] === participantId) {
      foundDeclaration = true;
      return `${indentOf(line)}participant ${participantId} as ${nextLabel}`;
    }
    return line;
  });
  if (!foundDeclaration) {
    const insertAt = lastParticipantDeclarationIndex(next) + 1;
    next.splice(
      insertAt,
      0,
      `${indentOf(next[insertAt - 1] || next[0])}participant ${participantId} as ${nextLabel}`
    );
  }
  return ok(next.join('\n'));
}

/**
 * @param {string} source
 * @param {string} fromId
 * @param {string} toId
 * @param {string} label
 * @param {string} [messageLabel]
 */
export function renameSequenceEdge(source, fromId, toId, label, messageLabel) {
  const blocked =
    requireSequence(source) ||
    requireParticipantId(fromId) ||
    requireParticipantId(toId) ||
    requireExistingParticipant(source, fromId) ||
    requireExistingParticipant(source, toId);
  if (blocked) return blocked;
  const text = String(label ?? '').trim();
  const range = findSequenceMessageRange(source, {
    from: fromId,
    to: toId,
    label: messageLabel
  });
  if (!range) return fail('missing');
  const lines = String(source).split(/\r?\n/);
  const lineIndex = range.startLineNumber - 1;
  const indent = indentOf(lines[lineIndex]);
  const suffix = text ? `: ${text}` : '';
  const next = [...lines];
  next[lineIndex] = `${indent}${fromId}->>${toId}${suffix}`;
  return ok(next.join('\n'));
}
