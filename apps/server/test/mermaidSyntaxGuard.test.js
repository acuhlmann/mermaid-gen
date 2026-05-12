import test from 'node:test';
import assert from 'node:assert/strict';
import { getRulePack, RULE_PACK_TYPES } from '../src/prompts/mermaidSyntaxGuard.js';

test('every supported diagram type has a non-trivial rule pack', () => {
  assert.ok(RULE_PACK_TYPES.length >= 15);
  for (const type of RULE_PACK_TYPES) {
    const pack = getRulePack(type);
    assert.ok(typeof pack === 'string');
    assert.ok(pack.length > 100, `pack for ${type} is suspiciously short`);
    assert.match(pack, /Universal Mermaid rules:/);
  }
});

test('getRulePack falls back to common fixes for unknown type', () => {
  const fallback = getRulePack(null);
  assert.match(fallback, /Universal Mermaid rules:/);
  assert.equal(getRulePack('unknown-type'), fallback);
});

test('flowchart pack mentions edge label quoting', () => {
  const pack = getRulePack('flowchart');
  assert.match(pack, /A -->\|"key: value"\| B/);
});

test('sequenceDiagram pack mentions Note over syntax', () => {
  const pack = getRulePack('sequenceDiagram');
  assert.match(pack, /Note over/);
});

test('C4* types share a single rule pack', () => {
  const c4ctx = getRulePack('C4Context');
  const c4cnt = getRulePack('C4Container');
  assert.equal(c4ctx, c4cnt);
});
