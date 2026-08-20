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

**The two anything benches measure different things, and one of their headline numbers is a trap.** `benchAnything.js` replays 23 hand-written documents through the validator — it measures the **gate**, and its `acceptRate` is a property of the corpus (how many fixtures are _meant_ to pass), **not** a quality signal; read `expectationMatch`. `benchAnythingGeneration.js` sends real prompts through the real agent — it measures the **model**, spends tokens, and is not in `npm test`. **Always run it with `--samples 3` or more**: two consecutive single-sample runs of the same 12 cases measured 66.7% and 91.7% first-pass accept, a 25-point swing from nondeterminism alone, so a one-sample run is a smoke test rather than a measurement. Read the accept rate beside `failureKinds` — a `transport` entry is a model call cut off mid-stream, which depresses the rate exactly like a page the model could not fix. It needs **both** `--import ./scripts/register-antv-layout-esm.mjs --import tsx`: the agent's import graph reaches TypeScript leaves behind `.js` specifiers _and_ transitively reaches `@antv/infographic`, and each missing flag fails with a different unhelpful module error. Two design points worth keeping: it hand-rolls a tiny anything-only store rather than using `createDiagramStateStore`, because the rejection **`code` is stripped on the wire** (`ToolApplyResultSchema`'s rejected branch is a non-passthrough `z.object({accepted, error})`), so the validator's own return value is the only place a per-rung histogram can come from without touching production; and `--browser` (`anythingBrowserProbe.js`) is an **observer, not a rung** — it renders accepted pages in real Chromium to count what jsdom cannot see (blank canvases, collapsed layout, sub-4.5:1 contrast) and changes no verdict, because the decision it informs is whether a browser rung would reject _more_, and each extra rejection costs a 12–60 s repair turn.

**Forms** (1 deterministic gate + syntax fixer ladder + agent repair, no sanitizer): the slot content is **model-authored** A2UI v0.9 JSON. `parseFormsA2ui` (`packages/shared/src/formsA2ui.ts`) is the whole trust boundary — `JSON.parse` → wrapper shape → `basicCatalog` component allowlist → action allowlist (Button actions must be `{event:{name}}`, never `functionCall`; all names collapse to one client capability, "generate the next form"; no `checks` on a Button, since a failing check disables the only escape hatch) → `surfaceId`/`catalogId` normalization → size/component/message caps + "≥1 input, ≥1 Button". Forms lean on A2UI's pure/local client functions to make fields cross-reference each other live (`formatString` `${/path}` echoes in `Text`; `checks` on inputs that watch other fields) and to visualize the subject (emoji stamps + a hero-stat `Card`; the named `Icon` component is avoided — no Material icon font ships, so it renders as raw text); the Thinking pane renders the slot read-only via `InsightsEmbeddedDiagram`'s `forms` branch (`FormsRenderer` `preview` prop). Server gate: `validateAndPrepareFormsPatch` (`apps/server/src/tools/formsA2uiTool.js`) — no A2UI runtime on the server (that would pull `@a2ui/web_core` into the backend); the client's `MessageProcessor` in `FormsRenderer.jsx` is the render-time check. Mutations arrive via `apply_forms_patch`; on allowlist failure the **syntax fixer ladder** (`formsSyntaxFixer.js`, lite → flash → DeepSeek) runs before full-agent repair turns (bounded by `FORMS_REPAIR_MAX_ATTEMPTS`). This is the deliberate opposite of the critique checklist (server-built A2UI from Markdown) — see [`docs/architecture-a2ui.md`](docs/architecture-a2ui.md).

## Canonical commands

| Goal                                   | Command                                                                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Run web + server together              | `npm run dev`                                                                                                                                |
| Run all tests                          | `npm test`                                                                                                                                   |
| **Diff-scoped tests (agents)**         | `npm run test:affected` (basename + blast-radius map; skips slow Anything unless diff touches `anything*`)                                   |
| **Verify (diff-scoped, agents)**       | `npm run check:affected` (includes Prettier on changed files)                                                                                |
| **Verify a change end-to-end**         | `npm run check` (typecheck + typecheck:strict + lint + test + wire)                                                                          |
| Shared-only / schema touch             | `npm run check:fast`                                                                                                                         |
| Before PR / local CI parity            | `npm run check:full` (`check` + build); GitHub CI parallels the same coverage                                                                |
| Wire + doc paths only                  | `npm run check:wire`                                                                                                                         |
| Blast-radius map                       | [`docs/agent-blast-radius.md`](docs/agent-blast-radius.md)                                                                                   |
| Format the diff you're about to commit | `npm run format:affected` (agents); `npm run format` for whole repo                                                                          |
| Build all workspaces                   | `npm run build`                                                                                                                              |
| Health probe                           | `curl http://localhost:\$PORT/api/health`                                                                                                    |
| Mermaid offline bench                  | `node apps/server/scripts/benchMermaid.js --tag <label>`                                                                                     |
| Anything offline bench (no LLM)        | `node apps/server/scripts/benchAnything.js --tag <label>`                                                                                    |
| Anything **generation** bench (tokens) | `node --import ./scripts/register-antv-layout-esm.mjs --import tsx apps/server/scripts/benchAnythingGeneration.js --tag <label> [--browser]` |
| Regenerate **one** baked audio asset   | `./scripts/generate-office-audio.sh <name>` — bare = whole manifest, 900 credits, overwrites everything                                      |
| Check the committed audio bank         | `./scripts/generate-office-audio.sh --verify` (free, no key, no network)                                                                     |
| Quality ratchet (in `check`)           | `npm run verify:ratchet`; `npm run verify:ratchet -- --with-lint` for the ESLint pass                                                        |
| Routine budget check                   | `npm run routine:guard -- --postflight <name>`                                                                                               |

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

- **Office sound is one posture, not four checkboxes.** Menu bar **Admin** carries 🎧 **Headphones**
  (how the office reaches you) and 🔕 **Focus** (whether it does), plus the Approved vendors strip.
  The composer band holds Mail / Chat / Meeting as direct icons (`DeskActionsDock`), not a helmet
  menu. `setOfficeHeadphones` in `apps/web/src/state/officeMomentStore.js` is a **macro** that
  writes `narration`/`soundscape`/`captions` — read those three, never `headphones`, from a
  consumer. Boot runs `reconcileOfficeHeadphonesPosture()` so a stale pre-macro Voice key cannot
  desync the menu from speech. Focus is also the advisor roundtable's mute; don't reintroduce a
  second one. See [`docs/office-parody.md`](docs/office-parody.md) § Desk verbs.
- **The parody-OS frame is height-budgeted by one token.** `--desk-taskbar-h` (`App.css` `:root`)
  is what `.bottom-chrome` stacks on at _every_ breakpoint, and `.desk-os-taskbar` uses a fixed
  `height` + `box-sizing: border-box` so a tall child clips instead of silently shoving the
  composer band under the bar. Adding a resident to the taskbar means checking the token, not
  just the flexbox. `test/deskOsFrameStyles.test.js` pins both facts; jsdom has no layout engine,
  so real geometry needs a headless browser (the scoped verify skill under
  `apps/web/.claude/skills/verify/` has the recipe).
- **Taskbar width is a priority ladder, and `min-width: 0` is the wrong reflex on a cluster.**
  The bar is over-subscribed by 320px, so every resident must declare what it yields. Inside a
  resident, `min-width: 0` is right — it is what lets a label ellipsize. On the flex _cluster_ that
  holds residents it is wrong: it defeats the automatic minimum size, so the cluster shrinks past
  the floors its children declared and their content spills sideways into the neighbouring
  resident. The bar's own `overflow: hidden` cannot catch that, because the overflow is into a
  sibling rather than out of the bar. Measured symptom: `.desk-os-taskbar-lead` collapsed to 19px
  and the presence faces painted over the window pills. Give the cluster its content-based
  minimum, floor each resident at what it must never lose, and `overflow: hidden` the resident
  itself. Below 360px the **XP chip yields before the presence strip** — who's around is the
  office-life signal; HR progression still opens from Admin. Related trap: a narrow-viewport
  override for a taskbar selector must sit **after** the base rule in `App.css` — same
  specificity, so the 360px block further up the file loses the cascade and silently does
  nothing. Both pinned by `test/deskOsFrameStyles.test.js`.
- **Office windows have three placements and one minimize; both live outside the window.**
  `FloatingWindow` resolves a `presentation` from the viewport (`useWindowPresentation`):
  free-dragging ≥1025px, docked panel 640–1024px, bottom sheet ≤639px. A sheet has **no
  `left`/`top` at all** — don't "fix" phone clipping by tuning `minVisiblePx` in
  `useDraggablePosition`; that hook is disabled at that breakpoint and `useSheetSnap` owns the
  gesture instead. **Minimize is `overlayStack` state, not a local `useState`** — a minimized
  window renders nothing and the `DeskOsTray` pill restores it. Three traps: the placement CSS
  must remain the **last block in `App.css`** (every window sets its own size at (0,1,0), so
  the (0,2,0) placement rules win by order too); a sheet reserves **only** `--desk-taskbar-h`,
  because the taskbar is where minimize sends things; and `minimizeOtherOverlays` (the phone's
  one-window-at-a-time rule) spares anything with `manageable: false`, which is the only thing
  stopping it from swallowing IM pings. Never re-add `touch-action` to `.floating-window` — the
  drag handlers are on the handle, and on the root it vetoes touch scrolling for every
  descendant. See [`docs/office-window-manager.md`](docs/office-window-manager.md).
