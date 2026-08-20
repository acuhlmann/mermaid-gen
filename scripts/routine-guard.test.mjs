import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ALWAYS_FORBIDDEN,
  ROUTINE_TIERS,
  checkRoutineDiff,
  countTestCases,
  globToRegExp,
  isTestPath,
  loadPlaybook,
  matchesAny,
  parseFrontmatter
} from './routine-guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PLAYBOOK = {
  name: 'hygiene',
  tier: 'mechanical',
  maxFiles: '3',
  allowedPaths: ['docs/**', '*.md', 'scripts/verify-*.mjs'],
  forbiddenPaths: ['apps/**']
};

test('parseFrontmatter reads scalars and string lists', () => {
  const parsed = parseFrontmatter(
    [
      '---',
      'name: review',
      "schedule: '0 6 * * *'",
      'allowedPaths:',
      '  - docs/**',
      "  - '*.md'",
      '---',
      '',
      '# Body'
    ].join('\n')
  );
  assert.equal(parsed.name, 'review');
  assert.equal(parsed.schedule, '0 6 * * *');
  assert.deepEqual(parsed.allowedPaths, ['docs/**', '*.md']);
});

test('parseFrontmatter returns null without a front-matter block', () => {
  assert.equal(parseFrontmatter('# Just a heading\n'), null);
});

test('globToRegExp keeps * inside one path segment and lets ** cross them', () => {
  assert.ok(globToRegExp('docs/**').test('docs/routines/ledger/review.md'));
  assert.ok(globToRegExp('*.md').test('README.md'));
  assert.ok(!globToRegExp('*.md').test('docs/guide/README.md'));
  assert.ok(globToRegExp('scripts/verify-*.mjs').test('scripts/verify-deps.mjs'));
  assert.ok(!globToRegExp('scripts/verify-*.mjs').test('scripts/verify/nested.mjs'));
});

test('globToRegExp escapes regex metacharacters in literal segments', () => {
  assert.ok(globToRegExp('.env.*').test('.env.local'));
  assert.ok(!globToRegExp('.env.*').test('xenvxlocal'));
});

test('countTestCases counts vitest and node:test cases including chains', () => {
  const source = [
    "test('a', () => {});",
    "it('b', () => {});",
    "it.each([1])('c', () => {});",
    "test.skip('d', () => {});",
    "describe('group', () => {});"
  ].join('\n');
  assert.equal(countTestCases(source), 4);
});

test('isTestPath recognises both workspace layouts', () => {
  assert.ok(isTestPath('apps/web/test/officeFloor.test.jsx'));
  assert.ok(isTestPath('scripts/verify-deps.test.mjs'));
  assert.ok(!isTestPath('apps/web/src/state/diagramStore.js'));
});

test('checkRoutineDiff accepts a diff inside its budget', () => {
  const result = checkRoutineDiff({
    playbook: PLAYBOOK,
    changes: [
      { status: 'M', file: 'docs/routines/hygiene.md' },
      { status: 'M', file: 'CLAUDE.md' }
    ]
  });
  assert.deepEqual(result.violations, []);
  assert.equal(result.ok, true);
});

test('checkRoutineDiff rejects a diff over maxFiles', () => {
  const changes = ['a', 'b', 'c', 'd'].map((n) => ({ status: 'M', file: `docs/${n}.md` }));
  const result = checkRoutineDiff({ playbook: PLAYBOOK, changes });
  assert.equal(result.ok, false);
  assert.match(result.violations.join('\n'), /4 files changed, playbook allows 3/);
});

test('checkRoutineDiff rejects a path the playbook forbids', () => {
  const result = checkRoutineDiff({
    playbook: PLAYBOOK,
    changes: [{ status: 'M', file: 'apps/web/src/state/diagramStore.js' }]
  });
  assert.equal(result.ok, false);
  assert.match(result.violations.join('\n'), /forbidden path/);
});

test('checkRoutineDiff rejects a path outside allowedPaths even when not forbidden', () => {
  const result = checkRoutineDiff({
    playbook: PLAYBOOK,
    changes: [{ status: 'M', file: 'scripts/cast-audition.mjs' }]
  });
  assert.equal(result.ok, false);
  assert.match(result.violations.join('\n'), /outside budget/);
});

test('checkRoutineDiff enforces the always-forbidden list over a permissive playbook', () => {
  const permissive = { ...PLAYBOOK, maxFiles: '50', allowedPaths: ['**'], forbiddenPaths: [] };
  for (const file of ['package-lock.json', '.env', 'apps/server/bench-results/snap.json']) {
    const result = checkRoutineDiff({ playbook: permissive, changes: [{ status: 'M', file }] });
    assert.equal(result.ok, false, `${file} should be refused`);
    assert.match(result.violations.join('\n'), /don't-touch/);
  }
});

test('checkRoutineDiff rejects a deleted test file', () => {
  const result = checkRoutineDiff({
    playbook: { ...PLAYBOOK, allowedPaths: ['**'], forbiddenPaths: [] },
    changes: [{ status: 'D', file: 'apps/web/test/officeFloor.test.jsx' }]
  });
  assert.equal(result.ok, false);
  assert.match(result.violations.join('\n'), /deleted test/);
});

test('checkRoutineDiff rejects a shrinking test file', () => {
  const result = checkRoutineDiff({
    playbook: { ...PLAYBOOK, allowedPaths: ['**'], forbiddenPaths: [] },
    changes: [{ status: 'M', file: 'apps/web/test/officeFloor.test.jsx' }],
    testCounts: [{ file: 'apps/web/test/officeFloor.test.jsx', before: 12, after: 9 }]
  });
  assert.equal(result.ok, false);
  assert.match(result.violations.join('\n'), /12 → 9/);
});

test('checkRoutineDiff allows a growing test file', () => {
  const result = checkRoutineDiff({
    playbook: { ...PLAYBOOK, allowedPaths: ['**'], forbiddenPaths: [] },
    changes: [{ status: 'M', file: 'apps/web/test/officeFloor.test.jsx' }],
    testCounts: [{ file: 'apps/web/test/officeFloor.test.jsx', before: 12, after: 14 }]
  });
  assert.equal(result.ok, true);
});

test('ALWAYS_FORBIDDEN covers the AGENTS.md cost and lockfile traps', () => {
  assert.ok(matchesAny('apps/web/src/assets/audio/cue-laugh.mp3', ALWAYS_FORBIDDEN));
  assert.ok(matchesAny('skills-lock.json', ALWAYS_FORBIDDEN));
  assert.ok(matchesAny('packages/shared/dist/index.js', ALWAYS_FORBIDDEN));
});

test('every shipped playbook loads with a valid budget and a ledger', () => {
  for (const name of ['review', 'hygiene']) {
    const { playbook, errors } = loadPlaybook(ROOT, name);
    assert.deepEqual(errors, [], `${name} playbook should be valid`);
    assert.ok(ROUTINE_TIERS.includes(String(playbook.tier)));
    assert.ok(Number(playbook.maxFiles) > 0);
  }
});

test('loadPlaybook reports a missing playbook rather than throwing', () => {
  const { errors } = loadPlaybook(ROOT, 'no-such-routine');
  assert.match(errors.join('\n'), /missing playbook/);
});

test('the report-tier routine cannot write outside its ledger', () => {
  const { playbook } = loadPlaybook(ROOT, 'review');
  const result = checkRoutineDiff({
    playbook,
    changes: [{ status: 'M', file: 'apps/server/src/routes/copilot.ts' }]
  });
  assert.equal(result.ok, false);
});
