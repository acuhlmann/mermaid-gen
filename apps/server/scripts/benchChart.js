#!/usr/bin/env node
// benchChart.js
//
// Offline driver that replays a fixed corpus of chart DSL sources through
// `validateAndPrepareChartPatch` (JSON.parse → Zod wrapper → vega-lite compile()) and
// reports validator outcome counts and latency percentiles. There is no sanitizer layer
// by design (CLAUDE.md) — compile() errors are precise — so this bench has no rescue metric.
//
// Usage:
//   node apps/server/scripts/benchChart.js                 # corpus-only (no LLM)
//   node apps/server/scripts/benchChart.js --tag before    # tag the JSON snapshot
//
// Output: apps/server/bench-results/<tag>-<isoDate>.json (auditable across phases).
// Exits non-zero when a case's accept/reject outcome drifts from the expectation — a
// "must stay rejected" spec being accepted is a regression; a valid spec being rejected
// burns repair turns.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { validateAndPrepareChartPatch } from '../src/tools/chartDslTool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../');
const OUT_DIR = path.join(REPO_ROOT, 'bench-results');

const EMPTY_STATE = () => ({ revisionId: 0, diagramSource: '' });

const wrap = (spec, theme = 'whiteboard') =>
  JSON.stringify({ archislopVersion: 1, theme, spec });

const BAR_SPEC = {
  data: { values: [{ q: 'Q1', rev: 100 }, { q: 'Q2', rev: 140 }] },
  mark: 'bar',
  encoding: { x: { field: 'q', type: 'ordinal' }, y: { field: 'rev', type: 'quantitative' } }
};

const LINE_SPEC = {
  data: { values: [{ t: 1, v: 3 }, { t: 2, v: 5 }, { t: 3, v: 4 }] },
  mark: 'line',
  encoding: { x: { field: 't', type: 'quantitative' }, y: { field: 'v', type: 'quantitative' } }
};

const CORPUS = [
  // ── valid: must stay accepted ──────────────────────────────────────────────
  { id: 'valid-bar', source: wrap(BAR_SPEC), expectedAccept: true },
  { id: 'valid-line', source: wrap(LINE_SPEC), expectedAccept: true },
  { id: 'valid-noir-theme', source: wrap(BAR_SPEC, 'noir'), expectedAccept: true },
  {
    id: 'fenced-block',
    source: '```json\n' + wrap(BAR_SPEC) + '\n```',
    expectedAccept: true,
    rescueable: true
  },
  {
    id: 'missing-version-defaulted',
    // archislopVersion defaults to 1 — omitting it is still valid.
    source: JSON.stringify({ theme: 'whiteboard', spec: BAR_SPEC }),
    expectedAccept: true
  },
  // ── truly broken: must stay rejected ───────────────────────────────────────
  { id: 'empty', source: '', expectedAccept: false },
  { id: 'not-json', source: '{not valid json', expectedAccept: false },
  { id: 'array-top-level', source: '["not","an","object"]', expectedAccept: false },
  {
    id: 'empty-spec',
    source: JSON.stringify({ archislopVersion: 1, theme: 'whiteboard', spec: {} }),
    expectedAccept: false
  },
  {
    id: 'missing-spec',
    source: JSON.stringify({ archislopVersion: 1, theme: 'whiteboard' }),
    expectedAccept: false
  },
  {
    id: 'invalid-theme',
    // Theme enum only defaults when undefined; an unknown value fails the wrapper.
    source: wrap(BAR_SPEC, 'rainbow'),
    expectedAccept: false
  },
  {
    id: 'uncompilable-mark',
    source: wrap({
      data: { values: [{ a: 1 }] },
      mark: 'notarealmark',
      encoding: { x: { field: 'a', type: 'quantitative' } }
    }),
    expectedAccept: false
  },
  {
    id: 'bad-encoding-type',
    source: wrap({
      data: { values: [{ a: 1 }] },
      mark: 'bar',
      encoding: { x: { field: 'a', type: 'notatype' } }
    }),
    expectedAccept: false
  }
];

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return Math.round(sorted[idx] * 100) / 100;
}

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function parseArgs(argv) {
  const args = { tag: 'chart-snapshot' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--tag' || a === '-t') {
      args.tag = argv[i + 1] ?? args.tag;
      i += 1;
    }
  }
  return args;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`benchChart: running ${CORPUS.length} cases (tag=${args.tag})…`);

  const results = [];
  for (const sample of CORPUS) {
    const started = performance.now();
    let outcome;
    try {
      outcome = await validateAndPrepareChartPatch({
        currentState: EMPTY_STATE(),
        proposedDiagramSource: sample.source,
        reason: 'bench'
      });
    } catch (error) {
      outcome = { accepted: false, error: error instanceof Error ? error.message : String(error) };
    }
    const durationMs = performance.now() - started;

    results.push({
      id: sample.id,
      expectedAccept: sample.expectedAccept,
      rescueable: Boolean(sample.rescueable),
      accepted: Boolean(outcome.accepted),
      validator: outcome.metadata?.validator ?? null,
      error: outcome.accepted ? null : (outcome.error ?? null),
      durationMs: Math.round(durationMs * 100) / 100
    });
  }

  const acceptCount = results.filter((r) => r.accepted).length;
  const passedAsExpected = results.filter((r) => r.accepted === r.expectedAccept).length;
  const latencies = results.map((r) => r.durationMs);

  const summary = {
    tag: args.tag,
    timestamp: new Date().toISOString(),
    totalCases: results.length,
    acceptRate: Math.round((acceptCount / results.length) * 10000) / 100,
    expectationMatch: Math.round((passedAsExpected / results.length) * 10000) / 100,
    latency: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      max: Math.round(Math.max(...latencies) * 100) / 100
    },
    validatorBreakdown: results.reduce((acc, r) => {
      const key = r.validator ?? 'rejected';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {})
  };

  ensureOutDir();
  const filename = `${args.tag}-${summary.timestamp.replace(/[:.]/g, '-')}.json`;
  const filepath = path.join(OUT_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify({ summary, results }, null, 2));

  console.log('\n=== Summary ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nSnapshot written to: ${path.relative(REPO_ROOT, filepath)}`);

  const regressions = results.filter((r) => r.accepted !== r.expectedAccept);
  if (regressions.length > 0) {
    console.error(`\n!!! ${regressions.length} regression(s):`);
    for (const r of regressions) {
      console.error(
        `  - ${r.id}: expected accept=${r.expectedAccept}, got accept=${r.accepted}` +
          `${r.error ? ` (${r.error.slice(0, 120)})` : ''}`
      );
    }
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('benchChart failed:', error);
  process.exit(1);
});
