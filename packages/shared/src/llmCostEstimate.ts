/**
 * Estimated LLM spend from reported token usage. Rates default to published Vertex
 * Gemini list prices; override per model via env on the server (see docs/llm-config.md).
 */

import bundledRatesDocument from './data/llm-token-rates.json' with { type: 'json' };

export type LlmTokenRates = {
  inputPerM: number;
  outputPerM: number;
};

export type AgentCostEstimatesPayload = {
  enabled: boolean;
  /** Canonical pricing page operators should check when updating overrides. */
  pricingUrl: string;
  /** Normalized model slug → USD per 1M tokens (input/output). */
  rates: Record<string, LlmTokenRates>;
  ratesVersion?: string | null;
  ratesUpdatedAt?: number;
  ratesSources?: string[];
};

function parseBundledRatesDocument(doc: unknown): Record<string, LlmTokenRates> {
  if (!doc || typeof doc !== 'object') return {};
  const rates = (doc as { rates?: unknown }).rates;
  if (!rates || typeof rates !== 'object') return {};
  const out: Record<string, LlmTokenRates> = {};
  for (const [model, value] of Object.entries(rates as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const inputPerM = Number((value as LlmTokenRates).inputPerM);
    const outputPerM = Number((value as LlmTokenRates).outputPerM);
    if (!Number.isFinite(inputPerM) || !Number.isFinite(outputPerM)) continue;
    out[normalizeLlmModelSlug(model)] = { inputPerM, outputPerM };
  }
  return out;
}

/** Bundled Vertex/OpenRouter list prices (USD per 1M tokens). Update `src/data/llm-token-rates.json`. */
export const DEFAULT_LLM_TOKEN_RATES: Record<string, LlmTokenRates> =
  parseBundledRatesDocument(bundledRatesDocument);

export const BUNDLED_LLM_RATES_VERSION =
  typeof (bundledRatesDocument as { version?: unknown }).version === 'string'
    ? (bundledRatesDocument as { version: string }).version
    : null;

export const VERTEX_GEMINI_PRICING_URL =
  typeof (bundledRatesDocument as { pricingUrl?: unknown }).pricingUrl === 'string' &&
  (bundledRatesDocument as { pricingUrl: string }).pricingUrl.trim()
    ? (bundledRatesDocument as { pricingUrl: string }).pricingUrl.trim()
    : 'https://cloud.google.com/vertex-ai/generative-ai/pricing';

function envTruthy(value: unknown): boolean {
  if (value == null) return false;
  const s = String(value).trim().toLowerCase();
  return s !== '' && s !== '0' && s !== 'false' && s !== 'no' && s !== 'off';
}

/** Normalize provider model slugs for rate-table lookup. */
export function normalizeLlmModelSlug(model: string): string {
  const trimmed = String(model).trim().toLowerCase();
  if (!trimmed) return '';
  const tail = trimmed.includes('/') ? trimmed.split('/').pop()! : trimmed;
  return tail.replace(/_/g, '-');
}

function finitePositive(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Whether the thinking panel should show USD estimates.
 * On by default when running on Cloud Run (`K_SERVICE`); opt in locally with `LLM_COST_ESTIMATES=1`.
 */
export function isAgentCostEstimateEnabled(env: Record<string, string | undefined> = {}): boolean {
  if (env.LLM_COST_ESTIMATES != null) {
    const s = String(env.LLM_COST_ESTIMATES).trim().toLowerCase();
    if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false;
    if (envTruthy(env.LLM_COST_ESTIMATES)) return true;
  }
  return Boolean(env.K_SERVICE);
}

function envModelKeyToSlug(modelKey: string): string {
  const dashed = modelKey.toLowerCase().replace(/_/g, '-');
  return dashed.replace(/(\d)-(\d)/g, '$1.$2');
}

/**
 * Read per-model overrides from env:
 * `LLM_COST_USD_PER_M_<NORMALIZED_MODEL>_INPUT=0.30`
 * `LLM_COST_USD_PER_M_<NORMALIZED_MODEL>_OUTPUT=2.50`
 * where NORMALIZED_MODEL uses underscores (e.g. `GEMINI_2_5_FLASH` → `gemini-2.5-flash`).
 */
export function readLlmCostEnvOverrides(
  env: Record<string, string | undefined> = {}
): Record<string, LlmTokenRates> {
  const prefix = 'LLM_COST_USD_PER_M_';
  const partial: Record<string, Partial<LlmTokenRates>> = {};

  for (const [key, raw] of Object.entries(env)) {
    if (!key.startsWith(prefix) || raw == null) continue;
    const rest = key.slice(prefix.length);
    const match = rest.match(/^(.+)_(INPUT|OUTPUT)$/);
    if (!match) continue;
    const modelKey = envModelKeyToSlug(match[1]);
    const field = match[2] === 'INPUT' ? 'inputPerM' : 'outputPerM';
    const value = finitePositive(raw);
    if (value == null || !modelKey) continue;
    partial[modelKey] = { ...partial[modelKey], [field]: value };
  }

  const out: Record<string, LlmTokenRates> = {};
  for (const [modelKey, rates] of Object.entries(partial)) {
    if (
      typeof rates.inputPerM === 'number' &&
      typeof rates.outputPerM === 'number' &&
      Number.isFinite(rates.inputPerM) &&
      Number.isFinite(rates.outputPerM)
    ) {
      out[modelKey] = { inputPerM: rates.inputPerM, outputPerM: rates.outputPerM };
    }
  }
  return out;
}

export function mergeLlmTokenRates(
  env: Record<string, string | undefined> = {}
): Record<string, LlmTokenRates> {
  return {
    ...DEFAULT_LLM_TOKEN_RATES,
    ...readLlmCostEnvOverrides(env)
  };
}

export function resolveLlmTokenRates(
  model: string | null | undefined,
  rates: Record<string, LlmTokenRates>
): LlmTokenRates | null {
  const slug = normalizeLlmModelSlug(model ?? '');
  if (!slug) return null;
  if (rates[slug]) return rates[slug];

  const flashLite = slug.includes('flash-lite');
  if (flashLite && rates['gemini-2.5-flash-lite']) return rates['gemini-2.5-flash-lite'];

  const flash = slug.includes('flash');
  if (flash && rates['gemini-2.5-flash']) return rates['gemini-2.5-flash'];

  const pro = slug.includes('pro');
  if (pro && rates['gemini-2.5-pro']) return rates['gemini-2.5-pro'];

  return null;
}

export function estimateLlmCostUsd({
  inputTokens,
  outputTokens,
  model,
  rates
}: {
  inputTokens?: number;
  outputTokens?: number;
  model?: string | null;
  rates: Record<string, LlmTokenRates>;
}): number | null {
  const table = resolveLlmTokenRates(model, rates);
  if (!table) return null;
  const input = Number.isFinite(inputTokens) ? (inputTokens as number) : 0;
  const output = Number.isFinite(outputTokens) ? (outputTokens as number) : 0;
  if (input <= 0 && output <= 0) return null;
  const usd = (input * table.inputPerM + output * table.outputPerM) / 1_000_000;
  if (!Number.isFinite(usd) || usd <= 0) return null;
  return usd;
}

/** Human label for thinking-panel chips and per-turn outcome lines. */
export function formatEstimatedCostUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return '';
  if (usd >= 0.01) return `~$${usd.toFixed(2)}`;
  if (usd >= 0.001) return `~$${usd.toFixed(3)}`;
  if (usd >= 0.0001) return `~$${usd.toFixed(4)}`;
  return '~<$0.0001';
}

/**
 * Prominent run-total label for the thinking-panel header/footer.
 * Uses cents for sub-dollar amounts so small per-turn fees read clearly when summed.
 */
export function formatRunEstimatedCostUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return '';
  if (usd >= 1) return `~$${usd.toFixed(2)} est.`;
  if (usd >= 0.01) return `~$${usd.toFixed(2)} est.`;
  const cents = usd * 100;
  if (cents >= 1) return `~${cents.toFixed(1)}¢ est.`;
  if (cents >= 0.1) return `~${cents.toFixed(2)}¢ est.`;
  return `~${Math.max(0.01, Math.ceil(cents * 100) / 100)}¢ est.`;
}

