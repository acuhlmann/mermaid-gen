import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { GUIDANCE as canonicalGuidance } from '../packages/eslint-config/guidance.js';
import {
  compareGuidanceMaps,
  loadFormatterGuidance,
  normalizeGuidanceText
} from './verify-eslint-guidance-sync.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FORMATTER_PATH = path.join(ROOT, 'packages/eslint-config/formatter.cjs');

test('normalizeGuidanceText treats different join separators as equal', () => {
  const a = ['line one', 'line two'].join('\n  ');
  const b = ['line one', 'line two'].join('\n    ');
  assert.equal(normalizeGuidanceText(a), normalizeGuidanceText(b));
});

test('compareGuidanceMaps reports rule ids missing from the formatter copy', () => {
  const result = compareGuidanceMaps({ a: 'one' }, {});
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['a']);
  assert.deepEqual(result.extra, []);
  assert.deepEqual(result.mismatched, []);
});

test('compareGuidanceMaps reports rule ids extra in the formatter copy', () => {
  const result = compareGuidanceMaps({}, { stray: 'orphan' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.extra, ['stray']);
  assert.deepEqual(result.mismatched, []);
});

test('compareGuidanceMaps reports text drift for the same rule id', () => {
  const result = compareGuidanceMaps({ rule: 'canonical text' }, { rule: 'formatter text' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.extra, []);
  assert.deepEqual(result.mismatched, ['rule']);
});

test('formatter.cjs GUIDANCE matches guidance.js on the current repository', () => {
  const formatterSource = fs.readFileSync(FORMATTER_PATH, 'utf8');
  const formatterGuidance = loadFormatterGuidance(formatterSource);
  const result = compareGuidanceMaps(canonicalGuidance, formatterGuidance);
  assert.equal(
    result.ok,
    true,
    `missing: ${result.missing.join(', ')}; extra: ${result.extra.join(', ')}; mismatched: ${result.mismatched.join(', ')}`
  );
});

test('negative case: a drifted formatter copy fails the sensor', () => {
  const formatterSource = fs.readFileSync(FORMATTER_PATH, 'utf8');
  const drifted = formatterSource.replace(
    "'max-lines':",
    "'__drift_probe__': ['temporary drift for the negative case'],\n  'max-lines':"
  );
  const formatterGuidance = loadFormatterGuidance(drifted);
  const result = compareGuidanceMaps(canonicalGuidance, formatterGuidance);
  assert.equal(result.ok, false);
  assert.deepEqual(result.extra, ['__drift_probe__']);
});
