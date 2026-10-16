#!/usr/bin/env node
/**
 * Build ArchiSlop God's brief from content-free Cloud Logging lines (ADR-0019).
 *
 *   node scripts/god/brief.mjs --from-file scripts/god/fixtures/log-lines.ndjson --out /tmp/brief.json
 *   node scripts/god/brief.mjs --out /tmp/brief.json   # live: gcloud logging read on god-signals
 *
 * Pure aggregation + Wilson intervals. No LLM. Output is validated by GodBriefSchema before write.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { GOD_HARD_LIMITS } from '@archislop/shared/godBudget.js';
import { GodBriefSchema } from '@archislop/shared/godSchemas.js';
import { ContentTypeSchema } from '@archislop/shared';
import { promptSafeHistory } from './godLog.mjs';

const CONTENT_TYPES = ContentTypeSchema.options;
const WINDOW_MS_DEFAULT = 24 * 3_600_000;
const BASELINE_MS_DEFAULT = 7 * 24 * 3_600_000;
/** Accept-rate findings need at least this many turns in the window. */
const MIN_SAMPLE_FOR_FINDING = 20;
/** Absolute accept-rate drop (window − baseline) that clears the evidence bar. */
const ACCEPT_RATE_DROP = 0.05;

/**
 * Wilson score interval lower/upper bound for a binomial proportion.
 * @param {number} successes
 * @param {number} n
 * @param {number} [z]
 */
export function wilsonInterval(successes, n, z = 1.96) {
  if (!n || n < 1) return { lower: 0, upper: 1 };
  const p = Math.min(1, Math.max(0, successes / n));
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return {
    lower: Math.max(0, (centre - margin) / denom),
    upper: Math.min(1, (centre + margin) / denom)
  };
}

/** @param {number[]} values @param {number} p 0–1 */
export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

/**
 * Normalize one Cloud Logging entry or a bare metric JSON line into a typed record.
 * @param {unknown} raw
 * @returns {{ tag: string, ts: number, sha: string | null, payload: Record<string, unknown> } | null}
 */
export function normalizeLogEntry(raw) {
  if (raw == null || typeof raw !== 'object') return null;
  const obj = /** @type {Record<string, unknown>} */ (raw);
  const payload =
    obj.jsonPayload && typeof obj.jsonPayload === 'object'
      ? /** @type {Record<string, unknown>} */ (obj.jsonPayload)
      : obj;
  const tag = typeof payload.tag === 'string' ? payload.tag : null;
  if (tag !== 'agent_turn' && tag !== 'ux_signal') return null;
  const tsRaw = payload.ts ?? obj.timestamp;
  const ts = Date.parse(String(tsRaw ?? ''));
  if (!Number.isFinite(ts)) return null;
  const shaRaw = typeof payload.sha === 'string' ? payload.sha.trim().toLowerCase() : '';
  const sha = /^[0-9a-f]{7,40}$/.test(shaRaw) ? shaRaw.slice(0, 12) : null;
  return { tag, ts, sha, payload };
}

/**
 * @param {string} text ndjson or a JSON array from `gcloud logging read --format=json`
 * @returns {ReturnType<typeof normalizeLogEntry>[]}
 */
export function parseLogText(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return [];
  /** @type {unknown[]} */
  let items;
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      items = Array.isArray(parsed) ? parsed : [];
    } catch {
      items = [];
    }
  } else {
    items = trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }
  return items.map(normalizeLogEntry).filter(Boolean);
}

/**
 * @param {ReturnType<typeof normalizeLogEntry>[]} lines
 * @param {number} fromMs
 * @param {number} toMs
 */
function inWindow(lines, fromMs, toMs) {
  return lines.filter((l) => l && l.ts >= fromMs && l.ts < toMs);
}

const KNOWN_ERRORS = new Set([
  'missing-diagram-type',
  'parser-rejected',
  'validation-failed',
  'no-patch',
  'budget-exceeded',
  'other'
]);

