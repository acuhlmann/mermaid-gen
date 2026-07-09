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
  assert.equal(lintAnythingQuality('<html><body>x</body></html>').ok, false);
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

test('lintAnythingQuality accepts optional end tags (spec-valid HTML)', () => {
  const doc = `<!DOCTYPE html>
<html><head><style>body { margin: 0; }</style></head>
<body>
  <p>first paragraph<p>second paragraph
  <ul><li>one<li>two</ul>
  <table><thead><tr><th>A<th>B<tbody><tr><td>1<td>2</table>
  <dl><dt>term<dd>definition</dl>
  <select><option>a<option>b</select>
</body></html>`;
  const result = lintAnythingQuality(doc);
  assert.equal(result.ok, true, result.ok ? '' : result.error);
});

test('lintAnythingQuality accepts a document omitting </body></html>', () => {
  const doc = `<!DOCTYPE html>
<html><head></head><body><div>content</div>`;
  assert.equal(lintAnythingQuality(doc).ok, true);
});

test('lintAnythingQuality still rejects a genuinely unclosed <div>', () => {
  const doc = `<!DOCTYPE html>
<html><head></head><body><div><p>text</body></html>`;
  const result = lintAnythingQuality(doc);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'unclosed_tag');
  assert.match(result.error, /<div>/);
});

test('lintAnythingQuality still rejects real mis-nesting', () => {
  const doc = `<!DOCTYPE html>
<html><head></head><body><div><span>text</div></span></body></html>`;
  const result = lintAnythingQuality(doc);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'unclosed_tag');
});

test('lintAnythingQuality ignores tag-like text inside HTML comments', () => {
  const doc = VALID_DOC.replace('<h1>Hi</h1>', '<!-- <div> layout stub --><h1>Hi</h1>');
  assert.equal(lintAnythingQuality(doc).ok, true);
});

test('lintAnythingQuality validates module script syntax', () => {
  const good = VALID_DOC.replace(
    "<script>document.title = 'ok';</script>",
    '<script type="module">const state = { n: 1 }; document.title = String(state.n);</script>'
  );
  assert.equal(lintAnythingQuality(good).ok, true);

  const bad = VALID_DOC.replace(
    "<script>document.title = 'ok';</script>",
    '<script type="module">const broken = {;</script>'
  );
  const result = lintAnythingQuality(bad);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'script_syntax');
});

test('lintAnythingQuality allows import/export syntax only in module scripts', () => {
  const moduleDoc = VALID_DOC.replace(
    "<script>document.title = 'ok';</script>",
    '<script type="module">export const answer = 42; document.title = String(answer);</script>'
  );
  assert.equal(lintAnythingQuality(moduleDoc).ok, true);

  const classicDoc = VALID_DOC.replace(
    "<script>document.title = 'ok';</script>",
    '<script>export const answer = 42;</script>'
  );
  assert.equal(lintAnythingQuality(classicDoc).ok, false);
});

test('lintAnythingQuality skips non-JS data blocks (JSON, templates)', () => {
  const doc = VALID_DOC.replace(
    "<script>document.title = 'ok';</script>",
    '<script type="application/json">{"not": "javascript"}</script>' +
      "<script>document.title = 'ok';</script>"
  );
  assert.equal(lintAnythingQuality(doc).ok, true);
});
