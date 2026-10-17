# AGENTS.md

This file is a quick operator manual for coding agents working in this repository (Cursor, Claude Code, Copilot, cloud agents).

**This file is a pointer, not a store.** Every session in this repo loads it before it does any work, so a paragraph duplicated here is paid by every session whether or not the work goes near its subject — which is how `CLAUDE.md` once reached 136 KB. Depth lives where rule 8 of [`docs/routines/README.md`](docs/routines/README.md) puts it: domain findings in [`docs/agents/domains/`](docs/agents/domains/), the routine/automation contract in [`docs/routines/README.md`](docs/routines/README.md) and [`docs/automations/README.md`](docs/automations/README.md), sensor semantics in [`docs/agents/sensors.md`](docs/agents/sensors.md), test traps in [`docs/agents/testing.md`](docs/agents/testing.md). A finding about the **whole repo** still goes in both root files (see [Documentation upkeep](#documentation-upkeep)).

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

**Setup and run**

- `npm run setup` — deps + CopilotKit skills + Cloud SDK when missing (`scripts/setup-gcloud.sh`; uses `GOOGLE_APPLICATION_CREDENTIALS` or `GCP_MERMAID_GEN` key path for service-account auth)
- `npm run setup:gcloud` — Google Cloud CLI only; `npm run setup:skills` — skills refresh only
- `npm run dev` — web + server together (see [Cursor Cloud](#cursor-cloud-setup-and-ai-backends)); `npm run test`; `npm run build` (shared → server → web; the web chunk-size warning is expected)
- Artifact Registry retention: `npm run ar:cleanup:verify` (policy in `scripts/artifact-registry-cleanup-policy.json`), apply with `npm run ar:cleanup:apply`
- Regenerate baked office audio: **always name the asset** — `./scripts/generate-office-audio.sh cue-laugh`. Bare regenerates the whole manifest (900 credits, every committed `.mp3` overwritten); `--dry-run` prices first, `--verify` re-checks the bank for free. Flags and cost: [`docs/audio-assets.md`](docs/audio-assets.md)

**Verify after edits** — the full table lives in [`docs/guide/coding-agents.md`](docs/guide/coding-agents.md) and the semantics of each sensor in [`docs/agents/sensors.md`](docs/agents/sensors.md). Pick the smallest loop that fits:

- `npm run check:affected` — diff-scoped sensors; what agents should run before push
- `npm run test:affected` — diff-scoped tests only
- `npm run precommit` — **before every cloud-agent commit** (Husky does not run in cloud VMs); then `git add -A` to re-stage Prettier fixes on new files
- `npm run format:affected` / `format` / `format:check` — CI runs `format:check`; pre-commit auto-formats staged files
- `npm run check:fast` — `packages/shared` only · `npm run check` — typecheck + lint + test + doc-paths · `npm run check:full` — `check` + build (the local full gate)
- `npm run check:wire` — doc-path verify + wire round-trip tests · `npm run typecheck:strict` — strict TS on server wire-route modules
- `npm run verify:doc-paths` · `verify:deps` · `verify:boundaries` · `lint` · `verify:modularity` — how to read any of these: [`docs/agents/sensors.md`](docs/agents/sensors.md)
- `npm run verify:ratchet` — quality trend (**not part of `check`**, so it gates no build); `--json`, `--with-lint`; budgets in `docs/agents/ratchet.json`, raise one only with a written `reason`
- `npm run routine:guard -- --preflight|--postflight <name>` · `--reachable <path>` · `--filings` — routine budget and ownership (rule 12); a delete-only rung is never the answer
- `npm run prune:scan` — tracked files nothing refers to; `prune`'s queue (a report, not in `check`)

**Workspace-scoped** (when you know the blast radius): `npm run typecheck -w <ws> && npm run test -w <ws>` for `apps/server`, `apps/web`, `packages/shared`; dev with `npm run dev -w apps/server`.

Anything-runtime engines, the two kinds of bench, and the slow-suite map are **not** in this file: [`docs/agents/testing.md`](docs/agents/testing.md), [`docs/automations/anything.md`](docs/automations/anything.md).

## Operator CLIs

Agents often have **`gcloud`** and **`gh`** available. Use them to inspect real account state instead of guessing projects, billing, or Git refs.

- `gcloud` — estate discovery and deploy operations: `gcloud projects list`, `gcloud billing projects describe PROJECT_ID`, `gcloud run services list --region=REGION`, `gcloud logging read 'resource.type="cloud_run_revision"' --limit=20 --freshness=1h`. Full reference: [`docs/deploy/gcp.md`](docs/deploy/gcp.md)
- `gh` — repo and release inspection: `gh release list -R acuhlmann/mermaid-gen --limit 5`, `gh api repos/acuhlmann/mermaid-gen/actions/runs --jq '.workflow_runs[:5] | .[] | {name,conclusion,head_branch}'`

## Key code locations

- Server entrypoint: `apps/server/src/index.js` (mounts `/api/copilotkit`, `/mcp`, CopilotKit handler)
- Copilot + collaboration routes: `apps/server/src/routes/copilot.ts` (intent/transform/analyze, invite, session-events, handshakes, proposals)
- MCP server + tools: `apps/server/src/mcp/mcpServer.js`; MCP App HTML: `apps/server/src/mcp/apps/`
- Mermaid validation helper: `apps/server/src/tools/mermaidDiffTool.js`
- Shared exports/schemas: `packages/shared/src/`
- Web app entry/UI: `apps/web/src/`
- Session event bus: `apps/server/src/state/sessionEventBus.ts`; web client: `apps/web/src/state/sessionEventsClient.js`

## Mermaid is on 12.x

Depth lives in `CLAUDE.md` (§ Validation ladder). The four things an agent misses without them:

- **The version is declared in three package.jsons** — root, `apps/web`, `apps/server` — **plus a CDN URL major** in `apps/server/src/mcp/apps/mcpAppDiagramPreview.js`; `npm run verify:mermaid-pins` proves the four agree, because a lagging CDN has external MCP Apps agents render grammar the server gate rejects.
- **A new diagram type is a six-registry edit**, not a one-line allowlist: `DIAGRAM_PREFIX_PATTERN`, `KNOWN_DIAGRAM_PREFIXES`, `CANONICAL_TYPES`, `RULE_PACKS`, the persona type lists, and the CDN. Unlisted types degrade to `unknown` in canvas editing — they do not crash.
- **Do not try to dedupe CopilotKit's Mermaid.** `@copilotkit/react-core` → `streamdown` hard-depends on `mermaid@^11`, and an `overrides` entry (either form) rewrites the range but leaves the nested copy, so `npm ls` then reports `ELSPROBLEMS`. Two copies is the correct state here; the app's own surfaces all use hoisted 12.x.
- **Verify a type with the corpus bench, and measure geometry in a real browser**: `node apps/server/scripts/benchMermaid.js --tag <label>` replays through the actual ladder and fails on `expectationMatch` drift. jsdom's stubbed `getBBox` inflates viewBoxes by ~three orders of magnitude, so it can prove a diagram parses and renders but never that it is sized sanely.

## Domain gotchas — scoped, not deleted

Two domains carry far more hard-won detail than anything else in this repo. Each is now one file, read by the agents that touch it (the 152 KB / ~38 k-token history is in rule 8's § Why the split):

| Domain         | The file                                                                 | Read it when you touch                                                                                                                             |
| -------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Metaphor3D** | [`docs/agents/domains/metaphor3d.md`](docs/agents/domains/metaphor3d.md) | `metaphorScenes/`, `MetaphorRenderer.jsx`, `metaphorLayouts/`, `utils/metaphor*`, `shared/src/metaphor*`, the metaphor ladder                      |
| **Office**     | [`docs/agents/domains/office.md`](docs/agents/domains/office.md)         | `OfficeFloor*`, `officeFloor/`, `OfficeLayer*`, `DeskOs*`, `personaFaces/`, `state/office*`, `utils/office*`, `locales/office.*`, server `office*` |

Each opens with a **Short form** — one line per finding, naming the file it lives in. Read that first, and the matching **Full findings** entry, before changing the thing it names. Floor test traps: [`docs/agents/isometric-floor-tests.md`](docs/agents/isometric-floor-tests.md); geometry spec and its § 6 trap list: [`docs/office-isometric-mode.md`](docs/office-isometric-mode.md).

**Adding a finding — one copy, per rule 8** ([`docs/routines/README.md`](docs/routines/README.md)): put it in the domain file, never mirrored back here. Cursor reaches the domain files through glob-scoped `.cursor/rules/<domain>.mdc`, Claude Code through nested `CLAUDE.md` files in `metaphorScenes/`, `metaphorLayouts/`, `officeFloor/`, `state/`, and every other agent through the table above.

## Scheduled NFR routines

Non-functional work — post-merge review, doc drift, test hardening, dependency upkeep — runs on a schedule as **NFR routines** ([ADR-0014](docs/decisions/0014-autonomous-nfr-routines.md), [ADR-0017](docs/decisions/0017-routine-ownership-dependabot-and-the-attention-bar.md)). Six ship today. **[`docs/routines/README.md`](docs/routines/README.md) is the full contract** — routine table, budget enforcement, who may widen a budget, `ready-for-human` / `ready-for-agent`, the one-branch-at-a-time preflight, tiers. Only these three rules are not stated in that contract:

- **Eight jobs run between `0 15` and `45 0` UTC** (23:00 → 08:45 in the owner's GMT+8), in a dependency order: producers longest first so a long job at the head absorbs its own overrun, `prune` ahead of `digest` so the morning report names what went, and `review` → `improve` → `resolve` → `digest` behind them. `deps` (`30 4,14 * * *`) is off-ladder on purpose. Table + measured worst-case end of each rung: [`docs/routines/review.md`](docs/routines/review.md). `npm run verify:agent-infra` fails if a rung leaves the 15:00–01:00 UTC window, is missing from the table, or if a mirror table disagrees with a playbook's `schedule:`.
- **`verify:ratchet` is the `improve` routine's work queue, not a gate** — root-doc byte counts, monolith LOC and lint warnings may only fall, strict-island and suite counts only rise; budgets in `docs/agents/ratchet.json`, widened only with a written `reason` (contract § no silent loosening).
- **One fleet per 24-hour window** — any automation with write access to product code needs a row in `docs/routines/README.md` or `docs/automations/README.md`, and `digest` watchdog 7 reports branches matching no registered `prTitlePrefix`. Two unregistered automations can price the same bug the same night (#442 vs #446).

Ledgers under `docs/routines/ledger/` are the durable memory across cold-start runs — read one before starting, append a row when finishing, including runs that changed nothing.

## Scheduled feature automations

Slot-quality work — validation gates, prompts, benches, renderer fixes for one diagram mode, the lived-in feel of the office — runs on a separate shelf: [`docs/automations/`](docs/automations/README.md). Same three-piece contract (playbook + ledger + cron trigger) and the same `npm run routine:guard` budget enforcement, but these **do** touch product code (and never write slot content — ADR-0010 still applies).

| Playbook                                                     | UTC           | HKT        | What it improves                                                           |
| ------------------------------------------------------------ | ------------- | ---------- | -------------------------------------------------------------------------- |
| [`metaphor3d`](docs/automations/metaphor3d.md)               | `0 15 * * *`  | 23:00      | The 3D slot: ladder, layouts, scenes, composite, USDA                      |
| [`office-life`](docs/automations/office-life.md)             | `0 18 * * *`  | 02:00      | The isometric office: cast, memory, the visit trace                        |
| [`anything`](docs/automations/anything.md)                   | `30 19 * * *` | 03:30      | The Anything slot: policy lint, runtime rung, prompts                      |
| [`canvas-graph-edit`](docs/automations/canvas-graph-edit.md) | `30 20 * * *` | 04:30      | Direct manipulation on the canvas, all 28 families — **parked**            |
| [`god`](docs/automations/god.md)                             | `17 * * * *`  | hourly :17 | Production signals → brief (GHA; off-ladder; window `06–12` UTC; ADR-0019) |

Two standing rules those playbooks carry: **a visual change is verified by rendering it and the PR carries the evidence**, and **`DiagramCanvas.jsx` stays out of `canvas-graph-edit`'s `allowedPaths`** (a new family extends `diagramGraphEditNodeResolve.js` instead of growing the canvas component). Both are stated in full in their playbooks.

## CopilotKit skill note

The CopilotKit skill set lives in the git-ignored local `.agents/` folder (don't commit it); refresh with `npm run setup:skills` if it looks stale or missing.

## Environment and integration notes

- Health endpoint: `GET /api/health` (reports `llmConfigured` and `runtimeReady`)
- Built-in agents + collaboration: `/api/copilotkit/*` (including `session-events` SSE)
- External agents: `POST/GET /mcp` (Streamable HTTP); set `PUBLIC_BASE_URL` and production `INVITE_TOKEN_SECRET` for invite URLs; optional `ARCHISLOP_WEB_URL` when UI and API origins differ
- Never commit `.env` or secrets.
- **The office floor's rules are not in this file.** The commute state machine, the glass-room threshold, the getters-not-subscription render contract, locale bundle merging, spoken-vs-written TTS, the proximity ladder, and the browser-verification tricks are all findings about `officeFloor/` and its scenes — one copy each in [`docs/agents/domains/office.md`](docs/agents/domains/office.md), with the floor test traps in [`docs/agents/isometric-floor-tests.md`](docs/agents/isometric-floor-tests.md).

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
- **Where a new durable tip goes** (rule 8 of [`docs/routines/README.md`](docs/routines/README.md), restated here — that file is the contract). A finding about **one domain** goes in that domain's file under `docs/agents/domains/`, **once**, as a Short-form line naming the file it lives in — never mirrored back into the root files, which every session loads. A finding about the **whole repo** (a don't-touch path, a verify loop, a safety rule) goes in **both** [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md): Cursor starts from the first, Claude Code from the second, and a tip in only one leaves the other blind. Do not re-import domain depth that was deliberately scoped out, and do not mirror a repo-wide tip into a domain file.
- **Hub:** [`README.md`](README.md) — short intro, quick start bullets, doc index (no heavy Mermaid blocks; GitHub preview hangs on large diagrams).
- **Guides:** [`docs/guide/`](docs/guide/) — detailed prose and diagrams on focused pages (agents, validation, MCP Apps table, endpoints, config). Update the relevant guide file; add a README index row if you add a new guide.
- Write for readers, not parsers. Prefer prose and focused Mermaid diagrams over walls of config.
- When in doubt, update docs in the same commit/PR as the code change so behavior and docs stay in lockstep.

## Don't-touch list

- `.agents/` — generated CopilotKit skill files, git-ignored. Refresh with `npm run setup:skills`.
- `.env`, `.env.*` — never commit; ask the user if they need a new variable.
- `scripts/deploy-*.sh` and `scripts/push-*-secret-cloud-run.sh` — production deploy / Secret Manager scripts. Don't run unless asked.
- `apps/server/src/mcp/apps/mcpAppSessionBridge.js` — the MCP Apps postMessage/SSE wire protocol that every `*AppHtml.js` string talks to; a change here can strand external agents silently with no failing test. The HTML itself is **not** off-limits: `apps/server/test/mcpAppHtml.test.js` pins the preview script's load/render timeouts and CDN fallbacks, so drift is caught by a sensor rather than by a warning, and `npm run verify:mermaid-pins` guards the preview App HTML's Mermaid **CDN major**.
- `apps/server/bench-results/` — bench snapshots; don't hand-edit, regenerate via the bench script.
- `scripts/god/**`, `.github/workflows/god.yml`, `packages/shared/src/{godBudget,godSchemas,uxSignals}.ts` — ArchiSlop God's rails ([ADR-0019](docs/decisions/0019-archislop-god.md)): human PRs only; re-run the `god.yml` spike after touching `scripts/god/dsh/`.
- `apps/web/src/assets/audio/*.mp3` — baked ElevenLabs assets; don't hand-edit, regenerate via `./scripts/generate-office-audio.sh` (build-time only — never wire ElevenLabs into a route, CI, or a deploy script). See [`docs/audio-assets.md`](docs/audio-assets.md).
- `package-lock.json`, `skills-lock.json` — never hand-edit.

## Safety and hygiene

- Respect existing uncommitted user changes; do not revert unrelated diffs.
- Avoid destructive git commands unless explicitly requested.
- **`gh` issue/PR edits overwrite — they do not append, and empty input is a valid empty body.** `gh issue edit N --body-file -` with a heredoc that arrives empty silently deletes the description, and GitHub exposes no REST-recoverable revision of an issue body. Read the current body before writing one, and when a note is what you meant, use `gh issue comment`. Lost on 2026-09-01: #402's original body, reconstructed from its own run comments.
- Keep docs and commands aligned with actual `package.json` scripts.
- New baked audio assets go under `apps/web/src/assets/audio/` via `scripts/generate-office-audio.sh`, not by hand-editing `.mp3` files.

## Cursor Cloud: setup and AI backends

- **Environment file**: `.env` must exist (copy from `.env.example` if missing). Run `npm run setup` for `npm install`, skills refresh, and `gcloud` when missing; ensure `.env` is present before starting services.
- **Starting dev servers**: `npm run dev` launches the Express server (port from `PORT` in `.env`, default 4000) and Vite (5173) via `concurrently`. Verify with `curl http://localhost:$PORT/api/health`. No database or Docker required — diagram and collaboration state are in-memory per server process; optional `REDIS_URL` shares pairing codes across Cloud Run instances (slots are not Redis-backed).
- **AI features require a configured LLM backend** (typically `OPENROUTER_API_KEY` locally, Vertex on GCP). If none resolves, `llmConfigured` is false and intent/transform/analyze/stream routes return 503; the app still renders diagrams but generation will not work. `llmConfigured` is true when any backend resolves — DeepSeek, OpenRouter, and/or Vertex per `LLM_PROVIDER` (`resolveLlmBackend` in `apps/server/src/agents/llmProvider.js`); `auto` prefers **DeepSeek** for Brain when `DEEPSEEK_API_KEY` is set, with Vertex as the Cloud Run fallback. Full precedence table: [`docs/llm-config.md`](docs/llm-config.md).
- **Tests**: `npm test` runs all workspaces sequentially (shared → server → web); server uses Node's test runner, web uses Vitest. All tests pass without any API key. The authoring traps (a sweep with no companion non-empty assertion; `rerender(...)` and `advanceTimersByTimeAsync(...)` sharing one `act` block) are pinned in [`docs/routines/review.md`](docs/routines/review.md) § trap checklist; a `vi.mock` specifier that resolves nowhere fails silently — [`docs/agents/sensors.md`](docs/agents/sensors.md) § the `vi.mock` path check.
- **Lint / boundaries / `vi.mock` path resolution**: [`docs/agents/sensors.md`](docs/agents/sensors.md) — the canonical fix for each rule is in the tool output itself.
- **GCP access (`gcloud`)**: `npm run setup:gcloud` installs the SDK to `~/google-cloud-sdk` when absent, and runs `gcloud auth activate-service-account` if `GOOGLE_APPLICATION_CREDENTIALS` or `GCP_MERMAID_GEN` points at a service-account JSON file; it then sets project `mermaidgen` and region `us-central1` when that project is readable. Deployment and investigation reference: [`docs/deploy/gcp.md`](docs/deploy/gcp.md).
- **Cursor parity**: `.cursor/rules/sensors.mdc` is loaded in every Cursor session and points at the same sensor stack. The vladikk/modularity skill is mirrored at `.cursor/skills/modularity/` so Cursor agents can apply the Balanced Coupling Model without the Claude Code plugin; refresh with `npm run sync:modularity`. Semantic review: [`docs/agents/modularity.md`](docs/agents/modularity.md).

## Architecture docs (read before changing wire contracts)

The full index is [`docs/guide/README.md`](docs/guide/README.md); the four architecture pages (generative-ui, external-agents, AG-UI, A2UI), [`docs/office-continuity.md`](docs/office-continuity.md) and [`docs/canvas-graph-edit.md`](docs/canvas-graph-edit.md) are listed there. The one an agent must not skip: [`docs/agent-blast-radius.md`](docs/agent-blast-radius.md) — the impact map for if you change X, also change Y.

## Documentation map

Humans: [`README.md`](README.md) → [`docs/guide/README.md`](docs/guide/README.md). Coding agents: [`docs/guide/coding-agents.md`](docs/guide/coding-agents.md) → [`GLOSSARY.md`](GLOSSARY.md) → [`STRUCTURE.md`](STRUCTURE.md) → [`docs/recipes/`](docs/recipes/). Sensors: [`docs/agents/sensors.md`](docs/agents/sensors.md) — the canonical fix for each rule lives in the tool output.
