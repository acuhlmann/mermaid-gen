import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GodBriefSchema } from '@archislop/shared/godSchemas.js';
import {
  buildBrief,
  deriveLastGodMerge,
  main,
  normalizeLogEntry,
  parseLogText,
  percentile,
  wilsonInterval
} from './brief.mjs';
import { buildTickRecord } from './recordTick.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, 'fixtures', 'log-lines.ndjson');

test('wilsonInterval stays inside [0,1] and widens for small n', () => {
  const tiny = wilsonInterval(1, 2);
  const big = wilsonInterval(80, 100);
  assert.ok(tiny.lower >= 0 && tiny.upper <= 1);
  assert.ok(big.upper - big.lower < tiny.upper - tiny.lower);
});

test('percentile returns null on empty and a real value otherwise', () => {
  assert.equal(percentile([], 0.5), null);
  assert.equal(percentile([10, 20, 30], 0.5), 20);
});

test('normalizeLogEntry accepts Cloud Logging wrappers and bare lines', () => {
  const bare = normalizeLogEntry({
    tag: 'agent_turn',
    ts: '2026-10-14T12:00:00.000Z',
    sha: 'abcdef1234567890',
    contentType: 'mermaid',
    accepted: true
  });
  assert.equal(bare?.tag, 'agent_turn');
  assert.equal(bare?.sha, 'abcdef123456');

  const wrapped = normalizeLogEntry({
    timestamp: '2026-10-14T12:00:00.000Z',
    jsonPayload: {
      tag: 'ux_signal',
      ts: '2026-10-14T12:00:00.000Z',
      kind: 'run_stop',
      contentType: 'chart'
    }
  });
  assert.equal(wrapped?.tag, 'ux_signal');
  assert.equal(normalizeLogEntry({ tag: 'other', ts: '2026-10-14T12:00:00.000Z' }), null);
});

test('buildBrief from the fixture validates and stays below the signal floor', () => {
  const lines = parseLogText(fs.readFileSync(FIXTURE, 'utf8'));
  const brief = buildBrief({
    lines,
    now: Date.parse('2026-10-15T07:00:00.000Z'),
    windowMs: 24 * 3_600_000,
    baselineMs: 7 * 24 * 3_600_000,
    confounders: 1
  });
  assert.equal(GodBriefSchema.safeParse(brief).success, true);
  assert.equal(brief.sufficient, false);
  assert.ok(brief.volume.agentTurns >= 4);
  assert.ok(brief.slots.some((s) => s.contentType === 'mermaid'));
  assert.equal(brief.clientErrors[0]?.errorName, 'TypeError');
});

test('buildBrief --from-file CLI writes a schema-valid file and an array history', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'god-brief-'));
  const out = path.join(dir, 'brief.json');
  const history = path.join(dir, 'history.json');
  const brief = main([
    '--from-file',
    FIXTURE,
    '--out',
    out,
    '--history-out',
    history,
    '--now',
    '2026-10-15T07:00:00.000Z'
  ]);
  assert.equal(brief.v, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(out, 'utf8')), brief);
  assert.deepEqual(JSON.parse(fs.readFileSync(history, 'utf8')), []);
});

test('a clear accept-rate drop surfaces as a finding', () => {
  /** @type {ReturnType<typeof normalizeLogEntry>[]} */
  const lines = [];
  const pushTurn = (ts, accepted, sha = 'dddddddddddd') => {
    lines.push(
      normalizeLogEntry({
        tag: 'agent_turn',
        ts,
        sha,
        contentType: 'mermaid',
        accepted,
        durationMs: 10000,
        repairAttempts: 0,
        errorClass: null
      })
    );
  };
  // Baseline week: 30/30 accepted
  for (let i = 0; i < 30; i++) {
    pushTurn(`2026-10-07T10:${String(i).padStart(2, '0')}:00.000Z`, true, 'cccccccccccc');
  }
  // Window: 18/30 accepted
  for (let i = 0; i < 18; i++) {
    pushTurn(`2026-10-14T10:${String(i).padStart(2, '0')}:00.000Z`, true);
  }
  for (let i = 18; i < 30; i++) {
    pushTurn(`2026-10-14T11:${String(i).padStart(2, '0')}:00.000Z`, false);
  }

  const brief = buildBrief({
    lines: lines.filter(Boolean),
    now: Date.parse('2026-10-15T07:00:00.000Z'),
    confounders: 1
  });
  assert.ok(brief.findings.some((f) => f.id === 'mermaid.accept_rate'));
  assert.equal(brief.regressionSuspect, null, 'confounders block revert-first');
});

