import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ALWAYS_FORBIDDEN,
  BUDGET_OWNERS,
  PLAYBOOK_SHELVES,
  ROUTINE_TIERS,
  checkRoutineDiff,
  collectPlaybooks,
  countTestCases,
  fetchOpenPrs,
  globToRegExp,
  isTestPath,
  loadPlaybook,
  matchOpenRoutinePrs,
  matchesAny,
  ownersOfPath,
  parseFrontmatter,
  parseRepoSlug,
  routinePrMatchers,
  shelfOwnershipViolation
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
  const prs = fetchOpenPrs({ runGh: () => JSON.stringify(OPEN_PRS) });
  assert.equal(prs?.length, 4);
});

test('fetchOpenPrs returns null — not [] — when gh is unavailable', () => {
  const prs = fetchOpenPrs({
    runGh: () => {
      throw new Error('gh: command not found');
    },
    runCurl: () => {
      throw new Error('no network');
    },
    remoteUrl: 'git@github.com:o/r.git'
  });
  assert.equal(
    prs,
    null,
    'an absent answer and an empty answer mean opposite things; conflating them would make ' +
      'preflight silently report "no open PR" on every box without gh'
  );
});

test('fetchOpenPrs returns null when neither route answers with a list', () => {
  assert.equal(
    fetchOpenPrs({
      runGh: () => '{"message":"Bad credentials"}',
      runCurl: () => '{"message":"Bad credentials"}',
      remoteUrl: 'git@github.com:o/r.git'
    }),
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
    ['canvas-graph-edit', 'canvas graph edit: mermaid gantt family'],
    ['deps', 'deps: merge npm_and_yarn group #455']
  ];
  const shipped = collectPlaybooks(ROOT)
    .filter(({ playbook }) => String(playbook.tier) !== 'report')
    .map(({ name }) => name);
  const covered = new Set(cases.map(([name]) => name));
  assert.deepEqual(
    shipped.filter((name) => !covered.has(name)),
    [],
    'the sweep must cover every playbook on disk, or it proves nothing about the missing ones'
  );
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

test('resolve is identified by its title prefix, not a generated branch (ADR-0017 host move)', () => {
  // It moved to Cursor on 2026-09-01, where the runner generates a different slug every firing.
  // A fleet-wide `cursor/` prefix would make preflight refuse to start behind *another* fleet's PR
  // (`cursor/critical-bug-memory-*`, `cursor/ci-autofix-*` are real branches in this repo), so the
  // branch half of the matcher is deliberately inert until the observed slug is pinned.
  const { playbook } = loadPlaybook(ROOT, 'resolve');
  const foreign = [
    {
      number: 1,
      title: 'fix(web): something from another fleet',
      headRefName: 'cursor/critical-bug-memory-55bc'
    },
    { number: 2, title: 'build(deps): bump foo', headRefName: 'dependabot/npm_and_yarn-foo-1' }
  ];
  assert.deepEqual(matchOpenRoutinePrs({ name: 'resolve', playbook, openPrs: foreign }), []);
  assert.equal(
    matchOpenRoutinePrs({
      name: 'resolve',
      playbook,
      openPrs: [
        { number: 3, title: 'resolve: 2026-09-01 run — #402', headRefName: 'cursor/whatever-x1' }
      ]
    }).length,
    1,
    'the title prefix alone must claim its own PR'
  );
});

// --- fetchOpenPrs: the REST fallback ----------------------------------------------------------
// `gh` is UNAUTHENTICATED in the cloud sandbox these routines run in. Measured on the digest
// routine's first live firing: preflight printed its "could not read open PRs" warning and skipped
// the one-branch-at-a-time check entirely — the whole property it exists to provide.

const REST_PAYLOAD = JSON.stringify([
  { number: 442, title: 'review: 2026-08-29 run', head: { ref: 'review/nfr-2026-08-29' } }
]);

test('parseRepoSlug handles both remote URL forms', () => {
  assert.equal(parseRepoSlug('git@github.com:acuhlmann/mermaid-gen.git'), 'acuhlmann/mermaid-gen');
  assert.equal(parseRepoSlug('https://github.com/acuhlmann/mermaid-gen'), 'acuhlmann/mermaid-gen');
  assert.equal(
    parseRepoSlug('https://github.com/acuhlmann/mermaid-gen.git\n'),
    'acuhlmann/mermaid-gen'
  );
  assert.equal(
    parseRepoSlug('https://gitlab.com/x/y.git'),
    null,
    'only GitHub has this REST shape'
  );
});

test('fetchOpenPrs falls back to REST when gh is unauthenticated', () => {
  const prs = fetchOpenPrs({
    runGh: () => {
      throw new Error('gh auth: no token');
    },
    runCurl: () => REST_PAYLOAD,
    remoteUrl: 'git@github.com:acuhlmann/mermaid-gen.git'
  });
  assert.equal(prs?.length, 1);
  assert.equal(
    prs?.[0].headRefName,
    'review/nfr-2026-08-29',
    'REST names the branch `head.ref`, gh names it `headRefName` — both must normalise'
  );
});

test('fetchOpenPrs prefers gh when it works, without calling curl', () => {
  let curlCalls = 0;
  const prs = fetchOpenPrs({
    runGh: () => JSON.stringify([{ number: 1, title: 't', headRefName: 'b' }]),
    runCurl: () => {
      curlCalls += 1;
      return REST_PAYLOAD;
    }
  });
  assert.equal(prs?.length, 1);
  assert.equal(curlCalls, 0, 'the REST call is a fallback, not a second request every run');
});

test('fetchOpenPrs sends an Authorization header only when a token is set', () => {
  /** @type {string[]} */
  let seen = [];
  const capture = (args) => {
    seen = args;
    return REST_PAYLOAD;
  };
  const prev = process.env.GH_TOKEN;
  delete process.env.GH_TOKEN;
  const prevGithub = process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_TOKEN;
  fetchOpenPrs({
    runGh: () => {
      throw new Error('x');
    },
    runCurl: capture,
    remoteUrl: 'git@github.com:o/r.git'
  });
  assert.ok(
    !seen.some((a) => a.startsWith('Authorization:')),
    'listing open PRs on a public repo needs no credentials'
  );
  process.env.GH_TOKEN = 'secret-value';
  fetchOpenPrs({
    runGh: () => {
      throw new Error('x');
    },
    runCurl: capture,
    remoteUrl: 'git@github.com:o/r.git'
  });
  assert.ok(seen.some((a) => a === 'Authorization: Bearer secret-value'));
  if (prev === undefined) delete process.env.GH_TOKEN;
  else process.env.GH_TOKEN = prev;
  if (prevGithub !== undefined) process.env.GITHUB_TOKEN = prevGithub;
});

test('fetchOpenPrs still returns null when neither route answers', () => {
  const prs = fetchOpenPrs({
    runGh: () => {
      throw new Error('no gh');
    },
    runCurl: () => {
      throw new Error('no network');
    },
    remoteUrl: 'git@github.com:o/r.git'
  });
  assert.equal(prs, null, 'warn, never report "no open PR" from an absent answer');
});

test('fetchOpenPrs returns null rather than guessing when the remote is not GitHub', () => {
  const prs = fetchOpenPrs({
    runGh: () => {
      throw new Error('no gh');
    },
    runCurl: () => REST_PAYLOAD,
    remoteUrl: 'git@gitlab.com:o/r.git'
  });
  assert.equal(prs, null);
});

test('the report tier passes with no diff and says so without printing "undefined"', () => {
  // This line is the proof an unattended run prints that it stayed in budget. A report routine has
  // no maxFiles, so the code-writing message rendered "0/undefined files" — the wrong shape of
  // proof, observed on the digest routine's first successful firing.
  const { playbook } = loadPlaybook(ROOT, 'digest');
  assert.equal(playbook.tier, 'report');
  assert.equal(
    Number(playbook.maxFiles || 0),
    0,
    'if a report routine ever declares maxFiles, the message branch below is no longer needed'
  );
  const result = checkRoutineDiff({ playbook, changes: [] });
  assert.deepEqual(result.violations, []);
});

// --- ADR-0017: owned budgets, a frozen referee, and a path→owner answer ---------------------

const EVERY_CODE_WRITING = collectPlaybooks(ROOT)
  .filter(({ playbook }) => String(playbook.tier) === 'code-writing')
  .map(({ playbook }) => playbook);

test('no routine can edit the guard that enforces its own budget', () => {
  // The budget is the safety model, so the reader of the budget cannot sit inside it. Issue #461.
  assert.ok(
    matchesAny('scripts/routine-guard.mjs', ALWAYS_FORBIDDEN),
    'the referee must be on the always-forbidden list'
  );
  assert.ok(EVERY_CODE_WRITING.length >= 4, 'sweep must cover the shipped code-writing playbooks');
  for (const playbook of EVERY_CODE_WRITING) {
    const result = checkRoutineDiff({
      playbook,
      changes: [{ status: 'M', file: 'scripts/routine-guard.mjs' }]
    });
    assert.equal(result.ok, false, `${playbook.name} must not reach routine-guard.mjs`);
  }
});

test('a routine cannot widen its own playbook budget (issue #461)', () => {
  const { playbook } = loadPlaybook(ROOT, 'resolve');
  const selfEdit = checkRoutineDiff({
    playbook,
    changes: [{ status: 'M', file: 'docs/routines/resolve.md' }]
  });
  assert.equal(
    selfEdit.ok,
    false,
    'resolve declares docs/** — without the ownership rule it could raise its own maxFiles and pass'
  );
  assert.match(selfEdit.violations.join('\n'), /not "resolve".s to edit/);
});

test('improve is the designated budget owner', () => {
  // ADR-0016 made improve the quality owner; ADR-0017 made that the one route a budget ever moves.
  assert.deepEqual(BUDGET_OWNERS, ['improve'], 'if a second routine owns budgets, say why here');
  const { playbook } = loadPlaybook(ROOT, 'improve');
  const result = checkRoutineDiff({
    playbook,
    changes: [
      { status: 'M', file: 'docs/routines/resolve.md' },
      { status: 'M', file: 'docs/automations/canvas-graph-edit.md' },
      { status: 'M', file: 'docs/routines/README.md' }
    ]
  });
  assert.deepEqual(result.violations, []);
});

test('a routine appends its own ledger and no one else’s', () => {
  const { playbook } = loadPlaybook(ROOT, 'resolve');
  assert.deepEqual(
    checkRoutineDiff({
      playbook,
      changes: [{ status: 'M', file: 'docs/routines/ledger/resolve.md' }]
    }).violations,
    [],
    'rule 7 requires every routine to write its own ledger'
  );
  const other = checkRoutineDiff({
    playbook,
    changes: [{ status: 'M', file: 'docs/automations/ledger/anything.md' }]
  });
  assert.equal(other.ok, false);
  assert.match(other.violations.join('\n'), /is `anything`'s ledger/);
});

test('the ownership rule is scoped to the two shelf directories, not to all of docs/', () => {
  assert.equal(shelfOwnershipViolation({ routineName: 'resolve', file: 'docs/adr.md' }), null);
  assert.equal(
    shelfOwnershipViolation({ routineName: 'resolve', file: 'docs/routines/ledger/resolve.md' }),
    null
  );
  assert.notEqual(
    shelfOwnershipViolation({ routineName: 'resolve', file: 'docs/routines/ledger/deps.md' }),
    null,
    'another routine\'s ledger is not "docs/**"-reachable — it is owned'
  );
  assert.equal(
    shelfOwnershipViolation({ routineName: 'improve', file: 'docs/automations/anything.md' }),
    null,
    'improve owns every playbook, including feature-automation budgets'
  );
});

test('the ownership rule leaves the product tree alone', () => {
  const { playbook } = loadPlaybook(ROOT, 'resolve');
  const result = checkRoutineDiff({
    playbook,
    changes: [
      { status: 'M', file: 'docs/canvas-graph-edit.md' },
      { status: 'M', file: 'apps/server/src/routes/copilot.ts' },
      { status: 'M', file: 'README.md' }
    ]
  });
  assert.deepEqual(result.violations, []);
});

test('every script in scripts/ has an owner, or is deliberately frozen', () => {
  // The class that stranded #461, #462 and #473: a scoped, `ready-for-agent` fix in a file no
  // playbook's allowedPaths reached. This sweep is what stops that recurring in scripts/.
  const scriptDir = path.join(ROOT, 'scripts');
  const files = fs
    .readdirSync(scriptDir)
    .filter((entry) => entry.endsWith('.mjs') || entry.endsWith('.js'))
    .map((entry) => `scripts/${entry}`);
  assert.ok(files.length > 10, 'sweep must find the real scripts directory');
  for (const file of files) {
    const owners = ownersOfPath(file);
    if (owners.length === 0) {
      assert.ok(
        matchesAny(file, ALWAYS_FORBIDDEN),
        `${file} is reachable by no routine and is not on the always-forbidden list`
      );
    }
  }
});

test('ownersOfPath answers the question a filer used to have to read four playbooks for', () => {
  assert.ok(ownersOfPath('scripts/test-affected-lib.mjs').includes('improve'));
  assert.ok(ownersOfPath('apps/web/src/utils/officeCadence.js').includes('review'));
  assert.deepEqual(
    ownersOfPath('package-lock.json'),
    [],
    'dependabot owns the lockfile, not a routine'
  );
  assert.ok(!ownersOfPath('apps/web/src/components/DiagramCanvas.jsx').includes('anything'));
});

test('ownersOfPath answers who may write it, not merely whose allowlist covers it', () => {
  // resolve declares docs/**, so a pure-allowedPaths answer would tell a resolve run that #476's
  // remaining item (a canvas-graph-edit playbook edit) is reachable from here. Postflight refuses
  // that; the sensor has to say the same thing before the branch is cut, not after.
  assert.deepEqual(ownersOfPath('docs/routines/resolve.md'), ['improve']);
  assert.deepEqual(ownersOfPath('docs/routines/README.md'), ['improve']);
  assert.ok(ownersOfPath('docs/routines/ledger/resolve.md').includes('resolve'));
  assert.ok(ownersOfPath('docs/routines/ledger/resolve.md').includes('improve'));
  assert.ok(!ownersOfPath('docs/routines/ledger/resolve.md').includes('deps'));
});

test('a file named by an issue is reachable by the routine the label promises', () => {
  // The invariant behind `--reachable`: `ready-for-agent` must mean "an agent can write this file".
  const unowned = [
    'scripts/verify-ratchet.mjs',
    'docs/guide/agents.md',
    'apps/web/src/App.jsx'
  ].filter((file) => ownersOfPath(file).length === 0 && !matchesAny(file, ALWAYS_FORBIDDEN));
  assert.deepEqual(unowned, []);
});
