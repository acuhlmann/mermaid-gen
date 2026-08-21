# LLM configuration

Single source of truth for which LLM backend the server picks, which model id each backend resolves, and how to override either. The web client never sends raw model ids — only `modelProfile: "fast" | "quality"` — so all of this happens server-side in [`apps/server/src/agents/llmProvider.js`](../apps/server/src/agents/llmProvider.js).

## Three backends

| Backend                | Used for                                                              | Configure with                                                      |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **DeepSeek**           | Brain Fast + Quality when `DEEPSEEK_API_KEY` is set                   | `DEEPSEEK_API_KEY` (Secret Manager `deepseek-api-key` on Cloud Run) |
| **Vertex AI (Gemini)** | Office/advisor decorative Fast (lite); sole Brain when DeepSeek unset | `VERTEX_PROJECT_ID` (or `GOOGLE_CLOUD_PROJECT`) + `VERTEX_LOCATION` |
| **OpenRouter**         | Local secondary; Cloud Run with `OPENROUTER_PREFERRED=1`              | `OPENROUTER_API_KEY`                                                |

## Brain profiles (Fast vs Quality)

| UI Brain setting   | Typical setup (`auto` + DeepSeek key, optional Vertex) | Model id            |
| ------------------ | ------------------------------------------------------ | ------------------- |
| **Fast** (default) | DeepSeek V4 Flash — canvas Go / tool agents            | `deepseek-v4-flash` |
| **Quality**        | DeepSeek V4 Pro — Concentration "Deep work"            | `deepseek-v4-pro`   |

When `DEEPSEEK_API_KEY` is set in `auto` mode, **both** Brain profiles use DeepSeek. Vertex (when configured) is reserved for decorative Fast (`gemini-2.5-flash-lite`) and the syntax-fixer lite rung — not canvas Brain. If DeepSeek is missing, Brain falls back to Vertex Flash/Pro (or OpenRouter).

## Backend selection: `LLM_PROVIDER`

| Value            | Behavior                                                                                |
| ---------------- | --------------------------------------------------------------------------------------- |
| `auto` (default) | Resolution order below                                                                  |
| `vertex`         | Force Vertex for **all** profiles; returns null if env not configured (503 from routes) |
| `openrouter`     | Force OpenRouter for all profiles; returns null if no key                               |
| `deepseek`       | Force DeepSeek for all profiles; returns null if no key                                 |

### `auto` resolution order

```
1. If OPENROUTER_PREFERRED=1 and OPENROUTER_API_KEY set     → openrouter (both profiles)
2. If DEEPSEEK_API_KEY set                                  → deepseek (Brain Fast+Quality)
3. If running on Cloud Run (K_SERVICE set) and Vertex env set → vertex
4. If OPENROUTER_API_KEY set                                → openrouter
5. If Vertex env set                                        → vertex
6. Otherwise                                                → null (llmConfigured=false; 503 from intent/transform/analyze)
```

`K_SERVICE` is set automatically inside a Cloud Run container, so step 3 captures "production" without DeepSeek attached.

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

Optional first-rung override for the syntax fixer: `MERMAID_REPAIR_MODEL=gemini-2.5-flash-lite` (or `gemini-3.1-flash-lite` when available). The fixer still escalates to flash and DeepSeek Pro unless `SYNTAX_FIXER_ESCALATION=0`.

## Decorative Fast (office / advisor / explain) vs Brain Fast

Latency-sensitive desk talk does **not** use Brain Fast. `resolveDecorativeBackend` +
`resolveDecorativeModelId` in [`llmProvider.js`](../apps/server/src/agents/llmProvider.js) serve:

- Advisor chips (`createAdvisorChatModel`)
- Label explainer + explain dumb-down
- Auto content-type classifier
- **Latency office lane** — walk-bys, huddles, live meeting interjections (`createOfficeChatModel` with `live: true` or walk-by kinds)

