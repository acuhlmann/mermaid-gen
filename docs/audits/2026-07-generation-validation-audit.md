# Generation & validation audit — all content types × action personas

_Date: 2026-07-11. Scope: how archislop generates and validates diagram content across the five slots (`mermaid`, `infographic`, `metaphor3d`, `chart`, `anything`) and the action personas (Go, Refine/Innovate/Go Mad/Exec, Fix/auto-fix, Critique/Explain, Style). Goals: higher first-pass and end-to-end success, lower latency, fewer user-visible failures, simpler architecture with justified per-slot differences kept._

**How to read this doc.** Sections 1–3 are **audit findings** (what the code does today, with file/function citations). Sections 4–7 are **recommendations**. Doc/code inconsistencies are flagged inline with ⚠️ and collected in §1.6.

---

## 0. Architecture validation (baseline understanding, confirmed against code)

The mission statement's model is broadly correct, with three corrections:

1. **There is no single `invokeWithRepair`.** There are **three generations** of repair orchestrator:
   - **Mermaid** (`apps/server/src/agents/mermaidLangChainAgent.js`, `invokeWithRepair` at ~line 404): a _staged pipeline_ — first turn → prose recovery → dedicated patch-retry turn (stable agent, not counted against repair attempts) → single-shot fixer → bounded repair loop that **rebuilds** its message set each attempt (`baseMessages + one repair instruction`, prior attempts capped at `slice(-2)`).
   - **Infographic** (`infographicLangChainAgent.js`, `invokeWithRepair` at ~line 238): a _unified for-loop_ (`attempt 0..maxRepairAttempts`) with prose recovery, fixer-once, stable-agent swap once on prose-only responses, and **cumulative** repair `SystemMessage`s appended to the running transcript.
   - **Chart / Metaphor / Anything** (`chartLangChainAgent.js` ~line 244, `metaphorLangChainAgent.js` ~line 196, `anythingLangChainAgent.js` ~line 214): three near-verbatim clones of the infographic loop, minus the stable agent, minus the agent cache, minus the `console.warn` diagnostics.
2. **Budget discipline is uniform, observability is not.** All five use `resolveAgentRunBudgetMs` / `createRunDeadlineSignal` / `MIN_*_BUDGET_MS` fail-fast / `appendLastValidationError` identically. But `recordAgentTurn` metrics exist **only in the mermaid agent** (verified: the only import of `agentTurnMetrics.js` outside its test).
3. **Graph-level guardrails are mermaid-only.** Only the mermaid agent passes `getAgentRunnableConfig` (recursion limit 50) and `createDiagramAgentMiddleware` (tool-call cap 10) — via `_lib/diagramAgentStreaming.js#runAgentTurn`, which only mermaid uses. The other four call `agent.streamEvents(…, { version: 'v2', signal })` directly: LangGraph default recursion limit (25), **no tool-call cap**.

---

## 1. Failure taxonomy

### 1.1 Failure classes and where they are produced

| Failure class                                                 | Wire shape                                                                                                               | Producing code path                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Validation exhausted** (repair ladder ran out)              | SSE `error` `no_mutation_revision` + final message `"<Mode> update failed: <validator error>"`; REST 422                 | Each agent's `invokeWithRepair` exhaustion tail (mermaid ~line 818; infographic ~line 536; chart ~line 463; metaphor ~line 410; anything ~line 433) → classified client-side by `apps/web/src/utils/agentStreamFailureStatus.ts` as `syntax_exhausted`                                                                                           |
| **Timeout / budget exceeded**                                 | SSE `error` code `run_budget_exceeded` with `Last validation error: …` appended                                          | `stopReason()` + `finishStoppedRun()` closures (duplicated in all five agents); message built by `buildAgentRunBudgetExceededMessage` + `appendLastValidationError` (`packages/shared/src/agentRunBudget.ts`)                                                                                                                                    |
| **No patch** (prose-only model output survived retries)       | SSE `error` `no_mutation_revision` (`STREAM_ERROR_NO_MUTATION_REVISION` in `_lib/diagramAgentStreamResult.js`); REST 422 | mermaid: dedicated patch-retry branch (`buildPatchRequiredInstruction`); others: `*_PATCH_REQUIRED_INSTRUCTION` appended inside the loop (consumes a repair attempt)                                                                                                                                                                             |
| **Client abort (user stop)**                                  | run ends with `run_aborted`                                                                                              | `abortSignal` from `POST /api/copilotkit/agent-stream` (`routes/copilot.ts` ~line 715, `req.on('aborted')`/`res.on('close')`) → `stopReason()` in each agent                                                                                                                                                                                     |
| **Client watchdog abort**                                     | stream killed client-side; server keeps running to deadline                                                              | `apps/web/src/state/diagramStore.js`: 60 s idle timeout (`AGENT_STREAM_IDLE_TIMEOUT_MS`) + budget+15 s max duration (`AGENT_STREAM_MAX_DURATION_GRACE_MS`); server keep-alives that prevent it: route-level AG-UI CUSTOM heartbeat every 15 s (`copilot.ts` ~line 749), mermaid-only 6 s "Thinking…" heartbeat (`_lib/diagramAgentStreaming.js`) |
| **Infra / invoke error** (backend down, region, tool-support) | mermaid: rich hint message (`formatAgentInvokeFailure`); others: raw redacted message                                    | mermaid `formatAgentInvokeFailure` (~line 353) adds region/tools/Vertex-IAM hints; the four loop agents just `emit({type:'error', message})` and break — ⚠️ hint text is mermaid-only                                                                                                                                                            |
| **Stale revision**                                            | HTTP 409 before any LLM call                                                                                             | route handlers in `routes/copilot.ts` (`handleDiagramIntent` etc.) compare `revisionId`                                                                                                                                                                                                                                                          |
| **LLM not configured**                                        | typed status code                                                                                                        | `LlmNotConfiguredError` thrown by `createLazyAgentService#getAgentService`                                                                                                                                                                                                                                                                       |
| **Constraint rejection** (transform semantics)                | validator error inside the ladder                                                                                        | `validateMermaidTransformConstraint` (`packages/shared/src/mermaidTransformPolicy.ts`), `validateInfographicTransformConstraint` (`infographicTransformPolicy.ts`) — wired through `stateStore` transform context (`diagramStateStore.ts` ~lines 159, 202). **Not implemented** for chart/metaphor/anything                                      |
| **Runtime failure (anything only)**                           | `runtime_error` / `runtime_timeout` / `blank_render` codes                                                               | `runAnythingRuntimeCheck` (`apps/server/src/tools/anythingRuntimeCheck.js`); infra failures fail **open** with a warning                                                                                                                                                                                                                         |
| **Client render/runtime error post-accept**                   | auto-fix flow                                                                                                            | Mermaid render errors and Anything load-phase iframe errors → `App.jsx#runAutoFix` → mermaid fast path `POST /api/diagram/render-error` (`routes/diagramRepair.js`), else full intent pipeline with `buildAutoFixPrompt`                                                                                                                         |

