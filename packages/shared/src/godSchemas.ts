/**
 * Wire shapes for ArchiSlop God (ADR-0019): the brief God reads, the live events its runner streams
 * to the owner's window, the run record kept on the `god-log` branch, and the settings the owner
 * edits. Like `uxSignals.ts`, every field God *reads* is a number, an enum, a timestamp, a sha or a
 * constrained slug — never free text — because the brief is the only window a code-writing agent
 * has onto production, and the repo is public.
 *
 * Bounds that are policy (the hard limits on money and time) live in `godBudget.ts`; these schemas
 * fix shape and type only.
 */
import { z } from 'zod';
import { ContentTypeSchema } from './diagramSchema.js';
import { UxErrorNameSchema } from './uxSignals.js';

export const GOD_SCHEMA_VERSION = 1;

const isoTime = z.iso.datetime();
const sha = z.string().regex(/^[0-9a-f]{7,40}$/);
const count = z.number().int().min(0).max(1_000_000_000);
const rate = z.number().min(0).max(1);
const usd = z.number().min(0).max(10_000);
/** Repo-relative POSIX path: no leading slash, no `..`, conservative charset. */
const repoPath = z
  .string()
  .max(200)
  .regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._@/-]+$/);
/** Deterministic identifiers built from enums (`mermaid.accept_rate`), never prose. */
const slug = z.string().regex(/^[a-z0-9][a-z0-9_.:-]{0,63}$/);
/** Printable text with no control characters — model narration shown to the owner only. */
const shortText = (max: number) =>
  z
    .string()
    .max(max)
    .regex(/^\P{Cc}*$/u);

export const GodRunIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);

/** Autonomy the owner configures. Ordered from least to most autonomous. */
export const GOD_TIERS = ['observe', 'propose', 'ship'] as const;
export const GodTierSchema = z.enum(GOD_TIERS);
/** What a run actually did; `revert` is forced by the brief, never configured. */
export const GodRunTierSchema = z.enum([...GOD_TIERS, 'revert']);

/** "Run now" focus — an enum so nothing typed into the owner UI reaches the agent's prompt. */
export const GodFocusSchema = z.enum(['any', 'ux', ...ContentTypeSchema.options]);

export const GodPhaseSchema = z.enum(['gate', 'brief', 'act', 'verify', 'publish']);

export const GodStopReasonSchema = z.enum([
  'completed',
  'budget',
  'balance',
  'timeout',
  'cancelled',
  'error',
  'sandbox_unavailable'
]);

/** Verdicts that mean the harness actually started. Noop, blocked and skipped ticks did not. */
export const GOD_ACT_VERDICTS = [
  'observed',
  'pr_opened',
  'revert_opened',
  'red',
  'failed',
  'stopped'
] as const;

/** What a run produced. PR states (merged, deployed, reverted) are read from GitHub, not stored. */
export const GodVerdictSchema = z.enum([
  'noop',
  'observed',
  'pr_opened',
  'revert_opened',
  'blocked',
  'red',
  'failed',
  'stopped',
  'skipped'
]);

export const GodTriggerSchema = z.enum(['schedule', 'manual']);

/**
 * Why the gate stopped — or let through — a tick. An enum rather than the string the workflow
 * printed, so a stray value can never be written into the durable store and read back into a future
 * prompt. `godBudget.ts` derives `GodDecisionReason` from this list: the producer cannot add a
 * reason the recorder would silently drop.
 */
export const GOD_GATE_REASONS = [
  'go',
  'disabled',
  'open_pr',
  'month_cap',
  'balance_low',
  'outside_window',
  'not_due',
  'insufficient_signals'
] as const;
export const GodGateReasonSchema = z.enum(GOD_GATE_REASONS);

/** Why `decideAct` stopped a tick once the brief existed. Same enum discipline. */
export const GOD_ACT_REASONS = [
  'go',
  'gate',
  'tier_not_wired',
  'brief_not_live',
  'brief_invalid',
  'insufficient'
] as const;
export const GodActReasonSchema = z.enum(GOD_ACT_REASONS);

