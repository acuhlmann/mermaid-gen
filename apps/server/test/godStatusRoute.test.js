import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createGodStatusRouter } from '../src/routes/godStatus.js';
import {
  GOD_LOG_DEFAULT_BRANCH,
  GOD_LOG_DEFAULT_REPO,
  getGodStatusView,
  godRollupUrl,
  recentMonthLabels,
  resetGodStatusCache,
  resolveGodLogSource,
  summarizeGodLog
} from '../src/god/godLogView.js';

const NOW = Date.parse('2026-10-17T07:17:00.000Z');
const MONTH = '2026-10';
const PREV = '2026-09';
const ENV = { GOD_LOG_REPO: GOD_LOG_DEFAULT_REPO, GOD_LOG_BRANCH: GOD_LOG_DEFAULT_BRANCH };

function row(runId, startedAt, extra = {}) {
  return {
    runId,
    startedAt,
    endedAt: startedAt,
    verdict: 'noop',
    tier: 'propose',
    usd: 0,
    ...extra
  };
}

function rollup(month, rows, totals) {
  return totals ? { v: 1, month, totals, runs: rows } : { v: 1, month, runs: rows };
}

/** Stub of the raw branch: exact URL → body; a missing key answers 404 like a month with no file. */
function stubFetch(bodies, { fail = false } = {}) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    if (fail) throw new Error('network down');
    const body = Object.hasOwn(bodies, url) ? bodies[url] : undefined;
    if (body === undefined) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => body };
  };
  return { calls, impl };
}

function urlFor(month) {
  return godRollupUrl({ repo: GOD_LOG_DEFAULT_REPO, branch: GOD_LOG_DEFAULT_BRANCH }, month);
}

async function bootRouter(options = {}) {
  const app = express();
  app.use('/api/god', createGodStatusRouter(options));
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({
        port,
        close: () =>
          new Promise((done) => {
            server.closeAllConnections?.();
            server.close(() => done());
          })
      });
    });
  });
}

test.afterEach(() => resetGodStatusCache());

test('the branch is read from defaults with no new configuration', () => {
  assert.deepEqual(resolveGodLogSource({}), {
    repo: GOD_LOG_DEFAULT_REPO,
    branch: GOD_LOG_DEFAULT_BRANCH
  });
  assert.equal(
    urlFor(MONTH),
    `https://raw.githubusercontent.com/${GOD_LOG_DEFAULT_REPO}/${GOD_LOG_DEFAULT_BRANCH}/index/${MONTH}.json`
  );
});

test('a malformed repo or branch is refused, never interpolated into a URL', () => {
  for (const env of [
    { GOD_LOG_REPO: 'acuhlmann/mermaid-gen ../../etc' },
    { GOD_LOG_REPO: 'https://evil.example/owner/repo' },
    { GOD_LOG_BRANCH: 'god-log?ref=other' }
  ]) {
    assert.equal(resolveGodLogSource(env), null);
  }

  const probe = stubFetch({});
  return getGodStatusView({
    env: { GOD_LOG_REPO: 'bad slug!' },
    fetchImpl: probe.impl,
    nowMs: () => NOW
  }).then((view) => {
    assert.deepEqual(view.issues, ['source_invalid']);
    assert.equal(view.source, 'none');
    assert.equal(probe.calls.length, 0, 'nothing may be fetched for an unvalidated source');
  });
});

test('the months read are the current and previous UTC month, across the year boundary', () => {
  assert.deepEqual(recentMonthLabels(Date.parse('2026-10-17T07:17:00Z')), ['2026-10', '2026-09']);
  assert.deepEqual(recentMonthLabels(Date.parse('2026-01-01T00:30:00Z')), ['2026-01', '2025-12']);
});

