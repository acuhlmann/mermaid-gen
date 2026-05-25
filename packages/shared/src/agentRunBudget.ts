export const DEFAULT_AGENT_RUN_BUDGET_MS_FAST = 75_000;
export const DEFAULT_AGENT_RUN_BUDGET_MS_QUALITY = 150_000;
// Go Mad runs at hot temperatures and frequently needs a patch_retry turn after
// the first hot pass produces prose-without-patch; give it extra headroom so the
// fallback turn doesn't get cut off mid-stream ("BodyStreamBuffer aborted").
export const DEFAULT_AGENT_RUN_BUDGET_MS_FAST_GO_MAD = 105_000;
export const DEFAULT_AGENT_RUN_BUDGET_MS_QUALITY_GO_MAD = 180_000;
export const DEFAULT_AGENT_REPAIR_ATTEMPTS_FAST = 2;
export const DEFAULT_AGENT_REPAIR_ATTEMPTS_QUALITY = 2;

const BUDGET_CLAMP = Object.freeze({ min: 30_000, max: 180_000 });
const REPAIR_ATTEMPTS_CLAMP = Object.freeze({ min: 0, max: 6 });

export function normalizeAgentModelProfile(profile) {
  return profile === 'quality' ? 'quality' : 'fast';
}

function parseInteger(value) {
  if (value == null || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

function clampInteger(value, bounds) {
  return Math.min(bounds.max, Math.max(bounds.min, value));
}

function readProfileEnv(env, baseName, profile) {
  const suffix = profile === 'quality' ? 'QUALITY' : 'FAST';
  const profileValue = parseInteger(env?.[`${baseName}_${suffix}`]);
  if (profileValue != null) return profileValue;
  return parseInteger(env?.[baseName]);
}

export function resolveAgentRunBudgetMs(profile = 'fast', env = {}, mode = null) {
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
          : 'MERMAID_REPAIR_MAX_ATTEMPTS';
  const configured = readProfileEnv(env, baseName, p);
  return clampInteger(configured ?? fallback, REPAIR_ATTEMPTS_CLAMP);
}

export function buildAgentRunBudgetExceededMessage(profile = 'fast', budgetMs = resolveAgentRunBudgetMs(profile)) {
  const seconds = Math.round(budgetMs / 1000);
  const p = normalizeAgentModelProfile(profile);
  const label = p === 'quality' ? 'Quality' : 'Fast';
  const suggestion = p === 'quality' ? 'Try Fast, a smaller diagram, or retry.' : 'Try a smaller diagram or retry.';
  return `Agent run exceeded the ${label} time limit (${seconds}s). ${suggestion}`;
}
