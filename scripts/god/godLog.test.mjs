import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildTickRecord } from './recordTick.mjs';
import { promptSafeHistory, readGodLogState, writeGodLogOutputs } from './godLog.mjs';

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

test('readGodLogState uses the last act and this month of index spend', () => {
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
