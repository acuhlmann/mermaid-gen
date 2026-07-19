# API endpoints

| Method | Path                                            | Purpose                                                                                                                                         |
| ------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/health`                                   | Liveness + `llmConfigured`, `runtimeReady`, `officeTtsConfigured`, `llmBackend`, `llmBackendsByProfile`, `agentCostEstimates`, `pairingStore`   |
| `GET`  | `/api/copilotkit/state`                         | Current diagram state for session (active slot by default; pass `contentType` for a specific slot)                                              |
| `GET`  | `/api/copilotkit/session-state`                 | Full session payload (all six slots + `activeContentType`)                                                                                      |
| `POST` | `/api/copilotkit/state`                         | Client sync of editor source into server state (`contentType` selects the slot)                                                                 |
| `POST` | `/api/copilotkit/intent`                        | **Intent** path: prompt-bar **Go**, **Fix from critique**, and syntax **auto-fix** (JSON; `contentType` routes to the matching agent service)   |
| `POST` | `/api/copilotkit/transform`                     | Refine / innovate / goMad (JSON response; `contentType` forwarded)                                                                              |
| `POST` | `/api/copilotkit/analyze`                       | Critique / explain (JSON response; `contentType` forwarded)                                                                                     |
| `POST` | `/api/copilotkit/style`                         | Style-only patch (`%%init%%` / theme shaping) — **Mermaid and Chart**; rejects other `contentType` values                                       |
| `POST` | `/api/copilotkit/agent-stream`                  | SSE: tokens, tool phases, `final`, `done` (`contentType` forwarded)                                                                             |
| `*`    | `/api/copilotkit/...`                           | CopilotKit AG-UI routes (runtime handler)                                                                                                       |
| `GET`  | `/api/copilotkit/invite`                        | MCP URL, pairing code, QR, Cursor/VS Code install links                                                                                         |
| `POST` | `/api/copilotkit/invite/rotate-pairing`         | Invalidate current pairing code (same session)                                                                                                  |
| `POST` | `/api/copilotkit/join-room`                     | Bind a room with `{ pairingCode }` → `{ sessionId }` (rate-limited)                                                                             |
| `GET`  | `/api/copilotkit/session-events`                | SSE: handshakes, proposals, presence, insights, reactions                                                                                       |
| `GET`  | `/api/copilotkit/presence`                      | Connected agents snapshot                                                                                                                       |
| `GET`  | `/api/copilotkit/handshakes`                    | Pending handshake requests                                                                                                                      |
| `POST` | `/api/copilotkit/handshakes/:requestId/approve` | Approve external agent                                                                                                                          |
| `POST` | `/api/copilotkit/handshakes/:requestId/deny`    | Deny external agent                                                                                                                             |
| `GET`  | `/api/copilotkit/proposals`                     | Pending diagram proposals                                                                                                                       |
| `POST` | `/api/copilotkit/proposals/:proposalId/accept`  | Accept proposal (applies patch)                                                                                                                 |
| `POST` | `/api/copilotkit/proposals/:proposalId/reject`  | Reject proposal                                                                                                                                 |
| `POST` | `/api/advisor/suggest`                          | Slopitect companion suggestion for a focused node/label (`persona`, `contentType`, `diagramSource`, optional `focusNode`)                       |
| `POST` | `/api/advisor/explain`                          | One-shot label/part explanation for the advisor overlay                                                                                         |
| `POST` | `/api/advisor/explain-dumb`                     | Simplify a prior explain markdown to a lower reading level                                                                                      |
| `POST` | `/api/diagram/render-error`                     | Fast-path syntax repair for Mermaid render errors and Anything load-phase errors (`contentType`: `mermaid` \| `anything`; returns `{repaired}`) |
| `POST` | `/api/office/moment`                            | Office-parody walk-by / IM / email beat script (`kind`, colleague, diagram context)                                                             |
| `POST` | `/api/office/meeting`                           | Generate a WG meeting script for the current diagram                                                                                            |
| `POST` | `/api/office/meeting/interject`                 | User interjection mid-meeting (up to 2× per meeting)                                                                                            |
| `POST` | `/api/office/speak`                             | Cloud TTS for office narration (Chirp3-HD → Neural2 → WaveNet fallback ladder); kill switch `OFFICE_TTS=0`                                      |
| `*`    | `/mcp`                                          | MCP Streamable HTTP (optional `?pairing=` / `?session=` on initialize)                                                                          |

Wire contracts: [System overview](system-overview.md), [`docs/architecture-ag-ui.md`](../architecture-ag-ui.md), [`docs/architecture-external-agents.md`](../architecture-external-agents.md).