test('a live month answers what happened, why it stopped, and how close it was', async () => {
  const digest = { agentTurns: 2, uxSignals: 3, sessions: 2, findings: 0, sufficient: false };
  const probe = stubFetch({
    [urlFor(MONTH)]: rollup(
      MONTH,
      [
        row('t1', '2026-10-16T06:17:00.000Z', { gateReason: 'insufficient', digest }),
        row('t2', '2026-10-17T06:17:00.000Z', { gateReason: 'insufficient', digest }),
        row('t3', '2026-10-17T07:17:00.000Z', { gateReason: 'outside_window' })
      ],
      { ticks: 3, acts: 0, monthSpendUsd: 0, lastActAt: null }
    ),
    [urlFor(PREV)]: rollup(
      PREV,
      [row('s1', '2026-09-30T06:17:00.000Z', { verdict: 'pr_opened', usd: 0.42 })],
      { ticks: 1, acts: 1, monthSpendUsd: 0.42, lastActAt: '2026-09-30T06:17:00.000Z' }
    )
  });

  const view = await getGodStatusView({ env: ENV, fetchImpl: probe.impl, nowMs: () => NOW });

  assert.equal(view.source, 'live');
  assert.deepEqual(view.issues, []);
  assert.equal(view.numbersFrom, 'records');
  // Only the newest month counts toward the monthly cap.
  assert.equal(view.ticks, 3);
  assert.equal(view.acts, 0);
  assert.equal(view.monthSpendUsd, 0);
  assert.equal(view.lastTick.runId, 't3');
  assert.equal(view.lastTick.gateReason, 'outside_window');
  // The act was last month, so it still answers "has God ever done anything?"
  assert.equal(view.lastActAt, '2026-09-30T06:17:00.000Z');
  assert.deepEqual(view.reasonTally, [
    { reason: 'insufficient', count: 2 },
    { reason: 'outside_window', count: 1 }
  ]);
  assert.equal(view.recent.length, 4);
  assert.deepEqual(view.recent[0].digest, undefined);
  assert.equal(probe.calls.length, 2, 'one fetch per month');
});

test('the stamped totals beat the rows that survived a truncated rollup', async () => {
  // The October 2026 case, and the reason the stamp exists: the rollup rows were rewritten down to
  // one row, while 54 records say the month really ran 54 ticks and billed $0.018813. A view that
  // counts rows would report a month 54x too small, money included, and look perfectly healthy.
  const truncated = rollup(
    MONTH,
    [row('t54', '2026-10-17T07:31:08.037Z', { gateReason: 'insufficient' })],
    {
      ticks: 54,
      acts: 1,
      monthSpendUsd: 0.018813,
      lastActAt: '2026-10-15T15:22:19.545Z'
    }
  );
  const view = await getGodStatusView({
    env: ENV,
    fetchImpl: stubFetch({ [urlFor(MONTH)]: truncated }).impl,
    nowMs: () => NOW
  });
  assert.equal(view.numbersFrom, 'records');
  assert.equal(view.ticks, 54);
  assert.equal(view.acts, 1);
  assert.equal(view.monthSpendUsd, 0.018813);
  assert.equal(view.lastActAt, '2026-10-15T15:22:19.545Z');
  assert.deepEqual(view.issues, []);
});

test('an unstamped rollup reports what it can and says the numbers are only rows', async () => {
  // A month file written before the fold stamped totals: fall back to counting rows, but never
  // present that count as the month. This is the state a live pre-fix branch is in today.
  const unstamped = rollup(MONTH, [row('t1', '2026-10-16T06:17:00.000Z')]);
  const view = await getGodStatusView({
    env: ENV,
    fetchImpl: stubFetch({ [urlFor(MONTH)]: unstamped }).impl,
    nowMs: () => NOW
  });
  assert.equal(view.numbersFrom, 'rollupRows');
  assert.equal(view.ticks, 1);
  assert.deepEqual(view.issues, ['rollup_totals_missing']);
});

test('a month with no file is an empty month, not a failure', async () => {
  const probe = stubFetch({});
  const view = await getGodStatusView({ env: ENV, fetchImpl: probe.impl, nowMs: () => NOW });
  assert.equal(view.source, 'live');
  assert.equal(view.ticks, 0);
  assert.equal(view.lastTick, null);
  assert.equal(view.lastActAt, null);
  assert.deepEqual(view.issues, []);
});

