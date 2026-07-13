import { buildAgentCostEstimatesPayload, type AgentCostEstimatesPayload } from '@archislop/shared';
import { resolveHealthCheckUrl } from '../utils/coldStartGate.js';

let cached: AgentCostEstimatesPayload | null = null;
let inflight: Promise<AgentCostEstimatesPayload> | null = null;

const DISABLED: AgentCostEstimatesPayload = {
  enabled: false,
  pricingUrl: 'https://cloud.google.com/vertex-ai/generative-ai/pricing',
  rates: {}
};

/** Fetch `/api/health` agent-cost config (cached). Defaults to disabled when unreachable. */
export async function loadAgentCostEstimates(): Promise<AgentCostEstimatesPayload> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const response = await fetch(resolveHealthCheckUrl(), { cache: 'no-store' });
      if (!response.ok) throw new Error(`health ${response.status}`);
      const body = (await response.json()) as { agentCostEstimates?: AgentCostEstimatesPayload };
      const payload = body.agentCostEstimates ?? DISABLED;
      cached = payload.enabled ? payload : DISABLED;
      return cached;
    } catch {
      cached = DISABLED;
      return DISABLED;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Test hook — reset module cache between Vitest cases. */
export function resetAgentCostEstimatesCacheForTests(): void {
  cached = null;
  inflight = null;
}

/** Synchronous read after `loadAgentCostEstimates` has resolved at least once. */
export function getCachedAgentCostEstimates(): AgentCostEstimatesPayload {
  return cached ?? DISABLED;
}

/** Build a disabled payload (e.g. before health resolves). */
export function disabledAgentCostEstimates(): AgentCostEstimatesPayload {
  return DISABLED;
}

export function mergeAgentCostEstimatesPayload(
  remote: AgentCostEstimatesPayload | null | undefined
): AgentCostEstimatesPayload {
  if (!remote?.enabled) return DISABLED;
  return {
    enabled: true,
    pricingUrl: remote.pricingUrl || DISABLED.pricingUrl,
    rates: remote.rates ?? buildAgentCostEstimatesPayload({}).rates
  };
}
