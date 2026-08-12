# AGENTS.md

This file is a quick operator manual for coding agents working in this repository (Cursor, Claude Code, Copilot, cloud agents).

Domain depth (slots, validation ladders, wire-contract habits, where-to-put table) lives in [`CLAUDE.md`](CLAUDE.md). **Keep operational tips in both files** — don't-touch paths, regenerate commands, verify loops, safety rules. When you learn something durable while coding, update this file _and_ `CLAUDE.md` if another agent would miss it by reading only one.

## Project at a glance

- Monorepo name: `archislop` (directory and GitHub repo still `mermaid-gen` for legacy reasons)
- Package manager: `npm` with workspaces
- Runtime stack:
  - `apps/web`: React + Vite + CopilotKit UI
  - `apps/server`: Express + CopilotKit runtime endpoints
  - `packages/shared`: shared schemas/patch logic

## First things to check

1. Read [`docs/guide/coding-agents.md`](docs/guide/coding-agents.md) (agent read order, verification table, PR checklist).
2. Read `README.md` (hub) and [`docs/guide/quick-start.md`](docs/guide/quick-start.md) for setup flow.
3. Confirm environment exists: `.env` (copy from `.env.example` if missing).
4. Prefer workspace scripts from root unless debugging one package.

## Useful commands

- Install deps + skills + Cloud SDK (when missing): `npm run setup`
- Google Cloud CLI only: `npm run setup:gcloud` (see `scripts/setup-gcloud.sh`; uses `GOOGLE_APPLICATION_CREDENTIALS` or `GCP_MERMAID_GEN` key path for service-account auth when set)
- Refresh skills only: `npm run setup:skills`
- Run web + server together: `npm run dev`
- Run all tests: `npm test`
- Build all packages: `npm run build`
- Regenerate baked office audio: **always name the asset** — `./scripts/generate-office-audio.sh cue-laugh`. Bare (no name) regenerates the entire manifest: 900 credits and every committed `.mp3` overwritten. `--dry-run` prices it first; `--verify` re-checks the installed bank for free (no API key, no network) and is what runs automatically after each generate. See [`docs/audio-assets.md`](docs/audio-assets.md)
- **Verify after edits** (pick the smallest loop that fits):
  - `npm run check:affected` — diff-scoped sensors (includes Prettier on changed files; **verify:boundaries** when `apps/web` changes; **test:affected** when `apps/server` or `apps/web` changes; matches what agents should run before push)
  - `npm run test:affected` — diff-scoped tests only (basename mirror + blast-radius rules; skips slow Anything child-process suite unless the diff touches `anything*`)
  - `npm run precommit` — **run before every cloud-agent commit** (`format:affected` + `check:affected`; Husky does not run in cloud VMs); then `git add -A` to re-stage Prettier fixes on new files
  - `npm run format:affected` — write Prettier fixes on changed + untracked files (included in `precommit`)
  - `npm run format` / `npm run format:check` — Prettier write / verify whole repo (CI runs `format:check`; pre-commit auto-formats staged files). Text is LF via `.gitattributes`; Windows CRLF working trees — see [`docs/agents/sensors.md`](docs/agents/sensors.md) § Line endings
  - `npm run check:fast` — shared package only (schemas, sanitizers, wire constants)
  - `npm run check` — typecheck + lint + test all workspaces (wire files via `npm test`) + doc-paths
  - `npm run check:full` — local full gate (`check` + build); GitHub CI runs the same coverage as parallel jobs
  - `npm run check:wire` — doc path verify + wire round-trip tests only (shared, server, web)
  - `npm run typecheck:strict` — strict TS on server wire-route modules (`copilotRouteTypes`, stream helpers)
  - `npm run verify:doc-paths` — operator-doc links to `apps/`, `packages/`, and `scripts/` paths (`STRUCTURE.md`, `AGENTS.md`, `CLAUDE.md`, `docs/recipes/`, `docs/guide/`, `docs/agents/`)
  - `npm run verify:deps` — override pins and singleton npm installs (e.g. `@a2ui/web_core` hoisted vs nested); error output includes the `npm install` fix
  - `npm run verify:boundaries` — dependency-cruiser graph rules (cycles + workspace + intra-server layers); each rule's `comment` is the agent-readable fix
  - `npm run lint` — all three workspaces, formatter appends per-rule "Agent guidance" footer with the canonical fix and suppression syntax (`packages/eslint-config/formatter.cjs`)
  - `npm run verify:modularity` — reminder of how to run a semantic modularity review (Claude `/modularity:review` or Cursor `.cursor/skills/modularity/review/SKILL.md`); see [`docs/agents/modularity.md`](docs/agents/modularity.md)
- **Workspace-scoped** (faster when you know the blast radius):
  - `npm run typecheck -w apps/server && npm run test -w apps/server`
  - `npm run typecheck -w apps/web && npm run test -w apps/web`
  - `npm run typecheck -w packages/shared && npm run test -w packages/shared`

Package-specific commands:

