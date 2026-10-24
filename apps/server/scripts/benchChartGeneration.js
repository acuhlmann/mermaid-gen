#!/usr/bin/env node
// benchChartGeneration.js
//
// END-TO-END generation bench for chart mode. Sends real prompts through the real chart
// agent, once per authoring arm, and measures what comes back:
//   - first-pass accept rate (the model got it right with no repair)
//   - final accept rate and which mechanism won (first try / syntax fixer / repair turn N)
//   - output tokens and wall time per case
//   - what the model wrote vs what the slot stored (Flint compiles small specs to large ones)
//
// Arms: `vegalite` (CHART_AUTHORING=vegalite, the model writes Vega-Lite) and `flint`
// (the default, the model writes Flint and the server compiles it). The arm only picks the
// agent's prompt — the validator understands both — so each arm gets its own env object
// and both run in one process without sharing state.
//
// This is deliberately NOT benchChart.js, which replays fixed specs through the gate
// and measures the gate. This one measures the model.
//
// !!! THIS SPENDS REAL TOKENS AND IS NOT PART OF `npm test`. !!!
//
// Usage (both --import flags, same reason as benchAnythingGeneration.js):
//   node --import ./scripts/register-antv-layout-esm.mjs --import tsx \
//     apps/server/scripts/benchChartGeneration.js --tag flint-trial --samples 3
//
//   … --arms vegalite,flint   # default: both
//   … --only heatmap,german   # restrict to case ids or families
//   … --concurrency 4         # parallel cases (default 4)
//   … --profile quality       # first-pass model profile
//
// ALWAYS pass --samples 3 or more for numbers you will compare (see CLAUDE.md on
// nondeterminism in the anything generation bench). Accepted documents are recorded so
// they can be rendered and judged afterwards — an accept rate alone says nothing about
// whether the chart is any good.
//
// Output: apps/server/bench-results/<tag>-<isoDate>.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { applyPatch } from '@archislop/shared';
import { createChartLangChainAgent } from '../src/agents/chartLangChainAgent.js';
import { isLlmConfigured } from '../src/agents/llmProvider.js';
import { validateAndPrepareChartPatch } from '../src/tools/chartDslTool.js';
import { CHART_GENERATION_CORPUS } from './benchChartGenerationCorpus.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(path.resolve(__dirname, '../'), 'bench-results');

const ARM_ENV = {
  vegalite: { CHART_AUTHORING: 'vegalite' },
  flint: { CHART_AUTHORING: 'flint' }
};

/** A chart-only store mirroring `applyToChartSlot`, which also records every attempt. */
function createBenchChartStore() {
  let slot = {
    revisionId: 0,
    diagramSource: '',
    styleConfig: null,
    contentType: 'chart',
    updatedAt: new Date().toISOString(),
    history: []
  };
  const attempts = [];

  return {
    getSlot() {
      return slot;
    },
    async applyDiagramSource({ diagramSource, reason, origin }) {
      const prepared = await validateAndPrepareChartPatch({
        currentState: slot,
        proposedDiagramSource: diagramSource,
        reason: reason ?? 'bench'
      });
      attempts.push({
        accepted: Boolean(prepared.accepted),
        error: prepared.accepted ? null : String(prepared.error ?? '').slice(0, 400),
        validator: prepared.accepted ? (prepared.metadata?.validator ?? null) : null,
        authoredBytes: typeof diagramSource === 'string' ? diagramSource.length : 0,
        authoredSource: typeof diagramSource === 'string' ? diagramSource : ''
      });
      if (!prepared.accepted) return prepared;
      const patch = origin ? { ...prepared.patch, origin } : prepared.patch;
      const applied = applyPatch(slot, patch);
      if (!applied.accepted) return applied;
      slot = applied.state;
      return { accepted: true, patch, state: applied.state, metadata: prepared.metadata };
    },
    attempts,
    get currentSource() {
      return slot.diagramSource;
    }
  };
}

function createCapture() {
  let outputTokens = 0;
  let inputTokens = 0;
  let modelCalls = 0;
  let fixer = null;
  return {
    emit(event) {
      if (!event || typeof event !== 'object') return;
      if (event.type === 'model_call_end') {
        outputTokens += Number(event.outputTokens) || 0;
        inputTokens += Number(event.inputTokens) || 0;
        modelCalls += 1;
      } else if (event.type === 'syntax_fixer_result') {
        fixer = event.outcome ?? null;
      }
    },
    summary: () => ({ inputTokens, outputTokens, modelCalls, fixer })
  };
}

function resolveOutcome(attempts, fixer) {
  const index = attempts.findIndex((a) => a.accepted);
  if (index === -1) return 'failed';
  if (index === 0) return 'first-try';
  if (fixer === 'repaired') return 'syntax-fixer';
  return `repair-attempt-${index}`;
}

function classifyFailure({ accepted, attempts, message, threw }) {
  if (accepted) return null;
  const text = `${message ?? ''} ${threw ?? ''}`.toLowerCase();
  if (/terminated|aborted|socket|econnreset|fetch failed|network|timeout/.test(text)) {
    return 'transport';
  }
  if (attempts.length > 0) return 'validation';
  return 'no-patch';
}

