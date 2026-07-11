#!/usr/bin/env node
// benchInfographic.js
//
// Offline driver that replays a fixed corpus of (probably-broken) AntV Infographic DSL
// sources through `validateAndPrepareInfographicPatch` (sanitizer → textual lint →
// parseSyntax) and reports:
//   - sanitizer-rescue rate (how many otherwise-rejected sources now pass)
//   - validator outcome counts
//   - latency percentiles
//
// Usage:
//   node apps/server/scripts/benchInfographic.js                 # corpus-only (no LLM)
//   node apps/server/scripts/benchInfographic.js --tag before    # tag the JSON snapshot
//
// Output: apps/server/bench-results/<tag>-<isoDate>.json (auditable across phases).
// Exits non-zero when a case's accept/reject outcome drifts from the expectation — a
// "must stay rejected" DSL being accepted is a safety regression; a valid case being
// rejected is an over-correction that burns repair turns.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { validateAndPrepareInfographicPatch } from '../src/tools/infographicDslTool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../');
const OUT_DIR = path.join(REPO_ROOT, 'bench-results');

// Minimal empty `infographic` slot. Deliberately NOT createDiagramStateStore(): the
// ladder under test only reads `currentState.revisionId` / `.diagramSource`.
const EMPTY_STATE = () => ({ revisionId: 0, diagramSource: '' });

const VALID_LIST_ROW =
  'infographic list-row-simple-horizontal-arrow\n' +
  'data\n' +
  '  lists\n' +
  '    - label Step 1\n' +
  '      desc Start\n' +
  '    - label Step 2\n' +
  '      desc Build';

const VALID_CHART_PIE =
  'infographic chart-pie-plain-text\n' +
  'data\n' +
  '  items\n' +
  '    - label Apples\n' +
  '      value 10\n' +
  '    - label Pears\n' +
  '      value 7';

const VALID_SEQUENCE =
  'infographic sequence-steps-simple\n' +
  'data\n' +
  '  sequences\n' +
  '    - label Step 1\n' +
  '      desc Start\n' +
  '    - label Step 2\n' +
  '      desc Build';

const CORPUS = [
  // ── valid: must stay accepted ──────────────────────────────────────────────
  { id: 'valid-list-row', source: VALID_LIST_ROW, expectedAccept: true },
  { id: 'valid-chart-pie', source: VALID_CHART_PIE, expectedAccept: true },
  { id: 'valid-sequence', source: VALID_SEQUENCE, expectedAccept: true },
  // ── mechanical failures the sanitizer should rescue ────────────────────────
  {
    id: 'fenced-block',
    source: '```infographic\n' + VALID_LIST_ROW + '\n```',
    expectedAccept: true,
    rescueable: true
  },
  {
    id: 'leading-prose',
    source: 'Sure, here is your infographic:\n' + VALID_LIST_ROW,
    expectedAccept: true,
    rescueable: true
  },
  {
    id: 'stray-open-fence',
    source: '```\n' + VALID_CHART_PIE,
    expectedAccept: true,
    rescueable: true
  },
  // ── truly broken: must stay rejected ───────────────────────────────────────
  { id: 'empty', source: '', expectedAccept: false },
  { id: 'not-a-diagram', source: 'this is not an infographic', expectedAccept: false },
  {
    id: 'unknown-template',
    source: 'infographic list-made-up-template\ndata\n  lists\n    - label A',
    expectedAccept: false
  },
  {
    id: 'multiple-headers',
    source: VALID_LIST_ROW + '\n' + VALID_CHART_PIE,
    expectedAccept: false
  },
  {
    id: 'indented-header',
    source: '  infographic list-row-simple-horizontal-arrow\ndata\n  lists\n    - label A',
    expectedAccept: false
  },
  {
    id: 'bad-structure-unknown-keys',
    source:
      'infographic list-row-simple-horizontal-arrow\n  title Sun\n  content The Sun is a star.',
    expectedAccept: false
  },
  // ── sanitizer-normalized: the smart-quote/tab re-checks are dead branches once the
  //    sanitizer has straightened quotes and detabbed, so these are rescued, not rejected.
  {
    id: 'smart-quotes-rescued',
    source: 'infographic list-row-simple-horizontal-arrow\ndata\n  lists\n    - label “Step”',
    expectedAccept: true,
    rescueable: true
  },
  {
    id: 'tabs-rescued',
    source: 'infographic list-row-simple-horizontal-arrow\ndata\n\tlists\n\t\t- label A',
    expectedAccept: true,
    rescueable: true
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
  const args = { tag: 'infographic-snapshot' };
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
  console.log(`benchInfographic: running ${CORPUS.length} cases (tag=${args.tag})…`);

  const results = [];
  for (const sample of CORPUS) {
    const started = performance.now();
    let outcome;
    try {
      outcome = await validateAndPrepareInfographicPatch({
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
      sanitizerApplied: outcome.metadata?.sanitizerApplied ?? [],
      error: outcome.accepted ? null : (outcome.error ?? null),
      durationMs: Math.round(durationMs * 100) / 100
    });
  }

  const acceptCount = results.filter((r) => r.accepted).length;
  const passedAsExpected = results.filter((r) => r.accepted === r.expectedAccept).length;
  const rescueable = results.filter((r) => r.rescueable);
  const rescueableHits = rescueable.filter((r) => r.accepted).length;
  const latencies = results.map((r) => r.durationMs);

  const summary = {
    tag: args.tag,
    timestamp: new Date().toISOString(),
    totalCases: results.length,
    acceptRate: Math.round((acceptCount / results.length) * 10000) / 100,
    expectationMatch: Math.round((passedAsExpected / results.length) * 10000) / 100,
    sanitizerRescues: results.filter((r) => r.accepted && r.sanitizerApplied.length > 0).length,
    rescueableHitRate: rescueable.length
      ? Math.round((rescueableHits / rescueable.length) * 10000) / 100
      : null,
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
      console.error(`  - ${r.id}: expected accept=${r.expectedAccept}, got accept=${r.accepted}`);
    }
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('benchInfographic failed:', error);
  process.exit(1);
});