- Server dev: `npm run dev -w apps/server`
- Web dev: `npm run dev -w apps/web`

## Operator CLIs

Agents often have **`gcloud`** and **`gh`** available in the terminal. Use them to inspect real account state instead of guessing projects, billing, or Git refs.

### `gcloud` (Google Cloud)

Use for **estate discovery** and deploy operations: projects, billing attachment, enabled APIs, Artifact Registry, Cloud Run services/revisions, IAM, and logs.

Examples:

- `gcloud projects list`
- `gcloud billing projects describe PROJECT_ID`
- `gcloud run services list --region=REGION`
- `gcloud logging read 'resource.type="cloud_run_revision"' --limit=20 --freshness=1h`
- Artifact Registry retention: `npm run ar:cleanup:verify` (policy in `scripts/artifact-registry-cleanup-policy.json`; apply with `npm run ar:cleanup:apply`)

### `gh` (GitHub CLI)

Use for **repo and release inspection**: tags, releases, Actions, PRs.

Examples for this repository:

- `gh release list -R acuhlmann/mermaid-gen --limit 5`
- `gh api repos/acuhlmann/mermaid-gen/actions/runs --jq '.workflow_runs[:5] | .[] | {name,conclusion,head_branch}'`

### Public deployment (GCP)

Production deploy notes (Cloud Run, billing credits, GitHub Actions CI, optional load balancer) live in [`docs/deploy/gcp.md`](docs/deploy/gcp.md).

## Key code locations

- Server entrypoint: `apps/server/src/index.js` (mounts `/api/copilotkit`, `/mcp`, CopilotKit handler)
- Copilot + collaboration routes: `apps/server/src/routes/copilot.ts` (intent/transform/analyze, invite, session-events, handshakes, proposals)
- MCP server + tools: `apps/server/src/mcp/mcpServer.js`; MCP App HTML: `apps/server/src/mcp/apps/`
- Mermaid validation helper: `apps/server/src/tools/mermaidDiffTool.js`
- Shared exports/schemas: `packages/shared/src/`
- Web app entry/UI: `apps/web/src/`
- Session event bus: `apps/server/src/state/sessionEventBus.ts`; web client: `apps/web/src/state/sessionEventsClient.js`

## Architecture docs (read before changing wire contracts)

| Doc                                                                            | Topic                                                            |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [`docs/architecture-generative-ui.md`](docs/architecture-generative-ui.md)     | **AG-UI + A2UI + MCP Apps map**, MCP connectivity, host matrix   |
| [`docs/architecture-external-agents.md`](docs/architecture-external-agents.md) | MCP join, handshakes, proposals, MCP Apps, session-events        |
| [`docs/architecture-ag-ui.md`](docs/architecture-ag-ui.md)                     | AG-UI SSE for built-in `agent-stream`                            |
| [`docs/architecture-a2ui.md`](docs/architecture-a2ui.md)                       | A2UI critique `CUSTOM` on AG-UI streams                          |
| [`docs/agent-blast-radius.md`](docs/agent-blast-radius.md)                     | **Impact map** — if you change X, also change Y (wire contracts) |
| [`README.md`](README.md)                                                       | Human-facing hub (links to guides below)                         |
| [`docs/guide/README.md`](docs/guide/README.md)                                 | Split human guides: setup, agents, MCP, API, config              |
| [`docs/guide/coding-agents.md`](docs/guide/coding-agents.md)                   | Agent onboarding: read order, verification table, PR checklist   |
| [`docs/agents/sensors.md`](docs/agents/sensors.md)                             | Lint, dep-cruiser, verify:deps — how to read sensor output       |

## Documentation map

| Audience                                  | Start here                                                                                                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Humans** (setup, product, API)          | [`README.md`](README.md) → [`docs/guide/README.md`](docs/guide/README.md)                                                                                       |
| **Coding agents** (edits, wire contracts) | [`docs/guide/coding-agents.md`](docs/guide/coding-agents.md) → [`GLOSSARY.md`](GLOSSARY.md) → [`STRUCTURE.md`](STRUCTURE.md) → [`docs/recipes/`](docs/recipes/) |
| **Sensors** (lint / boundaries / deps)    | [`docs/agents/sensors.md`](docs/agents/sensors.md) — canonical fix lives in the tool output                                                                     |

## CopilotKit skill note

- You have access to the CopilotKit skill set in the local `.agents/` folder.
- `.agents/` is intentionally git-ignored; do not commit it.
- If skill files appear stale or missing, run `npm run setup:skills`.

## Environment and integration notes

- Health endpoint: `GET /api/health`
- Built-in agents + collaboration: `/api/copilotkit/*` (including `session-events` SSE)
- External agents: `POST/GET /mcp` (Streamable HTTP); set `PUBLIC_BASE_URL` and production `INVITE_TOKEN_SECRET` for invite URLs; optional `ARCHISLOP_WEB_URL` when UI and API origins differ
- Never commit `.env` or secrets.
- **Set-piece cast members walk to their marks and walk home.** The state machine is pure in
  `apps/web/src/utils/officeFloorCommute.js`; `useFloorAway` merges anybody mid-trip into
  `awayIds` so their desk stays empty until they are genuinely back, and `settledIds` decides
  which of two surfaces draws them. Under `prefers-reduced-motion` (and in jsdom) the walk
  settles instantly, which is the old teleport — so a green test suite proves nothing here.