async function runCase({ arm, sample, sampleIndex, profile }) {
  const env = { ...process.env, ...ARM_ENV[arm] };
  const store = createBenchChartStore();
  const capture = createCapture();
  const agent = createChartLangChainAgent({ stateStore: store, env });

  const started = performance.now();
  let result = null;
  let threw = null;
  try {
    result = await agent.applyIntent({
      prompt: sample.prompt,
      modelProfile: profile,
      emit: capture.emit
    });
  } catch (error) {
    threw = error instanceof Error ? error.message : String(error);
  }
  const wallMs = Math.round(performance.now() - started);

  const { attempts } = store;
  const accepted = attempts.some((a) => a.accepted);
  const usage = capture.summary();
  const acceptedAttempt = attempts.find((a) => a.accepted) ?? null;
  return {
    arm,
    id: sample.id,
    family: sample.family,
    sample: sampleIndex,
    firstPass: attempts[0]?.accepted === true,
    accepted,
    outcome: resolveOutcome(attempts, usage.fixer),
    failureKind: classifyFailure({ accepted, attempts, message: result?.message, threw }),
    // A rejection code names the rung, not the cause — keep what the model wrote.
    attempts: attempts.map(({ authoredSource, ...rest }) =>
      rest.accepted ? rest : { ...rest, authoredSource }
    ),
    wallMs,
    ...usage,
    authoredBytes: acceptedAttempt?.authoredBytes ?? null,
    storedBytes: accepted ? store.currentSource.length : null,
    // Kept for rendering and judging afterwards; the accept rate cannot say if it is good.
    authoredSource: acceptedAttempt?.authoredSource ?? attempts.at(-1)?.authoredSource ?? null,
    finalSource: accepted ? store.currentSource : null
  };
}

async function runPool(jobs, concurrency, onDone) {
  const results = [];
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++];
      const row = await job();
      results.push(row);
      onDone(row);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return results;
}

const pct = (n, d) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);
const median = (xs) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

function summarizeArm(rows) {
  const counted = rows.filter((r) => r.failureKind !== 'transport');
  const outcomes = {};
  for (const r of rows) outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;
  return {
    runs: rows.length,
    transportFailures: rows.length - counted.length,
    firstPassAcceptRate: pct(counted.filter((r) => r.firstPass).length, counted.length),
    finalAcceptRate: pct(counted.filter((r) => r.accepted).length, counted.length),
    outcomes,
    // Transport failures are excluded from the rates, so from the medians beside them too.
    medianOutputTokens: median(counted.map((r) => r.outputTokens)),
    medianWallMs: median(counted.map((r) => r.wallMs)),
    medianAuthoredBytes: median(rows.filter((r) => r.authoredBytes).map((r) => r.authoredBytes)),
    medianStoredBytes: median(rows.filter((r) => r.storedBytes).map((r) => r.storedBytes)),
    firstErrors: rows
      .filter((r) => !r.firstPass && r.attempts[0]?.error)
      .map((r) => `${r.id}#${r.sample}: ${r.attempts[0].error.slice(0, 160)}`)
  };
}

function parseArgs(argv) {
  const args = {
    tag: 'chart-generation',
    samples: 1,
    profile: 'fast',
    only: null,
    arms: ['vegalite', 'flint'],
    concurrency: 4
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const v = argv[i + 1];
    if (a === '--tag') args.tag = v ?? args.tag;
    else if (a === '--samples') args.samples = Math.max(1, Number.parseInt(v, 10) || 1);
    else if (a === '--profile') args.profile = v === 'quality' ? 'quality' : 'fast';
    else if (a === '--concurrency') args.concurrency = Math.max(1, Number.parseInt(v, 10) || 1);
    else if (a === '--only')
      args.only = String(v ?? '')
        .split(',')
        .filter(Boolean);
    else if (a === '--arms')
      args.arms = String(v ?? '')
        .split(',')
        .filter((x) => x in ARM_ENV);
    else continue;
    i += 1;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!isLlmConfigured(process.env)) {
    console.error('No LLM backend configured — see docs/llm-config.md.');
    process.exit(2);
  }
  const cases = CHART_GENERATION_CORPUS.filter(
    (c) => !args.only || args.only.includes(c.id) || args.only.includes(c.family)
  );

  // Interleave arms so a slow patch of the backend lands on both, not on one.
  const jobs = [];
  for (let s = 0; s < args.samples; s += 1) {
    for (const sample of cases) {
      for (const arm of args.arms) {
        jobs.push(() => runCase({ arm, sample, sampleIndex: s, profile: args.profile }));
      }
    }
  }

  if (jobs.length === 0) {
    console.error('chart generation bench: --only / --arms selected no runs; nothing to measure.');
    process.exitCode = 2;
    return;
  }

  console.log(`chart generation bench: ${jobs.length} runs, arms=${args.arms.join(',')}`);
  const rows = await runPool(jobs, args.concurrency, (r) =>
    console.log(
      `  ${r.arm.padEnd(8)} ${r.id.padEnd(18)} #${r.sample} ${r.outcome.padEnd(18)} ${r.wallMs} ms ${r.outputTokens} out-tok`
    )
  );

  const summary = Object.fromEntries(
    args.arms.map((arm) => [arm, summarizeArm(rows.filter((r) => r.arm === arm))])
  );
  const report = {
    tag: args.tag,
    timestamp: new Date().toISOString(),
    profile: args.profile,
    samples: args.samples,
    cases: cases.map((c) => c.id),
    summary,
    rows
  };

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${args.tag}-${report.timestamp.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);

  for (const [arm, s] of Object.entries(summary)) {
    console.log(
      `\n${arm}: first-pass ${s.firstPassAcceptRate}%  final ${s.finalAcceptRate}%  ` +
        `median ${s.medianOutputTokens} out-tok, ${s.medianWallMs} ms, ` +
        `authored ${s.medianAuthoredBytes} B → stored ${s.medianStoredBytes} B  ` +
        `(transport ${s.transportFailures})`
    );
    console.log(`  outcomes ${JSON.stringify(s.outcomes)}`);
  }
  console.log(`\nwrote ${path.relative(process.cwd(), file)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
