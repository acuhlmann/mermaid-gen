import { useEffect, useState } from 'react';
import {
  getCachedAgentCostEstimates,
  loadAgentCostEstimates
} from '../../state/agentCostEstimates.js';
import {
  reconcileLifetimeLlmCostUsd,
  writeToStorage as writeGamificationToStorage
} from '../../state/runGamificationStore.js';

/**
 * Load agent cost estimates and persist gamification + reconcile LLM spend from insights.
 *
 * @param {{
 *   agentCostEstimatesRef: import('react').MutableRefObject<object>;
 *   gamification: object;
 *   insightsEntries: Array<object>;
 *   setGamification: import('react').Dispatch<import('react').SetStateAction<object>>;
 * }} deps
 */
export function useGamificationPersistence({
  agentCostEstimatesRef,
  gamification,
  insightsEntries,
  setGamification
}) {
  const [costTrackingEnabled, setCostTrackingEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAgentCostEstimates().then((payload) => {
      if (!cancelled) {
        agentCostEstimatesRef.current = payload;
        setCostTrackingEnabled(payload.enabled === true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [agentCostEstimatesRef]);

  useEffect(() => {
    if (!costTrackingEnabled) return;
    setGamification((current) => {
      const reconciled = reconcileLifetimeLlmCostUsd(current, insightsEntries);
      if (reconciled.lifetimeLlmCostUsd === current.lifetimeLlmCostUsd) return current;
      return reconciled;
    });
  }, [costTrackingEnabled, insightsEntries, setGamification]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    writeGamificationToStorage(window.localStorage, gamification);
  }, [gamification]);

  return { costTrackingEnabled };
}