- **The office layer never re-renders while you type.** `OfficeLayerSlot.jsx` passes the diagram
  to `OfficeLayer` as **getters** (`getDiagramSource` / `getContentType`), deliberately. Anything
  on the isometric floor that reflects your work — your monitor, the whiteboard, the glass-room
  table (`utils/officeFloorBoard.js`, `hooks/useOfficeBoard.js`) — is **sampled** on an edge (a
  completed run, standing up, a meeting opening) and must not be converted into a `diagramStore`
  subscription: that repaints sixteen animated figures and a directed camera per keystroke. See
  `CLAUDE.md` § Office layer gotchas.
- **Locale copy does not fall back.** `officeChromeCopy()` swaps whole bundles rather than
  merging, so a key missing from `i18n/locales/office.*.js` is a feature that silently does not
  exist in that locale. Add a parity assertion in `apps/web/test/officeLocale.test.js` for any
  chrome-copy branch a feature depends on. `UiLocaleProvider` must sync
  `setActiveOfficeBundle` **during render** (not only in an effect) — otherwise a language
  switch re-renders with fresh `controls` while `officeChromeCopy()` still returns the previous
  language until some unrelated update.
- **The `getUiLocaleBundle` side has the opposite failure mode: it merges too well.** Overrides
  deep-merge onto English, so a key a translator never wrote renders in English forever with no
  error — "untranslated" is invisible to every check unless you compare _values_. Two corollaries
  bit us: **arrays replace wholesale**, so a tour step or idle tip added to English is silently
  absent from every locale that predates it (`entryPointers` drives the real desk tour via
  `useEntryDeskFlow`, so en-AU shipped a five-step tour); and **a dropped `{placeholder}` is
  silent too**, because `formatLocale` just has nothing to substitute. `uiLocale.test.js` now
  pins placeholder parity and `entryPointers` id parity across all locales — extend it rather
  than trusting a key-shape check.
- **First-run reception is `FloorArrival`, not `OfficeDirectory`.** Put `IntroLocaleToggle`
  (`variant="intro"`, endonyms) and the name badge on the reception card, and leave **Check in**
  as a real gesture — an auto-advance skips both and burns TTS on cold mount.
  `officeFloorArrival.test.jsx` pins it; see `CLAUDE.md` § Office layer gotchas.
- **Speech is spoken, writing is read.** Room lines (walk-by, meeting, battle, coffee, huddle,
  desk/floor talk, dwell, shop talk) get TTS; **emails and Slop Chat™ messages never do.** Both
  media share `imHistory` and are told apart by `channel` — and `pushOfficeImPing` omits the
  field for `'im'`, so **written is the unmarked default** and a reader that forgets the question
  voices it. Ask `isSpokenLine` (`officeImThreads.js`), never an inline check: the floor and desk
  each had their own and disagreed, so a typed IM got read aloud in somebody's voice. A fixture
  without `channel: 'talk'` is a _written_ message — several floor suites had to gain it.
  `officeVoiceMedium.test.jsx` pins the rule. See `CLAUDE.md` § Office layer gotchas.
- **Text is the fallback channel. Do not optimize bubbles; do not delete captions.** Voice leads
  (`shouldShowSpokenText` hides the balloon whenever TTS actually speaks), so isometric § 6 rules
  29/32 are closed — no more overlap captures. Captions stay: they are the accessibility path and
  the TTS-failure path.
- **The floor's proximity rules are one ladder, not two radii.** `NAME_CHIP_RANGE_TILES` (1) is
  "they talk to you" (slice 19) and `EARSHOT_RANGE_TILES` (3) is "you overhear two other people"
  (slice 22) — and an overheard exchange refuses to exist while you are within a tile of either
  speaker, which is the only thing stopping one approach producing a remark **and** a two-hander
  inside five seconds. Define any new rung as what the one inside it is not, and assert it over
  **every standable tile** (`officeFloorShopTalk.test.jsx`), because what breaks it is a layout
  change rather than a logic change. The cast talking to each other is licensed by the user's
  _position_, never by a timer — see `CLAUDE.md` § Office layer gotchas.
- **Joining an overheard conversation is a walk, not a reply.** Slice 23's _Join in_ card fires
  `startTalk` at a `talkTileFor` mark — the verb the person card and a double-click already use —
  and the offer carries two seat ids and a prop kind with **none of the exchange's text**. A line,
  a quote or an `actionPrompt` on it would make the exchange something addressed to the user,
  which is a walk-by and belongs in the moment store (`officeFloorContracts.test.js` pins the
  payload). The composer opens **empty**: `handleTalkGreet` is still slice 8's deliberate silence
  and joining is not the exception that seeds an opener. The offer must **outlive** its exchange
  (mark the roll `done`, do not clear it) and must be read off the exchange, so an untranslated
  locale offers nothing instead of inviting you to join two people standing in silence.
