import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compareStrictIslandFiles, readTsconfigInclude } from './verify-strict-islands.mjs';
import { SERVER_STRICT_ISLAND_FILES } from '../packages/eslint-config/typeCheckedIsland.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('readTsconfigInclude strips // comment lines before parsing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strict-islands-'));
  const tsconfigPath = path.join(dir, 'tsconfig.strict.json');
  fs.writeFileSync(
    tsconfigPath,
    '{\n  "include": [\n    "src/a.ts",\n    // a comment line\n    "src/b.ts"\n  ]\n}\n'
  );
  assert.deepEqual(readTsconfigInclude(tsconfigPath), ['src/a.ts', 'src/b.ts']);
});

test('compareStrictIslandFiles reports files missing from SERVER_STRICT_ISLAND_FILES', () => {
  const result = compareStrictIslandFiles(['src/a.ts'], ['src/a.ts', 'src/b.ts']);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['src/b.ts']);
  assert.deepEqual(result.extra, []);
});

test('compareStrictIslandFiles reports files extra in SERVER_STRICT_ISLAND_FILES', () => {
  const result = compareStrictIslandFiles(['src/a.ts', 'src/b.ts'], ['src/a.ts']);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.extra, ['src/b.ts']);
});

test('compareStrictIslandFiles passes when both lists agree, order aside', () => {
  const result = compareStrictIslandFiles(['src/a.ts', 'src/b.ts'], ['src/b.ts', 'src/a.ts']);
  assert.equal(result.ok, true);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.extra, []);
});

test('SERVER_STRICT_ISLAND_FILES matches apps/server/tsconfig.strict.json on the current repository', () => {
  const tsconfigInclude = readTsconfigInclude(path.join(ROOT, 'apps/server/tsconfig.strict.json'));
  const result = compareStrictIslandFiles(SERVER_STRICT_ISLAND_FILES, tsconfigInclude);
  assert.equal(
    result.ok,
    true,
    `missing from SERVER_STRICT_ISLAND_FILES: ${result.missing.join(', ')}; extra: ${result.extra.join(', ')}`
  );
});
