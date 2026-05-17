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

test('common fixes cover Mermaid character codes vs HTML entities', () => {
  const pack = getRulePack(null);
  assert.match(pack, /#34;/);
  assert.match(pack, /&quot;/);
});

test('common fixes list extended reserved words', () => {
  const pack = getRulePack(null);
  for (const word of ['interpolate', 'linkStyle', 'loop', 'alt', 'opt']) {
    assert.match(pack, new RegExp(`\\b${word}\\b`), `expected reserved word: ${word}`);
  }
});

test('sequence pack warns about semicolons inside Note text', () => {
  const pack = getRulePack('sequenceDiagram');
  assert.match(pack, /Note text/);
  assert.match(pack, /;/);
});

test('sequence pack requires colon after arrow target', () => {
  const pack = getRulePack('sequenceDiagram');
  assert.match(pack, /Alice->>Bob: hello/);
});

test('state pack bans classDef on [*] and \\n in transitions', () => {
  const pack = getRulePack('stateDiagram-v2');
  assert.match(pack, /\[\*\]/);
  assert.match(pack, /single unbroken line/);
});

test('ER pack requires type-before-name attribute order', () => {
  const pack = getRulePack('erDiagram');
  assert.match(pack, /type name/);
  assert.match(pack, /int id/);
});

test('gantt pack mentions comma between id and date', () => {
  const pack = getRulePack('gantt');
  assert.match(pack, /comma/);
  assert.match(pack, /Firefox/);
});

test('pie pack notes silent failure on non-positive values', () => {
  const pack = getRulePack('pie');
  assert.match(pack, /silently/);
});
