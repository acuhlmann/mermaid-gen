import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildTickRecord } from './recordTick.mjs';
import {
  deriveCadence,
  mergeGodLogTick,
  monthTotals,
  promptSafeHistory,
  readGodLogState,
  writeGodLogOutputs
} from './godLog.mjs';

function writeRun(root, record) {
  const runs = path.join(root, 'runs');
  const index = path.join(root, 'index');
  fs.mkdirSync(runs, { recursive: true });
  fs.mkdirSync(index, { recursive: true });
  fs.writeFileSync(path.join(runs, `${record.runId}.json`), `${JSON.stringify(record)}\n`);
  const month = record.endedAt.slice(0, 7);
  const idxPath = path.join(index, `${month}.json`);
  let idx = { v: 1, month, runs: [] };
  if (fs.existsSync(idxPath)) idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
  idx.runs.push({
    runId: record.runId,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    verdict: record.verdict,
    tier: record.tier,
    usd: record.usage.usd,
    gateReason: 'test'
  });
  fs.writeFileSync(idxPath, `${JSON.stringify(idx)}\n`);
}

test('promptSafeHistory strips hypothesis and accepts the old object form', () => {
  const record = buildTickRecord({
    'run-id': 'h1',
    tier: 'observe',
    focus: 'any',
    trigger: 'schedule',
    now: '2026-10-15T07:17:00.000Z'
  });
  record.hypothesis = 'Accept rate fell.';
  const safe = promptSafeHistory({ v: 1, records: [record] });
  assert.equal(safe.length, 1);
  assert.equal(safe[0].hypothesis, null);
  assert.equal(safe[0].runId, 'h1');
  assert.throws(() => promptSafeHistory({ lastActAt: null }));
});

test('readGodLogState uses the last act and this month of run-record spend', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'god-log-'));
  const noop = buildTickRecord({
    'run-id': 'n1',
    tier: 'observe',
    focus: 'any',
    verdict: 'noop',
    trigger: 'schedule',
    now: '2026-10-15T08:00:00.000Z'
  });
  const acted = buildTickRecord({
    'run-id': 'a1',
    tier: 'observe',
    focus: 'mermaid',
    trigger: 'schedule',
    now: '2026-10-14T07:00:00.000Z'
  });
  acted.verdict = 'observed';
  acted.hypothesis = 'Do not show this to the model.';
  acted.usage = { ...acted.usage, usd: 0.4 };
  const older = buildTickRecord({
    'run-id': 'a0',
    tier: 'observe',
    focus: 'any',
    trigger: 'schedule',
    now: '2026-09-01T07:00:00.000Z'
  });
  older.verdict = 'observed';
  older.usage = { ...older.usage, usd: 9 };
  writeRun(root, noop);
  writeRun(root, acted);
  writeRun(root, older);

  const state = readGodLogState(root, { now: new Date('2026-10-15T12:00:00.000Z') });
  assert.equal(state.lastActAt, '2026-10-14T07:00:00.000Z');
  assert.equal(state.monthSpendUsd, 0.4);
  assert.equal(state.history.length, 3);
  assert.equal(
    state.history.every((row) => row.hypothesis === null),
    true
  );

  const missing = readGodLogState(path.join(root, 'absent'), {
    now: new Date('2026-10-15T12:00:00.000Z')
  });
  assert.equal(missing.lastActAt, null);
  assert.equal(missing.monthSpendUsd, 0);
  assert.deepEqual(missing.history, []);

  const out = path.join(root, 'gh');
  writeGodLogOutputs(state, out);
  const text = fs.readFileSync(out, 'utf8');
  assert.match(text, /^last_act_at=2026-10-14T07:00:00.000Z$/m);
  assert.match(text, /^month_spend=0.4$/m);
});