test('the spend column is the number GOD_MAX_USD_PER_MONTH is measured against', async () => {
  const probe = stubFetch({
    [urlFor(MONTH)]: rollup(
      MONTH,
      [
        row('a', '2026-10-01T06:17:00.000Z', { verdict: 'observed', usd: 0.35 }),
        row('b', '2026-10-02T06:17:00.000Z', { verdict: 'red', usd: 0.65 }),
        row('c', '2026-10-03T06:17:00.000Z', { usd: 9 })
      ],
      {
        ticks: 3,
        acts: 2,
        monthSpendUsd: 10,
        lastActAt: '2026-10-02T06:17:00.000Z'
      }
    )
  });
  const view = await getGodStatusView({ env: ENV, fetchImpl: probe.impl, nowMs: () => NOW });
  assert.equal(view.monthSpendUsd, 10);
  assert.equal(view.acts, 2);
  assert.equal(view.lastActAt, '2026-10-02T06:17:00.000Z', 'a noop tick is not an act');
});

test('a corrupt rollup is reported, not rendered as a short month', async () => {
  const probe = stubFetch({ [urlFor(MONTH)]: { v: 1, month: MONTH, runs: 'not an array' } });
  const view = await getGodStatusView({ env: ENV, fetchImpl: probe.impl, nowMs: () => NOW });
  assert.deepEqual(view.issues, ['rollup_unreadable']);
  assert.equal(view.source, 'live', 'the file was read; only its contents are unusable');
});

test('one bad row costs that row, not the month', async () => {
  const probe = stubFetch({
    [urlFor(MONTH)]: {
      v: 1,
      month: MONTH,
      runs: [row('ok', '2026-10-05T06:17:00.000Z'), { runId: 'bad', verdict: 'nonsense' }]
    }
  });
  const view = await getGodStatusView({ env: ENV, fetchImpl: probe.impl, nowMs: () => NOW });
  assert.deepEqual(view.issues, ['rollup_rows_dropped', 'rollup_totals_missing']);
  assert.equal(view.ticks, 1);
  assert.equal(view.lastTick.runId, 'ok');
});

test('GitHub being down keeps the last good answer and says it is old', async () => {
  const good = stubFetch({
    [urlFor(MONTH)]: rollup(MONTH, [row('g', '2026-10-16T06:17:00.000Z')], {
      ticks: 1,
      acts: 0,
      monthSpendUsd: 0,
      lastActAt: null
    })
  });
  const first = await getGodStatusView({ env: ENV, fetchImpl: good.impl, nowMs: () => NOW });
  assert.equal(first.source, 'live');

  const broken = stubFetch({}, { fail: true });
  const second = await getGodStatusView({
    env: ENV,
    fetchImpl: broken.impl,
    nowMs: () => NOW + 6 * 60_000 // past the TTL, so a refresh is attempted
  });
  assert.equal(second.source, 'stale');
  assert.deepEqual(second.issues, ['fetch_failed']);
  assert.equal(second.ticks, 1, 'the numbers survive the outage');
});

test('a total failure is retried no sooner than the backoff', async () => {
  const broken = stubFetch({}, { fail: true });
  const view = await getGodStatusView({ env: ENV, fetchImpl: broken.impl, nowMs: () => NOW });
  assert.equal(view.source, 'none');
  assert.equal(broken.calls.length, 2, 'both months attempted once');

  const again = await getGodStatusView({
    env: ENV,
    fetchImpl: broken.impl,
    nowMs: () => NOW + 1000
  });
  assert.equal(again.source, 'none');
  assert.equal(broken.calls.length, 2, 'the backoff swallowed the retry');
});

test('a refresh inside the TTL does not touch the network again', async () => {
  const probe = stubFetch({
    [urlFor(MONTH)]: rollup(MONTH, [row('c', '2026-10-16T06:17:00.000Z')])
  });
  await getGodStatusView({ env: ENV, fetchImpl: probe.impl, nowMs: () => NOW });
  await getGodStatusView({ env: ENV, fetchImpl: probe.impl, nowMs: () => NOW + 60_000 });
  assert.equal(probe.calls.length, 2);
});