- **A verb you pressed can hold somebody in place; a place you are standing cannot.** Joining
  gets `useFloorAway`'s hold free — `startTalk` sets `activity.talk`, which is `holdId`, so a
  wanderer's dwell clock stops while you walk over. Slice 19's dwell wanted the same hold and
  could not have it: its target comes from `floorState`, which is that hook's _output_, and
  `holdId` is its _input_. Check which side of `useFloorAway` a signal starts on before recording
  another cycle as a limitation.
- **A test that loops over a derived set needs a companion assertion that the set is non-empty.**
  Two probes in slice 22 came back green while examining nothing: `isStandableTile(x, y)` takes a
  _tile_, not two numbers, so an every-tile invariant iterated an empty list; and a DOM overlap
  scan used a class that does not exist, so "covers no heads" was vacuous. Both are the silent
  `vi.mock` failure in a new hat — pair every sweep with a coverage claim, and get one hit out of
  a DOM probe before believing its misses.
- **Verifying floor art needs a browser and two specific tricks**: freeze animations at their
  **end** (`office-floor-cover` is `both`-filled from `opacity: 0`, so seeking to 0 renders the
  whole floor invisible), and import `components/OfficeFloor.css` in the harness (`ArchiSlop.jsx`
  is its only importer, so `index.css` + `App.css` alone gives you an unstyled floor). **Driving
  a floor interaction adds two more**: a walker is a zero-size positioned anchor, so Playwright
  calls it hidden — wait with `state: 'attached'`; and click a tile through the figure's own
  `getBoundingClientRect()`, never by scaling its `transform` against the roam element's rect,
  which does not share its origin and lands ~430 px away. Recipe:
  `apps/web/.claude/skills/verify/`, traps recorded in `docs/office-isometric-mode.md` § 6.

## Agent workflow guidance

- Before large edits, inspect both app and shared package contracts to avoid drift.
- Keep changes scoped to the relevant workspace whenever possible.
- After edits, run the smallest meaningful check first (`check:fast` / workspace-scoped test), then `npm run check` or `npm run check:full` before opening a PR.
- **Source vs build output:** edit `apps/*/src/` and `packages/shared/src/` only. `dist/` and `.tsbuildinfo` are gitignored build artifacts — never patch them.
- **TypeScript coverage:** `packages/shared` is fully typechecked (strict). Most `apps/server` and `apps/web` files are still `.js`/`.jsx` with `checkJs: false`; only migrated `.ts`/`.tsx` modules get full type errors until those files are converted.
- If touching API contracts or schema, update both producer and consumer in the same change.
- Prefer small, reviewable commits with clear why-focused messages.

## Documentation upkeep

- **Keep human docs current** when you ship architectural changes, new agents/skills, new modes, new routes, or renamed top-level concepts. Smaller bug fixes and internal refactors usually don't need doc touches.
- **Agent tip sync:** if you add a durable don't-touch, command, or safety tip while coding, mirror it in [`CLAUDE.md`](CLAUDE.md) (and vice versa). Domain paragraphs (validation ladders, slot model) stay in `CLAUDE.md` only — link from here if needed.
- **Hub:** [`README.md`](README.md) — short intro, quick start bullets, doc index (no heavy Mermaid blocks; GitHub preview hangs on large diagrams).
- **Guides:** [`docs/guide/`](docs/guide/) — detailed prose and diagrams on focused pages (agents, validation, MCP Apps table, endpoints, config). Update the relevant guide file; add a README index row if you add a new guide.
- Write for readers, not parsers. Prefer prose and focused Mermaid diagrams over walls of config.
- When in doubt, update docs in the same commit/PR as the code change so behavior and docs stay in lockstep.

## Don't-touch list

- `.agents/` — generated CopilotKit skill files, git-ignored. Refresh with `npm run setup:skills`.
- `.env`, `.env.*` — never commit; ask the user if they need a new variable.
- `scripts/deploy-*.sh` and `scripts/push-*-secret-cloud-run.sh` — production deploy / Secret Manager scripts. Don't run unless asked.
- `apps/server/src/mcp/apps/*.js` (HTML strings) — paired with `session-events` bridges; if you change the HTML, also update the matching event handler and re-run the App's smoke flow.
- `apps/server/bench-results/` — bench snapshots; don't hand-edit, regenerate via the bench script.
- `apps/web/src/assets/audio/*.mp3` — baked ElevenLabs assets; don't hand-edit, regenerate via `./scripts/generate-office-audio.sh` (build-time only — never wire ElevenLabs into a route, CI, or a deploy script). See [`docs/audio-assets.md`](docs/audio-assets.md).
- `package-lock.json`, `skills-lock.json` — never hand-edit.

## Safety and hygiene

