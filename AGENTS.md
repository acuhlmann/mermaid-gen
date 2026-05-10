# AGENTS.md

This file is a quick operator manual for coding agents working in this repository.

## Project at a glance

- Monorepo name: `mermaid-gen` (aka "Mermaid Architect")
- Package manager: `npm` with workspaces
- Runtime stack:
  - `apps/web`: React + Vite + CopilotKit UI
  - `apps/server`: Express + CopilotKit runtime endpoints
  - `packages/shared`: shared schemas/patch logic

## First things to check

1. Read `README.md` in the repo root for current setup flow.
2. Confirm environment exists: `.env` (copy from `.env.example` if missing).
3. Prefer workspace scripts from root unless debugging one package.

## Useful commands

- Install deps + skills: `npm run setup`
- Refresh skills only: `npm run setup:skills`
- Run web + server together: `npm run dev`
- Run all tests: `npm test`
- Build all packages: `npm run build`

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

- Server entrypoint: `apps/server/src/index.js`
- Copilot server routes: `apps/server/src/routes/copilot.js`
- Mermaid validation helper: `apps/server/src/tools/mermaidDiffTool.js`
- Shared exports/schemas: `packages/shared/src/`
- Web app entry/UI: `apps/web/src/`

## CopilotKit skill note

- You have access to the CopilotKit skill set in the local `.agents/` folder.
- `.agents/` is intentionally git-ignored; do not commit it.
- If skill files appear stale or missing, run `npm run setup:skills`.

## Environment and integration notes

- Health endpoint: `GET /api/health`
- Copilot endpoints live under: `/api/copilotkit/*`
- Optional Mermaid MCP validation is controlled by `MERMAID_MCP_URL` in `.env`.
- Never commit `.env` or secrets.

## Agent workflow guidance

- Before large edits, inspect both app and shared package contracts to avoid drift.
- Keep changes scoped to the relevant workspace whenever possible.
- After edits, run the smallest meaningful test first, then `npm test` if needed.
- If touching API contracts or schema, update both producer and consumer in the same change.
- Prefer small, reviewable commits with clear why-focused messages.

## Safety and hygiene

- Respect existing uncommitted user changes; do not revert unrelated diffs.
- Avoid destructive git commands unless explicitly requested.
- Keep docs and commands aligned with actual `package.json` scripts.

## Cursor Cloud specific instructions

- **Environment file**: `.env` must exist (copy from `.env.example` if missing). The update script handles `npm install` and CopilotKit skills refresh; you only need to ensure `.env` is present before starting services.
- **Starting dev servers**: `npm run dev` launches both the Express server (on the port defined by `PORT` in `.env`, default 4000) and Vite dev server (port 5173) via `concurrently`. Use `curl http://localhost:$PORT/api/health` to verify the server is up. The health response includes `llmConfigured` (true when `OPENROUTER_API_KEY` is set) and `runtimeReady`.
- **No database or Docker required**: All state is in-memory per session. No external services need to be running for local dev or tests.
- **Tests**: `npm test` runs all workspaces sequentially (shared → server → web). Server tests use Node's built-in test runner; web tests use Vitest. All 48 tests should pass without any API key.
- **Lint**: Only `apps/web` has an ESLint config (`npm run lint -w apps/web`). There are pre-existing lint errors in the codebase (4 errors as of initial setup).
- **Build**: `npm run build` builds shared → server → web. The web build produces a Vite bundle with a chunk-size warning that can be ignored.
- **AI features require `OPENROUTER_API_KEY`**: Without this key, the health endpoint reports `llmConfigured: false` and intent/coauthor routes return 503. The app still loads and renders diagrams, but AI generation won't work.
- **GCP access (`gcloud`)**: The update script installs `gcloud` and configures project `mermaidgen` / region `us-central1`. To authenticate, add a `GCP_SERVICE_ACCOUNT_KEY` secret (JSON key contents) in Cursor Secrets. The update script auto-activates it on startup. Once authenticated, useful inspection commands include:
  - `gcloud run services list` — list Cloud Run services
  - `gcloud run services describe mermaid-gen-main` — inspect the main service
  - `gcloud logging read 'resource.type="cloud_run_revision"' --limit=20 --freshness=1h` — recent logs
  - See [`docs/deploy/gcp.md`](docs/deploy/gcp.md) for full deployment and investigation reference.