/**
 * Every aggregate for one slot in one period. The brief emits only the window shape
 * (`GodSlotStatsSchema` is frozen); baseline periods reuse this internally so a finding can
 * name a value *and* what it moved from, for every metric God may target — not just accept rate.
 *
 * @param {ReturnType<typeof normalizeLogEntry>[]} lines
 * @param {string} contentType
 */
function periodSlot(lines, contentType) {
  const turns = lines.filter(
    (l) => l.tag === 'agent_turn' && String(l.payload.contentType ?? 'mermaid') === contentType
  );
  const accepted = turns.filter((l) => l.payload.accepted === true).length;
  const durations = turns
    .map((l) => Number(l.payload.durationMs))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const repairs = turns.map((l) => Number(l.payload.repairAttempts) || 0);
  /** @type {Record<string, number>} */
  const errorClasses = {};
  for (const t of turns) {
    const cls = t.payload.errorClass;
    if (typeof cls === 'string' && KNOWN_ERRORS.has(cls)) {
      errorClasses[cls] = (errorClasses[cls] ?? 0) + 1;
    }
  }
  const ux = lines.filter(
    (l) => l.tag === 'ux_signal' && String(l.payload.contentType ?? '') === contentType
  );
  const countKind = (kind) => ux.filter((l) => l.payload.kind === kind).length;
  const renderRepairs = ux.filter((l) => l.payload.kind === 'render_repair').length;
  const renderRepairFailures = ux.filter(
    (l) => l.payload.kind === 'render_repair' && l.payload.outcome !== 'repaired'
  ).length;

  return {
    contentType,
    turns: turns.length,
    accepted,
    acceptRate: turns.length ? accepted / turns.length : null,
    avgRepairAttempts: repairs.length
      ? Math.round((repairs.reduce((a, b) => a + b, 0) / repairs.length) * 1000) / 1000
      : null,
    p50DurationMs: percentile(durations, 0.5),
    p90DurationMs: percentile(durations, 0.9),
    errorClasses,
    runFailures: countKind('run_failed'),
    retries: countKind('retry'),
    restores: countKind('restore'),
    runStops: countKind('run_stop'),
    manualEditsAfterAgent: countKind('manual_edit_after_agent'),
    autofixFired: ux.filter((l) => l.payload.kind === 'autofix' && l.payload.outcome === 'fired')
      .length,
    renderRepairs,
    renderRepairFailures
  };
}

/**
 * @param {ReturnType<typeof normalizeLogEntry>[]} lines
 * @param {string} contentType
 * @param {ReturnType<typeof normalizeLogEntry>[]} baselineLines
 */
function slotStats(lines, contentType, baselineLines) {
  const win = periodSlot(lines, contentType);
  const base = periodSlot(baselineLines, contentType);
  return { ...win, acceptRateBaseline: base.acceptRate };
}

/**
 * Product-wide aggregates for one period: sessions that never ran anything (`session_bounce`)
 * and how often the client itself errored. Both are rates per session so the 24 h window and
 * the 7 d baseline stay comparable despite their different lengths.
 *
 * @param {ReturnType<typeof normalizeLogEntry>[]} lines
 */
function periodGlobal(lines) {
  const summaries = lines.filter(
    (l) => l.tag === 'ux_signal' && l.payload.kind === 'session_summary'
  );
  const sessions = summaries.length;
  const bounces = summaries.filter((l) => (Number(l.payload.runs) || 0) === 0).length;
  const clientErrors = lines.filter(
    (l) => l.tag === 'ux_signal' && l.payload.kind === 'client_error'
  ).length;
  return {
    sessions,
    bounceRate: sessions ? bounces / sessions : null,
    clientErrors,
    clientErrorsPerSession: sessions ? clientErrors / sessions : null
  };
}

const round3 = (n) => Math.round(n * 1000) / 1000;
/** Severity weight: full weight at 100 samples, linear below — small samples stay quiet. */
const sampleWeight = (sample) => Math.min(1, sample / 100);
const rateOf = (num, den) => (den > 0 ? num / den : null);

/**
 * Rate findings God may act on, as worsening vs baseline. Thresholds are deliberately larger
 * than the accept-rate bar for the softer signals (a manual edit can be taste; a retry is not).
 */
