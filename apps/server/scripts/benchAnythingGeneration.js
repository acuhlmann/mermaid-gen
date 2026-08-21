#!/usr/bin/env node
// benchAnythingGeneration.js
//
// END-TO-END generation bench for Anything mode. Sends real prompts through the
// real agent and measures what comes back:
//   - first-pass accept rate (the headline: how often the model gets it right
//     with no repair at all)
//   - which ladder rung bites first, by rejection code
//   - repair convergence: do successive attempts fix the failure, or reshuffle it
//   - what mechanism finally won (first try / syntax fixer / repair turn N)
//   - optionally, what a REAL BROWSER would have said about the pages the ladder
//     accepted (--browser)
//
// This is deliberately NOT benchAnything.js. That one replays 23 hand-written
// documents through the validator and asks whether the gate still classifies
// them as declared — a regression suite for the ladder. It cannot say anything
// about generation quality, because no LLM is involved. This one is the
// opposite: the corpus is prompts, the model is real, and the numbers describe
// the agent rather than the gate.
//
// !!! THIS SPENDS REAL TOKENS AND IS NOT PART OF `npm test`. !!!
// It needs an LLM backend configured the same way the app resolves one
// (see docs/llm-config.md). Budget one full generation per case, plus repair
// turns — expect single-digit minutes for the default corpus.
//
// Usage (note both --import flags; see "Why two loaders" below):
//   node --import ./scripts/register-antv-layout-esm.mjs --import tsx \
//     apps/server/scripts/benchAnythingGeneration.js --tag baseline
//
//   … --browser                   # also run the real-browser observer
//   … --only canvas,layout        # restrict to families or case ids
//   … --samples 3                 # repeat each case N times (SEE BELOW)
//   … --profile quality           # first-pass model profile (repairs always force quality)
//
// ALWAYS pass --samples 3 or more for a baseline you will compare against.
// Two consecutive single-sample runs of the same 12 cases measured first-pass
// accept rates of 66.7% and 91.7% — a 25-point swing from nondeterminism alone.
// One sample is a smoke test, not a measurement.
//
// Add `--env-file=.env` if your key lives in a dotfile rather than the shell.
//
// Why two loaders: the agent's import graph reaches TypeScript leaves behind
// `.js` specifiers (e.g. utils/redactSecrets.js -> .ts), so it needs `tsx`; and
// it transitively reaches `@antv/infographic`, whose `{ DagreLayout }` import
// only resolves through the repo's ESM layout hook. This is the same pair the
// workspace test runners use (scripts/run-server-tests.mjs).
//
// Output: apps/server/bench-results/<tag>-<isoDate>.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { applyPatch } from '@archislop/shared';
import { expandAnythingLibs } from '@archislop/shared/anythingLibVendor.js';
import { createAnythingLangChainAgent } from '../src/agents/anythingLangChainAgent.js';
import { isLlmConfigured } from '../src/agents/llmProvider.js';
import { validateAndPrepareAnythingPatch } from '../src/tools/anythingHtmlTool.js';
import { ANYTHING_GENERATION_CORPUS } from './benchAnythingGenerationCorpus.js';
import {
  findingSeverity,
  resolveBrowserBinary,
  runAnythingBrowserProbe
} from './anythingBrowserProbe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../');
const OUT_DIR = path.join(REPO_ROOT, 'bench-results');

// ───────────────────────────── bench-local store ─────────────────────────────

/**
 * A minimal `anything`-only state store, mirroring `applyToAnythingSlot` in
 * apps/server/src/state/diagramStateStore.ts. Two reasons this is hand-rolled
 * rather than reusing `createDiagramStateStore()`, and both matter:
 *
 * 1. That store is TypeScript and eagerly imports every validator including
 *    `@antv/infographic`, which needs the ESM layout hook — so importing it
 *    would drag this bench onto `--import tsx --import register-antv-layout-esm`.
 *    benchAnything.js documents avoiding the same thing.
 *
 * 2. More importantly, it is the ONLY place the rejection `code` is observable.
 *    `ToolApplyResultSchema`'s rejected branch is a non-passthrough
 *    `z.object({ accepted, error })` (packages/shared/src/diagramSchema.ts), so
 *    `code` is stripped before the verdict reaches the tool result, the model,
 *    or any emitted event. Here we see the validator's own return value first,
 *    which is what makes the per-rung histogram possible with zero production
 *    changes.
 *
 * The agent only ever calls `getSlot` and `applyDiagramSource` (verified across
 * diagramTools.js, invokePatchAgentWithRepair.js and anythingLangChainAgent.js).
 */
