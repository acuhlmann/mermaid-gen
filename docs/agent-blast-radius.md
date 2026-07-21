# Agent blast radius — wire change checklist

Recipes in [`docs/recipes/`](../docs/recipes/) describe **how** to add a feature. This doc lists **what else must change** when you touch a contract so coding agents do not ship producer-only diffs.

## AG-UI custom stream event (built-in agents)

| Layer                 | Location                                                                                                                                                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema / legacy union | [`packages/shared/src/legacyStreamEvents.ts`](../packages/shared/src/legacyStreamEvents.ts), [`agUiWireConstants.ts`](../packages/shared/src/agUiWireConstants.ts)                                                                                                            |
| Emitter               | [`packages/shared/src/agentStreamEmitter.ts`](../packages/shared/src/agentStreamEmitter.ts)                                                                                                                                                                                   |
| Server emit point     | [`apps/server/src/agents/agentStreamAnalyzeFinalize.ts`](../apps/server/src/agents/agentStreamAnalyzeFinalize.ts) or LangChain agent                                                                                                                                          |
| Web translator        | [`apps/web/src/state/agUiTranslator.ts`](../apps/web/src/state/agUiTranslator.ts)                                                                                                                                                                                             |
| Insight reducer       | [`apps/web/src/state/applyAgentStreamInsightEvent.ts`](../apps/web/src/state/applyAgentStreamInsightEvent.ts)                                                                                                                                                                 |
| UI                    | [`apps/web/src/components/InsightsPane.jsx`](../apps/web/src/components/InsightsPane.jsx) or sibling surface                                                                                                                                                                  |
| Tests                 | [`packages/shared/test/wireRoundTrip.test.ts`](../packages/shared/test/wireRoundTrip.test.ts), [`apps/web/test/wireAgUiTranslator.test.js`](../apps/web/test/wireAgUiTranslator.test.js), [`apps/server/test/copilotRoute.test.js`](../apps/server/test/copilotRoute.test.js) |
| Docs                  | [`docs/architecture-ag-ui.md`](../docs/architecture-ag-ui.md), recipe [`add-agent-stream-event.md`](../docs/recipes/add-agent-stream-event.md)                                                                                                                                |

Run: `npm run check:wire`

## Session-events SSE (collaboration)

| Layer                         | Location                                                                                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bus schema + publish          | [`apps/server/src/state/sessionEventBus.ts`](../apps/server/src/state/sessionEventBus.ts)                                                                                              |
| Producer (route / MCP / tool) | Matching handler in [`copilot.ts`](../apps/server/src/routes/copilot.ts) or [`mcpServer.js`](../apps/server/src/mcp/mcpServer.js)                                                      |
| Web client                    | [`apps/web/src/state/sessionEventsClient.js`](../apps/web/src/state/sessionEventsClient.js)                                                                                            |
| MCP App bridge (if UI)        | [`apps/server/src/mcp/apps/mcpAppSessionBridge.js`](../apps/server/src/mcp/apps/mcpAppSessionBridge.js) + App HTML bundle                                                              |
| Tests                         | [`apps/server/test/sessionEventBus.test.js`](../apps/server/test/sessionEventBus.test.js), [`apps/web/test/sessionEventsClient.test.js`](../apps/web/test/sessionEventsClient.test.js) |
| Docs                          | [`docs/architecture-external-agents.md`](../docs/architecture-external-agents.md)                                                                                                      |

## Chart validation ladder

| Layer         | Location                                                                                                                                                                                                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared schema | [`packages/shared/src/chartSchema.ts`](../packages/shared/src/chartSchema.ts)                                                                                                                                                                                               |
| Server tool   | [`apps/server/src/tools/chartDslTool.js`](../apps/server/src/tools/chartDslTool.js)                                                                                                                                                                                         |
| Syntax fixer  | [`apps/server/src/agents/chartSyntaxFixer.js`](../apps/server/src/agents/chartSyntaxFixer.js)                                                                                                                                                                               |
| Tests         | [`packages/shared/test/chartSchema.test.ts`](../packages/shared/test/chartSchema.test.ts), [`apps/server/test/chartDslTool.test.js`](../apps/server/test/chartDslTool.test.js), [`apps/server/test/chartSyntaxFixer.test.js`](../apps/server/test/chartSyntaxFixer.test.js) |

## Forms validation ladder

| Layer             | Location                                                                                                                                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared parse gate | [`packages/shared/src/formsA2ui.ts`](../packages/shared/src/formsA2ui.ts)                                                                                                                                                                                                       |
| Server tool       | [`apps/server/src/tools/formsA2uiTool.js`](../apps/server/src/tools/formsA2uiTool.js)                                                                                                                                                                                           |
| Tests             | [`packages/shared/test/formsA2ui.test.ts`](../packages/shared/test/formsA2ui.test.ts), [`apps/server/test/formsA2uiTool.test.js`](../apps/server/test/formsA2uiTool.test.js), [`apps/server/test/formsLangChainAgent.test.js`](../apps/server/test/formsLangChainAgent.test.js) |

