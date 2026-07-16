import { estimateLlmCostUsd } from '@archislop/shared';
import { addAdvisorLlmCostUsd, writeToStorage } from '../state/runGamificationStore.js';

/**
 * Fold a stakeholder-advisor or explain-dumb LLM charge into the lifetime total
 * shown in the Stakeholder Damage Report.
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
  const usd = estimateLlmCostUsd({
    inputTokens: Number.isFinite(inputTokens) ? inputTokens : undefined,
    outputTokens: Number.isFinite(outputTokens) ? outputTokens : undefined,
    model,
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