/** The reason a tick ended where it did, from whichever stage spoke last. */
export const GodTickReasonSchema = z.union([GodGateReasonSchema, GodActReasonSchema]);

/** Mirrors `classifyAgentTurnError` in `apps/server/src/metrics/agentTurnMetrics.js`. */
export const AgentTurnErrorClassSchema = z.enum([
  'missing-diagram-type',
  'parser-rejected',
  'validation-failed',
  'no-patch',
  'budget-exceeded',
  'other'
]);

/** The metrics the brief computes and God may name as its target. */
export const GodMetricSchema = z.enum([
  'accept_rate',
  'repair_attempts_avg',
  'turn_duration_p90_ms',
  'failure_rate',
  'retry_rate',
  'restore_rate',
  'manual_edit_rate',
  'render_repair_failure_rate',
  'client_error_count',
  'session_bounce_rate'
]);

// --- brief (what God reads) ---------------------------------------------------------------------

export const GodSlotStatsSchema = z.strictObject({
  contentType: ContentTypeSchema,
  turns: count,
  accepted: count,
  acceptRate: rate.nullable(),
  acceptRateBaseline: rate.nullable(),
  avgRepairAttempts: z.number().min(0).max(100).nullable(),
  p50DurationMs: count.nullable(),
  p90DurationMs: count.nullable(),
  errorClasses: z.partialRecord(AgentTurnErrorClassSchema, count),
  runFailures: count,
  retries: count,
  restores: count,
  runStops: count,
  manualEditsAfterAgent: count,
  autofixFired: count,
  renderRepairs: count,
  renderRepairFailures: count
});

/**
 * Where a finding's numbers came from. `production` is real visitors (Cloud Logging); `probe` is
 * God's own synthetic traffic — a fixed prompt corpus sent through the real agents by
 * `scripts/god/probe.mjs`. Absent means `production`: briefs written before probes existed.
 */
export const GOD_FINDING_SOURCES = ['production', 'probe'] as const;
export const GodFindingSourceSchema = z.enum(GOD_FINDING_SOURCES);

export const GodFindingSchema = z.strictObject({
  id: slug,
  metric: GodMetricSchema,
  source: GodFindingSourceSchema.optional(),
  contentType: ContentTypeSchema.nullable(),
  value: z.number().finite(),
  baseline: z.number().finite().nullable(),
  sample: count,
  /** 0–1, already weighted by sample size; findings arrive sorted by it, highest first. */
  severity: rate
});

export const GodRegressionSuspectSchema = z.strictObject({
  pr: z.number().int().positive(),
  mergeSha: sha,
  metric: GodMetricSchema,
  contentType: ContentTypeSchema.nullable(),
  before: z.number().finite(),
  after: z.number().finite(),
  sample: count,
  /** Other merges deployed inside the comparison window; revert-first needs this to be 0. */
  confounders: count
});

/**
 * One slot's synthetic probe outcomes: counts only, the same facts an `agent_turn` line carries.
 * `repairAttempts` is the sum over the slot's turns, so samples pool across runs by addition.
 */
export const GodProbeSlotSchema = z.strictObject({
  contentType: ContentTypeSchema,
  turns: count,
  accepted: count,
  repairAttempts: count
});

/** What one probe run measured and cost. Kept on the run record so later briefs can pool it. */
export const GodProbeSummarySchema = z.strictObject({
  turns: count,
  usd,
  slots: z.array(GodProbeSlotSchema).max(ContentTypeSchema.options.length)
});

/** Probe samples pooled over the last `windowDays` of run records, this tick's run included. */
export const GodBriefProbesSchema = z.strictObject({
  windowDays: z.number().int().min(1).max(30),
  runs: count,
  turns: count,
  slots: z.array(GodProbeSlotSchema).max(ContentTypeSchema.options.length)
});

