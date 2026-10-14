import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UX_CLIENT_SIGNAL_KINDS,
  UX_SERVER_SIGNAL_KINDS,
  UX_SIGNAL_BATCH_MAX,
  UxClientSignalBatchSchema,
  UxClientSignalSchema,
  UxServerSignalSchema,
  UxSignalSchema,
  bucketUxElapsedMs,
  bucketUxSessionMs,
  clampUxCount,
  classifyUxErrorName
} from '../src/uxSignals.js';
import { ContentTypeSchema } from '../src/diagramSchema.js';

/** One valid example per kind — the round-trip table every kind must appear in. */
const EXAMPLES = {
  retry: { kind: 'retry', contentType: 'mermaid', failureClass: 'syntax_exhausted' },
  restore: { kind: 'restore', contentType: 'chart', entriesBack: 2 },
  autofix: { kind: 'autofix', contentType: 'mermaid', path: 'render_repair', outcome: 'fired' },
  critique_fix: { kind: 'critique_fix', contentType: 'infographic', scope: 'all', itemCount: 4 },
  mode_switch: { kind: 'mode_switch', from: 'mermaid', to: 'anything' },
  run_failed: {
    kind: 'run_failed',
    contentType: 'forms',
    failureClass: 'timeout',
    profile: 'fast'
  },
  run_cancelled: { kind: 'run_cancelled', contentType: 'metaphor3d', after: '30s_2m' },
  run_stop: { kind: 'run_stop', contentType: 'anything' },
  manual_edit_after_agent: {
    kind: 'manual_edit_after_agent',
    contentType: 'mermaid',
    within: 'lt_10s'
  },
  client_error: { kind: 'client_error', source: 'boundary', errorName: 'TypeError' },
  session_summary: {
    kind: 'session_summary',
    duration: '5m_15m',
    runs: 3,
    accepted: 2,
    failed: 1,
    lastRunFailed: true
  },
  render_repair: { kind: 'render_repair', contentType: 'mermaid', outcome: 'repaired' },
  graph_edit: { kind: 'graph_edit', contentType: 'mermaid', afterAgent: true }
} as const;

test('every signal kind has a round-trip example, and every example parses', () => {
  const kinds = [...UX_CLIENT_SIGNAL_KINDS, ...UX_SERVER_SIGNAL_KINDS].sort();
  assert.deepEqual(Object.keys(EXAMPLES).sort(), kinds);
  for (const example of Object.values(EXAMPLES)) {
    const parsed = UxSignalSchema.parse(example);
    assert.deepEqual(parsed, example);
  }
});

test('client and server unions are disjoint, so a browser cannot forge a server signal', () => {
  for (const kind of UX_SERVER_SIGNAL_KINDS) {
    assert.equal(UxClientSignalSchema.safeParse(EXAMPLES[kind]).success, false, kind);
  }
  for (const kind of UX_CLIENT_SIGNAL_KINDS) {
    assert.equal(UxServerSignalSchema.safeParse(EXAMPLES[kind]).success, false, kind);
  }
  const forged = UxClientSignalBatchSchema.safeParse({ v: 1, signals: [EXAMPLES.graph_edit] });
  assert.equal(forged.success, false);
});

test('an unknown key is rejected — free text never rides along on a valid signal', () => {
  for (const example of Object.values(EXAMPLES)) {
    assert.equal(
      UxSignalSchema.safeParse({ ...example, message: 'my secret prompt' }).success,
      false,
      example.kind
    );
  }
});

test('no signal field accepts an arbitrary string', () => {
  // A string-typed field would be a channel for user content. Probe every field of every kind
  // with prose; only enum members may pass, and prose is never one.
  for (const example of Object.values(EXAMPLES)) {
    for (const key of Object.keys(example)) {
      if (key === 'kind') continue;
      const probe = { ...example, [key]: 'please delete the database' };
      assert.equal(UxSignalSchema.safeParse(probe).success, false, `${example.kind}.${key}`);
    }
  }
});

test('content types track the canonical slot enum', () => {
  for (const contentType of ContentTypeSchema.options) {
    assert.equal(UxSignalSchema.safeParse({ ...EXAMPLES.run_stop, contentType }).success, true);
  }
  assert.equal(
    UxSignalSchema.safeParse({ ...EXAMPLES.run_stop, contentType: 'auto' }).success,
    false
  );
});

test('batches are versioned, non-empty and capped', () => {
  const one = { v: 1, signals: [EXAMPLES.retry] };
  assert.equal(UxClientSignalBatchSchema.safeParse(one).success, true);
  assert.equal(UxClientSignalBatchSchema.safeParse({ ...one, v: 2 }).success, false);
  assert.equal(UxClientSignalBatchSchema.safeParse({ v: 1, signals: [] }).success, false);
  const full = { v: 1, signals: Array.from({ length: UX_SIGNAL_BATCH_MAX }, () => EXAMPLES.retry) };
  assert.equal(UxClientSignalBatchSchema.safeParse(full).success, true);
  const over = { v: 1, signals: [...full.signals, EXAMPLES.retry] };
  assert.equal(UxClientSignalBatchSchema.safeParse(over).success, false);
  assert.equal(UxClientSignalBatchSchema.safeParse({ ...one, extra: true }).success, false);
});

test('counters are bounded integers', () => {
  const summary = EXAMPLES.session_summary;
  assert.equal(UxSignalSchema.safeParse({ ...summary, runs: 1001 }).success, false);
  assert.equal(UxSignalSchema.safeParse({ ...summary, runs: -1 }).success, false);
  assert.equal(UxSignalSchema.safeParse({ ...summary, runs: 1.5 }).success, false);
  assert.equal(UxSignalSchema.safeParse({ ...EXAMPLES.restore, entriesBack: 0 }).success, false);
  assert.equal(clampUxCount(5000), 1000);
  assert.equal(clampUxCount(-3), 0);
  assert.equal(clampUxCount(Number.NaN), 0);
  assert.equal(clampUxCount(2.9), 2);
});

test('elapsed and session buckets cover their edges', () => {
  assert.equal(bucketUxElapsedMs(-5), 'lt_10s');
  assert.equal(bucketUxElapsedMs(9_999), 'lt_10s');
  assert.equal(bucketUxElapsedMs(10_000), '10s_30s');
  assert.equal(bucketUxElapsedMs(119_999), '30s_2m');
  assert.equal(bucketUxElapsedMs(600_000), 'gt_10m');
  assert.equal(bucketUxElapsedMs(Number.NaN), 'lt_10s');
  assert.equal(bucketUxSessionMs(59_999), 'lt_1m');
  assert.equal(bucketUxSessionMs(60_000), '1m_5m');
  assert.equal(bucketUxSessionMs(3_600_000), 'gt_60m');
});

test('classifyUxErrorName keeps the constructor name and drops the message', () => {
  assert.equal(classifyUxErrorName(new TypeError('contains a user prompt')), 'TypeError');
  assert.equal(classifyUxErrorName(new RangeError('x')), 'RangeError');
  assert.equal(classifyUxErrorName(new Error('x')), 'Error');
  assert.equal(classifyUxErrorName({ name: 'QuotaExceededError' }), 'other');
  assert.equal(classifyUxErrorName('a thrown string'), 'other');
  assert.equal(classifyUxErrorName(null), 'other');
});
