/**
 * Cleans agent “thinking” text and pulls diagram patch tool JSON into UI-friendly segments.
 */

const JSON_NAME_MARKER = /\{\s*"name"\s*:/g;

/**
 * @param {string} s
 * @param {number} openBraceIndex index of `{` that opens the object
 * @returns {number} index one past the matching `}`, or -1
 */
export function findBalancedBraceEnd(s, openBraceIndex) {
  let depth = 0;
  let inStr = false;
  let quote = '';
  let escaped = false;
  for (let i = openBraceIndex; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (c === '\\') {
        escaped = true;
        continue;
      }
      if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      quote = c;
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Strip whole-line model/stream delimiters like `_BORDER` without touching inline `_italic_`. */
export function stripInsightStreamDelimiters(text) {
  if (typeof text !== 'string' || !text) return '';
  const next = text
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (/^\s*_+[A-Z][A-Z0-9_]{1,48}_*\s*$/.test(line)) return false;
      return true;
    })
    .join('\n');
  return next.replace(/\n{3,}/g, '\n\n');
}

/**
 * @param {string} jsonSlice
 * @returns {{ kind: 'mermaid' | 'infographic' | 'chart' | 'metaphor3d' | 'anything', source: string, toolName: string, reason?: string } | null}
 */
export function parseDiagramPatchToolCall(jsonSlice) {
  let obj;
  try {
    obj = JSON.parse(jsonSlice);
  } catch {
    return null;
  }
  const rawName = String(obj?.name ?? '');
  const n = rawName.toLowerCase().replace(/_/g, '');
  const args = obj?.arguments ?? obj?.args ?? {};
  const reason = typeof args.reason === 'string' ? args.reason : undefined;

  const mermaidish = n.includes('mermaid') && n.includes('patch');
  const infographicish = n.includes('infographic') && n.includes('patch');
  const chartish = n.includes('chart') && n.includes('patch');

  if (mermaidish) {
    const source = typeof args.diagramSource === 'string' ? args.diagramSource : '';
    if (!source.trim()) return null;
    return { kind: 'mermaid', source, toolName: rawName, reason };
  }
  if (infographicish) {
    const source = typeof args.diagramSource === 'string' ? args.diagramSource : '';
    if (!source.trim()) return null;
    return { kind: 'infographic', source, toolName: rawName, reason };
  }
  if (chartish) {
    const source = typeof args.diagramSource === 'string' ? args.diagramSource : '';
    if (!source.trim()) return null;
    return { kind: 'chart', source, toolName: rawName, reason };
  }
  const metaphorish = n.includes('metaphor') && n.includes('patch');
  if (metaphorish) {
    const source = typeof args.diagramSource === 'string' ? args.diagramSource : '';
    if (!source.trim()) return null;
    return { kind: 'metaphor3d', source, toolName: rawName, reason };
  }
  const anythingish = n.includes('anything') && n.includes('patch');
  if (anythingish) {
    const source = typeof args.diagramSource === 'string' ? args.diagramSource : '';
    if (!source.trim()) return null;
    return { kind: 'anything', source, toolName: rawName, reason };
  }
  return null;
}

/**
 * @param {string} text
 * @returns {Array<{ type: 'text', value: string } | { type: 'diagram_patch', kind: 'mermaid' | 'infographic' | 'chart' | 'metaphor3d' | 'anything', source: string, toolName: string, reason?: string }>}
 */
export function partitionDiagramToolJsonBlocks(text) {
  if (typeof text !== 'string' || !text) return [{ type: 'text', value: text ?? '' }];
  const out = [];
  let cursor = 0;
  JSON_NAME_MARKER.lastIndex = 0;
  let match;
  while ((match = JSON_NAME_MARKER.exec(text)) !== null) {
    const open = match.index;
    if (open > cursor) {
      out.push({ type: 'text', value: text.slice(cursor, open) });
    }
    const end = findBalancedBraceEnd(text, open);
    if (end < 0) {
      out.push({ type: 'text', value: text.slice(open) });
      return out.length ? out : [{ type: 'text', value: text }];
    }
    const jsonSlice = text.slice(open, end);
    const parsed = parseDiagramPatchToolCall(jsonSlice);
    if (parsed) {
      out.push({ type: 'diagram_patch', ...parsed });
    } else {
      out.push({ type: 'text', value: jsonSlice });
    }
    cursor = end;
    JSON_NAME_MARKER.lastIndex = cursor;
  }
  if (cursor < text.length) {
    out.push({ type: 'text', value: text.slice(cursor) });
  }
  return out.length ? out : [{ type: 'text', value: text }];
}
