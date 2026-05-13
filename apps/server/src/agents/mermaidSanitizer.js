/**
 * Deterministic post-LLM Mermaid sanitizer.
 *
 * Runs as a parse-fail rescue inside `validateAndPreparePatch`. Each fixer is composable,
 * idempotent, and conservative: when in doubt, leave the source alone and let the LLM
 * repair loop handle it. The goal is to recover mechanical failures (smart quotes,
 * unquoted special-char labels, reserved-word IDs, header typos, missing `end`, malformed
 * init directive) without a full LLM round-trip.
 */

const KNOWN_DIAGRAM_PREFIXES = [
  'flowchart',
  'graph',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram-v2',
  'stateDiagram',
  'erDiagram',
  'gantt',
  'journey',
  'mindmap',
  'timeline',
  'gitGraph',
  'pie',
  'quadrantChart',
  'requirementDiagram',
  'block-beta',
  'C4Context',
  'C4Container',
  'C4Component',
  'C4Dynamic',
  'C4Deployment',
  'kanban',
  'zenuml',
  'sankey-beta',
  'xychart-beta'
];

const RESERVED_NODE_IDS = ['end', 'class', 'style', 'default', 'interpolate', 'linkStyle'];

const SPECIAL_LABEL_CHARS_RE = /[():/?&<>]|[^\x00-\x7F]/;

const FLOWCHART_FAMILY_RE = /^(\s*)(flowchart|graph)\b/m;
const TRAILING_SEMICOLON_LINE_RE = /;[ \t]*$/gm;

// Precomputed per-keyword node-id rename regex. Ordering of edge tokens matters: longest first
// so `---` matches before `--`, `-->` doesn't get split, etc.
const RESERVED_ID_RENAME_REGEXES = Object.freeze(
  Object.fromEntries(
    RESERVED_NODE_IDS.map((raw) => [
      raw,
      new RegExp(
        `(^|[\\s;{[(>|])${escapeRegex(raw)}(?=\\s*(---|--|-\\.|==|\\[|\\(|\\{|<))`,
        'g'
      )
    ])
  )
);

// Precomputed case-insensitive header replacements keyed on canonical prefix. Compiled at module
// load so `normalizeDiagramHeader` doesn't recompile 24 regexes per call.
const HEADER_PREFIX_REGEXES = Object.freeze(
  KNOWN_DIAGRAM_PREFIXES.map((prefix) => ({
    prefix,
    re: new RegExp(`^(\\s*)${prefix.replace(/[-]/g, '\\-')}\\b`, 'i')
  }))
);

const SMART_QUOTE_MAP = {
  '“': '"',
  '”': '"',
  '„': '"',
  '‟': '"',
  '‘': "'",
  '’': "'",
  '‚': "'",
  '‛': "'",
  '«': '"',
  '»': '"',
  '′': "'",
  '″': '"'
};

const SMART_QUOTE_RE = new RegExp(`[${Object.keys(SMART_QUOTE_MAP).join('')}]`, 'g');

function normalizeSmartQuotes(source) {
  if (!SMART_QUOTE_RE.test(source)) return null;
  return source.replace(SMART_QUOTE_RE, (ch) => SMART_QUOTE_MAP[ch] ?? ch);
}

/** Replace `flow chart` and case-variant prefixes; promote v2 syntax to `stateDiagram-v2`. */
function normalizeDiagramHeader(source) {
  const lines = source.split('\n');
  let headerIdx = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;
    headerIdx = i;
    break;
  }
  if (headerIdx === -1) return null;

  const original = lines[headerIdx];
  let updated = original.replace(/^(\s*)flow\s+chart\b/i, '$1flowchart');

  // Case-variant of known prefixes (e.g. `Flowchart`, `SEQUENCEDIAGRAM`). Skip replacement
  // when the prefix already appears in its canonical case so a no-op match doesn't dirty the
  // line. Uses precomputed regexes from module load.
  for (const { prefix, re } of HEADER_PREFIX_REGEXES) {
    const match = re.exec(updated);
    if (match && match[0].slice(match[1].length) !== prefix) {
      updated = updated.replace(re, `$1${prefix}`);
      break;
    }
  }

  // Bare `stateDiagram` followed by v2-only syntax → `stateDiagram-v2`.
  if (/^\s*stateDiagram\b(?!-v2)/.test(updated)) {
    const rest = lines.slice(headerIdx + 1).join('\n');
    if (/-->/.test(rest) || /\bnote\s+(left|right)\s+of\b/i.test(rest) || /\bstate\s+"[^"]+"\s+as\b/i.test(rest)) {
      updated = updated.replace(/^(\s*)stateDiagram\b/, '$1stateDiagram-v2');
    }
  }

  if (updated === original) return null;
  lines[headerIdx] = updated;
  return lines.join('\n');
}

