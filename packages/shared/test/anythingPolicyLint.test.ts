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
