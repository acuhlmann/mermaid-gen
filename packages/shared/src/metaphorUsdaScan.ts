/**
 * USDA text scan helpers for the Metaphor3D interchange stub.
 * Not a general USDA parser — only the subset `authorMetaphorUsda` emits.
 */

export class MetaphorUsdaParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetaphorUsdaParseError';
  }
}

export interface XformSpec {
  name: string;
  doc: string | null;
  body: string;
  path: string;
}

export interface ParsedAttr {
  usdType: string;
  name: string;
  raw: string;
}

export function usdaUnescape(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] !== '\\' || i + 1 >= value.length) {
      out += value[i];
      continue;
    }
    const next = value[i + 1];
    if (next === 'n') out += '\n';
    else if (next === 'r') out += '\r';
    else if (next === 't') out += '\t';
    else if (next === '"') out += '"';
    else if (next === '\\') out += '\\';
    else out += next;
    i += 1;
  }
  return out;
}

function skipQuoted(source: string, start: number): number {
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source[i] === '"') return i + 1;
    i += 1;
  }
  throw new MetaphorUsdaParseError('unterminated string');
}

function matchingClose(source: string, openIndex: number, close: string): number {
  const open = source[openIndex];
  let depth = 0;
  let i = openIndex;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '"') {
      i = skipQuoted(source, i);
      continue;
    }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  throw new MetaphorUsdaParseError(`unbalanced ${open}${close}`);
}

export function readQuoted(source: string, start: number): { value: string; end: number } {
  if (source[start] !== '"') {
    throw new MetaphorUsdaParseError('expected quoted string');
  }
  const end = skipQuoted(source, start);
  return { value: usdaUnescape(source.slice(start + 1, end - 1)), end };
}

function skipWs(source: string, start: number): number {
  let i = start;
  while (i < source.length && /\s/.test(source[i])) i += 1;
  return i;
}

function extractDoc(metadata: string): string | null {
  const match = /doc\s*=\s*"/.exec(metadata);
  if (!match || match.index === undefined) return null;
  return readQuoted(metadata, match.index + match[0].length - 1).value;
}

function readXformAt(
  source: string,
  start: number,
  parentPath: string
): { spec: XformSpec; end: number } {
  const token = 'def Xform "';
  const nameStart = start + token.length;
  const nameEnd = source.indexOf('"', nameStart);
  if (nameEnd === -1) throw new MetaphorUsdaParseError('unterminated prim name');
  const name = source.slice(nameStart, nameEnd);
  let i = skipWs(source, nameEnd + 1);
  let doc: string | null = null;
  if (source[i] === '(') {
    const close = matchingClose(source, i, ')');
    doc = extractDoc(source.slice(i + 1, close));
    i = skipWs(source, close + 1);
  }
  if (source[i] !== '{') throw new MetaphorUsdaParseError(`prim "${name}" missing body`);
  const bodyClose = matchingClose(source, i, '}');
  const path = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;
  return {
    spec: { name, doc, body: source.slice(i + 1, bodyClose), path },
    end: bodyClose + 1
  };
}

export function extractXforms(source: string, parentPath: string): XformSpec[] {
  const specs: XformSpec[] = [];
  const token = 'def Xform "';
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf(token, cursor);
    if (start === -1) break;
    const read = readXformAt(source, start, parentPath);
    specs.push(read.spec);
    cursor = read.end;
  }
  return specs;
}

function parseCustomLine(line: string): ParsedAttr {
  const match = /^custom (?:uniform )?([A-Za-z0-9[\]]+) (archislop:[A-Za-z0-9_]+) = (.+)$/.exec(
    line
  );
  if (!match) throw new MetaphorUsdaParseError(`unrecognized attribute: ${line}`);
  return { usdType: match[1], name: match[2], raw: match[3].trim() };
}

export function parseTopLevelCustomAttrs(body: string): ParsedAttr[] {
  const attrs: ParsedAttr[] = [];
  let i = 0;
  let depth = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === '"') {
      i = skipQuoted(body, i);
      continue;
    }
    if (ch === '{') {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      i += 1;
      continue;
    }
    if (depth === 0 && /\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (depth === 0 && body.startsWith('custom ', i)) {
      const nl = body.indexOf('\n', i);
      const end = nl === -1 ? body.length : nl;
      attrs.push(parseCustomLine(body.slice(i, end).trim()));
      i = end;
      continue;
    }
    i += 1;
  }
  return attrs;
}

export function parseCustomLayerData(source: string): Record<string, string> {
  const marker = 'customLayerData = {';
  const start = source.indexOf(marker);
  if (start === -1) throw new MetaphorUsdaParseError('missing customLayerData');
  const open = start + marker.length - 1;
  const close = matchingClose(source, open, '}');
  const block = source.slice(open + 1, close);
  const data: Record<string, string> = {};
  const lineRe = /string "([^"]+)" = "/g;
  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(block))) {
    const key = match[1];
    const read = readQuoted(block, match.index + match[0].length - 1);
    data[key] = read.value;
  }
  return data;
}
