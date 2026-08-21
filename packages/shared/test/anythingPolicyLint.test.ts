import test from 'node:test';
import assert from 'node:assert/strict';
import { lintAnythingPolicy } from '../src/anythingPolicyLint.js';

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

test('lintAnythingPolicy rejects javascript: URLs', () => {
  const bad = `<!DOCTYPE html><html><head></head><body><a href="javascript:alert(1)">x</a></body></html>`;
  const result = lintAnythingPolicy(bad);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'javascript_url');
});
