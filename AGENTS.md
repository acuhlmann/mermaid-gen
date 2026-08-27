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

Durable traps found by rendering these scenes headlessly (the recipe is the scoped skill under
`apps/web/.claude/skills/verify/`). The full list lives in [`CLAUDE.md`](CLAUDE.md); these are the
ones that will bite an edit.

- **Camera framing samples real vertices, not bounding boxes** (`sceneFraming.js`). A
  `circleGeometry`'s bounding box is a SQUARE, so a ground disc's phantom diagonal corners — the
  points nearest the camera — used to dominate the fit and push the subject to ~40% of the frame.
  New ambience components must set `userData[FRAME_IGNORE]`, and new substrate discs must be sized
  from their content rather than padded by a constant.
- **Fog is a fraction of the content radius, re-solved against the live camera distance**
  (`metaphorAtmosphere.js`). Never reintroduce absolute `near`/`far`: a fixed band sits behind a
  small scene and in front of a large one, which is what made big tree groves wash out.
- **`cylinderGeometry` is already axis-up.** The `rotation={[-Math.PI / 2, 0, 0]}` idiom is correct
  for circles/rings/planes and tips a cylinder onto its side — that shipped in `MachineScene` and
  rendered every gear as a wedge rolling on edge.
- **Labels declare priority, not visibility.** `ItemLabel` takes `importance` and `pinned`; a
  screen-space pass hides the loser of an overlapping pair. Group names are pinned; `accent: true`
  pins an item's own label through context.
- **`accent` is capped at two in the sanitizer** — it is the thesis marker and its label skips
  decluttering, so an over-marked scene re-creates the smear the pass exists to stop.
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
- **A shadow catcher is not the subject.** `MetaphorGroundShadow` carries
  `FRAME_IGNORE_DATA` because it is sized past the subject and invisible except where a shadow
  lands; left in the fit it framed the camera around a rectangle nobody can see (city 57 units
  against a 44-unit skyline, fused composite 30 against 20). Ask of any new mesh whether it is the
  subject or scaffolding, and flag the scaffolding.
- **Anything sized against the viewer is screen-relative, not world-relative.** The fog band, the
  GTAO radius (`screenSpaceRadius: true`) and the accent caption (scales by camera distance) all
  exist because these scenes run from a 14-unit cake to a 60-unit bridge and one world size cannot
  serve both.
- **AO thickness is capped under its radius.** The gradient sky is back-faced and writes no depth,
  so the background sits at the far plane and a stock `thickness: 1` rings every silhouette in
  black. `aoIntensity` is per theme because occlusion spends contrast the dark themes do not have.
