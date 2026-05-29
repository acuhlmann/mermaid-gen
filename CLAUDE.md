# CLAUDE.md — agent quick-reference for `archislop`

This file is for coding agents (Claude Code, Cursor, Copilot) opening a session in this repo. Humans should start at [`README.md`](README.md) and [`docs/guide/README.md`](docs/guide/README.md); operators at [`AGENTS.md`](AGENTS.md). For a concept→file index see [`STRUCTURE.md`](STRUCTURE.md); for terminology see [`GLOSSARY.md`](GLOSSARY.md); for common task templates see [`docs/recipes/`](docs/recipes/).

> The product name is **archislop**. The directory and GitHub repo are still named `mermaid-gen` for legacy reasons. Treat `archislop` as canonical and don't rename anything unless asked.

## Repo layout in 10 lines

```
apps/web         React 19 + Vite UI (Monaco editor, Mermaid + AntV Infographic canvases)
apps/server      Express runtime: copilot routes, MCP server, LangChain agents
packages/shared  Zod schemas, sanitizers, AG-UI/A2UI event types — leaf of the dep graph
docs/            Architecture docs, ADRs (docs/decisions), recipes (docs/recipes), deploy
scripts/         Bash deploy + GCP secret push scripts
.github/         CI workflow + deploy workflow
.claude/         Local Claude Code config (settings.local.json) and skills
.cursor/         Cursor plans and skills
```

## The three architectural axes (don't conflate them)

| Axis                                      | Path                                 | Who uses it                                                     | Doc                                                                            |
| ----------------------------------------- | ------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Built-in agents (REST + AG-UI SSE)**    | `/api/copilotkit/*`                  | Web UI Go/Refine/Innovate/Go Mad/Critique/Explain/Fix/Style     | [`docs/architecture-ag-ui.md`](docs/architecture-ag-ui.md)                     |
| **Collaboration (session-events SSE)**    | `GET /api/copilotkit/session-events` | Handshakes, proposals, presence, reactions, attributed insights | [`docs/architecture-external-agents.md`](docs/architecture-external-agents.md) |
| **External agents (MCP Streamable HTTP)** | `GET/POST /mcp`                      | Cursor, Claude Desktop, VS Code Copilot                         | same                                                                           |

A **fourth** orthogonal layer is **MCP Apps** (interactive HTML at `ui://archislop/*.html`) opened by MCP tools — see [`docs/architecture-generative-ui.md`](docs/architecture-generative-ui.md) for the full Gen UI map.

## Multi-slot session state model

Every session carries **four independent diagram slots** — `mermaid` (Mermaid text), `infographic` (AntV DSL), `metaphor3d` (Zod-structured JSON for a Three.js scene), and `chart` (archislop wrapper around a Vega-Lite spec) — plus an `activeContentType` pointer. Every HTTP request and SSE payload carries `contentType`, which the `DiagramAgentDispatcher` uses to route to the per-slot agent service. Switching modes does **not** mutate the other slot's revision history. `applyPatch` in `packages/shared` enforces that a patch's `contentType` matches the slot it targets.

