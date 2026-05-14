# A2UI payloads on the critique stream (trust boundary)

This app uses **AG-UI** for agent run transport (SSE). For **Critique** runs that include an `## Actionable …` section, the server still builds **A2UI v0.9** JSON messages from the same critique markdown (`splitCritiqueActionableSections` in `@archislop/shared`) and sends them as AG-UI `CUSTOM` events (`name: "a2ui"`, `value.messages`) immediately before `RUN_FINISHED` on `POST /api/copilotkit/agent-stream` (AG-UI-only wire). The LLM does not author raw A2UI in this path; that keeps the payload deterministic.

**Web UI today:** the Thinking pane renders the actionable checklist with the same **native React controls** as before (`ActionableImprovementsPanel` in `InsightsPane.jsx`). The wire-level A2UI messages remain available for other clients, tests, or a future renderer without changing the trust model below.

## Trust model (when a host renders A2UI)

- **Allowlisted catalog only**: intended client uses `@a2ui/react` `basicCatalog` (`https://a2ui.org/specification/v0_9/basic_catalog.json`). No inline catalog from the agent.
- **Actions**: buttons map to fixed action names (`archislop_fixAll`, `archislop_fixSelected`). The host maps those to intent flows; they are not arbitrary URLs or scripts.
- **Data**: checkbox labels are plain strings sliced from critique bullets (same source as streamed markdown). Treat critique text as untrusted for XSS; keep CSP and sanitization practices you would use for rendered markdown.

## Files

- Message builder: [`packages/shared/src/critiqueA2uiMessages.js`](../packages/shared/src/critiqueA2uiMessages.js)
- Stream hook: [`apps/server/src/agents/critiqueA2uiStream.js`](../apps/server/src/agents/critiqueA2uiStream.js)
- AG-UI mapping: [`apps/server/src/agents/agUiEvents.js`](../apps/server/src/agents/agUiEvents.js) (`LEGACY_STREAM_TYPE_A2UI`), [`apps/web/src/state/diagramStore.js`](../apps/web/src/state/diagramStore.js) (`CUSTOM` → legacy `{ type: 'a2ui', messages }`), [`packages/shared/src/agUiWireConstants.js`](../packages/shared/src/agUiWireConstants.js) (`AGUI_CUSTOM_NAME_A2UI`, `createLegacyA2uiStreamEvent`)
