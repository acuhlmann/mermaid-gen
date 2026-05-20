# Recipe: add an AG-UI custom event

Use when an agent run needs to surface a new piece of structured information to the web client during streaming — beyond tokens, tool calls, draft previews, and the final state. The A2UI critique checklist is the canonical example (a `CUSTOM` event named `"a2ui"`).

## Steps

1. **Pick a name.** Lowercase, dotted if grouped (`a2ui`, `mermaid.preview`, `slopitect.run-tick`). Reserve names that won't collide with `@ag-ui/core`'s built-ins — see `node_modules/@ag-ui/core/dist/index.d.ts` for the existing event list.
2. **Define the payload shape** with Zod in `packages/shared/src/agUiEventTypes.ts` (or extend `legacyStreamEvents.ts` for semantic legacy types). Export the type and a runtime guard. Keep the shape small and forward-compatible (use optional fields rather than versioned shapes).
3. **Emit it server-side.** Use the helpers in `packages/shared/src/agentStreamEmitter.ts`. They wrap the raw `CUSTOM` event with the correct envelope and run id. For analyze-time Gen UI (critique / explain / style), prefer `apps/server/src/agents/agentStreamAnalyzeFinalize.ts` instead of duplicating emits in LangChain agents.
4. **Handle it client-side.** Map AG-UI wire → legacy in `apps/web/src/state/agUiTranslator.ts`, then add a branch in `apps/web/src/state/applyAgentStreamInsightEvent.ts`. The Thinking pane consumes the result via `InsightsPane.jsx`.
5. **Render it.** If it needs its own React surface, add a component under `apps/web/src/components/` and wire it from `InsightsPane.jsx`. Reuse `CritiqueA2uiSurface.jsx` as a reference for a non-trivial structured event.
6. **Tests.** Server-side: extend `apps/server/test/copilotRoute.test.js` to assert the event appears in the SSE stream. Client-side: extend `apps/web/test/insightsPane.test.jsx` or `applyAgentStreamInsightEvent.test.js` to assert the right UI shows up.
7. **Document the event** in `docs/architecture-ag-ui.md` under the _Custom events_ section. If it's a Gen UI protocol on top of AG-UI (like A2UI), give it its own architecture doc.

## Files you'll touch

- `packages/shared/src/agUiEventTypes.ts` / `legacyStreamEvents.ts` — schema + type.
- `packages/shared/src/agentStreamEmitter.ts` — only if you need a new emitter helper.
- `apps/server/src/agents/agentStreamAnalyzeFinalize.ts` or `{mermaid,infographic}LangChainAgent.js` — emit point.
- `apps/web/src/state/agUiTranslator.ts`, `applyAgentStreamInsightEvent.ts` — handler.
- `apps/web/src/components/InsightsPane.jsx` (or a sibling) — UI.
- `apps/server/test/copilotRoute.test.js`, `apps/web/test/*` — tests.
- `docs/architecture-ag-ui.md` — wire docs.

## Don't forget

- The event must round-trip cleanly through CopilotKit's runtime (custom events are passed through, but verify with the actual CopilotKit client if you have one in the wild).
- External agents over MCP do **not** see AG-UI events. If the new information also matters to external agents, mirror it on `session-events` — see [add-session-event.md](add-session-event.md).
- `CUSTOM` events are forward-only — clients silently ignore unknown event names. That means you can ship the producer first and the consumer second, but you should still bump the wire docs.