- Respect existing uncommitted user changes; do not revert unrelated diffs.
- Avoid destructive git commands unless explicitly requested.
- Keep docs and commands aligned with actual `package.json` scripts.
- New baked audio assets go under `apps/web/src/assets/audio/` via `scripts/generate-office-audio.sh`, not by hand-editing `.mp3` files.
- **The office log records; it never triggers.** `apps/web/src/state/officeLogStore.js` is what
  lets the cast say "since this morning's thing". Writers hook funnels that already exist —
  `onOfficeEvent` in `useRunCeremony.js`, the moment-store push mutators, the adopt handler in
  `OfficeLayerSlot.jsx` — so **don't add an observer to feed it**. Making it schedule or trigger
  anything would be `auto-fix-on-idle` in a new hat, which ADR-0010 consequence #4 rules out. Two
  rules its tests pin: DM bodies never enter the digest (email subjects do), and the log is
  **day-stamped** while Slop Chat scrollback is not. It ships as `officeLog` on every office LLM
  surface via `apps/server/src/agents/_lib/officeLogPrompt.js`; pass `purpose: 'work'` for the
  advisor, whose 80-char envelope cannot afford the dialogue rule.
- **The log is read twice; the second read is a projection, not a store.**
  `buildOfficeRelationship(entries, colleagueId)` in `apps/web/src/utils/officeLogDigest.js`
  (bound as `getOfficeRelationshipWith`) answers "what have you and I been to each other today"
  — which the shared digest structurally cannot, being capped at 12 lines / 700 chars and
  dropping from the front, so a colleague's own history scrolls off by mid-afternoon. Ships as
  `officeRelationship` on `/moment` **only** (the one single-speaker surface) and covers only
  the four kinds carrying a `colleagueId`: `email`, `chat`, `walkby`, `pitch`. `battle` is
  excluded deliberately — its id sits in `detail` and means _winner_.
- **In a prompt rule, prohibitions crowd out a hedged permission — lead with the register.**
  Measured: the relationship block's first draft put three "do NOT"s against one soft "let this
  colour how you sound" and auditioned **inert**, indistinguishable from its control arm. The
  worst offender is a blanket escape hatch ("say nothing if nothing here earns it") — the model
  takes that branch every time, and the block is only built when there _is_ something to use.
  Put the wanted behaviour first, in the imperative, and keep a single guard.
- **A meeting's roster and its speakers are two different lists.** `POST /api/office/meeting` takes
  `attendees` (scripted, bounded by `MEETING_MAX_ATTENDEES`) and an optional `audience` (present,
  silent — the all-hands crowd). Do **not** raise `MEETING_MAX_ATTENDEES` to seat a crowd: it lets
  _every_ meeting seat one, and asks the model for more lines than `MEETING_MAX_BEATS` allows. The
  audience is listed by speakerId and forbidden one in the same breath — `normalizeMeetingScript`
  drops beats from speakers outside `attendees`, so an audience member who "speaks" costs a beat
  and can push the script under `MEETING_MIN_BEATS`, which renders as a _cancelled_ meeting.
- **The escalation rung is a wire contract duplicated verbatim (§10.10).** `MEETING_VENUES =
['workingGroup','steering','cab']` exists in BOTH `officePersonas.js` and `officeCast.js`; the
  server zod-defaults an omitted `venue` to `workingGroup` and 400s an unknown rung. Keep the two
  copies in lockstep or one side books a room the other can't script. Escalation is a scripted beat,
  never a picker: `escalationRosterFor` picks the roster, `nextMeetingVenue` picks the destination
  (a senior+facilitator room jumps straight to the CAB). A completed CAB hearing fires `cabApproved`
  (NOT `meetingSurvived`) — +40 XP and its own one-shot achievement.
- **`MOMENT_WEIGHTS` in `apps/web/src/utils/officeCadence.js` is a cumulative roll, so adding a kind
  moves every lane boundary.** Tests pinning a lane with a magic `random` value
  (`useOfficeAmbience.test.jsx`) will assert on the wrong surface — re-derive against the new total
  rather than hunting for a logic break.
- **The stand-up/sit-down transition is one fact in two places: the JS exit timer and the CSS exit
  fade.** `useFloorViewPhase` (`apps/web/src/components/officeFloor/viewTransition.js`) keeps the
  floor mounted for the sit-down beat after the store flips; `OfficeFloor.css` owns the camera
  choreography on `data-view-phase`. `officeFloorViewTransition.test.js` pins the two durations to
  the same number — change one, change both. Never animate `main.app-shell` or the OS chrome to
  sell the transition: a transform/filter there re-anchors the fixed-position floor and every
  portaled window. The desk side is `.office-view-desk-veil` (backdrop-filter, one z-layer below
  the floor), which is also why multi-line comma-terminated values in `OfficeFloor.css` are a trap
  — the sheet's reduced-motion scanner mis-parses them as selectors
  (`officeFloorStyles.test.js`). See [`docs/office-isometric-mode.md`](docs/office-isometric-mode.md)
  § 1a.
