import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANYTHING_HTML_MAX_LENGTH,
  ANYTHING_IFRAME_SANDBOX,
  parseAnythingHtml
} from '../src/anythingSchema.js';

const HELLO_DOC = `<!DOCTYPE html>
<html>
  <head><style>body { margin: 0; }</style></head>
  <body><h1>Hello</h1><script>document.title = 'hi';</script></body>
</html>`;

test('parseAnythingHtml accepts a full HTML document', () => {
  const result = parseAnythingHtml(HELLO_DOC);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(result.text, /<h1>Hello<\/h1>/);
});

test('parseAnythingHtml strips an html code fence', () => {
  const result = parseAnythingHtml(`\`\`\`html\n${HELLO_DOC}\n\`\`\``);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(!result.text.includes('```'));
  assert.match(result.text, /^<!DOCTYPE html>/);
});

test('parseAnythingHtml rejects non-strings and empty input', () => {
  assert.equal(parseAnythingHtml(null).ok, false);
  assert.equal(parseAnythingHtml(42).ok, false);
  assert.equal(parseAnythingHtml('').ok, false);
  assert.equal(parseAnythingHtml('   \n  ').ok, false);
});

test('parseAnythingHtml rejects prose with no markup', () => {
  const result = parseAnythingHtml('Here is your page! It has a heading and a button.');
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /does not look like markup/);
});

test('parseAnythingHtml rejects documents over the size budget', () => {
  const huge = `<div>${'x'.repeat(ANYTHING_HTML_MAX_LENGTH)}</div>`;
  const result = parseAnythingHtml(huge);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /too large/);
});

test('ANYTHING_IFRAME_SANDBOX allows scripts but never same-origin', () => {
  // The iframe sandbox is the security boundary for this mode. allow-same-origin
  // combined with allow-scripts would let injected HTML reach the host app's
  // origin (cookies, storage, DOM) — this constant must never gain it.
  const tokens = ANYTHING_IFRAME_SANDBOX.split(/\s+/);
  assert.ok(tokens.includes('allow-scripts'));
  assert.ok(!tokens.includes('allow-same-origin'));
  assert.ok(!tokens.includes('allow-top-navigation'));
  assert.ok(!tokens.includes('allow-popups'));
  assert.ok(!tokens.includes('allow-downloads'));
  assert.ok(!tokens.includes('allow-forms'));
});