**Quality office lane** — email, IM, meeting scripts, training — uses DeepSeek Flash when `DEEPSEEK_API_KEY` is set (falls back to decorative Fast otherwise). When the user selects **Deep work** (Brain Quality), those surfaces upgrade to DeepSeek Pro. The client passes `modelProfile` on every `/api/office/*` LLM route.

| Surface                                         | Typical hybrid (DeepSeek + Vertex) | Model id                                |
| ----------------------------------------------- | ---------------------------------- | --------------------------------------- |
| Brain Fast (canvas Go)                          | DeepSeek                           | `deepseek-v4-flash`                     |
| Brain Quality (Deep work)                       | DeepSeek                           | `deepseek-v4-pro`                       |
| Office quality lane (email/IM/meeting/training) | DeepSeek (Flash or Pro by Brain)   | `deepseek-v4-flash` / `deepseek-v4-pro` |
| Office latency lane + advisor                   | Vertex                             | `gemini-2.5-flash-lite`                 |

Vertex overrides: `VERTEX_MODEL_OFFICE` → `VERTEX_MODEL_LITE` → built-in lite. Setting `VERTEX_MODEL_FAST` alone does **not** change office/advisor.

## Syntax fixer ladder (separate from Brain)

Layer 3 of the validation ladder is a **latency-first model climb**, independent of the UI Brain Fast/Quality setting:

1. **Lite** — `gemini-2.5-flash-lite` (Vertex) or OpenRouter flash-lite (super-fast salvage)
2. **Flash** — `gemini-2.5-flash` / OpenRouter flash
3. **Quality** — DeepSeek V4 Pro when `DEEPSEEK_API_KEY` is set; otherwise Vertex/OpenRouter quality

Each rejected rung feeds its diagnostic into the next. Full-agent repair (Layer 4) then climbs to Quality on **every** repair attempt via `resolveAgentRepairAttemptProfile` (attempt ≥ 1), so a Fast Brain run gets DeepSeek Pro on the first full-agent retry.

| Env var                   | Effect                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `MERMAID_REPAIR_MODEL`    | Override the model id for the **first** fixer rung (Mermaid _and_ other slot fixers) |
| `MERMAID_REPAIR_BACKEND`  | Pin latency rungs to `vertex`, `openrouter`, or `deepseek`                           |
| `SYNTAX_FIXER_ESCALATION` | Default on; set `0`/`false` to collapse to a single fast-tier target                 |
| `VERTEX_MODEL_LITE`       | Override Vertex lite (fixer rung 1 + default decorative Fast)                        |
| `VERTEX_MODEL_OFFICE`     | Optional decorative-only override (office/advisor/…); else uses lite                 |
| `OPENROUTER_MODEL_LITE`   | Override OpenRouter lite rung                                                        |
| `OPENROUTER_MODEL_FLASH`  | Override OpenRouter flash rung (default `google/gemini-2.5-flash`)                   |

## Other relevant env vars

