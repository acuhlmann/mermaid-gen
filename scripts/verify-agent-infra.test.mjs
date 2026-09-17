import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  collectRootPackageScripts,
  collectRoutineDocs,
  extractBlastRadiusTestPaths,
  extractLadderTableRows,
  extractNpmScriptNames,
  parsePlaybookSchedule,
  verifyAgentInfra,
  verifyNightLadder,
  verifyPlaybookPaths,
  parseLadderJobCountToken
} from './verify-agent-infra.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('extractNpmScriptNames skips workspace-scoped invocations', () => {
  const names = extractNpmScriptNames(
    'Root `npm run build` vs workspace `npm run vendor:anything-libs -w packages/shared`.'
  );
  assert.deepEqual([...names].sort(), ['build']);
});

test('extractNpmScriptNames finds root scripts in agent docs', () => {
  const names = extractNpmScriptNames('Run `npm run check:affected` then `npm run check:full`.');
  assert.deepEqual([...names].sort(), ['check:affected', 'check:full']);
});

test('extractBlastRadiusTestPaths ignores prose after test file links', () => {
  const paths = extractBlastRadiusTestPaths(
    '| Tests | [`packages/shared/test/wireRoundTrip.test.ts`](../packages/shared/test/wireRoundTrip.test.ts), server agent tests |'
  );
  assert.deepEqual(paths, ['packages/shared/test/wireRoundTrip.test.ts']);
});

test('collectRootPackageScripts includes agent verify commands', () => {
  const scripts = collectRootPackageScripts(ROOT);
  assert.ok(scripts.has('check:affected'));
  assert.ok(scripts.has('precommit'));
  assert.ok(scripts.has('verify:doc-paths'));
});

test('verifyAgentInfra passes on the current repository', () => {
  const result = verifyAgentInfra(ROOT);
  assert.equal(
    result.ok,
    true,
    [
      ...result.missingScripts.map((m) => `missing script ${m.script} (cited in ${m.source})`),
      ...result.missingTests.map((m) => `missing test ${m.path} (cited in ${m.source})`)
    ].join('\n')
  );
  assert.ok(result.scriptCount > 10);
  assert.ok(result.testPathCount >= 5);
});

test('verifyAgentInfra reports a missing npm script cited in a temp doc', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-agent-infra-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ scripts: {} }));
  fs.writeFileSync(path.join(tmp, 'AGENTS.md'), 'Use `npm run missing-script`.\n');
  const result = verifyAgentInfra(tmp, ['AGENTS.md']);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missingScripts, [{ script: 'missing-script', source: 'AGENTS.md' }]);
});

test('verifyAgentInfra reports a missing blast-radius test path', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-agent-infra-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ scripts: {} }));
  const doc = path.join(tmp, 'docs', 'agent-blast-radius.md');
  fs.mkdirSync(path.dirname(doc), { recursive: true });
  fs.writeFileSync(
    doc,
    '| Tests | [`apps/server/test/__missing__.test.js`](../apps/server/test/__missing__.test.js) |\n'
  );
  const result = verifyAgentInfra(tmp, ['docs/agent-blast-radius.md']);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missingTests, [
    { path: 'apps/server/test/__missing__.test.js', source: 'docs/agent-blast-radius.md' }
  ]);
});

test('collectRoutineDocs discovers playbooks without listing them', () => {
  const docs = collectRoutineDocs(ROOT);
  assert.ok(docs.includes('docs/routines/review.md'));
  assert.ok(docs.includes('docs/routines/improve.md'));
  assert.ok(docs.includes('docs/automations/anything.md'));
  assert.ok(
    !docs.includes('docs/routines/README.md'),
    'the contract is added separately, not as a playbook'
  );
});

