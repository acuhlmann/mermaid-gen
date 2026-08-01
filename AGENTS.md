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
- Regenerate baked office audio: `./scripts/generate-office-audio.sh --dry-run` (cost first), then without the flag — see [`docs/audio-assets.md`](docs/audio-assets.md)
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

### `gh` (GitHub CLI)

Use for **repo and release inspection**: tags, releases, Actions, PRs.

Examples for this repository:

- `gh release view hackathon-pre-deploy -R acuhlmann/mermaid-gen`
- `gh api repos/acuhlmann/mermaid-gen/git/refs/tags/hackathon-pre-deploy`

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
- **A meeting's roster and its speakers are two different lists.** `POST /api/office/meeting` takes
  `attendees` (scripted, bounded by `MEETING_MAX_ATTENDEES`) and an optional `audience` (present,
  silent — the all-hands crowd). Do **not** raise `MEETING_MAX_ATTENDEES` to seat a crowd: it lets
  _every_ meeting seat one, and asks the model for more lines than `MEETING_MAX_BEATS` allows. The
  audience is listed by speakerId and forbidden one in the same breath — `normalizeMeetingScript`
  drops beats from speakers outside `attendees`, so an audience member who "speaks" costs a beat
  and can push the script under `MEETING_MIN_BEATS`, which renders as a _cancelled_ meeting.
- **`MOMENT_WEIGHTS` in `apps/web/src/utils/officeCadence.js` is a cumulative roll, so adding a kind
  moves every lane boundary.** Tests pinning a lane with a magic `random` value
  (`useOfficeAmbience.test.jsx`) will assert on the wrong surface — re-derive against the new total
  rather than hunting for a logic break.
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
- **After presence / TTS / desk-frame edits**, prefer `apps/web/test/officePresence.test.js`,
  `deskOsPresenceStrip.test.jsx`, `deskOsFrameStyles.test.js`, `apps/server/test/officeTts.test.js`,
  `officeRoute.test.js` (or `npm run test:affected`).

## Cursor Cloud specific instructions

- **Environment file**: `.env` must exist (copy from `.env.example` if missing). Run `npm run setup` for `npm install`, CopilotKit skills refresh, and `gcloud` install when missing (`scripts/setup-gcloud.sh`); ensure `.env` is present before starting services.
- **Starting dev servers**: `npm run dev` launches both the Express server (on the port defined by `PORT` in `.env`, default 4000) and Vite dev server (port 5173) via `concurrently`. Use `curl http://localhost:$PORT/api/health` to verify the server is up. The health response includes `llmConfigured` (true when any LLM backend resolves: DeepSeek key, OpenRouter key, and/or Vertex project + region per `LLM_PROVIDER`; see `resolveLlmBackend` in `apps/server/src/agents/llmProvider.js`) and `runtimeReady`. Local `auto` prefers **DeepSeek** when `DEEPSEEK_API_KEY` is set; Cloud Run `auto` prefers **Vertex** (Gemini).
- **No database or Docker required** for local dev: diagram and collaboration state are in-memory per server process. Optional **`REDIS_URL`** shares pairing codes across Cloud Run instances (see `.env.example`); diagram slots are not Redis-backed yet.
- **Tests**: `npm test` runs all workspaces sequentially (shared → server → web). Server tests use Node's built-in test runner; web tests use Vitest. All tests should pass without any API key (300+ cases across workspaces).
- **Lint**: All three workspaces lint via the shared config in `packages/eslint-config/` (`npm run lint` from root, or `npm run lint -w <workspace>`). The custom formatter appends per-rule "Agent guidance" with the canonical fix and suppression syntax — read it before suppressing or raising a threshold. ADR-0005 monolith files are pre-suppressed via `packages/eslint-config/legacy-monoliths.js`. See [`docs/agents/sensors.md`](docs/agents/sensors.md) and ADR-0007.
- **Cursor parity**: `.cursor/rules/sensors.mdc` is loaded in every Cursor session and points at the same sensor stack as CLAUDE.md. The vladikk/modularity skill is mirrored at `.cursor/skills/modularity/` so Cursor agents can apply the Balanced Coupling Model without the Claude Code plugin. Refresh with `npm run sync:modularity`.
- **Build**: `npm run build` builds shared → server → web. The web build produces a Vite bundle with a chunk-size warning that can be ignored.
- **AI features require a configured LLM backend** (typically `OPENROUTER_API_KEY` for local dev, or Vertex on GCP). If none resolves, `llmConfigured` is false and intent/transform/analyze/stream routes return 503. The app still loads and renders diagrams, but AI generation will not work.
- **GCP access (`gcloud`)**: `npm run setup` / `npm run setup:gcloud` installs the SDK to `~/google-cloud-sdk` when absent. If `GOOGLE_APPLICATION_CREDENTIALS` or `GCP_MERMAID_GEN` points at a service-account JSON file, the script runs `gcloud auth activate-service-account`; it then sets project `mermaidgen` and region `us-central1` when that project is readable. Once authenticated, useful inspection commands include:
  - `gcloud run services list` — list Cloud Run services (`mermaid-gen-main`, `mermaid-gen-hackathon`)
  - `gcloud run services describe mermaid-gen-main` — inspect the main service
  - `gcloud logging read 'resource.type="cloud_run_revision"' --limit=20 --freshness=1h` — recent logs
  - `curl -sS "https://mermaid-gen-main-464241135431.us-central1.run.app/api/health"` — production health check
  - See [`docs/deploy/gcp.md`](docs/deploy/gcp.md) for full deployment and investigation reference.