- **The taskbar's leading cluster is the office; the composer band is two lanes.** Mail / Slop
  Chat / Meeting live in `DeskOsTaskbar` beside Stand up and the presence strip, arriving by
  **portal** through `deskSlotStore` — so the bar still owns no office state, and the anchor
  `#office-desk-bottom-slot` must exist exactly once (a second one silently steals the portal).
  The composer band's lanes each carry their own tool: notebook inside `.desk-work-order-group`,
  roster inside `.desk-talk-group`. Three traps, all invisible to jsdom and all found by driving
  a browser: **`.desk-actions` is a corner dock** (`position: fixed; top: 124px`) so any new
  placement needs a reset at `(0,2,0)` or the corner rules' `:not(.desk-actions--bottom)` wins
  `top` and drops it off-screen; **`.desk-work-order-group` is `flex-direction: column`**, so a
  second child stacks unless the lane is forced to `row`; and the flat-tool-row
  `.desk-chrome-tool { order: 1 }` **reverses a nested lane**, so lane order must be declared on
  every child. Below 640px the bar sheds Concentration + the HR chip (both have a second home),
  never the office half. See [`docs/office-window-manager.md`](docs/office-window-manager.md) §11.
- **Which verb goes where is frequency, not category.** Most-runs verbs stay on the bottom
  composer band; few-times-a-session verbs go to the menu bar (`DeskOsMenuBar`), persistent status
  goes to the taskbar tray (`DeskOsTaskbar`). Don't add a sixth command surface. See
  [`docs/office-isometric-mode.md`](docs/office-isometric-mode.md) §4b.
- **A huddle is a moment, so it lives in the store.** `officeMomentStore.huddle` is
  presentation-agnostic on purpose (ADR-0011 rule 1) — the desk overlay is renderer #1 and the
  isometric floor version is a follow-up slice. Don't move huddle state into `HuddleOverlay`.
- **Presence strip is not always Stand up.** `presenceFollowOf` routes by kind (`standUp` |
  `messenger` | `stay`). Opening Slop Chat from the strip goes through
  `officeMessengerUiStore` — do not prop-drill through the menu bar or fold that signal into
  `officeMomentStore`.
- **Office TTS cast / accent lives in `officeTts.js`.** Change `CHIRP3_VOICE_ROSTER` /
  `CHIRP3_ACCENT_LANG` / WaveNet tables there; ear-audition with throwaway `scripts/*-audition*.mjs`
  (never wire Cloud TTS or ElevenLabs into CI, routes, or deploy). Kill switch `OFFICE_TTS=0`.
  **zh-TW has no Chirp rung** — missing `CHIRP_LANG_CODE['zh-TW']` is intentional; verify with
  `listVoices` before re-adding. See [`docs/office-narration-roadmap.md`](docs/office-narration-roadmap.md).
- **A soft errand is defined by the timer it does not have.** `officeMomentStore.errand`
  (slice 26) is the office's one standing request — Linda's email grows a **Go and find Chad**
  CTA, pressing it stands you up carrying one, speaking to Chad on _either_ renderer settles it.
  Three things are load-bearing and each looks like an oversight. It has **no TTL, reminder or
  re-offer** — ADR-0010 consequence #4, and a quest that nags is the quietest way to break it.
  The email marker **raises nothing on arrival**; only the press does, so an errand you never
  read cannot exist. And it is deliberately **absent from `hasActiveOfficeSurface`**: that
  predicate gates the ambient director, and something with no expiry counted there would hold
  the whole office silent until you ran it. Its card is the **last** rung in `FloorCardSlot`
  and its line replaces only the **at-rest** narration, both for the same reason — it is the
  first durable entry in two orderings built for momentary ones, so ranking it higher
  suppresses every transient offer (and, in the live region, stops reporting that you are
  walking). `settleOfficeErrand` returns the errand rather than a boolean because the log needs
  `fromId`; it still awards nothing, so XP and the log keep one `onOfficeEvent` funnel.
- **Declining a set piece no longer cancels it, and pacing is what keeps that safe.** Slice 28:
  `declineOfficeCoffee` marks the break `declined` instead of nulling it, so the cast still
  walks to the machine and talks and the floor can offer a way in (`sceneJoinOfferFor` →
  `FloorSceneJoinCard`). The trap is `hasActiveOfficeSurface`, which counts `coffee`: a scene
  that survives declining is a **live surface nobody is watching**, so if it is not paced it
  never reaches `onDone`, never dismisses, and holds the ambient director silent for the rest
  of the session — the errand trap by another door. Hence `useOfficeLayerPerformances` runs on
  `accepted || declined`, and the **award** moved to the `accepted` test instead (a break you
  skipped is worth nothing; joining is what earns `coffeeBreak`). An unattended scene is
  **silent**, and the silence must be a wrapper returning `{spoken:false}` — never `undefined`,
  which makes `useScenePacing` flush the whole script in a tick. Joining **ends** the scene:
  `joinOfficeCoffee` swaps the remaining script for one canned beat and mints a **fresh `id`**,
  because pacing keys on `sceneId` and reusing it leaves `visibleLines` past the end of a
  one-line script. Unlike shop talk the offer has **no inner bound** — a scene's cast are
  `awayIds`, so `dwellTargetAt` cannot pick them and there is no collision to dodge. The
  cubicle battle is deliberately not converted (its verdict panel makes "ends it" ambiguous).
- **Declining a set piece leaves it running, and how it then _ends_ differs per scene.** Slice
  28 did this for the coffee break, slice 30 for the cubicle battle, and the second one is where
  the reusable rule is. A declined scene stays in the store, so it counts toward
  `hasActiveOfficeSurface` — and if it never reaches an ending the ambient director stays silent
  for the rest of the session. Pacing it (`useOfficeLayerPerformances` runs on
  `accepted || declined`) is **sufficient for the break and not for the battle**: `battlePace`'s
  `onDone` only raises `battleLinesDone`, and what actually clears the store is a click on the
  verdict panel, which is gated on `accepted`. So an unattended battle takes a second exit —
  `onBattleUnsettled` dismisses it, unsettled, paying no XP. Before adding a third joinable
  scene, ask **what clears it when nobody is watching**, not merely whether it is paced. Joining
  is per-scene for the same reason: a break has nothing pending so joining ends it, a battle has
  a question so joining hands you the casting vote (`accepted` raises the panel the battle
  already had). Copy is **one block per kind** (`sceneJoin`, `sceneJoinBattle`) — never a
  `{kind}` branch into a shared one, or a translator softening one reword the other. Note the
  kitchen and the cubicles are **2-4 tiles apart** against an earshot of 3, so the two offers'
  catchments genuinely overlap; the fix is the fixed scan order in `sceneJoinOfferFor`, never a
  second radius.
- **Saying something out loud has four answers, and the one that walks over is a `walkby`.**
  `talkOutLoud` used to have exactly one outcome — a reply card, every time — which is a chat
  window in a costume. `pickTalkAnswer` (`officeCadence.js`, beside the rest of the office's
  appetite) rolls **shout** / **walkover** / **ignored**; naming somebody never rolls (they are
  looking at you) and yields **turnedTo**. Two rules are easy to undo by accident. A walk-over must
  go through `pushOfficeWalkBy` rather than growing a renderer of its own: that is what buys both
  the desk head-over-shoulder and the floor colleague who **actually gets up and walks**, and its
  prompt already demands the line name something visible — which is the whole difference between
  coming over for a reason and saying something you could have said from your chair. And silence
  needs a **delay** (`TALK_SILENCE_DELAY_MIN_MS`) plus a self-clearing card: instant silence reads
  as a broken send button, and a silence you have to dismiss is paperwork about nobody answering.
  The user's line is recorded either way — you said it. Pin the roll by driving `random` at the
  weight bands, never by stubbing `pickTalkAnswer`; the weights _are_ the design, and the desk
  suites' `random: () => 0` seed must keep landing on an answer.
- **A talk reply is speech, and the wire has to say so or it comes back written like Slack.**
  `kind: 'im'` carries "Lowercase chat energy welcome" and reply mode opens "The user just sent you
  a chat message" — both false about somebody who said it out loud. `OFFICE_MOMENT_SITUATIONS`
  (shared) therefore splits: the **silent** ones (`dwell`, `run`) stand down for a `userMessage`,
  the **spoken** ones (`outLoud`, `turnedTo`, `walkover`) arrive _with_ one and **replace** the
  typed reply mode (`isSpokenMomentSituation` in `officePersonas.js`), swapping the body rule for
  `imSpoken`. `runWalk` is spoken **without** a `userMessage` — they walked over because a run
  landed, they did not answer a shout. Adding a spoken situation is a constant, a rule block, a
  reminder line _and_ the predicate — miss the predicate and the block is dead code that the typed
  rule silently outranks.
  Each block must state its **geometry** (how far away, who else heard), because that sets the
  length and register and it is the only thing the model cannot read off the words.
- **The office log records; it never triggers.** `officeLogStore.js` is what lets the cast say
  "since this morning's thing" (docs/office-parody.md §11 context contract). Writers hook the
  funnels that already exist — `onOfficeEvent` in `useRunCeremony.js`, the moment-store push
  mutators, the adopt handler in `OfficeLayerSlot.jsx` — so **don't add an observer to feed it**.
  Making it schedule or trigger anything would be `auto-fix-on-idle` in a new hat, which
  ADR-0010 consequence #4 rules out. Two rules its tests pin: DM bodies never enter the digest
  (email subjects do), and the log is **day-stamped** while Slop Chat scrollback is not.
  It ships as `officeLog` on every office LLM surface (`/moment`, `/meeting`, `/huddle`,
  `/meeting/interject`, `/advisor/suggest`) via `agents/_lib/officeLogPrompt.js` — which lives
  in `_lib/` because `officePersonas.js` and `advisorPrompts.js` are deliberately separate
  prompt systems. Pass `purpose: 'work'` for the advisor: its 80-char envelope cannot afford the
  dialogue rule, so it is told to use the log **only** to avoid re-proposing what was just done.
