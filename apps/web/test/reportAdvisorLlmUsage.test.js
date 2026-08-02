import { describe, expect, it, vi } from 'vitest';
import { reportAdvisorLlmUsage } from '../src/utils/reportAdvisorLlmUsage.js';

const RATES = {
  'gemini-2.5-flash-lite': { inputPerM: 0.1, outputPerM: 0.4 },
  'gemini-2.5-flash': { inputPerM: 0.3, outputPerM: 2.5 }
};

describe('reportAdvisorLlmUsage', () => {
  it('adds office/advisor-shaped usage into gamification lifetime cost', () => {
    let state = { lifetimeLlmCostUsd: 0, advisorLlmCostUsd: 0 };
    const setGamification = (updater) => {
      state = updater(state);
    };
    reportAdvisorLlmUsage({
      costTrackingEnabled: true,
      rates: RATES,
      usage: { inputTokens: 1_000_000, outputTokens: 0 },
      model: 'gemini-2.5-flash-lite',
      setGamification
    });
    expect(state.advisorLlmCostUsd).toBeCloseTo(0.1, 5);
    expect(state.lifetimeLlmCostUsd).toBeCloseTo(0.1, 5);
  });

  it('falls back to flash-lite rates when model is missing but tokens are present', () => {
    let state = { lifetimeLlmCostUsd: 0, advisorLlmCostUsd: 0 };
    const setGamification = (updater) => {
      state = updater(state);
    };
    reportAdvisorLlmUsage({
      costTrackingEnabled: true,
      rates: RATES,
      usage: { inputTokens: 1_000_000, outputTokens: 0 },
      model: null,
      setGamification
    });
    expect(state.lifetimeLlmCostUsd).toBeCloseTo(0.1, 5);
  });

  it('no-ops when cost tracking is disabled', () => {
    const setGamification = vi.fn();
    reportAdvisorLlmUsage({
      costTrackingEnabled: false,
      rates: RATES,
      usage: { inputTokens: 100, outputTokens: 10 },
      model: 'gemini-2.5-flash-lite',
      setGamification
    });
    expect(setGamification).not.toHaveBeenCalled();
  });
});
