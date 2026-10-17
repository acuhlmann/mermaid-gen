import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildTickRecord } from './recordTick.mjs';
import {
  deriveCadence,
  mergeGodLogTick,
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
