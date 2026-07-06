# AG-UI wire contract (built-in agent streams)

> **See also:** [`architecture-generative-ui.md`](architecture-generative-ui.md) — how AG-UI relates to A2UI, MCP Apps, and session-events. For the same relationships in diagrams, see the [visual tour](architecture-generative-ui-visual.html).

The **web UI’s built-in agents** (Go, Refine, Critique, Show Thinking, etc.) stream over **AG-UI** on Server-Sent Events. LangChain services emit through `createAgentStreamEmitter` in `@archislop/shared` (re-exported from `apps/server/src/agents/agUiEvents.js`). The client uses **`CopilotStreamHttpAgent`** (`apps/web/src/state/copilotStreamHttpAgent.js`), a thin subclass of `@ag-ui/client`’s `HttpAgent` that POSTs the existing `AgentStreamPayload` to `POST /api/copilotkit/agent-stream?protocol=agui` (not the SDK’s default `RunAgentInput` body). SSE frames are decoded and Zod-validated by the SDK; `createAgUiTranslator` (`apps/web/src/state/agUiTranslator.ts`) maps wire events to the legacy union; `applyAgentStreamInsightEvent.js` reduces them for the UI. Malformed SSE lines are dropped at parse time rather than passed through as raw JSON.

**External agents do not use this channel.** They use **MCP** at `/mcp` and sync collaboration through **session-events** — see [`architecture-external-agents.md`](architecture-external-agents.md).

## Where AG-UI sits

```mermaid
flowchart LR
  subgraph web ["apps/web"]
    UI["Toolbar: Go, Critique, …"]
    DS["diagramStore\nCopilotStreamHttpAgent"]
    AP["applyAgentStreamInsightEvent"]
    UI --> DS --> AP
  end

  subgraph server ["apps/server"]
    R["POST /api/copilotkit/agent-stream"]
    E["createAgentStreamEmitter"]
    LC["LangChain agents\nMermaid / Infographic"]
    R --> E --> LC
  end

  DS <-->|"SSE AG-UI events"| R
```

CopilotKit’s **runtime handler** on the same base path also speaks AG-UI for clients that use `CopilotRuntime` directly (`apps/server/src/agents/copilotRuntimeAgent.js`). The primary ArchiSlop UI uses the custom router first.

## Lifecycle (route-owned)

The route opens and closes the run; agents must not emit `RUN_STARTED`.

| Event | When |
| --- | --- |
| `RUN_STARTED` | First event on `agent-stream` |
| `STEP_STARTED` (`planning`) | Immediately after `RUN_STARTED` |
| Agent events | Via `createAgentStreamEmitter` |
| Heartbeat | When the stream is quiet for `MERMAID_STREAM_HEARTBEAT_MS` (default 6s) — keeps proxies from closing idle SSE |
| `RUN_ERROR` | Uncaught exception in route handler |

## Semantic agent API (`emit` helpers)

| Helper | Legacy shape | AG-UI output |
| --- | --- | --- |
| `emit.phase(id, label)` | `{ type:'phase', id, label }` | `STEP_STARTED` / `STEP_FINISHED` |
| `emit.status(text)` | `{ type:'status', text }` | `CUSTOM(status)` |
| `emit.planBeat(text, source?)` | `{ type:'plan_beat', text, source }` | `CUSTOM(plan_beat)` |
| `emit.token(text)` | `{ type:'token', text }` | `TEXT_MESSAGE_*` |
| `emit.a2ui(messages)` | `{ type:'a2ui', messages }` | `CUSTOM(a2ui)` |
| `emit.patchSummary(...)` | `{ type:'artifact', kind:'patch_summary' }` | `STATE_DELTA` |
| `emit.toolStart(name, id?)` | `{ type:'tool_start' }` | `TOOL_CALL_START` |
| `emit.toolEnd(name, id?)` | `{ type:'tool_end' }` | `TOOL_CALL_END` |
| `emit.draftPreview(ct, source)` | `{ type:'draftPreview' }` | `STATE_DELTA` on `/<slot>/draftSource` |
| `emit.final(payload)` | `{ type:'final', ... }` | `STATE_SNAPSHOT` + `RUN_FINISHED` |
| `emit.error(message, code?)` | `{ type:'error' }` | `RUN_ERROR` |

