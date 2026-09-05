import test from 'node:test';
import assert from 'node:assert/strict';
import { lintAnythingPolicy } from '../src/anythingPolicyLint.js';
import { lintAnythingQuality } from '../src/anythingQualityLint.js';

const VALID_DOC = `<!DOCTYPE html>
<html><head><style>body{margin:0}</style></head>
<body><h1>Hi</h1><script>document.title='x';</script></body></html>`;

test('lintAnythingPolicy accepts inline-only documents', () => {
  assert.equal(lintAnythingPolicy(VALID_DOC).ok, true);
});

test('lintAnythingPolicy accepts SVG xmlns without treating it as a network load', () => {
  const svgDoc = `<!DOCTYPE html><html><head></head><body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>
</body></html>`;
  assert.equal(lintAnythingPolicy(svgDoc).ok, true);
});

test('lintAnythingPolicy accepts XML namespace URIs in script, not only as attributes', () => {
  // The namespace was exempt as an `xmlns=` ATTRIBUTE but not as the string
  // literal `createElementNS` requires — so a page that drew its SVG from
  // script was rejected for correct, entirely offline code, while the same URI
  // in markup passed. `external_url` was the largest rejection code in the
  // generation baseline, and this is the offender a probe caught:
  // `var ns = "http://www.w3.org/2000/svg"`.
  const scripted = `<!DOCTYPE html><html><head></head><body><div id="a"></div><script>
const ns = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS(ns, 'svg');
svg.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#icon');
document.getElementById('a').appendChild(svg);
</script></body></html>`;
  assert.equal(lintAnythingPolicy(scripted).ok, true);

  for (const uri of [
    'http://www.w3.org/2000/svg',
    'http://www.w3.org/1999/xlink',
    'http://www.w3.org/1999/xhtml',
    'http://www.w3.org/1998/Math/MathML',
    'http://www.w3.org/XML/1998/namespace'
  ]) {
    const doc = VALID_DOC.replace("document.title='x';", `const ns = ${JSON.stringify(uri)};`);
    assert.equal(lintAnythingPolicy(doc).ok, true, uri);
  }
});

test('the namespace exemption is exact URIs, never a w3.org prefix', () => {
  // The whole risk of an allowlist: matching a prefix would let a lookalike
  // host or a traversal ride in behind a legitimate identifier.
  for (const url of [
    'http://www.w3.org/2000/svg.evil.com/x',
    'http://www.w3.org/2000/svg/../../secret',
    'http://www.w3.org/TR/SVG11/',
    'http://www.w3.org.evil.com/2000/svg'
  ]) {
    const doc = VALID_DOC.replace("document.title='x';", `fetch(${JSON.stringify(url)});`);
    const result = lintAnythingPolicy(doc);
    assert.equal(result.ok, false, url);
    if (result.ok) return;
    assert.equal(result.code, 'external_url', url);
  }
});

test('lintAnythingPolicy accepts harmless comments with URL-shaped text', () => {
  const doc = VALID_DOC.replace(
    "document.title='x';",
    "// https://example.com is only explanatory text\nconst label = 'offline';"
  );
  assert.equal(lintAnythingPolicy(doc).ok, true);
});

test('lintAnythingPolicy still rejects external URLs inside script strings', () => {
  const bad = VALID_DOC.replace("document.title='x';", "const endpoint = 'https://evil.com/api';");
  const result = lintAnythingPolicy(bad);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'external_url');
});

// #538 fixed these three cases and pinned them ONLY in the bench corpus
// (`quality-unclosed-script-with-comment` in apps/server/scripts/benchAnythingCorpus.js), which
// `npm test` never executes: the sole in-suite reader of that corpus filters it to
// `kind === 'runtime' && expectedCode === 'runtime_error'`, and the fixture is
// `quality`/`unclosed_tag`. Reverting the `|$` fallback closer left the whole suite green — a pin that
// exists and never runs (#541). The corpus fixture is still worth keeping; these are the gate CI runs.
//
// The failure mode #538 removed: with no closer matched, the ENTIRE unclosed body stayed unstripped, so
// the first `//` of any surviving line comment (`… 0.9;    // radians`) read as an external URL and the
// model was told to delete a URL that was never in the document, instead of being told it was truncated.

