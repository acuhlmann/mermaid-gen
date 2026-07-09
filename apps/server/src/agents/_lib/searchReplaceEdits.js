/**
 * Aider-style search/replace edit application for Anything-mode incremental
 * edits. Pure string transformation — no validation happens here. The caller
 * MUST route the edited result through the full validation ladder
 * (policy lint, quality lint, runtime check) exactly like a full rewrite;
 * incremental edits never earn a cheaper gate.
 *
 * Matching is deliberately strict: each SEARCH block must match exactly once
 * (first verbatim, then a whitespace-tolerant line-window fallback). Ambiguity
 * and misses fail the WHOLE call — edits are atomic, so a half-applied
 * document can never reach the validators or the user.
 */

/** Drop leading/trailing all-whitespace lines (models often pad blocks). */
function trimBlankEdges(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === '') start += 1;
  while (end > start && lines[end - 1].trim() === '') end -= 1;
  return lines.slice(start, end);
}

function applyOneEdit(text, search, replace) {
  const first = text.indexOf(search);
  if (first !== -1) {
    if (text.indexOf(search, first + search.length) !== -1) {
      return {
        ok: false,
        error:
          'SEARCH text matches more than once — include more surrounding lines so it matches exactly once.'
      };
    }
    return { ok: true, text: text.slice(0, first) + replace + text.slice(first + search.length) };
  }

  // Whitespace-tolerant fallback: compare line-by-line with trimmed lines so
  // indentation drift between the model's copy and the document still matches.
  const sourceLines = text.split('\n');
  const searchLines = trimBlankEdges(search.split('\n')).map((line) => line.trim());
  if (searchLines.length === 0) {
    return { ok: false, error: 'SEARCH block is blank — copy the exact text you want to change.' };
  }
  const matches = [];
  for (let start = 0; start + searchLines.length <= sourceLines.length; start += 1) {
    let hit = true;
    for (let j = 0; j < searchLines.length; j += 1) {
      if (sourceLines[start + j].trim() !== searchLines[j]) {
        hit = false;
        break;
      }
    }
    if (hit) {
      matches.push(start);
      if (matches.length > 1) break;
    }
  }
  if (matches.length === 0) {
    return {
      ok: false,
      error:
        'SEARCH text was not found in the current document. Copy the text verbatim from ' +
        'get_anything_html and retry, or fall back to apply_anything_patch with the full document.'
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      error:
        'SEARCH text matches more than once — include more surrounding lines so it matches exactly once.'
    };
  }
  const start = matches[0];
  const replaceLines = replace === '' ? [] : replace.split('\n');
  const merged = [
    ...sourceLines.slice(0, start),
    ...replaceLines,
    ...sourceLines.slice(start + searchLines.length)
  ];
  return { ok: true, text: merged.join('\n') };
}

/**
 * Apply a sequence of search/replace edits to a document. Sequential: each
 * edit sees the result of the previous one. Atomic: the first failing edit
 * aborts the whole call and the original text is untouched.
 *
 * @param {string} source Current document text.
 * @param {Array<{ search: string, replace: string }>} edits
 * @returns {{ ok: true, text: string } | { ok: false, error: string, failedIndex: number }}
 */
export function applySearchReplaceEdits(source, edits) {
  if (!Array.isArray(edits) || edits.length === 0) {
    return { ok: false, error: 'No edits provided.', failedIndex: 0 };
  }
  let text = typeof source === 'string' ? source : '';
  for (let i = 0; i < edits.length; i += 1) {
    const search = edits[i]?.search;
    const replace = typeof edits[i]?.replace === 'string' ? edits[i].replace : '';
    if (typeof search !== 'string' || search.length === 0) {
      return {
        ok: false,
        error: `Edit ${i + 1} of ${edits.length}: SEARCH block is empty.`,
        failedIndex: i
      };
    }
    const outcome = applyOneEdit(text, search, replace);
    if (!outcome.ok) {
      return {
        ok: false,
        error: `Edit ${i + 1} of ${edits.length}: ${outcome.error}`,
        failedIndex: i
      };
    }
    text = outcome.text;
  }
  return { ok: true, text };
}
