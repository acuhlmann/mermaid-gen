// Headroom covers the latency-first syntax-fixer ladder (lite→flash→DeepSeek) plus
// a quality full-agent repair turn when Brain Fast was used for the first pass.
export const DEFAULT_AGENT_RUN_BUDGET_MS_FAST = 120_000;
export const DEFAULT_AGENT_RUN_BUDGET_MS_QUALITY = 210_000;
// Go Mad output fails validation more often than other modes (exotic diagram
// types, prompt-driven chaos) and may need a recovery or repair turn after the
// first pass; give it extra headroom so the fallback turn doesn't get cut off
// mid-stream ("BodyStreamBuffer aborted").
export const DEFAULT_AGENT_RUN_BUDGET_MS_FAST_GO_MAD = 150_000;
export const DEFAULT_AGENT_RUN_BUDGET_MS_QUALITY_GO_MAD = 240_000;
export const DEFAULT_AGENT_REPAIR_ATTEMPTS_FAST = 2;
export const DEFAULT_AGENT_REPAIR_ATTEMPTS_QUALITY = 2;

// Minimum remaining budget required to *start* another unit of repair work. A full agent
// repair turn that begins with a few seconds left cannot finish inside the budget — it
// burns the model call and then still fails, so the run "times out" instead of returning
// the actual validation error. Failing fast with the last validator diagnostic is both
// quicker and more informative.
export const MIN_AGENT_REPAIR_TURN_BUDGET_MS = 12_000;
/** Enough room to start the multi-rung fixer ladder (lite → flash → quality). */
export const MIN_SYNTAX_FIXER_BUDGET_MS = 18_000;

const BUDGET_CLAMP = Object.freeze({ min: 30_000, max: 300_000 });
const REPAIR_ATTEMPTS_CLAMP = Object.freeze({ min: 0, max: 6 });

export function normalizeAgentModelProfile(profile?: string) {
  return profile === 'quality' ? 'quality' : 'fast';
}

function parseInteger(value: unknown) {
  if (value == null || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

function clampInteger(value: number, bounds: { min: number; max: number }) {
  return Math.min(bounds.max, Math.max(bounds.min, value));
}

function readProfileEnv(
  env: Record<string, string | undefined> | undefined,
  baseName: string,
  profile: string
) {
  const suffix = profile === 'quality' ? 'QUALITY' : 'FAST';
  const profileValue = parseInteger(env?.[`${baseName}_${suffix}`]);
  if (profileValue != null) return profileValue;
  return parseInteger(env?.[baseName]);
}

export function resolveAgentRunBudgetMs(
  profile = 'fast',
  env: Record<string, string | undefined> = {},
  mode: string | null = null
) {
  const p = normalizeAgentModelProfile(profile);
  const isGoMad = mode === 'goMad';
  const fallback = isGoMad
    ? p === 'quality'
      ? DEFAULT_AGENT_RUN_BUDGET_MS_QUALITY_GO_MAD
      : DEFAULT_AGENT_RUN_BUDGET_MS_FAST_GO_MAD
    : p === 'quality'
      ? DEFAULT_AGENT_RUN_BUDGET_MS_QUALITY
      : DEFAULT_AGENT_RUN_BUDGET_MS_FAST;
  const configured = readProfileEnv(env, 'MERMAID_AGENT_RUN_BUDGET_MS', p);
  return clampInteger(configured ?? fallback, BUDGET_CLAMP);
}

export function resolveAgentRepairMaxAttempts(profile = 'fast', env = {}, contentType = 'mermaid') {
  const p = normalizeAgentModelProfile(profile);
  const fallback =
    p === 'quality' ? DEFAULT_AGENT_REPAIR_ATTEMPTS_QUALITY : DEFAULT_AGENT_REPAIR_ATTEMPTS_FAST;
  const baseName =
    contentType === 'infographic'
      ? 'INFOGRAPHIC_REPAIR_MAX_ATTEMPTS'
      : contentType === 'metaphor3d'
        ? 'METAPHOR_REPAIR_MAX_ATTEMPTS'
        : contentType === 'chart'
          ? 'CHART_REPAIR_MAX_ATTEMPTS'
          : contentType === 'anything'
            ? 'ANYTHING_REPAIR_MAX_ATTEMPTS'
            : contentType === 'forms'
              ? 'FORMS_REPAIR_MAX_ATTEMPTS'
              : 'MERMAID_REPAIR_MAX_ATTEMPTS';
  const configured = readProfileEnv(env, baseName, p);
  return clampInteger(configured ?? fallback, REPAIR_ATTEMPTS_CLAMP);
}

/**
 * Full-agent repair model profile for attempt `attempt` (1-based).
 * Attempt 1 follows Brain; attempt 2+ always climbs to Quality so Fast runs
 * still get a stronger salvage pass independent of the UI Brain setting.
 */
export function resolveAgentRepairAttemptProfile(profile = 'fast', attempt = 1) {
  if (Number(attempt) >= 2) return 'quality';
  return normalizeAgentModelProfile(profile);
}

export function buildAgentRunBudgetExceededMessage(
  profile = 'fast',
  budgetMs = resolveAgentRunBudgetMs(profile)
) {
  const seconds = Math.round(budgetMs / 1000);
  const p = normalizeAgentModelProfile(profile);
  const label = p === 'quality' ? 'Quality' : 'Fast';
  const suggestion =
    p === 'quality' ? 'Try Fast, a smaller diagram, or retry.' : 'Try a smaller diagram or retry.';
  return `Agent run exceeded the ${label} time limit (${seconds}s). ${suggestion}`;
}

/** Marker line prefix used to carry the root-cause validator diagnostic inside failure
 *  messages (e.g. budget-exceeded). The web client splits on this to render the detail. */
export const LAST_VALIDATION_ERROR_MARKER = 'Last validation error:';

const MAX_VALIDATION_DETAIL_LENGTH = 600;

/**
 * Append the most recent validator diagnostic to a run-failure message so the UI can show
 * *why* the run failed (what was invalid in the DSL), not just that it timed out. No-ops
 * when there is no diagnostic or it already equals the failure message.
 */
export function appendLastValidationError(message: string, lastError?: string | null): string {
  const base = String(message ?? '').trim();
  const detail = String(lastError ?? '').trim();
  if (!detail || detail === base) return base;
  const truncated =
    detail.length > MAX_VALIDATION_DETAIL_LENGTH
      ? `${detail.slice(0, MAX_VALIDATION_DETAIL_LENGTH - 1)}…`
      : detail;
  return `${base}\n${LAST_VALIDATION_ERROR_MARKER} ${truncated}`;
}

/**
 * Extract the validator diagnostic previously embedded by {@link appendLastValidationError}.
 * Returns null when the message carries no marker.
 */
export function extractLastValidationError(message?: string | null): string | null {
  const text = String(message ?? '');
  const idx = text.indexOf(LAST_VALIDATION_ERROR_MARKER);
  if (idx === -1) return null;
  const detail = text.slice(idx + LAST_VALIDATION_ERROR_MARKER.length).trim();
  return detail || null;
}