const RATE_FINDINGS = [
  { metric: 'failure_rate', num: 'runFailures', den: 'turns', minSample: 20, minRise: 0.05 },
  { metric: 'retry_rate', num: 'retries', den: 'turns', minSample: 20, minRise: 0.05 },
  { metric: 'restore_rate', num: 'restores', den: 'turns', minSample: 20, minRise: 0.05 },
  {
    metric: 'manual_edit_rate',
    num: 'manualEditsAfterAgent',
    den: 'accepted',
    minSample: 20,
    minRise: 0.1
  },
  {
    metric: 'render_repair_failure_rate',
    num: 'renderRepairFailures',
    den: 'renderRepairs',
    minSample: 10,
    minRise: 0.1
  }
];

/** Verdicts that mean God already spent a run on a finding. */
const ACTED_VERDICTS = new Set(['observed', 'pr_opened', 'revert_opened']);
/** A finding God acted on this recently is deprioritised, not dropped: it may still be worst. */
export const RECENT_ACT_DAYS = 7;

/**
 * Finding ids God acted on within `RECENT_ACT_DAYS` of the brief. History is the god-log run
 * records (hypothesis already stripped); only the id, verdict and end time are read here.
 *
 * @param {unknown} history
 * @param {number} nowMs
 * @returns {Set<string>}
 */
export function recentActedFindingIds(history, nowMs) {
  const ids = new Set();
  if (!Array.isArray(history)) return ids;
  const cutoff = nowMs - RECENT_ACT_DAYS * 24 * 3_600_000;
  for (const record of history) {
    if (!record || typeof record !== 'object') continue;
    const { findingId, verdict, endedAt } = /** @type {Record<string, unknown>} */ (record);
    if (typeof findingId !== 'string' || !ACTED_VERDICTS.has(String(verdict))) continue;
    const ended = Date.parse(String(endedAt ?? ''));
    if (Number.isFinite(ended) && ended >= cutoff) ids.add(findingId);
  }
  return ids;
}

/**
 * The last God PR a deploy can be blamed on, derived from history + the window's deploys: the
 * most recent `pr_opened` run, paired with the first build first seen after it opened. Without
 * this the brief's revert-first path needs a caller who already knows the merge sha — and the
 * workflow never had one, so regressionSuspect could never fire in production.
 *
 * @param {unknown} history
 * @param {{ sha: string, firstSeen: string }[]} deployList window deploys, oldest first
 * @returns {{ pr: number, mergeSha: string, firstSeen: string, confounders: number } | null}
 */
export function deriveLastGodMerge(history, deployList) {
  if (!Array.isArray(history) || !deployList.length) return null;
  const opened = history
    .filter(
      (r) =>
        r &&
        typeof r === 'object' &&
        /** @type {Record<string, unknown>} */ (r).verdict === 'pr_opened' &&
        Number.isInteger(/** @type {Record<string, unknown>} */ (r).pr) &&
        Number(/** @type {Record<string, unknown>} */ (r).pr) > 0
    )
    .sort((a, b) => String(b.endedAt).localeCompare(String(a.endedAt)));
  for (const record of opened) {
    const endedAt = String(/** @type {Record<string, unknown>} */ (record).endedAt ?? '');
    const idx = deployList.findIndex((d) => d.firstSeen >= endedAt);
    if (idx === -1) continue;
    return {
      pr: Number(/** @type {Record<string, unknown>} */ (record).pr),
      mergeSha: deployList[idx].sha,
      firstSeen: deployList[idx].firstSeen,
      confounders: deployList.length - idx - 1
    };
  }
  return null;
}

/**
 * Every worsening that clears its evidence bar, highest severity first. One hypothesis per run
 * means this ordering *is* God's priority queue — so it covers every metric in
 * `GodMetricSchema`, not only accept rate, and a finding God already acted on recently is
 * halved rather than re-picked at full weight (see `recentActedFindingIds`).
 *
 * @param {ReturnType<periodSlot>[]} windowSlots
 * @param {ReturnType<periodSlot>[]} baselineSlots
 * @param {ReturnType<periodGlobal>} windowGlobal
 * @param {ReturnType<periodGlobal>} baselineGlobal
 * @param {Set<string>} recentActed
 */