- **The log is read twice, and the second read is a projection, not a store.**
  `buildOfficeRelationship(entries, colleagueId)` (`officeLogDigest.js`, bound as
  `getOfficeRelationshipWith` in the store) answers "what have you and I been to each other
  today", which the shared digest structurally cannot: that one is capped at 12 lines / 700
  chars and drops from the front, so a colleague's own history scrolls off by mid-afternoon.
  Ships as `officeRelationship` on `/moment` **only** — the one surface with a single speaker —
  and covers only the four kinds carrying a `colleagueId` (`email`, `chat`, `walkby`, `pitch`).
  `battle` is excluded on purpose: its id is in `detail` and means _winner_.
- **Office continuity (working memory + runWalk) shipped in v1.** Colleagues feel
  real because the same person remembers you, not because they talk more. Spec:
  [`docs/office-continuity.md`](docs/office-continuity.md) and
  [ADR-0013](docs/decisions/0013-office-continuity.md). Working memory records and never
  triggers. The only new initiation is a completed run (`runWalk` on the floor, IM at the desk,
  existing run-reaction budget). Adding a situation is still a four-place contract: enum,
  predicate, rule block, reminder — never reuse `run` or `walkover` for this beat.
- **In a prompt rule, prohibitions crowd out a hedged permission — lead with the register.**
  Measured on the relationship block: three "do NOT"s against one "let this colour how you
  sound" auditioned **inert**, its arm indistinguishable from the control. The killer is a
  blanket escape hatch ("say nothing if nothing here earns it") — a model takes that branch
  every time, and the block is only built when there _is_ something, so the branch was never
  worth offering. Put the wanted behaviour first and in the imperative, keep one guard.
- **A meeting's roster and its speakers are two different lists.** `POST /api/office/meeting` takes
  `attendees` (scripted, bounded by `MEETING_MAX_ATTENDEES`) and an optional `audience` (present,
  silent — the all-hands crowd, §10.4). Do **not** raise `MEETING_MAX_ATTENDEES` to seat a crowd:
  it lets _every_ meeting seat one, and asks the model to give N people lines inside
  `MEETING_MAX_BEATS` (14). The audience is listed **by speakerId and forbidden one in the same
  breath** — `normalizeMeetingScript` drops beats from speakers outside `attendees`, so an audience
  member who "speaks" costs a beat and can push the script under `MEETING_MIN_BEATS`, which the
  client renders as a _cancelled_ meeting rather than a big one. Note `speakerLabel` returns the
  raw id for the whole team tier (their voices live in `STAKEHOLDER_MEETING_VOICES`, which stores
  strings, not `{name,title}`) — don't reach for it to pretty-print a roster.
- **The escalation rung is a wire contract duplicated verbatim (§10.10).** `MEETING_VENUES =
['workingGroup','steering','cab']` exists in BOTH `officePersonas.js` and `officeCast.js`; the
  server zod-defaults an omitted `venue` to `workingGroup` and 400s an unknown rung. Keep the two
  copies in lockstep or one side books a room the other can't script. Escalation is a scripted beat,
  never a picker: `escalationRosterFor` picks the roster, `nextMeetingVenue` picks the destination
  (a senior+facilitator room jumps straight to the CAB). A completed CAB hearing fires `cabApproved`
  (NOT `meetingSurvived`) — +40 XP and its own one-shot achievement.
- **`MOMENT_WEIGHTS` in `officeCadence.js` is a cumulative roll, so adding a kind moves every lane
  boundary.** Tests that pin a lane with a magic `random` value (`useOfficeAmbience.test.jsx`)
  will start asserting on the wrong surface — re-derive the value against the new total rather than
  hunting for a logic break.
- **The stand-up/sit-down transition is one fact in two places: the JS exit timer and the CSS exit
  fade.** `useFloorViewPhase` (`officeFloor/viewTransition.js`) keeps the floor mounted for the
  sit-down beat after the store flips; `OfficeFloor.css` owns the camera choreography on
  `data-view-phase`. `officeFloorViewTransition.test.js` pins the two durations to the same
  number — change one, change both. Never animate `main.app-shell` or the OS chrome to sell the
  transition: a transform/filter there re-anchors the fixed-position floor and every portaled
  window. The desk side is `.office-view-desk-veil` (backdrop-filter, one z-layer below the
  floor). Multi-line comma-terminated values in `OfficeFloor.css` are a separate trap — the
  sheet's reduced-motion scanner (`officeFloorStyles.test.js`) mis-parses them as selectors. See
  `docs/office-isometric-mode.md` § 1a.
- **A second live `FormsRenderer` breaks the `forms` slot unless you opt out of two things.**
  Linda's training window (`OfficeTrainingWindow.jsx`, §10.1) is the first non-slot forms surface
  and the template for any future one. Pass `exportable={false}` — the exporter registry in
  `viewportPngExport.js` is a `Map` keyed by content type and unregistering is identity-matched, so
  a second instance overwrites the slot's entry and then fails to restore it, leaving Export-PNG
  broken until the real renderer remounts. Do **not** pass `preview` — that is the read-only
  thinking-pane mirror and it early-returns out of the action handler, so the form renders
  perfectly and silently refuses to submit. The training document never reaches the `forms` slot
  (ADR-0010); `officeTraining.test.jsx` pins that by asserting no _import path_ exists, not merely
  that one flow avoided it. Server side, `/api/office/training` reuses `FORMS_CORE_RULES` rather
  than restating the A2UI contract, and `createOfficeChatModel` needs `purpose: 'training'` — a
  form document does not fit the 512/2048-token moment/meeting ceilings and truncates into a
  validation failure that reads like "the model cannot author A2UI".
- **`@archislop/shared` resolves to `dist`, so a new shared file is invisible until you build it.**
  Adding a new module under `packages/shared/src/` and importing it from `apps/web` yields
  `undefined` at runtime rather than a module error — the symptom is a constant that silently
  became `"undefined"`. Run `npm run build -w packages/shared` after adding or changing a shared
  export.
- **Set-piece markers on office email templates are fields, not text — mirror them per locale.**
  `training: <module>` and `phishing: true` (`officeCast.js` + all three `office.*.js` bundles) are
  what grow the CTA on an email. The slot-fill parity test only inspects strings, so a missing
  marker makes the set piece unreachable in that locale with nothing rendered to notice;
  `officeLocale.test.js` now pins the markers explicitly.
- **The office's LLM appetite is one table in `officeCadence.js`.** `OFFICE_LLM_MOMENT_CAP`,
  `EMAIL_LLM_RATIO`/`IM_LLM_RATIO`, `OFFICE_RUN_REACTION_LLM_CAP`, `OFFICE_DESK_LLM_CAP`,
  `OFFICE_TALK_LLM_CAP`, `OFFICE_DWELL_LLM_CAP` — `useDeskActions.js` and `useOfficeRunReactions.js` re-export from it
  rather than declaring their own, and `officeCadence.test.js` pins that identity. Tune there,
  not at the use site. The governing split is §11's: **ambient** (a timer interrupted you) stays
  canned-heavy; **reactive** (you started it or answered it) leans LLM, because a canned reply to
  a sentence you typed is the clearest possible tell that nobody is home.
- **`officeCadence.js` owns the office's other clock too — the wall clock.** `officeDayPhaseAt`
  - `OFFICE_DAY_PHASES` are the office day (mugs early, the remote stand-up, trait rows midday,
    papers at wind-down, cool→warm→dark light). The dial lives there and **not** on the floor,
    because an office day is ambient content on a timer; the floor owns only what a phase looks
    like (`PHASE_ART` in `officeFloorActivity.js`, `[data-day-phase]` in `OfficeFloor.css`). The
    hour is **rung 5** in `floorActivityFor` — above the trait row, below everything live — so
    anybody a moment is drawing (walk-by, set piece, commuter) deliberately gets no phase at all.
    One trap it found: a `headwear: null` **cannot take a headset off**, because `PersonaFace`
    resolves `accessoryOverride ?? traits.accessory` and only the literal `'none'` strips a baked
    trait — Dave's headset is his face, not his activity.
- **`officeCadence.js` now carries two wall clocks, and which one a fact belongs to is
  "does it change how the room looks, or where people go".** `OFFICE_DAY_PHASES` is the first
  (mugs, papers, light); `WANDER_BIAS_WINDOWS` / `wanderBiasAt` is the second (slice 24: from
  two until half four an errand is 3× likelier to be a coffee run). The slump is deliberately
  **not** a sixth phase — three in the afternoon _looks_ exactly like eleven in the morning, so
  promoting it would change the light at 2 pm and owe `officeFloorStyles.test.js` a sixth rule
  to buy a fact about walking. Both dials stay in the cadence; the floor still owns only what a
  phase looks like. The bias table's one row is also the design: `PHASE_ART` already puts a mug
  in every hand at nine and papers at five, so biasing traffic there would tell the same thing
  twice. **The wall clock (slice 25) is a third _face_ of the same clock, not a third clock**:
  `FloorWallClock` reads `officeWallClockAt` (cadence), the same instant the phase dial reads,
  so hands and light can never disagree. A clock that read its own `Date`, or polled on a
  one-second second-hand, would repaint the floor continuously against the
  "re-render only on change" budget — `OFFICE_WALL_CLOCK_POLL_MS` is a heartbeat, and the poll
  bails on a same-value set. Placement is `FLOOR_WALL_CLOCK` in `officeFloorPlan.js`, drawn via
  the plan module's `wallPoint` (the windows share it); the face is self-lit (reads on all five
  phase walls) and unanimated (owes the reduced-motion block nothing).
