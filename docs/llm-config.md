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
| Fast built-in            | `gemini-2.5-flash`                                 | `google/gemini-2.5-flash-lite`                             | `deepseek-v4-flash`                                    |
| Quality built-in         | `gemini-2.5-pro`                                   | `qwen/qwen3-235b-a22b`                                     | `deepseek-v4-pro`                                      |

### Vertex model availability (project-specific)

Built-in Vertex defaults use the latest **GA models confirmed on `mermaidgen` / `us-central1`** via `generateContent` smoke tests. As of May 2026, `gemini-3.5-flash`, `gemini-3.1-flash-lite`, and `gemini-3.1-pro-preview` return **404 NOT_FOUND** on this project (likely rollout/allowlist — not an IAM issue; `gemini-2.5-flash` and `gemini-2.5-pro` succeed with the same credentials).

When Google enables Gemini 3.x on your project, override without code changes:

```env
VERTEX_MODEL_FAST=gemini-3.5-flash
VERTEX_MODEL_QUALITY=gemini-3.1-pro-preview
```

Optional cost saver for the syntax fixer only (single-shot, no tool loop): `MERMAID_REPAIR_MODEL=gemini-2.5-flash-lite` or `gemini-3.1-flash-lite` when that ID becomes available.

## Syntax fixer (separate from intent model)

The single-shot syntax fixer (Layer 3 of the Mermaid validation ladder) runs on a small, fast model regardless of the request profile. By default it uses the resolved backend's fast tier; override with:

| Env var                  | Effect                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `MERMAID_REPAIR_MODEL`   | Override the model id used by the fixer (Mermaid _and_ Infographic)                        |
| `MERMAID_REPAIR_BACKEND` | Pin the fixer to `vertex`, `openrouter`, or `deepseek` independently of the intent backend |

## Other relevant env vars

| Var                                                    | Default                               | Effect                                                                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MERMAID_REPAIR_MAX_ATTEMPTS`                          | Fast 2, Quality 2                     | Full-agent repair attempts (Mermaid)                                                                                                                                             |
| `MERMAID_REPAIR_MAX_ATTEMPTS_FAST` / `_QUALITY`        | —                                     | Per-profile overrides                                                                                                                                                            |
| `INFOGRAPHIC_REPAIR_MAX_ATTEMPTS` (+ profile variants) | Fast 2, Quality 2                     | Same, for Infographic                                                                                                                                                            |
| `CHART_REPAIR_MAX_ATTEMPTS` (+ profile variants)       | Fast 2, Quality 2                     | Same, for Chart                                                                                                                                                                  |
| `METAPHOR_REPAIR_MAX_ATTEMPTS` (+ profile variants)    | Fast 2, Quality 2                     | Same, for Metaphor3D                                                                                                                                                             |
| `ANYTHING_REPAIR_MAX_ATTEMPTS` (+ profile variants)    | Fast 2, Quality 2                     | Same, for Anything                                                                                                                                                               |
| `ANYTHING_RUNTIME_CHECK`                               | `1`                                   | Anything jsdom runtime check (`0`/`false`/`off` to skip)                                                                                                                         |
| `MERMAID_AGENT_RUN_BUDGET_MS_FAST` / `_QUALITY`        | 75000 / 150000                        | Absolute agent-stream run budget (ms), deadline-enforced; Go Mad gets extra headroom (105000 / 180000)                                                                           |
| `MERMAID_AGENT_RECURSION_LIMIT`                        | 50 (clamped 25–200)                   | LangGraph ReAct step budget per run                                                                                                                                              |
| `MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN`                 | 10                                    | Cap tool invocations per run (`0` disables; clamped 4–40)                                                                                                                        |
| `MERMAID_STREAM_HEARTBEAT_MS`                          | 6000 (clamped 1000–60000)             | SSE heartbeat when no normalized events                                                                                                                                          |
| `MERMAID_METRICS`                                      | unset                                 | When `1`/`true`, emit one structured JSON line per turn                                                                                                                          |
| `DEEPSEEK_THINKING`                                    | unset                                 | DeepSeek V4 thinking mode. **Leave unset for diagram agents** — LangChain doesn't yet preserve `reasoning_content` on assistant tool turns, so tool loops break with thinking on |
| `OPENROUTER_PREFERRED`                                 | unset                                 | When truthy and an OpenRouter key exists, auto mode picks OpenRouter before DeepSeek/Vertex                                                                                      |
| `OPENROUTER_SITE_NAME` / `OPENROUTER_SITE_URL`         | `ArchiSlop` / `http://localhost:5173` | OpenRouter analytics headers                                                                                                                                                     |
| `LLM_COST_ESTIMATES`                                   | auto on Cloud Run                     | When `1`/`true`, thinking panel shows **estimated** USD per agent run. Auto-enabled when `K_SERVICE` is set; set `0`/`false` to hide on Cloud Run. Local dev defaults to off.    |
| `LLM_COST_USD_PER_M_<MODEL>_INPUT` / `_OUTPUT`         | built-in Vertex table                 | Override USD per 1M tokens for a model slug, e.g. `LLM_COST_USD_PER_M_GEMINI_2_5_FLASH_INPUT=0.30` and `…_OUTPUT=2.50`. Model key is uppercased with `.` → `_`.                  |