export const GodBriefSchema = z.strictObject({
  v: z.literal(GOD_SCHEMA_VERSION),
  generatedAt: isoTime,
  window: z.strictObject({ from: isoTime, to: isoTime }),
  baseline: z.strictObject({ from: isoTime, to: isoTime }).nullable(),
  build: z.strictObject({
    current: sha.nullable(),
    deploys: z.array(z.strictObject({ sha, firstSeen: isoTime })).max(100)
  }),
  volume: z.strictObject({ agentTurns: count, uxSignals: count, sessions: count }),
  slots: z.array(GodSlotStatsSchema).max(ContentTypeSchema.options.length),
  clientErrors: z
    .array(
      z.strictObject({
        source: z.enum(['boundary', 'window', 'unhandledrejection']),
        errorName: UxErrorNameSchema,
        count
      })
    )
    .max(20),
  findings: z.array(GodFindingSchema).max(20),
  regressionSuspect: GodRegressionSuspectSchema.nullable(),
  /** Synthetic probe evidence; absent when no probe ran or was pooled. Never counted in `volume`. */
  probes: GodBriefProbesSchema.optional(),
  /**
   * False when the evidence is too thin to act on; God waits rather than guessing. True when live
   * traffic clears the signal floor, or when pooled probes produced at least one finding.
   */
  sufficient: z.boolean()
});

// --- live events (runner → owner window) --------------------------------------------------------

export const GodLiveEventSchema = z.strictObject({
  seq: z.number().int().min(0).max(1_000_000),
  ts: isoTime,
  type: z.enum(['phase', 'tool', 'model', 'text', 'status', 'final', 'error']),
  phase: GodPhaseSchema.optional(),
  tool: z
    .string()
    .regex(/^[A-Za-z0-9_.:-]{1,64}$/)
    .optional(),
  path: repoPath.optional(),
  /** First 160 printable-ASCII characters of a shell command the agent ran. */
  command: z
    .string()
    .max(160)
    .regex(/^[\x20-\x7e]*$/)
    .optional(),
  exitCode: z.number().int().min(-1).max(255).optional(),
  inputTokens: count.optional(),
  outputTokens: count.optional(),
  cacheHitTokens: count.optional(),
  usd: usd.optional(),
  text: shortText(280).optional(),
  reason: GodStopReasonSchema.optional()
});

export const GodLiveBatchSchema = z.strictObject({
  runId: GodRunIdSchema,
  events: z.array(GodLiveEventSchema).min(1).max(100)
});

// --- run record (god-log branch) ----------------------------------------------------------------

export const GodUsageSchema = z.strictObject({
  calls: count,
  inputTokens: count,
  outputTokens: count,
  cacheHitTokens: count,
  usd
});

/**
 * What the harness's final text did with the observe contract (playbook §5): name a finding, say
 * `waiting`, or satisfy neither. An enum, because the run record is fed back to the harness as
 * history — and a useful one: a tick can see that its predecessor was dropped for not labelling.
 *
 * Absence means "this field did not exist yet" or "the run never reached a final text" (a failed or
 * stopped harness). It must never be read as `dropped`: a crashed run is not a run that said nothing
 * on purpose, and only a completed run can owe the contract an answer.
 */
export const GOD_NARRATION_OUTCOMES = ['finding', 'waiting', 'dropped'] as const;
export const GodNarrationSchema = z.enum(GOD_NARRATION_OUTCOMES);

/**
 * The brief's shape for one tick, kept on the record. Numbers and one boolean — the same fields the
 * brief already carries — so nothing new reaches a prompt, while the durable store can answer the
 * question a CI log answers today and a 30-day artifact forgets: *how close was this tick to
 * acting?* (`sufficient` needs `agentTurns + uxSignals >= GOD_HARD_LIMITS.minNewSignals`.)
 */