- **A sensor swept over a _filtered_ set only ever fails inside the filter.** The shop-talk
  bank check swept `WANDER_BIAS_WINDOWS`, so it asserted the cap only for props the clock
  favours — the printer and whiteboard sat under the floor for two slices, invisible to it by
  construction, and the test was green the whole time. The tell is a sweep whose set is
  narrower than the invariant: `OFFICE_SHOP_TALK_CAP` counts exchanges **per visit**, so it was
  never a fact about favoured props. Sweep the widest set the invariant actually covers
  (`usablePropKinds()` here), and if a subset deserves a stronger claim make that a **second**
  assertion rather than narrowing the first. Same family as the non-empty companion rule below:
  both are ways a passing test can be examining almost nothing.
- **A weighted random pick must consume the same number of `Math.random()` calls as the
  unweighted one it replaced.** Weight by repeating entries in a list and roll **once**; never
  roll a second time to decide whether the bias applies. This is the direct consequence of the
  PRNG-stream finding below — an unpinned floor suite shares one stream across a file, so
  changing the _count_ of randoms re-seeds who is wandering in every other test in that file.
  `officeFloorWander.test.jsx` pins the count in both the biased and unbiased arms.
- **The office day's light is a token palette on `[data-day-phase]`, and it must stay one rule
  per phase.** `--office-window-tint` / `--office-wall-ne` / `--office-wall-nw` /
  `--office-floor-plate` / `--office-surround-veil` all default on `.office-floor` to the
  literals `FloorRoom` shipped with, so an unphased mount (first-run `FloorArrival`) is
  unchanged. `officeFloorStyles.test.js` pins `dayRules.length === OFFICE_DAY_PHASES.length`, so
  a **new token goes into the five existing phase rules, never into a rule of its own**. Zone
  plates get no token on purpose — they are alpha washes and re-grade with the plate for free.
  The surround veil is a **background layer, not an overlay element**: a background paints
  behind the element's children, so it grades the backdrop and cannot tint the room, the cast or
  the chrome. None of it is transitioned, which is what keeps it out of the reduced-motion
  contract. **A blackout is the wrong reflex for `afterHours`** — you are standing in the room,
  and the 7 %-alpha grid plus dark-glyph/white-halo zone labels both need the light.
- **A floor test that _mounts_ inherits two globals it never named: the wall clock and
  `Math.random`.** The random half was found by slice 23 — `useFloorWander` sends somebody out on
  an unstubbed roll, so an unpinned suite shares one PRNG stream across the whole **file**, and any
  change anywhere that consumes a different number of randoms re-seeds who is wandering.
  `officeFloorDwell.test.jsx` went red on a test that **passed in isolation and failed in file
  order**, which is this class's signature; pin with `vi.spyOn(Math, 'random').mockReturnValue(0.75)`
  (the floor suites' seed) unless the suite is about the roll. **Since slice 24 the seed alone
  is not enough**: `wanderBiasAt` gave the clock a say in _where_ a seeded wanderer goes (3× the
  coffee machine from 14:00 to 16:30), so the two globals stopped being independent — and it
  shipped that way, leaving slice 23's join tests and two `officeFloorWander.test.jsx` describes
  red on `main` every afternoon and green the rest of the day. The signature is that the
  **coverage assertions still pass** (he is Chad, he is settled — just at the wrong prop), so it
  reads as a broken card rather than a clock. A mounting floor suite that asserts geometry needs
  **both** `vi.setSystemTime(new Date(2026, 7, 11, 12, 0, 0))` and the 0.75 seed. Neither failure mentions time or
  randomness — both read as a broken assertion about the feature under test.
- **Any floor test that _mounts_ rather than calling `floorActivityFor` directly is
  time-dependent.** The hour is rung 5, above the trait row, so a render test asserting what a
  character's own row gives them is silently wrong whenever `PHASE_ART` has an entry —
  `officeFloorActivity.test.jsx` was red for ~7.5 h a day (mugs in `earlyMorning`, empty hands
  in `standUp`) and survived because CI kept landing in the quiet window. Pin the clock with
  `vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] })` to a **midday** instant —
  one of the two phases with no `PHASE_ART` — and fake `Date` only, or the floor's poll timer
  and React's scheduling stop and nothing renders.
- **Why a colleague is speaking is a wire field, not an inference.** `situation` on
  `POST /api/office/moment` (`OFFICE_MOMENT_SITUATIONS` in shared: `dwell` | `run`) picks one
  rule block in `buildMomentSystemPrompt` and one terse restatement at the end of the user
  prompt. **Enum, never free text** — it shapes a system prompt, so a client picks from the set
  and cannot write into it. **Absent is the default** and keeps the cold-open "MUST SURPRISE"
  framing every ambient moment wants; **a reply beats a situation**, since the dwell block's
  premise is that nothing was said. Adding a third is a constant, a rule block and a reminder
  line. **A situation may state the circumstance, never a delta the prompt does not carry** —
  `run` used to end with "React to what changed" while the prompt ships only the current diagram,
  and the first audition measured the model inventing that change in **8 of 12** samples against a
  fixed diagram (**0 of 12** with no situation, so the field caused it). Naming the wrong change
  to somebody looking at their own work is worse than the non-sequitur the field exists to fix.
  See docs/office-parody.md §11.
- **Prompt changes are auditionable now, and a fixed fixture + a control arm is the whole
  method.** `api.deepseek.com` is reachable from the session proxy and `DEEPSEEK_API_KEY` is
  live, so an office prompt can be driven for real instead of reasoned about: replicate the
  route handler in a throwaway script (`buildMoment*Prompt` → `createOfficeChatModel` →
  `parseMomentReply`), hold the diagram **constant**, vary one field, sample ~4× per arm, read
  the arms side by side. The control arm is load-bearing — a failure rate means nothing without
  it. Check reachability before promising an audition (`curl -sS -o /dev/null -w "%{http_code}"
https://api.deepseek.com/` — 401 is reachable, 000 is blocked); never route around a block.
- **Office `diagramSource` is truncated, not rejected.** Cap is `OFFICE_DIAGRAM_SOURCE_MAX_CHARS`
  (shared). Tightening Zod to 400 oversized anything/forms slots turns meetings into Pam CANCELLED
  emails.
- **Persona faces vary jaws, never skulls.** All four `faceShape`s in `personaFaces/index.jsx`
  share one cranium (crown y9.6, temples x11.8/28.2) so every hair path fits every head — a new
  hair style must span x11–29 to cover the `round` jaw's cheeks, or the scalp peeks out. Two
  more art traps, both found by screenshotting the throwaway vite-harness recipe from
  `apps/web/.claude/skills/verify/`: a hair part is a thin skin sliver hugging the hairline's
  lower edge (a blob floating on the scalp reads as a bald spot), and garment shading is
  `color-mix` in `style` over a plain `fill`/`stroke` attribute fallback. The harness must define
  `--accent` itself or `var(--accent)` accents (Gilfoyle, you) paint wrong.
- **`useScenePacing` reveals every line at once when it has no narrator.** That is right for the
  coffee/battle cards and wrong for anything that lights one speaker at a time — pass a narrator
  wrapper that returns `{spoken:false}` instead of passing `undefined`.
- **What somebody is doing on the floor is derived once, in `officeFloorActivity.js`.** Held
  item, headwear and idle rhythm come from `floorActivityFor(id, ctx)` with a fixed precedence
  — a call ▸ your Headphones posture ▸ a coffee ▸ the character's `officeDeskWork.doing` row —
  and `FloorFigure` is handed the answer. Do **not** compose it at a use site: the four inputs
  are four different kinds of state (trait row, live meeting, moment-store preference, running
  set piece) and six components draw a figure, so a second composition is a room where five
  surfaces agree about the headset. Read `headphones` from the moment store, never
  `narration`/`soundscape` — one macro, three outputs, and only the first means "wearing a
  pair". Two art traps: a held item is a **third layer over the head** (a seated figure's desk
  hides everything below figure-y 36 and the face disc owns y 0-34, so the torso has ~6 usable
  pixels — `office-isometric-mode.md` § 6 rule 31), and it must stay absolutely positioned with
  `pointer-events: none` or it re-inflates the hit box § 6 rule 23 shrank. **You** are drawn
  from `PLAYER_FACE_TRAITS`, which lives beside `PERSONA_FACE_TRAITS` because that object's
  keys are pinned to `CAST_TIERS`.
- **A physical meeting derives separately, and the hour crosses into the glass room only as far
  as the hand.** `MeetingActor` takes `meetingActivityFor`, **not** `floorActivityFor` — the
  glass room shares almost no rungs with a desk, so it is a second ladder in the same module
  rather than a branch of the first (same module on purpose: that is what stops the room and
  the meeting disagreeing about a headset). Two rules it encodes, both counter-intuitive. The
  **desk trait row never survives being summoned**: seven of the sixteen `officeDeskWork` rows
  say `typing` and two say `phone`, so handing `MeetingActor` a plain `floorActivityFor` seats
  a table of people typing through the meeting they walked to, with Russ taking another call in
  it. And **only the phase's `hold` crosses, never its `headwear`** — at the `standUp` hour
  `PHASE_ART`'s whole-office tell is a headset, which means "on a call from your desk", so
  drawing it on somebody sitting in the room paints the **remote** modality on top of the
  **physical** one, the single distinction `FloorMeeting` exists to make. The rule is: whoever
  called it holds the agenda, everybody else holds the hour, the rest are listening.
- **A wanderer speaks only when _you_ caused it, and `goHome({ byYou })` is the whole gate.**
  Ambient floor traffic is silent by design (slice 11: a wanderer with something to say is a
  walk-by). Slice 18's "excuse me" is not an exception to that — it is §11's ambient/reactive
  split applied to a **tile you claimed**, so nothing can fire while you sit still. Don't give
  ambience a second reason to talk. Two facts the code leans on: `interrupted` and `carrying`
  are both read off `phase === 'dwell'`, so somebody can never apologise for a coffee they are
  visibly holding; and an interrupted trip **lingers** at the desk (`LINGER_MS`) before it
  clears, because the walk home is as short as 420 ms and a line nobody can read is a flash.
  Do not "simplify" `handleArrive` back to clearing on arrival. Copy is `floor.interrupt` in
  `officeCast.js` — all three locale bundles or it is a silently dead feature in that language
  (`officeLocale.test.js` pins the bank lengths and the `{prop}` count).
