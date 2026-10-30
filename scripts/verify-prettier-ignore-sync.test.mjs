import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  canonicalLinesFromPrettierSkip,
  comparePrettierIgnoreSets,
  parsePrettierIgnoreLines,
  verifyPrettierIgnoreSync
} from './verify-prettier-ignore-sync.mjs';
import { PRETTIER_SKIP } from './prettier-files.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('parsePrettierIgnoreLines skips blanks and comments', () => {
  assert.deepEqual(parsePrettierIgnoreLines('# comment\n\nnode_modules\n'), ['node_modules']);
});

test('comparePrettierIgnoreSets reports missing and extra entries', () => {
  const result = comparePrettierIgnoreSets(['a', 'b'], ['b', 'c']);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['a']);
  assert.deepEqual(result.extra, ['c']);
});

test('.prettierignore matches PRETTIER_SKIP on the current repository', () => {
  const result = verifyPrettierIgnoreSync(ROOT);
  assert.equal(
    result.ok,
    true,
    `missing: ${result.missing.join(', ')}; extra: ${result.extra.join(', ')}`
  );
});

test('negative case: an extra PRETTIER_SKIP entry fails the sensor', () => {
  const ignore = fs.readFileSync(path.join(ROOT, '.prettierignore'), 'utf8');
  const ignoreLines = parsePrettierIgnoreLines(ignore);
  const skipLines = canonicalLinesFromPrettierSkip(PRETTIER_SKIP);
  const drifted = [...skipLines, '__drift_probe__'];
  const result = comparePrettierIgnoreSets(ignoreLines, drifted);
  assert.equal(result.ok, false);
  assert.deepEqual(result.extra, ['__drift_probe__']);
});
