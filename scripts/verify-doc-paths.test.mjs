import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  collectDocMarkdownFiles,
  extractPaths,
  resolveExisting,
  shouldSkip,
  toPosixPath,
  verifyDocPaths
} from './verify-doc-paths.mjs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('collectDocMarkdownFiles includes docs/guide and docs/agents', () => {
  const files = collectDocMarkdownFiles(ROOT).map((f) => toPosixPath(path.relative(ROOT, f)));
  assert.ok(files.some((f) => f === 'docs/guide/coding-agents.md'));
  assert.ok(files.some((f) => f === 'docs/agents/sensors.md'));
  assert.ok(files.some((f) => f === 'docs/recipes/README.md'));
});

test('shouldSkip ignores docs/ backtick paths (apps/packages/scripts only)', () => {
  assert.equal(shouldSkip('docs/architecture-ag-ui.md'), true);
  assert.equal(shouldSkip('apps/server/src/index.js'), false);
});

test('resolveExisting falls back from .js to .ts', () => {
  const resolved = resolveExisting('apps/server/src/routes/copilot.js', ROOT);
  assert.equal(resolved, 'apps/server/src/routes/copilot.ts');
});

test('verifyDocPaths passes on the current repository', () => {
  const result = verifyDocPaths(ROOT);
  assert.equal(result.ok, true, result.missing.map((m) => `${m.cited} in ${m.source}`).join('\n'));
  assert.ok(result.checked > 0);
});

test('verifyDocPaths reports a missing apps path cited in a guide', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-doc-paths-'));
  const guideDir = path.join(tmp, 'docs', 'guide');
  fs.mkdirSync(guideDir, { recursive: true });
  fs.writeFileSync(
    path.join(guideDir, 'broken.md'),
    'See `apps/server/src/__missing_module__.js` for details.\n'
  );

  const result = verifyDocPaths(tmp);
  assert.equal(result.ok, false);
  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0].cited, 'apps/server/src/__missing_module__.js');
  assert.equal(result.missing[0].source, 'docs/guide/broken.md');
});

test('extractPaths resolves relative markdown links to apps paths', () => {
  const refs = extractPaths(
    'See [copilot](../../apps/server/src/routes/copilot.js).',
    'docs/guide/example.md'
  );
  assert.deepEqual(refs, [
    { path: 'apps/server/src/routes/copilot.js', source: 'docs/guide/example.md' }
  ]);
});