- **IBL is generated, not fetched** (`SceneEnvironment.jsx` PMREMs the theme's own sky gradient).
  Do not reintroduce drei `<Environment preset>` — it puts a CDN fetch inside the renderer.
- **The accent callout draws over the scene** (stem, pin, caption are depth-test-free) because
  scenes keep drawing above their own anchors; and the accented item's `note` is now permanent
  caption copy, so `accent` without `note` is half a marker. Changing either side means changing
  `apps/server/src/prompts/metaphorSystemPrompt.js` too.
- **A link carries its own halo, and it states a direction** (`linkRoutes.js`). Relations were the
  least legible thing in every scene: a `dependency` line measured 1.70:1 as rendered against the
  bar its own caption clears (3.4:1), and a whiteboard `flow` line measured **lum 219 against a sky
  of 218** — one part in 255, i.e. absent. The fix is the labels' own: a casing in
  `theme.labelOutline` under a core in the link colour, so a link is readable against the sky, a
  tower it crosses, and a dark theme without any scene knowing which backdrop it painted. Two
  consequences to keep. `linkInk` is **not a no-op** — swept over every theme × kind exactly one
  pair fails and it is the default theme's most common link; keep the sweep in
  `metaphorLinkRoutes.test.js` when adding a theme. And the arrowhead is **depth-test-free** for
  the accent pin's reason: the first depth-tested version was invisible on every city link, buried
  inside the spire its own tower stacks above the anchor. Widths and the arrow are screen pixels;
  a muted or dimmed composite link **loses** the casing rather than gaining one, or receding makes
  the layer you dismissed louder.
- **In a fused world, a site's name goes UP, because no lateral answer can work.** Towers stand on
  islands, so an island's own label is inside its own landmark, and every planned sideways offset
  (near corner, away-from-landmarks, outward-from-centre) puts some fraction of the world's names
  behind a tower — the direction that clears one depends on where the viewer stands, which a plan
  cannot know. `assignSiteLabelPlacement` keeps the outward shoulder and adds `labelLift`: above
  the crest of the tallest node `attachedTo` that site, which IS a fact about the island. The glyph
  rides up with the name. Measured by ray-testing every label from the camera (recipe in
  `apps/web/.claude/skills/verify/`) over 3 composite fixtures × phone/cover/desktop: 71→80 of 148
  legible, 4→0 buried, no viewport worse. A camera-facing shoulder resolved per frame measured
  _worse_ (74) — it walks a back island's name into the tower of the island in front. Labels are
  pruned from the camera fit by material, so lifting one costs the subject no room.
- **The fused composite does not inherit shared chrome.** It shipped without `MetaphorAccents` and
  with unlabelled affinity rings; when a base kind grows a scene-wide affordance, check
  `FusedCompositeScene.jsx` for it. Group placards must show `group.display` (the user's raw noun),
  never `group.label` (the normalized matching token).
- **Adding a metaphor kind touches ten places**, and `metaphorUsdaFields.ts`'s `KIND_ITEM_FIELDS`
  is the one that fails the build rather than failing silently. Additive USDA fields also bump
  `METAPHOR_USDA_MAPPING_VERSION` and must round-trip (`docs/guide/openusd-approach.md`). Full list
  in `CLAUDE.md`.
- **Inspecting an item has two devices and one budget.** Hover (`metaphorHover.js`) answers a
  mouse; tap (`metaphorSelection.js`) answers a finger, because a touch "hover" is a flash under
  the finger. Never wire the tap through R3F's `onClick` — an orbit drag inside the canvas still
  fires a DOM click, so use `createTapGesture`'s down/up slop. The exclusion between the pick,
  the legend, the layer key and the tooltip is a `.metaphor-inspector ~ …` CSS rule, so
  `MetaphorInspectorPanel` must stay **first** among the overlay siblings in `MetaphorRenderer`.
  Size `MetaphorSelectionMarker` from the item's horizontal footprint with labels excluded — a
  bounding sphere around a tall tower rings the whole scene — that measurement now lives in
  `metaphorScenes/itemBounds.js`, shared with the guided read's camera so a ring and a framing
  cannot disagree. Verify by rendering (`apps/web/.claude/skills/verify/`), never by reading.
- **The camera frames the scene into what the panels leave.** Overlays are HTML siblings of the
  canvas, so the fit used to solve against the whole canvas and then have a title strip drawn over
  the answer — on a phone that strip is a fifth of the screen, over the part a tall subject needs.
  `metaphorScenes/overlaySafeArea.js` measures the persistent chrome (`[data-metaphor-chrome]`) and
  `solveFrameFit` reserves those edges. Tag any NEW persistent panel with that attribute; leave the
  read and the pick untagged (they are transient and already own the screen). The margin is applied
  inside `solveFrameFit` — multiplying the distance afterwards slides the subject back under the
  chrome. Full reasoning in `CLAUDE.md`.
- **The app's own fixed bands are chrome over this canvas too.** `.diagram-output` is full-bleed, so
  the composer band and the OS taskbar cover the bottom 139px of a phone and 101px of a desktop —
  every bottom-anchored metaphor panel used to be drawn under them. `TopShell.jsx`, `BottomRow.jsx`
  and `DeskOsTaskbar.jsx` carry `data-app-chrome`; the panels read
  `--metaphor-app-top-inset` / `--metaphor-app-bottom-inset`, and **each phone-block `bottom` has to
  re-state the variable** or the override silently puts the panel back under the band. A panel's
  edge is chosen by **thinnest claim, not nearest edge** (nearest read a wide band 7px off the left
  as a left-hand panel). Fullscreen keeps the chrome's layout rect and paints none of it, so the
  measurement skips anything outside `document.fullscreenElement`; the insights embed opts out with
  `measureAppChrome={false}`. Verify geometry by driving a browser, not by reading CSS.
- **On a short landscape window the chrome moves OFF the axis that ran out.** A foldable cover is
  height-bound twice: the app's own bands take ~29% of a 717x512 cover, and the letterbox that is
  left is fitted to by the height, so a roughly square-projecting world leaves ~60% of the width as
  empty gradient. A full-width reading strip there spends the scarce axis to decorate the abundant
  one. Under `@media (max-height: 620px) and (orientation: landscape)` the strip is a **side rail**
  — `overlaySafeArea` then picks the side edge on its own (a tall narrow card is cheapest to
  reserve there), and the camera's window goes from 717x282 (aspect 2.55) to 589x364 (1.62), about
  a third more subject in every direction with no panel moved on top of it. Cap a rail's width in
  **both** units (`min(38%, 15rem)`) and let its lines wrap: the base rules ellipsize the title and
  `nowrap` the axis chips because a band is wide and short, and in a rail that is pure loss.
- **Two metaphor panels can collide with each other, not only with the app.** In fullscreen the
  legend is left-anchored at `min(50% - 14px, 12.5rem)` and a composite's layer key right-anchored
  at `min(100% - 20px, 17rem)`, so below ~492px of canvas width they overlap — measured in real
  fullscreen on a 390x844 phone, 87x84px of key drawn across the legend's own axis rows. The layer
  key wins that corner (`@media (max-width: 500px)`): it is the fused world's only explanation of
  what each grammar is, and every legend phrase is still reachable from the guided read, the pick,
  and the reading strip's `+N` tooltip. It is a **sibling** rule, not a blanket hide, so a base
  kind's legend is untouched — which means `MetaphorCompositeLayersOverlay` must be declared
  **before** `MetaphorLegendOverlay`, one more rung of the one-panel DOM order below.
- **Pressing a row in the composite's layer key reads that layer alone.** The rest of the world
  recedes by **colour, never opacity** (`recedeTheme` in `metaphorScenes/sceneUtils.js` hands muted
  layers a theme lerped into the scene horizon) — a dozen faded bodies re-open three's
  transparency-sorting trap. That theme substitution is why focus touches almost no primitive; keep
  it that way, and remember additive extras (flow motes, link pulses) ignore colour and must be
  dropped explicitly. Store + contract: `apps/web/src/components/metaphorLayerFocus.js`.
- **A portrait canvas is looked at from higher up, a letterbox one from lower down — and the aspect
  that decides is the FRAMED one.** `frameDirectionForAspect` lifts elevation toward 52° as the
  aspect falls and drops it toward 19° as it rises past 1.6 (azimuth untouched). Pass
  `framedAspect(camera.aspect, safeArea)`, never `camera.aspect`: a 717x512 foldable cover is a
  comfortable 1.4 landscape while the window between its two bands is a 3.0 letterbox. It applies
  to the first fit, and a resize may re-pick it only while OrbitControls has raised no `start`
  event — the intro's programmatic auto-rotate does not count as the viewer choosing an angle.
  That is what makes a foldable unfolding behave and an orbited scene stay put.
- **Scene text is sized in pixels, not world units** (`metaphorScenes/metaphorScreenScale.js`).
  Keep its clamps pathological; a tight floor silently reinstates the bug on small scenes. Labels
  and the accent caption report their **pixel** box to the declutter pass.
- **Scene text is OUT of the camera fit — a name is not the thing it names.** A screen-constant
  label grows as the camera pulls back, so a fit containing labels is a fixed point rather than a
  constraint: measured on a 717x512 foldable cover, the city's geometry needed 45 units and its
  labels pushed the solve to 118, so the towers rendered at 22% of the canvas width.
  `collectFramePoints` prunes troika text by its material (as `itemBounds.js` does). Two things pay
  for it: `SceneFrame` reserves `ANNOTATION_HEADROOM_PX` above the subject (labels are drawn above
  their items), and the declutter pass drops labels that would be clipped or covered. Before adding
  any mesh, ask whether it is the subject or scaffolding for it.
- **A composite ranks its names one layer at a time, and world size is not one scale.** A fused
  world draws several grammars at once, and it ranked their names against each other by geometry:
  `height + radius` for a landmark, and **nothing at all** for a journey station, which fell to
  `importance = 0` and so tied with the link captions at the very bottom. A city tower is tall
  because towers are tall, not because it matters more than the river stage beside it — measured
  over the three composite fixtures at phone/cover/desktop, the journey layer came out at 15 named
  stages of 36, and on a phone the toaster's river was silent altogether. `assignLabelRanks`
  (`fusedCompositePlanner.js`) now drains the layers **round-robin**: every layer's first name
  outranks every layer's second, in the order the author declared them, ordered inside a layer by
  that layer's own metric. Ranks must be **distinct** — an earlier attempt tied each layer's head
  and let the pass break it, which it does by nearness, and nearness knows nothing about layers
  (the toaster's two-tower city then lost both names on all three viewports). The substrate keeps
  a ladder of its own above the landmarks (`FUSED_SITE_LABEL_BASE`), which is what
  `SITE_LABEL_CREST_CLEARANCE` already assumed and `radius * 3` did not deliver; folding it into
  the shared round-robin was measured and is worse. Result: 22 named stages of 36, the same total
  label count, and what it trades away is link captions. Pinned placards are unaffected.
- **`layerKey` is the declutter pass's half of that, and the invariant is worth more than the
  count.** `resolveLabels` walks every layer's FIRST surviving name before any layer's second, and
  keeps trying a layer until one of its names lands — one delegate per layer is not enough, because
  a layer's top pick may be the one the canvas edge clips or a panel covers. Pinned labels are
  still walked first (they cannot be blocked, so anything ahead of one would claim a placard's
  space and be drawn over). A base kind passes no `layerKey` and the rule no-ops, which
  `metaphorLabelDeclutter.test.js` pins with a control arm — without it, a passing test proves
  nothing, since the same three labels resolve identically when nothing declares a layer.
- **Searching the camera's AZIMUTH for a better fit was tried and does not earn its keep — do not
  redo it.** `frameDirectionForAspect` leaves azimuth alone; restricting a search to the four
  diagonals (so "built, not plotted" survives) and picking the shortest solve looked compelling on
  paper: over three composites and a five-service city at phone/cover/desktop, the default corner
  solved 2–23% further away than the best. It is a trap. **Distance is the wrong score** — the
  corner that frames an elongated world most cheaply is often the one that runs its long axis into
  depth, which lines the items up behind one another; the phone city came out 18% taller and lost
  three of its nine names. Scoring instead by how far apart the names land (which contains the
  distance term, since a bigger frame spreads them) measured **+3 legible labels out of 257**:
  three wins, three losses, noise. The general lesson is the one the label-placement work already
  paid for — a framing change only becomes decidable once every label is scored, and a picture that
  is bigger but reads worse is not an improvement.
- **The declutter pass knows where the panels are, and "unreadable" beats "contested".**
  `measureChromeRects` (the panels' real rects, NOT the camera's span-discounted safe area) feeds
  `resolveLabels`; a clipped or covered label yields instead of holding its box. Pinning buys a
  **laxer bar, not an exemption** — a fused world's placards sit at the frame edge by construction
  and the accented item's label floats into the reading strip on short screens. Coverage is the
  largest single panel, never the sum (composer band and taskbar overlap on every phone).
- **Two opposed panels are the one case where reserving honestly is worse than overlapping.**
  `MIN_AXIS_WINDOW` floors what an axis keeps for the subject (0.55) and scales the excess back
  across the pair in proportion; the annotation headroom is applied after that, being the subject's
  own margin rather than a panel's claim.
- **The accent caption stands down where the reading strip is a band** (`accentCaptionFit.js`,
  720px — the same breakpoint App.css uses). The strip already prints that exact sentence, so below
  it the caption is the thesis twice within one glance, drawn over the subject. The pin, stem and
  ring stay.
- **The compact reading strip caps its axis chips at three on a small canvas**, with a `+N` counter
  naming the rest in its tooltip. Six authored phrases built a 277px band on an 844px phone and the
  camera reserved all of it. Same markup on every canvas; the phone and short-landscape CSS blocks
  decide, so the safe-area measurement follows for free.
- **The reading strip's squeeze is spent on its chips, never on the scene's name.** The strip is a
  flex row of heading + axes, and with only `min-width: 0` the heading lost every fight: on a
  1440x900 desktop the fused commerce world rendered "Commerce plat…" over 700px of empty strip. A
  chip already has somewhere to go (it wraps, and below the small-canvas limit it folds into the
  `+N` counter that names the rest in its tooltip); a truncated title is nowhere else on screen.
- **A group's name never goes where its own members stand.** City district placards go on the
  patch's near edge, garden bed placards likewise (they were on the far edge and behind their own
  plants until this pass), fused affinity placards stand at `group.surfaceY` (their ring is on the
  ocean the islands sit on), and an island's own label goes outward from the world centre. A
  territory named after one of its members (`namedByMember`) gets no placard at all — the member
  already carries the word. **The archipelago `chain` is the open exception**: its circles overlap
  and their centres cluster at the world centre, so `± radius` on any single axis lands the name on
  open water nowhere near its islands or past the frame edge — measured at 717x512, the near-edge
  move put DISCOVER in a corner and BUY off-canvas, strictly worse than hidden. The real answer is
  the planner's `assignSiteLabelOffsets`, which needs the chain plan to carry an offset the way a
  fused site does; the code says so at the call site rather than shipping a different wrong place.
- **Open water past the subject is scaffolding** — the iceberg's sea plane carries
  `FRAME_IGNORE_DATA`, like the shadow catcher and the fused ocean disc.
- **So is the ground itself, and that is the bigger win.** Every grounded kind stands on a disc
  sized `max(floor, contentRadius x pad)` — 1.3-1.5x the widest item on an ordinary 6-10 item
  scene, and a CIRCLE around a layout that is rarely circular, so its rim reaches furthest exactly
  where nothing stands (city subject at 77% of the width it could have, garden 65%). City footing,
  cycle plaza, machine plate, tree and river meadows, garden lawn, subway plate and the
  archipelago ocean all carry `FRAME_IGNORE_DATA` now; `metaphorSceneFraming.test.js` sweeps all
  eight. Cutting a ground plane off at the frame edge is also the better picture — a floor that
  runs out of frame reads as a world, a disc with margin all round reads as a coaster.
- **The lateral gutter that pays for it is a few glyphs, not half a label.**
  `ANNOTATION_GUTTER_PX` (26) is the horizontal `ANNOTATION_HEADROOM_PX`. Both ends were measured
  on a 390x844 phone: at 58 (half a plate) the fused composite came back SMALLER than before the
  substrate change and one label short, because its ocean was already out of the fit — it paid and
  collected nothing; at 0 the city and composite were bigger with MORE names, but the subway's
  "SIGNUP" clipped to "SIGNU". The job is only to buy back the last glyph of a name the pinned
  on-canvas relaxation has already decided to keep.
- **A label's RANK is visible now, and a scene passes the noun, never a font size.**
  `labelRoles.js`: `item` (chip + name, unchanged), `group` (a territory — uppercase,
  letter-spaced, **no chip**, heavier outline: a region name is written across its ground, not
  stamped on a card standing in it), `link` (a relation — smaller, fainter chip). Before this a
  district placard, a service and an edge caption were the same white chip; measured on the city,
  six identical chips down one diagonal where three were towers, two were districts and one was an
  edge. Adding a placard means passing `role="group"` — `metaphorLabelRoles.test.js` sweeps all
  eight placards and both link captions, because a missed one still renders, just wearing the
  wrong rank.
- **A scene-identity colour is picked as a SURFACE and has to be re-picked as type.**
  `ensureReadableInk(ink, halo)` in `sceneUtils.js` walks lightness away from the outline until it
  clears 3.4:1, keeping the hue — a darkened yellow still reads as the yellow line. It exists
  because dropping the group placard's chip left the subway's route names on nothing but their own
  halo: "SIGNUP" and "BUY" measured 1.16 and 1.35 against white, i.e. invisible, and route names
  are the one thing a transit map publishes. Direction is read off the halo, so dark themes need
  no second rule.
- **A distant bird has to LOSE contrast with its sky.** `SoaringBirds` wings were 3.5:1 quads in
  near-black at 0.8 alpha and drew as ~30px hard dark chevrons that read as rendering artefacts
  (reported as "stray dark checkmarks"). Now ~7:1, 0.55 alpha, and lerped 42% toward `hazeColor`
  (the scene's own horizon) — aerial perspective, the same rule `recedeTheme` follows. Anything
  genuinely distant that does not lose contrast is a hole punched in the sky.
- **The guided read outranks every other panel, and its camera is aspect-solved.** `metaphorTour.js`
  orders what the DSL already says (title → legend → standout → link → thesis, thesis LAST; a
  composite goes layer by layer, never a global peak). `MetaphorTourPanel` must stay **first**
  among the overlay siblings — the `.metaphor-tour ~ …` exclusion is the same mechanism as the
  pick's, one rung up. `MetaphorTourCamera` solves its distance against `min(tanV, tanH)`: a fixed
  radius multiple that frames a tower on a desktop runs it off both sides of a ~0.46-aspect phone.
  A short landscape screen (717x512 foldable cover) misses the 500px cover query, so the read has
  its own `(max-height: 620px) and (orientation: landscape)` rule plus a sticky nav row. Full
  reasoning in `CLAUDE.md`.

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

## Scheduled feature automations

Slot-quality work — validation gates, prompts, benches, renderer fixes for one diagram mode — runs
on a separate shelf: [`docs/automations/`](docs/automations/README.md). Same three-piece contract
(playbook + ledger + cron trigger), same `npm run routine:guard` budget enforcement, but these
**do** touch product code (and never write slot content — ADR-0010 still applies). Today:
[`docs/automations/anything.md`](docs/automations/anything.md) (daily Anything improvements).
When you learn something durable from a feature-automation run, mirror it in **both** this file and
[`CLAUDE.md`](CLAUDE.md), same as NFR routines.

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
- **A soft errand is defined by the timer it does not have.** `errand` in
  `apps/web/src/state/officeMomentStore.js` (slice 26): Linda's email grows a **Go and find
  Chad** CTA, pressing it stands you up carrying one, and speaking to Chad on _either_ renderer
  settles it for 5 XP plus a log line. Three things look like oversights and are not. **No TTL,
  reminder or re-offer** — ADR-0010 consequence #4, since a quest that nags is the quietest way
  to break it. The email marker **raises nothing on arrival**; only the press does. And it is
  **not** in `hasActiveOfficeSurface`, which gates the ambient director — counting something
  with no expiry there would hold the office silent until you ran it. Its card is the **last**
  rung in `FloorCardSlot` and its narration replaces only the **at-rest** line: it is the first
  durable entry in two orderings built for momentary ones, so ranking it higher suppresses
  every transient offer and stops the live region reporting movement.
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
- **Office continuity (working memory + runWalk) shipped in v1.** Colleagues feel
  real because the same person remembers you, not because they talk more. Spec:
  [`docs/office-continuity.md`](docs/office-continuity.md) and
  [ADR-0013](docs/decisions/0013-office-continuity.md). Working memory records and never
  triggers. The only new initiation is a completed run (`runWalk` on the floor, IM at the desk,
  existing run-reaction budget). Adding a situation is still a four-place contract: enum,
  predicate, rule block, reminder — never reuse `run` or `walkover` for this beat.
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
- **The cadence carries two wall clocks; pick by what the fact changes.** `OFFICE_DAY_PHASES`
  is what the room _looks_ like (mugs, papers, light); `WANDER_BIAS_WINDOWS` / `wanderBiasAt` is
  where people _go_ (slice 24's afternoon slump). Do not add a sixth day phase to express an
  hour-shaped fact about movement — 3 pm looks like 11 am, so a phase would change the light and
  owe `officeFloorStyles.test.js` a sixth rule for nothing. Both dials live in `officeCadence.js`;
  the floor still owns only the art. And a **weighted pick must consume the same number of
  `Math.random()` calls as the uniform one** — repeat list entries and roll once, never roll again
  to decide whether the bias applies, or you re-seed every unpinned floor suite (see below).
- **The wall clock (slice 25) is a third _face_ of the same clock, not a third clock.**
  `FloorWallClock` reads `officeWallClockAt` (cadence), the same instant the phase dial reads, so
  the hands and the light can never disagree about the hour. A clock that read its own `Date`, or
  a one-second second-hand poll, would repaint the floor continuously against the
  "re-render only on change" budget — `OFFICE_WALL_CLOCK_POLL_MS` is a heartbeat and the poll
  bails on a same-value set. Placement is `FLOOR_WALL_CLOCK` in `officeFloorPlan.js`, drawn via
  the plan module's `wallPoint` (the windows share it); the face is self-lit (reads on all five
  phase walls) and unanimated (owes the reduced-motion block nothing).
- **A mounting floor test inherits `Math.random` too, and that one is shared across the file.**
  `useFloorWander` sends somebody out on an unstubbed roll, so an unpinned suite depends on the
  PRNG stream — and any change anywhere that consumes a different number of randoms re-seeds who
  is wandering and where. Slice 23 consumes one fewer and turned `officeFloorDwell.test.jsx` red
  on a test that **passed in isolation and failed in file order**, which is the signature of this
  class. Pin with `vi.spyOn(Math, 'random').mockReturnValue(0.75)` (the floor suites' seed: Chad
  to the whiteboard) unless the suite is genuinely about the roll.
- **Since slice 24 the seed alone is not enough — pin the hour as well, or "0.75 puts Chad at
  the whiteboard" is only true 21.5 hours a day.** The two globals above stopped being
  independent when `wanderBiasAt` gave the clock a say in _where_ a seeded wanderer goes (3× the
  coffee machine from 14:00 to 16:30), and it shipped that way: slice 23's join tests and two
  `officeFloorWander.test.jsx` describes were red on `main` every afternoon and green the rest of
  the day. The signature is brutal — the coverage assertions still pass (he _is_ Chad, he _is_
  settled, just at the wrong prop), so the failure reads as a broken card rather than a clock,
  and nothing in it mentions the time. Any floor suite that mounts and asserts on geometry needs
  **both** `vi.setSystemTime(new Date(2026, 7, 11, 12, 0, 0))` and the 0.75 seed.
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
