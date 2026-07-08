/**
 * Lightweight syntax-highlighted code blocks for Thinking pane prose (JSON / XML).
 */

import type { ReactNode } from 'react';

export function formatJsonForDisplay(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) return '';
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return source.replace(/\t/g, '  ').trimEnd();
  }
}

/** Best-effort XML pretty print; returns the original text when parsing fails. */
export function formatXmlForDisplay(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) return '';
  try {
    if (typeof DOMParser === 'undefined') return trimmed;
    const doc = new DOMParser().parseFromString(trimmed, 'application/xml');
    if (doc.querySelector('parsererror')) return trimmed;
    return serializeXmlNode(doc.documentElement, 0);
  } catch {
    return trimmed;
  }
}

function serializeXmlNode(node: Element, depth: number): string {
  const indent = '  '.repeat(depth);
  const tag = node.tagName;
  const attrs = [...node.attributes]
    .map((attr) => ` ${attr.name}="${attr.value}"`)
    .join('');
  const children = [...node.childNodes];
  const elementChildren = children.filter((child) => child.nodeType === 1) as Element[];
  const textChild = children.length === 1 && children[0]?.nodeType === 3 ? children[0].textContent?.trim() : '';

  if (elementChildren.length === 0) {
    if (textChild) {
      return `${indent}<${tag}${attrs}>${textChild}</${tag}>`;
    }
    return `${indent}<${tag}${attrs} />`;
  }

  const inner = elementChildren.map((child) => serializeXmlNode(child, depth + 1)).join('\n');
  return `${indent}<${tag}${attrs}>\n${inner}\n${indent}</${tag}>`;
}

function pushToken(
  out: ReactNode[],
  key: string,
  className: string,
  value: string
) {
  out.push(
    <span key={key} className={className}>
      {value}
    </span>
  );
}

function highlightJsonLine(line: string, lineKey: string): ReactNode[] {
  const out: ReactNode[] = [];
  const keyRe = /"([^"\\]|\\.)*"(?=\s*:)/g;
  const strRe = /"([^"\\]|\\.)*"/g;
  const numRe = /\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g;
  const boolNullRe = /\b(true|false|null)\b/g;

  let cursor = 0;
  const markers: Array<{ index: number; len: number; className: string; value: string }> = [];

  let match: RegExpExecArray | null;
  keyRe.lastIndex = 0;
  while ((match = keyRe.exec(line)) !== null) {
    markers.push({
      index: match.index,
      len: match[0].length,
      className: 'insights-code-token-key',
      value: match[0]
    });
  }

  strRe.lastIndex = 0;
  while ((match = strRe.exec(line)) !== null) {
    const overlapsKey = markers.some(
      (m) => match!.index >= m.index && match!.index < m.index + m.len
    );
    if (overlapsKey) continue;
    markers.push({
      index: match.index,
      len: match[0].length,
      className: 'insights-code-token-string',
      value: match[0]
    });
  }

  numRe.lastIndex = 0;
  while ((match = numRe.exec(line)) !== null) {
    markers.push({
      index: match.index,
      len: match[0].length,
      className: 'insights-code-token-number',
      value: match[0]
    });
  }

  boolNullRe.lastIndex = 0;
  while ((match = boolNullRe.exec(line)) !== null) {
    markers.push({
      index: match.index,
      len: match[0].length,
      className: 'insights-code-token-keyword',
      value: match[0]
    });
  }

  markers.sort((a, b) => a.index - b.index || b.len - a.len);

  const used: Array<[number, number]> = [];
  for (const marker of markers) {
    const overlaps = used.some(([start, end]) => marker.index < end && marker.index + marker.len > start);
    if (overlaps) continue;
    used.push([marker.index, marker.index + marker.len]);
    if (marker.index > cursor) {
      out.push(line.slice(cursor, marker.index));
    }
    pushToken(out, `${lineKey}-m-${marker.index}`, marker.className, marker.value);
    cursor = marker.index + marker.len;
  }

  if (cursor < line.length) out.push(line.slice(cursor));
  return out.length ? out : [line];
}

function highlightXmlLine(line: string, lineKey: string): ReactNode[] {
  const out: ReactNode[] = [];
  const tokenRe =
    /(<!--[\s\S]*?-->)|(<\/?[A-Za-z][\w:.-]*(?:\s+[^>]*?)?\/?>)|("([^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)/g;
  let cursor = 0;
  let tokenIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(line)) !== null) {
    if (match.index > cursor) out.push(line.slice(cursor, match.index));
    const token = match[0];
    let className = 'insights-code-token-plain';
    if (match[1]) className = 'insights-code-token-comment';
    else if (match[2]) className = 'insights-code-token-tag';
    else if (match[3]) className = 'insights-code-token-string';
    else if (match[5]) className = 'insights-code-token-number';
    pushToken(out, `${lineKey}-x-${tokenIndex}`, className, token);
    cursor = match.index + token.length;
    tokenIndex += 1;
  }
  if (cursor < line.length) out.push(line.slice(cursor));
  return out.length ? out : [line];
}

function highlightPlainCodeLine(line: string, lineKey: string): ReactNode[] {
  const out: ReactNode[] = [];
  const tokenRe = /("([^"\\]|\\.)*"|'([^'\\]|\\.)*'|\b\d+(?:\.\d+)?\b)/g;
  let cursor = 0;
  let tokenIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(line)) !== null) {
    if (match.index > cursor) out.push(line.slice(cursor, match.index));
    const token = match[0];
    const className = /^\d/.test(token)
      ? 'insights-code-token-number'
      : 'insights-code-token-string';
    pushToken(out, `${lineKey}-p-${tokenIndex}`, className, token);
    cursor = match.index + token.length;
    tokenIndex += 1;
  }
  if (cursor < line.length) out.push(line.slice(cursor));
  return out.length ? out : [line];
}

function highlightCodeLines(code: string, language: string, keyPrefix: string): ReactNode[] {
  const lines = code.split('\n');
  const highlighter =
    language === 'json' || language === 'javascript' || language === 'js'
      ? highlightJsonLine
      : language === 'xml' || language === 'html'
        ? highlightXmlLine
        : highlightPlainCodeLine;

  return lines.map((line, index) => (
    <span key={`${keyPrefix}-ln-${index}`} className="insights-code-line">
      {highlighter(line, `${keyPrefix}-ln-${index}`)}
    </span>
  ));
}

export function ThinkingSyntaxCodeBlock({
  code,
  language = '',
  keyPrefix = 'code'
}: {
  code: string;
  language?: string;
  keyPrefix?: string;
}) {
  const lang = language.trim().toLowerCase();
  const formatted =
    lang === 'json' || (!lang && code.trim().startsWith('{'))
      ? formatJsonForDisplay(code)
      : lang === 'xml' || lang === 'html' || code.trim().startsWith('<')
        ? formatXmlForDisplay(code)
        : code.replace(/\t/g, '  ').trimEnd();
  const resolvedLang =
    lang ||
    (formatted.trim().startsWith('{') || formatted.trim().startsWith('[') ? 'json' : '') ||
    (formatted.trim().startsWith('<') ? 'xml' : 'text');

  return (
    <pre
      className={`insights-code-block is-lang-${resolvedLang || 'text'}`}
      data-testid="thinking-syntax-code"
    >
      <code className="insights-code-block-inner">
        {highlightCodeLines(formatted, resolvedLang, keyPrefix)}
      </code>
    </pre>
  );
}