## HTTP / Zod body (intent, transform, analyze, style)

| Layer          | Location                                                                                                                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema         | [`packages/shared/src/diagramSchema.ts`](../packages/shared/src/diagramSchema.ts)                                                                                                                                                                                                           |
| Inferred types | [`apps/server/src/routes/copilotRouteTypes.ts`](../apps/server/src/routes/copilotRouteTypes.ts)                                                                                                                                                                                             |
| Route handler  | [`apps/server/src/routes/copilot.ts`](../apps/server/src/routes/copilot.ts)                                                                                                                                                                                                                 |
| Dispatcher     | [`apps/server/src/agents/diagramAgentDispatcher.js`](../apps/server/src/agents/diagramAgentDispatcher.js)                                                                                                                                                                                   |
| Web client     | [`apps/web/src/state/diagramStore.js`](../apps/web/src/state/diagramStore.js), [`App.jsx`](../apps/web/src/App.jsx)                                                                                                                                                                         |
| Tests          | [`apps/server/test/copilotRoute.test.js`](../apps/server/test/copilotRoute.test.js), [`apps/server/test/diagramAgentDispatcher.test.js`](../apps/server/test/diagramAgentDispatcher.test.js), [`packages/shared/test/diagramSchema.test.ts`](../packages/shared/test/diagramSchema.test.ts) |

Run: `npm run check:fast` when only shared changed; `npm run check` otherwise.

## MCP tool

| Layer             | Location                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool registration | [`apps/server/src/mcp/tools/register*.js`](../apps/server/src/mcp/tools/) composed from [`mcpServer.js`](../apps/server/src/mcp/mcpServer.js) |
| Optional App HTML | [`apps/server/src/mcp/apps/`](../apps/server/src/mcp/apps/)                                                                                   |
| Tests             | [`apps/server/test/mcpServer.test.js`](../apps/server/test/mcpServer.test.js)                                                                 |
| Docs              | [`docs/guide/external-agents.md`](../docs/guide/external-agents.md)                                                                           |

## Mermaid validation / sanitizer

| Layer            | Location                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Shared sanitizer | [`packages/shared/src/mermaidSanitizer.ts`](../packages/shared/src/mermaidSanitizer.ts)                                 |
| Server tool      | [`apps/server/src/tools/mermaidDiffTool.js`](../apps/server/src/tools/mermaidDiffTool.js)                               |
| Rule pack        | [`apps/server/src/prompts/mermaidSyntaxGuard.js`](../apps/server/src/prompts/mermaidSyntaxGuard.js)                     |
| Tests            | [`packages/shared/test/mermaidSanitizer.test.ts`](../packages/shared/test/mermaidSanitizer.test.ts), server agent tests |

## Deliverable format UI (mode picker)

| Layer             | Location                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mode labels       | [`apps/web/src/i18n/locales/controls.en.js`](../apps/web/src/i18n/locales/controls.en.js) `contentModes`                                                                 |
| Option builder    | [`apps/web/src/utils/renderModeAction.js`](../apps/web/src/utils/renderModeAction.js)                                                                                    |
| Empty-state chips | [`apps/web/src/components/EntryRenderAs.jsx`](../apps/web/src/components/EntryRenderAs.jsx)                                                                              |
| Desk tray menu    | [`apps/web/src/components/DeskDrawer.jsx`](../apps/web/src/components/DeskDrawer.jsx)                                                                                    |
| Radial picker     | [`apps/web/src/components/RadialActionMenu.jsx`](../apps/web/src/components/RadialActionMenu.jsx)                                                                        |
| Integration       | [`apps/web/test/App.test.jsx`](../apps/web/test/App.test.jsx) (`pickContentMode` helper — menu rows expose label + tech subtitle)                                        |
| Unit              | [`apps/web/test/entryRenderAs.test.jsx`](../apps/web/test/entryRenderAs.test.jsx), [`apps/web/test/renderModeAction.test.js`](../apps/web/test/renderModeAction.test.js) |

`test:affected` pulls `App.test.jsx` when any of the above change (see `scripts/test-affected-lib.mjs`).

## Verification commands (quick reference)

| Scope                         | Command                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| Diff-scoped (agents)          | `npm run check:affected`                                                |
| Diff-scoped tests only        | `npm run test:affected`                                                 |
| Shared only                   | `npm run check:fast`                                                    |
| Default (includes wire tests) | `npm run check`                                                         |
| Before PR / CI parity         | `npm run check:full`                                                    |
| Wire + doc paths only         | `npm run check:wire`                                                    |
| Doc links only                | `npm run verify:doc-paths` (scans `docs/guide/` and `docs/agents/` too) |
| Server strict TS islands      | `npm run typecheck:strict -w apps/server`                               |

See [`docs/guide/coding-agents.md`](guide/coding-agents.md) for the full agent verification table and PR checklist.
