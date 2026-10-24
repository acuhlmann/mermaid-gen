/**
 * Deterministic rescue for one recurring model mistake: a complete JSON object followed by
 * one or more surplus closing brackets (`{...}}`). Measured on the chart generation bench
 * (2026-10-24), every "Unexpected non-whitespace character after JSON" rejection was this
 * shape, and repair turns tend to reproduce the same miscount rather than fix it.
 *
 * Only trailing `}` / `]` (and whitespace) are dropped. Anything else after the first
 * complete value is left alone, so a genuinely malformed document still fails as before.
 */

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

/**
 * Return `text` with surplus trailing closing brackets removed when that is the only
 * thing wrong with it, else `null`. Callers parse the result themselves.
 */
export function trimSurplusJsonClosers(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  const end = endOfFirstValue(trimmed);
  if (end === -1 || end === trimmed.length) return null;
  if (!/^[\s}\]]+$/.test(trimmed.slice(end))) return null;
  const candidate = trimmed.slice(0, end);
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    return null;
  }
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
