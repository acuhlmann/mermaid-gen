# AGENTS.md

This file is a quick operator manual for coding agents working in this repository.

## Project at a glance

- Monorepo name: `archislop` (directory and GitHub repo still `mermaid-gen` for legacy reasons)
- Package manager: `npm` with workspaces
- Runtime stack:
  - `apps/web`: React + Vite + CopilotKit UI
  - `apps/server`: Express + CopilotKit runtime endpoints
  - `packages/shared`: shared schemas/patch logic

## First things to check

1. Read [`docs/guide/coding-agents.md`](docs/guide/coding-agents.md) (agent read order, verification table, PR checklist).
2. Read `README.md` (hub) and [`docs/guide/quick-start.md`](docs/guide/quick-start.md) for setup flow.
3. Confirm environment exists: `.env` (copy from `.env.example` if missing).
4. Prefer workspace scripts from root unless debugging one package.

## Useful commands

- Install deps + skills + Cloud SDK (when missing): `npm run setup`
- Google Cloud CLI only: `npm run setup:gcloud` (see `scripts/setup-gcloud.sh`; uses `GOOGLE_APPLICATION_CREDENTIALS` or `GCP_MERMAID_GEN` key path for service-account auth when set)
- Refresh skills only: `npm run setup:skills`
- Run web + server together: `npm run dev`
- Run all tests: `npm test`
- Build all packages: `npm run build`
- **Verify after edits** (pick the smallest loop that fits):
  - `npm run check:affected` — diff-scoped sensors (includes Prettier on changed files; matches what agents should run before push)
  - `npm run format:affected` — **run before every agent commit** (writes Prettier on changed files; cloud agents have no Husky)
  - `npm run format` / `npm run format:check` — Prettier write / verify whole repo (CI runs `format:check`; pre-commit auto-formats staged files). Text is LF via `.gitattributes`; Windows CRLF working trees — see [`docs/agents/sensors.md`](docs/agents/sensors.md) § Line endings
  - `npm run check:fast` — shared package only (schemas, sanitizers, wire constants)
  - `npm run check` — typecheck + lint + test all workspaces (default)
  - `npm run check:full` — same as CI: typecheck + test + build
  - `npm run check:wire` — doc path verify + wire round-trip tests (shared, server, web)
  - `npm run typecheck:strict` — strict TS on server wire-route modules (`copilotRouteTypes`, stream helpers)
  - `npm run verify:doc-paths` — operator-doc links to `apps/`, `packages/`, and `scripts/` paths (`STRUCTURE.md`, `AGENTS.md`, `CLAUDE.md`, `docs/recipes/`, `docs/guide/`, `docs/agents/`)
  - `npm run verify:deps` — override pins and singleton npm installs (e.g. `@a2ui/web_core` hoisted vs nested); error output includes the `npm install` fix
  - `npm run verify:boundaries` — dependency-cruiser graph rules (cycles + workspace + intra-server layers); each rule's `comment` is the agent-readable fix
  - `npm run lint` — all three workspaces, formatter appends per-rule "Agent guidance" footer with the canonical fix and suppression syntax (`packages/eslint-config/formatter.cjs`)
  - `npm run verify:modularity` — reminder of how to run a semantic modularity review (Claude `/modularity:review` or Cursor `.cursor/skills/modularity/review/SKILL.md`); see [`docs/agents/modularity.md`](docs/agents/modularity.md)
- **Workspace-scoped** (faster when you know the blast radius):
  - `npm run typecheck -w apps/server && npm run test -w apps/server`
  - `npm run typecheck -w apps/web && npm run test -w apps/web`
  - `npm run typecheck -w packages/shared && npm run test -w packages/shared`

Package-specific commands:

- Server dev: `npm run dev -w apps/server`
- Web dev: `npm run dev -w apps/web`

## Operator CLIs

Agents often have **`gcloud`** and **`gh`** available in the terminal. Use them to inspect real account state instead of guessing projects, billing, or Git refs.

### `gcloud` (Google Cloud)

Use for **estate discovery** and deploy operations: projects, billing attachment, enabled APIs, Artifact Registry, Cloud Run services/revisions, IAM, and logs.

Examples:

- `gcloud projects list`
- `gcloud billing projects describe PROJECT_ID`
- `gcloud run services list --region=REGION`
- `gcloud logging read 'resource.type="cloud_run_revision"' --limit=20 --freshness=1h`

### `gh` (GitHub CLI)

Use for **repo and release inspection**: tags, releases, Actions, PRs.

Examples for this repository:

