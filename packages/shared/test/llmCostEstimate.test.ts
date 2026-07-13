import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAgentCostEstimatesPayload,
  estimateLlmCostUsd,
  formatEstimatedCostUsd,
  formatLifetimeEstimatedCostUsd,
  formatRunEstimatedCostUsd,
  formatModelUsageWithCost,
  isAgentCostEstimateEnabled,
  lifetimeLlmCostFlavor,
  mergeLlmTokenRates,
  normalizeLlmModelSlug,
  readLlmCostEnvOverrides,
  resolveLlmTokenRates
} from '../src/llmCostEstimate.js';

test('isAgentCostEstimateEnabled follows Cloud Run and explicit env', () => {
  assert.equal(isAgentCostEstimateEnabled({}), false);
  assert.equal(isAgentCostEstimateEnabled({ K_SERVICE: 'mermaid-gen-main' }), true);
  assert.equal(isAgentCostEstimateEnabled({ LLM_COST_ESTIMATES: '1' }), true);
  assert.equal(isAgentCostEstimateEnabled({ K_SERVICE: 'svc', LLM_COST_ESTIMATES: '0' }), false);
});

test('normalizeLlmModelSlug strips provider prefixes', () => {
  assert.equal(normalizeLlmModelSlug('google/gemini-2.5-flash-lite'), 'gemini-2.5-flash-lite');
  assert.equal(normalizeLlmModelSlug('gemini-2.5-flash'), 'gemini-2.5-flash');
});

test('readLlmCostEnvOverrides parses per-model env keys', () => {
  const overrides = readLlmCostEnvOverrides({
    LLM_COST_USD_PER_M_GEMINI_2_5_FLASH_INPUT: '0.42',
    LLM_COST_USD_PER_M_GEMINI_2_5_FLASH_OUTPUT: '3.00'
  });
  assert.deepEqual(overrides['gemini-2.5-flash'], { inputPerM: 0.42, outputPerM: 3 });
});

test('estimateLlmCostUsd uses Vertex flash defaults', () => {
  const rates = mergeLlmTokenRates({});
  const usd = estimateLlmCostUsd({
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
    model: 'gemini-2.5-flash',
    rates
  });
  assert.equal(usd, 0.3 + 2.5);
});

test('resolveLlmTokenRates falls back to flash tier for unknown flash slugs', () => {
  const rates = mergeLlmTokenRates({});
  assert.deepEqual(
    resolveLlmTokenRates('gemini-3.5-flash-preview', rates),
    rates['gemini-2.5-flash']
  );
});

test('formatModelUsageWithCost appends USD label when enabled', () => {
  const rates = mergeLlmTokenRates({});
  const { detail, costUsd } = formatModelUsageWithCost(
    { inputTokens: 812, outputTokens: 96, model: 'gemini-2.5-flash' },
    rates
  );
  assert.ok(detail.includes('812 tokens in'));
  assert.ok(detail.includes('96 tokens out'));
  assert.ok(detail.includes('~$'));
  assert.ok(costUsd != null && costUsd > 0);
});

test('formatEstimatedCostUsd scales precision for small amounts', () => {
  assert.equal(formatEstimatedCostUsd(0.052), '~$0.05');
  assert.equal(formatEstimatedCostUsd(0.0042), '~$0.004');
});

test('formatRunEstimatedCostUsd uses cents for sub-dollar run totals', () => {
  assert.equal(formatRunEstimatedCostUsd(0.052), '~$0.05 est.');
  assert.equal(formatRunEstimatedCostUsd(0.008), '~0.80¢ est.');
  assert.equal(formatRunEstimatedCostUsd(0.0008), '~0.08¢ est.');
});

test('formatLifetimeEstimatedCostUsd mirrors run totals without the est suffix', () => {
  assert.equal(formatLifetimeEstimatedCostUsd(1.42), '~$1.42');
  assert.equal(formatLifetimeEstimatedCostUsd(0.008), '~0.80¢');
  assert.equal(formatLifetimeEstimatedCostUsd(0.0008), '~0.08¢');
});

test('lifetimeLlmCostFlavor returns parody tiers', () => {
  assert.match(lifetimeLlmCostFlavor(0).quip, /CFO/i);
  assert.equal(lifetimeLlmCostFlavor(0.02).severity, 'petty');
  assert.equal(lifetimeLlmCostFlavor(0.008).headline, '~0.80¢');
  assert.equal(lifetimeLlmCostFlavor(2.5).severity, 'expense');
  assert.equal(lifetimeLlmCostFlavor(30).severity, 'incident');
});

test('buildAgentCostEstimatesPayload disables locally by default', () => {
  const payload = buildAgentCostEstimatesPayload({});
  assert.equal(payload.enabled, false);
  assert.ok(payload.rates['gemini-2.5-flash']);
});
