/**
 * Security policy lint for Anything-mode HTML. Reject-only — does not rewrite
 * the document. Catches sandbox-contract violations early so agents get actionable
 * repair errors instead of relying on prompt compliance alone.
 */

export type AnythingPolicyLintCode =
  | 'external_url'
  | 'parent_escape'
  | 'external_script'
  | 'external_stylesheet'
  | 'css_import_url'
  | 'meta_refresh'
  | 'base_href'
  | 'embedded_browsing'
  | 'javascript_url';

export interface AnythingPolicyLintSuccess {
  ok: true;
}

export interface AnythingPolicyLintFailure {
  ok: false;
  error: string;
  code: AnythingPolicyLintCode;
}

export type AnythingPolicyLintResult = AnythingPolicyLintSuccess | AnythingPolicyLintFailure;

function fail(code: AnythingPolicyLintCode, error: string): AnythingPolicyLintFailure {
  return { ok: false, code, error };
}

function stripJsComments(source: string): string {
  let out = '';
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i] ?? '';
    const next = source[i + 1] ?? '';
    if (quote) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      out += '\n';
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < source.length - 1 && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 1;
      out += ' ';
      continue;
    }
    out += ch;
  }
  return out;
}

/** Strip comments and xmlns namespace URIs (not network loads). */
function stripNonLoadContexts(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (_m, open, body, close) => {
      return `${open}${stripJsComments(String(body))}${close}`;
    })
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, open, body, close) => {
      return `${open}${String(body).replace(/\/\*[\s\S]*?\*\//g, ' ')}${close}`;
    })
    .replace(/\sxmlns\s*=\s*["']https?:\/\/[^"']*["']/gi, '');
}

const EXTERNAL_URL_PATTERN = /(?:https?:\/\/|\/\/|wss?:\/\/)/i;

const PARENT_ESCAPE_PATTERN =
  /\b(?:window\.(?:parent|top)|parent\.(?:postMessage|location)|top\.(?:location|postMessage))\b/i;

const EXTERNAL_SCRIPT_PATTERN = /<script\b[^>]*\bsrc\s*=\s*["'][^"']+["']/i;

const EXTERNAL_STYLESHEET_PATTERN =
  /<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*\bhref\s*=\s*["'][^"']+["']/i;

const CSS_IMPORT_URL_PATTERN = /@import\s+(?:url\s*\(\s*)?["']?(?:https?:|\/\/)/i;

const META_REFRESH_PATTERN = /<meta\b[^>]*\bhttp-equiv\s*=\s*["']refresh["']/i;

const BASE_HREF_PATTERN = /<base\b[^>]*\bhref\s*=\s*["'][^"']+["']/i;

const EMBEDDED_BROWSING_PATTERN = /<(?:iframe|object|embed)\b/i;

const JAVASCRIPT_URL_PATTERN = /\b(?:href|src|action|formaction|data|poster)\s*=\s*["']javascript:/i;

/**
 * Lint a freeform HTML document for sandbox-policy violations.
 */
export function lintAnythingPolicy(html: string): AnythingPolicyLintResult {
  const text = stripNonLoadContexts(html);

  if (EXTERNAL_SCRIPT_PATTERN.test(text)) {
    return fail(
      'external_script',
      'Anything HTML must not load external scripts (<script src="…">). Put all JS inline in <script> tags.'
    );
  }

  if (EXTERNAL_STYLESHEET_PATTERN.test(text)) {
    return fail(
      'external_stylesheet',
      'Anything HTML must not link external stylesheets. Put all CSS inline in <style> tags.'
    );
  }

  if (EXTERNAL_URL_PATTERN.test(text)) {
    return fail(
      'external_url',
      'Anything HTML must not reference external URLs (https://, //, ws://). Keep all assets inline (data: URIs, SVG, canvas).'
    );
  }

  if (PARENT_ESCAPE_PATTERN.test(text)) {
    return fail(
      'parent_escape',
      'Anything HTML must not access window.parent, window.top, or parent/top navigation APIs.'
    );
  }

  if (CSS_IMPORT_URL_PATTERN.test(text)) {
    return fail(
      'css_import_url',
      'Anything HTML must not use @import with external URLs. Keep CSS inline.'
    );
  }

  if (META_REFRESH_PATTERN.test(text)) {
    return fail('meta_refresh', 'Anything HTML must not use meta refresh navigation.');
  }

  if (BASE_HREF_PATTERN.test(text)) {
    return fail('base_href', 'Anything HTML must not use <base href="…">.');
  }

  if (EMBEDDED_BROWSING_PATTERN.test(text)) {
    return fail(
      'embedded_browsing',
      'Anything HTML must not embed nested browsing contexts (<iframe>, <object>, <embed>).'
    );
  }

  if (JAVASCRIPT_URL_PATTERN.test(text)) {
    return fail('javascript_url', 'Anything HTML must not use javascript: URLs.');
  }

  return { ok: true };
}
