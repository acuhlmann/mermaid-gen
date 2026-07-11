# Configuration

## Setup

1. Install dependencies and CopilotKit skills:
   - `npm run setup`
   - This installs npm dependencies and runs `npx skills add copilotkit/skills --full-depth -y`.
2. Configure environment:
   - `cp .env.example .env` — copy to `.env` in the repo root.
3. Run both web and server:
   - `npm run dev`

### Skills folder behavior

- The generated `.agents/` directory is intentionally git-ignored.
- Re-run `npm run setup:skills` any time you want to refresh CopilotKit skills locally.

## Mermaid reliability settings

All are optional — the defaults make every layer of the validation/repair ladder work out of the box. See [Validation & repair](validation.md) for what each layer does.

| Variable                                                                   | Default                                          | What it does                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MERMAID_METRICS`                                                          | unset                                            | When `1`/`true`, emits one structured JSON line per agent turn (`contentType`, mode, model, duration, validator outcome, repair attempts, sanitizer hits, error class) to stdout. Emitted for **all five slots** (mermaid, infographic, metaphor3d, chart, anything), not just mermaid.                            |
| `MERMAID_AGENT_RUN_BUDGET_MS_FAST` / `MERMAID_AGENT_RUN_BUDGET_MS_QUALITY` | `75000` / `150000` (Go Mad: `105000` / `180000`) | Absolute run budget for Fast and Quality (all modes). **Governs all five slots** — the `MERMAID_` prefix is legacy; there is no per-slot budget var. Enforced with a deadline `AbortSignal` — in-flight model turns abort at the budget, and repair work only starts when enough budget remains to finish it. On budget exhaustion the error carries the last validator diagnostic (`Last validation error: …`). |
| `MERMAID_REPAIR_MAX_ATTEMPTS`                                              | Fast `2`, Quality `2`                            | Bounded retry budget for the full-agent syntax-repair fallback (the last rung in the Mermaid ladder). `MERMAID_REPAIR_MAX_ATTEMPTS_FAST` / `MERMAID_REPAIR_MAX_ATTEMPTS_QUALITY` can tune by profile.                                                                                                             |
| `INFOGRAPHIC_REPAIR_MAX_ATTEMPTS`                                          | Fast `2`, Quality `2`                            | Same full-agent fallback cap for Infographic mode. `INFOGRAPHIC_REPAIR_MAX_ATTEMPTS_FAST` / `INFOGRAPHIC_REPAIR_MAX_ATTEMPTS_QUALITY` can tune by profile.                                                                                                                                                        |
| `CHART_REPAIR_MAX_ATTEMPTS`                                                | Fast `2`, Quality `2`                            | Same full-agent fallback cap for Chart mode. `CHART_REPAIR_MAX_ATTEMPTS_FAST` / `CHART_REPAIR_MAX_ATTEMPTS_QUALITY` can tune by profile.                                                                                                                                                                          |
| `METAPHOR_REPAIR_MAX_ATTEMPTS`                                             | Fast `2`, Quality `2`                            | Same full-agent fallback cap for Metaphor (3D) mode. `METAPHOR_REPAIR_MAX_ATTEMPTS_FAST` / `METAPHOR_REPAIR_MAX_ATTEMPTS_QUALITY` can tune by profile.                                                                                                                                                            |
| `ANYTHING_REPAIR_MAX_ATTEMPTS`                                             | Fast `2`, Quality `2`                            | Same full-agent fallback cap for Anything mode. `ANYTHING_REPAIR_MAX_ATTEMPTS_FAST` / `ANYTHING_REPAIR_MAX_ATTEMPTS_QUALITY` can tune by profile.                                                                                                                                                                 |
| `MERMAID_REPAIR_MODEL`                                                     | (fast tier)                                      | Override the model id used by the single-shot syntax fixer (all slots' fixers).                                                                                                                                                                                                                                   |
| `MERMAID_REPAIR_BACKEND`                                                   | (auto)                                           | Pin the syntax fixer to `vertex` or `openrouter` independently of the intent backend.                                                                                                                                                                                                                             |
| `MERMAID_STREAM_HEARTBEAT_MS`                                              | `6000`                                           | SSE heartbeat when an `agent-stream` has no events (clamped 1s–60s).                                                                                                                                                                                                                                              |
| `MERMAID_AGENT_RECURSION_LIMIT`                                            | `50`                                             | LangGraph ReAct step budget per run (clamped 25–200).                                                                                                                                                                                                                                                             |
| `MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN`                                     | `10`                                             | Cap tool invocations per run (`0` disables the cap).                                                                                                                                                                                                                                                              |
| `ANYTHING_RUNTIME_CHECK`                                                   | `1`                                              | Anything-mode runtime execution check (jsdom child process). Set to `0`/`false`/`off` to skip the runtime layer (shape/policy/quality lint still run).                                                                                                                                                            |

## Collaboration and production

| Variable                                        | Default            | What it does                                                                                                                       |
| ----------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_BASE_URL`                               | (derived)          | Public origin for MCP invite URLs and deeplinks — **required on Cloud Run** (no trailing slash).                                   |
| `ARCHISLOP_WEB_URL`                             | (optional)         | Vite app origin for `webCanvasUrl` in MCP tools when the UI is not same-host as the API (e.g. local dev: `http://localhost:5173`). |
| `INVITE_TOKEN_SECRET`                           | dev placeholder    | HMAC for signed `?token=` on `/mcp`; must be strong in production.                                                                 |
| `PAIRING_CODE_TTL_MS` / `PAIRING_INVITE_TTL_MS` | 60m / 30m          | Pairing code lifetime; refreshed when **Invite agent** opens.                                                                      |
| `REDIS_URL`                                     | unset              | Share pairing codes across Cloud Run instances (diagram/session state stays in-process).                                           |
| `MCP_RATE_LIMIT_*` / `API_*_RATE_LIMIT_*`       | see `.env.example` | Per-IP sliding windows on failed MCP joins, `join-room`, and LLM routes.                                                           |
| `CORS_ALLOWED_ORIGINS`                          | unset              | Extra allowed origins in production (`PUBLIC_BASE_URL` is always allowed).                                                         |

