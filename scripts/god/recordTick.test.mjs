import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GodRunRecordSchema } from '@archislop/shared/godSchemas.js';
import { buildActRecord, buildTickRecord, main, verdictForStop } from './recordTick.mjs';

test('buildTickRecord validates a noop tick', () => {
  const record = buildTickRecord({
    'run-id': '12345',
    reason: 'disabled',
    tier: 'observe',
    focus: 'any',
    go: 'false',
    trigger: 'schedule',
    now: '2026-10-15T07:17:00.000Z'
  });
  assert.equal(record.verdict, 'noop');
  assert.deepEqual(GodRunRecordSchema.parse(record), record);
});

test('main writes a skip tick unless a verdict override or a harness report says otherwise', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'god-tick-'));
  const skipped = main([
    '--out-dir',
    dir,
    '--run-id',
    '999',
    '--go',
    'true',
    '--verdict',
    'blocked',
    '--reason',
    'tier_not_observe',
    '--tier',
    'propose',
    '--now',
    '2026-10-15T07:17:00.000Z'
  ]);
  assert.equal(skipped.record.verdict, 'blocked');
  assert.equal(skipped.record.usage.usd, 0);
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index', '2026-10.json'), 'utf8'));
  assert.equal(index.runs[0].usd, 0);
  assert.equal(index.runs[0].startedAt, '2026-10-15T07:17:00.000Z');

  const report = {
    v: 1,
    runId: 'act-1',
    tier: 'observe',
    focus: 'mermaid',
    harness: { name: 'mock', version: '1.0.0' },
    startedAt: '2026-10-15T07:00:00.000Z',
    endedAt: '2026-10-15T07:05:00.000Z',
    minutes: 5,
    stopReason: 'completed',
    usage: {
      calls: 2,
      inputTokens: 10,
      outputTokens: 4,
      cacheHitTokens: 0,
      usd: 0.2,
      models: ['x']
    }
  };
  const events = path.join(dir, 'events.ndjson');
  fs.writeFileSync(
    events,
    `${JSON.stringify({ type: 'text', text: 'finding:mermaid.accept_rate Accept rate fell.' })}\n${JSON.stringify({ type: 'final', text: 'Done.' })}\n`
  );
  const reportPath = path.join(dir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report));
  const acted = main([
    '--out-dir',
    dir,
    '--from-report',
    reportPath,
    '--events',
    events,
    '--reason',
    'go',
    '--trigger',
    'manual'
  ]);
  assert.equal(acted.record.verdict, 'observed');
  assert.equal(acted.record.trigger, 'manual');
  assert.equal(acted.record.findingId, 'mermaid.accept_rate');
  assert.equal(acted.record.hypothesis, 'Accept rate fell.');
  assert.equal(acted.record.usage.usd, 0.2);
  assert.equal(GodRunRecordSchema.parse(acted.record).usage.usd, 0.2);
  const again = JSON.parse(fs.readFileSync(path.join(dir, 'index', '2026-10.json'), 'utf8'));
  assert.equal(again.runs.at(-1).usd, 0.2);
});

test('a published propose run records the PR; a refused diff is red', () => {
  const report = {
    runId: 'act-3',
    tier: 'propose',
    focus: 'mermaid',
    harness: { name: 'dsh', version: '0.2.0-rc.2' },
    startedAt: '2026-10-15T07:00:00.000Z',
    endedAt: '2026-10-15T07:20:00.000Z',
    minutes: 20,
    stopReason: 'completed',
    usage: { calls: 3, inputTokens: 10, outputTokens: 8, cacheHitTokens: 0, usd: 0.4 }
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'god-pr-record-'));
  const reportPath = path.join(dir, 'report.json');
  const events = path.join(dir, 'events.ndjson');
  const files = path.join(dir, 'files.txt');
  fs.writeFileSync(reportPath, JSON.stringify(report));
  fs.writeFileSync(
    events,
    `${JSON.stringify({ type: 'text', text: 'finding:mermaid.accept_rate Accept rate fell.' })}\n`
  );
  fs.writeFileSync(files, 'apps/server/src/prompts/mermaidSyntaxGuard.js\ngod-run/brief.json\n');
  const opened = main([
    '--out-dir',
    dir,
    '--from-report',
    reportPath,
    '--events',
    events,
    '--files-from',
    files,
    '--pr',
    '812',
    '--branch',
    'god/act-3',
    '--reason',
    'go'
  ]);
  assert.equal(opened.record.verdict, 'pr_opened');
  assert.equal(opened.record.pr, 812);
  assert.equal(opened.record.branch, 'god/act-3');
  assert.deepEqual(opened.record.filesChanged, ['apps/server/src/prompts/mermaidSyntaxGuard.js']);

  const refused = main([
    '--out-dir',
    dir,
    '--from-report',
    reportPath,
    '--events',
    events,
    '--files-from',
    files,
    '--verify',
    'postflight',
    '--run-id',
    'unused',
    '--reason',
    'go'
  ]);
  assert.equal(refused.record.verdict, 'red');
  assert.equal(refused.record.pr, null);
});

test('verdictForStop maps a completed observe run and a budget halt', () => {
  assert.equal(verdictForStop('completed'), 'observed');
  assert.equal(verdictForStop('budget'), 'stopped');
  assert.equal(verdictForStop('error'), 'failed');
  const dropped = buildActRecord({
    report: {
      runId: 'act-2',
      tier: 'observe',
      focus: 'any',
      harness: { name: 'dsh', version: '0.2.0-rc.2' },
      startedAt: '2026-10-15T07:00:00.000Z',
      endedAt: '2026-10-15T07:01:00.000Z',
      minutes: 1,
      stopReason: 'completed',
      usage: { calls: 1, inputTokens: 1, outputTokens: 1, cacheHitTokens: 0, usd: 0.05 }
    },
    narration: 'not the contract',
    trigger: 'schedule'
  });
  assert.equal(dropped.findingId, null);
  assert.equal(dropped.hypothesis, null);
});
