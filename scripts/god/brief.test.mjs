import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GodBriefSchema } from '@archislop/shared/godSchemas.js';
import {
  buildBrief,
  main,
  normalizeLogEntry,
  parseLogText,
  percentile,
  wilsonInterval
} from './brief.mjs';

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

test('buildBrief --from-file CLI writes a schema-valid file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'god-brief-'));
  const out = path.join(dir, 'brief.json');
  const brief = main(['--from-file', FIXTURE, '--out', out, '--now', '2026-10-15T07:00:00.000Z']);
  assert.equal(brief.v, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(out, 'utf8')), brief);
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
