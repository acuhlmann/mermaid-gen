import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DESCENDING_METRICS,
  RATCHET_PATH,
  compareRatchet,
  countTestCases,
  listTestFiles,
  measureAll,
  measureContextBytes,
  measureFileLoc,
  measureLintWarnings,
  measureStrictIslands,
  measureTests,
  validateBaselineShape
} from './verify-ratchet.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, RATCHET_PATH), 'utf8'));

test('measureFileLoc agrees with wc -l', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ratchet-'));
  fs.writeFileSync(path.join(dir, 'a.js'), 'one\ntwo\nthree\n');
  assert.deepEqual(measureFileLoc(dir, ['a.js']), { 'a.js': 3 });
});

test('measureFileLoc treats a deleted monolith as absent, not as an error', () => {
  assert.deepEqual(measureFileLoc(ROOT, ['apps/web/src/does-not-exist.jsx']), {});
});

test('measureStrictIslands counts the include list of each tsconfig', () => {
  const islands = measureStrictIslands(ROOT, [
    'apps/web/tsconfig.strict.json',
    'apps/server/tsconfig.strict.json'
  ]);
  assert.ok(islands['apps/web/tsconfig.strict.json'] > 0);
  assert.ok(islands['apps/server/tsconfig.strict.json'] > 0);
});

test('measureTests finds the repo suite', () => {
  const tests = measureTests(ROOT);
  assert.ok(tests.files > 300, `expected >300 test files, got ${tests.files}`);
  assert.ok(tests.cases > tests.files);
});

// listTestFiles replaces `find apps packages scripts -name '*.test.*' -not -path … -type f`, which
// could not run on Windows (`find` is FIND.EXE there) — and the ratchet is improve's work queue, so
// a sensor that only answers on one OS is a queue that stops being read. These pin the semantics
// that made it equivalent rather than merely similar.