export function buildFindings(
  windowSlots,
  baselineSlots,
  windowGlobal,
  baselineGlobal,
  recentActed = new Set()
) {
  /** @type {Array<{ id: string, metric: string, contentType: string | null, value: number, baseline: number | null, sample: number, severity: number }>} */
  const findings = [];
  const push = (finding) => {
    const severity = recentActed.has(finding.id) ? finding.severity * 0.5 : finding.severity;
    findings.push({ ...finding, severity: round3(Math.min(1, severity)) });
  };

  for (const slot of windowSlots) {
    const base = baselineSlots.find((s) => s.contentType === slot.contentType);
    if (!base) continue;

    if (
      slot.turns >= MIN_SAMPLE_FOR_FINDING &&
      slot.acceptRate != null &&
      base.acceptRate != null
    ) {
      const drop = base.acceptRate - slot.acceptRate;
      if (drop >= ACCEPT_RATE_DROP) {
        push({
          id: `${slot.contentType}.accept_rate`,
          metric: 'accept_rate',
          contentType: slot.contentType,
          value: slot.acceptRate,
          baseline: base.acceptRate,
          sample: slot.turns,
          severity: drop * sampleWeight(slot.turns)
        });
      }
    }

    for (const rule of RATE_FINDINGS) {
      const sample = slot[rule.den];
      const value = rateOf(slot[rule.num], sample);
      const baseline = rateOf(base[rule.num], base[rule.den]);
      if (sample < rule.minSample || value == null || baseline == null) continue;
      const rise = value - baseline;
      if (rise < rule.minRise) continue;
      push({
        id: `${slot.contentType}.${rule.metric}`,
        metric: rule.metric,
        contentType: slot.contentType,
        value: round3(value),
        baseline: round3(baseline),
        sample,
        severity: rise * sampleWeight(sample)
      });
    }

    if (
      slot.turns >= MIN_SAMPLE_FOR_FINDING &&
      slot.avgRepairAttempts != null &&
      base.avgRepairAttempts != null
    ) {
      const rise = slot.avgRepairAttempts - base.avgRepairAttempts;
      const relative = base.avgRepairAttempts > 0 ? rise / base.avgRepairAttempts : rise;
      if (rise >= 0.5 && relative >= 0.25) {
        push({
          id: `${slot.contentType}.repair_attempts_avg`,
          metric: 'repair_attempts_avg',
          contentType: slot.contentType,
          value: slot.avgRepairAttempts,
          baseline: base.avgRepairAttempts,
          sample: slot.turns,
          severity: Math.min(1, rise * 0.5) * sampleWeight(slot.turns)
        });
      }
    }

    if (slot.turns >= MIN_SAMPLE_FOR_FINDING && slot.p90DurationMs != null && base.p90DurationMs) {
      const rise = slot.p90DurationMs - base.p90DurationMs;
      if (rise >= 5000 && rise / base.p90DurationMs >= 0.3) {
        push({
          id: `${slot.contentType}.turn_duration_p90_ms`,
          metric: 'turn_duration_p90_ms',
          contentType: slot.contentType,
          value: slot.p90DurationMs,
          baseline: base.p90DurationMs,
          sample: slot.turns,
          severity: Math.min(1, rise / base.p90DurationMs) * 0.5 * sampleWeight(slot.turns)
        });
      }
    }
  }

  if (
    windowGlobal.sessions >= MIN_SAMPLE_FOR_FINDING &&
    windowGlobal.clientErrors >= 10 &&
    windowGlobal.clientErrorsPerSession != null &&
    baselineGlobal.clientErrorsPerSession != null
  ) {
    const rise = windowGlobal.clientErrorsPerSession - baselineGlobal.clientErrorsPerSession;
    if (rise >= 0.2) {
      push({
        id: 'global.client_error_count',
        metric: 'client_error_count',
        contentType: null,
        value: round3(windowGlobal.clientErrorsPerSession),
        baseline: round3(baselineGlobal.clientErrorsPerSession),
        sample: windowGlobal.sessions,
        severity: rise * sampleWeight(windowGlobal.sessions)
      });
    }
  }

  if (
    windowGlobal.sessions >= MIN_SAMPLE_FOR_FINDING &&
    windowGlobal.bounceRate != null &&
    baselineGlobal.bounceRate != null
  ) {
    const rise = windowGlobal.bounceRate - baselineGlobal.bounceRate;
    if (rise >= 0.1) {
      push({
        id: 'global.session_bounce_rate',
        metric: 'session_bounce_rate',
        contentType: null,
        value: round3(windowGlobal.bounceRate),
        baseline: round3(baselineGlobal.bounceRate),
        sample: windowGlobal.sessions,
        severity: rise * sampleWeight(windowGlobal.sessions)
      });
    }
  }

  findings.sort((a, b) => b.severity - a.severity || a.id.localeCompare(b.id));
  return findings.slice(0, 20);
}