test('routine playbooks are covered by the default scan', () => {
  const scripts = collectRootPackageScripts(ROOT);
  assert.ok(scripts.has('routine:guard'));
  assert.ok(scripts.has('verify:ratchet'));

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-infra-'));
  fs.mkdirSync(path.join(dir, 'docs/routines/ledger'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { check: 'x' } }));
  fs.writeFileSync(path.join(dir, 'docs/routines/README.md'), 'Run `npm run check`.\n');
  fs.writeFileSync(path.join(dir, 'docs/routines/ghost.md'), 'Run `npm run not-a-script`.\n');

  const result = verifyAgentInfra(dir);
  assert.equal(result.ok, false, 'a playbook naming a missing script must fail');
  assert.ok(
    result.missingScripts.some(
      (miss) => miss.source === 'docs/routines/ghost.md' && miss.script === 'not-a-script'
    ),
    `expected the playbook's bad script to be reported, got ${JSON.stringify(result.missingScripts)}`
  );
});

// --- the night ladder: one declaration, several copies, nothing that used to compare them ---------
//
// The ladder is stated in a playbook's `schedule:` and then restated in tables in review.md,
// docs/automations/README.md, AGENTS.md and CLAUDE.md. On 2026-09-13 `prune` grew a live daily cron
// while its playbook still read `schedule: none`, and every one of those copies agreed with the stale
// declaration — so CI was green on a fleet whose own documentation was wrong.

/**
 * @param {{name: string, schedule: string, dir?: string}[]} playbooks
 * @param {string[]} ladderRows rendered rows of the authority table, without the header
 * @returns {string} a repo root
 */
function ladderFixture(playbooks, ladderRows) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ladder-'));
  let activeRungCount = 0;
  for (const pb of playbooks) {
    const dir = path.join(root, 'docs', pb.dir ?? 'routines');
    fs.mkdirSync(dir, { recursive: true });
    const pausedLine = pb.paused ? `paused: '${pb.paused}'\n` : '';
    fs.writeFileSync(
      path.join(dir, `${pb.name}.md`),
      `---\nname: ${pb.name}\ntier: code-writing\nschedule: ${pb.schedule}\n${pausedLine}---\n\n# ${pb.name}\n`
    );
    if (pb.schedule !== 'none' && pb.name !== 'deps' && !pb.paused) activeRungCount++;
  }
  fs.writeFileSync(
    path.join(root, 'docs', 'routines', 'review.md'),
    [
      '> **The night ladder**',
      '> | HKT | UTC | Job | shelf | host |',
      '> | --- | --- | --- | --- | --- |',
      ...ladderRows.map((row) => `> ${row}`)
    ].join('\n') + '\n'
  );
  const jobLine = `${activeRungCount} jobs run between \`0 15\` and \`45 0\` UTC.\n`;
  fs.writeFileSync(path.join(root, 'AGENTS.md'), jobLine);
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), jobLine);
  return root;
}

const LADDER_OK = [
  '| 23:30 | `30 15 * * *` | `prune` | routines | Claude |',
  '| 08:45 | `45 0 * * *` | `digest` | routines | Claude |'
];

test('parsePlaybookSchedule reads a quoted and a bare schedule value', () => {
  assert.deepEqual(parsePlaybookSchedule("---\nname: x\nschedule: '0 15 * * *'\n---\n"), {
    name: 'x',
    schedule: '0 15 * * *',
    paused: false
  });
  assert.deepEqual(parsePlaybookSchedule('---\nname: x\nschedule: none\n---\n'), {
    name: 'x',
    schedule: 'none',
    paused: false
  });
  assert.deepEqual(
    parsePlaybookSchedule("---\nname: x\nschedule: '0 15 * * *'\npaused: 'owner pause'\n---\n"),
    { name: 'x', schedule: '0 15 * * *', paused: true }
  );
});

test('extractLadderTableRows reads a table inside a blockquote', () => {
  const rows = extractLadderTableRows(LADDER_OK.map((r) => `> ${r}`).join('\n'), 'x.md');
  assert.deepEqual(
    rows.map((r) => [r.name, r.cron, r.hkt]),
    [
      ['prune', '30 15 * * *', '23:30'],
      ['digest', '45 0 * * *', '08:45']
    ]
  );
});

