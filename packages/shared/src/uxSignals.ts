/**
 * Content-free usage signals (ADR-0019). Every field is an enum, a bounded integer or a boolean —
 * no ids, IPs, prompts, diagram text or error messages. The schema *is* the privacy policy, and
 * because ArchiSlop God reads what these aggregate into, it is also the prompt-injection boundary:
 * nothing a visitor types can reach a code-writing agent through a signal. Objects are strict, so
 * an unknown key is a rejection rather than a silent pass-through.
 *
 * Client kinds arrive over `POST /api/signals`; server kinds are recorded in-process by the routes
 * that own the funnel. The route accepts only the client union, so a browser cannot forge a server
 * signal.
 */
import { z } from 'zod';
import { ContentTypeSchema } from './diagramSchema.js';

export const UX_SIGNAL_SCHEMA_VERSION = 1;
/** Most signals one beacon/fetch may carry. */
export const UX_SIGNAL_BATCH_MAX = 50;
/** Ceiling for any per-session counter; anything larger is a bug or a bot, not a person. */
export const UX_SIGNAL_COUNT_MAX = 1000;

const count = z.number().int().min(0).max(UX_SIGNAL_COUNT_MAX);

/** Mirrors `AgentStreamFailureClass` in `apps/web/src/utils/agentStreamFailureStatus.ts`. */
export const UxFailureClassSchema = z.enum([
  'syntax_exhausted',
  'no_patch',
  'stale_revision',
  'timeout',
  'network',
  'generic'
]);

/** Short spans: how long after an agent result something happened. */
export const UX_ELAPSED_BUCKETS = ['lt_10s', '10s_30s', '30s_2m', '2m_10m', 'gt_10m'] as const;
export const UxElapsedBucketSchema = z.enum(UX_ELAPSED_BUCKETS);

/** Long spans: how long a page session lasted. */
export const UX_SESSION_BUCKETS = ['lt_1m', '1m_5m', '5m_15m', '15m_60m', 'gt_60m'] as const;
export const UxSessionBucketSchema = z.enum(UX_SESSION_BUCKETS);

/** Error constructor names worth telling apart; everything else collapses to `other`. */
export const UxErrorNameSchema = z.enum([
  'TypeError',
  'ReferenceError',
  'RangeError',
  'SyntaxError',
  'Error',
  'other'
]);

export const UxModelProfileSchema = z.enum(['fast', 'quality']);

// --- client kinds -------------------------------------------------------------------------------

const RetrySignal = z.strictObject({
  kind: z.literal('retry'),
  contentType: ContentTypeSchema,
  failureClass: UxFailureClassSchema
});

const RestoreSignal = z.strictObject({
  kind: z.literal('restore'),
  contentType: ContentTypeSchema,
  entriesBack: z.number().int().min(1).max(50)
});

const AutofixSignal = z.strictObject({
  kind: z.literal('autofix'),
  contentType: ContentTypeSchema,
  path: z.enum(['render_repair', 'intent']),
  outcome: z.enum(['fired', 'failed'])
});

const CritiqueFixSignal = z.strictObject({
  kind: z.literal('critique_fix'),
  contentType: ContentTypeSchema,
  scope: z.enum(['all', 'selected']),
  itemCount: z.number().int().min(0).max(50)
});

const ModeSwitchSignal = z.strictObject({
  kind: z.literal('mode_switch'),
  from: ContentTypeSchema,
  to: ContentTypeSchema
});

const RunFailedSignal = z.strictObject({
  kind: z.literal('run_failed'),
  contentType: ContentTypeSchema,
  failureClass: UxFailureClassSchema,
  profile: UxModelProfileSchema
});

const RunCancelledSignal = z.strictObject({
  kind: z.literal('run_cancelled'),
  contentType: ContentTypeSchema,
  after: UxElapsedBucketSchema
});

const RunStopSignal = z.strictObject({
  kind: z.literal('run_stop'),
  contentType: ContentTypeSchema
});

const ManualEditAfterAgentSignal = z.strictObject({
  kind: z.literal('manual_edit_after_agent'),
  contentType: ContentTypeSchema,
  within: UxElapsedBucketSchema
});

const ClientErrorSignal = z.strictObject({
  kind: z.literal('client_error'),
  source: z.enum(['boundary', 'window', 'unhandledrejection']),
  errorName: UxErrorNameSchema
});

