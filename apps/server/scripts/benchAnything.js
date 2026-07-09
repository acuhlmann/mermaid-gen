#!/usr/bin/env node
// benchAnything.js
//
// Offline driver that replays a fixed corpus of Anything-mode HTML documents through
// `validateAndPrepareAnythingPatch` (the full ladder: shape → policy lint → quality
// lint → runtime execution check) and reports:
//   - validity/accept rate and per-layer rejection-code breakdown
//   - runtime-check coverage (how many verdicts actually executed the page)
//   - latency percentiles and document sizes
//
// Usage:
//   node apps/server/scripts/benchAnything.js                 # corpus-only (no LLM)
//   node apps/server/scripts/benchAnything.js --tag before    # tag the JSON snapshot
//   node apps/server/scripts/benchAnything.js --tag after-p3
//
// Output: apps/server/bench-results/<tag>-<isoDate>.json (auditable across phases).
// Exits non-zero when a case's accept/reject outcome (or rejection code) drifts from
// the expectation — a "must stay rejected" page being accepted is a safety regression.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { validateAndPrepareAnythingPatch } from '../src/tools/anythingHtmlTool.js';
import { ANYTHING_BENCH_CORPUS } from './benchAnythingCorpus.js';

// Minimal empty `anything` slot. Deliberately NOT createDiagramStateStore():
// the store drags in the full validator chain (incl. @antv/infographic, which
// needs the ESM layout hook), and the ladder under test only reads
// `currentState.revisionId` here. Keeping the import graph lean lets this
// bench run with plain `node`.
const EMPTY_ANYTHING_STATE = () => ({
  revisionId: 0,
  diagramSource: '',
  styleConfig: null,
  contentType: 'anything',
  updatedAt: new Date().toISOString(),
  history: []
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../');
const OUT_DIR = path.join(REPO_ROOT, 'bench-results');

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
  const args = { tag: 'anything-snapshot' };
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
  console.log(`benchAnything: running ${ANYTHING_BENCH_CORPUS.length} cases (tag=${args.tag})…`);

  const results = [];
  for (const sample of ANYTHING_BENCH_CORPUS) {
    const started = performance.now();
    let outcome;
    try {
      outcome = await validateAndPrepareAnythingPatch({
        currentState: EMPTY_ANYTHING_STATE(),
        proposedDiagramSource: sample.html,
        reason: 'bench'
      });
    } catch (error) {
      outcome = { accepted: false, error: error instanceof Error ? error.message : String(error) };
    }
    const durationMs = performance.now() - started;

    results.push({
      id: sample.id,
      kind: sample.kind,
      expectedAccept: sample.expectedAccept,
      expectedCode: sample.expectedCode ?? null,
      accepted: Boolean(outcome.accepted),
      code: outcome.accepted ? null : (outcome.code ?? null),
      runtimeChecked: outcome.accepted ? Boolean(outcome.metadata?.runtimeChecked) : null,
      warnings: outcome.accepted ? (outcome.metadata?.warnings ?? []) : [],
      error: outcome.accepted ? null : (outcome.error ?? null),
      docSize: sample.html.length,
      durationMs: Math.round(durationMs * 100) / 100
    });
  }

  const acceptCount = results.filter((r) => r.accepted).length;
  const passedAsExpected = results.filter(
    (r) =>
      r.accepted === r.expectedAccept &&
      (r.accepted || r.expectedCode == null || r.code === r.expectedCode)
  ).length;
  const runtimeCases = results.filter((r) => r.kind === 'runtime');
  const runtimeRejected = runtimeCases.filter((r) => !r.accepted).length;
  const runtimeCheckedAccepts = results.filter((r) => r.accepted && r.runtimeChecked).length;
  const latencies = results.map((r) => r.durationMs);
  const docSizes = results.map((r) => r.docSize);

  const summary = {
    tag: args.tag,
    timestamp: new Date().toISOString(),
    totalCases: results.length,
    acceptRate: Math.round((acceptCount / results.length) * 10000) / 100,
    expectationMatch: Math.round((passedAsExpected / results.length) * 10000) / 100,
    // Of the pages that only fail when executed, how many did the ladder stop?
    runtimeCatchRate: runtimeCases.length
      ? Math.round((runtimeRejected / runtimeCases.length) * 10000) / 100
      : null,
    // Accepted pages whose verdict came from actually executing the document
    // (as opposed to the runtime layer being disabled or failing open).
    runtimeCheckedAccepts,
    latency: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      max: Math.round(Math.max(...latencies) * 100) / 100
    },
    docSize: {
      p50: percentile(docSizes, 50),
      max: Math.max(...docSizes)
    },
    codeBreakdown: results.reduce((acc, r) => {
      const key = r.accepted ? 'accepted' : (r.code ?? 'rejected_no_code');
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

  // Exit non-zero when outcomes drift from expectations. An accepted "must stay
  // rejected" case (policy/runtime kinds especially) is a safety regression;
  // a rejected valid case is an over-correction that burns repair turns.
  const regressions = results.filter(
    (r) =>
      r.accepted !== r.expectedAccept ||
      (!r.accepted && r.expectedCode != null && r.code !== r.expectedCode)
  );
  if (regressions.length > 0) {
    console.error(`\n!!! ${regressions.length} regression(s):`);
    for (const r of regressions) {
      console.error(
        `  - ${r.id}: expected accept=${r.expectedAccept}${r.expectedCode ? ` code=${r.expectedCode}` : ''}, ` +
          `got accept=${r.accepted}${r.code ? ` code=${r.code}` : ''}${r.error ? ` (${r.error.slice(0, 120)})` : ''}`
      );
    }
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('benchAnything failed:', error);
  process.exit(1);
});