test('a ladder whose copies agree passes', () => {
  const root = ladderFixture(
    [
      { name: 'prune', schedule: "'30 15 * * *'" },
      { name: 'digest', schedule: "'45 0 * * *'" }
    ],
    LADDER_OK
  );
  const result = verifyNightLadder(root);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rungCount, 2);
});

test('a table copy that disagrees with its playbook is reported with both values', () => {
  const root = ladderFixture(
    [{ name: 'prune', schedule: "'0 15 * * *'" }],
    ['| 00:00 | `0 16 * * *` | `prune` | routines | Claude |']
  );
  const result = verifyNightLadder(root);
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1, result.errors.join('\n'));
  assert.match(result.errors[0], /scheduled `0 16 \* \* \*` in this table but '0 15 \* \* \*'/);
});

test('an HKT column that no longer matches its UTC hour is reported', () => {
  const root = ladderFixture(
    [{ name: 'prune', schedule: "'0 15 * * *'" }],
    ['| 21:00 | `0 15 * * *` | `prune` | routines | Claude |']
  );
  const result = verifyNightLadder(root);
  assert.equal(result.errors.length, 1, result.errors.join('\n'));
  assert.match(
    result.errors[0],
    /shows HKT 21:00 for cron `0 15 \* \* \*` \(UTC\), which is 23:00/
  );
});

test('a ladder row for a manual-only playbook is the prune failure, and it is reported', () => {
  const root = ladderFixture([{ name: 'prune', schedule: 'none' }], [LADDER_OK[0]]);
  const result = verifyNightLadder(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /schedule: none/);
});

test('a scheduled rung with no ladder row is a rung nobody can find', () => {
  const root = ladderFixture(
    [
      { name: 'prune', schedule: "'0 15 * * *'" },
      { name: 'digest', schedule: "'45 0 * * *'" }
    ],
    [LADDER_OK[0]]
  );
  const result = verifyNightLadder(root);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /`digest`.*no ladder row/.test(e)),
    result.errors.join('\n')
  );
});

test('a rung outside the night window is refused, and one past midnight is not', () => {
  const late = ladderFixture(
    [{ name: 'prune', schedule: "'0 13 * * *'" }],
    ['| 21:00 | `0 13 * * *` | `prune` | routines | Claude |']
  );
  assert.match(verifyNightLadder(late).errors.join('\n'), /outside the night ladder window/);

  // `45 0 * * *` is 08:45 HKT — inside a window that opens at 15:00 and wraps midnight.
  const wrapping = ladderFixture([{ name: 'digest', schedule: "'45 0 * * *'" }], [LADDER_OK[1]]);
  assert.deepEqual(verifyNightLadder(wrapping).errors, []);
});

test('a paused rung must be marked parked in every mirror row', () => {
  const root = ladderFixture(
    [{ name: 'paused-job', schedule: "'30 20 * * *'", paused: 'owner disabled trigger' }],
    ['| 04:30 | `30 20 * * *` | `paused-job` | automations | Claude |']
  );
  const bad = verifyNightLadder(root);
  assert.equal(bad.ok, false);
  assert.match(bad.errors.join('\n'), /not marked parked/);

  const rootOk = ladderFixture(
    [{ name: 'paused-job', schedule: "'30 20 * * *'", paused: 'owner disabled trigger' }],
    ['| 04:30 | `30 20 * * *` | `paused-job` | automations | Claude | — **parked** |']
  );
  assert.deepEqual(verifyNightLadder(rootOk).errors, []);
});

test('parseLadderJobCountToken accepts digits and the word forms root docs use', () => {
  assert.equal(parseLadderJobCountToken('8'), 8);
  assert.equal(parseLadderJobCountToken('Eight'), 8);
  assert.equal(parseLadderJobCountToken('three'), 3);
  assert.equal(parseLadderJobCountToken('nope'), null);
});

