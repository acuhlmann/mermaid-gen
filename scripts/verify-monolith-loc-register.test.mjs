import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CLAUDE_MONolith_BULLET_FILE,
  FILE_SIZE_BUDGETS_HEADING,
  parseClaudeMonolithLocEntries,
  verifyMonolithLocRegister
} from './verify-monolith-loc-register.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('parseClaudeMonolithLocEntries reads ~LOC from the file-size budgets bullet', () => {
  const sample = `# x

${FILE_SIZE_BUDGETS_HEADING}

- \`apps/foo/a.js\` (~10 LOC), \`apps/bar/b.jsx\` (~20).

## next
`;
  const entries = parseClaudeMonolithLocEntries(sample);
  assert.deepEqual(entries, [
    { path: 'apps/foo/a.js', declaredLoc: 10, line: 4 },
    { path: 'apps/bar/b.jsx', declaredLoc: 20, line: 4 }
  ]);
});

test('verifyMonolithLocRegister passes on the live repo', () => {
  const result = verifyMonolithLocRegister(ROOT);
  assert.equal(
    result.ok,
    true,
    result.mismatches.map((m) => `${m.path}: ${m.declaredLoc} vs ${m.measuredLoc}`).join('; ')
  );
});

test('negative case: a stale ~LOC fails the sensor', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'monolith-loc-register-'));
  const claudePath = path.join(dir, CLAUDE_MONolith_BULLET_FILE);
  const targetDir = path.join(dir, 'apps/web/src');
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'Tiny.jsx'), 'line1\nline2\n');
  fs.writeFileSync(
    claudePath,
    `# stub

${FILE_SIZE_BUDGETS_HEADING}

- \`apps/web/src/Tiny.jsx\` (~99 LOC).

## end
`
  );
  const result = verifyMonolithLocRegister(dir);
  assert.equal(result.ok, false);
  assert.equal(result.mismatches.length, 1);
  assert.equal(result.mismatches[0].declaredLoc, 99);
  assert.equal(result.mismatches[0].measuredLoc, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});
