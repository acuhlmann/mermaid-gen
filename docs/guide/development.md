# Development

## Stack

- `apps/web`: React + Vite UI with Monaco editor, Mermaid live renderer, and AntV Infographic renderer (`InfographicRenderer.jsx`)
- `apps/server`: Express runtime with CopilotKit-compatible endpoints and LangChain-based agent orchestration; `DiagramAgentDispatcher` routes to the Mermaid or Infographic service
- `packages/shared`: shared diagram schemas (`SessionDiagramStateSchema` with dual slots), patch logic, and `ContentTypeSchema` (`mermaid` | `infographic`)

## Tests

- `npm test` — full workspace test suite.
- `node apps/server/scripts/benchMermaid.js --tag <label>` — offline bench that replays a fixed corpus through `validateAndPreparePatch` and reports sanitizer-rescue rate, validator breakdown, and latency percentiles. Snapshots land in `apps/server/bench-results/<tag>-<iso>.json` (committed baselines for regression comparison; regenerate with the script, do not hand-edit); exits non-zero on regressions.

## VS Code run configs

- Shared tasks are in `.vscode/tasks.json`.
- A launch template is committed at `.vscode/launch.example.json` (copy or merge into your local `.vscode/launch.json` if needed).
- **Default:** **`Archislop: Dev (server + web → browser)`** — runs root `npm run dev` (server via `tsx watch`, web via Vite), loads `.env`, and opens http://localhost:5173 when Vite is ready. Use this for day-to-day work.
- **Server breakpoints:** **`Server: Debug (Node + tsx)`** — `node --import tsx` on `src/index.js` (required after the TS migration; plain Node on `src/index.js` cannot resolve `.ts` modules imported as `.js`).

Coding agents: see [`AGENTS.md`](../../AGENTS.md) for commands and file locations.
