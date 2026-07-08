import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANYTHING_HTML_MAX_LENGTH,
  ANYTHING_IFRAME_CSP,
  ANYTHING_IFRAME_SANDBOX,
  ANYTHING_RUNTIME_ERROR_MESSAGE_TYPE,
  parseAnythingHtml,
  wrapAnythingSrcDoc
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
  const tokens = ANYTHING_IFRAME_SANDBOX.split(/\s+/);
  assert.ok(tokens.includes('allow-scripts'));
  assert.ok(!tokens.includes('allow-same-origin'));
  assert.ok(!tokens.includes('allow-top-navigation'));
  assert.ok(!tokens.includes('allow-popups'));
  assert.ok(!tokens.includes('allow-downloads'));
  assert.ok(!tokens.includes('allow-forms'));
});

test('ANYTHING_IFRAME_CSP blocks network and external subresources', () => {
  assert.match(ANYTHING_IFRAME_CSP, /connect-src 'none'/);
  assert.match(ANYTHING_IFRAME_CSP, /default-src 'none'/);
  assert.match(ANYTHING_IFRAME_CSP, /script-src 'unsafe-inline'/);
});

test('wrapAnythingSrcDoc injects CSP meta into head', () => {
  const wrapped = wrapAnythingSrcDoc(HELLO_DOC);
  assert.match(wrapped, /<meta http-equiv="Content-Security-Policy"/i);
  assert.match(wrapped, /connect-src 'none'/);
  assert.match(wrapped, /<h1>Hello<\/h1>/);
});

test('wrapAnythingSrcDoc wraps bare fragments', () => {
  const wrapped = wrapAnythingSrcDoc('<p>fragment</p>');
  assert.match(wrapped, /<html>/i);
  assert.match(wrapped, /<meta http-equiv="Content-Security-Policy"/i);
  assert.match(wrapped, /<p>fragment<\/p>/);
});

test('wrapAnythingSrcDoc injects the runtime-error bridge before page scripts', () => {
  const wrapped = wrapAnythingSrcDoc(HELLO_DOC);
  const bridgeAt = wrapped.indexOf(ANYTHING_RUNTIME_ERROR_MESSAGE_TYPE);
  const pageScriptAt = wrapped.indexOf("document.title = 'hi';");
  assert.ok(bridgeAt !== -1, 'bridge script is injected');
  assert.ok(pageScriptAt !== -1, 'page script is preserved');
  assert.ok(bridgeAt < pageScriptAt, 'bridge runs before any page script');
  // The bridge relays via postMessage and listens for both error channels.
  assert.match(wrapped, /window\.parent\.postMessage/);
  assert.match(wrapped, /addEventListener\('error'/);
  assert.match(wrapped, /addEventListener\('unhandledrejection'/);
});

test('runtime-error bridge is injected into bare fragments too', () => {
  const wrapped = wrapAnythingSrcDoc('<p>fragment</p>');
  assert.ok(wrapped.includes(ANYTHING_RUNTIME_ERROR_MESSAGE_TYPE));
});
