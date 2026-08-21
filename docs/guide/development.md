# Development

## Stack

- `apps/web`: React + Vite UI with Monaco editor, Mermaid live renderer, AntV Infographic renderer (`InfographicRenderer.jsx`), Metaphor3D (`MetaphorRenderer.jsx`), Chart (`ChartRenderer.jsx`), Forms (`FormsRenderer.jsx`), and Anything (`AnythingRenderer.jsx`)
- `apps/server`: Express runtime with CopilotKit-compatible endpoints and LangChain-based agent orchestration; `DiagramAgentDispatcher` routes to the Mermaid, Infographic, Metaphor3D, Chart, Anything, or Forms service
- `packages/shared`: shared diagram schemas (`SessionDiagramStateSchema` with six slots), patch logic, and `ContentTypeSchema` (`mermaid` | `infographic` | `metaphor3d` | `chart` | `anything` | `forms`)

## Tests

- `npm test` — full workspace test suite.
- The repo pins Node 26 (`.nvmrc`). `apps/web` Vitest passes `--no-experimental-webstorage` via `test.execArgv` so Node's experimental Web Storage global does not shadow jsdom's `localStorage` (needed on Node 25+; accepted no-op on older majors).
- `node --import ./scripts/register-antv-layout-esm.mjs --import tsx apps/server/scripts/benchMermaid.js --tag <label>` — offline bench that replays a fixed corpus through `validateAndPreparePatch` and reports sanitizer-rescue rate, validator breakdown, and latency percentiles. Both `--import` flags are required (the bench's import graph reaches TypeScript-only modules — issue #349). Snapshots land in `apps/server/bench-results/<tag>-<iso>.json` (committed baselines for regression comparison; regenerate with the script, do not hand-edit); exits non-zero on regressions.
- `node apps/server/scripts/benchAnything.js --tag <label>` — same pattern for Anything mode: replays valid / policy-violating / broken / runtime-failing HTML documents through `validateAndPrepareAnythingPatch` (full ladder including the runtime check — browser by default, jsdom when no Chromium resolves) and reports accept rate, rejection-code breakdown, runtime-catch rate, doc sizes, and latency percentiles. Exits non-zero when outcomes drift from expectations.
- `node --import ./scripts/register-antv-layout-esm.mjs --import tsx apps/server/scripts/benchAnythingGeneration.js --tag <label> [--browser]` — **generation bench** (spends tokens): real prompts through the real agent; see [Validation & repair](validation.md#generation-bench-real-llm--spends-tokens).

## VS Code / Cursor run configs

Shared (committed) files live under `.vscode/` — see [`.vscode/README.md`](../../.vscode/README.md):

| File                    | Purpose                                                              |
| ----------------------- | -------------------------------------------------------------------- |
| `extensions.json`       | Recommended extensions                                               |
| `tasks.json`            | Shared tasks (`dev:full-stack`, `build:server`, …)                   |
| `launch.example.json`   | Launch template — copy to local `launch.json`                        |
| `settings.example.json` | Optional workspace settings template — copy to local `settings.json` |

Personal `launch.json` and `settings.json` are gitignored so machine-specific shell/debug prefs stay local.

- **Default:** copy `launch.example.json` → `launch.json`, then run **Archislop: Dev (server + web)** (root `npm run dev`, loads `.env`, opens the Vite URL when ready).
- **Server breakpoints:** **Server: Debug (compiled dist)** — builds then runs the compiled `dist/index.js` output (do not attach to raw `src/index.js` with `tsx` for day-to-day listen-on-`:4000` work).

Coding agents: see [`AGENTS.md`](../../AGENTS.md) for commands and file locations.
