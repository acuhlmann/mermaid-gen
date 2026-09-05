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

/**
 * Elements whose end tag the HTML spec makes optional. Browsers close these
 * implicitly, so `<p>foo<p>bar` or a table without </td>/</tr> is valid HTML
 * that renders fine — flagging it as "unclosed" would send perfectly good
 * documents into needless repair turns.
 */
const OPTIONAL_END_TAGS = new Set([
  'html',
  'head',
  'body',
  'p',
  'li',
  'dt',
  'dd',
  'rt',
  'rp',
  'optgroup',
  'option',
  'colgroup',
  'caption',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th'
]);

/** Opening one of these implicitly closes an open <p> (HTML parsing spec). */
const OPENERS_THAT_CLOSE_P = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'details',
  'div',
  'dl',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hgroup',
  'hr',
  'main',
  'menu',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'ul'
]);

/** Opening tag → set of open elements it implicitly closes (sibling rules). */
const IMPLIED_END_BY_OPEN: Record<string, ReadonlySet<string>> = {
  li: new Set(['li']),
  dt: new Set(['dt', 'dd']),
  dd: new Set(['dt', 'dd']),
  option: new Set(['option']),
  optgroup: new Set(['option', 'optgroup']),
  tr: new Set(['tr', 'td', 'th', 'caption', 'colgroup']),
  td: new Set(['td', 'th']),
  th: new Set(['td', 'th']),
  thead: new Set(['caption', 'colgroup']),
  tbody: new Set(['thead', 'tbody', 'tr', 'td', 'th', 'caption', 'colgroup']),
  tfoot: new Set(['thead', 'tbody', 'tr', 'td', 'th', 'caption', 'colgroup']),
  rt: new Set(['rt', 'rp']),
  rp: new Set(['rt', 'rp'])
};

function fail(
  code: AnythingQualityLintCode,
  error: string,
  warnings: string[] = []
): AnythingQualityLintFailure {
  return { ok: false, code, error, warnings };
}

interface InlineScript {
  source: string;
  sourceType: 'script' | 'module';
}

/** `type` values (besides absent/empty) that mark an executable JS block. */
const JS_SCRIPT_TYPES = new Set([
  'module',
  'text/javascript',
  'application/javascript',
  'application/ecmascript',
  'text/ecmascript'
]);

function extractInlineScripts(html: string): InlineScript[] {
  const scripts: InlineScript[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const attrs = match[1] ?? '';
    if (/\bsrc\s*=/.test(attrs)) continue;
    const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']*)["']/i);
    const type = typeMatch ? typeMatch[1].trim().toLowerCase() : '';
    // Non-JS types (importmap, application/json, text/template, …) are data
    // blocks, not scripts — acorn must not parse them.
    if (type && !JS_SCRIPT_TYPES.has(type)) continue;
    scripts.push({
      source: match[2] ?? '',
      sourceType: type === 'module' ? 'module' : 'script'
    });
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
  return html
    .replace(
      /(<(?:script|style)\b[^>]*>)([\s\S]*?)(<\/(?:script|style)>)/gi,
      (_m, open, _body, close) => `${open}${close}`
    )
    .replace(/<!--[\s\S]*?-->/g, '');
}

function checkCssBalance(css: string, blockIndex: number): string | null {
  let depth = 0;
  let inString: '"' | "'" | null = null;
  let inComment = false;
  let escaped = false;
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (inComment) {
      if (ch === '*' && css[i + 1] === '/') {
        inComment = false;
        i += 1;
      }
      continue;
    }
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
    if (ch === '/' && css[i + 1] === '*') {
      inComment = true;
      i += 1;
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
  if (inComment) {
    return `Style block ${blockIndex}: unclosed comment.`;
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
      if (!stack.includes(name)) {
        // A stray closer for an optional-end element (e.g. </p> with no open
        // <p>) is synthesized by browsers; anything else is real mis-nesting.
        if (OPTIONAL_END_TAGS.has(name)) continue;
        const top = stack[stack.length - 1];
        return top
          ? `Closing </${name}> does not match open <${top}>.`
          : `Unexpected closing </${name}> with no matching opener.`;
      }
      // Pop implicitly-closed optional-end elements until the matching opener.
      while (stack.length > 0 && stack[stack.length - 1] !== name) {
        const top = stack[stack.length - 1];
        if (!OPTIONAL_END_TAGS.has(top)) {
          return `Closing </${name}> does not match open <${top}>.`;
        }
        stack.pop();
      }
      stack.pop();
      continue;
    }
    if (full.endsWith('/>')) continue;
    const implied = IMPLIED_END_BY_OPEN[name];
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (implied?.has(top) || (top === 'p' && OPENERS_THAT_CLOSE_P.has(name))) {
        stack.pop();
        continue;
      }
      break;
    }
    stack.push(name);
  }
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (!OPTIONAL_END_TAGS.has(stack[i])) {
      return `Unclosed <${stack[i]}> tag.`;
    }
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
    const source = scripts[i].source.trim();
    if (!source) continue;
    try {
      acorn.parse(source, { ecmaVersion: 'latest', sourceType: scripts[i].sourceType });
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