### 1.2 Content type × persona matrix (mutation paths)

Personas resolve to three server operations; failure behavior is per-cell:

|                 | Go (intent)                                                                                                          | Refine / Innovate / Go Mad / Exec (transform)                                                                                   | Fix / auto-fix (intent)                                                         | Style                                                   | Critique / Explain (analyze)                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| **mermaid**     | Staged ladder; stable-agent patch retry; metrics; syntax-guidance pre-injection (`buildSyntaxGuidanceSystemMessage`) | Same + per-mode sampling (`transformModeModelOptions`), Go Mad depth ramp, constraint validator                                 | Fast path via `/api/diagram/render-error` (1 fixer call), fallback to intent    | Yes (`applyStyleIntent`, fast profile pinned)           | Streams tokens; OpenRouter retry on Vertex stream failure |
| **infographic** | Loop ladder; stable-agent swap on prose-only; language lock; `refine-prepass` (deterministic `refineInfographicDsl`) | Same + per-mode sampling + template-family constraints                                                                          | Intent path only (no fast path)                                                 | — (route 400s)                                          | Streams tokens; invoke fallback                           |
| **metaphor3d**  | Loop ladder; fresh agent per call; default sampling                                                                  | ⚠️ ignores `focusNode` in prompt, no `advisorPrompt` plumbing (`createLazyMetaphorAgentService` sets no `transformExtraFields`) | Intent path only                                                                | —                                                       | ⚠️ **no token streaming** (blocking `model.invoke`)       |
| **chart**       | Loop ladder; fresh agent per call; default sampling                                                                  | Default sampling for all modes (deliberate for Go Mad — see §4.8)                                                               | Intent path only                                                                | Yes (bounded style vocabulary, `buildStyleUserContent`) | ⚠️ **no token streaming**                                 |
| **anything**    | Loop ladder; fresh agent per call; runtime check on every accepted candidate                                         | `apply_anything_edit` preferred for Refine/Exec (`preferEdits`); default sampling                                               | Runtime-error auto-fix goes through **full intent run** (⚠️ no fixer fast path) | —                                                       | ⚠️ **no token streaming**                                 |

### 1.3 Where budget goes when a run fails (latency anatomy)

A worst-case Fast-profile mermaid run (75 s budget): first turn (~10–25 s) → patch-retry turn (~10–20 s) → fixer (~2–4 s) → 2 repair turns (~10–25 s each) — the ladder fits only because `MIN_AGENT_REPAIR_TURN_BUDGET_MS` (12 s) fail-fasts the tail. The four loop agents have the same shape minus the patch-retry stage. Observed non-LLM validator costs are negligible except the anything runtime check (§2.5).

### 1.4 Cost-amplifying defects found (audit findings, not yet recommendations)

- **F1 — cumulative repair transcripts.** Infographic/chart/metaphor/anything append each repair `SystemMessage` to the running `messages` array (`messages = [...messages, new SystemMessage(...)]`). Each repair instruction embeds the **full broken source** and the **original request** — and for these slots the "original request" (`extractOriginalRequest`) is the first user message, which itself embeds the **entire current document/DSL** (`buildIntentUserContent` / `buildAnythingTransformUserContent`). For `anything` (docs up to `ANYTHING_HTML_MAX_LENGTH` = 200 000 chars, `packages/shared/src/anythingSchema.ts`), repair attempt 2 can carry **4+ copies of a ~200 KB document (~50 K tokens each)**. Mermaid avoids this by rebuilding `[...baseMessages, oneRepairInstruction]` per attempt with history capped at 2.
- **F2 — abandoned REST runs burn full budget.** `handleDiagramIntent` / `handleDiagramTransformIntent` / `handleStyleIntent` (`routes/copilot.ts`) never construct an `AbortSignal`; if the client disconnects (its `fetchWithTimeout` fires), the server continues all repair turns to the deadline. Only `/agent-stream` wires aborts. The auto-fix fallback path uses REST intent, so a user closing the tab mid-auto-fix still costs a full ladder.
- **F3 — anything auto-fix skips the cheap rung.** `App.jsx#runAutoFix` has a fixer fast path only for mermaid (`submitDiagramRenderRepair`). An anything load-phase runtime error triggers a full agent intent run even when `repairAnythingWithFixer` (1 fast-model call + static vet + store apply with runtime check) would very likely fix it.
- **F4 — un-cached agents.** Chart/metaphor/anything call `buildAgent(runProfile)` inside every `invokeWithRepair` — a new LangChain agent + chat-model instance per request (mermaid/infographic use `createDiagramAgentCache`). Not huge, but it also means no place to hang per-mode sampling or middleware.
- **F5 — unbounded tool churn outside mermaid.** No `toolCallLimitMiddleware` and default recursion limit for the four non-mermaid agents; a pathological turn can loop `get_*` / `apply_*` calls until the run budget kills it, with the budget (not a cheap cap) as the only brake.
- **F6 — metaphor validator swallows the root cause.** `sanitizeMetaphorDsl` (`packages/shared/src/metaphorSanitizer.ts` ~line 629) discards `MetaphorDslSchema.safeParse` issues (`dsl: null`, no error), and `validateAndPrepareMetaphorPatch` (`apps/server/src/tools/metaphorDslTool.js`) then returns a fixed generic string ("Metaphor DSL did not parse. Emit a JSON object: …"). JSON.parse failures (line ~596) also drop the parse message. The fixer and repair prompts therefore get **zero signal about which field failed** — directly violating the "Parser errors are verbatim" principle in `docs/guide/validation.md` and lowering repair success for the whole slot. Chart, by contrast, formats Zod issues path-by-path (`parseChartDsl` in `chartSchema.ts`) and relays `vega-lite compile()` messages.
- **F7 — no metrics for 4 of 5 slots.** `MERMAID_METRICS` turn records (accept/validator/repair-attempts/error-class) exist only in the mermaid agent, so the mission's target numbers (first-pass rate, repair depth, latency) are currently **unmeasurable** for infographic/metaphor3d/chart/anything in production.

