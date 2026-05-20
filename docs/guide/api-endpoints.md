# API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness + `llmConfigured`, `runtimeReady` |
| `GET` | `/api/copilotkit/state` | Current diagram state for session (active slot by default; pass `contentType` for a specific slot) |
| `GET` | `/api/copilotkit/session-state` | Full session payload (both slots + `activeContentType`) |
| `POST` | `/api/copilotkit/state` | Client sync of editor source into server state (`contentType` selects the slot) |
| `POST` | `/api/copilotkit/intent` | **Intent** path: prompt-bar **Go**, **Fix from critique**, and syntax **auto-fix** (JSON; `contentType` routes to Mermaid or Infographic agent) |
| `POST` | `/api/copilotkit/transform` | Refine / innovate / goMad (JSON response; `contentType` forwarded) |
| `POST` | `/api/copilotkit/analyze` | Critique / explain (JSON response; `contentType` forwarded) |
| `POST` | `/api/copilotkit/style` | Style-only patch (`%%init%%` / theme shaping) — **Mermaid only**, rejects `contentType: infographic` |
| `POST` | `/api/copilotkit/agent-stream` | SSE: tokens, tool phases, `final`, `done` (`contentType` forwarded) |
| `*` | `/api/copilotkit/...` | CopilotKit AG-UI routes (runtime handler) |
| `GET` | `/api/copilotkit/invite` | MCP URL, pairing code, QR, Cursor/VS Code install links |
| `POST` | `/api/copilotkit/invite/rotate-pairing` | Invalidate current pairing code (same session) |
| `POST` | `/api/copilotkit/join-room` | Bind a room with `{ pairingCode }` → `{ sessionId }` (rate-limited) |
| `GET` | `/api/copilotkit/session-events` | SSE: handshakes, proposals, presence, insights, reactions |
| `GET` | `/api/copilotkit/presence` | Connected agents snapshot |
| `GET` | `/api/copilotkit/handshakes` | Pending handshake requests |
| `POST` | `/api/copilotkit/handshakes/:requestId/approve` | Approve external agent |
| `POST` | `/api/copilotkit/handshakes/:requestId/deny` | Deny external agent |
| `GET` | `/api/copilotkit/proposals` | Pending diagram proposals |
| `POST` | `/api/copilotkit/proposals/:proposalId/accept` | Accept proposal (applies patch) |
| `POST` | `/api/copilotkit/proposals/:proposalId/reject` | Reject proposal |
| `*` | `/mcp` | MCP Streamable HTTP (optional `?pairing=` / `?session=` on initialize) |

Wire contracts: [System overview](system-overview.md), [`docs/architecture-ag-ui.md`](../architecture-ag-ui.md), [`docs/architecture-external-agents.md`](../architecture-external-agents.md).
