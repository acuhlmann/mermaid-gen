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
  - `npm run verify:ratchet` — quality trend: monolith LOC and lint warnings should only fall, strict-island and suite counts should only rise (`docs/agents/ratchet.json`). **Not part of `check`** — it gates no build; `--json` for machine-readable, `--with-lint` to include the ESLint pass
  - `npm run routine:guard -- --preflight|--postflight <name>` — budget enforcement for a scheduled NFR routine (`docs/routines/`)
  - `npm run verify:modularity` — reminder of how to run a semantic modularity review (Claude `/modularity:review` or Cursor `.cursor/skills/modularity/review/SKILL.md`); see [`docs/agents/modularity.md`](docs/agents/modularity.md)
- **Workspace-scoped** (faster when you know the blast radius):
  - `npm run typecheck -w apps/server && npm run test -w apps/server`
  - `npm run typecheck -w apps/web && npm run test -w apps/web`
  - `npm run typecheck -w packages/shared && npm run test -w packages/shared`

Package-specific commands:

- Server dev: `npm run dev -w apps/server`
- Web dev: `npm run dev -w apps/web`

### Anything runtime rung — two engines

- The rung executes agent pages in a **real browser** by default (`anythingRuntimeBrowser.js`), inside the actual
  client sandbox rather than an emulation of it: it builds the same
  `<iframe sandbox="allow-scripts" srcdoc={wrapAnythingSrcDoc(html)}>` the renderer does. Measured p50 through the
  full 28-fixture corpus: **139 ms vs jsdom's 1,009 ms, identical verdicts**.
- `ANYTHING_RUNTIME_ENGINE=browser|jsdom|auto` (default `auto` = browser when a binary resolves). **`jsdom` is the
  rollback.** Both engines are held to the same suite — `apps/server/test/anythingRuntimeCheck.test.js` runs
  unchanged against either, and that identity is what stops them drifting.
- The probe goes in **`<head>`, never the end of `<body>`** — console capture must install before page scripts, and
  a body element would defeat the `blank_render` check.
- **Each engine gets its own clock.** When the browser rung fails open, the jsdom fallback runs on
  `ANYTHING_RUNTIME_FALLBACK_TIMEOUT_MS` (default `max(browser budget, 6000 ms)`), never on the browser's budget —
  the engines are a pair _because_ their startup costs differ, and resharing one clock made a tightened browser
  budget starve the fallback, which then reported `runtime_timeout` (a page rejection) for its own spawn cost
  (#347). Raising the budget still lifts both; only tightening was ever browser-specific.
- **Visual findings warn, they do not reject** unless `ANYTHING_RUNTIME_VISUAL_REJECT=1`, and then only on hard
  ones. `low_contrast` stays a warning permanently: 32 of 35 accepted pages carry one, and each extra rejection
  costs a 12–60 s repair turn.

### Benches — two kinds, easy to confuse

- **Corpus benches** (`benchMermaid.js`, `benchAnything.js`) replay fixed documents through the
  validators. No LLM, safe to run anytime. They measure the **gate**, not the model — and
  `benchAnything.js`'s `acceptRate` is a property of the corpus (how many fixtures are _supposed_
  to pass), **not** a quality signal. Read `expectationMatch`.
- **Generation bench** (`benchAnythingGeneration.js`) sends real prompts through the real agent
  and **spends tokens**. It is not part of `npm test`. Reports first-pass accept rate, the
  rejection-code histogram, and repair convergence.
  **Always `--samples 3` or more for a baseline you will compare against** — two consecutive
  single-sample runs of the same 12 cases measured 66.7% and 91.7% first-pass, a 25-point swing
  from nondeterminism alone. Read the accept rate next to `failureKinds`: a `transport` entry is
  a model call cut off mid-stream, which depresses the rate exactly like a page the model could
  not fix.
  It needs **both** `--import` flags —
  `node --import ./scripts/register-antv-layout-esm.mjs --import tsx …` — because the agent's
  import graph reaches TypeScript leaves behind `.js` specifiers _and_ transitively reaches
  `@antv/infographic`. Neither flag alone works; the failures are two different, unhelpful
  module errors.
- `--browser` on the generation bench renders accepted pages in real Chromium and reports what
  jsdom structurally cannot see (blank canvases, collapsed layout, contrast). It is an
  **observer, not a rung** — it changes no verdict. It exists to measure how much _more_ a
  browser would reject, since each extra rejection costs a 12–60 s repair turn.

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

