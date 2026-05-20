# LLM configuration

Single source of truth for which LLM backend the server picks, which model id each backend resolves, and how to override either. The web client never sends raw model ids — only `modelProfile: "fast" | "quality"` — so all of this happens server-side in [`apps/server/src/agents/llmProvider.js`](../apps/server/src/agents/llmProvider.js).

## Three backends

| Backend                | Used for                                | Configure with                                                      |
| ---------------------- | --------------------------------------- | ------------------------------------------------------------------- |
| **Vertex AI (Gemini)** | Cloud Run production by default         | `VERTEX_PROJECT_ID` (or `GOOGLE_CLOUD_PROJECT`) + `VERTEX_LOCATION` |
| **OpenRouter**         | Local dev secondary, Cloud Run with key | `OPENROUTER_API_KEY`                                                |
| **DeepSeek**           | Local dev default when set              | `DEEPSEEK_API_KEY`                                                  |

## Backend selection: `LLM_PROVIDER`

| Value            | Behavior                                                           |
| ---------------- | ------------------------------------------------------------------ |
| `auto` (default) | Resolution order below                                             |
| `vertex`         | Force Vertex; returns null if env not configured (503 from routes) |
| `openrouter`     | Force OpenRouter; returns null if no key                           |
| `deepseek`       | Force DeepSeek; returns null if no key                             |

### `auto` resolution order

```
1. If OPENROUTER_PREFERRED=1 and OPENROUTER_API_KEY set     → openrouter
2. If running on Cloud Run (K_SERVICE set) and Vertex env set → vertex
3. If DEEPSEEK_API_KEY set                                  → deepseek
4. If OPENROUTER_API_KEY set                                → openrouter
5. If Vertex env set                                        → vertex
6. Otherwise                                                → null (llmConfigured=false; 503 from intent/transform/analyze)
```

`K_SERVICE` is set automatically inside a Cloud Run container, so step 2 captures "production" without us needing a flag.

## Model resolution per backend

Each backend takes the UI's `modelProfile` and resolves to a slug. For each, the resolver tries: profile-specific env var → shared env var → built-in default.

| Profile                  | Vertex                                             | OpenRouter                                                 | DeepSeek                                               |
| ------------------------ | -------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| `fast` env precedence    | `VERTEX_MODEL_FAST` → `VERTEX_MODEL` → built-in    | `OPENROUTER_MODEL_FAST` → `OPENROUTER_MODEL` → built-in    | `DEEPSEEK_MODEL_FAST` → `DEEPSEEK_MODEL` → built-in    |
| `quality` env precedence | `VERTEX_MODEL_QUALITY` → `VERTEX_MODEL` → built-in | `OPENROUTER_MODEL_QUALITY` → `OPENROUTER_MODEL` → built-in | `DEEPSEEK_MODEL_QUALITY` → `DEEPSEEK_MODEL` → built-in |
| Fast built-in            | `gemini-2.0-flash-001`                             | `google/gemini-2.5-flash-lite`                             | `deepseek-v4-flash`                                    |
| Quality built-in         | `gemini-1.5-pro-002`                               | `qwen/qwen3-235b-a22b`                                     | `deepseek-v4-pro`                                      |

## Syntax fixer (separate from intent model)

The single-shot syntax fixer (Layer 3 of the Mermaid validation ladder) runs on a small, fast model regardless of the request profile. By default it uses the resolved backend's fast tier; override with:

| Env var                  | Effect                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `MERMAID_REPAIR_MODEL`   | Override the model id used by the fixer (Mermaid _and_ Infographic)                        |
| `MERMAID_REPAIR_BACKEND` | Pin the fixer to `vertex`, `openrouter`, or `deepseek` independently of the intent backend |

## Other relevant env vars

| Var                                                    | Default                               | Effect                                                                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MERMAID_REPAIR_MAX_ATTEMPTS`                          | Fast 2, Quality 1                     | Full-agent repair attempts (Mermaid)                                                                                                                                             |
| `MERMAID_REPAIR_MAX_ATTEMPTS_FAST` / `_QUALITY`        | —                                     | Per-profile overrides                                                                                                                                                            |
| `INFOGRAPHIC_REPAIR_MAX_ATTEMPTS` (+ profile variants) | Fast 2, Quality 1                     | Same, for Infographic                                                                                                                                                            |
| `MERMAID_AGENT_RUN_BUDGET_MS_FAST` / `_QUALITY`        | 75000 / 105000                        | Absolute agent-stream run budget (ms)                                                                                                                                            |
| `MERMAID_AGENT_RECURSION_LIMIT`                        | 50 (clamped 25–200)                   | LangGraph ReAct step budget per run                                                                                                                                              |
| `MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN`                 | 6                                     | Cap tool invocations per run (`0` disables)                                                                                                                                      |
| `MERMAID_STREAM_HEARTBEAT_MS`                          | 6000 (clamped 1000–60000)             | SSE heartbeat when no normalized events                                                                                                                                          |
| `MERMAID_METRICS`                                      | unset                                 | When `1`/`true`, emit one structured JSON line per turn                                                                                                                          |
| `DEEPSEEK_THINKING`                                    | unset                                 | DeepSeek V4 thinking mode. **Leave unset for diagram agents** — LangChain doesn't yet preserve `reasoning_content` on assistant tool turns, so tool loops break with thinking on |
| `OPENROUTER_PREFERRED`                                 | unset                                 | When truthy and an OpenRouter key exists, auto mode picks OpenRouter before DeepSeek/Vertex                                                                                      |
| `OPENROUTER_SITE_NAME` / `OPENROUTER_SITE_URL`         | `ArchiSlop` / `http://localhost:5173` | OpenRouter analytics headers                                                                                                                                                     |

## Health check

`GET /api/health` returns `{ ok, llmConfigured, runtimeReady }`. `llmConfigured: true` means `resolveLlmBackend(env)` returned a non-null backend — i.e. at least one of the three providers is usable with the current env. When `false`, the app still loads and renders diagrams but `intent`, `transform`, `analyze`, and `agent-stream` return 503.

## Common configurations

**Local dev with DeepSeek** (lowest cost, fastest tool loops):

```env
DEEPSEEK_API_KEY=sk-…
```

**Local dev with OpenRouter** (choice of upstream models):

```env
OPENROUTER_API_KEY=sk-or-…
LLM_PROVIDER=openrouter
```

**Cloud Run production** (Vertex by default):

```env
# Automatic — GOOGLE_CLOUD_PROJECT + K_SERVICE are set by Cloud Run.
# Optionally pin region:
VERTEX_LOCATION=us-central1
```

**Cloud Run with OpenRouter preferred** (e.g. testing a new OpenRouter model in prod):

```env
OPENROUTER_PREFERRED=1
# Plus OPENROUTER_API_KEY via Secret Manager:
# scripts/push-openrouter-secret-cloud-run.sh
```
