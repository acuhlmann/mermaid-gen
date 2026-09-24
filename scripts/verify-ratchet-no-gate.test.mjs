import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  hardGatePatternsInLiveRatchetTest,
  scanAllScriptTests,
  scanTestFileForRatchetHardGate
} from './verify-ratchet-no-gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = path.join(ROOT, 'scripts');

test('hardGatePatternsInLiveRatchetTest ignores synthetic compareRatchet fixtures', () => {
  const block = `
test('compareRatchet passes when a descending metric holds or falls', () => {
  const spec = { metrics: { monolithLoc: { 'a.js': { budget: 100 } } } };
  assert.equal(compareRatchet(spec, { monolithLoc: { 'a.js': 100 } }).ok, true);
});
`;
  assert.deepEqual(hardGatePatternsInLiveRatchetTest(block), []);
});

test('hardGatePatternsInLiveRatchetTest allows the documented shape assertion on the live repo', () => {
  const block = `
test('measureAll/compareRatchet run against the live repo and return the documented shape', () => {
  const measured = measureAll(ROOT, baseline);
  const result = compareRatchet(baseline, measured);
  assert.equal(typeof result.ok, 'boolean');
  assert.ok(Array.isArray(result.violations));
  assert.ok(Array.isArray(result.improvements));
});
`;
  assert.deepEqual(hardGatePatternsInLiveRatchetTest(block), []);
});

test('hardGatePatternsInLiveRatchetTest flags a zero-violation hard gate on the live repo', () => {
  const block = `
test('the repository currently satisfies its own ratchet', () => {
  const measured = measureAll(ROOT, baseline);
  const result = compareRatchet(baseline, measured);
  assert.equal(result.ok, true);
});
`;
  assert.deepEqual(hardGatePatternsInLiveRatchetTest(block), ['result-ok-true']);
});

test('negative case: a drifted script test fails the repository scan', () => {
  const bad = `
import test from 'node:test';
test('bad gate', () => {
  const measured = measureAll(ROOT, baseline);
  const result = compareRatchet(baseline, measured);
  assert.deepEqual(result.violations, []);
});
`;
  const hits = scanTestFileForRatchetHardGate(bad, 'scripts/probe.test.mjs');
  assert.equal(hits.length, 1);
  assert.deepEqual(hits[0].patterns, ['violations-empty']);
});

test('no scripts/*.test.mjs turns verify:ratchet into a hard CI gate', () => {
  const result = scanAllScriptTests(SCRIPTS);
  assert.equal(
    result.ok,
    true,
    result.hits.map((h) => `${h.file}:${h.startLine} ${h.patterns.join(',')}`).join('\n')
  );
});

test('verify-ratchet.test.mjs on disk matches the allowed live-repo assertion shape', () => {
  const source = fs.readFileSync(path.join(SCRIPTS, 'verify-ratchet.test.mjs'), 'utf8');
  const hits = scanTestFileForRatchetHardGate(source, 'scripts/verify-ratchet.test.mjs');
  assert.deepEqual(hits, []);
});