/**
 * @param {{
 *   lines: NonNullable<ReturnType<typeof normalizeLogEntry>>[],
 *   now?: Date | number,
 *   windowMs?: number,
 *   baselineMs?: number,
 *   currentSha?: string | null,
 *   lastGodMerge?: { pr: number, mergeSha: string, firstSeen: string } | null,
 *   confounders?: number,
 *   history?: unknown
 * }} opts
 */
export function buildBrief(opts) {
  const nowMs = opts.now instanceof Date ? opts.now.getTime() : Number(opts.now ?? Date.now());
  const windowMs = opts.windowMs ?? WINDOW_MS_DEFAULT;
  const baselineMs = opts.baselineMs ?? BASELINE_MS_DEFAULT;
  const to = nowMs;
  const from = nowMs - windowMs;
  const baseTo = from;
  const baseFrom = from - baselineMs;

  const windowLines = inWindow(opts.lines, from, to);
  const baselineLines = inWindow(opts.lines, baseFrom, baseTo);

  const slots = CONTENT_TYPES.map((ct) => slotStats(windowLines, ct, baselineLines)).filter(
    (s) => s.turns > 0 || s.runFailures + s.retries + s.restores + s.renderRepairs > 0
  );

  /** @type {Map<string, string>} sha -> firstSeen ISO */
  const deploys = new Map();
  for (const line of windowLines) {
    if (!line.sha) continue;
    const iso = new Date(line.ts).toISOString();
    const prev = deploys.get(line.sha);
    if (!prev || iso < prev) deploys.set(line.sha, iso);
  }
  const deployList = [...deploys.entries()]
    .map(([sha, firstSeen]) => ({ sha, firstSeen }))
    .sort((a, b) => a.firstSeen.localeCompare(b.firstSeen))
    .slice(0, 100);

  const currentSha =
    opts.currentSha && /^[0-9a-f]{7,40}$/i.test(opts.currentSha)
      ? opts.currentSha.toLowerCase().slice(0, 12)
      : (deployList.at(-1)?.sha ?? null);

  /** @type {Record<string, { source: string, errorName: string, count: number }>} */
  const errMap = {};
  for (const line of windowLines) {
    if (line.tag !== 'ux_signal' || line.payload.kind !== 'client_error') continue;
    const source = String(line.payload.source ?? '');
    const errorName = String(line.payload.errorName ?? 'other');
    const key = `${source}|${errorName}`;
    if (!errMap[key]) errMap[key] = { source, errorName, count: 0 };
    errMap[key].count += 1;
  }
  const SOURCES = new Set(['boundary', 'window', 'unhandledrejection']);
  const ERROR_NAMES = new Set([
    'TypeError',
    'ReferenceError',
    'RangeError',
    'SyntaxError',
    'Error',
    'other'
  ]);
  const clientErrors = Object.values(errMap)
    .filter((e) => SOURCES.has(e.source) && ERROR_NAMES.has(e.errorName))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map((e) => ({
      source: e.source,
      errorName: e.errorName,
      count: e.count
    }));

  const windowSlots = CONTENT_TYPES.map((ct) => periodSlot(windowLines, ct));
  const baselineSlots = CONTENT_TYPES.map((ct) => periodSlot(baselineLines, ct));
  const findings = buildFindings(
    windowSlots,
    baselineSlots,
    periodGlobal(windowLines),
    periodGlobal(baselineLines),
    recentActedFindingIds(opts.history, nowMs)
  );
  const agentTurns = windowLines.filter((l) => l.tag === 'agent_turn').length;
  const uxSignals = windowLines.filter((l) => l.tag === 'ux_signal').length;
  const sessions = windowLines.filter(
    (l) => l.tag === 'ux_signal' && l.payload.kind === 'session_summary'
  ).length;

  let regressionSuspect = null;
  const derived = opts.lastGodMerge ? null : deriveLastGodMerge(opts.history, deployList);
  const last = opts.lastGodMerge ?? derived;
  if (last?.mergeSha && findings[0]?.metric === 'accept_rate' && findings[0].contentType) {
    const metric = findings[0];
    const slot = slots.find((s) => s.contentType === metric.contentType);
    if (slot && slot.turns >= MIN_SAMPLE_FOR_FINDING && slot.acceptRate != null) {
      const after = wilsonInterval(slot.accepted, slot.turns);
      // Compare window Wilson upper against a synthetic baseline lower using baseline rate × sample.
      const baseN = Math.max(slot.turns, MIN_SAMPLE_FOR_FINDING);
      const baseSuccesses = Math.round((slot.acceptRateBaseline ?? slot.acceptRate) * baseN);
      const before = wilsonInterval(baseSuccesses, baseN);
      const confounders =
        opts.confounders ?? derived?.confounders ?? Math.max(0, deployList.length - 1);
      const mergeSha = String(last.mergeSha).toLowerCase().slice(0, 12);
      if (after.upper < before.lower && confounders === 0 && /^[0-9a-f]{7,40}$/.test(mergeSha)) {
        regressionSuspect = {
          pr: last.pr,
          mergeSha,
          metric: metric.metric,
          contentType: metric.contentType,
          before: Math.round(before.lower * 1000) / 1000,
          after: Math.round(after.upper * 1000) / 1000,
          sample: slot.turns,
          confounders
        };
      }
    }
  }

  const brief = {
    v: 1,
    generatedAt: new Date(nowMs).toISOString(),
    window: { from: new Date(from).toISOString(), to: new Date(to).toISOString() },
    baseline: { from: new Date(baseFrom).toISOString(), to: new Date(baseTo).toISOString() },
    build: { current: currentSha, deploys: deployList },
    volume: { agentTurns, uxSignals, sessions },
    slots,
    clientErrors,
    findings,
    regressionSuspect,
    sufficient: agentTurns + uxSignals >= GOD_HARD_LIMITS.minNewSignals
  };

  return GodBriefSchema.parse(brief);
}

