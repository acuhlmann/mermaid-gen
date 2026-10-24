/**
 * Deterministic rescue for one recurring model mistake: one or more surplus `}` that close
 * the top-level object early. Measured on the chart generation bench (2026-10-24), every
 * "Unexpected non-whitespace character after JSON" rejection was this shape, and repair
 * turns tend to reproduce the same miscount rather than fix it. Two forms:
 *
 * - trailing: `{...}}` — the surplus closers are all that follows the first value;
 * - early:    `{"a":{...}}},"b":1}` — a run of `}` closes the root and a `,` follows.
 *   Closers in a run are interchangeable, so dropping one from the run is unambiguous;
 *   the result must still parse, and the caller's schema still checks the nesting.
 *
 * Anything else after the first complete value is left alone, so a genuinely malformed
 * document still fails as before.
 */

const MAX_EARLY_CLOSER_FIXES = 3;

/** Advance the in-string state by one character; returns whether we are still in a string. */
function stepInString(ch: string, state: { escaped: boolean }): boolean {
  if (state.escaped) {
    state.escaped = false;
    return true;
  }
  if (ch === '\\') {
    state.escaped = true;
    return true;
  }
  return ch !== '"';
}

const DEPTH_DELTA: Record<string, number> = { '{': 1, '[': 1, '}': -1, ']': -1 };

/** Index just past the first complete top-level object/array in `text`, or -1. */
function endOfFirstValue(text: string): number {
  let depth = 0;
  let inString = false;
  const stringState = { escaped: false };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? '';
    if (inString) {
      inString = stepInString(ch, stringState);
      continue;
    }
    inString = ch === '"';
    const delta = DEPTH_DELTA[ch] ?? 0;
    depth += delta;
    if (delta < 0 && depth <= 0) return depth === 0 ? i + 1 : -1;
  }
  return -1;
}

/** Drop one `}` from the run that closed the root object early, or null if that is not the shape. */
function dropEarlyRootCloser(text: string): string | null {
  const end = endOfFirstValue(text);
  if (end === -1 || end === text.length || text[end - 1] !== '}') return null;
  if (!text.slice(end).trimStart().startsWith(',')) return null;
  if (text[end - 2] !== '}') return null; // a lone `}` is not a run; nothing to spare
  return text.slice(0, end - 1) + text.slice(end);
}

/** Drop surplus closers when they are all that follows the first value, or null. */
function dropTrailingClosers(text: string): string | null {
  const end = endOfFirstValue(text);
  if (end === -1 || end === text.length) return null;
  return /^[\s}\]]+$/.test(text.slice(end)) ? text.slice(0, end) : null;
}

const parses = (text: string): boolean => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

/**
 * Return `text` with surplus closing brackets removed when that is the only thing wrong
 * with it, else `null`. Callers parse the result themselves.
 */
export function trimSurplusJsonClosers(text: string): string | null {
  let candidate = text.trim();
  if (!candidate.startsWith('{') && !candidate.startsWith('[')) return null;
  for (let i = 0; i < MAX_EARLY_CLOSER_FIXES; i += 1) {
    const next = dropEarlyRootCloser(candidate);
    if (next === null) break;
    candidate = next;
    if (parses(candidate)) return candidate;
  }
  const trailing = dropTrailingClosers(candidate);
  return trailing !== null && parses(trailing) ? trailing : null;
}

/** `JSON.parse`, retrying once with {@link trimSurplusJsonClosers} on failure. */
export function parseJsonTrimmingSurplusClosers(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (err) {
    const rescued = trimSurplusJsonClosers(text);
    if (rescued === null) throw err;
    return JSON.parse(rescued);
  }
}
