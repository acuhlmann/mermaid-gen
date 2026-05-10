# Mermaid Architect

Single-repo JavaScript prototype for collaborative Mermaid diagram editing with a dual-agent authoring model.

## Product Vision
- One always-visible user prompt captures the human's drawing intent; **Go** applies it faithfully via the Intent Agent.
- **Refine**, **Innovate**, and **Go Mad** apply progressively bolder transforms without rewriting the prompt.
- **Critique** / **Explain** run read-only analysis into an insights pane; **Show Thinking** streams agent telemetry into the same pane.
- Optional focus on a diagram node narrows transforms and explanations to that subgraph.

## Stack
- `apps/web`: React + Vite UI with Monaco editor + Mermaid live renderer
- `apps/server`: Express runtime with CopilotKit-compatible endpoints and dual-agent orchestration
- `packages/shared`: shared diagram schemas and patch logic

## Interaction Flow
1. User enters a prompt in **Describe your Change** and submits **Go** (streams agent thoughts via SSE).
2. With diagram content loaded, **Refine / Innovate / Go Mad** send transform payloads that patch state (**Critique / Explain** stream analysis only).
3. State stays synced via `GET`/`POST /api/copilotkit/state`; diagrams reset from **Clear** to the HK hackathon starter flowchart.

## Agent Profiles
- Intent Agent defaults: `temperature 0.7`, `topP 1`, `maxNodes 25`, `style balanced`, `persona creative architect`.
- Transform paths reuse tooling agents tuned per mode (`refine`, `innovate`, `goMad`) with increasing sampling temperature.

## Protocol Notes
- This iteration keeps the existing CopilotKit runtime + endpoints as the primary orchestration layer.
- AG-UI/A2UI/MCP Apps were not newly introduced in runtime flows for this change to keep scope tight.
- Existing MCP-style usage remains optional Mermaid validation through `MERMAID_MCP_URL`.
- Server validation now always runs a strict local Mermaid parser check, with MCP validation layered on top when configured.

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

### Mermaid reliability settings
- `MERMAID_MCP_URL`: optional external Mermaid validator endpoint.
- `MERMAID_MCP_MAX_RETRIES`: retry count for transient MCP errors (`429`/`5xx`/network failures).
- `MERMAID_MCP_RETRY_DELAY_MS`: base delay between MCP retries.
- `MERMAID_REPAIR_MAX_ATTEMPTS`: bounded retry budget for agent-side syntax repair turns.

## Endpoints
- `GET /api/health`
- `GET /api/copilotkit/state`
- `POST /api/copilotkit/intent` - grounded diagram edits from natural language
- `POST /api/copilotkit/transform` - refine / innovate / goMad transforms
- `POST /api/copilotkit/analyze` - critique / explain without patching state
- `POST /api/copilotkit/agent-stream` - SSE stream for tokens, tools, and finals used by the web insights pane

## Tests
- `npm test`

## VS Code Run Configs
- Shared tasks are in `.vscode/tasks.json`.
- A launch template is committed at `.vscode/launch.example.json`.
- Your local `.vscode/launch.json` is git-ignored (project/env specific).