/**
 * Read live signal lines from the restricted `god-signals` bucket.
 * @param {{
 *   project?: string,
 *   bucket?: string,
 *   location?: string,
 *   view?: string,
 *   freshness?: string,
 *   limit?: number,
 *   runGcloud?: (args: string[]) => { status: number, stdout: string, stderr: string }
 * }} [opts]
 */
export function fetchSignalLogs(opts = {}) {
  const project = opts.project ?? process.env.GOD_GCP_PROJECT_ID ?? process.env.GCP_PROJECT_ID;
  const bucket = opts.bucket ?? process.env.GOD_LOG_BUCKET ?? 'god-signals';
  const location = opts.location ?? process.env.GOD_LOG_LOCATION ?? 'global';
  const view = opts.view ?? process.env.GOD_LOG_VIEW ?? '_AllLogs';
  const freshness = opts.freshness ?? '8d';
  const limit = opts.limit ?? 5000;
  if (!project)
    throw new Error('GOD_GCP_PROJECT_ID (or GCP_PROJECT_ID) is required for live reads');

  const args = [
    'logging',
    'read',
    'jsonPayload.tag=("agent_turn" OR "ux_signal")',
    `--project=${project}`,
    `--bucket=${bucket}`,
    `--location=${location}`,
    `--view=${view}`,
    `--freshness=${freshness}`,
    `--limit=${limit}`,
    '--format=json',
    '--order=asc'
  ];
  const run =
    opts.runGcloud ??
    ((a) => {
      const r = spawnSync('gcloud', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
    });
  const result = run(args);
  if (result.status !== 0) {
    throw new Error(`gcloud logging read failed (${result.status}): ${result.stderr.trim()}`);
  }
  return parseLogText(result.stdout);
}

/**
 * @param {{ sha: string, ancestor: string, runGit?: (args: string[]) => number }} opts
 * @returns {boolean}
 */
export function isAncestorSha({ sha, ancestor, runGit }) {
  const git =
    runGit ??
    ((args) => {
      const r = spawnSync('git', args, { encoding: 'utf8' });
      return r.status ?? 1;
    });
  return git(['merge-base', '--is-ancestor', ancestor, sha]) === 0;
}

function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      out: { type: 'string' },
      'from-file': { type: 'string' },
      'history-out': { type: 'string' },
      now: { type: 'string' },
      'window-hours': { type: 'string', default: '24' },
      'baseline-days': { type: 'string', default: '7' },
      'current-sha': { type: 'string' },
      'last-god-pr': { type: 'string' },
      'last-god-sha': { type: 'string' },
      history: { type: 'string' },
      confounders: { type: 'string' }
    }
  });
  if (!values.out) throw new Error('--out is required');
  return values;
}