- **A second live `FormsRenderer` breaks the `forms` slot unless you opt out of two things.**
  Linda's training window (`OfficeTrainingWindow.jsx`) is the first non-slot forms surface, and it
  is the template for any future one. Pass `exportable={false}` — the PNG exporter registry in
  `apps/web/src/utils/viewportPngExport.js` is a `Map` keyed by content type and unregistering is
  identity-matched, so a second instance overwrites the slot's entry and then fails to restore it,
  leaving Export-PNG broken until the real renderer remounts. Do **not** pass `preview` — that is
  the read-only thinking-pane mirror and it early-returns out of the action handler, so the form
  renders perfectly and silently refuses to submit. The training document also never reaches the
  `forms` slot (ADR-0010); `officeTraining.test.jsx` pins that by asserting no import path exists.
- **`@archislop/shared` resolves to `dist`, so a new shared file is invisible until you build it.**
  Adding a new module under `packages/shared/src/` and importing it from `apps/web` yields
  `undefined` at runtime, not a module error — the symptom is a test asserting on a constant that
  silently became `"undefined"`. Run `npm run build -w packages/shared` after adding or changing a
  shared export.
- **Set-piece markers on office email templates are fields, not text — mirror them per locale.**
  `training: <module>` and `phishing: true` (`officeCast.js` + all three `office.*.js` bundles) are
  what grow the CTA on an email. The slot-fill parity test only inspects strings, so a missing
  marker makes the whole set piece unreachable in that locale with nothing rendered to notice;
  `officeLocale.test.js` now pins the markers explicitly.
- **The office's LLM appetite is one table in `apps/web/src/utils/officeCadence.js`.**
  `useDeskActions.js` and `useOfficeRunReactions.js` re-export from it rather than declaring their
  own caps, and `officeCadence.test.js` pins that identity — tune there, not at the use site. The
  governing split is `docs/office-parody.md` §11's: **ambient** (a timer interrupted you) stays
  canned-heavy; **reactive** (you started it or answered it) leans LLM.
- **The same file owns the office's wall clock.** `officeDayPhaseAt` + `OFFICE_DAY_PHASES` are
  the office day (mugs early, the remote stand-up, trait rows midday, papers at wind-down, and
  window light cool→warm→dark). The dial is in the cadence and **not** on the floor — an office
  day is ambient content on a timer — and the floor owns only the look: `PHASE_ART` in
  `apps/web/src/utils/officeFloorActivity.js` and `[data-day-phase]` in `OfficeFloor.css`. The
  hour is **rung 5** of `floorActivityFor` (above the trait row, below everything live), so
  anybody a moment is drawing gets no phase. Trap: `headwear: null` cannot remove a headset —
  `PersonaFace` resolves `accessoryOverride ?? traits.accessory`, and only `'none'` strips a
  baked face trait.
- **The light is a token palette on `[data-day-phase]`, one rule per phase.**
  `--office-window-tint` / `--office-wall-ne` / `--office-wall-nw` / `--office-floor-plate` /
  `--office-surround-veil` default on `.office-floor` to the literals `FloorRoom` shipped with,
  so an unphased mount is unchanged. `officeFloorStyles.test.js` pins
  `dayRules.length === OFFICE_DAY_PHASES.length`, so a **new token goes into the five existing
  phase rules, never a rule of its own**. Zone plates need no token (alpha washes re-grade with
  the plate). The surround veil is a **background layer, not an overlay element** — a background
  paints behind the element's children, so it grades the backdrop without tinting the cast or
  the chrome. Nothing here is transitioned, which keeps it out of the reduced-motion contract;
  and `afterHours` dims rather than blacks out, because the 7 %-alpha grid and the
  dark-glyph/white-halo zone labels both need the light.
- **A floor test that _mounts_ is time-dependent; one that calls `floorActivityFor` is not.**
  The hour is rung 5, above the trait row, so a render test asserting a character's baked row is
  silently wrong whenever `PHASE_ART` has an entry — `officeFloorActivity.test.jsx` was red for
  ~7.5 h a day and survived only because CI kept landing in `midday`/`afterHours`. Pin with
  `vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] })` to a midday instant, faking
  `Date` **only**, or the poll timer and React's scheduling stop and nothing renders.
- **A mounting floor test inherits `Math.random` too, and that one is shared across the file.**
  `useFloorWander` sends somebody out on an unstubbed roll, so an unpinned suite depends on the
  PRNG stream — and any change anywhere that consumes a different number of randoms re-seeds who
  is wandering and where. Slice 23 consumes one fewer and turned `officeFloorDwell.test.jsx` red
  on a test that **passed in isolation and failed in file order**, which is the signature of this
  class. Pin with `vi.spyOn(Math, 'random').mockReturnValue(0.75)` (the floor suites' seed: Chad
  to the whiteboard) unless the suite is genuinely about the roll.
