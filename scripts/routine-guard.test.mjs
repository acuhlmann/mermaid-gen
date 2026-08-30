import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ALWAYS_FORBIDDEN,
  ROUTINE_TIERS,
  PLAYBOOK_SHELVES,
  checkRoutineDiff,
  countTestCases,
  fetchOpenPrs,
  globToRegExp,
  isTestPath,
  loadPlaybook,
  matchOpenRoutinePrs,
  matchesAny,
  parseFrontmatter,
  routinePrMatchers
} from './routine-guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PLAYBOOK = {
  name: 'improve',
  tier: 'code-writing',
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
      { status: 'M', file: 'docs/routines/improve.md' },
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
  for (const name of ['review', 'improve', 'anything']) {
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

test('a routine cannot write to a path its playbook forbids, whatever its tier', () => {
  const { playbook } = loadPlaybook(ROOT, 'review');
  const result = checkRoutineDiff({
    playbook,
    changes: [{ status: 'M', file: 'apps/server/src/mcp/apps/anythingApp.js' }]
  });
  assert.equal(result.ok, false, "MCP App HTML is on the don't-touch list");
});

test('review may fix a bug in product code, within its file budget', () => {
  const { playbook } = loadPlaybook(ROOT, 'review');
  const result = checkRoutineDiff({
    playbook,
    changes: [
      { status: 'M', file: 'apps/web/src/utils/officeCadence.js' },
      { status: 'M', file: 'apps/web/test/officeCadence.test.js' },
      { status: 'M', file: 'docs/routines/ledger/review.md' }
    ],
    testCounts: [{ file: 'apps/web/test/officeCadence.test.js', before: 20, after: 21 }]
  });
  assert.deepEqual(result.violations, []);
});

test('improve may split a monolith under ADR-0016 (components/state/routes/mcp are in budget)', () => {
  const { playbook } = loadPlaybook(ROOT, 'improve');
  const result = checkRoutineDiff({
    playbook,
    changes: [
      { status: 'M', file: 'apps/web/src/components/DiagramCanvas.jsx' },
      { status: 'A', file: 'apps/web/src/components/diagramCanvasSequenceEdit.js' }
    ]
  });
  assert.deepEqual(result.violations, []);
});

test('improve still cannot touch the always-forbidden don’t-touch list even inside a newly allowed directory', () => {
  const { playbook } = loadPlaybook(ROOT, 'improve');
  const result = checkRoutineDiff({
    playbook,
    changes: [{ status: 'M', file: 'apps/server/src/mcp/apps/someApp.js' }]
  });
  assert.equal(result.ok, false, 'ALWAYS_FORBIDDEN overrides a playbook allowedPaths entry');
});

test('the anything feature automation may touch its blast-radius paths', () => {
  const { playbook } = loadPlaybook(ROOT, 'anything');
  const result = checkRoutineDiff({
    playbook,
    changes: [
      { status: 'M', file: 'apps/server/src/prompts/anythingDesignGuide.js' },
      { status: 'M', file: 'apps/server/test/anythingRuntimeCheck.test.js' },
      { status: 'M', file: 'docs/automations/ledger/anything.md' }
    ],
    testCounts: [{ file: 'apps/server/test/anythingRuntimeCheck.test.js', before: 40, after: 41 }]
  });
  assert.deepEqual(result.violations, []);
});

// --- preflight: one branch at a time -----------------------------------------------------------
// README rule 5 and ADR-0014 clause 3 both promise this check. It did not exist until 2026-08-30,
// and its absence stranded PR #442 for two days while `review` opened a second branch behind it.

const OPEN_PRS = [
  {
    number: 442,
    title: 'review: 2026-08-29 run — fix renameErNode',
    headRefName: 'review/nfr-2026-08-29'
  },
  {
    number: 448,
    title: 'improve: dead-code cleanup drops lintWarnings',
    headRefName: 'claude/eager-hopper-74jcfu'
  },
  {
    number: 446,
    title: 'fix(web): timeline/pie graph-edit ids',
    headRefName: 'cursor/critical-bug-memory-55bc'
  },
  { number: 379, title: 'build(deps): bump hono', headRefName: 'dependabot/npm_and_yarn/x' }
];

test('routinePrMatchers defaults both prefixes from the routine name', () => {
  assert.deepEqual(routinePrMatchers('review', {}), {
    titlePrefixes: ['review:'],
    branchPrefixes: ['review/']
  });
});

test('routinePrMatchers honours playbook overrides', () => {
  const matchers = routinePrMatchers('metaphor3d', {
    prTitlePrefix: ['Metaphor3D:'],
    branchPrefix: ['claude/gifted-davinci-']
  });
  assert.deepEqual(matchers.titlePrefixes, ['Metaphor3D:']);
  assert.deepEqual(matchers.branchPrefixes, ['claude/gifted-davinci-']);
});

test('matchOpenRoutinePrs finds a routine PR by its title prefix when the branch is generated', () => {
  const found = matchOpenRoutinePrs({ name: 'improve', playbook: {}, openPrs: OPEN_PRS });
  assert.deepEqual(
    found.map((pr) => pr.number),
    [448],
    'the cloud runner generates `claude/eager-hopper-*`, so only the title identifies the routine'
  );
});

test('matchOpenRoutinePrs finds a routine PR by its branch prefix', () => {
  const found = matchOpenRoutinePrs({
    name: 'review',
    playbook: {},
    openPrs: [{ number: 442, title: 'wip', headRefName: 'review/nfr-2026-08-29' }]
  });
  assert.deepEqual(
    found.map((pr) => pr.number),
    [442]
  );
});

test('matchOpenRoutinePrs ignores another fleet’s PR and dependabot', () => {
  for (const name of ['review', 'improve', 'resolve']) {
    const found = matchOpenRoutinePrs({
      name,
      playbook: {},
      openPrs: OPEN_PRS.filter((pr) => pr.number === 446 || pr.number === 379)
    });
    assert.deepEqual(found, [], `${name} must not claim a Cursor or dependabot PR`);
  }
});

test('matchOpenRoutinePrs is case-insensitive so `Metaphor3D:` matches a lowercase name', () => {
  const found = matchOpenRoutinePrs({
    name: 'metaphor3d',
    playbook: {},
    openPrs: [{ number: 445, title: 'Metaphor3D: draw the grouping axis', headRefName: 'claude/x' }]
  });
  assert.equal(found.length, 1);
});

test('fetchOpenPrs parses a gh payload', () => {
  const prs = fetchOpenPrs(() => JSON.stringify(OPEN_PRS));
  assert.equal(prs?.length, 4);
});

test('fetchOpenPrs returns null — not [] — when gh is unavailable', () => {
  const prs = fetchOpenPrs(() => {
    throw new Error('gh: command not found');
  });
  assert.equal(
    prs,
    null,
    'an absent answer and an empty answer mean opposite things; conflating them would make ' +
      'preflight silently report "no open PR" on every box without gh'
  );
});

test('fetchOpenPrs returns null when gh answers with something that is not a list', () => {
  assert.equal(
    fetchOpenPrs(() => '{"message":"Bad credentials"}'),
    null
  );
});

test('every shipped playbook resolves to a usable PR matcher', () => {
  const names = PLAYBOOK_SHELVES.flatMap((shelf) =>
    fs
      .readdirSync(path.join(ROOT, shelf.dir))
      .filter((file) => file.endsWith('.md') && file !== 'README.md')
      .map((file) => file.replace(/\.md$/, ''))
  );
  assert.ok(names.length >= 4, `expected the shelves to hold playbooks, found ${names.length}`);
  for (const name of names) {
    const { playbook } = loadPlaybook(ROOT, name);
    const matchers = routinePrMatchers(name, playbook);
    assert.ok(matchers.titlePrefixes.length > 0, `${name} has no title prefix`);
    assert.ok(matchers.branchPrefixes.length > 0, `${name} has no branch prefix`);
  }
});

// --- tier: report ------------------------------------------------------------------------------
// Until 2026-08-30 `report` was validated as if it wrote code — it had to declare a budget it was
// forbidden to spend — so nothing mechanically stopped a report routine from committing.

test('a report routine may not change a single file', () => {
  const result = checkRoutineDiff({
    playbook: { name: 'digest', tier: 'report' },
    changes: [{ status: 'M', file: 'docs/routines/ledger/digest.md' }]
  });
  assert.equal(result.ok, false, 'even its own ledger is off limits to a report routine');
  assert.match(result.violations[0], /report tier/);
});

test('a report routine passes on an empty diff', () => {
  const result = checkRoutineDiff({ playbook: { name: 'digest', tier: 'report' }, changes: [] });
  assert.deepEqual(result.violations, []);
});

test('the report tier outranks a permissive playbook rather than reading its budget', () => {
  const result = checkRoutineDiff({
    playbook: { name: 'digest', tier: 'report', maxFiles: '99', allowedPaths: ['**'] },
    changes: [{ status: 'M', file: 'README.md' }]
  });
  assert.equal(result.ok, false);
});

test('loadPlaybook rejects a report routine that declares a budget it cannot spend', () => {
  const shipped = loadPlaybook(ROOT, 'digest');
  assert.deepEqual(shipped.errors, [], 'the shipped digest playbook must be valid');
  assert.equal(shipped.playbook.tier, 'report');
  assert.equal(
    Number(shipped.playbook.maxFiles || 0),
    0,
    'a report routine declares no maxFiles — see docs/routines/README.md § Tiers'
  );
});

test('code-writing routines still have to declare a budget', () => {
  for (const name of ['review', 'improve', 'resolve', 'anything']) {
    const { playbook, errors } = loadPlaybook(ROOT, name);
    assert.deepEqual(errors, [], `${name} playbook should load clean`);
    assert.ok(Number(playbook.maxFiles) > 0, `${name} must declare maxFiles`);
  }
});

test('every shipped playbook declares prefixes that match the PR titles it actually writes', () => {
  // Regression: the `<name>:` default silently misses `resolve ledger:` and `anything automation:`,
  // both of which are real PR titles in this repo's history. A preflight that cannot see a
  // routine's own open PR is the failure this whole check exists to prevent.
  const cases = [
    ['resolve', 'resolve ledger: record PR #434 and the Actions reporting-lag lesson'],
    ['resolve', 'resolve: delete groupIdentity’s never-called groupSlots()'],
    ['anything', 'anything automation: Matter.Body API craft rules and corpus fixture'],
    ['review', 'review: 2026-08-30 run — no bug found'],
    ['improve', 'improve: dead-code cleanup drops apps/web lintWarnings to 836'],
    ['metaphor3d', 'Metaphor3D: draw the grouping axis on the bodies that carry it'],
    ['canvas-graph-edit', 'canvas graph edit: mermaid gantt family']
  ];
  assert.ok(cases.length >= 7, 'sweep must cover every shipped playbook');
  for (const [name, title] of cases) {
    const { playbook } = loadPlaybook(ROOT, name);
    const found = matchOpenRoutinePrs({
      name,
      playbook,
      openPrs: [{ number: 1, title, headRefName: 'claude/unrelated-generated-name' }]
    });
    assert.equal(found.length, 1, `${name} must claim its own PR titled "${title}"`);
  }
});

test('the generated branch names this repo actually uses are recognised', () => {
  const cases = [
    ['review', 'claude/practical-newton-giqjy6'],
    ['improve', 'claude/eager-hopper-74jcfu'],
    ['resolve', 'claude/awesome-hawking-pmin47'],
    ['metaphor3d', 'claude/gifted-davinci-4radwc']
  ];
  for (const [name, branch] of cases) {
    const { playbook } = loadPlaybook(ROOT, name);
    const found = matchOpenRoutinePrs({
      name,
      playbook,
      openPrs: [{ number: 1, title: 'wip, no conventional prefix', headRefName: branch }]
    });
    assert.equal(found.length, 1, `${name} must recognise ${branch}`);
  }
});
