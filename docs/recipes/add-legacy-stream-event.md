# Add a legacy agent-stream event

When extending the built-in agent stream UI, update all four touchpoints:

1. **Shared contract** — add the shape to [`packages/shared/src/legacyStreamEvents.ts`](../../packages/shared/src/legacyStreamEvents.ts) and wire [`agentStreamEmitter.ts`](../../packages/shared/src/agentStreamEmitter.ts) `emitLegacy` if the server emits it.
2. **Web translator** — map AG-UI wire → legacy in [`apps/web/src/state/agUiTranslator.ts`](../../apps/web/src/state/agUiTranslator.ts).
3. **Insights reducer** — handle the legacy `type` in [`apps/web/src/state/applyAgentStreamInsightEvent.ts`](../../apps/web/src/state/applyAgentStreamInsightEvent.ts).
4. **Tests** — shared emitter test, server stream helper test (if any), web `diagramStore.adaptAgUi` or reducer test.

For analyze-time Gen UI artifacts (critique / explain / style), prefer [`apps/server/src/agents/agentStreamAnalyzeFinalize.ts`](../../apps/server/src/agents/agentStreamAnalyzeFinalize.ts) instead of duplicating three emit calls in LangChain agents.
