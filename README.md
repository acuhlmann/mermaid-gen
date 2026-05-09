# Mermaid Architect

Single-repo JavaScript prototype for collaborative Mermaid diagram editing with an agentic UI.

## Stack
- `apps/web`: React + Vite + CopilotKit UI
- `apps/server`: Express runtime with CopilotKit-compatible endpoints
- `packages/shared`: shared diagram schema and patch logic

## Setup
1. Install dependencies and CopilotKit skills:
   - `npm run setup`
   - This installs npm dependencies and runs `npx skills add copilotkit/skills --full-depth -y`.
2. Configure environment:
   - `cp .env.example .env`
3. Run both web and server:
   - `npm run dev`

### Skills folder behavior
- The generated `.agents/` directory is intentionally git-ignored.
- Re-run `npm run setup:skills` any time you want to refresh CopilotKit skills locally.

## Endpoints
- `GET /api/health`
- `GET /api/copilotkit/state`
- `POST /api/copilotkit/intent`

## Tests
- `npm test`