test('an unclosed <script> whose line comment holds URL-shaped text is not rejected external_url (#538 via #541)', () => {
  const truncated = `${VALID_DOC.replace(
    "<script>document.title='x';</script>",
    '<script>const angleMoon = 0.9;\n// see https://example.com/docs'
  )}`;
  assert.equal(
    lintAnythingPolicy(truncated).ok,
    true,
    'the comment must not be read as a network load'
  );
  // and the real defect is still named, by the check that owns it
  const quality = lintAnythingQuality(truncated);
  assert.equal(quality.ok, false);
  if (!quality.ok) assert.equal(quality.code, 'unclosed_tag');
});

test('the same holds for an unclosed <style> with a URL inside a CSS comment (#538 via #541)', () => {
  const truncated =
    '<!DOCTYPE html><html><head><style>body{color:red}\n/* https://example.com/notes */\n';
  assert.equal(
    lintAnythingPolicy(truncated).ok,
    true,
    'a CSS comment must not be read as a network load'
  );
  // Asserted as "still rejected", not as a specific code: with the style never closed, the whole tail of
  // the document sits inside it, so the quality linter legitimately reports `missing_body` here while the
  // script-side case above reaches `unclosed_tag`. What must not happen is a false `external_url`, which
  // is the bug #538 removed and what the line above pins.
  assert.equal(lintAnythingQuality(truncated).ok, false);
});

test('widening the strip to end-of-input does not hide a real external URL (#538 hole check)', () => {
  // The `$` closer only matches where no real `</script>`/`</style>` exists, so a quoted URL — which is
  // a load, not a comment — must still be rejected even in a truncated document. Without this pair the
  // fix could be "fixed" into a bypass.
  const unclosedScript =
    '<!DOCTYPE html><html><head><style>body{margin:0}</style></head><body><h1>Hi</h1>' +
    '<script>const img = \'<img src="https://cdn.evil.com/x.png">\';\n';
  const scriptResult = lintAnythingPolicy(unclosedScript);
  assert.equal(
    scriptResult.ok,
    false,
    'a quoted URL inside an unclosed script is still a network load'
  );
  if (scriptResult.ok) return;
  assert.equal(scriptResult.code, 'external_url');

  const unclosedStyle =
    '<!DOCTYPE html><html><head><style>body{color:red}\n</style><script>const img = ' +
    '\'<img src="https://cdn.evil.com/x.png">\';</script></body></html>';
  const styleResult = lintAnythingPolicy(unclosedStyle);
  assert.equal(styleResult.ok, false);
  if (styleResult.ok) return;
  assert.equal(styleResult.code, 'external_url');
});

test('lintAnythingPolicy rejects external image URLs', () => {
  const bad = VALID_DOC.replace('<h1>', '<img src="https://evil.com/x.png"><h1>');
  const result = lintAnythingPolicy(bad);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'external_url');
});

test('lintAnythingPolicy rejects external scripts', () => {
  const bad = `${VALID_DOC}<script src="https://cdn.example.com/lib.js"></script>`;
  const result = lintAnythingPolicy(bad);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'external_script');
});

test('lintAnythingPolicy rejects parent escape attempts', () => {
  const bad = VALID_DOC.replace('document.title', 'window.parent.document.title');
  const result = lintAnythingPolicy(bad);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'parent_escape');
});

test('lintAnythingPolicy rejects nested iframes', () => {
  const bad = `${VALID_DOC}<iframe src="about:blank"></iframe>`;
  const result = lintAnythingPolicy(bad);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'embedded_browsing');
});

test('lintAnythingPolicy rejects JS-created iframes and contentWindow access', () => {
  const bad = VALID_DOC.replace(
    "document.title='x';",
    `const f = document.createElement('iframe');
f.srcdoc = '<p>x</p>';
document.body.appendChild(f);
f.contentWindow.document.title = 'y';`
  );
  const result = lintAnythingPolicy(bad);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'embedded_browsing');
});

test('lintAnythingPolicy rejects javascript: URLs', () => {
  const bad = `<!DOCTYPE html><html><head></head><body><a href="javascript:alert(1)">x</a></body></html>`;
  const result = lintAnythingPolicy(bad);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'javascript_url');
});
