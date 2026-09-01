# CLAUDE.md — agent quick-reference for `archislop`

This file is for coding agents (Claude Code, Cursor, Copilot) opening a session in this repo. Humans should start at [`README.md`](README.md) and [`docs/guide/README.md`](docs/guide/README.md); operators at [`AGENTS.md`](AGENTS.md). For a concept→file index see [`STRUCTURE.md`](STRUCTURE.md); for terminology see [`GLOSSARY.md`](GLOSSARY.md); for common task templates see [`docs/recipes/`](docs/recipes/).

[`AGENTS.md`](AGENTS.md) is the operator manual (commands, CLIs, Cursor Cloud). This file is the domain quick-reference (slots, ladders, wire habits). They are complementary, not duplicates — but **durable operational tips** (don't-touch paths, regenerate commands, verify loops) must land in **both**. Cursor often starts from `AGENTS.md`; Claude Code often starts here. Writing a tip into only one file leaves the other agent blind.

> The product name is **archislop**. The directory and GitHub repo are still named `mermaid-gen` for legacy reasons. Treat `archislop` as canonical and don't rename anything unless asked.

## Repo layout in 10 lines

```
apps/web         React 19 + Vite UI (Monaco editor, Mermaid + AntV Infographic canvases)
apps/server      Express runtime: copilot routes, MCP server, LangChain agents
packages/shared  Zod schemas, sanitizers, AG-UI/A2UI event types — leaf of the dep graph
docs/            Architecture docs, ADRs (docs/decisions), recipes (docs/recipes), deploy
scripts/         Bash deploy + GCP secret push scripts
.github/         CI workflow + deploy workflow
.claude/         Local Claude Code config (settings.local.json) and skills
.cursor/         Cursor plans and skills
```

## The three architectural axes (don't conflate them)

| Axis                                      | Path                                 | Who uses it                                                             | Doc                                                                            |
| ----------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Built-in agents (REST + AG-UI SSE)**    | `/api/copilotkit/*`                  | Web UI Go/Gilfoyle/Dinesh/Erlich/Barker/Russ/Critique/Explain/Fix/Style | [`docs/architecture-ag-ui.md`](docs/architecture-ag-ui.md)                     |
| **Collaboration (session-events SSE)**    | `GET /api/copilotkit/session-events` | Handshakes, proposals, presence, reactions, attributed insights         | [`docs/architecture-external-agents.md`](docs/architecture-external-agents.md) |
| **External agents (MCP Streamable HTTP)** | `GET/POST /mcp`                      | Cursor, Claude Desktop, VS Code Copilot                                 | same                                                                           |

A **fourth** orthogonal layer is **MCP Apps** (interactive HTML at `ui://archislop/*.html`) opened by MCP tools — see [`docs/architecture-generative-ui.md`](docs/architecture-generative-ui.md) for the full Gen UI map.

## Multi-slot session state model

Every session carries **six independent diagram slots** — `mermaid` (Mermaid text), `infographic` (AntV DSL), `metaphor3d` (Zod-structured JSON for a Three.js scene), `chart` (archislop wrapper around a Vega-Lite spec), `anything` (freeform self-contained HTML/CSS/JS, rendered only inside a sandboxed iframe), and `forms` (model-authored A2UI v0.9 JSON rendered as live interactive forms) — plus an `activeContentType` pointer. Every HTTP request and SSE payload carries `contentType`, which the `DiagramAgentDispatcher` uses to route to the per-slot agent service. Switching modes does **not** mutate the other slot's revision history. `applyPatch` in `packages/shared` enforces that a patch's `contentType` matches the slot it targets.

**Forms is the one slot where the agent authors A2UI directly** (the slot content _is_ an A2UI document), unlike the critique checklist where the model writes Markdown and the server builds A2UI deterministically. Safety comes from `parseFormsA2ui` (shared): a `basicCatalog` allowlist, an action allowlist (every button collapses to "generate the next form"), and size caps. See [`docs/architecture-a2ui.md`](docs/architecture-a2ui.md) for the two-strategy split.

**Chart vs infographic.** Both can present chart-like visuals (infographic's AntV layouts include charts). The boundary: `chart` is for _data-driven exploration_ (the agent fabricates or transcribes `spec.data.values` and picks marks/encodings); `infographic` is for _narrative composition_ (titles, hero numbers, KPI tiles, multi-block storytelling). Route data-viz verbs (bar chart, scatter, trend, compare, aggregate) to `chart`; route narrative verbs (summary, infographic, KPI tile) to `infographic`. The `inferDiagramType` boundary is intentionally strict — when in doubt, prefer `infographic` for layout-first asks and `chart` for "show me the numbers" asks.

## Validation ladder

**Mermaid** (4 layers, in cost order):

1. Heuristic prefix check (instant) — `apps/server/src/tools/mermaidDiffTool.js`.
2. Deterministic sanitizer rescue (~1–10 ms) — `packages/shared/src/mermaidSanitizer.ts`. Composable fixers for quotes, header typos, init JSON, etc.
3. Single-shot syntax fixer (1 LLM call, low temp, fast model) — `apps/server/src/agents/mermaidSyntaxFixer.js` with rule packs in `apps/server/src/prompts/mermaidSyntaxGuard.js`.
4. Full-agent syntax-repair turns (bounded by `MERMAID_REPAIR_MAX_ATTEMPTS`).

**Infographic** (2 layers + repair): textual lint + `parseSyntax`, then single-shot fixer, then agent repair. See `apps/server/src/tools/infographicDslTool.js` and `packages/shared/src/infographicSanitizer.js`.

**Chart** (3 deterministic + 2 LLM gates, no sanitizer pack on day 1): JSON.parse → Zod wrapper (`parseChartDsl` in `packages/shared/src/chartSchema.ts`) → `vega-lite/compile()` (`apps/server/src/tools/chartDslTool.js`) → single-shot LLM fix (`apps/server/src/agents/chartSyntaxFixer.js`) → agent repair turns (bounded by `CHART_REPAIR_MAX_ATTEMPTS`). The sanitizer layer is intentionally absent — `vega-lite/compile()` produces precise error messages, so the deterministic-fix layer hasn't earned its keep yet; add a rule pack only when bench data shows a class of recurring failures.

**Anything** (shape + policy + quality lint + lib-marker lint + runtime check + fixer + agent repair, no sanitizer): `parseAnythingHtml` → `lintAnythingPolicy` → `lintAnythingQuality` → `lintAnythingLibMarkers` in `packages/shared` → `runAnythingRuntimeCheck` (`apps/server/src/tools/anythingRuntimeCheck.js` — executes page JS in an isolated jsdom child process emulating the iframe sandbox; rejects uncaught errors, hangs, and blank renders; agent patches only, client sync skips it; kill switch `ANYTHING_RUNTIME_CHECK=0`) → single-shot `anythingSyntaxFixer.js` → agent repair turns (bounded by `ANYTHING_REPAIR_MAX_ATTEMPTS`). Mutations arrive via `apply_anything_patch` (full rewrite) or `apply_anything_edit` (atomic aider-style search/replace in `apps/server/src/agents/_lib/searchReplaceEdits.js`, preferred for Refine/Barker/Fix) — both run the identical ladder; edits never bypass a gate. There is deliberately no HTML sanitizer — safety comes from the client rendering the slot in an `allow-scripts`-only sandboxed iframe with CSP (`AnythingRenderer.jsx`; never add `allow-same-origin`). On the client, `wrapAnythingSrcDoc` injects a post-validation runtime-error bridge (postMessage) so `AnythingRenderer` can surface in-iframe errors and feed load-phase failures into the auto-fix flow. Prompt side: sandbox/validity rules are `ANYTHING_CORE_RULES` (`anythingSystemPrompt.js`); design craft rules live in `apps/server/src/prompts/anythingDesignGuide.js`. Inline libraries (ADR-0008): documents opt into allowlisted vendored libs (currently `d3`, `matter`) via `<!-- @lib:d3 -->` markers — the slot stores the marker form; `expandAnythingLibs` (`@archislop/shared/anythingLibVendor.js` subpath export; registry in `packages/shared/src/anythingLibs.ts`; bytes regenerated with `npm run vendor:anything-libs -w packages/shared`) splices the pinned source in only where the page executes (client renderer's lazy chunk + the jsdom runtime check), so injected bytes are exempt from `ANYTHING_HTML_MAX_LENGTH` and the policy lint never sees library comments. Offline bench: `node apps/server/scripts/benchAnything.js --tag <label>`.

**The Anything runtime rung runs in a real browser now, and it does not _emulate_ the client sandbox — it reproduces it.** `anythingRuntimeBrowser.js` builds the actual `<iframe sandbox="allow-scripts" srcdoc={wrapAnythingSrcDoc(html)}>` from the same shared constants `AnythingRenderer.jsx` uses, so `localStorage`/`document.cookie` throw `SecurityError` on the opaque origin for real, `fetch` is refused by the injected CSP, and errors arrive over the bridge the wrapper already injects. Measured on the 28-fixture corpus through the full ladder: **p50 139 ms vs jsdom's 1,009 ms, identical verdicts**. Three things are load-bearing. `ANYTHING_RUNTIME_ENGINE=jsdom` is a one-variable rollback and `auto` falls back when no binary resolves, so a contributor without Chromium still has a working gate — and **both engines are held to the same suite** (`anythingRuntimeCheck.test.js` runs unchanged against either; that identity is the only thing stopping them drifting). The probe must be injected into **`<head>`, never the end of `<body>`**: its console capture has to install before page scripts, and an element added to `<body>` would defeat the `blank_render` check that same rung depends on. And **visual findings warn, they do not reject** unless `ANYTHING_RUNTIME_VISUAL_REJECT=1`, and then only on hard ones — `low_contrast` is permanently a warning because 32 of 35 accepted pages carry one and each rejection costs a 12–60 s repair turn. **The fallback keeps its own clock** (`ANYTHING_RUNTIME_FALLBACK_TIMEOUT_MS`, default `max(browser budget, 6000 ms)`): the engines are a pair precisely because their startup costs differ, so handing jsdom the browser's budget made a tightened clock starve the spawn, and the fallback then reported `runtime_timeout` — a **page rejection** — for its own startup. It was filed as a flaky test (issue #347); the tell is `code:"runtime_timeout"` alongside a `warnings` entry saying the browser already skipped, and the general lesson is that **a test failing in isolation is not a flake**.

**A rejection code names the rung that fired, not the cause — check what the model actually wrote.** `external_url` was the largest code in the browser baseline and was assumed to be the model reaching for a font or CDN. It was not: `lintAnythingPolicy` stripped the SVG namespace in its `xmlns=` **attribute** form but not in a **string literal**, so `var ns = "http://www.w3.org/2000/svg"` — `createElementNS`, the only way to build SVG from script — was rejected as a network load while the identical URI in markup passed. The repair error then told a page that had drawn its own SVG to inline its assets. Two lessons: the fix was in the lint, and tightening the prompt (the standing plan) would have pushed the model off the correct API; and the probe that found it just replayed corpus prompts and printed the offending line, because the bench report records codes and sizes but **not the document**. The namespace exemption is five exact URIs with a trailing boundary — never a `w3.org` prefix, or a lookalike host rides in behind it.

**The two anything benches measure different things, and one of their headline numbers is a trap.** `benchAnything.js` replays 25 hand-written documents through the validator — it measures the **gate**, and its `acceptRate` is a property of the corpus (how many fixtures are _meant_ to pass), **not** a quality signal; read `expectationMatch`. `benchAnythingGeneration.js` sends real prompts through the real agent — it measures the **model**, spends tokens, and is not in `npm test`. **Always run it with `--samples 3` or more**: two consecutive single-sample runs of the same 12 cases measured 66.7% and 91.7% first-pass accept, a 25-point swing from nondeterminism alone, so a one-sample run is a smoke test rather than a measurement. Read the accept rate beside `failureKinds` — a `transport` entry is a model call cut off mid-stream, which depresses the rate exactly like a page the model could not fix. It needs **both** `--import ./scripts/register-antv-layout-esm.mjs --import tsx`: the agent's import graph reaches TypeScript leaves behind `.js` specifiers _and_ transitively reaches `@antv/infographic`, and each missing flag fails with a different unhelpful module error. Two design points worth keeping: it hand-rolls a tiny anything-only store rather than using `createDiagramStateStore`, because the rejection **`code` is stripped on the wire** (`ToolApplyResultSchema`'s rejected branch is a non-passthrough `z.object({accepted, error})`), so the validator's own return value is the only place a per-rung histogram can come from without touching production; and `--browser` (`anythingBrowserProbe.js`) is an **observer, not a rung** — it renders accepted pages in real Chromium to count what jsdom cannot see (blank canvases, collapsed layout, sub-4.5:1 contrast) and changes no verdict, because the decision it informs is whether a browser rung would reject _more_, and each extra rejection costs a 12–60 s repair turn.

**Forms** (1 deterministic gate + syntax fixer ladder + agent repair, no sanitizer): the slot content is **model-authored** A2UI v0.9 JSON. `parseFormsA2ui` (`packages/shared/src/formsA2ui.ts`) is the whole trust boundary — `JSON.parse` → wrapper shape → `basicCatalog` component allowlist → action allowlist (Button actions must be `{event:{name}}`, never `functionCall`; all names collapse to one client capability, "generate the next form"; no `checks` on a Button, since a failing check disables the only escape hatch) → `surfaceId`/`catalogId` normalization → size/component/message caps + "≥1 input, ≥1 Button". Forms lean on A2UI's pure/local client functions to make fields cross-reference each other live (`formatString` `${/path}` echoes in `Text`; `checks` on inputs that watch other fields) and to visualize the subject (emoji stamps + a hero-stat `Card`; the named `Icon` component is avoided — no Material icon font ships, so it renders as raw text); the Thinking pane renders the slot read-only via `InsightsEmbeddedDiagram`'s `forms` branch (`FormsRenderer` `preview` prop). Server gate: `validateAndPrepareFormsPatch` (`apps/server/src/tools/formsA2uiTool.js`) — no A2UI runtime on the server (that would pull `@a2ui/web_core` into the backend); the client's `MessageProcessor` in `FormsRenderer.jsx` is the render-time check. Mutations arrive via `apply_forms_patch`; on allowlist failure the **syntax fixer ladder** (`formsSyntaxFixer.js`, lite → flash → DeepSeek) runs before full-agent repair turns (bounded by `FORMS_REPAIR_MAX_ATTEMPTS`). This is the deliberate opposite of the critique checklist (server-built A2UI from Markdown) — see [`docs/architecture-a2ui.md`](docs/architecture-a2ui.md).

## Canonical commands

| Goal                                   | Command                                                                                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run web + server together              | `npm run dev`                                                                                                                                                              |
| Run all tests                          | `npm test`                                                                                                                                                                 |
| **Diff-scoped tests (agents)**         | `npm run test:affected` (basename + blast-radius map; skips slow Anything unless diff touches `anything*`)                                                                 |
| **Verify (diff-scoped, agents)**       | `npm run check:affected` (includes Prettier on changed files)                                                                                                              |
| **Verify a change end-to-end**         | `npm run check` (typecheck + typecheck:strict + lint + test + wire)                                                                                                        |
| Shared-only / schema touch             | `npm run check:fast`                                                                                                                                                       |
| Before PR / local CI parity            | `npm run check:full` (`check` + build); GitHub CI parallels the same coverage                                                                                              |
| Wire + doc paths only                  | `npm run check:wire`                                                                                                                                                       |
| Blast-radius map                       | [`docs/agent-blast-radius.md`](docs/agent-blast-radius.md)                                                                                                                 |
| Format the diff you're about to commit | `npm run format:affected` (agents); `npm run format` for whole repo                                                                                                        |
| Build all workspaces                   | `npm run build`                                                                                                                                                            |
| Health probe                           | `curl http://localhost:\$PORT/api/health`                                                                                                                                  |
| Mermaid offline bench                  | `node --import ./scripts/register-antv-layout-esm.mjs --import tsx apps/server/scripts/benchMermaid.js --tag <label>` (both flags required — see `benchMermaid.js` header) |
| Anything offline bench (no LLM)        | `node apps/server/scripts/benchAnything.js --tag <label>`                                                                                                                  |
| Anything **generation** bench (tokens) | `node --import ./scripts/register-antv-layout-esm.mjs --import tsx apps/server/scripts/benchAnythingGeneration.js --tag <label> [--browser]`                               |
| Regenerate **one** baked audio asset   | `./scripts/generate-office-audio.sh <name>` — bare = whole manifest, 900 credits, overwrites everything                                                                    |
| Check the committed audio bank         | `./scripts/generate-office-audio.sh --verify` (free, no key, no network)                                                                                                   |
| Quality trend (gates nothing)          | `npm run verify:ratchet`; add `-- --json` or `-- --with-lint`                                                                                                              |
| Routine budget check                   | `npm run routine:guard -- --postflight <name>`                                                                                                                             |
| Which routine may write a path         | `npm run routine:guard -- --reachable <path>` (prints owner / `frozen` / `NONE` + exit 1)                                                                                  |

`npm run check` includes `verify:deps` (override/singleton npm pins), `format:check`, `lint` for all three workspaces, and the rest of the sensor stack, plus `typecheck:strict` — full-strict typechecking of the files listed in each app's `tsconfig.strict.json` (the ADR-0006 "strict islands"; add a `.ts`/`.tsx` path there to opt it into strict, and a regression fails CI). Lint messages go through a custom formatter (`packages/eslint-config/formatter.cjs`) that appends a per-rule "Agent guidance" footer with the canonical fix and suppression syntax — read it before suppressing. `@typescript-eslint`'s `recommended` rules now fire as warnings on every `.ts`/`.tsx` file, so converting `.js`→`.ts` ([recipe](docs/recipes/convert-js-leaf-to-ts.md)) gains both Factory and ts-eslint guidance. Thresholds (`max-lines`, `complexity`, …) ship as warnings; ADR-0005 monoliths are pre-suppressed in `packages/eslint-config/legacy-monoliths.js`. A `.husky/pre-commit` hook runs `lint-staged` (Prettier on staged files). `.husky/pre-push` runs `npm run check:affected`. Architecture rules now live in `.dependency-cruiser.cjs` (replaces the older regex-based boundary script); each rule's `comment` field is the agent-readable fix. See [`docs/agents/sensors.md`](docs/agents/sensors.md) for the full sensor map.

## Don't-touch list

- `.agents/` — generated CopilotKit skill files, git-ignored. Refresh with `npm run setup:skills`.
- `.env`, `.env.*` — never commit; ask the user if they need a new variable.
- `scripts/deploy-*.sh` and `scripts/push-*-secret-cloud-run.sh` — production deploy / Secret Manager scripts. Don't run unless asked.
- `apps/server/src/mcp/apps/*.js` (HTML strings) — these are paired with `session-events` bridges; if you change the HTML, also update the matching event handler and re-run the App's smoke flow.
- `apps/server/bench-results/` — bench snapshots; don't hand-edit, regenerate via the bench script.
- `apps/web/src/assets/audio/*.mp3` — baked ElevenLabs assets; don't hand-edit, regenerate via `./scripts/generate-office-audio.sh` (build-time only — never wire ElevenLabs into a route, CI, or a deploy script). See [`docs/audio-assets.md`](docs/audio-assets.md).
- `package-lock.json`, `skills-lock.json` — never hand-edit.

## Office layer gotchas

**Moved.** The ~55 findings for this domain now live in one file, read by every agent:

**[`docs/agents/domains/office.md`](docs/agents/domains/office.md)**

Claude Code auto-loads it through nested `CLAUDE.md` files in
`apps/web/src/components/officeFloor/` and `apps/web/src/state/`; Cursor gets it through the
glob-scoped `.cursor/rules/office.mdc`; anything else reads it from the index in
[`AGENTS.md`](AGENTS.md).

The two rules everything else follows from, kept here because they shape decisions outside the
office too:

- **Ambient vs reactive** (`docs/office-parody.md` § 11). A timer interrupted you → canned-heavy.
  You started it or answered it → lean LLM. The whole appetite table is `officeCadence.js`.
- **Record, never trigger** (ADR-0010 consequence #4). The office log, working memory and the
  errand all _record_. The moment one of them schedules or fires something, it is
  auto-fix-on-idle in a new hat.

**Add findings there, once.** Do not mirror them back here.

## Metaphor3D scene gotchas

**Moved.** The ~50 findings for this domain now live in one file, read by every agent:

**[`docs/agents/domains/metaphor3d.md`](docs/agents/domains/metaphor3d.md)**

Claude Code auto-loads it through nested `CLAUDE.md` files in
`apps/web/src/components/metaphorScenes/` and `apps/web/src/utils/metaphorLayouts/`; Cursor gets it
through the glob-scoped `.cursor/rules/metaphor3d.mdc`; anything else reads it from the index in
[`AGENTS.md`](AGENTS.md). Read its **Short form** before touching a scene, layout, or the metaphor
ladder.

It was 54 KB here and another 27 KB in `AGENTS.md`, both loaded in full by every session in this
repo — about 20 k tokens before any work started, whether or not the work went near a 3D scene, and
growing every night. Scoping it costs a session that _does_ touch metaphor code nothing and saves
every session that does not.

**Add findings there, once.** Do not mirror them back here.

## File-size budgets (work in progress)

Files above ~800 LOC are slated for splits per [ADR-0005](docs/decisions/0005-monolith-splits.md). If you need to make a change in one of these, prefer extracting the slice you touch into a sibling module rather than growing the monolith:

- `apps/web/src/ArchiSlop.jsx` (~1036 LOC; entry split to `App.jsx` + feature hooks under `hooks/`, `features/insights/*`, `features/streaming/*`, `features/canvas/*`, `features/session/*`, `features/prompt/*`, `features/shell/*`, `features/ceremony/*`, `features/advisor/*`, `features/desk/*`, `components/buildRadialActions` — see [`docs/decisions/0005-monolith-splits.md`](docs/decisions/0005-monolith-splits.md)), `apps/server/src/mcp/mcpServer.js` (~1406; helpers + first `tools/register*` modules extracted — continue per-tool splits), `apps/server/src/agents/mermaidLangChainAgent.js` (~1156), `apps/web/src/components/InsightsPane.jsx` (~1835), `apps/web/src/components/DiagramCanvas.jsx` (~1889; hit-test/connect-source resolvers for flowchart, sequence, infographic and mindmap graph-edit families extracted to `apps/web/src/utils/diagramGraphEditNodeResolve.js` — closes [issue #363](https://github.com/acuhlmann/mermaid-gen/issues/363)), `apps/web/src/components/RadialActionMenu.jsx` (~1164), `apps/server/src/agents/infographicLangChainAgent.js` (~846), `apps/server/src/routes/copilot.ts` (~1194; the user-edit route handler extracted to `apps/server/src/routes/copilotUserEdit.ts` — closes [issue #381](https://github.com/acuhlmann/mermaid-gen/issues/381)), `apps/web/src/state/diagramStore.js` (~945). Future per-tool splits in `mcpServer.js` should follow the same pattern: extract closure helpers into a sibling module and add a `register{ToolName}(server, ctx)` file under `apps/server/src/mcp/tools/`.

## When you touch wire contracts

If you change an HTTP route, AG-UI event, MCP tool, or schema, update **all four** of:

1. The producing code (route / agent / tool).
2. The consumer (web client store, MCP client, or App HTML bridge).
3. The Zod schema in `packages/shared/src/diagramSchema.ts` if shape changes.
4. The corresponding guide under [`docs/guide/`](docs/guide/) or the relevant `docs/architecture-*.md` (hub: [`README.md`](README.md)).

See [`docs/recipes/`](docs/recipes/) for templates of recurring changes (new MCP tool, new rule pack, new intent variant, new stream event, new canvas graph-edit family).

## LLM backend resolution

Three backends: **DeepSeek**, **OpenRouter**, **Vertex** (Gemini). Selection is in `apps/server/src/agents/llmProvider.js` via `LLM_PROVIDER` (`auto` default). Local `auto` prefers DeepSeek if `DEEPSEEK_API_KEY` is set (Brain Fast=flash, Quality=pro), else OpenRouter, else Vertex ADC. When Vertex is also configured, office/advisor stay on Vertex flash-lite. Cloud Run `auto` prefers DeepSeek when the secret is attached, else Vertex. The web client only ever sends `modelProfile: "fast" | "quality"`; the server resolves slugs. Full table: [`docs/llm-config.md`](docs/llm-config.md).

## Where to put new code

| You're adding…                   | Put it in…                                                              |
| -------------------------------- | ----------------------------------------------------------------------- |
| A shared Zod schema or type      | `packages/shared/src/` (leaf — no server/web imports)                   |
| A pure utility used by both apps | `packages/shared/src/`                                                  |
| A new HTTP route                 | `apps/server/src/routes/`                                               |
| A new MCP tool                   | `apps/server/src/mcp/` (and `apps/server/src/mcp/apps/` if it needs UI) |
| A new LangChain agent / tool     | `apps/server/src/agents/`                                               |
| New diagram-type rule pack       | `apps/server/src/prompts/`                                              |
| A new React component            | `apps/web/src/components/`                                              |
| A new web utility                | `apps/web/src/utils/`                                                   |
| A new web state slice            | `apps/web/src/state/`                                                   |
| A baked audio asset              | `apps/web/src/assets/audio/` via `scripts/generate-office-audio.sh`     |
| A new React hook                 | `apps/web/src/hooks/`                                                   |

## Scheduled NFR routines

Non-functional work — post-merge review, doc drift, test hardening, dependency upkeep — runs on a
schedule as **NFR routines** ([ADR-0014](docs/decisions/0014-autonomous-nfr-routines.md),
[ADR-0017](docs/decisions/0017-routine-ownership-dependabot-and-the-attention-bar.md)). Five ship
today — `review`, `improve`, `resolve`, `deps`, `digest`:

- **The playbook is the repo file, not the cron prompt.** `docs/routines/<name>.md` holds what the
  routine does and its budget; the trigger prompt is three lines pointing at it. Pasting
  instructions into a trigger recreates the unversioned, unreviewable blob this shelf replaced.
- **The budget is enforced, not described.** `npm run routine:guard -- --postflight <name>` re-reads
  the playbook's `maxFiles` / `allowedPaths` / `forbiddenPaths` and checks the real diff, plus an
  always-forbidden list mirroring the don't-touch list, deleted test files, and any test file whose
  case count fell.
- **Only `improve` may change a budget, and the guard is outside everyone's reach** (ADR-0017). A
  routine that needs a wider path list or more files writes `blocked-by-budget` / `blocked-by-paths`
  in its own ledger; `improve` § 2b reads those rows and raises the number in its own PR.
  `routine-guard` refuses any other routine's diff to a playbook, a shelf README, or another
  routine's ledger, and `scripts/routine-guard.mjs` is always-forbidden — the referee cannot be
  edited by a player (#461).
- **Nothing on either shelf may label an issue `ready-for-human`; only four things reach the owner.**
  Money, credentials or permissions, irreversible destruction, the product's direction
  (`docs/routines/README.md` rule 10). Everything else is decided, done, and logged. `resolve`
  re-gathers any `ready-for-human` older than three days, because that label has no reader: #402
  waited a week on `maxFiles: 6` needing nine files.
- **`ready-for-agent` promises a file is reachable.** `npm run routine:guard -- --reachable <path>`
  prints the owning routine, `frozen`, or `NONE` + exit 1. Run it before you label: #461, #462 and
  #473 were scoped, labelled, and stuck behind a `scripts/` path no budget could reach.
- **`npm run verify:ratchet` gates nothing — it is the `improve` routine's work queue.** Monolith
  LOC and lint warnings should only fall; strict-island and suite counts should only rise. Budgets
  live in `docs/agents/ratchet.json`. It is deliberately **out** of `npm run check`: two unattended
  feature automations run daily here, and a quality metric that reddens their build at an hour
  nobody is watching teaches an agent to raise the budget instead of fixing the code. Run it
  yourself when you want the numbers (`--json` for machine-readable, `--with-lint` for the ESLint
  pass); when a budget genuinely has to rise, raise it with a written `reason`.
- **As of ADR-0016, `improve` acts on coupling and lint findings instead of only reporting them.**
  It may split a monolith itself when the fix matches an extraction pattern already used elsewhere
  in the file (self-merged, one slice per run — see `docs/routines/improve.md` § 7), and may promote
  a lint rule from `warn` to `error` itself once a mechanical grep shows ADR-0007's two-week quiet
  period held (§ 8). Neither needs a human decision anymore; both still go through the same
  budget/green-CI/escalation rules as every other routine change. ADR-0010 (no slot content) and "no
  new dependencies" are unchanged.

Ledgers under `docs/routines/ledger/` are the durable memory across cold-start runs — read one
before starting, append a row when finishing, including runs that changed nothing.

More facts, added 2026-08-30 and 2026-09-01:

- **There is a night ladder, and it is a dependency order.** Seven jobs run between `0 15` and
  `0 23` UTC (23:00–07:00 in the owner's GMT+8), so the whole fleet finishes while nobody is
  watching and a digest is waiting at 07:00. Feature automations produce code, `review` reads what
  landed, `improve` works the quality queue, `resolve` works the backlog the first two just filed,
  `digest` reports. The table — with the host running each rung — is in
  [`docs/routines/review.md`](docs/routines/review.md). Until 2026-08-30 the live crons ran
  `improve` → `review` → `resolve` with `review` firing _during_ `improve`'s run, and every
  playbook's declared `schedule` disagreed with its actual cron. `deps` (`30 4,16 * * *`) is off the
  ladder on purpose — advisories arrive in bursts and a short queue read should not queue behind an
  hour-long review.
- **The fleet is split across hosts by duty, since 2026-09-01.** `resolve` runs as a Cursor
  automation; everything else on the ladder is a Claude Routine. The routines that _find_ work and
  the one that _pays_ for it are no longer one account's two failures — when `anything` went dark for
  four nights in late August, every job that could have noticed was on the same host. **Claude
  routines are scriptable, Cursor automations are not**: `claude -p '/schedule …'` creates, lists,
  updates and fires a cron routine (it cannot delete one, cannot make API triggers/tokens, and needs a
  claude.ai subscription login); Cursor's `agent` CLI has no `automations` verb, so a Cursor rung and
  any retirement are the owner's web-UI actions (page bar #2).
- **One fleet per 24-hour window.** Cursor's unregistered `critical-bug-memory` automation and
  `review` found the same `renameErNode` bug on 2026-08-29 and each shipped a PR (#442 closed
  unmerged, redundant with #446). Any automation that can write product code needs a row in
  `docs/routines/README.md` or `docs/automations/README.md`; `digest` watchdog 7 reports branches
  matching no registered `prTitlePrefix`.
- **`--preflight` now really does refuse to start behind an open PR.** README rule 5,
  `docs/automations/README.md` § 4 and ADR-0014 clause 3 promised that from day one and nothing
  implemented it. In the gap, PR #442 sat open for two days holding a `review` ledger row hostage,
  the next firing started a second branch behind it, and that run then reasoned _from preflight's
  silence_ that the previous night had never fired. It matches on the PR **title** prefix, because
  branch names (`claude/eager-hopper-74jcfu`) are generated by the cloud runner and say nothing
  about who opened a PR. When `gh` is unreachable it **warns and continues** rather than reporting
  "no open PR" — an absent answer and an empty answer mean opposite things.
- **`tier: report` is enforced.** Such a playbook declares no `maxFiles` and no `allowedPaths`, and
  postflight fails on a non-empty diff. [`digest`](docs/routines/digest.md) is the first one: its
  entire output is one comment on the standing issue #452, and it is also the **watchdog** — a job
  that did not run, a PR left open overnight, a red `main`, a live cron that has drifted from its
  playbook. ADR-0014 named "a run log that stops" as the tell for the whole shelf failing quietly,
  and until this date nothing looked: the `anything` automation went dark on 2026-08-28 and it took
  a human reading a ledger four days later to notice.

## Scheduled feature automations

Slot-quality work — validation gates, prompts, benches, renderer fixes for one diagram mode — runs
on a separate shelf: [`docs/automations/`](docs/automations/README.md). Same three-piece contract
(playbook + ledger + cron trigger), same `npm run routine:guard` budget enforcement, but these
**do** touch product code (and never write slot content — ADR-0010 still applies).

| Playbook                                                     | UTC           | What it improves                                      |
| ------------------------------------------------------------ | ------------- | ----------------------------------------------------- |
| [`metaphor3d`](docs/automations/metaphor3d.md)               | `0 15 * * *`  | The 3D slot: ladder, layouts, scenes, composite, USDA |
| [`anything`](docs/automations/anything.md)                   | `15 17 * * *` | The Anything slot: policy lint, runtime rung, prompts |
| [`canvas-graph-edit`](docs/automations/canvas-graph-edit.md) | `30 18 * * *` | Direct manipulation on the canvas, all 28 families    |

`metaphor3d` and `canvas-graph-edit` got playbooks on 2026-08-30; before that they were exactly the
prompt-in-a-cron-blob shape ADR-0014 exists to replace, and `metaphor3d` — the most productive job
on either shelf — had no ledger, so twelve nights of findings went straight into the root context
files instead. Two rules those playbooks carry that generalise:

- **A visual change is verified by rendering it, and the PR carries the evidence.** For
  `metaphor3d` that is `apps/web/.claude/skills/verify/SKILL.md`, the viewports captured, and the
  before/after numbers. It is a prose rule checked by `review`'s Spec axis the next night rather
  than a path ban, because banning the `.jsx` scene files would be mechanically enforceable and
  would also delete the capability.
- **`DiagramCanvas.jsx` is out of `canvas-graph-edit`'s `allowedPaths` on purpose.** It sits on the
  ratchet at 1889 lines; a new family extends `diagramGraphEditNodeResolve.js`, it does not grow
  the canvas component.

When you learn something durable from a feature-automation run, put it in the domain file for that
area — see `docs/routines/README.md` rule 8; it is no longer "both root files, always".

## Agent skills

### Issue tracker

Issues live on GitHub (**acuhlmann/mermaid-gen**); use `gh` for create/list/comment/label. See [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).

### Triage labels

Five canonical triage roles map 1:1 to GitHub label names (`needs-triage`, `needs-info`,
`ready-for-agent`, `ready-for-human`, `wontfix`). See
[`docs/agents/triage-labels.md`](docs/agents/triage-labels.md) — since ADR-0017 `ready-for-agent`
carries a reachability promise the guard can check (`--reachable`), and `ready-for-human` is reserved
for the four page-bar conditions in `docs/routines/README.md` rule 10. No routine may apply it, and an
issue parked there for three days is re-triaged by `resolve` on the assumption that an agent flinched.

### Domain docs

Single-context monorepo: read `GLOSSARY.md`, `STRUCTURE.md`, and ADRs under `docs/decisions/` (optional `CONTEXT.md` when present). See [`docs/agents/domain.md`](docs/agents/domain.md).

### Sensors (lint, dep-cruiser, formatter footer)

Every static check hands you the canonical fix in its output. ESLint warnings carry an "Agent guidance" footer; dependency-cruiser rules carry it in the `comment` field. Suppress with `// eslint-disable-next-line <rule> -- (reason: ...)`. See [`docs/agents/sensors.md`](docs/agents/sensors.md) and ADR-0007.

**A `vi.mock` path that resolves nowhere fails silently** — vitest does not raise, the real module runs, and the suite passes for the wrong reason. `apps/web/test/viMockPathsResolve.test.js` is the sensor; it prints the offending `file:line -> specifier`. Two things to know before you "fix" one. **Check what the mock was doing first**: one that has never executed is not load-bearing, so deleting it is a zero-behaviour-change edit while repairing it is a real change — in `useOfficeRunReactions.test.js` the suite had come to depend on the unmocked modules, and making the mocks live would have stubbed out the request its tests assert on. And **a `.js` specifier pointing at a `.ts` file is not an instance of this** — that is the ordinary TypeScript convention Vite resolves, so any checker for the class must map `.js` → `.ts`/`.tsx` or it flags every leaf converted by [`convert-js-leaf-to-ts.md`](docs/recipes/convert-js-leaf-to-ts.md).

**In a hook test, `rerender(...)` and `advanceTimersByTimeAsync(...)` belong in two separate `act` blocks.** The effect that schedules a timer flushes when the act scope closes, so advancing the clock in the same block advances it _before_ the timer exists and the callback never fires — measured in `useOfficeRunReactions.test.js`: one block leaves `fetch` on zero calls, two land exactly one. A test written the one-block way passes while exercising nothing, which is why "does not throw" is a dangerous shape for an async assertion.

### Modularity reviews

For semantic coupling analysis (not automatable), run `/modularity:review` in Claude Code (install once: `/plugin marketplace add vladikk/modularity`). Cursor reads the mirrored skill under `.cursor/skills/modularity/`. See [`docs/agents/modularity.md`](docs/agents/modularity.md).

## Pointers

- **Domain gotchas (scoped):** [`docs/agents/domains/metaphor3d.md`](docs/agents/domains/metaphor3d.md),
  [`docs/agents/domains/office.md`](docs/agents/domains/office.md) — auto-loaded by nested `CLAUDE.md`
  files in the directories they describe. Full index in [`AGENTS.md`](AGENTS.md) § Domain gotchas.
- Architecture maps: [`docs/guide/system-overview.md`](docs/guide/system-overview.md), [`docs/architecture-generative-ui.md`](docs/architecture-generative-ui.md)
- Operator manual: [`AGENTS.md`](AGENTS.md)
- Concept→file index: [`STRUCTURE.md`](STRUCTURE.md)
- Terms: [`GLOSSARY.md`](GLOSSARY.md)
- Recurring tasks: [`docs/recipes/`](docs/recipes/)
- Canvas graph-edit families: [`docs/canvas-graph-edit.md`](docs/canvas-graph-edit.md)
- Past decisions: [`docs/decisions/`](docs/decisions/)
- Office continuity (working memory + runWalk, v1 shipped): [`docs/office-continuity.md`](docs/office-continuity.md)
- LLM config: [`docs/llm-config.md`](docs/llm-config.md)
- Deploy: [`docs/deploy/gcp.md`](docs/deploy/gcp.md) — Artifact Registry retention: `npm run ar:cleanup:verify` (policy in `scripts/artifact-registry-cleanup-policy.json`; apply with `npm run ar:cleanup:apply`)