### 1.5 Failure-class × slot summary (what a user actually sees)

| Failure class                      | mermaid                         | infographic         | metaphor3d                 | chart          | anything       |
| ---------------------------------- | ------------------------------- | ------------------- | -------------------------- | -------------- | -------------- |
| Timeout w/ root cause              | ✅                              | ✅                  | ⚠️ root cause generic (F6) | ✅             | ✅             |
| Validation exhausted w/ root cause | ✅                              | ✅                  | ⚠️ generic (F6)            | ✅             | ✅             |
| No-patch retry quality             | stable agent, extra turn        | stable swap in-loop | same hot agent             | same hot agent | same hot agent |
| Infra error hints                  | ✅ (`formatAgentInvokeFailure`) | ❌ raw message      | ❌                         | ❌             | ❌             |
| Turn metrics                       | ✅                              | ❌                  | ❌                         | ❌             | ❌             |
| Auto-fix fast path                 | ✅                              | n/a                 | n/a                        | n/a            | ❌ (F3)        |

### 1.6 Doc/code inconsistencies (⚠️ collected)

| Doc claim                                                                                                                        | Code reality                                                                                                                                                                                        | Where                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `MERMAID_REPAIR_MAX_ATTEMPTS` default "Fast 2, Quality **1**"                                                                    | `DEFAULT_AGENT_REPAIR_ATTEMPTS_QUALITY = 2`                                                                                                                                                         | `docs/guide/configuration.md` vs `packages/shared/src/agentRunBudget.ts:9-10`                                     |
| `MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN` default "**6**"                                                                           | `DEFAULT_MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN = 10`                                                                                                                                                 | `docs/guide/configuration.md` vs `apps/server/src/agents/agentGraphConfig.js:9`                                   |
| "Syntax auto-fix … **Mermaid-only**; infographic uses the same intent path"                                                      | Anything load-phase runtime errors also auto-fix (`autoFixPrompt.js` has an anything branch); the mermaid **fast-path endpoint** `/api/diagram/render-error` is not mentioned in `agents.md` at all | `docs/guide/agents.md` mode table vs `apps/web/src/App.jsx#runAutoFix`, `apps/server/src/routes/diagramRepair.js` |
| Metaphor pipeline: "Schema check … validates the discriminated union" (implying real diagnostics) + "Parser errors are verbatim" | Zod issues discarded (F6)                                                                                                                                                                           | `docs/guide/validation.md` vs `metaphorSanitizer.ts` / `metaphorDslTool.js`                                       |
| `CHART_REPAIR_MAX_ATTEMPTS` / `METAPHOR_REPAIR_MAX_ATTEMPTS` / `ANYTHING_REPAIR_MAX_ATTEMPTS` referenced in validation.md        | Real (via `resolveAgentRepairMaxAttempts`) but absent from the configuration.md table                                                                                                               | `docs/guide/configuration.md`                                                                                     |
| "Agents are created … and cached per model key so repeated operations reuse instances"                                           | True for mermaid/infographic only; chart/metaphor/anything rebuild per call (F4)                                                                                                                    | `docs/guide/agents.md` §Dispatcher                                                                                |

---

## 2. Cost model per validation layer

"Typical ms" figures come from committed bench snapshots (`apps/server/bench-results/after-cleanup-…json`, `baseline-2026-07-09…json`) and code inspection; LLM figures are order-of-magnitude.

### 2.1 Mermaid (`validateAndPreparePatch`, `apps/server/src/tools/mermaidDiffTool.js`)

| #   | Layer                                                                                       | Typical ms                                                           | LLM                | When it runs                                                  | Skip conditions                                                                             |
| --- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | `prepareMermaidForRender` + `parseMermaidStyleConfig` (+ sanitizer retry on init-JSON fail) | <1–2                                                                 | N                  | every candidate                                               | —                                                                                           |
| 2   | Heuristic prefix (`looksLikeMermaid`)                                                       | <0.1                                                                 | N                  | inside `validateMermaidStrict`                                | —                                                                                           |
| 3   | `mermaid.parse()` in JSDOM (`validateMermaidStrict`)                                        | 10–35 (bench p50 ≈ 11; JSDOM warmed at server start, `index.js:186`) | N                  | every candidate                                               | —                                                                                           |
| 4   | Sanitizer rescue + re-parse (`sanitizeMermaid`)                                             | +10–35                                                               | N                  | only on parse fail                                            | sanitizer made no change                                                                    |
| 5   | Transform constraint (`validateMermaidTransformConstraint`)                                 | <1                                                                   | N                  | only when transform context set                               | non-transform runs                                                                          |
| 6   | Single-shot fixer (`repairMermaidWithFixer`)                                                | 1 000–4 000                                                          | **Y** (fast model) | first validation failure with a captured broken source        | no broken source; fixer unconfigured; `isMermaidTransformConstraintError`; <4 s budget left |
| 7   | Agent repair turn                                                                           | 5 000–30 000                                                         | **Y**              | fixer failed; per attempt up to `MERMAID_REPAIR_MAX_ATTEMPTS` | <12 s budget left                                                                           |

### 2.2 Infographic (`validateAndPrepareInfographicPatch`, `apps/server/src/tools/infographicDslTool.js`)

| #   | Layer                                                                                            | Typical ms   | LLM   | When                                                    | Skip                                        |
| --- | ------------------------------------------------------------------------------------------------ | ------------ | ----- | ------------------------------------------------------- | ------------------------------------------- |
| 1   | Sanitizer (fences, tabs, smart quotes, leading prose, structural `sanitizeInfographicDslShared`) | <1           | N     | always                                                  | —                                           |
| 2   | Textual lint (header, whitelist w/ suggestions, multi-header)                                    | <1           | N     | always                                                  | —                                           |
| 3   | AntV `parseSyntax` (errors include quoted offending line)                                        | 1–5          | N     | lint passed                                             | —                                           |
| 4   | Transform constraint (template family / item budgets)                                            | <1           | N     | transform context set                                   | —                                           |
| 5   | `refine-prepass` (`refineInfographicDsl`) — deterministic pre-mutation cleanup                   | <1           | N     | **before** the Refine LLM turn (`applyTransformIntent`) | non-refine modes                            |
| 6   | Fixer (`repairInfographicWithFixer`)                                                             | 1 000–4 000  | **Y** | once per run                                            | constraint errors; no broken source; budget |
| 7   | Agent repair turn                                                                                | 5 000–30 000 | **Y** | loop attempts                                           | budget                                      |

