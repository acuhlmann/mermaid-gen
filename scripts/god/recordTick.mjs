#!/usr/bin/env node
/**
 * Write one god-log run record (ADR-0019).
 *
 *   node scripts/god/recordTick.mjs --out-dir . --run-id 123 --reason disabled --tier observe
 *   node scripts/god/recordTick.mjs --out-dir . --from-report report.json --events events.ndjson
 *
 * Without a harness report the verdict is a skip (`noop`, `blocked`, `skipped`). A report is the
 * only way to record `observed` — gate `go` alone never did that work.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  GodBriefSchema,
  GodMonthRollupSchema,
  GodRollupRowSchema,
  GodRunRecordSchema,
  GodTickReasonSchema
} from '@archislop/shared/godSchemas.js';
import { lastNarrationText, parseObserveNarration } from './actDecision.mjs';
import { branchForRun, filterPatchFiles } from './proposePatch.mjs';

const SKIP_VERDICTS = new Set(['noop', 'blocked', 'skipped']);

/** Stop reasons that mean the harness started and then halted, rather than erroring. */
const STOPPED = new Set(['budget', 'balance', 'timeout', 'cancelled']);

/**
 * The run record is fed back to the harness as history (`promptSafeHistory`), so the reason it
 * carries must be one of the two vocabularies the gate and `decideAct` can actually emit — never the
 * loose string a step happened to print. An unknown reason is dropped rather than thrown: a new
 * reason in the workflow must cost a tick its reason label, not cost the tick its whole record.
 *
 * @param {string | undefined | null} reason
 * @returns {import('@archislop/shared/godSchemas.js').GodTickReason | undefined}
 */
export function tickReason(reason) {
  const parsed = GodTickReasonSchema.safeParse(reason);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Counts and one boolean, lifted out of the brief — never the brief itself. This is what lets a
 * later reader ask "how close was that tick to acting?" after the 30-day artifact is gone; the
 * answer today lives only in a step summary that expires.
 *
 * @param {string | undefined} file
 * @returns {import('@archislop/shared/godSchemas.js').GodBriefDigest | undefined}
 */
export function digestFromBriefFile(file) {
  if (!file || !fs.existsSync(file)) return undefined;
  try {
    const brief = GodBriefSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
    return {
      agentTurns: brief.volume.agentTurns,
      uxSignals: brief.volume.uxSignals,
      sessions: brief.volume.sessions,
      findings: brief.findings.length,
      sufficient: brief.sufficient === true
    };
  } catch {
    // A brief that will not parse is the brief job's problem, already recorded by its own step.
    return undefined;
  }
}

/**
 * The rollup row for one tick. Validated, because this file is the owner's status view of the rung
 * and nothing else reads it — an unvalidated hand-assembled object is how the month rollup could be
 * rewritten to a single row for 52 ticks with no sensor noticing.
 *
 * A row that will not validate degrades to the essentials instead of throwing: losing the tick from
 * the index is worse than losing its label, and the run record under `runs/` is the durable copy.
 *
 * @param {import('@archislop/shared/godSchemas.js').GodRunRecord} record
 * @param {string | undefined} gateReason
 */
export function rollupRow(record, gateReason) {
  const base = {
    runId: record.runId,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    verdict: record.verdict,
    tier: record.tier,
    usd: record.usage.usd
  };
  /** @type {Record<string, unknown>} */
  const row = { ...base };
  const reason = typeof gateReason === 'string' ? gateReason.replace(/\s+/g, ' ').trim() : '';
  if (reason) row.gateReason = reason.slice(0, 64);
  if (record.digest) row.digest = record.digest;
  const parsed = GodRollupRowSchema.safeParse(row);
  // Only the essentials are safe to re-emit blind; they come from an already-validated record.
  return parsed.success ? parsed.data : base;
}

function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'out-dir': { type: 'string', default: '.' },
      'run-id': { type: 'string' },
      reason: { type: 'string', default: 'disabled' },
      brief: { type: 'string' },
      tier: { type: 'string', default: 'observe' },
      focus: { type: 'string', default: 'any' },
      go: { type: 'string', default: 'false' },
      verdict: { type: 'string' },
      trigger: { type: 'string', default: 'schedule' },
      now: { type: 'string' },
      'from-report': { type: 'string' },
      events: { type: 'string' },
      pr: { type: 'string' },
      branch: { type: 'string' },
      'files-from': { type: 'string' },
      verify: { type: 'string' }
    }
  });
  if (!values['from-report'] && !values['run-id']) throw new Error('--run-id is required');
  return values;
}

/**
 * @param {ReturnType<typeof parseCli>} values
 */
export function buildTickRecord(values) {
  const now = values.now ? new Date(values.now) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`invalid --now ${values.now}`);
  const iso = now.toISOString();
  const requested = values.verdict ? String(values.verdict).trim() : '';
  const verdict = SKIP_VERDICTS.has(requested) ? requested : 'noop';
  const reason = tickReason(values.reason);
  const digest = values.digest ?? digestFromBriefFile(values.brief);
  return GodRunRecordSchema.parse({
    v: 1,
    runId: String(values['run-id']),
    startedAt: iso,
    endedAt: iso,
    trigger: values.trigger === 'manual' ? 'manual' : 'schedule',
    tier: values.tier,
    focus: values.focus,
    verdict,
    stopReason: 'completed',
    findingId: null,
    hypothesis: null,
    pr: null,
    branch: null,
    filesChanged: [],
    usage: { calls: 0, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0, usd: 0 },
    minutes: 0,
    balanceAfter: null,
    ...(reason ? { reason } : {}),
    ...(digest ? { digest } : {}),
    harness: { name: 'mock', version: '0.0.0' }
  });
}