## Metaphor3D scene gotchas

**Moved.** The ~50 findings for this domain now live in one file, read by every agent:

**[`docs/agents/domains/metaphor3d.md`](docs/agents/domains/metaphor3d.md)**

Claude Code auto-loads it through nested `CLAUDE.md` files in
`apps/web/src/components/metaphorScenes/` and `apps/web/src/utils/metaphorLayouts/`; Cursor gets it
through the glob-scoped `.cursor/rules/metaphor3d.mdc`; anything else reads it from the index in
the table below. Read its **Short form** before touching a scene, layout, or the metaphor
ladder.

It was 27 KB here and another 54 KB in `CLAUDE.md`, both loaded in full by every session in this
repo — about 20 k tokens before any work started, whether or not the work went near a 3D scene, and
growing every night. Scoping it costs a session that _does_ touch metaphor code nothing and saves
every session that does not.

**Add findings there, once.** Do not mirror them back here.

## Architecture docs (read before changing wire contracts)

| Doc                                                                            | Topic                                                            |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [`docs/architecture-generative-ui.md`](docs/architecture-generative-ui.md)     | **AG-UI + A2UI + MCP Apps map**, MCP connectivity, host matrix   |
| [`docs/architecture-external-agents.md`](docs/architecture-external-agents.md) | MCP join, handshakes, proposals, MCP Apps, session-events        |
| [`docs/architecture-ag-ui.md`](docs/architecture-ag-ui.md)                     | AG-UI SSE for built-in `agent-stream`                            |
| [`docs/architecture-a2ui.md`](docs/architecture-a2ui.md)                       | A2UI critique `CUSTOM` on AG-UI streams                          |
| [`docs/agent-blast-radius.md`](docs/agent-blast-radius.md)                     | **Impact map** — if you change X, also change Y (wire contracts) |
| [`docs/office-continuity.md`](docs/office-continuity.md)                       | **Office continuity** — working memory + `runWalk` (v1 shipped)  |
| [`docs/canvas-graph-edit.md`](docs/canvas-graph-edit.md)                       | Canvas Add / Delete / Rename / Link — families + next slices     |
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

## Domain gotchas — scoped, not deleted

Two domains carry far more hard-won detail than anything else in this repo, and both used to sit in
the root `CLAUDE.md` **and** here at the same time. Every session in this repo read all of it —
about 152 KB, ~38 k tokens — before doing anything, whether or not the work went near either area.

They are now one file each, loaded by the agents that need them:

| Domain         | The file                                                                 | Read it when you touch                                                                                                                             |
| -------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Metaphor3D** | [`docs/agents/domains/metaphor3d.md`](docs/agents/domains/metaphor3d.md) | `metaphorScenes/`, `MetaphorRenderer.jsx`, `metaphorLayouts/`, `utils/metaphor*`, `shared/src/metaphor*`, the metaphor ladder                      |
| **Office**     | [`docs/agents/domains/office.md`](docs/agents/domains/office.md)         | `OfficeFloor*`, `officeFloor/`, `OfficeLayer*`, `DeskOs*`, `personaFaces/`, `state/office*`, `utils/office*`, `locales/office.*`, server `office*` |

Each opens with a **Short form** — one line per finding, naming the file it lives in. Read that
first and the matching **Full findings** entry before changing the thing it names.

**How each agent gets there.** Same content, one copy:

- **Cursor** — `.cursor/rules/metaphor3d.mdc` and `.cursor/rules/office.mdc`, glob-scoped with
  `alwaysApply: false`, so they load only for sessions touching those paths.
- **Claude Code** — nested `CLAUDE.md` files in `apps/web/src/components/metaphorScenes/`,
  `apps/web/src/utils/metaphorLayouts/`, `apps/web/src/components/officeFloor/` and
  `apps/web/src/state/`, auto-loaded when a file in that directory is read.
- **qwen, Codex, and anything else** — this table. `AGENTS.md` is the cross-agent entry point and
  is deliberately the file that stays small enough to be worth reading in full.

**Adding a finding.** Put it in the domain file, **once**. The old rule requiring every durable
learning in both `AGENTS.md` and `CLAUDE.md` is retired for domain content
(`docs/routines/README.md` rule 8) — it is what made each finding cost twice and drove both root
files past 130 KB and 88 KB. A finding about the **whole repo** rather than about one domain still
goes in the root files, and still in both.

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