### 2.3 Metaphor3D (`validateAndPrepareMetaphorPatch`, `apps/server/src/tools/metaphorDslTool.js`)

| #   | Layer                                                                              | Typical ms   | LLM   | When   | Skip                                           |
| --- | ---------------------------------------------------------------------------------- | ------------ | ----- | ------ | ---------------------------------------------- |
| 1   | Fence strip + `JSON.parse`                                                         | <1           | N     | always | —                                              |
| 2   | ~14 deterministic rescue passes + Zod (`sanitizeMetaphorDsl`, `MetaphorDslSchema`) | 1–3          | N     | always | —                                              |
| 3   | Fixer (`repairMetaphorWithFixer`)                                                  | 1 000–4 000  | **Y** | once   | ⚠️ fed a **generic** error (F6) — badly seeded |
| 4   | Agent repair turn                                                                  | 5 000–30 000 | **Y** | loop   | budget                                         |

**Layer that "runs too blind":** layers 3–4 here are paying LLM cost with no diagnostic — the cheapest accuracy win in the whole system (§6 QW-1).

### 2.4 Chart (`validateAndPrepareChartPatch`, `apps/server/src/tools/chartDslTool.js`)

| #   | Layer                                                           | Typical ms   | LLM   | When          | Skip                     |
| --- | --------------------------------------------------------------- | ------------ | ----- | ------------- | ------------------------ |
| 1   | `JSON.parse` + Zod wrapper w/ per-path issues (`parseChartDsl`) | <1           | N     | always        | —                        |
| 2   | `vega-lite compile()`                                           | 5–50         | N     | wrapper valid | —                        |
| 3   | Fixer (`repairChartWithFixer`)                                  | 1 000–4 000  | **Y** | once          | no broken source; budget |
| 4   | Agent repair turn                                               | 5 000–30 000 | **Y** | loop          | budget                   |

No sanitizer by design (ADR-worthy decision already recorded in CLAUDE.md; `compile()` errors are precise). No constraint validator (transform context is not even passed for chart in `diagramStateStore.ts`). Justified — see §4.8.

### 2.5 Anything (`validateAndPrepareAnythingPatch`, `apps/server/src/tools/anythingHtmlTool.js`)

| #   | Layer                                                                                                     | Typical ms                                                                                                | LLM   | When               | Skip                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----- | ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Shape (`parseAnythingHtml`, 200 KB cap)                                                                   | <1                                                                                                        | N     | always             | —                                                                                                                |
| 2   | Policy lint (`lintAnythingPolicy`)                                                                        | ~1                                                                                                        | N     | shape passed       | —                                                                                                                |
| 3   | Quality lint (`lintAnythingQuality`, acorn JS parse)                                                      | 5–50 (doc-size dependent)                                                                                 | N     | policy passed      | —                                                                                                                |
| 4   | Lib-marker lint (`lintAnythingLibMarkers`)                                                                | <1                                                                                                        | N     | quality passed     | —                                                                                                                |
| 5   | **Runtime check** (`runAnythingRuntimeCheck`): child-process spawn + jsdom + 250 ms settle, 4 s hard kill | **~1 150–1 250 per accepted patch** (bench: valid docs 1 159–1 255 ms; `runtime_timeout` case = 4 038 ms) | N     | agent patches only | client sync (`runtimeCheck: false` in `syncAnythingSlot`); `ANYTHING_RUNTIME_CHECK=0`; infra failure ⇒ fail-open |
| 6   | Fixer (`repairAnythingWithFixer`) — static-only vet, store apply re-runs full ladder                      | 1 000–4 000                                                                                               | **Y** | once               | budget; no broken source                                                                                         |
| 7   | Agent repair turn                                                                                         | 5 000–30 000                                                                                              | **Y** | loop               | budget                                                                                                           |

**Findings on layer economics:**

- The runtime check is the only deterministic layer with a material latency cost (~1.2 s fixed tax per accepted anything patch, plus per repair-candidate). It buys real value (bench `runtimeCatchRate` 100 % on runtime-failing corpus) — keep it, but it is the right target for a _measured_ optimization (persistent warm sandbox process, or lowering `DEFAULT_ANYTHING_RUNTIME_SETTLE_MS`) if anything-mode latency becomes a complaint. Do not trade it away silently.
- **Layers that rarely help:** the mermaid _heuristic prefix check_ rejects before the parser ~never for tool-called patches (the model almost always emits a known header; it exists mostly to cheap-reject prose) — fine, it's free. The infographic _smart-quote/tab re-checks_ in `validateAndPrepareInfographicPatch` after `sanitizeInfographicDsl` already normalized them are dead branches except for exotic quote characters — harmless but noise.
- **Layer that runs too late:** mermaid's syntax **rule packs** are injected pre-turn only for mutations with `requirePatch` (`buildSyntaxGuidanceSystemMessage`) and only when a diagram type is already inferable. Chart/anything have `*_SELF_CHECK` blocks in fixer prompts but nothing pre-injected on first generation; anything's system prompt covers it (`ANYTHING_CORE_RULES`). Infographic bundles rules into its (large, 22 KB) `infographicSyntaxGuard.js` system prompt. This asymmetry is acceptable; no change recommended without bench data.

### 2.6 LLM call inventory per persona (where wasted calls hide)

| Path                  | Guaranteed LLM calls                                           | Worst-case extra calls                                                                        |
| --------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Go/Fix (all slots)    | 1 agent turn                                                   | +1 patch-retry (mermaid) or +1 loop attempt (others), +1 fixer, +N repair turns (N=2 default) |
| Transform             | 1                                                              | same as above                                                                                 |
| Analyze               | 1 (no tools)                                                   | +1 (mermaid Vertex→OpenRouter stream retry, then invoke fallback)                             |
| Style (mermaid/chart) | 1                                                              | + full ladder                                                                                 |
| Auto-fix mermaid      | **0 agent turns** if fixer lands (`/api/diagram/render-error`) | falls back to full intent ladder                                                              |
| Auto-fix anything     | full intent ladder (F3)                                        | —                                                                                             |

