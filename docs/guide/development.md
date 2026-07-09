# Development

## Stack

- `apps/web`: React + Vite UI with Monaco editor, Mermaid live renderer, AntV Infographic renderer (`InfographicRenderer.jsx`), Metaphor3D (`MetaphorRenderer.jsx`), Chart (`ChartRenderer.jsx`), and Anything (`AnythingRenderer.jsx`)
- `apps/server`: Express runtime with CopilotKit-compatible endpoints and LangChain-based agent orchestration; `DiagramAgentDispatcher` routes to the Mermaid, Infographic, Metaphor3D, Chart, or Anything service
- `packages/shared`: shared diagram schemas (`SessionDiagramStateSchema` with five slots), patch logic, and `ContentTypeSchema` (`mermaid` | `infographic` | `metaphor3d` | `chart` | `anything`)

## Tests

- `npm test` — full workspace test suite.
- `node apps/server/scripts/benchMermaid.js --tag <label>` — offline bench that replays a fixed corpus through `validateAndPreparePatch` and reports sanitizer-rescue rate, validator breakdown, and latency percentiles. Snapshots land in `apps/server/bench-results/<tag>-<iso>.json` (committed baselines for regression comparison; regenerate with the script, do not hand-edit); exits non-zero on regressions.
- `node apps/server/scripts/benchAnything.js --tag <label>` — same pattern for Anything mode: replays valid / policy-violating / broken / runtime-failing HTML documents through `validateAndPrepareAnythingPatch` (full ladder including the jsdom runtime check) and reports accept rate, rejection-code breakdown, runtime-catch rate, doc sizes, and latency percentiles. Exits non-zero when outcomes drift from expectations.

## VS Code run configs

- Shared tasks are in `.vscode/tasks.json`.
- A launch template is committed at `.vscode/launch.example.json` (copy or merge into your local `.vscode/launch.json` if needed).
- **Default:** **`Archislop: Dev (server + web → browser)`** — runs root `npm run dev` (server via `tsx watch`, web via Vite), loads `.env`, and opens http://localhost:5173 when Vite is ready. Use this for day-to-day work.
- **Server breakpoints:** **`Server: Debug (Node + tsx)`** — `node --import tsx` on `src/index.js` (required after the TS migration; plain Node on `src/index.js` cannot resolve `.ts` modules imported as `.js`).

Coding agents: see [`AGENTS.md`](../../AGENTS.md) for commands and file locations.