- **Standing next to somebody is the floor's one mechanic with a trigger of its own, and
  `channel: 'talk'` is what makes it safe.** Slice 19 fires a remark after five seconds within
  `NAME_CHIP_RANGE_TILES` — **reuse that constant**, never a second radius, or the person who
  speaks stops being the person whose name chip is lit. The line goes out through
  `desk.remarkTo` on `channel: 'talk'`, and that channel is load-bearing rather than cosmetic:
  `pushOfficeImPing` skips the desk arrival toast for talk lines and keeps them out of Slop
  Chat™ threads and unread counts, which is the only thing stopping one remark rendering as a
  balloon _and_ a notification. Send it as `'im'` and you get both. Two more facts: the
  `senior` exclusion is **the glass** (`tileDistance` is Chebyshev, so a legal tile is one step
  from three executives), not politeness; and holding the target in place is a **cycle** —
  the target needs `floorState`, which `useFloorAway` returns, and `holdId` is one of its
  arguments — so a passing colleague can finish their errand and leave mid-countdown, which is
  accepted rather than unfixed.
- **Speech is spoken, writing is read — and `imHistory` holds both, so the medium is one
  field.** Walk-bys, meetings, battles, coffee, huddles, desk/floor talk, dwell remarks and shop
  talk get a voice; **an email or a Slop Chat™ message never does** (you read those yourself).
  `isSpokenLine` (`officeImThreads.js`) is the only answer, the exact complement of
  `isSlopChatMessage`. The trap is the **default**: `pushOfficeImPing` omits `channel` entirely
  for `'im'`, so _written is unmarked_ and any reader that forgets the question treats writing as
  speech. That is not hypothetical — the floor's `lastInboundFrom` had no channel filter and so
  lifted a typed IM into a balloon over somebody's head and narrated it in their voice, worst
  after a reload, since `persistImHistory` keeps Slop Chat lines **only** and a restored session
  therefore offers nothing else. Pinned by `officeVoiceMedium.test.jsx`, including the companion
  claim that genuinely-spoken lines still speak — without it, a floor gone silent passes.
- **Text is the fallback channel, not the primary — but never delete it.** With narration on and
  CC off, `shouldShowSpokenText` suppresses the balloon for anything spoken, which is why § 6
  rules 29/32 (bubble overlap geometry) are **closed** and should not attract another capture.
  Captions remain the accessibility path and the TTS-failure path; "voice-first" orders the two
  channels, it does not remove one.
- **The cast may talk to each other, and _your position_ is the whole licence.** Slice 22 has a
  wanderer who settles at a prop trade two canned lines with whoever sits beside it — the first
  line in this office not addressed to you. It does not contradict "don't give ambience a second
  reason to talk" **only** because no exchange exists unless you are stood in earshot, so the
  room never chatters to itself in a corner you are not in. Delete that gate and it still looks
  right in every screenshot while becoming exactly the timer-driven chatter the program spent
  eight slices unwinding; `officeFloorContracts.test.js` pins it. Two rules ride along: an
  overheard line **may never ask for anything** (no Do-it, no thread, no unread count — the
  moment it does it is a walk-by, which belongs in the moment store), and it is **canned**, like
  the other two overheard performances (coffee, battles). Who replies is derived from the layout
  (`shopTalkPartnerFor` — nearest seat within `NAME_CHIP_RANGE_TILES` of the _mark_), which is
  why the copy bank is keyed by prop: the prop picks the voice.
- **Joining an overheard conversation is a walk, not a reply — and that is the only reason it is
  allowed to exist.** Slice 23's _Join in_ fires `startTalk` at a `talkTileFor` mark, which is
  what the person card's _Go and talk_ and a double-click already do; the offer carries two seat
  ids and a prop kind and **none of the exchange's text**. Put a line, a quote or an
  `actionPrompt` on it and the exchange has started addressing the user, which makes it a walk-by
  and moves it to the moment store (`officeFloorContracts.test.js` pins the payload). The
  composer opens **empty** on arrival — `handleTalkGreet` is still slice 8's deliberate silence,
  and joining must not become the exception that seeds an opener. Two facts worth reusing: the
  offer must **outlive** its exchange (`armed.done` rather than clearing, or an invitation dies
  seven seconds after it appears), and it is read off the **exchange** so an untranslated locale
  offers nothing rather than inviting you to join two people standing in silence.
- **A verb you pressed can hold somebody in place; a place you are standing cannot.** Joining
  gets `useFloorAway`'s hold for free — `startTalk` sets `activity.talk` immediately and that is
  `holdId`, so the wanderer's dwell clock stops while you cross the room. Slice 19's dwell wanted
  the identical hold and could not have it, because its target is derived from `floorState`, which
  is `useFloorAway`'s output, and `holdId` is its input. The difference is not effort, it is which
  side of that hook the signal starts on — check that before recording another "limitation".
- **`NAME_CHIP_RANGE_TILES` and `EARSHOT_RANGE_TILES` are two rungs of one ladder.** Inside the
  chip range somebody talks _to_ you (slice 19); between there and earshot (3) you overhear two
  others (slice 22); past it the room is quiet. Each rung is defined as **what the one inside it
  is not** — an exchange refuses to exist while you are within a tile of either speaker — and
  that is the only thing stopping a single approach producing a dwell remark _and_ a two-hander
  inside five seconds. The inner bound is measured **per speaker, not to the mark** (the replier
  sits a tile off it, so you can be two tiles from the whiteboard and shoulder to shoulder with
  Jared). Assert any new rung over **every standable tile**, not a sample: what breaks it is a
  layout change. Two traps in doing that — `isStandableTile` takes a **tile object**, not `(x,
y)`, so the obvious sweep silently iterates an empty list; and pacing the exchange through
  `useScenePacing` needs a narrator **wrapper** returning `{spoken:false}`, never `undefined`,
  or every line reveals at once and two balloons land in one square of screen.
- **A sweep over a derived set needs a companion assertion that the set is non-empty.** Slice 22
  shipped two probes that passed while examining nothing — the `isStandableTile` one above, and a
  DOM overlap scan keyed on a class that does not exist (`covers no heads` was true because it
  found no heads). Same family as the `vi.mock` paths that resolve nowhere: green for the wrong
  reason. Pair every loop with a coverage claim, and get one positive hit out of a DOM probe
  before trusting a negative.
- **The glass room is entered through a threshold, and its cast is bigger than its
  commuters.** Slice 27 walks meeting attendees to `MEETING_THRESHOLD_TILES` — a fan of eight
  tiles _outside_ the sealed room — and cuts them into their chairs on arrival; **no geometry
  changed**, `pathCrossesGlass` still refuses every route through the glass. Three facts are
  load-bearing. The **leadership tier can never walk**: they sit inside their own fishbowl, so
  no glass-free route to a threshold exists and they keep appearing in their chair — which is
  why `FloorMeeting` takes `walkingIds` and **not** the `settledIds` its siblings take. Absent-
  from-settled means "still walking" only when the whole cast commutes; here it deletes every
  executive from the meeting. The fan is as long as `MEETING_SEATS` because attendees set off
  together, and it is deliberately **out** of `reservedMarks()` for the reason `HUDDLE_TILES`
  is. And a mark may carry **`arriving`** to opt out of `useFloorCommute`'s first-pass seed:
  calling a physical meeting from your desk stands you up, so the floor mounts on a room that
  has not started, and seeding it teleports everybody into the chairs the slice exists to walk
  them into. An empty `transcript` is the test for "still convening".
- **A moment's cast walks to it and walks home; the desk stays empty for the whole trip.**
  `officeFloorCommute.js` is the pure `out ▸ there ▸ home ▸ gone` machine, `useFloorCommute` holds
  it, and `useFloorAway` merges the commuting ids into `awayIds` — miss that merge and a scene
  ends with people blinking back into their chairs while their own figures are still crossing the
  kitchen. `settledIds` is the hand-off: **exactly one** surface may draw a person (§ 6 rule 5), so
  `FloorScene` / `FloorHuddle` skip anybody who has not arrived, and `null` means "don't ask" for
  standalone mounts. Marks are indexed by the **renderer's** index, never a compacted one, or a
  walker pops to a different tile on arrival. The glass-room meeting is excluded on purpose — its
  chairs are inside sealed glass with no route in.
- **The office never re-renders while you type, and anything showing your work must be
  _sampled_.** `OfficeLayerSlot.jsx` hands `OfficeLayer` the diagram as **getters**
  (`getDiagramSource` / `getContentType`), not props — that is load-bearing, not an accident.
  Slice 16 puts your current slot on your monitor, the whiteboard and the glass-room table
  (`officeFloorBoard.js` → `board` on the floor bridge), and it refreshes on three **edges** via
  `useOfficeBoard`: a completed run (`runSignal`), standing up, a meeting opening. Do **not**
  "fix" it into a `diagramStore` subscription — that repaints sixteen animated figures, a walk
  animation and a directed camera on every keystroke. The constraint is also the better fiction:
  a whiteboard shows what was _drawn_ on it. Two reuse traps it found:
  `getAdvisorVisibleLabels`'s mermaid/infographic branches read the **rendered** SVG filtered by
  viewport intersection (meaningless once the floor covers the canvas), and
  `collectFlowchartParticipantInfo` anchors its definition regex to line start, so it counts
  nodes but cannot name the ones defined mid-line.