---

## 3. Duplication map

### 3.1 What is already shared (keep using)

| Concern                                                                                                       | Location                                                                        | Used by                        |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------ |
| Budgets, fail-fast minimums, budget message, `appendLastValidationError`                                      | `packages/shared/src/agentRunBudget.ts`                                         | all 5 + web client             |
| Deadline signal                                                                                               | `agents/_lib/agentRunDeadline.js`                                               | all 5                          |
| Stream-event normalization, tool-failure/tool-source extraction, `toLangChainMessages`, `extractFinalMessage` | `agents/_lib/diagramAgentHelpers.js`                                            | all 5                          |
| Lazy service + SSE final/error protocol                                                                       | `agents/_lib/createLazyAgentService.js`, `_lib/diagramAgentStreamResult.js`     | all 5                          |
| Plan beats, fixer telemetry, patch-tool stream tracker                                                        | `planBeatMessages.ts`, `syntaxFixerTelemetry.js`, `streamPatchToolTelemetry.ts` | all 5                          |
| Agent/model cache                                                                                             | `_lib/diagramAgentCache.js`                                                     | mermaid, infographic only (F4) |
| Streaming turn with heartbeat + runnableConfig + invoke fallback                                              | `_lib/diagramAgentStreaming.js`                                                 | **mermaid only**               |
| Search/replace edit engine                                                                                    | `_lib/searchReplaceEdits.js`                                                    | anything                       |

### 3.2 What is copy-pasted (the refactor surface)

| Cloned block                                                                                    | mermaid                             | infographic                                | chart                                | metaphor                                | anything                         | Notes                                                                                                                                                |
| ----------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------ | ------------------------------------ | --------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stopReason()` closure                                                                          | ✅                                  | ✅                                         | ✅                                   | ✅                                      | ✅                               | 5 near-identical copies                                                                                                                              |
| `finishStoppedRun()`                                                                            | ✅                                  | ✅                                         | ✅                                   | ✅                                      | ✅                               | mermaid adds metrics                                                                                                                                 |
| `invokeAgentStream` (stream→capture→normalize→telemetry)                                        | via `_lib`                          | inline copy                                | inline copy                          | inline copy                             | inline copy                      | 4 inline copies of what `_lib/diagramAgentStreaming.js` already does, minus heartbeat/config                                                         |
| Repair loop skeleton (revision check → prose recovery → fixer-once → repair instruction append) | staged variant                      | ✅                                         | ✅                                   | ✅                                      | ✅                               |                                                                                                                                                      |
| `extractOriginalRequest`                                                                        | – (inline join)                     | ✅                                         | ✅                                   | ✅                                      | ✅                               | 4 copies                                                                                                                                             |
| local `extractTextContent`                                                                      | uses shared                         | ✅                                         | ✅                                   | ✅                                      | ✅                               | 4 copies **despite** `_lib/diagramAgentHelpers.js` re-exporting the shared one                                                                       |
| Prose-candidate extractor                                                                       | `extractMermaidFromAssistantResult` | `extractInfographicDslFromAssistantResult` | `extractChartDslFromAssistantResult` | `extractMetaphorDslFromAssistantResult` | `extractHtmlFromAssistantResult` | same reverse-walk skeleton; only the per-slot "does this text look like my DSL" predicate differs                                                    |
| Syntax fixer (`repair*WithFixer`)                                                               | ✅                                  | ✅                                         | ✅                                   | ✅                                      | ✅                               | 5 files, identical shape: model → prompt(rulepack+error+request+broken) → extract → strict-validate. Only prompt text + extractor + validator differ |
| `*_PATCH_REQUIRED_INSTRUCTION`                                                                  | builder fn                          | const                                      | const                                | const                                   | const                            |                                                                                                                                                      |
| State store `applyTo*Slot` / `sync*Slot`                                                        | —                                   | —                                          | —                                    | —                                       | —                                | 5 near-identical pairs in `diagramStateStore.ts` (only validator fn + transform-context wiring differ)                                               |

### 3.3 Recommendation: unified repair orchestrator with slot plugins

One orchestrator in `apps/server/src/agents/_lib/diagramAgentOrchestrator.js`; per-slot behavior expressed as a declarative adapter. Pseudocode:

```js
/** @typedef SlotAdapter */
const anythingAdapter = {
  contentType: 'anything',
  patchToolName: 'apply_anything_patch',          // telemetry + broken-source extraction
  extraPatchToolNames: ['apply_anything_edit'],
  slotLabel: 'page',                               // for messages/phases
  getAgent: (profile, mode, goMadDepth) => cache.getDefaultAgent(profile),  // slot decides sampling
  getStableAgent: null,                            // optional; mermaid/infographic supply one
  buildRepairInstruction: ({ error, brokenSource, originalRequest }) => …,  // existing builders
  buildPatchRequiredInstruction: () => ANYTHING_PATCH_REQUIRED_INSTRUCTION,
  extractProseCandidate: (result) => extractHtmlFromAssistantResult(result),
  fixer: { isAvailable, repair: repairAnythingWithFixer },
  isConstraintError: null,                         // mermaid/infographic: isMermaidTransformConstraintError
  emitDraftPreview: true,                          // mermaid: false
  emitPatchSummaryArtifact: false                  // mermaid: true
};

