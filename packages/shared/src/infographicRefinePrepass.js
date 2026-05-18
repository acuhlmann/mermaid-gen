/**
 * Deterministic polish for infographic DSL before LLM refine transforms.
 * Trims reader-facing strings only — never changes template, data field, or item count.
 */

const SMART_QUOTE_REGEX = /[‘’“”]/g;
const KV_LINE = /^(\s*)(?:-\s+)?(label|desc|value)(\s+)(.*)$/i;

function normalizeQuotes(text) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

function polishReaderText(raw) {
  let t = normalizeQuotes(String(raw ?? ''));
  t = t.replace(/\s+/g, ' ').trim();
  t = t.replace(/\s+([,.;:!?])/g, '$1');
  t = t.replace(/([(\[])\s+/g, '$1');
  t = t.replace(/\s+([)\]])/g, '$1');
  if (t.length > 120) {
    const cut = t.slice(0, 117).replace(/\s+\S*$/, '');
    t = `${cut}…`;
  }
  return t;
}

/**
 * @param {string} source
 * @returns {{ dsl: string, applied: string[] }}
 */
export function refineInfographicDsl(source) {
  const applied = [];
  if (typeof source !== 'string' || !source.trim()) {
    return { dsl: source ?? '', applied };
  }

  let changed = false;
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const out = lines.map((line) => {
    const m = KV_LINE.exec(line);
    if (!m) return line;
    const [, indent, key, , valuePart] = m;
    const polished = polishReaderText(valuePart);
    const isListItem = /^\s*-\s/.test(line);
    const nextLine = isListItem
      ? `${indent}- ${key} ${polished}`
      : `${indent}${key} ${polished}`;
    if (nextLine === line && !SMART_QUOTE_REGEX.test(valuePart)) return line;
    changed = true;
    return nextLine;
  });

  let dsl = out.join('\n');
  if (SMART_QUOTE_REGEX.test(source)) {
    applied.push('normalize-quotes');
    changed = true;
  }
  if (changed) applied.push('trim-labels');

  return { dsl: changed ? dsl : source, applied };
}
