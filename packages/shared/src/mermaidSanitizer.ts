/**
 * Deterministic post-LLM Mermaid sanitizer.
 *
 * Runs as a parse-fail rescue inside `validateAndPreparePatch`. Each fixer is composable,
 * idempotent, and conservative: when in doubt, leave the source alone and let the LLM
 * repair loop handle it. The goal is to recover mechanical failures (smart quotes,
 * unquoted special-char labels, reserved-word node IDs, header typos, missing `end`, malformed
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

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Precomputed per-keyword node-id rename regex. Ordering of edge tokens matters: longest first
// so `---` matches before `--`, `-->` doesn't get split, etc.
const RESERVED_ID_RENAME_REGEXES = Object.freeze(
  Object.fromEntries(
    RESERVED_NODE_IDS.map((raw) => [
      raw,
      new RegExp(`(^|[\\s;{[(>|])${escapeRegex(raw)}(?=\\s*(---|--|-\\.|==|\\[|\\(|\\{|<))`, 'g')
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

const SMART_QUOTE_MAP: Record<string, string> = {
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

function normalizeSmartQuotes(source: string) {
  if (!SMART_QUOTE_RE.test(source)) return null;
  return source.replace(SMART_QUOTE_RE, (ch: string) => SMART_QUOTE_MAP[ch] ?? ch);
}

/** Replace `flow chart` and case-variant prefixes; promote v2 syntax to `stateDiagram-v2`. */
function normalizeDiagramHeader(source: string) {
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
    if (
      /-->/.test(rest) ||
      /\bnote\s+(left|right)\s+of\b/i.test(rest) ||
      /\bstate\s+"[^"]+"\s+as\b/i.test(rest)
    ) {
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
function escapeReservedNodeIds(source: string) {
  if (!FLOWCHART_FAMILY_RE.test(source)) return null;

  const candidates = new Set<string>();
  // Node declarations like `end[label]`, `end(label)`, `end{label}`, or bare `end -->`.
  const declRe =
    /(^|\n|[\s;])(end|class|style|default|interpolate|linkStyle|subgraph)\s*([\[\(\{<])/gi;
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
  const edgeRe =
    /([\s;{[(>|])(end|class|style|default|interpolate|linkStyle)\s*(---|--|-\.|==|<==|<--|<-)/gi;
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
function quoteLabelsWithSpecials(source: string) {
  let changed = false;
  // Node labels in [] — skip subroutine shapes `id[[…]]` so we don't break them.
  let updated = source.replace(
    /(\w[\w-]*)\[(?!\[)([^\]\n]+)\](?!\])/g,
    (whole: string, id: string, label: string) => {
      const inner = label.trim();
      if (inner.length === 0) return whole;
      if (/^".*"$/.test(inner)) return whole;
      if (/^\w[\w\s.-]*$/.test(inner)) return whole;
      if (!SPECIAL_LABEL_CHARS_RE.test(inner)) return whole;
      if (inner.includes('"')) return whole;
      changed = true;
      return `${id}["${inner}"]`;
    }
  );
  // Node labels in () — skip circle shapes `id((…))` so we don't break them.
  updated = updated.replace(
    /(\w[\w-]*)\((?!\()([^)\n]+)\)(?!\))/g,
    (whole: string, id: string, label: string) => {
      const inner = label.trim();
      if (inner.length === 0) return whole;
      if (/^".*"$/.test(inner)) return whole;
      if (/^\w[\w\s.-]*$/.test(inner)) return whole;
      if (!SPECIAL_LABEL_CHARS_RE.test(inner)) return whole;
      if (inner.includes('"')) return whole;
      changed = true;
      return `${id}("${inner}")`;
    }
  );
  // Edge pipe-labels: `A -->|label with ()| B` — quote the pipe contents when needed.
  updated = updated.replace(/\|([^|\n]+)\|/g, (whole: string, inner: string) => {
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

/** Escape and wrap bracket / paren node labels that contain raw `"`, newlines, or backslashes. */
function quoteBracketLabelsWithEmbeddedQuotes(source: string) {
  if (!FLOWCHART_FAMILY_RE.test(source)) return null;
  let changed = false;

  function esc(inner: string) {
    return inner
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r\n/g, '\\n')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\n');
  }

  let updated = source.replace(
    /(\w[\w-]*)\[([^\]\n]+)\]/g,
    (whole: string, id: string, label: string) => {
      const inner = label.trim();
      if (inner.length === 0) return whole;
      if (/^".*"$/.test(inner)) return whole;
      if (!inner.includes('"') && !/[\n\r]/.test(inner) && !/\\/.test(inner)) return whole;
      changed = true;
      return `${id}["${esc(inner)}"]`;
    }
  );
  updated = updated.replace(
    /(\w[\w-]*)\(([^)\n]+)\)/g,
    (whole: string, id: string, label: string) => {
      const inner = label.trim();
      if (inner.length === 0) return whole;
      if (/^".*"$/.test(inner)) return whole;
      if (!inner.includes('"') && !/[\n\r]/.test(inner) && !/\\/.test(inner)) return whole;
      changed = true;
      return `${id}("${esc(inner)}")`;
    }
  );
  return changed ? updated : null;
}

/**
 * Mermaid `style` accepts one node id per line; comma lists (e.g. `style B,C,D fill:#fff`)
 * are parsed as a single bogus node id. Expand to one `style` line per id (classDef/class
 * already support comma lists — this fix is style-only).
 */
const STYLE_LINE_PROPERTY_RE = /\b(fill|stroke|stroke-width|color|stroke-dasharray)\s*:/i;

function expandCommaSeparatedStyleLines(source: string) {
  if (!FLOWCHART_FAMILY_RE.test(source)) return null;

  const lines = source.split('\n');
  let changed = false;
  const out = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!/^\s*style\s+/i.test(trimmed)) {
      out.push(line);
      continue;
    }

    const bodyMatch = trimmed.match(/^\s*style\s+(.+)$/i);
    if (!bodyMatch) {
      out.push(line);
      continue;
    }

    const rest = bodyMatch[1];
    const propMatch = STYLE_LINE_PROPERTY_RE.exec(rest);
    if (!propMatch) {
      out.push(line);
      continue;
    }

    const idPart = rest.slice(0, propMatch.index).trim();
    const propPart = rest.slice(propMatch.index).trim();
    if (!idPart.includes(',')) {
      out.push(line);
      continue;
    }

    const ids = idPart.split(/\s*,\s*/).filter(Boolean);
    if (ids.length < 2) {
      out.push(line);
      continue;
    }

    const indent = line.match(/^\s*/)?.[0] ?? '';
    for (const id of ids) {
      out.push(`${indent}style ${id} ${propPart}`);
    }
    changed = true;
  }

  return changed ? out.join('\n') : null;
}

/** Strip trailing semicolons outside flowchart/graph (other diagram types reject them). */
function stripInvalidSemicolons(source: string) {
  if (FLOWCHART_FAMILY_RE.test(source)) return null;
  if (!/;\s*$/m.test(source)) return null;
  const updated = source.replace(TRAILING_SEMICOLON_LINE_RE, '');
  return updated === source ? null : updated;
}

/** Append missing `end` keywords when subgraph nesting is unambiguous (single tail gap). */
function closeUnbalancedSubgraphs(source: string) {
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
function repairInitDirective(source: string) {
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

/**
 * Diagram types whose grammar has no `classDef` / `class` / `style` / `linkStyle` construct.
 * Russ's "type roulette + loud theming" prompt frequently pairs one of these (mindmap, pie,
 * journey, …) with a styling directive — the parser then rejects the whole diagram (e.g. a
 * top-level `classDef` line in a mindmap parses as a second root: "There can be only one root").
 * Stripping the orphan directive lets the diagram render unstyled instead of failing outright.
 * The flowchart family and stateDiagram/classDiagram (which DO support these) are excluded, so
 * legitimate theming is never touched.
 */
// Kept deliberately conservative: only types whose grammar has NO node-styling construct at all,
// so a standalone classDef/class/style/linkStyle line is always a hard parse error. Types that DO
// support styling in current Mermaid (flowchart/graph/state/class/er, block-beta, quadrantChart,
// gantt, kanban) are excluded so a legitimate directive is never stripped. The prompt handles the
// broader "theme exotic types via %%init%% only" prevention; this fixer is the proven-safe backstop
// (chiefly the reported mindmap + classDef → "There can be only one root" failure).
const STYLE_DIRECTIVE_UNSUPPORTED_TYPES = new Set([
  'mindmap',
  'pie',
  'journey',
  'timeline',
  'gitGraph',
  'sankey-beta',
  'xychart-beta',
  'requirementDiagram',
  'C4Context',
  'C4Container',
  'C4Component',
  'C4Dynamic',
  'C4Deployment'
]);

const STYLE_DIRECTIVE_LINE_RE = /^(classDef|class|style|linkStyle)\b/i;

/** Canonical diagram prefix of the header line, skipping blanks, `%%` directives, and a leading `---` frontmatter block. */
function detectDiagramType(source: string): string | null {
  const lines = source.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i += 1;
  if (lines[i]?.trim() === '---') {
    i += 1;
    while (i < lines.length && lines[i].trim() !== '---') i += 1;
    i += 1; // consume closing ---
  }
  for (; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;
    for (const { prefix, re } of HEADER_PREFIX_REGEXES) {
      if (re.test(trimmed)) return prefix;
    }
    return null;
  }
  return null;
}

/**
 * Remove `classDef` / `class` / `style` / `linkStyle` lines from diagram types whose grammar
 * rejects them. Only fires on the styling-unsupported types above, so it never strips a valid
 * directive from a flowchart/state/class diagram. Runs only as a parse-fail rescue, so a valid
 * diagram never reaches it.
 */
function stripUnsupportedStyleDirectives(source: string) {
  const type = detectDiagramType(source);
  if (!type || !STYLE_DIRECTIVE_UNSUPPORTED_TYPES.has(type)) return null;
  const lines = source.split('\n');
  const kept = lines.filter((line) => !STYLE_DIRECTIVE_LINE_RE.test(line.trim()));
  if (kept.length === lines.length) return null;
  return kept.join('\n');
}

/**
 * @typedef {{name: string, fn: (source: string, ctx: {parseError?: string | null}) => string | null}} Fixer
 */

/** @type {Fixer[]} */
type Fixer = (source: string, ctx?: { parseError?: string | null }) => string | null;
const FIXERS: Array<{ name: string; fn: Fixer }> = [
  { name: 'normalizeSmartQuotes', fn: normalizeSmartQuotes },
  { name: 'normalizeDiagramHeader', fn: normalizeDiagramHeader },
  { name: 'stripUnsupportedStyleDirectives', fn: stripUnsupportedStyleDirectives },
  { name: 'repairInitDirective', fn: repairInitDirective },
  { name: 'expandCommaSeparatedStyleLines', fn: expandCommaSeparatedStyleLines },
  { name: 'escapeReservedNodeIds', fn: escapeReservedNodeIds },
  { name: 'quoteLabelsWithSpecials', fn: quoteLabelsWithSpecials },
  { name: 'quoteBracketLabelsWithEmbeddedQuotes', fn: quoteBracketLabelsWithEmbeddedQuotes },
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
/**
 * Lightweight pre-render normalization (safe to run on every client render).
 * Expands invalid multi-node `style` lines; idempotent.
 *
 * @param {string} source
 * @returns {string}
 */
export function prepareMermaidForRender(source: string): string {
  if (typeof source !== 'string' || source.trim() === '') return source;
  const expanded = expandCommaSeparatedStyleLines(source);
  return expanded ?? source;
}

export function sanitizeMermaid(
  source: string,
  ctx: { parseError?: string | null } = {}
): { sanitized: string; applied: string[] } {
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
  quoteBracketLabelsWithEmbeddedQuotes,
  stripInvalidSemicolons,
  closeUnbalancedSubgraphs,
  repairInitDirective,
  expandCommaSeparatedStyleLines,
  stripUnsupportedStyleDirectives,
  detectDiagramType
};