test('root prose job count must match unpaused rungs (word form, like AGENTS.md/CLAUDE.md)', () => {
  const root = ladderFixture(
    [
      { name: 'prune', schedule: "'30 15 * * *'" },
      { name: 'digest', schedule: "'45 0 * * *'" }
    ],
    LADDER_OK
  );
  fs.writeFileSync(path.join(root, 'AGENTS.md'), 'Nine jobs run between `0 15` and `45 0` UTC.\n');
  const result = verifyNightLadder(root);
  assert.equal(result.ok, false, result.errors.join('\n'));
  assert.match(result.errors.join('\n'), /AGENTS\.md.*says 9 jobs.*2 rungs/);
});

test('a wrong word-form job count is refused', () => {
  const root = ladderFixture([{ name: 'prune', schedule: "'30 15 * * *'" }], [LADDER_OK[0]]);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), 'Three jobs run between `0 15` and `45 0` UTC.\n');
  const result = verifyNightLadder(root);
  assert.equal(result.ok, false, result.errors.join('\n'));
  assert.match(result.errors.join('\n'), /AGENTS\.md.*says 3 jobs.*1 rungs/);
});

test('missing ladder job-count prose fails instead of passing silently', () => {
  const root = ladderFixture([{ name: 'prune', schedule: "'30 15 * * *'" }], [LADDER_OK[0]]);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), 'No ladder count sentence here.\n');
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), 'Also nothing to match.\n');
  const result = verifyNightLadder(root);
  assert.equal(result.ok, false, result.errors.join('\n'));
  assert.match(result.errors.join('\n'), /AGENTS\.md — no "… jobs run between" ladder count found/);
  assert.match(result.errors.join('\n'), /CLAUDE\.md — no "… jobs run between" ladder count found/);
});

test('missing job-count in one root doc fails even when the other still has a sentence', () => {
  const root = ladderFixture([{ name: 'prune', schedule: "'30 15 * * *'" }], [LADDER_OK[0]]);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), 'nothing here at all.\n');
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), 'One jobs run between `0 15` and `45 0` UTC.\n');
  const result = verifyNightLadder(root);
  assert.equal(result.ok, false, result.errors.join('\n'));
  assert.match(result.errors.join('\n'), /AGENTS\.md — no "… jobs run between" ladder count found/);
  assert.doesNotMatch(result.errors.join('\n'), /CLAUDE\.md — no "… jobs run between"/);
});

test('ordinary prose before "jobs run between" does not match the job-count sensor', () => {
  const root = ladderFixture([{ name: 'prune', schedule: "'30 15 * * *'" }], [LADDER_OK[0]]);
  fs.writeFileSync(
    path.join(root, 'AGENTS.md'),
    'All jobs run between `0 15` and `45 0` UTC.\nEight jobs run between `0 15` and `45 0` UTC.\n'
  );
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), 'Eight jobs run between `0 15` and `45 0` UTC.\n');
  const result = verifyNightLadder(root);
  assert.equal(result.ok, false, result.errors.join('\n'));
  assert.doesNotMatch(
    result.errors.join('\n'),
    /ladder job count `All` is not a digit or a known English number word/
  );
  assert.match(result.errors.join('\n'), /AGENTS\.md.*says 8 jobs.*1 rungs/);
});

test('a rung declared off the ladder needs no row and no window', () => {
  const root = ladderFixture(
    [
      { name: 'deps', schedule: "'30 4,14 * * *'" },
      { name: 'prune', schedule: "'30 15 * * *'" }
    ],
    [LADDER_OK[0]]
  );
  assert.deepEqual(verifyNightLadder(root).errors, []);
});

