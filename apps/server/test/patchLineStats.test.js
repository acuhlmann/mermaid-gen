import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLineDiffStats } from '../src/utils/patchLineStats.js';

test('computeLineDiffStats counts insertions and deletions', () => {
  const prev = 'a\nb\nc';
  const next = 'a\nx\nb\nc\nd';
  const { linesAdded, linesRemoved } = computeLineDiffStats(prev, next);
  assert.equal(linesRemoved, 0);
  assert.equal(linesAdded, 2);
});

test('computeLineDiffStats handles full replacement', () => {
  const { linesAdded, linesRemoved } = computeLineDiffStats('old\nline', 'new');
  assert.ok(linesRemoved >= 1);
  assert.ok(linesAdded >= 1);
});
