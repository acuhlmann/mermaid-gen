import test from 'node:test';
import assert from 'node:assert/strict';
import { applySearchReplaceEdits } from '../src/agents/_lib/searchReplaceEdits.js';

const DOC = `<!DOCTYPE html>
<html>
  <head>
    <style>
      body { margin: 0; }
      h1 { color: navy; }
    </style>
  </head>
  <body>
    <h1>Solar System</h1>
    <p>Pick a planet.</p>
    <script>
      const planets = ['Mercury', 'Venus'];
      document.title = planets[0];
    </script>
  </body>
</html>`;

test('applies a single exact-match edit', () => {
  const result = applySearchReplaceEdits(DOC, [
    { search: '<h1>Solar System</h1>', replace: '<h1>The Solar System</h1>' }
  ]);
  assert.equal(result.ok, true);
  assert.match(result.text, /<h1>The Solar System<\/h1>/);
  assert.doesNotMatch(result.text, /<h1>Solar System<\/h1>/);
});

test('applies edits sequentially — later edits see earlier results', () => {
  const result = applySearchReplaceEdits(DOC, [
    { search: '<h1>Solar System</h1>', replace: '<h1>Planets</h1>' },
    { search: '<h1>Planets</h1>', replace: '<h1>Planets!</h1>' }
  ]);
  assert.equal(result.ok, true);
  assert.match(result.text, /<h1>Planets!<\/h1>/);
});

test('an empty replace deletes the matched text', () => {
  const result = applySearchReplaceEdits(DOC, [{ search: '<p>Pick a planet.</p>', replace: '' }]);
  assert.equal(result.ok, true);
  assert.doesNotMatch(result.text, /Pick a planet/);
});

test('fails when the search text is not found, pointing at the full-rewrite fallback', () => {
  const result = applySearchReplaceEdits(DOC, [
    { search: '<h2>Not In Document</h2>', replace: '<h2>x</h2>' }
  ]);
  assert.equal(result.ok, false);
  assert.match(result.error, /not found/);
  assert.match(result.error, /apply_anything_patch/);
});

test('fails when the search text matches more than once', () => {
  const doc = '<div>dup</div>\n<div>dup</div>';
  const result = applySearchReplaceEdits(doc, [
    { search: '<div>dup</div>', replace: '<div>x</div>' }
  ]);
  assert.equal(result.ok, false);
  assert.match(result.error, /more than once/);
});

test('whitespace-tolerant fallback matches despite indentation drift', () => {
  const result = applySearchReplaceEdits(DOC, [
    {
      search: `<h1>Solar System</h1>\n<p>Pick a planet.</p>`,
      replace: `    <h1>Solar System</h1>\n    <p>Pick a planet, any planet.</p>`
    }
  ]);
  assert.equal(result.ok, true);
  assert.match(result.text, /any planet/);
});

test('is atomic — a failing later edit aborts the whole call', () => {
  const result = applySearchReplaceEdits(DOC, [
    { search: '<h1>Solar System</h1>', replace: '<h1>Changed</h1>' },
    { search: 'does-not-exist-anywhere', replace: 'x' }
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.failedIndex, 1);
  assert.match(result.error, /Edit 2 of 2/);
});

test('rejects empty edits and empty search blocks', () => {
  assert.equal(applySearchReplaceEdits(DOC, []).ok, false);
  const result = applySearchReplaceEdits(DOC, [{ search: '', replace: 'x' }]);
  assert.equal(result.ok, false);
  assert.match(result.error, /SEARCH block is empty/);
});