- **`officeChromeCopy()` swaps whole bundles, it does not merge** (`office()?.OFFICE_CHROME_COPY
?? OFFICE_CHROME_COPY`), so a key missing from a locale is a **silently dead feature**, not an
  English fallback. en-AU had shipped with no `floor.props.*.details` at all, which hid the
  **Look closer** button entirely in that locale for months. `officeLocale.test.js` now pins the
  prop copy; add a parity assertion there for any new chrome-copy branch a feature depends on.
  `UiLocaleProvider` must call `setActiveOfficeBundle` **during render** (not only in an
  effect) — otherwise a language switch re-renders with fresh `controls` while
  `officeChromeCopy()` still returns the previous language (NameTag "HELLO" stuck in English).
- **`getUiLocaleBundle` has the opposite failure mode — it merges too well, so "untranslated"
  is invisible.** Overrides deep-merge onto English (`deepMergeLocale`), so a key a translator
  never wrote renders in English forever and no key-shape check can see it; only comparing
  **values** finds it. Two corollaries, both of which had shipped: **arrays replace wholesale**,
  so a step added to English is silently missing from every older locale — `controls.prompt
.entryPointers` is what `useEntryDeskFlow` actually walks, so en-AU ran a five-step desk tour
  with no _Precision edits_ beat while EN and zh ran six; and **a dropped `{placeholder}` is
  silent**, because `formatLocale` simply has nothing to substitute (all three locales had lost
  `{userName}` from the welcome mail/IM). `uiLocale.test.js` now pins placeholder parity and
  `entryPointers` id parity for every locale. Related trap when translating: the office zh
  bundles are the **only** ones that had mixed half-width ASCII `,?!:;` with full-width CJK
  punctuation — keep new Chinese copy full-width after a CJK character.
- **The reception language picker is `IntroLocaleToggle` in its `intro` variant, and its labels
  are endonyms on purpose.** First run mounts `FloorArrival`, not `OfficeDirectory` — put the
  strip at the top of the **reception card** (above the name badge), not only on the card-tour
  welcome body. Somebody who cannot read the current UI cannot be asked to open a menu labelled
  in it. `LOCALE_ENDONYMS` lives in the component, never in a copy bundle, for the same reason.
  Reception must wait for **Check in** (no auto-advance): that is the name-badge edit window
  and the TTS cost guardrail. The desk **Language pack** menu keeps the `inline` variant.
- **After presence / TTS / desk-frame edits**, prefer `apps/web/test/officePresence.test.js`,
  `deskOsPresenceStrip.test.jsx`, `deskOsFrameStyles.test.js`, `apps/server/test/officeTts.test.js`,
  `officeRoute.test.js` (or `npm run test:affected`). **After isometric-floor edits**, `npm run
test:floor`; the floor test map is [`docs/agents/isometric-floor-tests.md`](docs/agents/isometric-floor-tests.md).

## Metaphor3D scene gotchas

- **Camera framing is solved against real geometry, not a bounding box.** `sceneFraming.js`
  samples every visible mesh's **vertices** (falling back to box corners only above 512 verts)
  because a `circleGeometry`'s bounding box is a SQUARE — its diagonal corners sit √2 outside a
  ground disc no geometry reaches, and being nearest the camera they win the fit. Measured on the
  city: a footing of radius 24 pushed the camera to 95 units and the subject rendered at 39% of
  the frame. Ambient decoration (birds, pollen, embers, traffic, steam) opts out with
  `userData[FRAME_IGNORE]` — a 3-pixel bird wheeling above the treeline otherwise shrinks the
  whole scene to make room for it. **Any new ambience component must carry that flag**, and any
  new substrate disc must be sized from the content it holds, not padded by a constant.
- **Fog is a fraction of the content radius, never a world distance.** `metaphorAtmosphere.js`
  re-solves the band against the _live_ camera distance, so the same `haze` reads identically on a
  5-item cycle and a 60-node grove. The old absolute `near: 40` sat behind a small scene and in
  front of a large one — that was the reported "trees are too foggy at distance", and it hit
  terrain and city just as hard. A mood preset carries `haze` (0–1); it must not carry near/far.
- **`cylinderGeometry` is already axis-up; `circleGeometry` is not.** Applying the
  `rotation={[-Math.PI / 2, 0, 0]}` idiom (correct for circles/rings/planes) to a cylinder tips it
  onto its side. That shipped in `MachineScene` and every gear, hub, bearing and plinth rendered
  as a dark wedge rolling on edge — and because the spin is `rotation.y`, it read as a modelling
  bug rather than a rotation bug.
- **Labels are decluttered in screen space, so a scene declares priority, not visibility.**
  `ItemLabel` takes `importance` (higher keeps contested space) and `pinned` (never hidden).
  Group names — district / bed / axle / cluster / line / berg — are pinned; item labels rank by
  their own metric. An item with `accent: true` pins its own label automatically through
  `ItemAccentContext`, which is why a scene never threads `pinned` down to fourteen call sites.
- **`accent` is capped at two by the sanitizer on purpose.** It is the scene's thesis marker and
  its label is exempt from decluttering, so an over-marked scene re-creates exactly the smear the
  declutter pass exists to stop. Models over-mark boolean flags reliably; the cap is enforced in
  `metaphorSanitizer.ts`, not trusted to the prompt.
- **The accent marker rides each scene's `anchors` map**, the same one `MetaphorLinks` uses —
  a new scene gets emphasis for free by rendering `<MetaphorAccents items anchors theme />` beside
  its `<MetaphorLinks>`.
- **A subway is lanes, not spokes and not chords.** Two earlier models both died on the
  interchange, which is the only thing the kind exists for: spokes meet only at the hub, and two
  straight chords cross exactly **once** — so a network where two routes share both an Auth stop
  and a Checkout stop pinned both to the same point and collapsed into it. Lanes let routes
  converge, separate, and converge again. Pinned by `metaphorNewKindLayouts.test.js`.
- **The iceberg's submerged blocks must stay opaque.** Three sorts transparent objects by centroid
  distance, so a big submerged block's centroid can sit nearer than the sea plane's centroid at
  the origin — the hidden mass then paints OVER the water and the waterline, the one thing the
  kind exists to show, disappears. Opaque ice draws in the depth-sorted pass; the transparent sea
  (with a high `renderOrder`) blends over it correctly.
- **Adding a metaphor kind touches ten places.** `metaphorSchema.ts` (kind list, item schema,
  union, legend axes, types), `metaphorSanitizer.ts` (caps + clamps), `metaphorUsda.ts`
  (`KIND_ITEM_FIELDS` in `metaphorUsdaFields.ts` — the build fails without it; bump `METAPHOR_USDA_MAPPING_VERSION` and the
  mapping doc for additive fields, then extend the round-trip in `metaphorUsda.test.ts`), a layout
  under `utils/metaphorLayouts/`, a
  scene + sky under `components/metaphorScenes/`, `MetaphorRenderer.jsx` (dispatch, sky, bounds
  margin), `metaphorLegendAxes.js` (legend + tooltip rows), `switchMetaphorKind.js` (magnitude
  mapping + positional normalisation + composite layer label), `compositePrimitiveRegistry.js`,
  and both `metaphorSystemPrompt.js` + `metaphorSyntaxGuard.js`.
- **`shiftColor`'s deltas are perceptual, and that only works because it forces
  sRGB.** `new THREE.Color(hex)` converts to the LINEAR working space, where an
  ordinary mid-tone has HSL lightness ≈ 0.09 — so the ±0.04–0.2 nudges its ~80
  call sites pass went negative and clamped to **pure black**. It shipped that
  way: the bridge's shore slabs and outcrops measured `#020000` on every theme,
  which reads as "the lighting is broken" and sent two separate investigations
  after shadows and hemisphere lights first. `getHSL`/`setHSL` now take
  `THREE.SRGBColorSpace` explicitly; keep it that way, and treat "a dark surface
  renders black" as a colour-space question before a lighting one.
- **A near-black albedo cannot be lit.** PBR multiplies albedo by irradiance, so
  no amount of ambient, hemisphere bounce or key light rescues a `#1d314a`
  surface — measured, it renders `#080810`. When a dark theme's ground reads as
  a silhouette, raise the material rather than the lights.
- **The camera fit is a claim about what the SUBJECT is, and the loudest thing in
  it was invisible.** `MetaphorGroundShadow` is a _catcher_ plane: deliberately
  sized past the subject so the blur has somewhere to fall, and invisible except
  where a shadow lands. Left in the fit it became the binding constraint on
  nearly every grounded kind, so the camera framed a rectangle nobody can see —
  measured, the city needed 44 units for its skyline against 57 for the plane,
  the garden 22 against 30, and the fused composite 20 against 30 (a subject
  38% smaller than it should be). It now carries `FRAME_IGNORE_DATA`, the same
  opt-out the ambience layers use, and `metaphorSceneFraming.test.js` pins it.
  The general rule is wider than ambience: **before adding any mesh, ask whether
  it is the subject or scaffolding for the subject**, and flag the scaffolding.
  Shadow catchers, glow discs and reach-beyond water planes are all scaffolding.
- **Anything sized against the VIEWER must be screen-relative, and this trap has
  now been hit three times.** The fog band learned it (a fraction of content
  radius, not a world distance); the AO radius takes `screenSpaceRadius: true`
  for it; and the accent caption scales by camera distance for it. These scenes
  run from a 14-unit cake to a 60-unit bridge, so one authored world size is a
  banner on the small scene and unreadable type on the large one. If a new
  effect has a "radius" or a "size" and its job is described in terms of what
  the viewer sees, it is screen-relative — pick the reference distance, do not
  pick a world number.