Cloud Run operators: see [`docs/deploy/gcp.md`](../deploy/gcp.md) for `PUBLIC_BASE_URL`, `INVITE_TOKEN_SECRET` via Secret Manager, optional Redis, and `min-instances` guidance for MCP session stickiness.

## LLM configuration

Backends are selected in `apps/server/src/agents/llmProvider.js` via `LLM_PROVIDER` (`auto` | `vertex` | `openrouter`). **`auto`**: on Cloud Run with a GCP project and region, **Vertex** is preferred unless `OPENROUTER_PREFERRED=1` and an OpenRouter key exists; otherwise **OpenRouter** when `OPENROUTER_API_KEY` is set; else Vertex if the project is configured.

**OpenRouter** (any host with a key):

- `OPENROUTER_API_KEY`: required when `LLM_PROVIDER=openrouter` or when `auto` chooses OpenRouter.
- `OPENROUTER_MODEL_FAST` / `OPENROUTER_MODEL_QUALITY`: slugs for the UI **Fast** / **Quality** toggles. If either tier is unset, **`OPENROUTER_MODEL`** can supply a single slug for both.
- **Built-in defaults** when all of the above are empty: **Fast** = `google/gemini-2.5-flash-lite`; **Quality** = `qwen/qwen3-235b-a22b`.

**Vertex AI** (GCP, Gemini):

- `VERTEX_PROJECT_ID` or `GOOGLE_CLOUD_PROJECT`, plus `VERTEX_LOCATION` (default `us-central1`).
- `VERTEX_MODEL_FAST` / `VERTEX_MODEL_QUALITY` / `VERTEX_MODEL`: same "per tier + optional shared" pattern as OpenRouter.
- **Built-in defaults** when unset: **Fast** = `gemini-2.5-flash`, **Quality** = `gemini-2.5-pro` (latest GA on this GCP project; override to `gemini-3.5-flash` / `gemini-3.1-pro-preview` when Vertex exposes them — see [`docs/llm-config.md`](../llm-config.md)).

The web client never sends raw model ids — only `modelProfile: "fast" | "quality"`; the server resolves slugs.
