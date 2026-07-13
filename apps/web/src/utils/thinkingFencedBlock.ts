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
    const line = lines[cursor] ?? '';
    if (line.trim() === '```') {
      return { language, code: codeLines.join('\n'), nextIndex: cursor + 1 };
    }
    codeLines.push(line);
    cursor += 1;
  }

  return { language, code: codeLines.join('\n'), nextIndex: lines.length };
}

function joinProseSegments(before: string, after: string): string {
  const head = before.trimEnd();
  const tail = after.trim();
  if (head && tail) return `${head}\n\n${tail}`;
  return head || tail;
}

/**
 * First fenced block in a plan beat or prose chunk, with surrounding prose preserved.
 */
export function extractFirstFencedBlockFromText(
  text: string
): { prose: string; language: string; code: string } | null {
  if (typeof text !== 'string' || !text.includes('```')) return null;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const block = extractFencedCodeBlock(lines, i);
    if (!block) continue;
    const prose = joinProseSegments(
      lines.slice(0, i).join('\n'),
      lines.slice(block.nextIndex).join('\n')
    );
    return { prose, language: block.language, code: block.code };
  }
  return null;
}
