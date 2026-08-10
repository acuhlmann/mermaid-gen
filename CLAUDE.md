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

**Forms** (1 deterministic gate + syntax fixer ladder + agent repair, no sanitizer): the slot content is **model-authored** A2UI v0.9 JSON. `parseFormsA2ui` (`packages/shared/src/formsA2ui.ts`) is the whole trust boundary — `JSON.parse` → wrapper shape → `basicCatalog` component allowlist → action allowlist (Button actions must be `{event:{name}}`, never `functionCall`; all names collapse to one client capability, "generate the next form"; no `checks` on a Button, since a failing check disables the only escape hatch) → `surfaceId`/`catalogId` normalization → size/component/message caps + "≥1 input, ≥1 Button". Forms lean on A2UI's pure/local client functions to make fields cross-reference each other live (`formatString` `${/path}` echoes in `Text`; `checks` on inputs that watch other fields) and to visualize the subject (emoji stamps + a hero-stat `Card`; the named `Icon` component is avoided — no Material icon font ships, so it renders as raw text); the Thinking pane renders the slot read-only via `InsightsEmbeddedDiagram`'s `forms` branch (`FormsRenderer` `preview` prop). Server gate: `validateAndPrepareFormsPatch` (`apps/server/src/tools/formsA2uiTool.js`) — no A2UI runtime on the server (that would pull `@a2ui/web_core` into the backend); the client's `MessageProcessor` in `FormsRenderer.jsx` is the render-time check. Mutations arrive via `apply_forms_patch`; on allowlist failure the **syntax fixer ladder** (`formsSyntaxFixer.js`, lite → flash → DeepSeek) runs before full-agent repair turns (bounded by `FORMS_REPAIR_MAX_ATTEMPTS`). This is the deliberate opposite of the critique checklist (server-built A2UI from Markdown) — see [`docs/architecture-a2ui.md`](docs/architecture-a2ui.md).

## Canonical commands

| Goal                                   | Command                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Run web + server together              | `npm run dev`                                                                                              |
| Run all tests                          | `npm test`                                                                                                 |
| **Diff-scoped tests (agents)**         | `npm run test:affected` (basename + blast-radius map; skips slow Anything unless diff touches `anything*`) |
| **Verify (diff-scoped, agents)**       | `npm run check:affected` (includes Prettier on changed files)                                              |
| **Verify a change end-to-end**         | `npm run check` (typecheck + typecheck:strict + lint + test + wire)                                        |
| Shared-only / schema touch             | `npm run check:fast`                                                                                       |
| Before PR / local CI parity            | `npm run check:full` (`check` + build); GitHub CI parallels the same coverage                              |
| Wire + doc paths only                  | `npm run check:wire`                                                                                       |
| Blast-radius map                       | [`docs/agent-blast-radius.md`](docs/agent-blast-radius.md)                                                 |
| Format the diff you're about to commit | `npm run format:affected` (agents); `npm run format` for whole repo                                        |
| Build all workspaces                   | `npm run build`                                                                                            |
| Health probe                           | `curl http://localhost:\$PORT/api/health`                                                                  |
| Mermaid offline bench                  | `node apps/server/scripts/benchMermaid.js --tag <label>`                                                   |
| Anything offline bench                 | `node apps/server/scripts/benchAnything.js --tag <label>`                                                  |
| Regenerate **one** baked audio asset   | `./scripts/generate-office-audio.sh <name>` — bare = whole manifest, 900 credits, overwrites everything    |
| Check the committed audio bank         | `./scripts/generate-office-audio.sh --verify` (free, no key, no network)                                   |

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

## File-size budgets (work in progress)

Files above ~800 LOC are slated for splits per [ADR-0005](docs/decisions/0005-monolith-splits.md). If you need to make a change in one of these, prefer extracting the slice you touch into a sibling module rather than growing the monolith:

