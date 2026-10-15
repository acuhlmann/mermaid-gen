import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  strictIncludePathExists,
  verifyAllStrictTsconfigPaths,
  verifyStrictTsconfigPaths
} from './verify-strict-tsconfig-paths.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('strictIncludePathExists resolves .js entries to co-located .ts files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strict-tsconfig-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src/leaf.ts'), 'export const x = 1;\n');
  assert.equal(strictIncludePathExists(dir, 'src/leaf.js'), true);
  assert.equal(strictIncludePathExists(dir, 'src/missing.js'), false);
});

test('verifyStrictTsconfigPaths reports missing include entries', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strict-tsconfig-'));
  const appRoot = path.join(dir, 'apps/web');
  fs.mkdirSync(appRoot, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'apps/web/tsconfig.strict.json'),
    JSON.stringify({ include: ['src/exists.ts', 'src/ghost.ts'] }, null, 2)
  );
  fs.mkdirSync(path.join(appRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(appRoot, 'src/exists.ts'), 'export {};\n');
  const result = verifyStrictTsconfigPaths(dir, {
    tsconfigRel: 'apps/web/tsconfig.strict.json',
    appRootRel: 'apps/web'
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['src/ghost.ts']);
});

test('both strict tsconfigs on disk list only existing paths', () => {
  const result = verifyAllStrictTsconfigPaths(ROOT);
  assert.equal(
    result.ok,
    true,
    Object.entries(result.byConfig)
      .map(([cfg, missing]) => `${cfg}: ${missing.join(', ')}`)
      .join('\n')
  );
});

test('negative case: a ghost include fails the repository scan', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strict-tsconfig-'));
  const webRoot = path.join(dir, 'apps/web');
  const serverRoot = path.join(dir, 'apps/server');
  fs.mkdirSync(webRoot, { recursive: true });
  fs.mkdirSync(serverRoot, { recursive: true });
  fs.writeFileSync(
    path.join(webRoot, 'tsconfig.strict.json'),
    JSON.stringify({ include: ['src/only-web.ts'] }, null, 2)
  );
  fs.writeFileSync(
    path.join(serverRoot, 'tsconfig.strict.json'),
    JSON.stringify({ include: [] }, null, 2)
  );
  fs.mkdirSync(path.join(webRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(webRoot, 'src/only-web.ts'), 'export {};\n');
  fs.writeFileSync(
    path.join(webRoot, 'tsconfig.strict.json'),
    JSON.stringify({ include: ['src/only-web.ts', 'src/__drift_probe__.ts'] }, null, 2)
  );
  const result = verifyAllStrictTsconfigPaths(dir);
  assert.equal(result.ok, false);
  assert.deepEqual(result.byConfig['apps/web/tsconfig.strict.json'], ['src/__drift_probe__.ts']);
});