Three more facts, all added on 2026-08-30:

- **There is a night ladder, and it is a dependency order.** Seven jobs run between `0 15` and
  `0 23` UTC (23:00–07:00 in the owner's GMT+8), so the whole fleet finishes while nobody is
  watching and a digest is waiting at 07:00. Feature automations produce code, `review` reads what
  landed, `improve` works the quality queue, `resolve` works the backlog the first two just filed,
  `digest` reports. The table is in [`docs/routines/review.md`](docs/routines/review.md). Until this
  date the live crons ran `improve` → `review` → `resolve` with `review` firing _during_ `improve`'s
  run, and every playbook's declared `schedule` disagreed with its actual cron.
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
- **The glass room is entered through a threshold, and its cast is bigger than its commuters.**
  Slice 27 walks meeting attendees to `MEETING_THRESHOLD_TILES` (a fan of eight tiles _outside_
  the sealed room) and cuts them into their chairs on arrival — **no geometry changed**, and
  `pathCrossesGlass` still refuses every route through the glass. The leadership tier sits in
  its own fishbowl and can never walk, so `FloorMeeting` gates on **`walkingIds`**, not the
  `settledIds` its siblings take: absent-from-settled means "still walking" only when the whole
  cast commutes, and here it would delete every executive from the meeting. A mark may also
  carry **`arriving`** to opt out of `useFloorCommute`'s first-pass seed — calling a physical
  meeting from your desk stands you up, so the floor mounts on a room that has not started, and
  seeding it teleports everybody into the chairs the slice exists to walk them into.
- **The office layer never re-renders while you type.** `OfficeLayerSlot.jsx` passes the diagram
  to `OfficeLayer` as **getters** (`getDiagramSource` / `getContentType`), deliberately. Anything
  on the isometric floor that reflects your work — your monitor, the whiteboard, the glass-room
  table (`utils/officeFloorBoard.js`, `hooks/useOfficeBoard.js`) — is **sampled** on an edge (a
  completed run, standing up, a meeting opening) and must not be converted into a `diagramStore`
  subscription: that repaints sixteen animated figures and a directed camera per keystroke. See
  [`docs/agents/domains/office.md`](docs/agents/domains/office.md).
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
  `officeFloorArrival.test.jsx` pins it; see [`docs/agents/domains/office.md`](docs/agents/domains/office.md).
- **Speech is spoken, writing is read.** Room lines (walk-by, meeting, battle, coffee, huddle,
  desk/floor talk, dwell, shop talk) get TTS; **emails and Slop Chat™ messages never do.** Both
  media share `imHistory` and are told apart by `channel` — and `pushOfficeImPing` omits the
  field for `'im'`, so **written is the unmarked default** and a reader that forgets the question
  voices it. Ask `isSpokenLine` (`officeImThreads.js`), never an inline check: the floor and desk
  each had their own and disagreed, so a typed IM got read aloud in somebody's voice. A fixture
  without `channel: 'talk'` is a _written_ message — several floor suites had to gain it.
  `officeVoiceMedium.test.jsx` pins the rule. See [`docs/agents/domains/office.md`](docs/agents/domains/office.md).
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
  _position_, never by a timer — see [`docs/agents/domains/office.md`](docs/agents/domains/office.md).
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

## Office layer gotchas

**Moved.** The ~55 findings for this domain now live in one file, read by every agent:

**[`docs/agents/domains/office.md`](docs/agents/domains/office.md)**

Cursor auto-loads it through the glob-scoped `.cursor/rules/office.mdc`; Claude Code through nested
`CLAUDE.md` files in `apps/web/src/components/officeFloor/` and `apps/web/src/state/`; anything
else reads it from the domain index below.

The two rules everything else follows from:

- **Ambient vs reactive** (`docs/office-parody.md` § 11). A timer interrupted you → canned-heavy.
  You started it or answered it → lean LLM, because a canned reply to a sentence you typed is the
  clearest possible tell that nobody is home. The appetite table is `officeCadence.js`.
- **Record, never trigger** (ADR-0010 consequence #4). The office log, working memory and the
  errand all _record_. The moment one of them schedules or fires something, it is
  auto-fix-on-idle in a new hat.

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