| Var                                                    | Default                               | Effect                                                                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MERMAID_REPAIR_MAX_ATTEMPTS`                          | Fast 2, Quality 2                     | Full-agent repair attempts (Mermaid); attempt 2+ uses Quality model regardless of Brain                                                                                          |
| `MERMAID_REPAIR_MAX_ATTEMPTS_FAST` / `_QUALITY`        | —                                     | Per-profile overrides                                                                                                                                                            |
| `INFOGRAPHIC_REPAIR_MAX_ATTEMPTS` (+ profile variants) | Fast 2, Quality 2                     | Same, for Infographic                                                                                                                                                            |
| `CHART_REPAIR_MAX_ATTEMPTS` (+ profile variants)       | Fast 2, Quality 2                     | Same, for Chart                                                                                                                                                                  |
| `METAPHOR_REPAIR_MAX_ATTEMPTS` (+ profile variants)    | Fast 2, Quality 2                     | Same, for Metaphor3D                                                                                                                                                             |
| `ANYTHING_REPAIR_MAX_ATTEMPTS` (+ profile variants)    | Fast 2, Quality 2                     | Same, for Anything                                                                                                                                                               |
| `ANYTHING_RUNTIME_CHECK`                               | `1`                                   | Anything runtime check (`0`/`false`/`off` to skip)                                                                                                                               |
| `ANYTHING_RUNTIME_ENGINE`                              | `auto`                                | `auto` \| `browser` \| `jsdom` — browser when Chromium resolves; jsdom is the rollback                                                                                           |
| `ANYTHING_RUNTIME_FALLBACK_TIMEOUT_MS`                 | `max(budget, 6000)`                   | jsdom fallback budget when the browser rung fails open — its own clock, not the browser's                                                                                        |
| `MERMAID_AGENT_RUN_BUDGET_MS_FAST` / `_QUALITY`        | 120000 / 210000                       | Absolute agent-stream run budget (ms), deadline-enforced; Russ gets extra headroom (150000 / 240000)                                                                             |
| `MERMAID_AGENT_RECURSION_LIMIT`                        | 50 (clamped 25–200)                   | LangGraph ReAct step budget per run                                                                                                                                              |
| `MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN`                 | 10                                    | Cap tool invocations per run (`0` disables; clamped 4–40)                                                                                                                        |
| `MERMAID_STREAM_HEARTBEAT_MS`                          | 6000 (clamped 1000–60000)             | SSE heartbeat when no normalized events                                                                                                                                          |
| `MERMAID_METRICS`                                      | unset                                 | When `1`/`true`, emit one structured JSON line per turn                                                                                                                          |
| `DEEPSEEK_THINKING`                                    | unset                                 | DeepSeek V4 thinking mode. **Leave unset for diagram agents** — LangChain doesn't yet preserve `reasoning_content` on assistant tool turns, so tool loops break with thinking on |
| `OPENROUTER_PREFERRED`                                 | unset                                 | When truthy and an OpenRouter key exists, auto mode picks OpenRouter before DeepSeek/Vertex                                                                                      |
| `OPENROUTER_SITE_NAME` / `OPENROUTER_SITE_URL`         | `ArchiSlop` / `http://localhost:5173` | OpenRouter analytics headers                                                                                                                                                     |
| `LLM_COST_ESTIMATES`                                   | auto on Cloud Run                     | When `1`/`true`, thinking panel shows **estimated** USD per agent run. Auto-enabled when `K_SERVICE` is set; set `0`/`false` to hide on Cloud Run. Local dev defaults to off.    |
| `LLM_COST_USD_PER_M_<MODEL>_INPUT` / `_OUTPUT`         | built-in rate table                   | Override USD per 1M tokens for a model slug, e.g. `LLM_COST_USD_PER_M_DEEPSEEK_V4_PRO_INPUT=0.435`. Model key is uppercased with `.` → `_`.                                      |

## Agent run cost estimates (thinking panel)

When deployed on Cloud Run, the thinking panel shows **approximate** LLM spend per built-in agent run:

- Each **Model reasoning turn** line appends `~$0.003` (etc.) next to the token counts when the provider reports usage.
- The run timeline header gets a total chip summing every model turn in that entry.