export type LifetimeLlmCostFlavor = {
  headline: string;
  quip: string;
  severity: 'idle' | 'petty' | 'expense' | 'budget' | 'incident';
};

/** Parody tier copy for the Slopitect level panel damage report. */
export function lifetimeLlmCostFlavor(usd: number): LifetimeLlmCostFlavor {
  const safe = Number.isFinite(usd) && usd > 0 ? usd : 0;
  if (safe <= 0) {
    return {
      headline: '$0.00',
      quip: 'No billable chaos yet. Your CFO still believes this is "just a diagram tool."',
      severity: 'idle'
    };
  }
  const headline = formatEstimatedCostUsd(safe) || '~$0.00';
  if (safe < 0.05) {
    return {
      headline,
      quip: 'Petty-cash tier. Finance will round this to zero and move on.',
      severity: 'petty'
    };
  }
  if (safe < 0.5) {
    return {
      headline,
      quip: 'Enough to buy one (1) artisanal oat-milk latte for the platform team.',
      severity: 'petty'
    };
  }
  if (safe < 5) {
    return {
      headline,
      quip: 'Expense-report energy. Someone will ask which cost center owns "Go Mad."',
      severity: 'expense'
    };
  }
  if (safe < 25) {
    return {
      headline,
      quip: 'A respectable pilot budget — if the pilot never ends.',
      severity: 'budget'
    };
  }
  return {
    headline,
    quip: 'FinOps has opened a war room. Congratulations, you are the incident.',
    severity: 'incident'
  };
}

export function formatModelUsageDetail(evt: {
  inputTokens?: number;
  outputTokens?: number;
}): string {
  const parts: string[] = [];
  if (Number.isFinite(evt.inputTokens)) parts.push(`${evt.inputTokens} tokens in`);
  if (Number.isFinite(evt.outputTokens)) parts.push(`${evt.outputTokens} tokens out`);
  return parts.join(' · ');
}

export function formatModelUsageWithCost(
  evt: { inputTokens?: number; outputTokens?: number; model?: string | null },
  rates: Record<string, LlmTokenRates> | null | undefined
): { detail: string; costUsd: number | null } {
  const usageDetail = formatModelUsageDetail(evt);
  if (!rates) return { detail: usageDetail, costUsd: null };
  const costUsd = estimateLlmCostUsd({
    inputTokens: evt.inputTokens,
    outputTokens: evt.outputTokens,
    model: evt.model,
    rates
  });
  if (costUsd == null) return { detail: usageDetail, costUsd: null };
  const costLabel = formatEstimatedCostUsd(costUsd);
  const detail = [usageDetail, costLabel].filter(Boolean).join(' · ');
  return { detail, costUsd };
}

export function buildAgentCostEstimatesPayload(
  env: Record<string, string | undefined> = {}
): AgentCostEstimatesPayload {
  return {
    enabled: isAgentCostEstimateEnabled(env),
    pricingUrl: VERTEX_GEMINI_PRICING_URL,
    rates: mergeLlmTokenRates(env)
  };
}
