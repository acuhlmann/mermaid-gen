/**
 * Fenced code-block extraction for Thinking pane prose.
 */

export type FencedCodeBlock = {
  language: string;
  code: string;
  nextIndex: number;
};

const FENCE_OPEN = /^```([a-zA-Z0-9_-]*)?\s*$/;

/**
 * When `lines[startIndex]` opens a markdown fence, return the inner code and the next line index.
 * Unclosed fences consume through end-of-input (streaming).
 */
export function extractFencedCodeBlock(
  lines: string[],
  startIndex: number
): FencedCodeBlock | null {
  const openLine = (lines[startIndex] ?? '').trim();
  const openMatch = openLine.match(FENCE_OPEN);
  if (!openMatch) return null;

  const language = (openMatch[1] ?? '').trim().toLowerCase();
  const codeLines: string[] = [];
  let cursor = startIndex + 1;
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (line.trim() === '```') {
      return { language, code: codeLines.join('\n'), nextIndex: cursor + 1 };
    }
    codeLines.push(line);
    cursor += 1;
  }

  return { language, code: codeLines.join('\n'), nextIndex: lines.length };
}