/**
 * Rename reserved-word node IDs (`end`, `class`, …) consistently across declarations and edges.
 * Only attempts in flowchart-family diagrams since other diagram types have different ID grammars.
 */
function escapeReservedNodeIds(source) {
  if (!FLOWCHART_FAMILY_RE.test(source)) return null;

  const candidates = new Set();
  // Node declarations like `end[label]`, `end(label)`, `end{label}`, or bare `end -->`.
  const declRe = /(^|\n|[\s;])(end|class|style|default|interpolate|linkStyle|subgraph)\s*([\[\(\{<])/gi;
  let m;
  while ((m = declRe.exec(source)) != null) {
    const id = m[2].toLowerCase();
    // `subgraph` and `end` are legitimate keywords in subgraph blocks: skip when they appear at
    // start of line at indent, since that's almost certainly the keyword itself.
    const lineStartIdx = source.lastIndexOf('\n', m.index) + 1;
    const beforeId = source.slice(lineStartIdx, m.index + m[1].length).trim();
    if (beforeId === '' && (id === 'subgraph' || id === 'end')) continue;
    candidates.add(m[2]);
  }
  const edgeRe = /([\s;{[(>|])(end|class|style|default|interpolate|linkStyle)\s*(---|--|-\.|==|<==|<--|<-)/gi;
  while ((m = edgeRe.exec(source)) != null) {
    candidates.add(m[2]);
  }
  if (candidates.size === 0) return null;

  let updated = source;
  for (const raw of candidates) {
    const idRe = RESERVED_ID_RENAME_REGEXES[raw.toLowerCase()];
    if (!idRe) continue;
    idRe.lastIndex = 0;
    updated = updated.replace(idRe, `$1n_${raw.toLowerCase()}`);
  }
  return updated === source ? null : updated;
}

/** Wrap node and edge labels containing problematic characters in double quotes. Idempotent. */
function quoteLabelsWithSpecials(source) {
  let changed = false;
  // Node labels in []
  let updated = source.replace(/(\w[\w-]*)\[([^\]\n]+)\]/g, (whole, id, label) => {
    const inner = label.trim();
    if (inner.length === 0) return whole;
    if (/^".*"$/.test(inner)) return whole;
    if (/^\w[\w\s.-]*$/.test(inner)) return whole;
    if (!SPECIAL_LABEL_CHARS_RE.test(inner)) return whole;
    if (inner.includes('"')) return whole;
    changed = true;
    return `${id}["${inner}"]`;
  });
  // Node labels in ()
  updated = updated.replace(/(\w[\w-]*)\(([^)\n]+)\)/g, (whole, id, label) => {
    const inner = label.trim();
    if (inner.length === 0) return whole;
    if (/^".*"$/.test(inner)) return whole;
    if (/^\w[\w\s.-]*$/.test(inner)) return whole;
    if (!SPECIAL_LABEL_CHARS_RE.test(inner)) return whole;
    if (inner.includes('"')) return whole;
    changed = true;
    return `${id}("${inner}")`;
  });
  // Edge pipe-labels: `A -->|label with ()| B` — quote the pipe contents when needed.
  updated = updated.replace(/\|([^|\n]+)\|/g, (whole, inner) => {
    const t = inner.trim();
    if (!t) return whole;
    if (/^".*"$/.test(t)) return whole;
    if (!SPECIAL_LABEL_CHARS_RE.test(t)) return whole;
    if (t.includes('"')) return whole;
    changed = true;
    return `|"${t}"|`;
  });
  return changed ? updated : null;
}

/** Strip trailing semicolons outside flowchart/graph (other diagram types reject them). */
function stripInvalidSemicolons(source) {
  if (FLOWCHART_FAMILY_RE.test(source)) return null;
  if (!/;\s*$/m.test(source)) return null;
  const updated = source.replace(TRAILING_SEMICOLON_LINE_RE, '');
  return updated === source ? null : updated;
}

/** Append missing `end` keywords when subgraph nesting is unambiguous (single tail gap). */
function closeUnbalancedSubgraphs(source) {
  const lines = source.split('\n');
  let depth = 0;
  for (const line of lines) {
    const t = line.trim();
    if (/^subgraph\b/i.test(t)) depth += 1;
    else if (/^end\b/i.test(t)) depth -= 1;
  }
  if (depth <= 0 || depth > 3) return null;
  return `${source.replace(/\s+$/, '')}\n${'end\n'.repeat(depth)}`;
}

/**
 * Hoist a misplaced `%%{init: …}%%` directive to the first line and fix trivially-broken JSON
 * (single quotes → double quotes; trailing commas). Drop the directive only when it cannot be
 * recovered — that's strictly better than letting the parser reject the whole diagram.
 */
function repairInitDirective(source) {
  const initRe = /%%\{\s*init\s*:\s*([\s\S]*?)\s*\}%%/;
  const match = source.match(initRe);
  if (!match) return null;

  const rawBody = match[1];
  let normalized = rawBody
    .replace(/([{,]\s*)'([^']+)'(\s*:)/g, '$1"$2"$3') // single-quoted keys
    .replace(/:\s*'([^']*)'/g, ': "$1"') // single-quoted string values
    .replace(/,(\s*[}\]])/g, '$1'); // trailing commas

  let parsed = null;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    return null;
  }
  if (parsed == null || typeof parsed !== 'object') return null;

  const fixedDirective = `%%{init: ${JSON.stringify(parsed)}}%%`;
  let body = source.replace(initRe, '');

  // Hoist: remove blank lines at top and prepend the directive on its own line.
  body = body.replace(/^\s*\n+/, '');
  const result = `${fixedDirective}\n${body}`;

  if (result === source) return null;
  return result;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @typedef {{name: string, fn: (source: string, ctx: {parseError?: string | null}) => string | null}} Fixer
 */

/** @type {Fixer[]} */
const FIXERS = [
  { name: 'normalizeSmartQuotes', fn: normalizeSmartQuotes },
  { name: 'normalizeDiagramHeader', fn: normalizeDiagramHeader },
  { name: 'repairInitDirective', fn: repairInitDirective },
  { name: 'escapeReservedNodeIds', fn: escapeReservedNodeIds },
  { name: 'quoteLabelsWithSpecials', fn: quoteLabelsWithSpecials },
  { name: 'stripInvalidSemicolons', fn: stripInvalidSemicolons },
  { name: 'closeUnbalancedSubgraphs', fn: closeUnbalancedSubgraphs }
];

/**
 * Run all fixers in order. Returns `{ sanitized, applied }` where `applied` lists fixer names
 * that produced a change. When no fixer fired, returns `{ sanitized: source, applied: [] }`.
 *
 * @param {string} source
 * @param {{parseError?: string | null}} [ctx]
 */
export function sanitizeMermaid(source, ctx = {}) {
  if (typeof source !== 'string' || source.trim() === '') {
    return { sanitized: source, applied: [] };
  }
  let current = source;
  const applied = [];
  for (const { name, fn } of FIXERS) {
    let result;
    try {
      result = fn(current, ctx);
    } catch {
      result = null;
    }
    if (typeof result === 'string' && result !== current) {
      current = result;
      applied.push(name);
    }
  }
  return { sanitized: current, applied };
}

/** Test-only re-exports. */
export const __internal = {
  normalizeSmartQuotes,
  normalizeDiagramHeader,
  escapeReservedNodeIds,
  quoteLabelsWithSpecials,
  stripInvalidSemicolons,
  closeUnbalancedSubgraphs,
  repairInitDirective
};
