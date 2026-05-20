# Agent blast radius — wire change checklist

Recipes in [`docs/recipes/`](../docs/recipes/) describe **how** to add a feature. This doc lists **what else must change** when you touch a contract so coding agents do not ship producer-only diffs.

## AG-UI custom stream event (built-in agents)

| Layer | Location |
| ----- | -------- |
| Schema / legacy union | [`packages/shared/src/legacyStreamEvents.ts`](../packages/shared/src/legacyStreamEvents.ts), [`agUiWireConstants.ts`](../packages/shared/src/agUiWireConstants.ts) |
| Emitter | [`packages/shared/src/agentStreamEmitter.ts`](../packages/shared/src/agentStreamEmitter.ts) |
| Server emit point | [`apps/server/src/agents/agentStreamAnalyzeFinalize.ts`](../apps/server/src/agents/agentStreamAnalyzeFinalize.ts) or LangChain agent |
| Web translator | [`apps/web/src/state/agUiTranslator.ts`](../apps/web/src/state/agUiTranslator.ts) |
| Insight reducer | [`apps/web/src/state/applyAgentStreamInsightEvent.ts`](../apps/web/src/state/applyAgentStreamInsightEvent.ts) |
| UI | [`apps/web/src/components/InsightsPane.jsx`](../apps/web/src/components/InsightsPane.jsx) or sibling surface |
| Tests | [`packages/shared/test/wireRoundTrip.test.ts`](../packages/shared/test/wireRoundTrip.test.ts), [`apps/web/test/wireAgUiTranslator.test.ts`](../apps/web/test/wireAgUiTranslator.test.ts), [`apps/server/test/copilotRoute.test.js`](../apps/server/test/copilotRoute.test.js) |
| Docs | [`docs/architecture-ag-ui.md`](../docs/architecture-ag-ui.md), recipe [`add-agent-stream-event.md`](../docs/recipes/add-agent-stream-event.md) |

Run: `npm run check:wire`

## Session-events SSE (collaboration)

| Layer | Location |
| ----- | -------- |
| Bus schema + publish | [`apps/server/src/state/sessionEventBus.ts`](../apps/server/src/state/sessionEventBus.ts) |
| Producer (route / MCP / tool) | Matching handler in [`copilot.js`](../apps/server/src/routes/copilot.js) or [`mcpServer.js`](../apps/server/src/mcp/mcpServer.js) |
| Web client | [`apps/web/src/state/sessionEventsClient.js`](../apps/web/src/state/sessionEventsClient.js) |
| MCP App bridge (if UI) | [`apps/server/src/mcp/apps/mcpAppSessionBridge.js`](../apps/server/src/mcp/apps/mcpAppSessionBridge.js) + App HTML bundle |
| Tests | [`apps/server/test/sessionEventBus.test.js`](../apps/server/test/sessionEventBus.test.js) |
| Docs | [`docs/architecture-external-agents.md`](../docs/architecture-external-agents.md) |

## HTTP / Zod body (intent, transform, analyze, style)

| Layer | Location |
| ----- | -------- |
| Schema | [`packages/shared/src/diagramSchema.ts`](../packages/shared/src/diagramSchema.ts) |
| Inferred types | [`apps/server/src/routes/copilotRouteTypes.ts`](../apps/server/src/routes/copilotRouteTypes.ts) |
| Route handler | [`apps/server/src/routes/copilot.js`](../apps/server/src/routes/copilot.js) |
| Web client | [`apps/web/src/state/diagramStore.js`](../apps/web/src/state/diagramStore.js), [`App.jsx`](../apps/web/src/App.jsx) |
| Tests | [`apps/server/test/copilotRoute.test.js`](../apps/server/test/copilotRoute.test.js), [`packages/shared/test/diagramSchema.test.ts`](../packages/shared/test/diagramSchema.test.ts) |

Run: `npm run check:fast` when only shared changed; `npm run check` otherwise.

## MCP tool

| Layer | Location |
| ----- | -------- |
| Tool registration | [`apps/server/src/mcp/mcpServer.js`](../apps/server/src/mcp/mcpServer.js) |
| Optional App HTML | [`apps/server/src/mcp/apps/`](../apps/server/src/mcp/apps/) |
| Tests | [`apps/server/test/mcpServer.test.js`](../apps/server/test/mcpServer.test.js) |
| Docs | [`docs/guide/external-agents.md`](../docs/guide/external-agents.md) |

## Mermaid validation / sanitizer

| Layer | Location |
| ----- | -------- |
| Shared sanitizer | [`packages/shared/src/mermaidSanitizer.ts`](../packages/shared/src/mermaidSanitizer.ts) |
| Server tool | [`apps/server/src/tools/mermaidDiffTool.js`](../apps/server/src/tools/mermaidDiffTool.js) |
| Rule pack | [`apps/server/src/prompts/mermaidSyntaxGuard.js`](../apps/server/src/prompts/mermaidSyntaxGuard.js) |
| Tests | [`packages/shared/test/mermaidSanitizer.test.ts`](../packages/shared/test/mermaidSanitizer.test.ts), server agent tests |

## Verification commands (quick reference)

| Scope | Command |
| ----- | ------- |
| Shared only | `npm run check:fast` |
| Default | `npm run check` |
| Before PR / CI parity | `npm run check:full` |
| Wire + doc paths | `npm run check:wire` |
| Doc links only | `npm run verify:doc-paths` |
| Server strict TS islands | `npm run typecheck:strict -w apps/server` |