function createBenchAnythingStore() {
  let slot = {
    revisionId: 0,
    diagramSource: '',
    styleConfig: null,
    contentType: 'anything',
    updatedAt: new Date().toISOString(),
    history: []
  };

  /** Every validation the agent triggered, in order — the attempt trail. */
  const attempts = [];

  return {
    getSlot() {
      return slot;
    },

    async applyDiagramSource({ diagramSource, reason, origin }) {
      const started = performance.now();
      const prepared = await validateAndPrepareAnythingPatch({
        currentState: slot,
        proposedDiagramSource: diagramSource,
        reason: reason ?? 'bench'
      });
      const durationMs = performance.now() - started;

      attempts.push({
        accepted: Boolean(prepared.accepted),
        // The whole reason this store exists — see the note above.
        code: prepared.accepted ? null : (prepared.code ?? null),
        error: prepared.accepted ? null : (prepared.error ?? null),
        source: typeof diagramSource === 'string' ? diagramSource : '',
        docSize: typeof diagramSource === 'string' ? diagramSource.length : 0,
        libs: prepared.accepted ? (prepared.metadata?.libs ?? []) : [],
        runtimeChecked: prepared.accepted ? Boolean(prepared.metadata?.runtimeChecked) : null,
        warnings: prepared.accepted ? (prepared.metadata?.warnings ?? []) : [],
        validationMs: Math.round(durationMs * 100) / 100
      });

      if (!prepared.accepted) return prepared;

      const patchWithOrigin = origin ? { ...prepared.patch, origin } : prepared.patch;
      const applied = applyPatch(slot, patchWithOrigin);
      if (!applied.accepted) return applied;
      slot = applied.state;

      return {
        accepted: true,
        patch: patchWithOrigin,
        state: applied.state,
        metadata: prepared.metadata
      };
    },

    attempts,
    get currentSource() {
      return slot.diagramSource;
    },
    get revisionId() {
      return slot.revisionId;
    }
  };
}

// ─────────────────────────────── event capture ───────────────────────────────

/**
 * Capture the agent's emitted events and fold them into the few facts the bench
 * needs. Phase ids delimit attempts (`anything_invoke`, then `anything_repair_N`),
 * and the syntax-fixer telemetry is a one-shot side channel.
 */
function createCapture() {
  const events = [];
  let phase = 'anything_invoke';
  const tokensByPhase = new Map();
  let fixer = null;

  const bump = (key, field, n) => {
    const cur = tokensByPhase.get(key) ?? { inputTokens: 0, outputTokens: 0, calls: 0 };
    cur[field] += n;
    tokensByPhase.set(key, cur);
  };

  return {
    events,
    emit(event) {
      if (!event || typeof event !== 'object') return;
      events.push(event);

      if (event.type === 'phase' && typeof event.id === 'string') {
        phase = event.id;
        return;
      }
      if (event.type === 'model_call_end') {
        bump(phase, 'inputTokens', Number(event.inputTokens) || 0);
        bump(phase, 'outputTokens', Number(event.outputTokens) || 0);
        bump(phase, 'calls', 1);
        return;
      }
      if (event.type === 'syntax_fixer_start') {
        fixer = { triggerError: event.triggerError ?? null, outcome: null };
        return;
      }
      if (event.type === 'syntax_fixer_result') {
        fixer = { ...(fixer ?? {}), outcome: event.outcome ?? null, detail: event.detail ?? null };
      }
    },
    summarize() {
      const phases = [...tokensByPhase.entries()].map(([id, t]) => ({ id, ...t }));
      return {
        phases,
        totalTokens: phases.reduce(
          (acc, p) => ({
            inputTokens: acc.inputTokens + p.inputTokens,
            outputTokens: acc.outputTokens + p.outputTokens
          }),
          { inputTokens: 0, outputTokens: 0 }
        ),
        modelCalls: phases.reduce((n, p) => n + p.calls, 0),
        fixer,
        // The tool names the agent actually reached for — full rewrite vs edit.
        toolsUsed: [...new Set(events.filter((e) => e.type === 'tool_start').map((e) => e.name))]
      };
    }
  };
}