- `gh release view hackathon-pre-deploy -R acuhlmann/mermaid-gen`
- `gh api repos/acuhlmann/mermaid-gen/git/refs/tags/hackathon-pre-deploy`

### Public deployment (GCP)

Production deploy notes (Cloud Run, billing credits, GitHub Actions CI, optional load balancer) live in [`docs/deploy/gcp.md`](docs/deploy/gcp.md).

## Key code locations

- Server entrypoint: `apps/server/src/index.js` (mounts `/api/copilotkit`, `/mcp`, CopilotKit handler)
- Copilot + collaboration routes: `apps/server/src/routes/copilot.ts` (intent/transform/analyze, invite, session-events, handshakes, proposals)
- MCP server + tools: `apps/server/src/mcp/mcpServer.js`; MCP App HTML: `apps/server/src/mcp/apps/`
- Mermaid validation helper: `apps/server/src/tools/mermaidDiffTool.js`
- Shared exports/schemas: `packages/shared/src/`
- Web app entry/UI: `apps/web/src/`
- Session event bus: `apps/server/src/state/sessionEventBus.ts`; web client: `apps/web/src/state/sessionEventsClient.js`

## Architecture docs (read before changing wire contracts)

| Doc                                                                            | Topic                                                            |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [`docs/architecture-generative-ui.md`](docs/architecture-generative-ui.md)     | **AG-UI + A2UI + MCP Apps map**, MCP connectivity, host matrix   |
| [`docs/architecture-external-agents.md`](docs/architecture-external-agents.md) | MCP join, handshakes, proposals, MCP Apps, session-events        |
| [`docs/architecture-ag-ui.md`](docs/architecture-ag-ui.md)                     | AG-UI SSE for built-in `agent-stream`                            |
| [`docs/architecture-a2ui.md`](docs/architecture-a2ui.md)                       | A2UI critique `CUSTOM` on AG-UI streams                          |
| [`docs/agent-blast-radius.md`](docs/agent-blast-radius.md)                     | **Impact map** — if you change X, also change Y (wire contracts) |
| [`README.md`](README.md)                                                       | Human-facing hub (links to guides below)                         |
| [`docs/guide/README.md`](docs/guide/README.md)                                 | Split human guides: setup, agents, MCP, API, config              |
| [`docs/guide/coding-agents.md`](docs/guide/coding-agents.md)                   | Agent onboarding: read order, verification table, PR checklist   |
| [`docs/agents/sensors.md`](docs/agents/sensors.md)                             | Lint, dep-cruiser, verify:deps — how to read sensor output       |

## Documentation map

| Audience                                  | Start here                                                                                                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Humans** (setup, product, API)          | [`README.md`](README.md) → [`docs/guide/README.md`](docs/guide/README.md)                                                                                       |
| **Coding agents** (edits, wire contracts) | [`docs/guide/coding-agents.md`](docs/guide/coding-agents.md) → [`GLOSSARY.md`](GLOSSARY.md) → [`STRUCTURE.md`](STRUCTURE.md) → [`docs/recipes/`](docs/recipes/) |
| **Sensors** (lint / boundaries / deps)    | [`docs/agents/sensors.md`](docs/agents/sensors.md) — canonical fix lives in the tool output                                                                     |

## CopilotKit skill note

- You have access to the CopilotKit skill set in the local `.agents/` folder.
- `.agents/` is intentionally git-ignored; do not commit it.
- If skill files appear stale or missing, run `npm run setup:skills`.

## Environment and integration notes

- Health endpoint: `GET /api/health`
- Built-in agents + collaboration: `/api/copilotkit/*` (including `session-events` SSE)
- External agents: `POST/GET /mcp` (Streamable HTTP); set `PUBLIC_BASE_URL` and production `INVITE_TOKEN_SECRET` for invite URLs; optional `ARCHISLOP_WEB_URL` when UI and API origins differ
- Never commit `.env` or secrets.

## Agent workflow guidance

- Before large edits, inspect both app and shared package contracts to avoid drift.
- Keep changes scoped to the relevant workspace whenever possible.
- After edits, run the smallest meaningful check first (`check:fast` / workspace-scoped test), then `npm run check` or `npm run check:full` before opening a PR.
- **Source vs build output:** edit `apps/*/src/` and `packages/shared/src/` only. `dist/` and `.tsbuildinfo` are gitignored build artifacts — never patch them.
- **TypeScript coverage:** `packages/shared` is fully typechecked (strict). Most `apps/server` and `apps/web` files are still `.js`/`.jsx` with `checkJs: false`; only migrated `.ts`/`.tsx` modules get full type errors until those files are converted.
- If touching API contracts or schema, update both producer and consumer in the same change.
- Prefer small, reviewable commits with clear why-focused messages.

