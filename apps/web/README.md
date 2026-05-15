# Web App Notes

UI package for ArchiSlop (`apps/web`). Human-facing overview: [root README](../../README.md).

## Key UX

- **Diagram** vs **Infographic** — toolbar toggle; `contentType` on every API call; each slot has its own source and revision history.
- **Go** — streams **intent** via `/api/copilotkit/agent-stream`; thoughts land in the Insights pane.
- **Refine / Innovate / Go Mad** — **transform** stream with `mode` and optional `goMadDepth`.
- **Critique / Explain** — **analyze** stream (read-only); critique may emit A2UI checklists for **Fix selected** / **Fix all**.
- **Fix** — another **intent** stream with a client-built prompt from critique (or checked actionable bullets).
- **Syntax auto-fix** — debounced **intent** when Monaco reports a parse error.
- **Clear** — resets to the mode’s starter diagram; sync via `/api/copilotkit/state`.

## Generative UI (this package)

- **AG-UI** — `diagramStore.js` decodes `agent-stream` SSE; `applyAgentStreamInsightEvent.js` drives the Insights pane (phases, tokens, drafts, finals).
- **A2UI** — `CritiqueA2uiSurface.jsx` only; server-built messages, never model-authored UI JSON.
- **Not here** — MCP Apps (`apps/server/src/mcp/apps/`); see [`docs/architecture-generative-ui.md`](../../docs/architecture-generative-ui.md).

## Collaboration (same session as MCP guests)

- `sessionEventsClient.js` — SSE to `/api/copilotkit/session-events` for handshakes, proposals, presence, insights.
- `AgentHandshakeDialog`, `AgentProposalCard`, `AgentPresenceBar`, `InviteAgentDialog`.
- Prefer web UI for approve/accept when the browser is open; MCP Apps are optional duplicates.

## Slopitect (cosmetic layer)

- `SlopitectCompanion`, `LiveRunHud`, `StreakHud`, `runGamificationStore.js`, `slopitectCopy.js` — run feedback, streaks, achievements; no separate API.

## Layout

- Desktop: prompt bar + Insights pane.
- Mobile/narrow: `RadialActionMenu` on the canvas (`layoutBreakpoints.js`).

## Runtime wiring

- CopilotKit provider: `${VITE_API_BASE_URL}/api/copilotkit`.
- Diagram state, AG-UI decode, streaming: `src/state/diagramStore.js`, `applyAgentStreamInsightEvent.js`.
- Session id: UUID in `localStorage`, sent as `x-session-id`.

## Dev commands

- Web only: `npm run dev -w apps/web` (API must run separately unless using root `npm run dev`).
- Test web only: `npm run test -w apps/web`
- Lint: `npm run lint -w apps/web`