Estimates are **not** billed amounts — they multiply reported input/output tokens by a rate table. Defaults match published [Vertex Gemini list prices](https://cloud.google.com/vertex-ai/generative-ai/pricing) and [DeepSeek API list prices](https://api-docs.deepseek.com/quick_start/pricing) (cache-miss input + output) for the built-in model slugs.

### Automatic rate refresh (deployed)

On Cloud Run the server merges rates from several sources (see `ratesSources` in `/api/health`):

1. **Bundled JSON** — [`packages/shared/src/data/llm-token-rates.json`](../packages/shared/src/data/llm-token-rates.json) ships with the build.
2. **Remote JSON (default on Cloud Run)** — every 24h (override with `LLM_COST_RATES_REFRESH_MS`) the server fetches `LLM_COST_RATES_URL`, which defaults to the `main` branch raw GitHub URL for that JSON file. **Update prices by merging a PR to that file** — running pods pick it up on the next refresh without redeploying app code.
3. **OpenRouter catalog** — when `OPENROUTER_API_KEY` is set, configured model slugs are refreshed from `GET https://openrouter.ai/api/v1/models`.
4. **Env overrides** — `LLM_COST_USD_PER_M_<MODEL>_INPUT` / `_OUTPUT` win last.

### Keeping rates current manually

1. Open [Vertex generative AI pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) and/or [DeepSeek Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing).
2. Edit `packages/shared/src/data/llm-token-rates.json` (`version` + per-model `inputPerM` / `outputPerM` in USD per 1M tokens) and deploy, **or** hot-patch Cloud Run env vars.
3. Confirm: `curl -sS "$PUBLIC_BASE_URL/api/health" | jq '{enabled:.agentCostEstimates.enabled, version:.agentCostEstimates.ratesVersion, sources:.agentCostEstimates.ratesSources, backends:.llmBackendsByProfile}'`.

The web client reads `agentCostEstimates` from `/api/health` at load. Lifetime totals accumulate in the Slopitect level panel (**Stakeholder Damage Report™**) when cost tracking is enabled. That total includes **canvas agent runs** (each `model_call_end`, including Auto content-type classification and syntax-fixer ladder rungs) **plus** office/advisor/explain/label decorative LLM calls reported through the shared auxiliary usage sink.

## Health check

`GET /api/health` returns `{ status, llmConfigured, runtimeReady, llmBackend, llmBackendsByProfile, agentCostEstimates, … }`. `llmConfigured: true` means `resolveLlmBackend(env)` returned a non-null backend — i.e. at least one of the three providers is usable with the current env. When `false`, the app still loads and renders diagrams but `intent`, `transform`, `analyze`, and `agent-stream` return 503.

`llmBackend` is the Brain backend; `llmBackendsByProfile` shows `{ fast, quality }` (same backend when DeepSeek is set); `llmModelsByProfile` shows resolved `backend:modelId` labels for Fast, Quality, and decorative Fast so the thinking panel can display the real slug.

`agentCostEstimates` shape:

```json
{
  "enabled": true,
  "pricingUrl": "https://cloud.google.com/vertex-ai/generative-ai/pricing",
  "rates": {
    "gemini-2.5-flash": { "inputPerM": 0.3, "outputPerM": 2.5 },
    "deepseek-v4-pro": { "inputPerM": 0.435, "outputPerM": 0.87 }
  }
}
```

## Common configurations

**Local dev with DeepSeek** (both Brain tiers on DeepSeek):

```env
DEEPSEEK_API_KEY=sk-…
```

**Local / Cloud Run with DeepSeek Brain + Vertex office**:

```env
# Vertex via ADC locally, or VERTEX_* on Cloud Run from deploy scripts
VERTEX_PROJECT_ID=mermaidgen
VERTEX_LOCATION=us-central1
VERTEX_MODEL_LITE=gemini-2.5-flash-lite
DEEPSEEK_API_KEY=sk-…
# Brain Fast = deepseek-v4-flash, Quality = deepseek-v4-pro
# Office / advisor = Vertex flash-lite
```

**Vertex-only Brain** (no DeepSeek):

```env
VERTEX_PROJECT_ID=mermaidgen
VERTEX_LOCATION=us-central1
```

On Cloud Run, attach DeepSeek via Secret Manager:

```bash
export DEEPSEEK_API_KEY=sk-…   # from local .env — never commit
npm run secret:deepseek:cloud-run
```

**Local dev with OpenRouter** (choice of upstream models):

```env
OPENROUTER_API_KEY=sk-or-…
LLM_PROVIDER=openrouter
```

**Cloud Run with OpenRouter preferred** (e.g. testing a new OpenRouter model in prod):

```env
OPENROUTER_PREFERRED=1
# Plus OPENROUTER_API_KEY via Secret Manager:
# scripts/push-openrouter-secret-cloud-run.sh
```