- `apps/web/src/ArchiSlop.jsx` (~949 LOC; entry split to `App.jsx` + feature hooks under `hooks/`, `features/insights/*`, `features/streaming/*`, `features/canvas/*`, `features/session/*`, `features/prompt/*`, `features/shell/*`, `features/ceremony/*`, `features/advisor/*`, `features/desk/*`, `components/buildRadialActions` — see [`docs/decisions/0005-monolith-splits.md`](docs/decisions/0005-monolith-splits.md)), `apps/server/src/mcp/mcpServer.js` (~1410; helpers + first `tools/register*` modules extracted — continue per-tool splits), `apps/server/src/agents/mermaidLangChainAgent.js` (~1350), `apps/web/src/components/InsightsPane.jsx` (~1500), `apps/web/src/components/DiagramCanvas.jsx` (~1376), `apps/web/src/components/RadialActionMenu.jsx` (~900), `apps/server/src/agents/infographicLangChainAgent.js` (~875), `apps/server/src/routes/copilot.ts` (~862), `apps/web/src/state/diagramStore.js` (~795). Future per-tool splits in `mcpServer.js` should follow the same pattern: extract closure helpers into a sibling module and add a `register{ToolName}(server, ctx)` file under `apps/server/src/mcp/tools/`.

## When you touch wire contracts

If you change an HTTP route, AG-UI event, MCP tool, or schema, update **all four** of:

1. The producing code (route / agent / tool).
2. The consumer (web client store, MCP client, or App HTML bridge).
3. The Zod schema in `packages/shared/src/diagramSchema.ts` if shape changes.
4. The corresponding guide under [`docs/guide/`](docs/guide/) or the relevant `docs/architecture-*.md` (hub: [`README.md`](README.md)).

See [`docs/recipes/`](docs/recipes/) for templates of recurring changes (new MCP tool, new rule pack, new intent variant, new stream event).

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

## Agent skills

### Issue tracker

Issues live on GitHub (**acuhlmann/mermaid-gen**); use `gh` for create/list/comment/label. See [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).

### Triage labels

Five canonical triage roles map 1:1 to GitHub label names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

### Domain docs

Single-context monorepo: read `GLOSSARY.md`, `STRUCTURE.md`, and ADRs under `docs/decisions/` (optional `CONTEXT.md` when present). See [`docs/agents/domain.md`](docs/agents/domain.md).

### Sensors (lint, dep-cruiser, formatter footer)

Every static check hands you the canonical fix in its output. ESLint warnings carry an "Agent guidance" footer; dependency-cruiser rules carry it in the `comment` field. Suppress with `// eslint-disable-next-line <rule> -- (reason: ...)`. See [`docs/agents/sensors.md`](docs/agents/sensors.md) and ADR-0007.

### Modularity reviews

For semantic coupling analysis (not automatable), run `/modularity:review` in Claude Code (install once: `/plugin marketplace add vladikk/modularity`). Cursor reads the mirrored skill under `.cursor/skills/modularity/`. See [`docs/agents/modularity.md`](docs/agents/modularity.md).

## Pointers

- Architecture maps: [`docs/guide/system-overview.md`](docs/guide/system-overview.md), [`docs/architecture-generative-ui.md`](docs/architecture-generative-ui.md)
- Operator manual: [`AGENTS.md`](AGENTS.md)
- Concept→file index: [`STRUCTURE.md`](STRUCTURE.md)
- Terms: [`GLOSSARY.md`](GLOSSARY.md)
- Recurring tasks: [`docs/recipes/`](docs/recipes/)
- Past decisions: [`docs/decisions/`](docs/decisions/)
- LLM config: [`docs/llm-config.md`](docs/llm-config.md)
- Deploy: [`docs/deploy/gcp.md`](docs/deploy/gcp.md) — Artifact Registry retention: `npm run ar:cleanup:verify` (policy in `scripts/artifact-registry-cleanup-policy.json`; apply with `npm run ar:cleanup:apply`)
