import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANYTHING_LIBS,
  ANYTHING_LIB_IDS,
  describeAnythingLibsForPrompt,
  findAnythingLibMarkers,
  hasAnythingLibMarkers,
  lintAnythingLibMarkers
} from '../src/anythingLibs.js';
import { ANYTHING_HTML_MAX_LENGTH, parseAnythingHtml } from '../src/anythingSchema.js';
import { lintAnythingPolicy } from '../src/anythingPolicyLint.js';
import { expandAnythingLibs, getAnythingLibSource } from '../src/anythingLibVendor.js';
import { ANYTHING_LIB_SOURCES } from '../src/vendor/anythingLibSources.js';

const libDoc = (marker: string, body = '<h1>Viz</h1>') => `<!DOCTYPE html>
<html>
  <head>${marker}<style>body { margin: 0; }</style></head>
  <body>${body}<script>console.log(typeof d3);</script></body>
</html>`;

test('registry and vendored sources agree on ids and versions', () => {
  assert.deepEqual(Object.keys(ANYTHING_LIB_SOURCES).sort(), [...ANYTHING_LIB_IDS].sort());
  for (const lib of ANYTHING_LIBS) {
    const vendored = ANYTHING_LIB_SOURCES[lib.id];
    assert.ok(vendored, `no vendored source for ${lib.id}`);
    assert.equal(vendored.version, lib.version, `version drift for ${lib.id}`);
    assert.ok(vendored.source.length > 1000, `vendored ${lib.id} looks empty`);
  }
});

test('vendored sources are safe to inline into a <script> block', () => {
  for (const [id, { source }] of Object.entries(ANYTHING_LIB_SOURCES)) {
    const lower = source.toLowerCase();
    for (const sequence of ['</script', '<!--', '<script']) {
      assert.ok(!lower.includes(sequence), `${id} contains "${sequence}"`);
    }
  }
});

test('findAnythingLibMarkers tolerates spacing and case variants', () => {
  const html = '<!--@lib:d3--> <!-- @lib: D3 --> <!-- @lib:jquery -->';
  const markers = findAnythingLibMarkers(html);
  assert.deepEqual(
    markers.map((m) => m.id),
    ['d3', 'd3', 'jquery']
  );
  assert.equal(hasAnythingLibMarkers(html), true);
  assert.equal(hasAnythingLibMarkers('<!-- plain comment -->'), false);
});

test('lintAnythingLibMarkers accepts allowlisted ids and dedupes', () => {
  const result = lintAnythingLibMarkers('<!-- @lib:d3 --><p>x</p><!-- @lib:d3 -->');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.libs, ['d3']);
});

test('lintAnythingLibMarkers passes documents without markers', () => {
  const result = lintAnythingLibMarkers('<html><head></head><body><p>hi</p></body></html>');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.libs, []);
});

test('lintAnythingLibMarkers rejects unknown ids and names the allowlist', () => {
  const result = lintAnythingLibMarkers(libDoc('<!-- @lib:jquery -->'));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'unknown_lib');
  assert.match(result.error, /@lib:jquery/);
  assert.match(result.error, /@lib:d3/);
});

test('the policy lint never sees the marker (comments are stripped) and passes marker docs', () => {
  assert.equal(lintAnythingPolicy(libDoc('<!-- @lib:d3 -->')).ok, true);
});

test('expandAnythingLibs replaces the marker with the pinned inline script', () => {
  const { html, injected } = expandAnythingLibs(libDoc('<!-- @lib:d3 -->'));
  assert.deepEqual(injected, ['d3']);
  assert.ok(!html.includes('@lib:d3'));
  assert.match(html, /<script data-archislop-lib="d3" data-lib-version="7\.9\.0">/);
  assert.ok(html.includes('d3js.org'), 'vendored d3 source not present');
});

test('expandAnythingLibs injects a duplicated lib once and strips the repeat marker', () => {
  const { html, injected } = expandAnythingLibs(
    libDoc('<!-- @lib:d3 -->', '<h1>Viz</h1><!-- @lib:d3 -->')
  );
  assert.deepEqual(injected, ['d3']);
  const occurrences = html.split('data-archislop-lib="d3"').length - 1;
  assert.equal(occurrences, 1);
  assert.ok(!html.includes('@lib:d3'));
});

test('expandAnythingLibs leaves unknown markers untouched and never throws', () => {
  const input = libDoc('<!-- @lib:jquery -->');
  const { html, injected } = expandAnythingLibs(input);
  assert.deepEqual(injected, []);
  assert.equal(html, input);
});

test('expandAnythingLibs is a no-op on documents without markers', () => {
  const input = '<html><head></head><body><p>hi</p></body></html>';
  assert.equal(expandAnythingLibs(input).html, input);
});

test('injected lib bytes are exempt from the agent-content size budget', () => {
  const doc = libDoc('<!-- @lib:d3 -->');
  const parsed = parseAnythingHtml(doc);
  assert.equal(parsed.ok, true);
  const { html } = expandAnythingLibs(doc);
  assert.ok(
    html.length > ANYTHING_HTML_MAX_LENGTH,
    'expanded doc should exceed the budget (d3 alone is ~273KB) — the budget applies pre-expansion'
  );
});

test('getAnythingLibSource resolves ids case-insensitively', () => {
  assert.equal(getAnythingLibSource('D3')?.version, '7.9.0');
  assert.equal(getAnythingLibSource('nope'), undefined);
});

test('describeAnythingLibsForPrompt lists every registry entry with marker syntax', () => {
  const text = describeAnythingLibsForPrompt();
  for (const lib of ANYTHING_LIBS) {
    assert.ok(text.includes(`<!-- @lib:${lib.id} -->`));
    assert.ok(text.includes(`v${lib.version}`));
  }
});