## Documentation upkeep

- **Keep human docs current** when you ship architectural changes, new agents/skills, new modes, new routes, or renamed top-level concepts. Smaller bug fixes and internal refactors usually don't need doc touches.
- **Hub:** [`README.md`](README.md) — short intro, quick start bullets, doc index (no heavy Mermaid blocks; GitHub preview hangs on large diagrams).
- **Guides:** [`docs/guide/`](docs/guide/) — detailed prose and diagrams on focused pages (agents, validation, MCP Apps table, endpoints, config). Update the relevant guide file; add a README index row if you add a new guide.
- Write for readers, not parsers. Prefer prose and focused Mermaid diagrams over walls of config.
- When in doubt, update docs in the same commit/PR as the code change so behavior and docs stay in lockstep.

## Safety and hygiene

- Respect existing uncommitted user changes; do not revert unrelated diffs.
- Avoid destructive git commands unless explicitly requested.
- Keep docs and commands aligned with actual `package.json` scripts.

## Cursor Cloud specific instructions

- **Environment file**: `.env` must exist (copy from `.env.example` if missing). Run `npm run setup` for `npm install`, CopilotKit skills refresh, and `gcloud` install when missing (`scripts/setup-gcloud.sh`); ensure `.env` is present before starting services.
- **Starting dev servers**: `npm run dev` launches both the Express server (on the port defined by `PORT` in `.env`, default 4000) and Vite dev server (port 5173) via `concurrently`. Use `curl http://localhost:$PORT/api/health` to verify the server is up. The health response includes `llmConfigured` (true when any LLM backend resolves: DeepSeek key, OpenRouter key, and/or Vertex project + region per `LLM_PROVIDER`; see `resolveLlmBackend` in `apps/server/src/agents/llmProvider.js`) and `runtimeReady`. Local `auto` prefers **DeepSeek** when `DEEPSEEK_API_KEY` is set; Cloud Run `auto` prefers **Vertex** (Gemini).
- **No database or Docker required** for local dev: diagram and collaboration state are in-memory per server process. Optional **`REDIS_URL`** shares pairing codes across Cloud Run instances (see `.env.example`); diagram slots are not Redis-backed yet.
- **Tests**: `npm test` runs all workspaces sequentially (shared → server → web). Server tests use Node's built-in test runner; web tests use Vitest. All tests should pass without any API key (300+ cases across workspaces).
- **Lint**: All three workspaces lint via the shared config in `packages/eslint-config/` (`npm run lint` from root, or `npm run lint -w <workspace>`). The custom formatter appends per-rule "Agent guidance" with the canonical fix and suppression syntax — read it before suppressing or raising a threshold. ADR-0005 monolith files are pre-suppressed via `packages/eslint-config/legacy-monoliths.js`. See [`docs/agents/sensors.md`](docs/agents/sensors.md) and ADR-0007.
- **Cursor parity**: `.cursor/rules/sensors.mdc` is loaded in every Cursor session and points at the same sensor stack as CLAUDE.md. The vladikk/modularity skill is mirrored at `.cursor/skills/modularity/` so Cursor agents can apply the Balanced Coupling Model without the Claude Code plugin. Refresh with `npm run sync:modularity`.
- **Build**: `npm run build` builds shared → server → web. The web build produces a Vite bundle with a chunk-size warning that can be ignored.
- **AI features require a configured LLM backend** (typically `OPENROUTER_API_KEY` for local dev, or Vertex on GCP). If none resolves, `llmConfigured` is false and intent/transform/analyze/stream routes return 503. The app still loads and renders diagrams, but AI generation will not work.
- **GCP access (`gcloud`)**: `npm run setup` / `npm run setup:gcloud` installs the SDK to `~/google-cloud-sdk` when absent. If `GOOGLE_APPLICATION_CREDENTIALS` or `GCP_MERMAID_GEN` points at a service-account JSON file, the script runs `gcloud auth activate-service-account`; it then sets project `mermaidgen` and region `us-central1` when that project is readable. Once authenticated, useful inspection commands include:
  - `gcloud run services list` — list Cloud Run services (`mermaid-gen-main`, `mermaid-gen-hackathon`)
  - `gcloud run services describe mermaid-gen-main` — inspect the main service
  - `gcloud logging read 'resource.type="cloud_run_revision"' --limit=20 --freshness=1h` — recent logs
  - `curl -sS "https://mermaid-gen-main-464241135431.us-central1.run.app/api/health"` — production health check
  - See [`docs/deploy/gcp.md`](docs/deploy/gcp.md) for full deployment and investigation reference.