- **The gradient sky writes no depth, so AO thinks the background is an
  occluder.** GTAO's `thickness` is how far behind a sample still counts, and
  the stock 1.0 drew a black halo around every silhouette in the scene — the
  sky is a back-faced sphere and contributes nothing to the depth prepass, so
  the whole background sits at the far plane and reads as "an occluder just
  behind the edge". `aoThickness` is held under `aoRadius` in
  `metaphorThemePresets.js`. Per-theme `aoIntensity` exists for the other half
  of the problem: occlusion spends contrast, and noir/arcade have almost none
  left to spend.
- **IBL is generated from the theme's own sky, not fetched.** `SceneEnvironment.jsx`
  PMREMs a three-stop gradient (zenith → horizon → ground) out of the colours
  the theme already paints, replacing the two `<Environment preset>` HDR fetches
  that only noir and arcade ever had. Two consequences worth keeping: there is
  no CDN dependency inside the renderer, and whiteboard/blueprint now have an
  environment at all — before this, `metalness` and `roughness` did almost
  nothing on those themes because there was nothing to reflect, which is why
  every surface resolved to flat plastic no matter what its material said.
- **The accent callout is depth-test-free on purpose, and that is not laziness.**
  An anchor is "the world point at the top of the thing", but several scenes keep
  drawing above their own anchor — a city building stacks a roof, a spire and a
  rooftop glyph over its — so the marker rendered _inside_ the spire of the tower
  it was marking. Chasing that with a taller stem only moves the problem to the
  next kind. The stem, pin and caption are an annotation about the scene rather
  than objects within it, so they draw over it; only the ground ring stays
  depth-tested, because it is a decal on the item and should vanish with it.
- **The accented item's `note` is now permanent scene copy, not a hover string.**
  `MetaphorAccents` prints it as a caption on the pin, so `accent: true` without
  a `note` throws away half the marker. The prompt says so; if you change one
  side, change `metaphorSystemPrompt.js` too.