export const GodBriefDigestSchema = z.strictObject({
  agentTurns: count,
  uxSignals: count,
  sessions: count,
  findings: count,
  sufficient: z.boolean(),
  /** Pooled probe turns the brief saw. Optional: digests written before probes lack it. */
  probeTurns: count.optional()
});

export const GodRunRecordSchema = z.strictObject({
  v: z.literal(GOD_SCHEMA_VERSION),
  runId: GodRunIdSchema,
  startedAt: isoTime,
  endedAt: isoTime,
  trigger: GodTriggerSchema,
  tier: GodRunTierSchema,
  focus: GodFocusSchema,
  verdict: GodVerdictSchema,
  stopReason: GodStopReasonSchema,
  findingId: slug.nullable(),
  /** One sentence of model text, owner-facing only. Never read back into a prompt. */
  hypothesis: shortText(280).nullable(),
  pr: z.number().int().positive().nullable(),
  branch: z
    .string()
    .regex(/^god\/[A-Za-z0-9._-]{1,80}$/)
    .nullable(),
  filesChanged: z.array(repoPath).max(50),
  usage: GodUsageSchema,
  minutes: z.number().min(0).max(600),
  balanceAfter: z
    .strictObject({ currency: z.enum(['USD', 'CNY']), total: z.number().finite() })
    .nullable(),
  /**
   * All four are `.optional()`, never `.default()`: the records already on `god-log` predate
   * them, and `loadRunRecords` drops any file that fails to parse — a required field here would
   * silently erase God's whole memory of its first ticks.
   */
  reason: GodTickReasonSchema.optional(),
  digest: GodBriefDigestSchema.optional(),
  narration: GodNarrationSchema.optional(),
  /**
   * This tick's probe run, when one ran. Its `usd` is real spend on God's account: the monthly cap
   * and the cadence both count it (`monthTotals` / `deriveCadence` in `scripts/god/godLog.mjs`).
   */
  probe: GodProbeSummarySchema.optional(),
  harness: z.strictObject({
    name: z.enum(['dsh', 'mock']),
    version: z.string().regex(/^[A-Za-z0-9.+_-]{1,40}$/)
  })
});

// --- god-log month rollup (`index/<month>.json`) -------------------------------------------------

/**
 * One row of `index/<month>.json`. This file is the only durable artifact of the rung that had no
 * schema: the run record is validated on write and read, the rollup was hand-assembled in
 * `recordTick.mjs` and read by nothing — which is how a merge that rewrote it to one row went
 * unnoticed for 52 ticks.
 *
 * `gateReason` is deliberately the *raw* string the workflow passed, bounded and printable, not the
 * `GodTickReasonSchema` enum. The rollup is read only by a human and by the owner's status view; the
 * enum-clamped copy is the one on the run record, because that file is fed back into a prompt. A
 * reason the enum has never heard of costs a row its label there, not its whole tick.
 */
export const GodRollupRowSchema = z.strictObject({
  runId: GodRunIdSchema,
  startedAt: isoTime,
  endedAt: isoTime,
  verdict: GodVerdictSchema,
  tier: GodRunTierSchema,
  usd,
  gateReason: shortText(64).optional(),
  digest: GodBriefDigestSchema.optional(),
  narration: GodNarrationSchema.optional()
});

/** `YYYY-MM` of UTC. */
const rollupMonth = z.string().regex(/^\d{4}-\d{2}$/);

/**
 * Month totals computed at fold time from `runs/*.json`, never from the rows in this file.
 *
 * The rows are a list a bad merge can truncate — which is exactly what happened to all of October —
 * while the per-run records are append-only and unenumerable over the raw HTTPS endpoint the owner's
 * status view reads. So the fold step, which *does* have the whole branch checked out, stamps the
 * true month numbers onto the rollup for that reader. Without this the view reports whatever rows
 * survived and quietly understates the month's spend — the failure ADR-0019 §5 exists to prevent.
 */
