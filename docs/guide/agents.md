# Agents

Orchestration is **not** a separate workflow engine. It is **one or two LangChain agents per content type** (intent + optional transform, plus a shared read-only analysis path) over shared session state, wrapped in repair logic when patches fail validation. Five content types are dispatched: `mermaid`, `infographic`, `metaphor3d`, `chart`, and `anything`.

## Dispatcher and agent services

```mermaid
flowchart TB
  Route["Route handler\n(intent / transform / analyze / agent-stream)"] -->|"contentType"| D["DiagramAgentDispatcher\ndiagramAgentDispatcher.js"]
  D -->|"contentType=mermaid"| MAS["MermaidAgentService\nmermaidLangChainAgent.js"]
  D -->|"contentType=infographic"| IAS["InfographicAgentService\ninfographicLangChainAgent.js"]
  D -->|"contentType=metaphor3d"| MES["MetaphorAgentService\nmetaphorLangChainAgent.js"]
  D -->|"contentType=chart"| CAS["ChartAgentService\nchartLangChainAgent.js"]
  D -->|"contentType=anything"| AAS["AnythingAgentService\nanythingLangChainAgent.js"]
  MAS --> MT["Mermaid tools\napply_mermaid_patch\nget_diagram_state"]
  IAS --> IT["Infographic tools\napply_infographic_patch\nget_diagram_state"]
  MES --> MET["Metaphor tools\napply_metaphor_patch\nget_diagram_state"]
  CAS --> CT["Chart tools\napply_chart_patch\nget_diagram_state"]
  AAS --> AT["Anything tools\napply_anything_patch\napply_anything_edit\nget_anything_html"]
  MT --> MV["validateAndPreparePatch\n(Mermaid 4-layer ladder)"]
  IT --> IV["validateAndPrepareInfographicPatch\n(2-layer: sanitizer + parseSyntax)"]
  MET --> MEV["validateAndPrepareMetaphorPatch\n(schema + sanitizer + syntax fixer)"]
  CT --> CV["validateAndPrepareChartPatch\n(DSL parse + schema)"]
  AT --> AV["validateAndPrepareAnythingPatch\n(shape + policy + quality + runtime check)"]
```

## Roles: intent vs transform vs analysis

```mermaid
flowchart TB
  subgraph mutation ["Mutation paths (diagram may change)"]
    I[Intent agent\nGo · Fix · syntax auto-fix · Copilot invoke]
    T[Transform agent\nRefine · Innovate · Go Mad]
    I --> Tools[(get_diagram_state\napply_*_patch)]
    T --> Tools
  end

  subgraph readonly ["Read-only path"]
    A[Analysis model\nno tools]
    A --> Text[Markdown prose]
  end

  Tools --> V["validateAndPrepare*Patch\n(Mermaid or Infographic)"]
  V --> SS[(State store slot\n+ revision)]
```

- **Intent agent** — `SYSTEM_PROMPT` plus a single user turn. **Go** sends the prompt-bar text inside `applyIntent`'s "interpret and apply" template (with optional focus). **Fix** and **syntax auto-fix** are also intent: the web app composes a different user message but hits the same `POST /api/copilotkit/intent` (or `agent-stream` with `operation: intent`). Uses the **default** (non-transform) agent; model tier follows the UI **Fast** / **Quality** profile.
- **Transform agent** — Same system prompt and tools as intent, but the **user message** is entirely produced by `buildTransformUserContent` for `refine` | `innovate` | `goMad`. Go Mad adds **depth** (`goMadStreak + 1` in the client, capped at 12): hotter sampling and extra escalation text in the prompt. Cached **per mode** (and per Go Mad depth), not shared with intent.
- **Analysis** — Separate chat model path: read-only system prompt plus `buildCritiqueTask` or `buildExplainTask`. **No** diagram tools; output is Markdown only. Used for **Critique** and **Explain**.

Agents are created in `createMermaidLangChainAgent` / `createInfographicLangChainAgent` and cached per model key so repeated operations reuse instances.

## User-facing modes