test('summarizeGodLog labels a tick that recorded no reason', () => {
  const view = summarizeGodLog({
    generatedAt: '2026-10-17T07:17:00.000Z',
    source: 'live',
    repo: GOD_LOG_DEFAULT_REPO,
    branch: GOD_LOG_DEFAULT_BRANCH,
    months: [MONTH, PREV],
    reads: [
      { month: MONTH, rows: [row('u', '2026-10-16T06:17:00.000Z')], missing: false, issues: [] }
    ]
  });
  assert.deepEqual(view.reasonTally, [{ reason: 'unlabelled', count: 1 }]);
});

test('GET /api/god/status answers the owner and never caches an answer about money', async () => {
  const view = await getGodStatusView({
    env: ENV,
    fetchImpl: stubFetch({ [urlFor(MONTH)]: rollup(MONTH, [row('r', '2026-10-16T06:17:00.000Z')]) })
      .impl,
    nowMs: () => NOW
  });
  const booted = await bootRouter({ load: async () => view });
  const res = await fetch(`http://localhost:${booted.port}/api/god/status`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.equal(body.v, 1);
  assert.equal(body.lastTick.runId, 'r');
  await booted.close();
});

test('an unreadable branch is a 503, not a confident zero', async () => {
  const booted = await bootRouter({
    load: async () =>
      getGodStatusView({
        env: ENV,
        fetchImpl: stubFetch({}, { fail: true }).impl,
        nowMs: () => NOW
      })
  });
  const res = await fetch(`http://localhost:${booted.port}/api/god/status`);
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.deepEqual(body.issues, ['fetch_failed']);
  await booted.close();
});

test('a loader that throws answers 503 without leaking error text', async () => {
  const booted = await bootRouter({
    load: async () => {
      throw new Error('boom');
    }
  });
  const res = await fetch(`http://localhost:${booted.port}/api/god/status`);
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.source, 'none');
  assert.equal(Object.hasOwn(body, 'stack'), false);
  assert.equal(Object.hasOwn(body, 'message'), false, 'no error text for a public repo to log');
  await booted.close();
});

test('the view names what the last act did with the contract', async () => {
  const probe = stubFetch({
    [urlFor(MONTH)]: rollup(
      MONTH,
      [
        row('a1', '2026-10-15T15:22:19.545Z', {
          verdict: 'observed',
          usd: 0.018813,
          narration: 'dropped'
        })
      ],
      {
        ticks: 54,
        acts: 1,
        monthSpendUsd: 0.018813,
        unproductiveActs: 1,
        unproductiveUsd: 0.018813,
        lastActAt: '2026-10-15T15:22:19.545Z'
      }
    )
  });
  const view = await getGodStatusView({ env: ENV, fetchImpl: probe.impl, nowMs: () => NOW });
  assert.equal(view.lastActNarration, 'dropped');
  assert.equal(view.unproductiveActs, 1);
  assert.equal(view.unproductiveUsd, 0.018813);
  // The month's entire bill was one run that named nothing and changed nothing. Now visible as money.
  assert.equal(view.monthSpendUsd, view.unproductiveUsd);
});

test('a month that predates the outcome field reports null, never a reassuring zero', async () => {
  // A stamp written before `narration` existed: waste was never measured, so the view must not answer
  // 0 — that would read as "nothing was wasted" precisely where nothing is known.
  const probe = stubFetch({
    [urlFor(MONTH)]: rollup(
      MONTH,
      [row('old', '2026-10-15T15:22:19.545Z', { verdict: 'observed', usd: 0.018813 })],
      {
        ticks: 54,
        acts: 1,
        monthSpendUsd: 0.018813,
        lastActAt: '2026-10-15T15:22:19.545Z'
      }
    )
  });
  const view = await getGodStatusView({ env: ENV, fetchImpl: probe.impl, nowMs: () => NOW });
  assert.equal(view.unproductiveActs, null);
  assert.equal(view.unproductiveUsd, null);
  assert.equal(view.lastActNarration, null);
  assert.equal(view.monthSpendUsd, 0.018813, 'the spend is known; only the verdict on it is not');
});
