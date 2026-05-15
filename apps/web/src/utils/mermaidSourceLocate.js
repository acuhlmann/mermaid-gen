/**
 * Map SVG selection → flowchart logical ids and locate matching spans in Mermaid source.
 * Line/column numbers are 1-based (Monaco-compatible).
 *
 * @typedef {{ startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number }} SourceRange
 */

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

/** Strip %% line comments for scanning (keeps diagram keywords intact). */
export function stripLineComment(line) {
  const idx = line.indexOf('%%');
  return idx === -1 ? line : line.slice(0, idx);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strip common Mermaid SVG id prefixes/suffixes so DOM ids map back to vertex/subgraph ids.
 * @param {string} raw
 * @param {'node'|'cluster'} kind
 */
export function normalizeDiagramElementId(raw, kind) {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s) return null;

  if (kind === 'cluster') {
    s = s.replace(/^cluster[-_]?/i, '');
  }
  s = s.replace(/^flowchart-(?:v2-)?/i, '');
  s = s.replace(/(?:-\d+)+$/g, '');
  return s || raw.trim();
}

/**
 * Resolve logical id from SVG element attributes.
 * @param {{ elementId?: string, dataId?: string|null, kind?: 'node'|'cluster' }} sel
 */
export function logicalIdFromDiagramSelection(sel) {
  const kind = sel.kind === 'cluster' ? 'cluster' : 'node';
  const data = sel.dataId != null && String(sel.dataId).trim() ? String(sel.dataId).trim() : '';
  const domId = sel.elementId != null && String(sel.elementId).trim() ? String(sel.elementId).trim() : '';
  const primary = data || domId;
  if (!primary) return null;
  const normalized = normalizeDiagramElementId(primary, kind);
  return normalized || primary;
}

/**
 * Ordered unique logical ids to try against source (SVG ids often embed prefixes/suffixes).
 * @param {{ elementId?: string, dataId?: string|null, kind?: 'node'|'cluster' }} sel
 * @returns {string[]}
 */
export function collectLogicalIdCandidates(sel) {
  const kind = sel.kind === 'cluster' ? 'cluster' : 'node';
  const rawDom = sel.elementId != null ? String(sel.elementId).trim() : '';
  const rawData = sel.dataId != null ? String(sel.dataId).trim() : '';
  /** @type {string[]} */
  const out = [];
  const add = (x) => {
    if (!x || out.includes(x)) return;
    out.push(x);
  };

  if (rawData) {
    add(normalizeDiagramElementId(rawData, kind) || rawData);
    add(rawData);
  }
  if (rawDom) {
    add(normalizeDiagramElementId(rawDom, kind) || rawDom);
    add(rawDom);
    let stripped = rawDom;
    if (kind === 'cluster') {
      stripped = stripped.replace(/^cluster[-_]?/i, '');
    }
    stripped = stripped.replace(/^flowchart-(?:v2-)?/i, '');
    stripped = stripped.replace(/(?:-\d+)+$/g, '');
    add(stripped);
    for (const part of stripped.split('-').filter(Boolean)) {
      if (/^[A-Za-z_]\w*$/.test(part)) add(part);
    }
  }
  return out;
}

/**
 * @param {string} source
 * @param {{ elementId?: string, dataId?: string|null, kind?: 'node'|'cluster' }} sel
 * @returns {SourceRange|null}
 */
export function findMermaidSourceRangeForDiagramSelection(source, sel) {
  const kind = sel.kind === 'cluster' ? 'cluster' : 'node';
  for (const logicalId of collectLogicalIdCandidates(sel)) {
    const r = findMermaidSourceRange(source, { logicalId, kind });
    if (r) return r;
  }
  return null;
}

/**
 * Parse subgraph id/title token after `subgraph` keyword (flowchart).
 * @param {string} line
 * @returns {string|null}
 */
export function parseSubgraphHeaderId(line) {
  const stripped = stripLineComment(line);
  const match = stripped.match(/^\s*subgraph\s+/i);
  if (!match) return null;
  let rest = stripped.slice(match.index + match[0].length).trim();
  const quoted = rest.match(/^["']([^"']+)["']/);
  if (quoted) return quoted[1];
  const plainId = rest.match(/^(\w+)/);
  return plainId ? plainId[1] : null;
}

/**
 * @param {string[]} lines
 * @param {number} lineIndex 0-based
 * @param {number} startCol 0-based column start of token
 * @param {string} token
 * @returns {SourceRange}
 */