| Control                         | What it feels like                                                                                                                                                | Server path and code                                                                                                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Go**                          | Does what you asked in the prompt bar — concrete diagram from your words (or a sensible default if you only name a topic).                                        | `applyIntent` in the active agent: user message = intent template + your prompt + optional `buildFocusScopeInstructions`. `requirePatch: true`.                                                                                        |
| **Refine**                      | Same diagram type and story; polish labels, grouping, clarity; modest new structure (prompt budgets ~4 nodes / 6 edges).                                          | `applyTransformIntent` with `mode: refine`. Sampling ~`temperature 0.42`, shared transform caps in `TRANSFORM_MODEL_LIMITS`.                                                                                                           |
| **Innovate**                    | Noticeable redesign; may switch diagram type when justified; larger edits (~10 nodes / 14 edges).                                                                 | `applyTransformIntent` with `mode: innovate`. Sampling ~`temperature 0.82`.                                                                                                                                                            |
| **Go Mad**                      | Wild reinterpretation, exotic types, meme energy; first turn should patch immediately.                                                                            | `applyTransformIntent` with `mode: goMad`. `goMadTransformModelOptions(depth)`: moderate temperature (~0.95) with a gentle per-tier ramp — the chaos is prompt-driven (escalation tiers + diagram-type roulette), not sampling-driven. |
| **Critique**                    | Structured review (strengths, weaknesses, type fit, style, actionable list) — does **not** change the diagram.                                                    | `applyAnalyzeIntent` with `kind: critique`. Analysis model only.                                                                                                                                                                       |
| **Explain**                     | Walks a reader through meaning, flows, entities — read-only.                                                                                                      | `applyAnalyzeIntent` with `kind: explain`.                                                                                                                                                                                             |
| **Fix**                         | Turns the last critique into an actual edit (whole critique, or only checked "actionable" bullets in the insights pane).                                          | Still **`operation: intent`**: `App.jsx` builds a long "apply these improvements / this critique" prompt and calls the same route as Go. Resets Go Mad streak. Clears stored critique after success.                                   |
| **Syntax auto-fix** (automatic) | When the editor shows a parse error (Mermaid) or an Anything page throws during load, a debounced run repairs it. **Mermaid and Anything** take a cheap fast-path first: `POST /api/diagram/render-error` runs only the single-shot fixer (`routes/diagramRepair.js`) — one LLM call, no agent loop — and falls back to the full intent ladder only if that rejects. Other slots go straight to the `intent` path with a repair prompt. | Fast path `POST /api/diagram/render-error` (with `contentType`), else **`operation: intent`** with a fixed repair prompt (`runAutoFix` in `App.jsx`).                                                                                   |

**Style** (`POST /api/copilotkit/style`) is another mutation: same tools, but the user message is style-only (`%%{init: ...}%%`, `classDef`, Vega theme, etc.). Supported by **Mermaid and Chart**; the route rejects other content types.

Validation and repair ladders: [Validation & repair](validation.md).

## Interaction flow

1. User picks **Mode** (Diagram, Infographic, 3D, Chart, or Anything) from the AI corner controls; the UI persists the choice (Mermaid, Infographic, and Metaphor3D only) and includes `contentType` in every subsequent request.
2. User edits source or loads state; client syncs via `GET`/`POST /api/copilotkit/state` with `contentType`.
3. **Go** and **Fix from critique** use the **intent** operation: `POST /api/copilotkit/agent-stream` with `operation: intent`, or `POST /api/copilotkit/intent` without streaming. The active `contentType` is forwarded. **Syntax auto-fix** for Mermaid and Anything tries the fast-path `POST /api/diagram/render-error` first (one fixer call, no agent loop) and only falls back to the intent operation on rejection.
4. **Refine / Innovate / Go Mad** use `agent-stream` or `POST /api/copilotkit/transform` with `mode` and optional `goMadDepth`.
5. **Critique / Explain** use `analyze` or `agent-stream` with `operation: analyze`; responses patch insights only, not diagram state.
6. **Style** is Mermaid or Chart only; the route rejects other `contentType` values with a 400.
7. **Clear** resets to the starter diagram for the active mode via client + server state conventions.

## Agent profiles

- **Intent** defaults: `temperature 0.7`, `topP 1`, `maxNodes 25`, `style balanced`, `persona creative architect` (see `INTENT_PROFILE_DEFAULTS` in `mermaidLangChainAgent.js`). These apply to Mermaid intent; the Infographic agent uses the same LLM settings but different system prompt and tool (`INFOGRAPHIC_SYSTEM_PROMPT`).
- **Transform** modes reuse the same tools with different **user** prompts and sampling (`transformModeModelOptions` / `goMadTransformModelOptions`), shared between content types.
- **Analysis** uses dedicated temperatures for streaming; on Vertex stream failure with an OpenRouter key configured, analyze can **retry once on OpenRouter** with a fixed temperature.
