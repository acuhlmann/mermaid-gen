/**
 * Structural and syntax quality lint for Anything-mode HTML. Helps LLM agents
 * produce valid documents without stripping scripts or styles.
 */

import * as acorn from 'acorn';

export type AnythingQualityLintCode =
  | 'missing_html'
  | 'missing_head'
  | 'missing_body'
  | 'missing_doctype'
  | 'unclosed_tag'
  | 'script_syntax'
  | 'css_unbalanced';

export interface AnythingQualityLintSuccess {
  ok: true;
  warnings: string[];
  quality: { scripts: number; styles: number };
}

export interface AnythingQualityLintFailure {
  ok: false;
  error: string;
  code: AnythingQualityLintCode;
  warnings: string[];
}

export type AnythingQualityLintResult = AnythingQualityLintSuccess | AnythingQualityLintFailure;

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]);

function fail(
  code: AnythingQualityLintCode,
  error: string,
  warnings: string[] = []
): AnythingQualityLintFailure {
  return { ok: false, code, error, warnings };
}

function extractInlineScripts(html: string): string[] {
  const scripts: string[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const attrs = match[1] ?? '';
    if (/\bsrc\s*=/.test(attrs)) continue;
    if (/\btype\s*=\s*["'](?:module|importmap)["']/i.test(attrs)) continue;
    scripts.push(match[2] ?? '');
  }
  return scripts;
}

function extractInlineStyles(html: string): string[] {
  const styles: string[] = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    styles.push(match[1] ?? '');
  }
  return styles;
}

function maskRawTextElementBodies(html: string): string {
  return html.replace(
    /(<(?:script|style)\b[^>]*>)([\s\S]*?)(<\/(?:script|style)>)/gi,
    (_m, open, _body, close) => `${open}${close}`
  );
}

function checkCssBalance(css: string, blockIndex: number): string | null {
  let depth = 0;
  let inString: '"' | "'" | null = null;
  let escaped = false;
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth < 0) {
        return `Style block ${blockIndex}: unexpected "}" (unbalanced braces).`;
      }
    }
  }
  if (depth !== 0) {
    return `Style block ${blockIndex}: unclosed "{" (unbalanced braces).`;
  }
  if (inString) {
    return `Style block ${blockIndex}: unclosed string literal.`;
  }
  return null;
}

function checkUnclosedTags(html: string): string | null {
  const stack: string[] = [];
  const tagRe = /<\/?([a-zA-Z][\w:-]*)\b[^>]*\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html)) !== null) {
    const full = match[0];
    const name = match[1].toLowerCase();
    if (VOID_ELEMENTS.has(name)) continue;
    if (full.startsWith('</')) {
      const expected = stack.pop();
      if (!expected) {
        return `Unexpected closing </${name}> with no matching opener.`;
      }
      if (expected !== name) {
        return `Closing </${name}> does not match open <${expected}>.`;
      }
      continue;
    }
    if (full.endsWith('/>')) continue;
    stack.push(name);
  }
  if (stack.length > 0) {
    return `Unclosed <${stack[stack.length - 1]}> tag.`;
  }
  return null;
}

/**
 * Lint document structure and inline JS/CSS syntax.
 */
export function lintAnythingQuality(html: string): AnythingQualityLintResult {
  const warnings: string[] = [];

  if (!/<html\b/i.test(html)) {
    return fail('missing_html', 'Anything HTML must include an <html> element.');
  }
  if (!/<head\b/i.test(html)) {
    return fail('missing_head', 'Anything HTML must include a <head> element.');
  }
  if (!/<body\b/i.test(html)) {
    return fail('missing_body', 'Anything HTML must include a <body> element.');
  }

  if (!/<!doctype\s+html/i.test(html)) {
    warnings.push('Missing <!DOCTYPE html> — prefer a full HTML5 document.');
  }

  const unclosed = checkUnclosedTags(maskRawTextElementBodies(html));
  if (unclosed) {
    return fail('unclosed_tag', unclosed, warnings);
  }

  const scripts = extractInlineScripts(html);
  for (let i = 0; i < scripts.length; i += 1) {
    const source = scripts[i].trim();
    if (!source) continue;
    try {
      acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return fail('script_syntax', `Script block ${i + 1}: ${msg}`, warnings);
    }
  }

  const styles = extractInlineStyles(html);
  for (let i = 0; i < styles.length; i += 1) {
    const cssError = checkCssBalance(styles[i], i + 1);
    if (cssError) {
      return fail('css_unbalanced', cssError, warnings);
    }
  }

  return {
    ok: true,
    warnings,
    quality: { scripts: scripts.length, styles: styles.length }
  };
}
