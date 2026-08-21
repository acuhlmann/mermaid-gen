#!/usr/bin/env node
// benchMermaid.js
//
// Offline driver that replays a fixed corpus of (probably-broken) Mermaid sources through
// `validateAndPreparePatch` and reports:
//   - sanitizer-rescue rate (how many otherwise-rejected diagrams now pass)
//   - validator outcome counts
//   - latency percentiles
//
// Usage (note both --import flags; see "Why two loaders" below):
//   node --import ./scripts/register-antv-layout-esm.mjs --import tsx \
//     apps/server/scripts/benchMermaid.js                 # corpus-only (no LLM)
//
//   … --tag before                # tag the JSON snapshot
//   … --tag after-p1
//
// Why two loaders, when benchInfographic/benchChart/benchMetaphor/benchAnything all run
// under bare `node`: this bench's subject, `../src/tools/mermaidDiffTool.js`, imports
// `../utils/redactSecrets.js` and `../mcp/diagramDiffSummary.js`, both of which exist only
// as `.ts` (the plain TS-specifier convention Vite/tsx resolve and bare `node` does not) —
// hence `--import tsx`. Its graph also reaches `@antv/infographic`, which needs the ESM
// layout shim — hence `--import ./scripts/register-antv-layout-esm.mjs`. Neither flag is
// removable by trimming this file's own imports: both requirements live below
// `mermaidDiffTool.js`, not in the bench. (issue #349)
//
// Output: apps/server/bench-results/<tag>-<isoDate>.json (auditable across phases).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { validateAndPreparePatch } from '../src/tools/mermaidDiffTool.js';
import { createDiagramStateStore } from '../src/state/diagramStateStore.js';
import { ensureMermaidInitialized } from '../src/agents/mermaidReliabilitySkill.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../');
const OUT_DIR = path.join(REPO_ROOT, 'bench-results');

const CORPUS = [
  // Valid baselines — must stay accepted.
  { id: 'valid-flowchart', source: 'flowchart TD\n  A --> B\n  B --> C', expectedAccept: true },
  {
    id: 'valid-sequence',
    source: 'sequenceDiagram\n  Alice->>Bob: hi\n  Bob-->>Alice: ok',
    expectedAccept: true
  },
  {
    id: 'valid-state',
    source: 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Running',
    expectedAccept: true
  },
  // Mechanical failures — Phase 1 sanitizer should rescue these.
  {
    id: 'smart-quotes',
    source: 'flowchart TD\n  A[“Hello”] --> B',
    expectedAccept: true,
    rescueable: true
  },
  {
    id: 'parens-label',
    source: 'flowchart TD\n  A[user (admin)] --> B[guest (anon)]',
    expectedAccept: true,
    rescueable: true
  },
  {
    id: 'slash-label',
    source: 'flowchart TD\n  A[and/or] --> B[then/else]',
    expectedAccept: true,
    rescueable: true
  },
  {
    id: 'edge-pipe-colon',
    source: 'flowchart TD\n  A -->|key: value| B',
    expectedAccept: true,
    rescueable: true
  },
  {
    id: 'flow-chart-typo',
    source: 'flow chart TD\n  A --> B',
    expectedAccept: true,
    rescueable: true
  },
  {
    id: 'flowchart-case',
    source: 'FLOWCHART TD\n  A --> B',
    expectedAccept: true,
    rescueable: true
  },
  {
    id: 'state-v2-promotion',
    source: 'stateDiagram\n  [*] --> Idle\n  Idle --> Running',
    expectedAccept: true,
    rescueable: true
  },
  {
    id: 'init-single-quotes',
    source: "flowchart TD\n%%{init: {'theme':'dark'}}%%\nA --> B",
    expectedAccept: true,
    rescueable: true
  },
  {
    id: 'init-trailing-comma',
    source: '%%{init: {"theme":"dark",}}%%\nflowchart TD\n  A --> B',
    expectedAccept: true,
    rescueable: true
  },
  {
    id: 'unbalanced-subgraph',
    source: 'flowchart TD\n  subgraph Cluster\n    A --> B\n',
    expectedAccept: true,
    rescueable: true
  },
  {
    id: 'reserved-id-end',
    source: 'flowchart TD\n  Start --> end[Done]\n  end --> Final',
    expectedAccept: true,
    rescueable: true
  },
  // Truly broken — must stay rejected (sanity that we're not over-correcting).
  { id: 'not-a-diagram', source: 'this is not a diagram', expectedAccept: false },
  { id: 'empty', source: '', expectedAccept: false }
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
  const args = { tag: 'snapshot' };
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
  console.log(`benchMermaid: running ${CORPUS.length} cases (tag=${args.tag})…`);
  await ensureMermaidInitialized();

  const results = [];
  for (const sample of CORPUS) {
    const stateStore = createDiagramStateStore();
    const started = performance.now();
    let outcome;
    try {
      outcome = await validateAndPreparePatch({
        currentState: stateStore.getState(),
        proposedMermaidSource: sample.source,
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
  const rescueAccepts = results.filter(
    (r) => r.accepted && r.validator === 'sanitizer-rescue'
  ).length;
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
    sanitizerRescues: rescueAccepts,
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

  // Exit non-zero when a "must stay rejected" case was incorrectly accepted, or a valid case
  // was rejected. Useful for CI gating.
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
  console.error('benchMermaid failed:', error);
  process.exit(1);
});
