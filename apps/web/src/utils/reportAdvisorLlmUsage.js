import { estimateLlmCostUsd } from '@archislop/shared';
import { addAdvisorLlmCostUsd, writeToStorage } from '../state/runGamificationStore.js';

/**
 * Default rate-table slug when the server omitted `model` but still reported
 * tokens. Decorative Fast (office / advisor / explain / labels) is flash-lite.
 */
const AUXILIARY_LLM_FALLBACK_MODEL = 'gemini-2.5-flash-lite';

/**
 * Fold a non-canvas LLM charge (office, advisor, label explain, explain-dumb)
 * into the lifetime total shown in the Stakeholder Damage Report.
 *
 * @param {object} args
 * @param {boolean} args.costTrackingEnabled
 * @param {object | null | undefined} args.rates
 * @param {{ inputTokens?: number, outputTokens?: number } | null | undefined} args.usage
 * @param {string | null | undefined} args.model
 * @param {(updater: (current: object) => object) => void} args.setGamification
 */
export function reportAdvisorLlmUsage({
  costTrackingEnabled,
  rates,
  usage,
  model,
  setGamification
}) {
  if (!costTrackingEnabled || !rates || !usage || typeof usage !== 'object') return;
  const inputTokens = Number(usage.inputTokens);
  const outputTokens = Number(usage.outputTokens);
  const resolvedModel =
    typeof model === 'string' && model.trim() ? model.trim() : AUXILIARY_LLM_FALLBACK_MODEL;
  const usd = estimateLlmCostUsd({
    inputTokens: Number.isFinite(inputTokens) ? inputTokens : undefined,
    outputTokens: Number.isFinite(outputTokens) ? outputTokens : undefined,
    model: resolvedModel,
    rates
  });
  if (!(typeof usd === 'number' && Number.isFinite(usd) && usd > 0)) return;
  setGamification((current) => {
    const next = addAdvisorLlmCostUsd(current, usd);
    if (next === current) return current;
    if (typeof window !== 'undefined') {
      writeToStorage(window.localStorage, next);
    }
    return next;
  });
}
