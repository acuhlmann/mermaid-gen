#!/usr/bin/env node
// benchMetaphor.js
//
// Offline driver that replays a fixed corpus of Metaphor DSL sources through
// `validateAndPrepareMetaphorPatch` (fence strip → JSON.parse → ~14 deterministic rescue
// passes → Zod discriminated union) and reports:
//   - sanitizer-rescue rate (how many otherwise-rejected sources now pass)
//   - validator outcome counts
//   - latency percentiles
//
// Usage:
//   node apps/server/scripts/benchMetaphor.js                 # corpus-only (no LLM)
//   node apps/server/scripts/benchMetaphor.js --tag before    # tag the JSON snapshot
//
// Output: apps/server/bench-results/<tag>-<isoDate>.json (auditable across phases).
// Exits non-zero when a case's accept/reject outcome drifts from the expectation — a
// "must stay rejected" DSL being accepted is a regression; a valid DSL being rejected
// burns repair turns.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { validateAndPrepareMetaphorPatch } from '../src/tools/metaphorDslTool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../');
const OUT_DIR = path.join(REPO_ROOT, 'bench-results');

const EMPTY_STATE = () => ({ revisionId: 0, diagramSource: '' });

const VALID_CITY = JSON.stringify({
  metaphor: 'city',
  scene: {},
  items: [
    { id: 'auth', label: 'Auth', height: 8, footprint: 2 },
    { id: 'db', label: 'DB', height: 5, footprint: 3 }
  ]
});

const VALID_TREE = JSON.stringify({
  metaphor: 'tree',
  scene: {},
  items: [
    { id: 'ceo', label: 'CEO', weight: 8 },
    { id: 'cto', label: 'CTO', parent: 'ceo', weight: 5 }
  ]
});

const VALID_GALAXY = JSON.stringify({
  metaphor: 'galaxy',
  scene: {},
  items: [{ id: 's1', label: 'S1', magnitude: 3 }]
});

const CORPUS = [
  // ── valid: must stay accepted ──────────────────────────────────────────────
  { id: 'valid-city', source: VALID_CITY, expectedAccept: true },
  { id: 'valid-tree', source: VALID_TREE, expectedAccept: true },
  { id: 'valid-galaxy', source: VALID_GALAXY, expectedAccept: true },
  {
    id: 'fenced-block',
    source: '```json\n' + VALID_CITY + '\n```',
    expectedAccept: true,
    rescueable: true
  },
  // ── mechanical failures the deterministic rescue passes should fix ──────────
  {
    id: 'clamp-position',
    source: JSON.stringify({
      metaphor: 'city',
      items: [{ id: 'a', label: 'A', position: [100, 0, -5] }]
    }),
    expectedAccept: true,
    rescueable: true
  },
  {
    id: 'default-missing-metaphor',
    source: JSON.stringify({ items: [{ id: 'a', label: 'A' }] }),
    expectedAccept: true,
    rescueable: true
  },
  {
    id: 'unknown-kind-defaults-city',
    // allowStructureRewrite defaults an unrecognized metaphor to 'city'.
    source: JSON.stringify({ metaphor: 'spaceship', items: [{ id: 'a', label: 'A' }] }),
    expectedAccept: true,
    rescueable: true
  },
  {
    id: 'drop-orphan-link',
    source: JSON.stringify({
      metaphor: 'city',
      items: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' }
      ],
      links: [{ from: 'a', to: 'ghost' }]
    }),
    expectedAccept: true,
    rescueable: true
  },
  // ── truly broken: must stay rejected ───────────────────────────────────────
  { id: 'empty', source: '', expectedAccept: false },
  { id: 'not-json', source: '{"metaphor":"city","items":[', expectedAccept: false },
  { id: 'array-top-level', source: '["not","an","object"]', expectedAccept: false },
  { id: 'primitive', source: '42', expectedAccept: false },
  {
    id: 'bad-field-type',
    // height must be a number; no rescue pass touches it, so the Zod union fails.
    source: JSON.stringify({ metaphor: 'city', items: [{ id: 'a', label: 'A', height: {} }] }),
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
  const args = { tag: 'metaphor-snapshot' };
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
  console.log(`benchMetaphor: running ${CORPUS.length} cases (tag=${args.tag})…`);

  const results = [];
  for (const sample of CORPUS) {
    const started = performance.now();
    let outcome;
    try {
      outcome = await validateAndPrepareMetaphorPatch({
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
      metaphor: outcome.accepted ? (outcome.metadata?.metaphor ?? null) : null,
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
      console.error(
        `  - ${r.id}: expected accept=${r.expectedAccept}, got accept=${r.accepted}` +
          `${r.error ? ` (${r.error.slice(0, 120)})` : ''}`
      );
    }
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('benchMetaphor failed:', error);
  process.exit(1);
});
