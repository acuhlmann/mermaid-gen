# Mermaid Architect

Single-repo JavaScript prototype for collaborative Mermaid diagram editing with a dual-agent authoring model.

## Product Vision
- One always-visible user prompt captures the human's drawing intent.
- The **Intent Agent** interprets that prompt and generates the closest diagram update.
- The **Co-author Agent** is a second AI that can extend the diagram with creative additions when manually triggered.
- Advanced settings allow tuning co-author behavior (temperature, style, persona, and extension limits).

## Stack
- `apps/web`: React + Vite UI with Monaco editor + Mermaid live renderer
- `apps/server`: Express runtime with CopilotKit-compatible endpoints and dual-agent orchestration
- `packages/shared`: shared diagram schemas and patch logic

## Interaction Flow
1. User enters a prompt in `Describe a diagram change`.
2. Web app sends prompt + current revision + settings to `POST /api/copilotkit/intent`.
3. Intent agent applies a patch and updates shared diagram state.
4. User optionally opens Agent Settings and clicks **Co-author extend**.
5. Web app sends manual co-author request to `POST /api/copilotkit/coauthor`.
6. Co-author agent applies an extension patch, preserving the human-authored structure.

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
- `POST /api/copilotkit/intent` - intent agent path
- `POST /api/copilotkit/coauthor` - manual co-author extension path

## Tests
- `npm test`

## VS Code Run Configs
- Shared tasks are in `.vscode/tasks.json`.
- A launch template is committed at `.vscode/launch.example.json`.
- Your local `.vscode/launch.json` is git-ignored (project/env specific).
