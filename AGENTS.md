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
