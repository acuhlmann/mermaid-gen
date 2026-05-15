/**
 * Persist + broadcast attributed insights (web SSE + MCP feed).
 */
export function publishAttributedInsight({ insightStore, eventBus, sessionId, insight }) {
  insightStore.append(insight);
  eventBus.publish(sessionId, {
    type: 'attributed_insight',
    payload: insight
  });
  return insight;
}