/**
 * @param {string} stopReason
 * @returns {'observed' | 'failed' | 'stopped'}
 */
export function verdictForStop(stopReason) {
  if (stopReason === 'completed') return 'observed';
  if (STOPPED.has(stopReason)) return 'stopped';
  return 'failed';
}

/**
 * @param {{ report: Record<string, any>, narration?: string | null, trigger?: string, reason?: string | null, digest?: import('@archislop/shared/godSchemas.js').GodBriefDigest }} input
 */
export function buildActRecord(input) {
  const report = input.report ?? {};
  const narration = parseObserveNarration(input.narration);
  const usage = report.usage ?? {};
  const harness = report.harness ?? {};
  const reason = tickReason(input.reason);
  const digest = input.digest ?? digestFromBriefFile(input.brief);
  return GodRunRecordSchema.parse({
    v: 1,
    runId: String(report.runId),
    startedAt: report.startedAt,
    endedAt: report.endedAt,
    trigger: input.trigger === 'manual' ? 'manual' : 'schedule',
    tier: report.tier,
    focus: report.focus,
    verdict: verdictForStop(report.stopReason),
    stopReason: report.stopReason,
    findingId: narration.findingId,
    hypothesis: narration.hypothesis,
    pr: null,
    branch: null,
    filesChanged: [],
    usage: {
      calls: Number(usage.calls) || 0,
      inputTokens: Number(usage.inputTokens) || 0,
      outputTokens: Number(usage.outputTokens) || 0,
      cacheHitTokens: Number(usage.cacheHitTokens) || 0,
      usd: Number(usage.usd) || 0
    },
    minutes: Number(report.minutes) || 0,
    balanceAfter: null,
    ...(reason ? { reason } : {}),
    ...(digest ? { digest } : {}),
    harness: {
      name: harness.name,
      version: String(harness.version ?? '')
    }
  });
}

/**
 * Fold verify and publish results onto a harness record. A refused diff is `red` (the harness did
 * run). An opened PR replaces that with `pr_opened`.
 *
 * @param {import('@archislop/shared/godSchemas.js').GodRunRecord} record
 * @param {{ pr?: string | number | null, branch?: string | null, files?: string[], verify?: string | null }} outcome
 */
export function finalizeActRecord(record, outcome = {}) {
  let verdict = record.verdict;
  let pr = record.pr;
  let branch = record.branch;
  if (outcome.verify === 'postflight' || outcome.verify === 'checks') verdict = 'red';
  if (outcome.pr) {
    verdict = 'pr_opened';
    pr = Number(outcome.pr);
    branch = outcome.branch || branchForRun(record.runId);
  }
  const filesChanged = filterPatchFiles(outcome.files ?? record.filesChanged ?? []);
  return GodRunRecordSchema.parse({ ...record, verdict, pr, branch, filesChanged });
}

export function main(argv = process.argv.slice(2)) {
  const values = parseCli(argv);
  const trigger = values.trigger === 'manual' ? 'manual' : 'schedule';
  let record;
  if (values['from-report']) {
    const report = JSON.parse(fs.readFileSync(values['from-report'], 'utf8'));
    const events =
      values.events && fs.existsSync(values.events) ? fs.readFileSync(values.events, 'utf8') : '';
    const files =
      values['files-from'] && fs.existsSync(values['files-from'])
        ? fs.readFileSync(values['files-from'], 'utf8').split('\n')
        : [];
    record = finalizeActRecord(
      buildActRecord({
        report,
        narration: lastNarrationText(events),
        trigger,
        reason: values.reason,
        digest: digestFromBriefFile(values.brief)
      }),
      {
        pr: values.pr || null,
        branch: values.branch || null,
        files,
        verify: values.verify || null
      }
    );
  } else {
    record = buildTickRecord(values);
  }
  const outDir = path.resolve(values['out-dir']);
  const runsDir = path.join(outDir, 'runs');
  const indexDir = path.join(outDir, 'index');
  fs.mkdirSync(runsDir, { recursive: true });
  fs.mkdirSync(indexDir, { recursive: true });
  const runPath = path.join(runsDir, `${record.runId}.json`);
  fs.writeFileSync(runPath, `${JSON.stringify(record, null, 2)}\n`);

  const month = record.endedAt.slice(0, 7);
  const idxPath = path.join(indexDir, `${month}.json`);
  /** @type {{ v: number, month: string, runs: object[] }} */
  let idx = { v: 1, month, runs: [] };
  if (fs.existsSync(idxPath)) {
    try {
      idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
    } catch {
      idx = { v: 1, month, runs: [] };
    }
  }
  if (!Array.isArray(idx.runs)) idx.runs = [];
  idx.runs.push(rollupRow(record, values.reason));
  const rolled = GodMonthRollupSchema.safeParse(idx);
  fs.writeFileSync(idxPath, `${JSON.stringify(rolled.success ? rolled.data : idx, null, 2)}\n`);
  return { record, runPath, idxPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = main();
    process.stdout.write(
      `${JSON.stringify({ runId: result.record.runId, verdict: result.record.verdict }, null, 2)}\n`
    );
  } catch (error) {
    process.stderr.write(`god recordTick: ${error?.message ?? error}\n`);
    process.exitCode = 1;
  }
}
