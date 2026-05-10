import { parseSubgraphHeaderId, stripLineComment } from './mermaidSourceLocate.js';

/** Mermaid keywords / diagram keywords — excluded from edge-line token extraction. */
const TOKEN_DENYLIST = new Set([
  'flowchart',
  'graph',
  'subgraph',
  'end',
  'direction',
  'classDef',
  'class',
  'linkStyle',
  'click',
  'style',
  'init',
  'TB',
  'TD',
  'BT',
  'RL',
  'LR',
  'horizontal',
  'vertical',
  'alphabetical'
]);

const LINKISH_RE = /-->|---|===|~~~|-\.-|\.->|<-->|--o|--x|<-\.|->>|&/;

/** Leading vertex definition: ID followed by shape opener ([ ({ etc.). Allows hyphens (e.g. api-gateway). */
const VERTEX_DEFINE_RE = /^\s*([A-Za-z][A-Za-z0-9_-]*)\s*[\[(\{<>]/;

function normalizeLine(s) {
  return s.trim().replace(/\s+/g, ' ');
}

/** First non-comment diagram directive (after optional YAML frontmatter fences). */
export function peekDiagramDirective(source) {
  if (!source || typeof source !== 'string') return 'unknown';
  const lines = source.split(/\r?\n/);
  let inYamlFence = false;
  for (let i = 0; i < lines.length && i < 48; i++) {
    const t = stripLineComment(lines[i]).trim();
    if (!t || t.startsWith('%%')) continue;
    if (t === '---') {
      inYamlFence = !inYamlFence;
      continue;
    }
    if (inYamlFence) continue;
    const low = t.toLowerCase();
    if (low.startsWith('sequencediagram')) return 'sequence';
    if (/^statediagram(?:-v2)?\b/i.test(t)) return 'state';
    if (/^(flowchart|graph)\b/i.test(low)) return 'flowchart';
    return 'unknown';
  }
  return 'unknown';
}

/**
 * Sequence actor id: hyphens must sit between alnum chunks (`api-gateway`), never trail into arrows (`Alice->>`).
 */
const SEQUENCE_ACTOR_ID = '([A-Za-z][A-Za-z0-9_]*(?:-[A-Za-z0-9_]+)*)';

/** Arrow segment uses only symbolic chars so compact `Bob->>Charlie` cannot swallow the target id. */
const SEQUENCE_MESSAGE_PAYLOAD_RE = new RegExp(
  `^${SEQUENCE_ACTOR_ID}\\s*([\\<\\-\\=\\~\\.\\[\\]\\(\\)xo>]+)\\s*(?:[+\\-]\\s*)?${SEQUENCE_ACTOR_ID}$`,
  'i'
);

const SEQUENCE_KEYWORDS = new Set([
  'participant',
  'actor',
  'sequencediagram',
  'note',
  'over',
  'end',
  'alt',
  'opt',
  'loop',
  'par',
  'and',
  'else',
  'autonumber',
  'activate',
  'deactivate',
  'box',
  'rect',
  'break',
  'critical',
  'option',
  'also',
  'link',
  'links',
  'create',
  'destroy',
  'left',
  'right',
  'of',
  'title'
]);

/**
 * @param {string} source
 * @returns {{ explicitDef: ExplicitDefMap, edgeLinesById: EdgeLinesMap }}
 */
export function collectSequenceParticipantInfo(source) {
  /** @type {ExplicitDefMap} */
  const explicitDef = new Map();
  /** @type {EdgeLinesMap} */
  const edgeLinesById = new Map();

  if (!source || typeof source !== 'string') {
    return { explicitDef, edgeLinesById };
  }

  function touchEdge(id, normLine) {
    if (!id || SEQUENCE_KEYWORDS.has(id.toLowerCase())) return;
    let list = edgeLinesById.get(id);
    if (!list) {
      list = [];
      edgeLinesById.set(id, list);
    }
    list.push(normLine);
  }

  const lines = source.split(/\r?\n/);

  for (const rawLine of lines) {
    const stripped = stripLineComment(rawLine);
    const trimmed = stripped.trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;

    const pm = trimmed.match(new RegExp(`^\\s*(?:participant|actor)\\s+${SEQUENCE_ACTOR_ID}`, 'i'));
    if (pm) {
      const id = pm[1];
      explicitDef.set(id, normalizeLine(stripped));
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    const payload = (colonIdx === -1 ? trimmed : trimmed.slice(0, colonIdx)).trim();
    const mm = payload.match(SEQUENCE_MESSAGE_PAYLOAD_RE);
    if (mm) {
      const norm = normalizeLine(stripped);
      const left = mm[1];
      const right = mm[3];
      touchEdge(left, norm);
      touchEdge(right, norm);
    }
  }

  return { explicitDef, edgeLinesById };
}

const STATE_TRANSITION_RE =
  /^\s*(\[\*\]|[A-Za-z][A-Za-z0-9_-]*)\s*-->\s*(\[\*\]|[A-Za-z][A-Za-z0-9_-]*)/;

const STATE_BLOCK_RE = /^\s*state\s+([A-Za-z][A-Za-z0-9_-]*)\s*\{/;

const STATE_AS_RE = /^\s*state\s+.+\s+as\s+([A-Za-z][A-Za-z0-9_-]*)\s*$/i;

const STATE_KEYWORDS = new Set([
  'statediagram',
  'statediagram-v2',
  'state',
  'note',
  'classdef',
  'style',
  'direction'
]);

/**
 * @param {string} source
 * @returns {{ explicitDef: ExplicitDefMap, edgeLinesById: EdgeLinesMap }}
 */
export function collectStateDiagramParticipantInfo(source) {
  /** @type {ExplicitDefMap} */
  const explicitDef = new Map();
  /** @type {EdgeLinesMap} */
  const edgeLinesById = new Map();

  if (!source || typeof source !== 'string') {
    return { explicitDef, edgeLinesById };
  }

  function touchState(id, normLine) {
    if (!id || id === '[*]' || STATE_KEYWORDS.has(id.toLowerCase())) return;
    let list = edgeLinesById.get(id);
    if (!list) {
      list = [];
      edgeLinesById.set(id, list);
    }
    list.push(normLine);
  }

  const lines = source.split(/\r?\n/);

  for (const rawLine of lines) {
    const stripped = stripLineComment(rawLine);
    const trimmed = stripped.trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;

    const bm = trimmed.match(STATE_BLOCK_RE);
    if (bm) {
      explicitDef.set(bm[1], normalizeLine(stripped));
      continue;
    }

    const am = trimmed.match(STATE_AS_RE);
    if (am) {
      explicitDef.set(am[1], normalizeLine(stripped));
      continue;
    }

    const tm = trimmed.match(STATE_TRANSITION_RE);
    if (tm) {
      const norm = normalizeLine(stripped);
      touchState(tm[1], norm);
      touchState(tm[2], norm);
    }
  }

  return { explicitDef, edgeLinesById };
}

function collectParticipantInfoForDirective(source, kind) {
  switch (kind) {
    case 'sequence':
      return collectSequenceParticipantInfo(source);
    case 'state':
      return collectStateDiagramParticipantInfo(source);
    case 'flowchart':
      return collectFlowchartParticipantInfo(source);
    default:
      return collectFlowchartParticipantInfo(source);
  }
}

/** Rough strip of shape labels so edge-line token scan does not pick up inner words. */
function stripShapeLabelsForEdgeTokens(line) {
  let s = line;
  s = s.replace(/\[[^\]]*\]/g, '');
  s = s.replace(/\([^)]*\)/g, '');
  s = s.replace(/\{[^}]*\}/g, '');
  return s;
}

/**
 * @typedef {Map<string, string>} ExplicitDefMap id -> normalized definition line
 * @typedef {Map<string, string[]>} EdgeLinesMap id -> list of normalized edge lines mentioning id
 */

/**
 * @param {string} source
 * @returns {{ explicitDef: ExplicitDefMap, edgeLinesById: EdgeLinesMap }}
 */
export function collectFlowchartParticipantInfo(source) {
  /** @type {ExplicitDefMap} */
  const explicitDef = new Map();
  /** @type {EdgeLinesMap} */
  const edgeLinesById = new Map();

  if (!source || typeof source !== 'string') {
    return { explicitDef, edgeLinesById };
  }

  const lines = source.split(/\r?\n/);

  for (const rawLine of lines) {
    const stripped = stripLineComment(rawLine);
    const trimmed = stripped.trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;

    if (/^\s*subgraph\s+/i.test(rawLine)) {
      const sid = parseSubgraphHeaderId(rawLine);
      if (sid) {
        explicitDef.set(sid, normalizeLine(stripped));
      }
      continue;
    }

    const defineMatch = stripped.match(VERTEX_DEFINE_RE);
    if (defineMatch) {
      explicitDef.set(defineMatch[1], normalizeLine(stripped));
    }

    if (LINKISH_RE.test(stripped)) {
      const forTokens = stripShapeLabelsForEdgeTokens(stripped);
      const norm = normalizeLine(forTokens);
      const idRe = /\b[A-Za-z][A-Za-z0-9_-]*\b/g;
      let m;
      while ((m = idRe.exec(forTokens)) !== null) {
        const id = m[0];
        if (TOKEN_DENYLIST.has(id)) continue;
        let list = edgeLinesById.get(id);
        if (!list) {
          list = [];
          edgeLinesById.set(id, list);
        }
        list.push(norm);
      }
    }
  }

  return { explicitDef, edgeLinesById };
}

function edgeFingerprint(edgeLinesById, id) {
  const list = edgeLinesById.get(id);
  if (!list?.length) return '';
  return [...new Set(list)].sort().join('\n');
}

function allParticipantIds(info) {
  return new Set([...info.explicitDef.keys(), ...info.edgeLinesById.keys()]);
}

function isParticipantModified(id, before, after) {
  const defB = before.explicitDef.get(id);
  const defA = after.explicitDef.get(id);

  if (defB !== undefined || defA !== undefined) {
    if (defB !== defA) return true;
  }

  return edgeFingerprint(before.edgeLinesById, id) !== edgeFingerprint(after.edgeLinesById, id);
}

/**
 * Structural diff between two Mermaid sources (best-effort heuristic).
 * Uses flowchart-style parsing for `flowchart`/`graph`, sequence parsing for `sequenceDiagram`,
 * and transition/state parsing for `stateDiagram` / `stateDiagram-v2`. Unknown kinds fall back to flowchart rules.
 * @param {string} previousSource
 * @param {string} nextSource
 * @returns {{ addedIds: string[], removedIds: string[], modifiedIds: string[] }}
 */
export function diffMermaidFlowcharts(previousSource, nextSource) {
  const kindBefore = peekDiagramDirective(previousSource ?? '');
  const kindAfter = peekDiagramDirective(nextSource ?? '');
  const before = collectParticipantInfoForDirective(previousSource ?? '', kindBefore);
  const after = collectParticipantInfoForDirective(nextSource ?? '', kindAfter);

  const idsB = allParticipantIds(before);
  const idsA = allParticipantIds(after);

  /** @type {Set<string>} */
  const added = new Set();
  /** @type {Set<string>} */
  const removed = new Set();
  /** @type {Set<string>} */
  const modified = new Set();

  for (const id of idsA) {
    if (!idsB.has(id)) added.add(id);
  }
  for (const id of idsB) {
    if (!idsA.has(id)) removed.add(id);
  }

  for (const id of idsB) {
    if (!idsA.has(id)) continue;
    if (isParticipantModified(id, before, after)) {
      modified.add(id);
    }
  }

  const sort = (s) => [...s].sort((a, b) => a.localeCompare(b));
  return {
    addedIds: sort(added),
    removedIds: sort(removed),
    modifiedIds: sort(modified)
  };
}