- **Why a colleague is speaking is a wire field.** `situation` on `POST /api/office/moment`
  (`OFFICE_MOMENT_SITUATIONS` in `packages/shared`: `dwell` | `run`) selects one rule block in
  `buildMomentSystemPrompt` plus a terse restatement at the end of the user prompt. It is an
  **enum, never free text**, because it shapes a system prompt; **absent is the default** and
  keeps the cold-open framing ambient moments want; **a reply beats a situation**. Without it a
  line the user crossed the room to trigger is written as a cold open and reads as a
  non-sequitur. **But a situation may only state the circumstance, never a delta the prompt does
  not carry**: `run` used to end with "React to what changed" while the prompt ships only the
  current diagram, and the first audition measured the model inventing that change in **8 of 12**
  samples against a fixed diagram (**0 of 12** with no situation — the field caused it). See
  `docs/office-parody.md` §11.
- **Prompt changes are auditionable now, and a fixed fixture + a control arm is the whole
  method.** `api.deepseek.com` is reachable from the session proxy and `DEEPSEEK_API_KEY` is
  live, so an office prompt can be driven for real rather than reasoned about: replicate the
  route handler in a throwaway script (`buildMoment*Prompt` → `createOfficeChatModel` →
  `parseMomentReply`), hold the diagram **constant**, vary one field, sample ~4× per arm, read
  the arms side by side. The control arm is load-bearing — a failure rate means nothing without
  it. Check reachability first (`curl -sS -o /dev/null -w "%{http_code}"
https://api.deepseek.com/` — 401 is reachable, 000 is blocked); never route around a block.
- **Office sound is one posture, not four checkboxes.** Menu bar **Admin** carries 🎧 **Headphones**
  (how the office reaches you) and 🔕 **Focus** (whether it does), plus the Approved vendors strip.
  The composer band holds Mail / Chat / Meeting as direct icons (`DeskActionsDock`), not a helmet
  menu. `setOfficeHeadphones` in `apps/web/src/state/officeMomentStore.js` is a **macro** that
  writes `narration`/`soundscape`/`captions` — read those three, never `headphones`, from a
  consumer. Boot runs `reconcileOfficeHeadphonesPosture()` so a stale pre-macro Voice key cannot
  desync the menu from speech. Focus is also the advisor roundtable's mute; don't reintroduce a
  second one. See [`docs/office-parody.md`](docs/office-parody.md) § Desk verbs.
- **Office windows have three placements and one minimize; both live outside the window.**
  `FloatingWindow` resolves a `presentation` from the viewport (`useWindowPresentation`):
  free-dragging ≥1025px, docked panel 640–1024px, bottom sheet ≤639px. A sheet has **no
  `left`/`top` at all** — don't "fix" phone clipping by tuning `minVisiblePx` in
  `useDraggablePosition`; that hook is disabled at that breakpoint and `useSheetSnap` owns the
  gesture instead. **Minimize is `overlayStack` state, not a local `useState`** — a minimized
  window renders nothing and the `DeskOsTray` pill restores it. Three traps: the placement CSS
  must remain the **last block in `App.css`** (every window sets its own size at (0,1,0), so the
  (0,2,0) placement rules win by order too); a sheet reserves **only** `--desk-taskbar-h`,
  because the taskbar is where minimize sends things; and `minimizeOtherOverlays` (the phone's
  one-window-at-a-time rule) spares anything with `manageable: false`, which is the only thing
  stopping it from swallowing IM pings. Never re-add `touch-action` to `.floating-window` — the
  drag handlers are on the handle, and on the root it vetoes touch scrolling for every
  descendant. See [`docs/office-window-manager.md`](docs/office-window-manager.md).
- **The taskbar's leading cluster is the office; the composer band is two lanes.** Mail / Slop
  Chat / Meeting live in `DeskOsTaskbar` beside Stand up and the presence strip, arriving by
  **portal** through `deskSlotStore` — the bar still owns no office state, and the anchor
  `#office-desk-bottom-slot` must exist exactly once (a second one silently steals the portal).
  The band's lanes each carry their own tool: notebook inside `.desk-work-order-group`, roster
  inside `.desk-talk-group`. Three traps, all invisible to jsdom and all found by driving a
  browser: **`.desk-actions` is a corner dock** (`position: fixed; top: 124px`) so any new
  placement needs a reset at `(0,2,0)` or the corner rules' `:not(.desk-actions--bottom)` wins
  `top` and drops it off-screen; **`.desk-work-order-group` is `flex-direction: column`**, so a
  second child stacks unless the lane is forced to `row`; and the flat-tool-row
  `.desk-chrome-tool { order: 1 }` **reverses a nested lane**, so lane order must be declared on
  every child. Below 640px the bar sheds Concentration + the HR chip (both have a second home),
  never the office half. See [`docs/office-window-manager.md`](docs/office-window-manager.md) §11.
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
- **After presence / TTS / desk-frame edits**, prefer `apps/web/test/officePresence.test.js`,
  `deskOsPresenceStrip.test.jsx`, `deskOsFrameStyles.test.js`, `apps/server/test/officeTts.test.js`,
  `officeRoute.test.js` (or `npm run test:affected`). **After isometric-floor edits**, `npm run
test:floor`; the floor test map is [`docs/agents/isometric-floor-tests.md`](docs/agents/isometric-floor-tests.md).