export const GodMonthTotalsSchema = z.strictObject({
  ticks: count,
  acts: count,
  monthSpendUsd: usd,
  /**
   * Acts that completed, named nothing, and changed nothing: money spent on silence. Optional
   * because records that predate `narration` cannot be judged — absence means *unknown*, never
   * *zero*, and a reader must not conclude the month was productive from a number that was never
   * measured.
   */
  unproductiveActs: count.optional(),
  unproductiveUsd: usd.optional(),
  lastActAt: isoTime.nullable()
});

/**
 * A month of rollup rows. `max` is a month of hourly ticks plus room for dispatches: a file that
 * outgrows it means the rollup stopped being folded idempotently, and the consumer should say so
 * rather than render a truncated month as if it were whole.
 */
export const GodMonthRollupSchema = z.strictObject({
  v: z.literal(GOD_SCHEMA_VERSION),
  month: rollupMonth,
  /** Optional, like every field added since: the branch's existing month files predate it. */
  totals: GodMonthTotalsSchema.optional(),
  runs: z.array(GodRollupRowSchema).max(1_000)
});

// --- configuration (repo variables) -------------------------------------------------------------

/** `HH-HH` in UTC, start inclusive, end exclusive; `22-04` wraps midnight. */
export const GodWindowUtcSchema = z.string().regex(/^([01]\d|2[0-3])-([01]\d|2[0-4])$/);

export const GodConfigSchema = z.strictObject({
  enabled: z.boolean(),
  autonomy: GodTierSchema,
  everyHours: z.number().int().positive(),
  windowUtc: GodWindowUtcSchema,
  maxMinutes: z.number().int().positive(),
  maxUsdPerRun: z.number().positive(),
  maxUsdPerMonth: z.number().positive()
});

/** Settings writes are partial; `clampGodConfig` (godBudget.ts) enforces the bounds. */
export const GodConfigPatchSchema = GodConfigSchema.partial();

export type GodTier = z.infer<typeof GodTierSchema>;
export type GodRunTier = z.infer<typeof GodRunTierSchema>;
export type GodFocus = z.infer<typeof GodFocusSchema>;
export type GodPhase = z.infer<typeof GodPhaseSchema>;
export type GodStopReason = z.infer<typeof GodStopReasonSchema>;
export type GodVerdict = z.infer<typeof GodVerdictSchema>;
export type GodGateReason = z.infer<typeof GodGateReasonSchema>;
export type GodActReason = z.infer<typeof GodActReasonSchema>;
export type GodTickReason = z.infer<typeof GodTickReasonSchema>;
export type GodMetric = z.infer<typeof GodMetricSchema>;
export type GodSlotStats = z.infer<typeof GodSlotStatsSchema>;
export type GodFinding = z.infer<typeof GodFindingSchema>;
export type GodFindingSource = z.infer<typeof GodFindingSourceSchema>;
export type GodProbeSlot = z.infer<typeof GodProbeSlotSchema>;
export type GodProbeSummary = z.infer<typeof GodProbeSummarySchema>;
export type GodBriefProbes = z.infer<typeof GodBriefProbesSchema>;
export type GodBrief = z.infer<typeof GodBriefSchema>;
export type GodLiveEvent = z.infer<typeof GodLiveEventSchema>;
export type GodLiveBatch = z.infer<typeof GodLiveBatchSchema>;
export type GodUsage = z.infer<typeof GodUsageSchema>;
export type GodBriefDigest = z.infer<typeof GodBriefDigestSchema>;
export type GodNarration = z.infer<typeof GodNarrationSchema>;
export type GodRollupRow = z.infer<typeof GodRollupRowSchema>;
export type GodMonthTotals = z.infer<typeof GodMonthTotalsSchema>;
export type GodMonthRollup = z.infer<typeof GodMonthRollupSchema>;
export type GodRunRecord = z.infer<typeof GodRunRecordSchema>;
export type GodConfig = z.infer<typeof GodConfigSchema>;
export type GodConfigPatch = z.infer<typeof GodConfigPatchSchema>;