function rangeForToken(lines, lineIndex, startCol, token) {
  const line = lines[lineIndex];
  return {
    startLineNumber: lineIndex + 1,
    startColumn: startCol + 1,
    endLineNumber: lineIndex + 1,
    endColumn: startCol + token.length + 1
  };
}

/**
 * @param {string[]} lines
 * @param {number} startIdx 0-based
 * @param {number} endIdx 0-based inclusive
 * @returns {SourceRange}
 */
function rangeForLines(lines, startIdx, endIdx) {
  const last = lines[endIdx];
  return {
    startLineNumber: startIdx + 1,
    startColumn: 1,
    endLineNumber: endIdx + 1,
    endColumn: last.length + 1
  };
}

/**
 * Find column (0-based) of logicalId token on a line (any occurrence).
 * @returns {number|null}
 */
export function findVertexIdColumn(line, logicalId) {
  const escaped = escapeRegExp(logicalId);
  const wb = new RegExp(`(?<!\\w)${escaped}(?!\\w)`);
  const m = wb.exec(line);
  return m ? m.index : null;
}

/**
 * Locate flowchart vertex references in source (primary diagram type for this app).
 * Prefers shape definitions (`A[…]`) over mentions on edge-only lines.
 * @param {string} source
 * @param {string} logicalId
 * @returns {SourceRange|null}
 */
/**
 * Locate sequenceDiagram participant/actor declarations or message-line mentions.
 * @param {string} source
 * @param {string} logicalId
 * @returns {SourceRange|null}
 */
export function findSequenceParticipantRange(source, logicalId) {
  if (!logicalId) return null;
  const lines = source.split(/\r?\n/);
  const escaped = escapeRegExp(logicalId);
  const declareRe = new RegExp(`^\\s*(?:participant|actor)\\s+(${escaped})\\b`, 'i');

  for (let i = 0; i < lines.length; i++) {
    const line = stripLineComment(lines[i]);
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;
    const dm = line.match(declareRe);
    if (dm) {
      return rangeForToken(lines, i, line.indexOf(dm[1]), logicalId);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = stripLineComment(lines[i]);
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;
    const col = findVertexIdColumn(line, logicalId);
    if (col !== null) {
      return rangeForToken(lines, i, col, logicalId);
    }
  }
  return null;
}

export function findFlowchartVertexRange(source, logicalId) {
  if (!logicalId) return null;
  const lines = source.split(/\r?\n/);
  const escaped = escapeRegExp(logicalId);
  const defineRe = new RegExp(`^\\s*(${escaped})\\s*[\\[(\\{<>]`);

  for (let i = 0; i < lines.length; i++) {
    const line = stripLineComment(lines[i]);
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;
    const dm = line.match(defineRe);
    if (dm) {
      return rangeForToken(lines, i, line.indexOf(dm[1]), logicalId);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = stripLineComment(lines[i]);
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;
    const col = findVertexIdColumn(line, logicalId);
    if (col !== null) {
      return rangeForToken(lines, i, col, logicalId);
    }
  }
  return null;
}

/**
 * Locate subgraph … end block for the given subgraph id.
 * @param {string} source
 * @param {string} logicalId
 * @returns {SourceRange|null}
 */
export function findSubgraphBlockRange(source, logicalId) {
  if (!logicalId) return null;
  const lines = source.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!/^\s*subgraph\s+/i.test(raw)) continue;
    const sid = parseSubgraphHeaderId(raw);
    if (!sid || sid !== logicalId) continue;

    let depth = 1;
    for (let j = i + 1; j < lines.length; j++) {
      const r = lines[j];
      const t = stripLineComment(r).trim();
      if (/^\s*subgraph\s+/i.test(r)) depth += 1;
      else if (/^\s*end\s*$/i.test(t)) {
        depth -= 1;
        if (depth === 0) {
          return rangeForLines(lines, i, j);
        }
      }
    }
    return null;
  }
  return null;
}

/**
 * @param {string} source
 * @param {{ logicalId: string, kind?: 'node'|'cluster' }} opts
 * @returns {SourceRange|null}
 */
export function findMermaidSourceRange(source, opts) {
  const { logicalId, kind = 'node' } = opts;
  if (!logicalId) return null;
  if (kind === 'cluster') {
    return findSubgraphBlockRange(source, logicalId);
  }
  if (peekDiagramDirective(source) === 'sequence') {
    return findSequenceParticipantRange(source, logicalId);
  }
  return findFlowchartVertexRange(source, logicalId);
}