## Cursor Cloud specific instructions

- **Environment file**: `.env` must exist (copy from `.env.example` if missing). Run `npm run setup` for `npm install`, CopilotKit skills refresh, and `gcloud` install when missing (`scripts/setup-gcloud.sh`); ensure `.env` is present before starting services.
- **Starting dev servers**: `npm run dev` launches both the Express server (on the port defined by `PORT` in `.env`, default 4000) and Vite dev server (port 5173) via `concurrently`. Use `curl http://localhost:$PORT/api/health` to verify the server is up. The health response includes `llmConfigured` (true when any LLM backend resolves: DeepSeek key, OpenRouter key, and/or Vertex project + region per `LLM_PROVIDER`; see `resolveLlmBackend` in `apps/server/src/agents/llmProvider.js`) and `runtimeReady`. Local/Cloud Run `auto` prefers **DeepSeek** for Brain (Flash/Pro) when `DEEPSEEK_API_KEY` is set; Vertex (when configured) serves office/advisor as flash-lite. Without DeepSeek, Cloud Run falls back to **Vertex**.
- **No database or Docker required** for local dev: diagram and collaboration state are in-memory per server process. Optional **`REDIS_URL`** shares pairing codes across Cloud Run instances (see `.env.example`); diagram slots are not Redis-backed yet.
- **Tests**: `npm test` runs all workspaces sequentially (shared → server → web). Server tests use Node's built-in test runner; web tests use Vitest. All tests should pass without any API key (300+ cases across workspaces).
- **A `vi.mock` path that resolves nowhere fails silently**: vitest does not raise, the real module runs, and the suite passes for the wrong reason. `apps/web/test/viMockPathsResolve.test.js` is the sensor and prints the offending `file:line -> specifier`. **Check what the mock was doing before repairing the path** — one that has never executed is not load-bearing, so deleting it is a zero-behaviour-change edit while making it live is a real change (in `useOfficeRunReactions.test.js` the tests had come to depend on the unmocked modules). A `.js` specifier pointing at a `.ts` file is **not** an instance of this; that is the ordinary TypeScript convention Vite resolves, so a checker must map `.js` → `.ts`/`.tsx`. See [`docs/agents/sensors.md`](docs/agents/sensors.md) § How to read the `vi.mock` path check.
- **In a hook test, `rerender(...)` and `advanceTimersByTimeAsync(...)` belong in two separate `act` blocks.** The effect that schedules a timer flushes when the act scope closes, so advancing the clock in the same block advances it _before_ the timer exists and the callback never fires (measured: one block → `fetch` on zero calls, two blocks → exactly one). A test written the one-block way passes while exercising nothing, which is why "does not throw" is a dangerous shape for an async assertion.
- **Lint**: All three workspaces lint via the shared config in `packages/eslint-config/` (`npm run lint` from root, or `npm run lint -w <workspace>`). The custom formatter appends per-rule "Agent guidance" with the canonical fix and suppression syntax — read it before suppressing or raising a threshold. ADR-0005 monolith files are pre-suppressed via `packages/eslint-config/legacy-monoliths.js`. See [`docs/agents/sensors.md`](docs/agents/sensors.md) and ADR-0007.
- **Cursor parity**: `.cursor/rules/sensors.mdc` is loaded in every Cursor session and points at the same sensor stack as CLAUDE.md. The vladikk/modularity skill is mirrored at `.cursor/skills/modularity/` so Cursor agents can apply the Balanced Coupling Model without the Claude Code plugin. Refresh with `npm run sync:modularity`.
- **Build**: `npm run build` builds shared → server → web. The web build produces a Vite bundle with a chunk-size warning that can be ignored.
- **AI features require a configured LLM backend** (typically `OPENROUTER_API_KEY` for local dev, or Vertex on GCP). If none resolves, `llmConfigured` is false and intent/transform/analyze/stream routes return 503. The app still loads and renders diagrams, but AI generation will not work.
- **GCP access (`gcloud`)**: `npm run setup` / `npm run setup:gcloud` installs the SDK to `~/google-cloud-sdk` when absent. If `GOOGLE_APPLICATION_CREDENTIALS` or `GCP_MERMAID_GEN` points at a service-account JSON file, the script runs `gcloud auth activate-service-account`; it then sets project `mermaidgen` and region `us-central1` when that project is readable. Once authenticated, useful inspection commands include:
  - `gcloud run services list` — list Cloud Run services (`mermaid-gen-main`)
  - `gcloud run services describe mermaid-gen-main` — inspect the main service
  - `gcloud logging read 'resource.type="cloud_run_revision"' --limit=20 --freshness=1h` — recent logs
  - `curl -sS "https://mermaid-gen-main-464241135431.us-central1.run.app/api/health"` — production health check
  - See [`docs/deploy/gcp.md`](docs/deploy/gcp.md) for full deployment and investigation reference.