// ──────────────────────────────── helpers ────────────────────────────────────

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return Math.round(sorted[idx] * 100) / 100;
}

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

/** Count occurrences of `keyFn(item)` across `items`. */
function histogram(items, keyFn) {
  const out = {};
  for (const item of items) {
    const key = keyFn(item);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function parseArgs(argv) {
  const args = {
    tag: 'anything-generation',
    browser: false,
    samples: 1,
    profile: 'fast',
    only: null
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--tag' || a === '-t') {
      args.tag = argv[i + 1] ?? args.tag;
      i += 1;
    } else if (a === '--browser') {
      args.browser = true;
    } else if (a === '--samples') {
      args.samples = Math.max(1, Number.parseInt(argv[i + 1] ?? '1', 10) || 1);
      i += 1;
    } else if (a === '--profile') {
      args.profile = argv[i + 1] === 'quality' ? 'quality' : 'fast';
      i += 1;
    } else if (a === '--only') {
      args.only = String(argv[i + 1] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      i += 1;
    }
  }
  return args;
}

/** Which mechanism produced the accepted document, from the attempt trail + telemetry. */
function resolveOutcome({ attempts, capture, accepted }) {
  if (!accepted) return 'failed';
  if (capture.fixer?.outcome === 'repaired') return 'syntax-fixer';
  const acceptedIndex = attempts.findIndex((a) => a.accepted);
  if (acceptedIndex === 0) return 'first-try';
  if (acceptedIndex > 0) return `repair-attempt-${acceptedIndex}`;
  return 'accepted-unknown';
}

/**
 * Did repair make progress, or just move the failure around? A run whose codes
 * go `script_syntax → script_syntax → script_syntax` is thrashing; one that goes
 * `runtime_error → accepted` converged. Reported per run so the aggregate can
 * distinguish "repair works" from "repair burns turns".
 */
function describeConvergence(attempts) {
  const codes = attempts.map((a) => (a.accepted ? 'accepted' : (a.code ?? 'unknown')));
  if (codes.length <= 1)
    return { codes, verdict: codes[0] === 'accepted' ? 'no-repair-needed' : 'single-failure' };
  const failures = codes.filter((c) => c !== 'accepted');
  const distinct = new Set(failures);
  if (codes[codes.length - 1] === 'accepted') {
    return { codes, verdict: 'converged' };
  }
  return {
    codes,
    verdict: distinct.size === 1 ? 'stuck-same-code' : 'reshuffled'
  };
}

// ──────────────────────────────── one case ───────────────────────────────────

async function runCase(sample, { profile, browser, browserBin }) {
  const store = createBenchAnythingStore();
  const capture = createCapture();
  const agent = createAnythingLangChainAgent({ stateStore: store, env: process.env });

  const started = performance.now();
  let seedError = null;

  // Refine cases need an existing document before the measured prompt runs.
  // The seed's own attempts are dropped from the trail so they don't pollute
  // the numbers for the edit under test.
  if (sample.seedPrompt) {
    try {
      await agent.applyIntent({
        prompt: sample.seedPrompt,
        modelProfile: profile,
        emit: () => {}
      });
    } catch (error) {
      seedError = error instanceof Error ? error.message : String(error);
    }
    store.attempts.length = 0;
  }

  const seeded = store.revisionId > 0;
  let result;
  let threw = null;
  const measureStart = performance.now();
  try {
    if (sample.transformMode) {
      if (!seeded) {
        threw = 'Refine case did not seed a document before transform';
      } else {
        result = await agent.applyTransformIntent({
          mode: sample.transformMode,
          modelProfile: profile,
          emit: capture.emit,
          advisorPrompt: sample.prompt
        });
      }
    } else {
      result = await agent.applyIntent({
        prompt: sample.prompt,
        modelProfile: profile,
        emit: capture.emit
      });
    }
  } catch (error) {
    threw = error instanceof Error ? error.message : String(error);
  }
  const totalMs = performance.now() - measureStart;

  const attempts = store.attempts;
  const accepted = attempts.some((a) => a.accepted);
  const captureSummary = capture.summarize();
  const finalSource = store.currentSource;

  // Browser observer: what would a real browser have said about the document
  // the ladder accepted? This is the rejection delta, measured without touching
  // the ladder itself.
  let browserVerdict = null;
  if (browser && accepted && finalSource) {
    const runtimeHtml = expandAnythingLibs(finalSource).html;
    browserVerdict = await runAnythingBrowserProbe(runtimeHtml, { binPath: browserBin });
  }

  return shapeCaseResult({
    sample,
    attempts,
    accepted,
    captureSummary,
    finalSource,
    browserVerdict,
    seeded,
    seedError,
    totalMs,
    wallMs: performance.now() - started,
    result,
    threw
  });
}

/**
 * Separate a model/ladder failure from an infrastructure one.
 *
 * A repair turn whose model call is cut off mid-stream tells us nothing about
 * generation quality, but counted naively it depresses the accept rate exactly
 * like a page the model could not fix. The first baseline run hit this: the
 * dashboard case took a legitimate `runtime_error` on attempt 0, then its repair
 * turn died with `Page update failed: terminated` after 64s, so the whole case
 * read as "the model failed" when the model never got to answer.
 *
 * Read `firstPassAcceptRate` against `failureKinds` — a run with transport
 * failures is measuring the network as much as the model.
 */
function classifyFailure({ accepted, attempts, agentMessage, threw }) {
  if (accepted) return null;
  const text = `${agentMessage ?? ''} ${threw ?? ''}`.toLowerCase();
  if (/terminated|aborted|socket|econnreset|fetch failed|network|timeout/.test(text)) {
    return 'transport';
  }
  if (/budget/.test(text)) return 'budget';
  if (attempts.some((a) => !a.accepted && a.code)) return 'validation';
  return 'other';
}

/**
 * Pure shaping of one case's outcome into the recorded row. Split out of
 * runCase so the measured section stays about *running* the agent, and this
 * stays about reporting it.
 */
function shapeCaseResult({
  sample,
  attempts,
  accepted,
  captureSummary,
  finalSource,
  browserVerdict,
  seeded,
  seedError,
  totalMs,
  wallMs,
  result,
  threw
}) {
  const firstFailure = attempts.find((a) => !a.accepted) ?? null;

  return {
    id: sample.id,
    family: sample.family,
    stresses: sample.stresses,
    seeded,
    seedError,
    accepted,
    firstPassAccepted: attempts.length > 0 && attempts[0].accepted,
    attemptsUsed: attempts.length,
    outcome: resolveOutcome({ attempts, capture: captureSummary, accepted }),
    failureKind: classifyFailure({
      accepted,
      attempts,
      agentMessage: result?.message ?? null,
      threw
    }),
    firstFailureCode: firstFailure?.code ?? null,
    firstFailureError: firstFailure?.error ? firstFailure.error.slice(0, 300) : null,
    convergence: describeConvergence(attempts),
    attempts: attempts.map((a) => ({
      accepted: a.accepted,
      code: a.code,
      docSize: a.docSize,
      validationMs: a.validationMs,
      runtimeChecked: a.runtimeChecked,
      error: a.error ? a.error.slice(0, 200) : null
    })),
    libs: attempts.find((a) => a.accepted)?.libs ?? [],
    expectLibs: sample.expectLibs ?? null,
    toolsUsed: captureSummary.toolsUsed,
    transformMode: sample.transformMode ?? null,
    editToolUsed: captureSummary.toolsUsed.includes('apply_anything_edit'),
    fixer: captureSummary.fixer,
    tokens: captureSummary.totalTokens,
    modelCalls: captureSummary.modelCalls,
    docSize: finalSource.length,
    totalMs: Math.round(totalMs * 100) / 100,
    wallMs: Math.round(wallMs * 100) / 100,
    agentMessage: result?.message ? String(result.message).slice(0, 300) : null,
    threw,
    browser: browserVerdict
      ? {
          skipped: Boolean(browserVerdict.skipped),
          reason: browserVerdict.reason ?? null,
          findingCount: browserVerdict.findings?.length ?? 0,
          findings: browserVerdict.findings ?? [],
          stats: browserVerdict.stats ?? null
        }
      : null
  };
}

// ─────────────────────────────── aggregates ─────────────────────────────────

/** Fold per-case results into the numbers the decision actually turns on. */
function buildSummary(results, args) {
  const attempted = results.filter((r) => r.outcome !== 'bench-error');
  const acceptedRuns = attempted.filter((r) => r.accepted);
  const firstPass = attempted.filter((r) => r.firstPassAccepted);

  const codeHistogram = histogram(
    attempted.flatMap((r) => r.attempts ?? []),
    (a) => (a.accepted ? 'accepted' : (a.code ?? 'rejected_no_code'))
  );
  const outcomeHistogram = histogram(attempted, (r) => r.outcome);
  const convergenceHistogram = histogram(attempted, (r) => r.convergence?.verdict ?? 'unknown');

  const browserRuns = attempted.filter((r) => r.browser && !r.browser.skipped);
  const browserFlagged = browserRuns.filter((r) => r.browser.findingCount > 0);
  // Split by severity: a page at 4.19:1 contrast is legible, a chart that drew
  // nothing is not. Blending them would badly overstate how much more a browser
  // rung would actually reject, since soft findings dominate by count.
  const browserHardFlagged = browserRuns.filter((r) =>
    r.browser.findings.some((f) => findingSeverity(f.code) === 'hard')
  );
  const browserFindingHistogram = histogram(
    browserRuns.flatMap((r) => r.browser.findings),
    (f) => f.code
  );

  const transformRuns = attempted.filter((r) => r.transformMode);
  const editToolRuns = transformRuns.filter((r) => r.editToolUsed);

  const latencies = attempted.map((r) => r.totalMs);
  const docSizes = acceptedRuns.map((r) => r.docSize);

  return {
    tag: args.tag,
    timestamp: new Date().toISOString(),
    profile: args.profile,
    totalRuns: results.length,
    benchErrors: results.length - attempted.length,

    // The headline: how often the model gets it right with no repair at all.
    firstPassAcceptRate: attempted.length
      ? Math.round((firstPass.length / attempted.length) * 10000) / 100
      : null,
    // How often it gets there eventually, repairs included.
    eventualAcceptRate: attempted.length
      ? Math.round((acceptedRuns.length / attempted.length) * 10000) / 100
      : null,
    meanAttempts: attempted.length
      ? Math.round(
          (attempted.reduce((n2, r) => n2 + (r.attemptsUsed ?? 0), 0) / attempted.length) * 100
        ) / 100
      : null,

    // Why the failures failed. `transport` means a model call died mid-stream —
    // infrastructure, not generation quality — so an accept rate should be read
    // against this rather than on its own.
    failureKinds: histogram(
      attempted.filter((r) => r.failureKind),
      (r) => r.failureKind
    ),

    // Where the ladder actually bites, versus where the fixture corpus assumes.
    codeHistogram,
    outcomeHistogram,
    convergenceHistogram,

    // Refine / transform arm: did the model reach for search/replace?
    editTool: transformRuns.length
      ? {
          transformRuns: transformRuns.length,
          editToolUsed: editToolRuns.length,
          editToolRate: Math.round((editToolRuns.length / transformRuns.length) * 10000) / 100
        }
      : null,

    // The number the browser decision turns on: of the pages the ladder ACCEPTED,
    // how many would a real browser have objected to?
    browser: browserRuns.length
      ? {
          observed: browserRuns.length,
          // Any finding at all — includes craft-level contrast notes.
          flagged: browserFlagged.length,
          flaggedRate: Math.round((browserFlagged.length / browserRuns.length) * 10000) / 100,
          // The number the rung decision actually turns on: pages the ladder
          // accepted that render BROKEN (blank canvas, collapsed layout, no body
          // height). This is the realistic ceiling on extra rejections, since a
          // rung that also rejected soft findings would thrash.
          hardFlagged: browserHardFlagged.length,
          hardFlaggedRate:
            Math.round((browserHardFlagged.length / browserRuns.length) * 10000) / 100,
          findingHistogram: browserFindingHistogram
        }
      : null,

    tokens: attempted.reduce(
      (acc, r) => ({
        inputTokens: acc.inputTokens + (r.tokens?.inputTokens ?? 0),
        outputTokens: acc.outputTokens + (r.tokens?.outputTokens ?? 0)
      }),
      { inputTokens: 0, outputTokens: 0 }
    ),
    latencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      max: latencies.length ? Math.round(Math.max(...latencies) * 100) / 100 : 0
    },
    docSize: {
      p50: percentile(docSizes, 50),
      max: docSizes.length ? Math.max(...docSizes) : 0
    }
  };
}

// ──────────────────────────────── the run ────────────────────────────────────

async function run() {
  const args = parseArgs(process.argv.slice(2));

  if (!isLlmConfigured(process.env)) {
    console.error(
      'benchAnythingGeneration: no LLM backend configured.\n' +
        'Set DEEPSEEK_API_KEY / OPENROUTER_API_KEY, or configure Vertex ADC.\n' +
        'See docs/llm-config.md. Run with `node --env-file=.env …` to load a local .env.'
    );
    process.exit(1);
  }

  let browserBin = null;
  if (args.browser) {
    browserBin = resolveBrowserBinary();
    if (!browserBin) {
      console.warn(
        'benchAnythingGeneration: --browser requested but no Chromium binary found; ' +
          'the observer will be skipped. Set ANYTHING_BROWSER_BIN to override.'
      );
    } else {
      console.log(`benchAnythingGeneration: browser observer using ${browserBin}`);
    }
  }

  const selected = args.only
    ? ANYTHING_GENERATION_CORPUS.filter(
        (c) => args.only.includes(c.id) || args.only.includes(c.family)
      )
    : ANYTHING_GENERATION_CORPUS;

  if (selected.length === 0) {
    console.error(`benchAnythingGeneration: --only "${args.only?.join(',')}" matched no cases.`);
    process.exit(1);
  }

  const total = selected.length * args.samples;
  console.log(
    `benchAnythingGeneration: ${selected.length} case(s) x ${args.samples} sample(s) = ${total} generation(s), ` +
      `profile=${args.profile} tag=${args.tag}`
  );
  console.log('This spends real tokens.\n');

  const results = [];
  let n = 0;
  for (const sample of selected) {
    for (let s = 0; s < args.samples; s += 1) {
      n += 1;
      process.stdout.write(
        `[${n}/${total}] ${sample.id}${args.samples > 1 ? ` #${s + 1}` : ''} … `
      );
      let outcome;
      try {
        outcome = await runCase(sample, {
          profile: args.profile,
          browser: args.browser,
          browserBin
        });
      } catch (error) {
        outcome = {
          id: sample.id,
          family: sample.family,
          accepted: false,
          firstPassAccepted: false,
          attemptsUsed: 0,
          outcome: 'bench-error',
          threw: error instanceof Error ? error.message : String(error),
          attempts: [],
          totalMs: 0,
          docSize: 0,
          browser: null
        };
      }
      if (args.samples > 1) outcome.sample = s + 1;
      results.push(outcome);

      const badge = outcome.accepted
        ? outcome.firstPassAccepted
          ? 'first-try'
          : outcome.outcome
        : 'FAILED';
      const browserNote =
        outcome.browser && !outcome.browser.skipped && outcome.browser.findingCount > 0
          ? `  browser: ${outcome.browser.findingCount} finding(s)`
          : '';
      console.log(
        `${badge}  ${Math.round(outcome.totalMs / 1000)}s  ${outcome.docSize}B${browserNote}`
      );
    }
  }

  const summary = buildSummary(results, args);

  ensureOutDir();
  const filename = `${args.tag}-${summary.timestamp.replace(/[:.]/g, '-')}.json`;
  const filepath = path.join(OUT_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify({ summary, results }, null, 2));

  console.log('\n=== Summary ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nSnapshot written to: ${path.relative(REPO_ROOT, filepath)}`);

  // Unlike benchAnything.js there is no per-case expectation to drift from —
  // generation quality is a measurement, not a contract. Exit non-zero only when
  // the bench itself failed to run cases, which would make the numbers a lie.
  if (summary.benchErrors > 0) {
    console.error(`\n!!! ${summary.benchErrors} case(s) errored inside the bench harness.`);
    for (const r of results.filter((x) => x.outcome === 'bench-error')) {
      console.error(`  - ${r.id}: ${r.threw}`);
    }
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('benchAnythingGeneration failed:', error);
  process.exit(1);
});