**Chart vs infographic.** Both can present chart-like visuals (infographic's AntV layouts include charts). The boundary: `chart` is for *data-driven exploration* (the agent fabricates or transcribes `spec.data.values` and picks marks/encodings); `infographic` is for *narrative composition* (titles, hero numbers, KPI tiles, multi-block storytelling). Route data-viz verbs (bar chart, scatter, trend, compare, aggregate) to `chart`; route narrative verbs (summary, infographic, KPI tile) to `infographic`. The `inferDiagramType` boundary is intentionally strict — when in doubt, prefer `infographic` for layout-first asks and `chart` for "show me the numbers" asks.

## Validation ladder

**Mermaid** (4 layers, in cost order):

1. Heuristic prefix check (instant) — `apps/server/src/tools/mermaidDiffTool.js`.
2. Deterministic sanitizer rescue (~1–10 ms) — `packages/shared/src/mermaidSanitizer.js`. Composable fixers for quotes, header typos, init JSON, etc.
3. Single-shot syntax fixer (1 LLM call, low temp, fast model) — `apps/server/src/agents/mermaidSyntaxFixer.js` with rule packs in `apps/server/src/prompts/mermaidSyntaxGuard.js`.
4. Full-agent syntax-repair turns (bounded by `MERMAID_REPAIR_MAX_ATTEMPTS`).

**Infographic** (2 layers + repair): textual lint + `parseSyntax`, then single-shot fixer, then agent repair. See `apps/server/src/tools/infographicDslTool.js` and `packages/shared/src/infographicSanitizer.js`.

**Chart** (3 deterministic + 2 LLM gates, no sanitizer pack on day 1): JSON.parse → Zod wrapper (`parseChartDsl` in `packages/shared/src/chartSchema.ts`) → `vega-lite/compile()` (`apps/server/src/tools/chartDslTool.js`) → single-shot LLM fix (`apps/server/src/agents/chartSyntaxFixer.js`) → agent repair turns (bounded by `CHART_REPAIR_MAX_ATTEMPTS`). The sanitizer layer is intentionally absent — `vega-lite/compile()` produces precise error messages, so the deterministic-fix layer hasn't earned its keep yet; add a rule pack only when bench data shows a class of recurring failures.

## Canonical commands

| Goal                                   | Command                                                  |
| -------------------------------------- | -------------------------------------------------------- |
| Run web + server together              | `npm run dev`                                            |
| Run all tests                          | `npm test`                                               |
| **Verify (diff-scoped, agents)**       | `npm run check:affected`                                 |
| **Verify a change end-to-end**         | `npm run check` (typecheck + typecheck:strict + lint + test + wire) |
| Shared-only / schema touch             | `npm run check:fast`                                     |
| Before PR (matches CI)                 | `npm run check:full` (`check` + build)                   |
| Wire + doc paths only                  | `npm run check:wire`                                     |
| Blast-radius map                       | [`docs/agent-blast-radius.md`](docs/agent-blast-radius.md) |
| Format the diff you're about to commit | `npm run format`                                         |
| Build all workspaces                   | `npm run build`                                          |
| Health probe                           | `curl http://localhost:4000/api/health`                  |
| Mermaid offline bench                  | `node apps/server/scripts/benchMermaid.js --tag <label>` |

`npm run check` includes `verify:deps` (override/singleton npm pins), `lint` for all three workspaces, and the rest of the sensor stack, plus `typecheck:strict` — full-strict typechecking of the files listed in each app's `tsconfig.strict.json` (the ADR-0006 "strict islands"; add a `.ts`/`.tsx` path there to opt it into strict, and a regression fails CI). Lint messages go through a custom formatter (`packages/eslint-config/formatter.cjs`) that appends a per-rule "Agent guidance" footer with the canonical fix and suppression syntax — read it before suppressing. `@typescript-eslint`'s `recommended` rules now fire as warnings on every `.ts`/`.tsx` file, so converting `.js`→`.ts` ([recipe](docs/recipes/convert-js-leaf-to-ts.md)) gains both Factory and ts-eslint guidance. Thresholds (`max-lines`, `complexity`, …) ship as warnings; ADR-0005 monoliths are pre-suppressed in `packages/eslint-config/legacy-monoliths.js`. `npm run check` excludes `format:check` (codebase isn't fully prettier-formatted yet — global `prettier --write .` lands separately). A `.husky/pre-push` hook runs `npm run check:affected`. Architecture rules now live in `.dependency-cruiser.cjs` (replaces the older regex-based boundary script); each rule's `comment` field is the agent-readable fix. See [`docs/agents/sensors.md`](docs/agents/sensors.md) for the full sensor map.

## Don't-touch list

- `.agents/` — generated CopilotKit skill files, git-ignored. Refresh with `npm run setup:skills`.
- `.env`, `.env.*` — never commit; ask the user if they need a new variable.
- `scripts/deploy-*.sh` and `scripts/push-*-secret-cloud-run.sh` — production deploy / Secret Manager scripts. Don't run unless asked.
- `apps/server/src/mcp/apps/*.js` (HTML strings) — these are paired with `session-events` bridges; if you change the HTML, also update the matching event handler and re-run the App's smoke flow.
- `apps/server/bench-results/` — bench snapshots; don't hand-edit, regenerate via the bench script.
- `package-lock.json`, `skills-lock.json` — never hand-edit.

## File-size budgets (work in progress)

Files above ~800 LOC are slated for splits per [ADR-0005](docs/decisions/0005-monolith-splits.md). If you need to make a change in one of these, prefer extracting the slice you touch into a sibling module rather than growing the monolith:

- `apps/web/src/App.jsx` (~3790 LOC; module-scope helpers, icons, action-persona bits, `AiCornerControlsInner`, and `useSyncVisualViewportHeight` have been extracted — see [`docs/decisions/0005-monolith-splits.md`](docs/decisions/0005-monolith-splits.md)), `apps/server/src/mcp/mcpServer.js` (~1480; helpers split into `mcpHelpers.js`), `apps/server/src/agents/mermaidLangChainAgent.js` (~1350), `apps/web/src/components/InsightsPane.jsx` (~1500), `apps/web/src/components/DiagramCanvas.jsx` (~1376), `apps/web/src/components/RadialActionMenu.jsx` (~900), `apps/server/src/agents/infographicLangChainAgent.js` (~875), `apps/server/src/routes/copilot.ts` (~862), `apps/web/src/state/diagramStore.js` (~795). Future per-tool splits in `mcpServer.js` should follow the same pattern: extract closure helpers into a sibling module and add a `register{ToolName}(server, ctx)` file under `apps/server/src/mcp/tools/`.

## When you touch wire contracts

If you change an HTTP route, AG-UI event, MCP tool, or schema, update **all four** of:

1. The producing code (route / agent / tool).
2. The consumer (web client store, MCP client, or App HTML bridge).
3. The Zod schema in `packages/shared/src/diagramSchema.js` if shape changes.
4. The corresponding guide under [`docs/guide/`](docs/guide/) or the relevant `docs/architecture-*.md` (hub: [`README.md`](README.md)).

See [`docs/recipes/`](docs/recipes/) for templates of recurring changes (new MCP tool, new rule pack, new intent variant, new stream event).

## LLM backend resolution

Three backends: **DeepSeek**, **OpenRouter**, **Vertex** (Gemini). Selection is in `apps/server/src/agents/llmProvider.js` via `LLM_PROVIDER` (`auto` default). Local `auto` prefers DeepSeek if `DEEPSEEK_API_KEY` is set, else OpenRouter, else Vertex ADC. Cloud Run `auto` prefers Vertex unless `OPENROUTER_PREFERRED=1`. The web client only ever sends `modelProfile: "fast" | "quality"`; the server resolves slugs. Full table: [`docs/llm-config.md`](docs/llm-config.md).

## Where to put new code

| You're adding…                   | Put it in…                                                              |
| -------------------------------- | ----------------------------------------------------------------------- |
| A shared Zod schema or type      | `packages/shared/src/` (leaf — no server/web imports)                   |
| A pure utility used by both apps | `packages/shared/src/`                                                  |
| A new HTTP route                 | `apps/server/src/routes/`                                               |
| A new MCP tool                   | `apps/server/src/mcp/` (and `apps/server/src/mcp/apps/` if it needs UI) |
| A new LangChain agent / tool     | `apps/server/src/agents/`                                               |
| New diagram-type rule pack       | `apps/server/src/prompts/`                                              |
| A new React component            | `apps/web/src/components/`                                              |
| A new web utility                | `apps/web/src/utils/`                                                   |
| A new web state slice            | `apps/web/src/state/`                                                   |
| A new React hook                 | `apps/web/src/hooks/`                                                   |

## Agent skills

### Issue tracker

Issues live on GitHub (**acuhlmann/mermaid-gen**); use `gh` for create/list/comment/label. See [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).

### Triage labels

Five canonical triage roles map 1:1 to GitHub label names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

### Domain docs

Single-context monorepo: read `GLOSSARY.md`, `STRUCTURE.md`, and ADRs under `docs/decisions/` (optional `CONTEXT.md` when present). See [`docs/agents/domain.md`](docs/agents/domain.md).

### Sensors (lint, dep-cruiser, formatter footer)

Every static check hands you the canonical fix in its output. ESLint warnings carry an "Agent guidance" footer; dependency-cruiser rules carry it in the `comment` field. Suppress with `// eslint-disable-next-line <rule> -- (reason: ...)`. See [`docs/agents/sensors.md`](docs/agents/sensors.md) and ADR-0007.

### Modularity reviews

For semantic coupling analysis (not automatable), run `/modularity:review` in Claude Code (install once: `/plugin marketplace add vladikk/modularity`). Cursor reads the mirrored skill under `.cursor/skills/modularity/`. See [`docs/agents/modularity.md`](docs/agents/modularity.md).

## Pointers

- Architecture maps: [`docs/guide/system-overview.md`](docs/guide/system-overview.md), [`docs/architecture-generative-ui.md`](docs/architecture-generative-ui.md)
- Operator manual: [`AGENTS.md`](AGENTS.md)
- Concept→file index: [`STRUCTURE.md`](STRUCTURE.md)
- Terms: [`GLOSSARY.md`](GLOSSARY.md)
- Recurring tasks: [`docs/recipes/`](docs/recipes/)
- Past decisions: [`docs/decisions/`](docs/decisions/)
- LLM config: [`docs/llm-config.md`](docs/llm-config.md)
- Deploy: [`docs/deploy/gcp.md`](docs/deploy/gcp.md)