- **A composite's shared grouping nouns are the thing it is for, and they used to
  render as anonymous circles.** Aligning `district`/`chain`/`bed` strings across
  layers is the one instruction the fused planner asks the author to follow, and
  `AffinityGroups` drew the result as unlabelled rings on the floor. They now
  carry a placard. Note the planner keeps two strings per group: `label` is the
  normalized matching token (lowercased, filler words stripped, so "Checkout
  domain" binds to "Checkout") and `display` is the first raw value seen — the
  placard must show `display`, or the world rewrites the user's own noun.
- **`FusedCompositeScene` is not exempt from the shared chrome.** It shipped
  without `MetaphorAccents`, so a composite was the one kind that could state a
  thesis in its DSL and silently drop it; the planner's `anchors` map was
  already exactly the contract that component reads. When a base kind grows a
  scene-wide affordance, check the fused scene for it — it does not inherit.
- **Hover is a mouse affordance; a phone needs a tap, and the two must never both
  answer.** A touch "hover" is pointerover→pointerout inside one tap, so the tooltip flashed
  once _under the finger_ and died — which meant a phone had no route at all to an item's
  encoded metrics, i.e. to most of what makes a scene mean anything. `metaphorSelection.js` is
  the touch answer: a sticky pick, a panel anchored to the canvas rather than to the pointer,
  and `MetaphorSelectionMarker` in-canvas so the card is not disconnected copy. Four things are
  load-bearing. **Do not use R3F's `onClick`** — the canvas is one DOM element, so an orbit
  drag that starts and ends inside it still fires a DOM click and the scene selects whatever
  the finger stopped over; `createTapGesture` (down/up within `TAP_SLOP_PX`) is the gesture the
  viewer means. `onPointerMissed` **is** safe for clear-on-empty-space — R3F gates it on a 2px
  `initialClick` delta, so ending an orbit over open sky never clears what you were reading.
  The **one-panel budget** (an open pick hides the legend, the layer key and the tooltip) is a
  general-sibling rule in CSS, not React state, which is why the inspector must render **first**
  among the overlay siblings in `MetaphorRenderer` — moving it later silently kills the
  exclusion and a phone goes back to three cards over one small canvas. And the marker is sized
  from the item's **horizontal footprint with labels excluded**: a bounding sphere around an
  18-unit tower is a hoop around the whole skyline (measured — it read as a rendering bug), and
  a one-word name is a ~7-unit plate that doubles a 3-unit tower's apparent width.
- **The guided read is the scene explaining itself, and its three rules are all
  about not lying.** `metaphorTour.js` orders what the DSL already says — title,
  legend phrases, the extreme item, a labelled link, the accent note — into the
  sequence a person would narrate. **The thesis goes last** (leading with the
  conclusion means the viewer reads it before the encoding it rests on); **a
  composite is narrated layer by layer** rather than by a global peak, because
  an island's `mass` against a tower's `height` is two scales wearing one word;
  and **a beat with no author text is dropped, never padded** — one "How to read
  it: (nothing)" teaches the viewer the whole read is noise. `METAPHOR_PRIMARY_METRIC`
  is the axis each grammar is actually _drawn_ large in (city = height, river =
  flow — not `stage`, which is an ordering, so its maximum is just "the last
  one"); `composite` is deliberately absent from it.
- **A camera framing multiplier is a claim about the viewport, not about the
  item — this is the fourth time that trap has been hit here.** (Fog band, AO
  radius, accent caption, now the tour flight.) `MetaphorTourCamera` solves the
  distance against **both** half-angles — `radius / min(tanV, tanH)` — because a
  phone canvas is ~0.46 aspect and its horizontal half-angle is less than half
  its vertical one: measured, a fixed multiple that framed a tower perfectly on
  a desktop ran it off both sides of a portrait screen. Two more facts it
  encodes: it keeps the **viewer's own viewing angle** (only distance and
  look-at move — yanking the azimuth on every Next throws away the angle they
  chose by orbiting), and on portrait it drops the look-at **below** the item,
  because whatever sits at the target lands at screen centre and the read is a
  bottom sheet covering the lower third.
- **A short-and-wide screen is not covered by the 500px cover query, and the
  twelve pixels are not a real boundary.** A 717x512 foldable cover misses
  `(max-width: 1024px) and (max-height: 500px)` and therefore inherits the phone
  block's full-width bottom sheet — measured, the read's Back/Next landed below
  the fold on the one control the feature depends on. The tour uses a wider net
  (`(max-height: 620px) and (orientation: landscape)`) **and** a `position:
sticky` nav row, because the height cap makes every small screen a scrolling
  panel. Pinned by `metaphorOverlayStyles.test.js`.
- **Item world measurement is one module, shared, or a ring and a framing
  disagree.** `metaphorScenes/itemBounds.js` prunes `FRAME_IGNORE` subtrees and
  troika text (a one-word label is a ~7-unit plate over a 3-unit tower), and
  returns **both** a base offset + horizontal radius (what the selection ring
  needs) and a centre offset + bounding radius (what the camera needs). Aiming a
  camera at an item's anchor puts a city tower's whole body below the frame.
- **The camera frames the scene into what the PANELS leave, not into the canvas.** The overlays
  are HTML siblings of the `<Canvas>`, so for a long time the fit solved against the whole canvas
  rect and then had a title strip drawn across the top of the answer. That is invisible on a wide
  desktop scene with room to spare and ruinous everywhere else: on a 390x844 phone the reading
  strip is a fifth of the screen, and the part of a tall subject it covers — the iceberg's
  above-water blocks, a city's tallest tower — is the part the metaphor exists to show.
  `overlaySafeArea.js` measures the **persistent** chrome (`[data-metaphor-chrome]`: the reading
  strip, title card, legend, layer key, kind switcher) and `solveFrameFit` reserves those edges.
  Four rules are load-bearing. **One edge per panel**, nearest, ties to the horizontal — a corner
  card is not a frame and reserving both its edges pays for it twice. **A corner card costs less
  than a band**: the claim scales with how much of the perpendicular axis the panel spans, because
  a scene can lean away from a card and cannot lean away from a strip. **The transient panels are
  excluded** — the read and the pick are user-raised and already own the screen through the
  one-panel CSS rule, so refitting when one opens would slide the scene sideways at the moment the
  viewer is reading about one item. And the **margin is applied inside** `solveFrameFit`, not by
  the caller: the off-centre shift is proportional to the final distance, so multiplying afterwards
  slides the subject straight back under the chrome by exactly the margin. Adding a persistent
  panel means tagging it; `metaphorOverlays.test.jsx` pins the tagging panel by panel, because a
  sweep over a set nothing joins passes while examining nothing.
- **A portrait canvas is looked at from higher up.** Almost every kind here is a wide flat world,
  and from the desktop three-quarter angle its footprint projects to under half its width in
  height — right in a landscape frame, wasteful in a portrait one (measured: the fused composite
  left 46% of a phone canvas empty above and below a width-bound world). `frameDirectionForAspect`
  lifts the elevation toward 52° as the aspect falls, and **touches only elevation** — the diagonal
  azimuth is what makes these read as built rather than plotted. It applies to the FIRST fit only,
  and a resize re-opens the question **only while the viewer has not orbited**: OrbitControls'
  `start` event fires on input and not on the intro's programmatic auto-rotate, which is exactly
  the difference between "nobody has chosen an angle" and "this is the angle they chose". A
  foldable opening from a cover to an inner screen is a resize nobody asked for.
- **Item labels are sized for the reader, not for the camera — the fifth time that rule has been
  paid for here.** `metaphorScreenScale.js` converts exactly: at distance `d`, one screen pixel
  spans `2·d·tan(fov/2) / viewportHeightPx` world units. Before it, a near label rendered ~3x a far
  one in the same scene (measured on the fused composite: 26 px against 9 px of cap height), which
  reads as a rendering fault rather than as perspective, and the far half of every phone scene fell
  under the size anyone can read. Two traps in doing this. **Keep the clamps pathological** — an
  earlier 0.35 floor pinned a 14-unit layercake to the bottom of the range and threw the
  conversion away on exactly the small scenes it mattered most on. And the declutter pass must be
  told the **pixel** box (`screenWidthPx`/`screenHeightPx`), never left to project the authored
  world size, which now reaches the screen unscaled at exactly one camera distance.
- **A screen-constant label makes the camera fit a fixed point, so the fit iterates.** The first
  solve measures labels at the _pre-fit_ distance; on a scene the fit pulls back from, every name
  then grows and the outermost ones hang off the edge of the frame the solve just chose.
  `SceneFrame` re-solves until the distance stops moving (≤1%, at most four passes); with no
  chrome and no labels the second pass agrees immediately and it costs one frame.
- **The accent caption has to CLAIM its box, not merely be drawn over everything.** It is
  depth-test-free by design (the accented item is often the buried one), which meant item labels
  knew nothing about it and landed underneath — measured on the city, the caption covered both
  "API Gateway" and the tower beside it. It now registers with the declutter store as a pinned,
  high-importance entry, so the labels around it step aside instead.
- **A group's name must not be drawn where its own members stand.** Three separate versions of one
  bug. City district placards sat on the patch's FAR edge, so from the default (+x, +y, +z) view
  every district name — the only thing naming what the legend calls the district axis — was behind
  its own towers and read as "the model did not label them". A fused composite's affinity ring is
  drawn on the ocean, which its islands then sit **on top of**, placard included; groups now carry
  `surfaceY` so the placard stands on the ground it covers. And an island's own label sat dead
  centre, which is precisely where its landmarks are planted. The fix that holds is **outward from
  the world centre** (`assignSiteLabelOffsets`): a fixed near corner only changes which islands
  lose, because attachment offsets are seeded, and "away from the landmarks" in world space is
  often "behind them" in screen space. Outside the outermost sites is reliably open ground.
- **A territory named after one of its own members gets no placard.** When an island's label and a
  tower's `district` are the same noun — which is exactly what the composite prompt asks authors to
  do — the group and the island name the same thing, and drawing both puts the same word twice
  within a few pixels. `namedByMember` on the plan suppresses the duplicate; a shared chain nobody
  is named after still earns its placard.
- **Open water reaching past the subject is scaffolding.** The iceberg's sea plane runs 1.22x the
  berg ring and was the binding constraint on every iceberg — measured, the bergs rendered at 43%
  of the frame height with the tip pushed under the reading strip. It now carries
  `FRAME_IGNORE_DATA`, like the ground-shadow catcher and the fused ocean disc.
- **Verify metaphor changes by rendering them.** The scoped skill under
  `apps/web/.claude/skills/verify/` has the headless-capture recipe; every finding above came from
  a screenshot, not from reading the code.

## File-size budgets (work in progress)

Files above ~800 LOC are slated for splits per [ADR-0005](docs/decisions/0005-monolith-splits.md). If you need to make a change in one of these, prefer extracting the slice you touch into a sibling module rather than growing the monolith:

- `apps/web/src/ArchiSlop.jsx` (~949 LOC; entry split to `App.jsx` + feature hooks under `hooks/`, `features/insights/*`, `features/streaming/*`, `features/canvas/*`, `features/session/*`, `features/prompt/*`, `features/shell/*`, `features/ceremony/*`, `features/advisor/*`, `features/desk/*`, `components/buildRadialActions` — see [`docs/decisions/0005-monolith-splits.md`](docs/decisions/0005-monolith-splits.md)), `apps/server/src/mcp/mcpServer.js` (~1410; helpers + first `tools/register*` modules extracted — continue per-tool splits), `apps/server/src/agents/mermaidLangChainAgent.js` (~1350), `apps/web/src/components/InsightsPane.jsx` (~1500), `apps/web/src/components/DiagramCanvas.jsx` (~1376), `apps/web/src/components/RadialActionMenu.jsx` (~900), `apps/server/src/agents/infographicLangChainAgent.js` (~875), `apps/server/src/routes/copilot.ts` (~862), `apps/web/src/state/diagramStore.js` (~795). Future per-tool splits in `mcpServer.js` should follow the same pattern: extract closure helpers into a sibling module and add a `register{ToolName}(server, ctx)` file under `apps/server/src/mcp/tools/`.

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

Non-functional work — post-merge review, doc drift, test hardening — runs on a schedule as
**NFR routines** ([ADR-0014](docs/decisions/0014-autonomous-nfr-routines.md)). Four facts matter
when you touch one, and each is a trap if you assume the obvious:

- **The playbook is the repo file, not the cron prompt.** `docs/routines/<name>.md` holds what the
  routine does and its budget; the trigger prompt is three lines pointing at it. Pasting
  instructions into a trigger recreates the unversioned, unreviewable blob this shelf replaced.
- **The budget is enforced, not described.** `npm run routine:guard -- --postflight <name>` re-reads
  the playbook's `maxFiles` / `allowedPaths` / `forbiddenPaths` and checks the real diff, plus an
  always-forbidden list mirroring the don't-touch list, deleted test files, and any test file whose
  case count fell. Widening a routine means editing its frontmatter, in a PR.
- **`npm run verify:ratchet` binds every PR, not only routine PRs.** It runs inside `npm run check`.
  Monolith LOC and lint warnings may only fall; strict-island and suite counts may only rise.
  Budgets live in `docs/agents/ratchet.json`. To loosen one, raise it **in the same PR** and add a
  `reason` — a budget differing from its `initial` without one is itself a failure, which is what
  stops the ratchet being unwound to make a red build green. Lint counting is behind `--with-lint`
  (an extra ESLint pass on every `check` costs more than it returns).
- **A routine records; it does not refactor.** `docs/agents/balanced-coupling-priorities.md` says
  split _on contact_, and a schedule has no feature to be on contact with — so coupling findings
  become issues and priority-doc updates, never unprompted hub splits. Same reason ADR-0007's
  two-week quiet period still gates every `warn` → `error` promotion: a routine may present the
  evidence, a human decides.

Ledgers under `docs/routines/ledger/` are the durable memory across cold-start runs — read one
before starting, append a row when finishing, including runs that changed nothing.

## Agent skills

### Issue tracker

Issues live on GitHub (**acuhlmann/mermaid-gen**); use `gh` for create/list/comment/label. See [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).

### Triage labels

Five canonical triage roles map 1:1 to GitHub label names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

### Domain docs

Single-context monorepo: read `GLOSSARY.md`, `STRUCTURE.md`, and ADRs under `docs/decisions/` (optional `CONTEXT.md` when present). See [`docs/agents/domain.md`](docs/agents/domain.md).

### Sensors (lint, dep-cruiser, formatter footer)

Every static check hands you the canonical fix in its output. ESLint warnings carry an "Agent guidance" footer; dependency-cruiser rules carry it in the `comment` field. Suppress with `// eslint-disable-next-line <rule> -- (reason: ...)`. See [`docs/agents/sensors.md`](docs/agents/sensors.md) and ADR-0007.

**A `vi.mock` path that resolves nowhere fails silently** — vitest does not raise, the real module runs, and the suite passes for the wrong reason. `apps/web/test/viMockPathsResolve.test.js` is the sensor; it prints the offending `file:line -> specifier`. Two things to know before you "fix" one. **Check what the mock was doing first**: one that has never executed is not load-bearing, so deleting it is a zero-behaviour-change edit while repairing it is a real change — in `useOfficeRunReactions.test.js` the suite had come to depend on the unmocked modules, and making the mocks live would have stubbed out the request its tests assert on. And **a `.js` specifier pointing at a `.ts` file is not an instance of this** — that is the ordinary TypeScript convention Vite resolves, so any checker for the class must map `.js` → `.ts`/`.tsx` or it flags every leaf converted by [`convert-js-leaf-to-ts.md`](docs/recipes/convert-js-leaf-to-ts.md).

**In a hook test, `rerender(...)` and `advanceTimersByTimeAsync(...)` belong in two separate `act` blocks.** The effect that schedules a timer flushes when the act scope closes, so advancing the clock in the same block advances it _before_ the timer exists and the callback never fires — measured in `useOfficeRunReactions.test.js`: one block leaves `fetch` on zero calls, two land exactly one. A test written the one-block way passes while exercising nothing, which is why "does not throw" is a dangerous shape for an async assertion.

### Modularity reviews

For semantic coupling analysis (not automatable), run `/modularity:review` in Claude Code (install once: `/plugin marketplace add vladikk/modularity`). Cursor reads the mirrored skill under `.cursor/skills/modularity/`. See [`docs/agents/modularity.md`](docs/agents/modularity.md).

## Pointers

- Architecture maps: [`docs/guide/system-overview.md`](docs/guide/system-overview.md), [`docs/architecture-generative-ui.md`](docs/architecture-generative-ui.md)
- Operator manual: [`AGENTS.md`](AGENTS.md)
- Concept→file index: [`STRUCTURE.md`](STRUCTURE.md)
- Terms: [`GLOSSARY.md`](GLOSSARY.md)
- Recurring tasks: [`docs/recipes/`](docs/recipes/)
- Canvas graph-edit families: [`docs/canvas-graph-edit.md`](docs/canvas-graph-edit.md)
- Past decisions: [`docs/decisions/`](docs/decisions/)
- Office continuity (working memory + runWalk, not shipped): [`docs/office-continuity.md`](docs/office-continuity.md)
- LLM config: [`docs/llm-config.md`](docs/llm-config.md)
- Deploy: [`docs/deploy/gcp.md`](docs/deploy/gcp.md) — Artifact Registry retention: `npm run ar:cleanup:verify` (policy in `scripts/artifact-registry-cleanup-policy.json`; apply with `npm run ar:cleanup:apply`)