test('cadence and spend survive a rollup that was rewritten to one row', () => {
  // The 2026-10-16 shape on god-log: 52 run records, index/2026-10.json holding only the last
  // tick. Money and cadence read from the rollup would report a history of one run, disarming
  // GOD_MAX_USD_PER_MONTH and GOD_EVERY_HOURS the first time God actually spends.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'god-log-clobber-'));
  const acts = [
    { runId: 'b1', at: '2026-10-14T07:00:00.000Z', usd: 0.35, verdict: 'observed' },
    { runId: 'b2', at: '2026-10-15T07:00:00.000Z', usd: 0.5, verdict: 'pr_opened' },
    { runId: 'b3', at: '2026-10-16T07:00:00.000Z', usd: 0.65, verdict: 'red' }
  ];
  for (const act of acts) {
    const record = buildTickRecord({
      'run-id': act.runId,
      tier: 'propose',
      focus: 'any',
      trigger: 'schedule',
      now: act.at
    });
    record.verdict = act.verdict;
    record.usage = { ...record.usage, usd: act.usd };
    fs.mkdirSync(path.join(root, 'runs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'runs', `${act.runId}.json`), `${JSON.stringify(record)}\n`);
  }
  fs.mkdirSync(path.join(root, 'index'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'index', '2026-10.json'),
    `${JSON.stringify({
      v: 1,
      month: '2026-10',
      runs: [{ runId: 'b3', startedAt: acts[2].at, endedAt: acts[2].at, verdict: 'noop', usd: 0 }]
    })}\n`
  );

  const state = readGodLogState(root, { now: new Date('2026-10-16T12:00:00.000Z') });
  assert.equal(state.monthSpendUsd, 1.5);
  assert.equal(state.lastActAt, '2026-10-16T07:00:00.000Z');

  // A noop tick contributes spend but is not an act, so it must not move the cadence.
  const noopOnly = buildTickRecord({
    'run-id': 'n9',
    tier: 'propose',
    focus: 'any',
    verdict: 'noop',
    trigger: 'schedule',
    now: '2026-10-16T09:00:00.000Z'
  });
  noopOnly.usage = { ...noopOnly.usage, usd: 0.01 };
  assert.deepEqual(deriveCadence([noopOnly], '2026-10'), {
    lastActAt: null,
    monthSpendUsd: 0.01
  });
});

test('mergeGodLogTick unions the month rollup instead of replacing it', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'god-log-dest-'));
  const tick = (/** @type {string} */ id, /** @type {string} */ at) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `god-log-tick-${id}-`));
    writeRun(dir, buildTickRecord({ 'run-id': id, tier: 'propose', focus: 'any', now: at }));
    return dir;
  };

  mergeGodLogTick({ destRoot: dest, tickDir: tick('m1', '2026-10-15T07:17:00.000Z') });
  const second = mergeGodLogTick({
    destRoot: dest,
    tickDir: tick('m2', '2026-10-16T07:17:00.000Z')
  });

  const month = JSON.parse(fs.readFileSync(path.join(dest, 'index', '2026-10.json'), 'utf8'));
  assert.deepEqual(
    month.runs.map((row) => row.runId),
    ['m1', 'm2']
  );
  assert.equal(second.index['2026-10'], 2);
  assert.equal(second.runsCopied, 1);
  assert.ok(fs.existsSync(path.join(dest, 'runs', 'm1.json')));

  // The record job can be re-run on the same tick; a duplicate row must not accumulate.
  mergeGodLogTick({ destRoot: dest, tickDir: tick('m2', '2026-10-16T07:17:00.000Z') });
  const again = JSON.parse(fs.readFileSync(path.join(dest, 'index', '2026-10.json'), 'utf8'));
  assert.equal(again.runs.length, 2);
});

test('the fold stamps the true month totals, not the surviving rows', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'god-log-stamp-'));
  const tick = (id, at, verdict, usd) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `god-log-stamp-${id}-`));
    const record = buildTickRecord({
      'run-id': id,
      tier: 'propose',
      focus: 'any',
      now: at
    });
    record.verdict = verdict;
    record.usage = { ...record.usage, usd };
    writeRun(dir, record);
    return dir;
  };

  mergeGodLogTick({ destRoot: dest, tickDir: tick('x1', '2026-09-30T06:17:00.000Z', 'noop', 0) });
  mergeGodLogTick({
    destRoot: dest,
    tickDir: tick('x2', '2026-10-15T15:22:19.545Z', 'observed', 0.018813)
  });
  const third = mergeGodLogTick({
    destRoot: dest,
    tickDir: tick('x3', '2026-10-16T06:17:00.000Z', 'noop', 0)
  });

  assert.deepEqual(third.stamped['2026-10'], {
    ticks: 2,
    acts: 1,
    monthSpendUsd: 0.018813,
    lastActAt: '2026-10-15T15:22:19.545Z'
  });
  const oct = JSON.parse(fs.readFileSync(path.join(dest, 'index', '2026-10.json'), 'utf8'));
  assert.deepEqual(oct.totals, third.stamped['2026-10']);
  // Previous months are stamped too, so a month truncated before this landed reports its real size.
  const sep = JSON.parse(fs.readFileSync(path.join(dest, 'index', '2026-09.json'), 'utf8'));
  assert.deepEqual(sep.totals, {
    ticks: 1,
    acts: 0,
    monthSpendUsd: 0,
    unproductiveActs: 0,
    unproductiveUsd: 0,
    lastActAt: null
  });

  // Re-folding the same tick must not rewrite the stamp: an hourly tick should not churn the branch.
  const rerun = mergeGodLogTick({
    destRoot: dest,
    tickDir: tick('x3', '2026-10-16T06:17:00.000Z', 'noop', 0)
  });
  assert.deepEqual(rerun.stamped, {});
});