export function main(argv = process.argv.slice(2)) {
  const values = parseCli(argv);
  const lines = values['from-file']
    ? parseLogText(fs.readFileSync(values['from-file'], 'utf8'))
    : fetchSignalLogs();
  const now = values.now ? Date.parse(values.now) : Date.now();
  if (!Number.isFinite(now)) throw new Error(`invalid --now ${values.now}`);

  const lastGodMerge =
    values['last-god-pr'] && values['last-god-sha']
      ? {
          pr: Number(values['last-god-pr']),
          mergeSha: values['last-god-sha'],
          firstSeen: new Date(now).toISOString()
        }
      : null;

  // History is validated and stripped of hypotheses before anything reads it: a prior run's
  // sentence is owner-facing and must never reach a prompt, including via this file.
  const history = values.history
    ? promptSafeHistory(JSON.parse(fs.readFileSync(values.history, 'utf8')))
    : [];

  const brief = buildBrief({
    lines: /** @type {NonNullable<ReturnType<typeof normalizeLogEntry>>[]} */ (lines),
    now,
    windowMs: Number(values['window-hours']) * 3_600_000,
    baselineMs: Number(values['baseline-days']) * 24 * 3_600_000,
    currentSha: values['current-sha'] ?? null,
    lastGodMerge,
    confounders: values.confounders != null ? Number(values.confounders) : undefined,
    history
  });

  fs.mkdirSync(path.dirname(path.resolve(values.out)), { recursive: true });
  fs.writeFileSync(values.out, `${JSON.stringify(brief, null, 2)}\n`);

  if (values['history-out']) {
    fs.mkdirSync(path.dirname(path.resolve(values['history-out'])), { recursive: true });
    fs.writeFileSync(values['history-out'], `${JSON.stringify(history, null, 2)}\n`);
  }

  return brief;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const brief = main();
    process.stdout.write(
      `${JSON.stringify(
        {
          sufficient: brief.sufficient,
          agentTurns: brief.volume.agentTurns,
          uxSignals: brief.volume.uxSignals,
          findings: brief.findings.length,
          regressionSuspect: Boolean(brief.regressionSuspect)
        },
        null,
        2
      )}\n`
    );
  } catch (error) {
    process.stderr.write(`god brief: ${error?.message ?? error}\n`);
    process.exitCode = 1;
  }
}