test('the night ladder is stated consistently in every file that restates it', () => {
  const ladder = verifyNightLadder(ROOT);
  assert.deepEqual(ladder.errors, [], ladder.errors.join('\n'));
  assert.ok(ladder.rungCount >= 10, `expected every rung, got ${ladder.rungCount}`);
  assert.ok(ladder.rowCheckCount >= 20, 'the mirrors are the point of this check');

  const prune = fs.readFileSync(path.join(ROOT, 'docs/routines/prune.md'), 'utf8');
  assert.equal(parsePlaybookSchedule(prune).schedule, '30 15 * * *', 'prune has a declared slot');
  assert.match(prune, /^maxFiles: 5$/m, 'and it still batches one class of five at a time');
});

// --- budget gates: only the direction that is unsafe when it goes stale ---------------------------

/**
 * @param {{name: string, front: string}[]} playbooks
 * @returns {string} a repo root whose docs/routines contains them, plus a real file to point at
 */
function budgetFixture(playbooks) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-'));
  fs.mkdirSync(path.join(root, 'docs/routines/ledger'), { recursive: true });
  fs.mkdirSync(path.join(root, 'apps'), { recursive: true });
  fs.writeFileSync(path.join(root, 'apps/real.js'), 'export const real = 1;\n');
  for (const pb of playbooks) {
    fs.writeFileSync(path.join(root, `docs/routines/${pb.name}.md`), `---\n${pb.front}\n---\n`);
    fs.writeFileSync(path.join(root, `docs/routines/ledger/${pb.name}.md`), '# ledger\n');
  }
  return root;
}

const budgetPlaybook = (name, allowed, forbidden) => ({
  name,
  front: `name: ${name}\ntier: code-writing\nschedule: '0 15 * * *'\nmaxFiles: 3\nmaxIssues: 0\nallowedPaths:\n${allowed
    .map((p) => `  - ${p}`)
    .join('\n')}\nforbiddenPaths:\n${forbidden.map((p) => `  - ${p}`).join('\n')}`
});

test('a forbidden path that names no file fails — that gate blocks nothing', () => {
  const root = budgetFixture([budgetPlaybook('gatekeeper', ['apps/**'], ['apps/moved-away.js'])]);
  const result = verifyPlaybookPaths(root);
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1, result.errors.join('\n'));
  assert.match(result.errors[0], /`apps\/moved-away\.js`/);
  assert.match(result.errors[0], /blocks nothing/);
});

test('a stale ALLOWED path is not reported, because it grants nothing and may be a forward declaration', () => {
  // `canvas-graph-edit` has named the file its own `hook-rename` slice will create since 2026-08-30.
  // Reporting that as drift would get this whole check widened by the next run that wants green.
  const root = budgetFixture([
    budgetPlaybook('planner', ['apps/future-file.js', 'apps/real.js'], ['apps/**/*.secret'])
  ]);
  assert.deepEqual(verifyPlaybookPaths(root).errors, []);
});

test('globs are left to the guard that enforces them', () => {
  const root = budgetFixture([budgetPlaybook('glover', ['apps/**'], ['apps/**/gone/**'])]);
  const result = verifyPlaybookPaths(root);
  assert.equal(result.ok, true);
  assert.equal(result.checkedCount, 0, 'a wildcard is not a concrete path and must not be counted');
});

test('this repository has no stale forbid-gate, and the check is looking at real budgets', () => {
  const result = verifyPlaybookPaths(ROOT);
  assert.deepEqual(result.errors, [], result.errors.join('\n'));
  // Nine rungs declare forbiddenPaths and only `prune` names concrete files — the rest are globs,
  // which this check deliberately leaves to the guard. So the honest claim is "it inspected the two
  // that a rename could silently disarm", not "it inspected the shelf". `prune`'s two are the
  // scanner that decides what is deletable: if it is renamed, the one gate keeping the deletion
  // routine from editing its own referee disappears without a word.
  assert.ok(result.checkedCount >= 2, `inspected only ${result.checkedCount} gate(s)`);
  assert.ok(
    result.checkedCount < 10,
    'a jump here means a rung started naming concrete forbidden files — worth reading, not widening'
  );
});