test('the stamp survives a rollup truncated to one row', () => {
  // October 2026 exactly: 54 records, 1 index row. Counting rows reports a month 54x too small,
  // spend included, and the status view cannot list runs/ over raw HTTPS to correct it itself.
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'god-log-trunc-'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'god-log-trunc-tick-'));
  writeRun(
    dir,
    buildTickRecord({
      'run-id': 'new',
      tier: 'propose',
      focus: 'any',
      now: '2026-10-17T07:17:00.000Z'
    })
  );
  fs.mkdirSync(path.join(dest, 'runs'), { recursive: true });
  fs.mkdirSync(path.join(dest, 'index'), { recursive: true });
  for (let i = 0; i < 53; i += 1) {
    const record = buildTickRecord({
      'run-id': `t${i}`,
      tier: 'propose',
      focus: 'any',
      now: `2026-10-${String(1 + (i % 15)).padStart(2, '0')}T06:17:00.000Z`
    });
    if (i === 0) {
      record.verdict = 'observed';
      record.usage = { ...record.usage, usd: 0.018813 };
    }
    fs.writeFileSync(
      path.join(dest, 'runs', `${record.runId}.json`),
      `${JSON.stringify(record)}\n`
    );
  }
  fs.writeFileSync(
    path.join(dest, 'index', '2026-10.json'),
    `${JSON.stringify({
      v: 1,
      month: '2026-10',
      runs: [
        { runId: 't0', startedAt: 't', endedAt: 't', verdict: 'noop', tier: 'propose', usd: 0 }
      ]
    })}\n`
  );

  mergeGodLogTick({ destRoot: dest, tickDir: dir });
  const oct = JSON.parse(fs.readFileSync(path.join(dest, 'index', '2026-10.json'), 'utf8'));
  assert.equal(oct.runs.length, 2, 'the rows are still truncated — only the stamp can be trusted');
  assert.equal(oct.totals.ticks, 54);
  assert.equal(oct.totals.acts, 1);
  assert.equal(oct.totals.monthSpendUsd, 0.018813);

  // And the gate reads the same truth from the records.
  const state = readGodLogState(dest, { now: new Date('2026-10-17T12:00:00.000Z') });
  assert.equal(state.monthSpendUsd, 0.018813);
});

test('cadence spans months but spend does not', () => {
  // A month boundary must not reset GOD_EVERY_HOURS to "never acted" and let God spend again.
  const acted = buildTickRecord({
    'run-id': 'sep-act',
    tier: 'observe',
    focus: 'any',
    now: '2026-09-30T23:00:00.000Z'
  });
  acted.verdict = 'pr_opened';
  acted.usage = { ...acted.usage, usd: 0.5 };
  const noop = buildTickRecord({
    'run-id': 'oct-noop',
    tier: 'observe',
    focus: 'any',
    now: '2026-10-01T00:17:00.000Z'
  });
  noop.usage = { ...noop.usage, usd: 0.25 };

  const october = deriveCadence([acted, noop], '2026-10');
  assert.equal(october.lastActAt, '2026-09-30T23:00:00.000Z', 'all-time act, not this month only');
  assert.equal(october.monthSpendUsd, 0.25, 'spend stays scoped to the month the cap measures');

  // monthTotals is per-month by contract, which is why deriveCadence cannot simply delegate.
  assert.deepEqual(monthTotals([acted, noop], '2026-10'), {
    ticks: 1,
    acts: 0,
    monthSpendUsd: 0.25,
    unproductiveActs: 0,
    unproductiveUsd: 0,
    lastActAt: null
  });
});

test('money spent on silence is counted, and an artifact excuses it', () => {
  const at = (id, day) => `2026-10-${String(day).padStart(2, '0')}T06:17:00.000Z`;
  const act = (id, day, usd, extra = {}) => {
    const record = buildTickRecord({
      'run-id': id,
      tier: 'propose',
      focus: 'any',
      now: at(id, day)
    });
    record.verdict = 'observed';
    record.usage = { ...record.usage, usd };
    return { ...record, ...extra };
  };

  const month = [
    act('silent', 1, 0.02, { narration: 'dropped' }),
    act('waiting', 2, 0.01, { narration: 'waiting' }),
    act('finding', 3, 0.03, { narration: 'finding' }),
    // A propose run whose text satisfied nothing still produced a patch: not silence, an artifact.
    act('patched', 4, 0.05, {
      verdict: 'pr_opened',
      narration: 'dropped',
      filesChanged: ['docs/x.md'],
      branch: 'god/patched'
    })
  ];

  const judged = monthTotals(month, '2026-10');
  assert.equal(judged.ticks, 4);
  assert.equal(judged.acts, 4);
  assert.equal(judged.monthSpendUsd, 0.11);
  assert.equal(judged.unproductiveActs, 1);
  assert.equal(judged.unproductiveUsd, 0.02);

  // One act recorded before `narration` existed makes the whole month unjudgeable. Reporting the
  // partial count as the month's waste would read as reassurance we did not earn.
  const partial = monthTotals([...month, act('old', 5, 0.018813)], '2026-10');
  assert.equal(partial.ticks, 5);
  assert.equal(partial.acts, 5);
  assert.equal(Object.hasOwn(partial, 'unproductiveActs'), false);
  assert.equal(Object.hasOwn(partial, 'unproductiveUsd'), false);
});