## Agent run cost estimates (thinking panel)

When deployed on Cloud Run, the thinking panel shows **approximate** LLM spend per built-in agent run:

- Each **Model reasoning turn** line appends `~$0.003` (etc.) next to the token counts when the provider reports usage.
- The run timeline header gets a total chip summing every model turn in that entry.

Estimates are **not** billed amounts — they multiply reported input/output tokens by a rate table. Defaults match published [Vertex Gemini list prices](https://cloud.google.com/vertex-ai/generative-ai/pricing) for the built-in models (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.5-flash-lite`, plus common OpenRouter/DeepSeek slugs when `OPENROUTER_PREFERRED=1`).

### Automatic rate refresh (deployed)

On Cloud Run the server merges rates from several sources (see `ratesSources` in `/api/health`):

1. **Bundled JSON** — [`packages/shared/src/data/llm-token-rates.json`](../packages/shared/src/data/llm-token-rates.json) ships with the build.
2. **Remote JSON (default on Cloud Run)** — every 24h (override with `LLM_COST_RATES_REFRESH_MS`) the server fetches `LLM_COST_RATES_URL`, which defaults to the `main` branch raw GitHub URL for that JSON file. **Update prices by merging a PR to that file** — running pods pick it up on the next refresh without redeploying app code.
3. **OpenRouter catalog** — when `OPENROUTER_API_KEY` is set, configured model slugs are refreshed from `GET https://openrouter.ai/api/v1/models`.
4. **Env overrides** — `LLM_COST_USD_PER_M_<MODEL>_INPUT` / `_OUTPUT` win last.

### Keeping rates current manually

1. Open [Vertex generative AI pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) (or OpenRouter if `OPENROUTER_PREFERRED=1`).
2. Edit `packages/shared/src/data/llm-token-rates.json` (`version` + per-model `inputPerM` / `outputPerM` in USD per 1M tokens) and deploy, **or** hot-patch Cloud Run env vars.
3. Confirm: `curl -sS "$PUBLIC_BASE_URL/api/health" | jq '{enabled:.agentCostEstimates.enabled, version:.agentCostEstimates.ratesVersion, sources:.agentCostEstimates.ratesSources}'`.

The web client reads `agentCostEstimates` from `/api/health` at load. Lifetime totals accumulate in the Slopitect level panel (**Stakeholder Damage Report™**) when cost tracking is enabled.

## Health check

`GET /api/health` returns `{ status, llmConfigured, runtimeReady, llmBackend, agentCostEstimates, … }`. `llmConfigured: true` means `resolveLlmBackend(env)` returned a non-null backend — i.e. at least one of the three providers is usable with the current env. When `false`, the app still loads and renders diagrams but `intent`, `transform`, `analyze`, and `agent-stream` return 503.

`agentCostEstimates` shape:

```json
{
  "enabled": true,
  "pricingUrl": "https://cloud.google.com/vertex-ai/generative-ai/pricing",
  "rates": {
    "gemini-2.5-flash": { "inputPerM": 0.3, "outputPerM": 2.5 }
  }
}
```

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