const NOW = Date.parse('2026-10-15T07:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();

/**
 * A slot that is healthy in the baseline week and sick in the last 24 h on every funnel at
 * once: same accept rate, but retries, failures, manual edits, render repairs, repair attempts
 * and latency all worsen — plus a product-wide bounce and client-error rise.
 */
function sickProductLines() {
  /** @type {ReturnType<typeof normalizeLogEntry>[]} */
  const lines = [];
  const baseStart = Date.parse('2026-10-08T08:00:00.000Z');
  const winStart = Date.parse('2026-10-14T08:00:00.000Z');
  const turn = (start, i, accepted, repairAttempts, durationMs, sha) =>
    lines.push(
      normalizeLogEntry({
        tag: 'agent_turn',
        ts: iso(start + i * 60_000),
        sha,
        contentType: 'mermaid',
        accepted,
        durationMs,
        repairAttempts,
        errorClass: accepted ? null : 'parser-rejected'
      })
    );
  const ux = (start, i, payload) =>
    lines.push(
      normalizeLogEntry({
        tag: 'ux_signal',
        ts: iso(start + i * 60_000),
        sha: 'eeeeeeeeeeee',
        ...payload
      })
    );
  for (let i = 0; i < 100; i++) turn(baseStart, i, i < 95, 0, 10_000, 'cccccccccccc');
  for (let i = 0; i < 100; i++) turn(winStart, i, i < 95, 2, 20_000, 'eeeeeeeeeeee');
  for (let i = 0; i < 20; i++) {
    ux(winStart, i, { kind: 'retry', contentType: 'mermaid', failureClass: 'syntax_exhausted' });
    ux(winStart, i, {
      kind: 'run_failed',
      contentType: 'mermaid',
      failureClass: 'generic',
      profile: 'fast'
    });
    ux(winStart, i, { kind: 'render_repair', contentType: 'mermaid', outcome: 'failed' });
    ux(baseStart, i, { kind: 'render_repair', contentType: 'mermaid', outcome: 'repaired' });
  }
  for (let i = 0; i < 5; i++) {
    ux(winStart, i, { kind: 'render_repair', contentType: 'mermaid', outcome: 'repaired' });
    ux(baseStart, i, { kind: 'render_repair', contentType: 'mermaid', outcome: 'failed' });
  }
  for (let i = 0; i < 30; i++) {
    ux(winStart, i, { kind: 'manual_edit_after_agent', contentType: 'mermaid', within: 'lt_10s' });
  }
  for (let i = 0; i < 50; i++) {
    ux(baseStart, i, {
      kind: 'session_summary',
      duration: '5m_15m',
      runs: 2,
      accepted: 2,
      failed: 0,
      lastRunFailed: false
    });
    ux(winStart, i, {
      kind: 'session_summary',
      duration: 'lt_1m',
      runs: i < 25 ? 0 : 2,
      accepted: 2,
      failed: 0,
      lastRunFailed: false
    });
  }
  for (let i = 0; i < 30; i++) {
    ux(winStart, i, { kind: 'client_error', source: 'window', errorName: 'TypeError' });
  }
  for (let i = 0; i < 5; i++) {
    ux(baseStart, i, { kind: 'client_error', source: 'window', errorName: 'TypeError' });
  }
  return lines.filter(Boolean);
}

test('worsening beyond accept rate surfaces as findings for every metric', () => {
  const brief = buildBrief({ lines: sickProductLines(), now: NOW });
  assert.equal(GodBriefSchema.safeParse(brief).success, true);
  const ids = brief.findings.map((f) => f.id);
  for (const id of [
    'mermaid.retry_rate',
    'mermaid.failure_rate',
    'mermaid.manual_edit_rate',
    'mermaid.render_repair_failure_rate',
    'mermaid.repair_attempts_avg',
    'mermaid.turn_duration_p90_ms',
    'global.client_error_count',
    'global.session_bounce_rate'
  ]) {
    assert.ok(ids.includes(id), `expected finding ${id}, got ${ids.join(', ')}`);
  }
  assert.equal(
    ids.includes('mermaid.accept_rate'),
    false,
    'accept rate did not move, so it must not be a finding'
  );
  const retry = brief.findings.find((f) => f.id === 'mermaid.retry_rate');
  assert.equal(retry?.value, 0.2);
  assert.equal(retry?.baseline, 0);
  assert.equal(retry?.sample, 100);
});

test('small samples stay quiet even when the rate collapses', () => {
  /** @type {ReturnType<typeof normalizeLogEntry>[]} */
  const lines = [];
  for (let i = 0; i < 10; i++) {
    lines.push(
      normalizeLogEntry({
        tag: 'agent_turn',
        ts: iso(Date.parse('2026-10-08T08:00:00.000Z') + i * 60_000),
        sha: 'cccccccccccc',
        contentType: 'mermaid',
        accepted: true,
        durationMs: 1000,
        repairAttempts: 0,
        errorClass: null
      }),
      normalizeLogEntry({
        tag: 'agent_turn',
        ts: iso(Date.parse('2026-10-14T08:00:00.000Z') + i * 60_000),
        sha: 'eeeeeeeeeeee',
        contentType: 'mermaid',
        accepted: false,
        durationMs: 1000,
        repairAttempts: 0,
        errorClass: 'other'
      })
    );
  }
  const brief = buildBrief({ lines: lines.filter(Boolean), now: NOW });
  assert.deepEqual(brief.findings, []);
});

test('a finding God acted on recently is halved, not re-picked at full weight', () => {
  const lines = sickProductLines();
  const fresh = buildBrief({ lines, now: NOW });
  const before = fresh.findings.find((f) => f.id === 'mermaid.retry_rate');
  const acted = buildBrief({
    lines,
    now: NOW,
    history: [
      {
        findingId: 'mermaid.retry_rate',
        verdict: 'pr_opened',
        endedAt: '2026-10-14T12:00:00.000Z',
        pr: 7
      },
      {
        findingId: 'mermaid.failure_rate',
        verdict: 'pr_opened',
        endedAt: '2026-09-01T12:00:00.000Z',
        pr: 3
      }
    ]
  });
  const after = acted.findings.find((f) => f.id === 'mermaid.retry_rate');
  const stale = acted.findings.find((f) => f.id === 'mermaid.failure_rate');
  const freshFailure = fresh.findings.find((f) => f.id === 'mermaid.failure_rate');
  assert.ok(before && after && stale && freshFailure);
  assert.equal(after.severity, Math.round(before.severity * 0.5 * 1000) / 1000);
  assert.equal(stale.severity, freshFailure.severity, 'a month-old action no longer deprioritises');
});

test('deriveLastGodMerge pairs the last opened God PR with the next deploy', () => {
  const deploys = [
    { sha: 'aaaaaaaaaaaa', firstSeen: '2026-10-14T08:00:00.000Z' },
    { sha: 'bbbbbbbbbbbb', firstSeen: '2026-10-14T20:00:00.000Z' }
  ];
  assert.deepEqual(
    deriveLastGodMerge(
      [{ verdict: 'pr_opened', pr: 42, endedAt: '2026-10-14T09:00:00.000Z', findingId: 'x' }],
      deploys
    ),
    { pr: 42, mergeSha: 'bbbbbbbbbbbb', firstSeen: '2026-10-14T20:00:00.000Z', confounders: 0 }
  );
  assert.equal(
    deriveLastGodMerge(
      [{ verdict: 'observed', pr: null, endedAt: '2026-10-14T09:00:00.000Z' }],
      deploys
    ),
    null
  );
  assert.equal(deriveLastGodMerge(null, deploys), null);
});

test('regressionSuspect can fire from god-log history alone', () => {
  /** @type {ReturnType<typeof normalizeLogEntry>[]} */
  const lines = [];
  const push = (start, i, accepted, sha) =>
    lines.push(
      normalizeLogEntry({
        tag: 'agent_turn',
        ts: iso(start + i * 60_000),
        sha,
        contentType: 'mermaid',
        accepted,
        durationMs: 10_000,
        repairAttempts: 0,
        errorClass: accepted ? null : 'parser-rejected'
      })
    );
  for (let i = 0; i < 100; i++)
    push(Date.parse('2026-10-08T08:00:00.000Z'), i, true, 'cccccccccccc');
  for (let i = 0; i < 100; i++) {
    push(Date.parse('2026-10-14T08:00:00.000Z'), i, i < 50, 'eeeeeeeeeeee');
  }
  const brief = buildBrief({
    lines: lines.filter(Boolean),
    now: NOW,
    history: [
      {
        findingId: 'mermaid.accept_rate',
        verdict: 'pr_opened',
        pr: 42,
        endedAt: '2026-10-14T06:00:00.000Z'
      }
    ]
  });
  assert.equal(brief.regressionSuspect?.pr, 42);
  assert.equal(brief.regressionSuspect?.mergeSha, 'eeeeeeeeeeee');
  assert.equal(brief.regressionSuspect?.confounders, 0);
});

test('brief CLI --history validates, strips hypotheses, and feeds history-out', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'god-brief-history-'));
  const record = buildTickRecord({
    'run-id': 'h9',
    tier: 'propose',
    focus: 'any',
    trigger: 'schedule',
    now: '2026-10-14T12:00:00.000Z'
  });
  record.verdict = 'pr_opened';
  record.pr = 9;
  record.findingId = 'mermaid.accept_rate';
  record.hypothesis = 'Owner-only sentence.';
  const historyIn = path.join(dir, 'in.json');
  fs.writeFileSync(historyIn, `${JSON.stringify([record])}\n`);
  const out = path.join(dir, 'brief.json');
  const historyOut = path.join(dir, 'history.json');
  main([
    '--from-file',
    FIXTURE,
    '--out',
    out,
    '--history',
    historyIn,
    '--history-out',
    historyOut,
    '--now',
    '2026-10-15T07:00:00.000Z'
  ]);
  const written = JSON.parse(fs.readFileSync(historyOut, 'utf8'));
  assert.equal(written.length, 1);
  assert.equal(written[0].hypothesis, null);
  assert.equal(written[0].findingId, 'mermaid.accept_rate');
});
