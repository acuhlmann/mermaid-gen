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

/**
 * A reserved word immediately before a `/` means the `/` opens a regex, not a
 * division — `return /"/.test(v)` is the common shape. The character test
 * below cannot see this on its own: it reads the `n` of `return` as the end of
 * an identifier and calls the slash division, which is how #639's quote
 * corruption stayed reachable after #639 fixed it for `(`, `,` and `=`.
 *
 * The leading `[^\w$.]` carries both halves of the boundary. Without the
 * word part, `margin / 2` would lex as a regex because `margin` ends in `in`;
 * without the `.`, so would `map.delete / 2`. These are all reserved words, so
 * no identifier can collide with one.
 */
const KEYWORD_BEFORE_REGEX =
  /(?:^|[^\w$.])(?:return|typeof|instanceof|case|delete|throw|yield|await|void|else|new|in|of|do)\s*$/;

/** How far back `KEYWORD_BEFORE_REGEX` may look. `instanceof` plus its boundary
 * character is 11; the rest is slack for whitespace between the keyword and the
 * slash. Bounded so the lookback stays O(1) per slash rather than O(document). */
const KEYWORD_LOOKBACK = 64;

/**
 * True when a `/` at this point in the source starts a regex literal rather
 * than a division operator, using the standard lexer heuristic: a value just
 * ended (identifier/number char, `)`, `]`, `}`, or a closed string/template)
 * means division; anything else (an operator, punctuation, a reserved word, or
 * start of input) means a regex can start here. `lastSig` is the last
 * non-whitespace character already emitted and `emitted` the output so far.
 */
function isRegexLiteralContext(lastSig: string, emitted: string): boolean {
  if (!lastSig) return true;
  if (!/[\w$)\]}"'`]/.test(lastSig)) return true;
  return KEYWORD_BEFORE_REGEX.test(emitted.slice(-KEYWORD_LOOKBACK));
}

function stripJsComments(source: string): string {
  let out = '';
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;
  let lastSig = '';
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
        lastSig = ch;
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
    // A regex literal's pattern can contain an unescaped `"` or `'` (e.g.
    // `str.replace(/"/g, '&quot;')`) that the plain quote-tracker above would
    // otherwise mistake for the start of a string, corrupting the quote state
    // for the rest of the document and hiding every later `//` comment (and
    // the external-URL false positive that follows) behind it. Scan a regex
    // literal as one token instead of falling into that trap.
    if (ch === '/' && isRegexLiteralContext(lastSig, out)) {
      let j = i + 1;
      let inClass = false;
      let esc = false;
      let closed = false;
      while (j < source.length) {
        const c = source[j] ?? '';
        if (esc) {
          esc = false;
        } else if (c === '\\') {
          esc = true;
        } else if (c === '\n') {
          break;
        } else if (c === '[') {
          inClass = true;
        } else if (c === ']') {
          inClass = false;
        } else if (c === '/' && !inClass) {
          j += 1;
          closed = true;
          break;
        }
        j += 1;
      }
      if (closed) {
        while (j < source.length && /[a-z]/i.test(source[j] ?? '')) j += 1;
        const literal = source.slice(i, j);
        out += literal;
        lastSig = literal[literal.length - 1] ?? '/';
        i = j - 1;
        continue;
      }
      // No closing `/` before end of line: not a regex literal after all
      // (most likely division or a stray slash) — fall through as a plain char.
    }
    out += ch;
    if (!/\s/.test(ch)) lastSig = ch;
  }
  return out;
}

/**
 * XML namespace URIs. These are identifiers, not addresses: no browser ever
 * fetches one, and `createElementNS` / `setAttributeNS` require them verbatim —
 * they are the only way to build SVG or MathML from script.
 *
 * The `xmlns=` ATTRIBUTE form was already exempt, which left the lint accepting
 * a namespace in markup and rejecting the identical string in a JS literal. A
 * document that draws its SVG from script therefore burned a repair turn on
 * correct code, and the repair error told it to inline assets it had not
 * requested. Measured: `external_url` was the single largest rejection code in
 * the generation baseline, and the offender a probe caught was
 * `var ns = "http://www.w3.org/2000/svg"`.
 *
 * Exempting these five is not a hole. The security boundary is the client's
 * `allow-scripts` iframe and its CSP (`connect-src 'none'`), not this lint; a
 * page that actually fetched one of these would be refused at runtime and
 * rejected by the runtime rung. The list is exact URIs with a boundary, never
 * prefixes, so a lookalike host does not slip through.
 */
const XML_NAMESPACE_URIS = [
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/1999/xhtml',
  'http://www.w3.org/1998/Math/MathML',
  'http://www.w3.org/XML/1998/namespace'
];

const XML_NAMESPACE_PATTERN = new RegExp(
  `(?:${XML_NAMESPACE_URIS.map((uri) => uri.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\w./-])`,
  'gi'
);

/**
 * Strip comments and XML namespace URIs (identifiers, not network loads).
 *
 * The script/style body patterns require a literal closing tag, so a
 * document whose `<script>` never closes — a generation cut short mid-page,
 * measured in the generation baseline as two `static-explainer` samples
 * that stopped mid-function with no `</script>`/`</html>` at all — left the
 * *entire* unclosed body unstripped, comments included. The first `//` in
 * any surviving line comment (e.g. `let angleMoon = 0.9;    // radians`)
 * then read as an external URL, so the model was told to remove a URL that
 * never existed instead of being told its document was truncated. `$` as a
 * fallback closer only matches when no real `</script>`/`</style>` exists
 * (the lazy `[\s\S]*?` still prefers the real tag first), so a well-formed
 * document strips exactly as before; an unclosed one now falls through to
 * `lintAnythingQuality`'s `unclosed_tag` check, which names the real defect.
 */
function stripNonLoadContexts(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>|$)/gi, (_m, open, body, close) => {
      return `${open}${stripJsComments(String(body))}${close}`;
    })
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>|$)/gi, (_m, open, body, close) => {
      return `${open}${String(body).replace(/\/\*[\s\S]*?\*\//g, ' ')}${close}`;
    })
    .replace(/\sxmlns(?::\w+)?\s*=\s*["']https?:\/\/[^"']*["']/gi, '')
    .replace(XML_NAMESPACE_PATTERN, '');
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

/** Nested contexts created from script — markup-only checks miss these. */
const JS_EMBEDDED_BROWSING_PATTERN = /createElement\s*\(\s*['"](?:iframe|object|embed)['"]/i;

/** Accessing a nested frame's window throws SecurityError in the sandbox. */
const CONTENT_WINDOW_PATTERN = /\.\s*contentWindow\b|\bcontentWindow\s*\./i;

const JAVASCRIPT_URL_PATTERN =
  /\b(?:href|src|action|formaction|data|poster)\s*=\s*["']javascript:/i;

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

  if (
    EMBEDDED_BROWSING_PATTERN.test(text) ||
    JS_EMBEDDED_BROWSING_PATTERN.test(text) ||
    CONTENT_WINDOW_PATTERN.test(text)
  ) {
    return fail(
      'embedded_browsing',
      'Anything HTML must not embed nested browsing contexts (<iframe>, <object>, <embed>) or access frame contentWindow — build UI in the page itself.'
    );
  }

  if (JAVASCRIPT_URL_PATTERN.test(text)) {
    return fail('javascript_url', 'Anything HTML must not use javascript: URLs.');
  }

  return { ok: true };
}