async function runRepairOrchestrator(adapter, userMessages, opts, stateStore, env) {
  // ONE implementation of:
  //  - runBudget + createRunDeadlineSignal + stopReason/finishStoppedRun (incl. appendLastValidationError)
  //  - recordAgentTurn metrics for EVERY slot (fixes F7)
  //  - runAgentTurn via _lib/diagramAgentStreaming (heartbeat + recursionLimit + tool-cap middleware — fixes F5)
  //  - first turn → revision check → prose recovery → patch-required retry (stable agent if provided)
  //  - fixer-once (skip on adapter.isConstraintError) → bounded repair loop
  //  - repair turns REBUILD messages: [...baseMessages, buildRepairInstruction(latest, boundedHistory)]
  //    (fixes F1 — no cumulative transcripts; history capped like mermaid's slice(-2))
  //  - emit phases/plan beats/fixer telemetry with adapter.slotLabel
}
```

The five agent files shrink to: prompt builders + adapter + `applyIntent`/`applyTransformIntent`/`applyAnalyzeIntent` wrappers. The generic prose-extractor skeleton can also collapse: `extractProseCandidate` becomes `walkAssistantMessages(result, adapter.proseMatcher)` in `_lib`.

**Consolidation candidates outside the orchestrator** (separate, smaller):

- One `createSlotSyntaxFixer({ systemPrompt, rulePack, selfCheck, extractCandidate, validateStrict, validatorLabel })` factory replacing the 5 `*SyntaxFixer.js` bodies.
- One `makeSlotHandlers(contentType, validator, { passTransformContext })` in `diagramStateStore.ts` replacing the 5 `applyTo*Slot`/`sync*Slot` pairs.

---

## 4. Simplification proposals

Each proposal: problem → change → blast radius (per `docs/agent-blast-radius.md`) → risk → measurement. **None of these touch wire contracts** (`contentType`, patch schemas, AG-UI events, MCP tools) unless flagged.

### P1 — Per-slot agent-turn metrics (do this first)

- **Problem:** F7 — only mermaid emits `agent_turn` records; goals are unmeasurable elsewhere.
- **Change:** move `finishTurn`/`recordAgentTurn` wiring into the shared loop (or, pre-orchestrator, paste the 6-line `finishTurn` into the four agents). Add a `contentType` field to the record (schema says "shape stays stable" — additive field, coordinate with any log shipper).
- **Blast radius:** `apps/server/src/metrics/agentTurnMetrics.js`, 4 agent files, `agentTurnMetrics.test.js`. No wire contract.
- **Risk:** none (opt-in via `MERMAID_METRICS`).
- **Measure:** existence of records per slot; becomes the baseline for everything below.

### P2 — Unified repair orchestrator (structural)

- **Problem:** §3.2 — three orchestrator generations; fixes to one don't propagate (the mermaid non-cumulative repair transcript, stable-agent retry, metrics, heartbeat, tool-cap never reached the other slots).
- **Change:** §3.3. Phased: (a) extract `stopReason`/`finishStoppedRun`/budget scaffold; (b) port **chart + metaphor + anything** (identical clones — one adapter each, delete ~600 duplicated lines); (c) port infographic (keep stable-swap + language lock + prepass as adapter hooks); (d) port mermaid last (it has the most extra stages; it _defines_ the target behavior).
- **Blast radius:** `apps/server/src/agents/*LangChainAgent.js`, `_lib/`, tests `mermaidLangChainAgent.test.js`, `infographicLangChainAgent.test.js`, `chartLangChainAgent.test.js`, `anythingLangChainAgent.test.js`. SSE event _sequence_ must stay stable (phase ids are asserted in tests; keep per-slot phase ids as adapter config). No schema change.
- **Risk:** medium — behavior parity bugs. Mitigate with the existing per-agent tests (they mock `createAgentImpl` and assert repair sequencing) + bench-with-llm before/after (§5 Phase 0).
- **Measure:** LOC delta (~-1 200 expected); no regression in per-slot accept rate (metrics from P1) or bench-with-llm pass rate.

### P3 — Kill cumulative repair transcripts + cap embedded sources

- **Problem:** F1 — token cost grows superlinearly per repair attempt for 4 slots; worst for anything (200 KB docs).
- **Change:** rebuild messages per attempt (mermaid pattern) — free with P2 (b/c). Independently: in `buildAnythingRepairInstruction` / fixer prompts, truncate `brokenSource` around the failing region when >30 KB (head + tail + error-line window), and pass the _user's prompt only_ as `originalRequest` (strip the embedded current-document block — the broken source is already in the prompt; the current doc adds nothing to a syntax repair).
- **Blast radius:** `apps/server/src/prompts/anythingSyntaxGuard.js`, `chartSyntaxGuard.js`, `metaphorSyntaxGuard.js`, `infographicSyntaxGuard.js` (builders only), agent call sites; prompt tests (`anythingPrompts.test.js`, `infographicSyntaxGuard.test.js`).
- **Risk:** low-medium: over-aggressive truncation could hide the error site — keep the window centered on the validator's reported line/element.
- **Measure:** tokens-per-repair-turn (from `model_call_end` usage events already emitted by `normalizeAgentStreamEvent`); repair success rate unchanged or better on bench-with-llm.

### P4 — Root-cause errors for metaphor3d

- **Problem:** F6 — the entire metaphor repair ladder runs blind.
- **Change:** `sanitizeMetaphorDsl` returns `{ dsl: null, error }` with formatted Zod issues (mirror `parseChartDsl`'s `path: message; …` format) and JSON.parse message; `validateAndPrepareMetaphorPatch` / `validateMetaphorStrict` surface it verbatim.
- **Blast radius:** `packages/shared/src/metaphorSanitizer.ts` (return-shape extension — additive, existing callers read `.dsl`/`.text`/`.applied`), `apps/server/src/tools/metaphorDslTool.js`, shared tests. `npm run check:fast` scope.
- **Risk:** low.
- **Measure:** metaphor fixer success rate (P1 metrics `validator: 'syntax-fixer'` share) before/after; add 3–4 broken-DSL cases to a new `benchMetaphor` (§5).
- Also fix `docs/guide/validation.md` if any wording drifts.

### P5 — Anything auto-fix fast path

- **Problem:** F3 — load-phase runtime errors pay a full agent run.
- **Change:** extend `routes/diagramRepair.js` to accept `contentType: 'mermaid' | 'anything'` (default mermaid — backward compatible) and route to `repairAnythingWithFixer`; client `runAutoFix` calls it for anything before falling back to intent. Store apply re-runs the full ladder including the runtime check, so no gate is bypassed.
- **Blast radius:** `apps/server/src/routes/diagramRepair.js` + `diagramRepairRoute.test.js`, `apps/web/src/state/diagramStore.js#submitDiagramRenderRepair`, `App.jsx#runAutoFix`, `docs/guide/agents.md`. HTTP body gains an optional field — additive, no consumer breaks.
- **Risk:** low. Note the endpoint's 20 KB `source` cap must rise for anything (use `ANYTHING_HTML_MAX_LENGTH`).
- **Measure:** auto-fix latency p50 (one fixer call ≈ 2–5 s vs full ladder 15–75 s); fraction of anything auto-fixes resolved without an agent turn.

### P6 — Cache agents + graph guardrails for chart/metaphor/anything

- **Problem:** F4 + F5.
- **Change:** use `createDiagramAgentCache` in the three agents; route their turns through `_lib/diagramAgentStreaming.js#runAgentTurn` (brings `getAgentRunnableConfig` + heartbeat + invoke fallback). Add `middleware: createDiagramAgentMiddleware(env)` uniformly. Free with P2(b); cheap standalone otherwise.
- **Blast radius:** 3 agent files + their tests.
- **Risk:** low — the tool cap (10) is generous; recursion limit rises 25→50 (more headroom, not less).
- **Measure:** cold-start per request removed (small); tool-churn runaway impossible by construction.

### P7 — Abort wiring for REST intent/transform/style

- **Problem:** F2 — abandoned REST runs burn budget to the deadline.
- **Change:** in `routes/copilot.ts` REST handlers, create an `AbortController`, abort on `req`/`res` `close` (same pattern as `/agent-stream`), pass `abortSignal` through `applyIntent`/`applyTransformIntent`/`applyStyleIntent` (the agent inputs already accept it — `diagramAgentService.ts`).
- **Blast radius:** `routes/copilot.ts`, `copilotRoute.test.js`. Note: Express fires `close` on normal completion too — abort only if the response hasn't been written (guard with `res.writableEnded`).
- **Risk:** low-medium (the `close`-vs-finished guard is the only subtlety).
- **Measure:** P1 metrics `errorClass: 'run-aborted'` appearing on REST paths; fewer orphaned full-budget runs in server logs.

### P8 — Analyze streaming parity (optional, UX)

- **Problem:** Critique/Explain for chart/metaphor/anything block until the full completion (no tokens; only route heartbeat keeps the client alive).
- **Change:** reuse the infographic pattern (`analysisModel.stream` + `emitTokens` + invoke fallback) in the three agents; share `emitTokens` via `_lib`.
- **Blast radius:** 3 agent files; no wire change (token events already supported for these slots).
- **Risk:** low.
- **Measure:** time-to-first-token for analyze on those slots.

### P9 — Doc corrections

Fix the table in §1.6 (configuration.md defaults; agents.md auto-fix row + render-error endpoint; validation.md metaphor wording after P4). Blast radius: docs only; run `npm run check:wire` (doc-paths).

### 4.8 Differences to KEEP (explicitly not duplication)

| Difference                                                                                                                                                                                                   | Why it stays                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Validation ladders differ per slot** (mermaid 4-layer w/ rich sanitizer; infographic 2-layer + light sanitizer; chart no sanitizer; anything no sanitizer + runtime check; metaphor JSON-rescue sanitizer) | Each matches its DSL's failure modes and error-message quality; chart's absent sanitizer and anything's absent HTML sanitizer are deliberate, documented decisions (CLAUDE.md, ADR-0008 territory). The orchestrator abstracts the _loop_, never the validators.                                                                                    |
| **Anything: `apply_anything_edit` + edit-preference prompts for Refine/Exec; runtime check on agent patches only; sandbox/CSP client-side**                                                                  | Core product safety/efficiency invariants (`AnythingRenderer.jsx`, ADR-0008). Orchestrator must support multiple patch tool names, not flatten them.                                                                                                                                                                                                |
| **Transform sampling: per-mode temperatures for mermaid/infographic; backend-default for chart/metaphor/anything**                                                                                           | Documented evidence in `mermaidAnalysisPrompts.js` (~line 25): high-temp Go Mad "mostly produced invalid Mermaid and malformed tool calls"; the prompt-driven slots "fail far less often". Revisit only with bench-with-llm data (an experiment worth running for Refine/Exec at ~0.4 on chart/anything — but as a measured change, not a cleanup). |
| **Transform constraint validators only for mermaid + infographic**                                                                                                                                           | They rely on cheap graph/tree metrics (`mermaidGraphMetrics`, `parseInfographicTree`) that have no chart/metaphor/anything equivalent; inventing DOM-size constraints for anything would be speculative.                                                                                                                                            |
| **Go Mad budget headroom (105/180 s) and depth ramp**                                                                                                                                                        | Encoded in shared budget resolution; client mirrors it.                                                                                                                                                                                                                                                                                             |
| **Infographic language lock + refine-prepass; mermaid syntax-guidance pre-injection + style pipeline + patch-summary artifact**                                                                              | Slot-specific accuracy features with test coverage; become adapter hooks, not deletions.                                                                                                                                                                                                                                                            |
| **Metaphor mutation prompts ignoring `focusNode`**                                                                                                                                                           | Currently a _gap_, not a decision (analyze supports focus; mutations don't). Keep out of the orchestrator refactor; file as separate feature work if 3D selection-scoped edits matter.                                                                                                                                                              |
| **Style persona limited to mermaid + chart**                                                                                                                                                                 | Route-enforced product boundary (`copilot.ts` `handleStyleIntent`).                                                                                                                                                                                                                                                                                 |

---

## 5. Prioritized roadmap

| Priority | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Effort                                                  | Impact                                                                                                                                       | Depends on                                    |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **P0**   | **Phase 0 measurement**: (a) per-slot `recordAgentTurn` (P1); (b) `benchInfographic.js` / `benchChart.js` / `benchMetaphor.js` cloning the `benchMermaid` pattern over each validator with 12–20 broken/valid cases; (c) design + land `benchWithLlm.js` — drives `dispatcher.applyIntent/applyTransformIntent` across {slot × persona × profile} on a fixed prompt corpus with real keys, records accept rate / repair depth / wall time / tokens (from `model_call_end` usage) into `bench-results/llm-<tag>.json`; add `--slot` / `--mode` filters and a small N (5–10 prompts per cell) to keep cost bounded | 2–4 d                                                   | Makes every later claim falsifiable; unblocks the Go Mad JSON-intermediate decision already gated on it (`docs/guide/validation.md` §future) | —                                             |
| **P1**   | Metaphor root-cause errors (P4) + doc fixes (P9)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 0.5–1 d                                                 | Direct repair-success gain for the blindest slot; docs stop lying                                                                            | —                                             |
| **P2**   | Anything auto-fix fast path (P5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 1 d                                                     | Auto-fix latency 15–75 s → 2–5 s for the common case                                                                                         | —                                             |
| **P3**   | Repair-prompt hygiene: non-cumulative transcripts + broken-source truncation (P3)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 1–2 d standalone (free with P5 below for the loop part) | Large token/latency cut on multi-repair anything/infographic runs                                                                            | Phase 0 (to verify no repair-rate regression) |
| **P4**   | REST abort wiring (P7)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 0.5 d                                                   | Stops paying for abandoned runs                                                                                                              | —                                             |
| **P5**   | Unified orchestrator, phased c→m→a, then infographic, then mermaid (P2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 4–7 d                                                   | −~1 200 LOC; metrics/guardrails/heartbeat/stable-retry become uniform; future fixes propagate once                                           | Phase 0 (parity evidence), P1                 |
| **P6**   | Agent cache + runnable config for chart/metaphor/anything (P6) — fold into P5(b) if sequenced together                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 0.5 d                                                   | Removes per-request construction + unbounded tool churn                                                                                      | —                                             |
| **P7**   | Fixer factory + state-store slot-handler factory (§3.3 tail)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 1–2 d                                                   | −~350 LOC, one place to improve fixer prompting                                                                                              | P5                                            |
| **P8**   | Analyze streaming parity (P8)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 1 d                                                     | UX: tokens for Critique/Explain on 3 slots                                                                                                   | —                                             |
| **P9**   | Measured experiments unlocked by Phase 0: low-temp Refine/Exec for chart/anything; runtime-check warm pool; Go Mad JSON intermediate (only if accept < ~90 %)                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 1–3 d each                                              | Data-driven accuracy/latency wins                                                                                                            | P0                                            |

---

## 6. Quick wins (≤1 week of agent time, concrete)

1. **QW-1 (½ d)** — `packages/shared/src/metaphorSanitizer.ts`: return `error` from the two `dsl: null` exits (`JSON.parse` catch ~line 596; `safeParse` failure ~line 630) formatted as `issue.path.join('.'): issue.message; …`; thread through `apps/server/src/tools/metaphorDslTool.js` (`validateAndPrepareMetaphorPatch` + `validateMetaphorStrict`). Extend `packages/shared/test` metaphor tests + `metaphorSyntaxFixer.test.js`. Run `npm run check:fast`.
2. **QW-2 (½ d)** — copy mermaid's `finishTurn`/`recordAgentTurn` block into the four other `invokeWithRepair`s with `mode` passed through as-is; while there, normalize intent-mode labels (`'go'` vs `'intent'` vs persona) to one vocabulary so dashboards aggregate. Files: 4 agents + `agentTurnMetrics.js` (`contentType` field) + `agentTurnMetrics.test.js`.
3. **QW-3 (1 d)** — `routes/diagramRepair.js`: add optional `contentType` (zod enum `['mermaid','anything']`, default `'mermaid'`), branch to `repairAnythingWithFixer`, raise the size cap per slot; client `submitDiagramRenderRepair` gains `contentType`; `App.jsx#runAutoFix` uses it for anything before the intent fallback. Tests: `diagramRepairRoute.test.js` (fake fixer seam already exists).
4. **QW-4 (½ d)** — REST abort: `routes/copilot.ts` `/intent`, `/transform`, `/style` create `AbortController`, abort on `res.on('close')` when `!res.writableEnded`, pass `abortSignal` into the agent-service calls. Test in `copilotRoute.test.js` with a destroyed response.
5. **QW-5 (½ d)** — Prompt-size hygiene without waiting for the orchestrator: in `anythingLangChainAgent.js` and `chartLangChainAgent.js`/`metaphorLangChainAgent.js`, replace `messages = [...messages, new SystemMessage(repair)]` with rebuilding `[...initialMessages, latestRepairInstruction]`, and pass only the _prompt_ portion as `originalRequest` (for anything intent, `prompt` is already available at the `applyIntent` call site — thread it into `invokeWithRepair` opts instead of re-extracting the whole first message).
6. **QW-6 (½ d)** — Delete the four local `extractTextContent` clones (import the `_lib/diagramAgentHelpers.js` re-export) and the four `extractOriginalRequest` copies (move one to `_lib`). Pure deletion, behavior identical.
7. **QW-7 (½ d)** — Doc fixes from §1.6: `docs/guide/configuration.md` (quality attempts 2; tool cap 10; add `CHART|METAPHOR|ANYTHING_REPAIR_MAX_ATTEMPTS` rows; note `MERMAID_AGENT_RUN_BUDGET_MS*` governs **all** slots), `docs/guide/agents.md` (auto-fix row: mermaid fast-path endpoint + anything runtime auto-fix), cross-link `routes/diagramRepair.js` from `docs/guide/validation.md`.
8. **QW-8 (1–2 d)** — `apps/server/scripts/benchInfographic.js` + `benchChart.js` + `benchMetaphor.js`: clone `benchMermaid.js` (validator-only, no LLM), 12–20 cases each including "must stay rejected" safety cases; wire the same non-zero-exit regression contract; commit baseline snapshots to `apps/server/bench-results/`.

(1–8 total ≈ 5 agent-days; each independently shippable and testable via `npm run check:affected`.)

---

## 7. Optional ADRs (titles only)

- **ADR-0009: Shared repair orchestrator with per-slot validator/prompt adapters** (supersedes the per-agent `invokeWithRepair` clones; records the SSE phase-id compatibility contract and the non-cumulative repair-transcript rule).
- **ADR-0010: Per-slot agent-turn telemetry as the acceptance gate for generation changes** (metrics schema, `contentType` field, bench-with-llm as CI-optional evidence).
- **ADR-0011: Repair-prompt content policy — bounded broken-source windows and prompt-only original-request** (token budget rules for repair/fixer prompts across slots).
- **ADR-0012: Client render/runtime-error fast-repair endpoint for multiple content types** (extends the mermaid-only `/api/diagram/render-error` contract).
- **ADR-0013: Transform sampling policy per content type** (codifies "prompt-driven chaos at default temperature" for chart/metaphor/anything vs tempered sampling for mermaid/infographic, with bench evidence attached).

---

## Out of scope (unchanged by this audit)

- Client UI redesign (canvas, insights pane, radial menu), new content types, and LLM provider/backend changes (`llmProvider.js` selection logic).
- The Anything sandbox/CSP model and the runtime check's on-by-default status for agent patches (any relaxation requires its own measured proposal per the mission constraint).
- MCP/external-agent collaboration surface (`/mcp`, session-events, proposals) — its `applyDiagramSource` entry points benefit from validator fixes automatically.
- Prompt _content_ tuning (personas' voice, design guides) beyond the structural hygiene in P3/QW-5.