test('listTestFiles prunes node_modules at any depth and lists forward-slash relative paths', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ratchet-walk-'));
  try {
    const write = (rel) => {
      const abs = path.join(root, ...rel.split('/'));
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, "test('x', () => {});\n");
    };
    write('apps/web/test/a.test.js');
    write('apps/web/src/deep/nested/b.test.jsx');
    write('packages/shared/test/c.test.mjs');
    write('scripts/sibling.test.mjs');
    write('apps/web/node_modules/dep/evil.test.js');
    write('node_modules/top/evil.test.js');
    // Not a test file: `.test` with nothing after the final dot does not match `*.test.*`, and a
    // fixture that merely has "test" in its name must not inflate suite.files either.
    write('apps/web/test/notatest.test');
    write('apps/web/test/helpers.js');

    assert.deepEqual(listTestFiles(root).sort(), [
      'apps/web/src/deep/nested/b.test.jsx',
      'apps/web/test/a.test.js',
      'packages/shared/test/c.test.mjs',
      'scripts/sibling.test.mjs'
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('listTestFiles errors on a missing root rather than reporting a shorter suite', () => {
  // A silent short list would lower suite.files, which is a *descending* metric — the sensor would
  // read a lost directory as an improvement and improve would tighten a budget against it.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ratchet-missing-'));
  try {
    fs.mkdirSync(path.join(root, 'apps'), { recursive: true });
    assert.throws(() => listTestFiles(root), /root 'packages' is missing/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('measureLintWarnings refuses to guess rather than reporting zero findings', () => {
  // `npx eslint` is unspawnable through execFileSync on Windows (a .cmd shim), so the CLI is now
  // resolved from node_modules. An unresolvable bin must not read as "all budgets fell".
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ratchet-nolint-'));
  try {
    fs.mkdirSync(path.join(root, 'apps', 'web'), { recursive: true });
    assert.throws(() => measureLintWarnings(root, ['apps/web']), /cannot resolve the ESLint CLI/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('countTestCases ignores describe blocks', () => {
  assert.equal(countTestCases("describe('x', () => { it('y', () => {}); });"), 1);
});

test('compareRatchet passes when a descending metric holds or falls', () => {
  const spec = { metrics: { monolithLoc: { 'a.js': { budget: 100, initial: 100 } } } };
  assert.equal(compareRatchet(spec, { monolithLoc: { 'a.js': 100 } }).ok, true);
  const better = compareRatchet(spec, { monolithLoc: { 'a.js': 90 } });
  assert.equal(better.ok, true);
  assert.deepEqual(better.improvements, ['monolithLoc: a.js 100 → 90']);
});

test('compareRatchet fails when a descending metric grows', () => {
  const spec = { metrics: { monolithLoc: { 'a.js': { budget: 100, initial: 100 } } } };
  const result = compareRatchet(spec, { monolithLoc: { 'a.js': 101 } });
  assert.equal(result.ok, false);
  assert.match(result.violations.join('\n'), /is 101, budget 100 \(may only fall\)/);
});

test('compareRatchet fails when an ascending metric shrinks', () => {
  const spec = { metrics: { suite: { cases: { budget: 3000, initial: 3000 } } } };
  const result = compareRatchet(spec, { suite: { cases: 2999 } });
  assert.equal(result.ok, false);
  assert.match(result.violations.join('\n'), /may only rise/);
});

test('compareRatchet skips metrics that were not measured this run', () => {
  const result = compareRatchet(baseline, { monolithLoc: {} });
  assert.equal(result.ok, true);
});

test('DESCENDING_METRICS names the size metrics, not the coverage ones', () => {
  assert.ok(DESCENDING_METRICS.has('monolithLoc'));
  assert.ok(DESCENDING_METRICS.has('lintWarnings'));
  assert.ok(!DESCENDING_METRICS.has('suite'));
  assert.ok(!DESCENDING_METRICS.has('strictIslandFiles'));
});

test('validateBaselineShape demands a reason for a loosened descending budget', () => {
  const errors = validateBaselineShape({
    metrics: { monolithLoc: { 'a.js': { budget: 120, initial: 100 } } }
  });
  assert.match(errors.join('\n'), /loosened \(100 → 120\) with no "reason"/);
});

test('validateBaselineShape demands a reason for a lowered ascending budget', () => {
  const errors = validateBaselineShape({
    metrics: { suite: { cases: { budget: 10, initial: 20 } } }
  });
  assert.match(errors.join('\n'), /loosened \(20 → 10\)/);
});

test('validateBaselineShape accepts a loosened budget that explains itself', () => {
  const errors = validateBaselineShape({
    metrics: {
      monolithLoc: { 'a.js': { budget: 120, initial: 100, reason: 'pending copilot split' } }
    }
  });
  assert.deepEqual(errors, []);
});

test('validateBaselineShape accepts a tightened budget with no reason', () => {
  const errors = validateBaselineShape({
    metrics: { monolithLoc: { 'a.js': { budget: 80, initial: 100 } } }
  });
  assert.deepEqual(errors, []);
});

test('validateBaselineShape rejects a malformed entry', () => {
  const errors = validateBaselineShape({ metrics: { monolithLoc: { 'a.js': { budget: 80 } } } });
  assert.match(errors.join('\n'), /needs numeric "budget" and "initial"/);
});

test('the committed baseline is self-consistent', () => {
  assert.deepEqual(validateBaselineShape(baseline), []);
});

// Deliberately not "the repository currently satisfies its own ratchet": that assertion made
// any live regression fail npm run check for every PR, not just this routine's, contradicting
// verify-ratchet.mjs's own header ("Deliberately NOT wired into npm run check") and this
// routine's ledger. It is also structurally unsatisfiable once a violation is filed as an issue
// rather than silently budget-bumped, so it would stay red forever. See docs/routines/ledger/improve.md.
test('measureAll/compareRatchet run against the live repo and return the documented shape', () => {
  const measured = measureAll(ROOT, baseline);
  const result = compareRatchet(baseline, measured);
  assert.equal(typeof result.ok, 'boolean');
  assert.ok(Array.isArray(result.violations));
  assert.ok(Array.isArray(result.improvements));
});

test('every legacy monolith carries a recorded budget', async () => {
  const { LEGACY_MONOLITHS } = await import('../packages/eslint-config/legacy-monoliths.js');
  for (const file of LEGACY_MONOLITHS) {
    assert.ok(
      baseline.metrics.monolithLoc[file],
      `${file} is suppressed in legacy-monoliths.js but has no ratchet budget`
    );
  }
});

// --- contextBytes ------------------------------------------------------------------------------
// The always-loaded agent context files. A byte here is paid by every interactive session and
// every nightly unattended run, before any work starts.

test('measureContextBytes reports byte sizes for the always-loaded root files', () => {
  const measured = measureContextBytes(ROOT, ['CLAUDE.md', 'AGENTS.md']);
  assert.ok(measured['CLAUDE.md'] > 0, 'CLAUDE.md must be measured, not silently skipped');
  assert.ok(measured['AGENTS.md'] > 0);
});

test('measureContextBytes skips a file that does not exist rather than throwing', () => {
  const measured = measureContextBytes(ROOT, ['CLAUDE.md', 'docs/agents/domains/nope.md']);
  assert.deepEqual(Object.keys(measured), ['CLAUDE.md']);
});

test('contextBytes is a descending metric — these files may only shrink', () => {
  assert.ok(
    DESCENDING_METRICS.has('contextBytes'),
    'an ascending contextBytes would ratchet the context tax upward, which is the bug it exists to stop'
  );
});

test('the scoped domain files are deliberately NOT counted', () => {
  const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, RATCHET_PATH), 'utf8'));
  const tracked = Object.keys(baseline.metrics.contextBytes ?? {});
  assert.ok(
    tracked.length > 0,
    'contextBytes must track something — an empty family passes vacuously'
  );
  for (const file of tracked) {
    assert.ok(
      !file.startsWith('docs/agents/domains/'),
      `${file} loads only for a session touching the code it describes; counting it would penalise ` +
        'moving content out of the root files, which is the whole point of the split'
    );
  }
});