const SessionSummarySignal = z.strictObject({
  kind: z.literal('session_summary'),
  duration: UxSessionBucketSchema,
  runs: count,
  accepted: count,
  failed: count,
  lastRunFailed: z.boolean()
});

export const UxClientSignalSchema = z.discriminatedUnion('kind', [
  RetrySignal,
  RestoreSignal,
  AutofixSignal,
  CritiqueFixSignal,
  ModeSwitchSignal,
  RunFailedSignal,
  RunCancelledSignal,
  RunStopSignal,
  ManualEditAfterAgentSignal,
  ClientErrorSignal,
  SessionSummarySignal
]);

// --- server kinds -------------------------------------------------------------------------------

/** One per return path of `POST /api/diagram/render-error`. */
export const UxRenderRepairOutcomeSchema = z.enum([
  'repaired',
  'rejected',
  'failed',
  'stale',
  'unavailable',
  'error'
]);

const RenderRepairSignal = z.strictObject({
  kind: z.literal('render_repair'),
  contentType: ContentTypeSchema,
  outcome: UxRenderRepairOutcomeSchema
});

/** A direct canvas edit; `afterAgent` when the slot's latest revision came from an agent. */
const GraphEditSignal = z.strictObject({
  kind: z.literal('graph_edit'),
  contentType: ContentTypeSchema,
  afterAgent: z.boolean()
});

export const UxServerSignalSchema = z.discriminatedUnion('kind', [
  RenderRepairSignal,
  GraphEditSignal
]);

/** Every kind that may appear in a `ux_signal` log line. */
export const UxSignalSchema = z.discriminatedUnion('kind', [
  ...UxClientSignalSchema.options,
  ...UxServerSignalSchema.options
]);

/** The body of `POST /api/signals`. */
export const UxClientSignalBatchSchema = z.strictObject({
  v: z.literal(UX_SIGNAL_SCHEMA_VERSION),
  signals: z.array(UxClientSignalSchema).min(1).max(UX_SIGNAL_BATCH_MAX)
});

export type UxClientSignal = z.infer<typeof UxClientSignalSchema>;
export type UxServerSignal = z.infer<typeof UxServerSignalSchema>;
export type UxSignal = z.infer<typeof UxSignalSchema>;
export type UxSignalKind = UxSignal['kind'];
export type UxClientSignalBatch = z.infer<typeof UxClientSignalBatchSchema>;
export type UxElapsedBucket = z.infer<typeof UxElapsedBucketSchema>;
export type UxSessionBucket = z.infer<typeof UxSessionBucketSchema>;
export type UxErrorName = z.infer<typeof UxErrorNameSchema>;

export const UX_CLIENT_SIGNAL_KINDS: readonly UxClientSignal['kind'][] =
  UxClientSignalSchema.options.map((option) => option.shape.kind.value);
export const UX_SERVER_SIGNAL_KINDS: readonly UxServerSignal['kind'][] =
  UxServerSignalSchema.options.map((option) => option.shape.kind.value);

/** Bucket a short span in milliseconds. Negative or non-finite input reads as the first bucket. */
export function bucketUxElapsedMs(ms: number): UxElapsedBucket {
  const value = Number.isFinite(ms) && ms > 0 ? ms : 0;
  if (value < 10_000) return 'lt_10s';
  if (value < 30_000) return '10s_30s';
  if (value < 120_000) return '30s_2m';
  if (value < 600_000) return '2m_10m';
  return 'gt_10m';
}

/** Bucket a page-session length in milliseconds. */
export function bucketUxSessionMs(ms: number): UxSessionBucket {
  const value = Number.isFinite(ms) && ms > 0 ? ms : 0;
  if (value < 60_000) return 'lt_1m';
  if (value < 300_000) return '1m_5m';
  if (value < 900_000) return '5m_15m';
  if (value < 3_600_000) return '15m_60m';
  return 'gt_60m';
}

/** Map any thrown value to an allowlisted constructor name — never its message. */
export function classifyUxErrorName(error: unknown): UxErrorName {
  const name =
    error && typeof error === 'object' && 'name' in error ? String(error.name) : undefined;
  const parsed = UxErrorNameSchema.safeParse(name);
  return parsed.success ? parsed.data : 'other';
}

/** Clamp a counter into the schema's range so a runaway tab cannot produce an invalid summary. */
export function clampUxCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.floor(value), UX_SIGNAL_COUNT_MAX);
}