Pass-through: if `emit` receives an object whose `type` is already an `AGUI_EVENT_TYPE` value, it is written unchanged.

## `CUSTOM` event names

From [`packages/shared/src/agUiWireConstants.js`](../packages/shared/src/agUiWireConstants.js):

| `name` | `value` | Web legacy |
| --- | --- | --- |
| `status` | `{ text }` | `{ type:'status', text }` |
| `plan_beat` | `{ text, source?: 'server' \| 'agent' }` | `{ type:'plan_beat', text, source }` — diagram **why** (Thinking pane Plan lane) |
| `a2ui` | `{ messages }` | `{ type:'a2ui', messages }` |
| `artifact` | opaque artifact object | passthrough (`patch_summary` → legacy artifact; `explain_sections` → insight `explainSections`) |
| `legacy` | unknown | dropped |

Critique checklists use `CUSTOM` + `name: "a2ui"` — details in [`architecture-a2ui.md`](architecture-a2ui.md).

## `STATE_DELTA` paths

| Path | Purpose | Web legacy |
| --- | --- | --- |
| `/mermaid/draftSource` | Live Mermaid draft during tool streaming | `draftPreview` |
| `/infographic/draftSource` | Live Infographic DSL draft | `draftPreview` |
| `/mermaid/revisionId` | Patch summary (with `/lastPatchSummary`) | `artifact` `patch_summary` |
| `/infographic/revisionId` | Same for infographic slot | `artifact` `patch_summary` |
| `/lastPatchSummary` | Line stats for insights chips | `artifact` `patch_summary` |

`STATE_SNAPSHOT` is cached on the client and merged into the next `RUN_FINISHED` → `{ type:'final', state }`.

## Session identity

`resolveSessionIdFromRequest` accepts, in order:

1. Header `x-session-id`
2. Query `sessionId` or `threadId`

All `/api/copilotkit/*` routes use this resolver. The web client persists a UUID in `localStorage` and sends the header on REST and `sessionId` on `EventSource` for collaboration.

## What the web renders (Gen UI surface)

| Stream data | AG-UI mechanism | Web consumer |
| --- | --- | --- |
| Status line | `CUSTOM(status)` | Insights status chip |
| Diagram intent (why) | `CUSTOM(plan_beat)` | Thinking pane **Plan** list (+ latest beat in status strip) |
| Streaming prose | `TEXT_MESSAGE_*` | Critique / explain text |
| Tool progress | `TOOL_CALL_*` | Phase labels in Thinking pane |
| Live diagram while patching | `STATE_DELTA` `/mermaid|infographic/draftSource` | Draft preview on canvas |
| Patch stats | `STATE_DELTA` revision + `/lastPatchSummary` | Insight artifacts |
| Critique checkboxes | `CUSTOM(a2ui)` | [`CritiqueA2uiSurface.jsx`](../apps/web/src/components/CritiqueA2uiSurface.jsx) — see [`architecture-a2ui.md`](architecture-a2ui.md) |
| Final diagram | `STATE_SNAPSHOT` + `RUN_FINISHED` | `diagramStore` applies revision |

External agents do **not** consume this stream; they use MCP + MCP Apps ([`architecture-generative-ui.md`](architecture-generative-ui.md)).

## Related docs

- Generative UI map: [`architecture-generative-ui.md`](architecture-generative-ui.md)
- A2UI critique payloads: [`architecture-a2ui.md`](architecture-a2ui.md)
- External agents (MCP): [`architecture-external-agents.md`](architecture-external-agents.md)
- CopilotKit runtime agent: `apps/server/src/agents/copilotRuntimeAgent.js`
