import test from 'node:test';
import assert from 'node:assert/strict';
import { lintAnythingQuality } from '../src/anythingQualityLint.js';

const VALID_DOC = `<!DOCTYPE html>
<html><head><style>body { margin: 0; color: red; }</style></head>
<body><h1>Hi</h1><script>document.title = 'ok';</script></body></html>`;

test('lintAnythingQuality accepts a well-formed document', () => {
  const result = lintAnythingQuality(VALID_DOC);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.quality.scripts, 1);
  assert.equal(result.quality.styles, 1);
});

test('lintAnythingQuality warns on missing doctype but still accepts', () => {
  const noDoctype = VALID_DOC.replace('<!DOCTYPE html>\n', '');
  const result = lintAnythingQuality(noDoctype);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.warnings.some((w) => /DOCTYPE/i.test(w)));
});

test('lintAnythingQuality rejects missing html/head/body', () => {
  assert.equal(lintAnythingQuality('<div>x</div>').ok, false);
  assert.equal(
    lintAnythingQuality('<html><body>x</body></html>').ok,
    false
  );
});

test('lintAnythingQuality rejects JS syntax errors', () => {
  const bad = VALID_DOC.replace("document.title = 'ok';", 'function {');
  const result = lintAnythingQuality(bad);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'script_syntax');
});

test('lintAnythingQuality ignores markup-like text inside scripts', () => {
  const doc = VALID_DOC.replace(
    "document.title = 'ok';",
    "const snippet = '<section><p>preview</p></section>'; document.title = snippet;"
  );
  assert.equal(lintAnythingQuality(doc).ok, true);
});

test('lintAnythingQuality rejects unbalanced CSS braces', () => {
  const bad = VALID_DOC.replace('body { margin: 0; color: red; }', 'body { margin: 0; color: red;');
  const result = lintAnythingQuality(bad);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'css_unbalanced');
});

test('lintAnythingQuality rejects unclosed tags', () => {
  const bad = VALID_DOC.replace('</h1>', '');
  const result = lintAnythingQuality(bad);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'unclosed_tag');
});
