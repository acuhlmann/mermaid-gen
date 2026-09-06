# Metaphor3D scene gotchas

**Scope.** Everything under `apps/web/src/components/metaphorScenes/`,
`apps/web/src/components/MetaphorRenderer.jsx`, `apps/web/src/utils/metaphorLayouts/`,
`apps/web/src/utils/metaphor*`, `packages/shared/src/metaphor*`, and the server's metaphor ladder.

**Who loads this, and how.** One file, four readers — deliberately agent-agnostic:

| Agent           | Route in                                                                     |
| --------------- | ---------------------------------------------------------------------------- |
| Claude Code     | `apps/web/src/components/metaphorScenes/CLAUDE.md` (auto-loaded in that dir) |
| Cursor          | `.cursor/rules/metaphor3d.mdc` (glob-scoped, `alwaysApply: false`)           |
| qwen and others | the index table in [`AGENTS.md`](../../../AGENTS.md)                         |
| any of them     | [`docs/automations/metaphor3d.md`](../../automations/metaphor3d.md)          |

**Why it is not in the root files any more.** This content was written into `CLAUDE.md` (54 KB)
**and** `AGENTS.md` (27 KB), by the mirroring rule that used to require both. Both root files are
read in full at the start of every session in this repo — so that was ~80 KB, roughly 20 k tokens,
paid by every agent run whether or not it went near a 3D scene, and growing every night. Nothing
here is less important than it was; it is scoped to the code it describes.

**Adding to this file.** Put the finding here, once. Do **not** copy it back into `CLAUDE.md` or
`AGENTS.md` — that rule is retired for domain content (see `docs/routines/README.md` rule 8). A
finding about the _whole repo_ rather than about this domain still belongs in the root files.

**Everything below came from a screenshot, not from reading the code.** The capture recipe is
[`apps/web/.claude/skills/verify/SKILL.md`](../../../apps/web/.claude/skills/verify/SKILL.md).

---

## Short form

The same findings, condensed — one entry each, naming the file it lives in. This is the operator
form that used to live in `AGENTS.md`; the long form below is the one that used to live in
`CLAUDE.md`. **They cover the same set**, and each has something the other lacks: the short form
carries the file and component names, the long form carries the measurement and the reasoning that
made each rule a rule.

Read the short form to find the entry you need, then its long-form counterpart before changing what
it names. Merging the two into a single pass is worth doing and is not urgent — it is a good
`improve` slice, not something to attempt while fixing a bug.

Durable traps found by rendering these scenes headlessly (the recipe is the scoped skill under
`apps/web/.claude/skills/verify/`). The full list is below under **Full findings**; these are the
ones that will bite an edit.

- **A categorical grouping axis has to be visible on the BODIES that carry it**
  (`metaphorScenes/groupIdentity.js`). District, bed, chain, affinity group — the legend promises
  the viewer that grouping is drawn, and it was not: every city tower was `theme.buildingColor`
  whatever its district, every garden bed's edging clamped to white, and every fused island was one
  green over one brown, so the commerce composite's three domains merged into a single landmass.
  `tintByGroup(base, index, strength)` nudges the scene's OWN colour along a fixed hue ladder —
  group 0 is the identity, so an ungrouped scene is unchanged. Three rules if you extend it: never
  substitute a palette entry (`districtPalette` is four shades of one hue, `clusterPalette`'s four
  hues are unevenly spread, and both make two groups agree); never darken (a darkened saturated
  colour reads as louder, which is how the first pass produced a shouting indigo district); and put
  the tint on the GROUND wherever a body already carries an encoding — a garden plant's colour is
  its `health`, so the soil takes the group instead. `GROUP_TINT_EARTH` is the reduced strength for
  a real substance (soil, foliage) whose believable hue band is narrow.
- **A grouping colour must be an ordinal, never a hash.** The fused planner drew `colorIndex` from
  a seeded uniform over eight slots, so a three-group world had two territories the same colour
  about a third of the time and a five-group world more than half — and a collision does not read
  as a bug, it reads as two territories agreeing, which is the one thing a shared grouping noun
  exists to deny. Assign after the `memberIds.size >= 2` filter, by array index.
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
- **The one thing the callout must never eat is the name of the item it marks**
  (`metaphorScenes/metaphorDrawOrder.js`). Every scene writes an item's name directly above that
  item, at the same `(x, z)` as its accent anchor, and a vertical stem at that `(x, z)` projects to
  a screen line through the projection of every point on it — so no camera, framing or anchor
  change can separate them, and draw order is the only thing that decides it. The accented item's
  chip and glyphs are the last things drawn and the only labels exempt from depth. Two traps sit
  underneath and each is invisible to the check that catches the others: **a mesh with
  `depthTest: false` must also set `depthWrite: false`** (it otherwise stamps its distance into the
  buffer and DELETES later depth-tested glyphs, leaving no coloured pixel where the letter was, so
  a diff of the marker's colour scores it clean); and **`material-depthTest` on an outlined troika
  `<Text>` is a silent no-op** — with an outline the `material` getter returns an ARRAY, so r3f's
  pierce assigns onto the array. Use drei's `onSync` and set every entry. Measured over six kinds ×
  phone/cover/desktop: 8.2% of the accented name's own area was being altered by its own callout,
  13 of 18 cases over 1%, worst 30%; after, 18 of 18 render every glyph on a clean card.
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
- **In a fused world a landmark's own name stands past the site's shoulder, on its own bearing,
  because a fixed nudge stacks siblings.** `fusedCompositePlanner.js` `makeNodes` used to shift a
  landmark's `labelOffset` by 0.58 world units along the vector from the site's centre to the
  node — a small constant, so landmarks that happened to stand near one another landed inside
  the same screen slot and the declutter dropped one. The reach is now
  `max(0.85, site.radius * 0.6)` — for a radius-3.8 island that is ~2.3 units, which lands a lone
  landmark's name at the shoreline and puts two landmarks 90° apart on the same island roughly
  `2r` apart on screen. (The 0.85 is belt-and-braces, not a live floor for today's documents:
  `siteRadiusFor` clamps every radius to [1.8, 4.6], so the product is always ≥ 1.08. It exists
  so lowering that clamp cannot silently park labels back on their nodes.) A landmark whose
  position sits exactly at the site centre used to collapse the bearing to `(0,0)` — and the
  only way to reach that case is an **authored `item.position` that lands on the site**, not
  `nodePosition`'s own spread: its radial minimum is 0.12 of a radius that never drops below 1.8,
  i.e. 0.216, comfortably clear of the 0.05 threshold (#527 corrected the earlier text, which
  named the 0.12 bound as the cause and blamed it for a branch none of the three shipped
  composites ever enters — the walk is now unit-tested in
  `apps/web/test/fusedCompositePlanner.test.js`). Such a node walks the perimeter by
  `nodeIndex * GOLDEN_ANGLE + layerIndex * (TAU/5)` instead. Measured on the three composite
  fixtures × phone/cover/desktop with `browser.newContext({ reducedMotion: 'reduce' })` (see
  below): 88→100 of 148 legible, zero regressions, festival desktop 15→16 (full sweep). That
  measurement stands, but #527 established its recorded cause does not: the "Chrome Throne /
  Forgiveness Lever / Was It My Fault? all inside a 45-pixel square on the toaster's
  Breakfast-That-Burned island" anecdote is false — planning the fixture puts those three on
  three different sites >15 world units apart, with `was-it-my-fault` a galaxy accent, and **no
  two non-accent landmarks share a site in any shipped composite**, so the sibling-stacking
  mechanism is exercised by none of the measured documents and the gain is not attributable to
  it. Do not replace the anecdote with another guess at the cause — read this entry as
  "the shoulder reach is the placement rule; why the sweep gained twelve names is an open
  question", and re-derive before citing a mechanism.
  This is the same trap `assignSiteLabelPlacement` documents for the site's own name at a
  different scale — the answer is the same shape (outward past the shoulder), applied to a
  landmark's own scale.
- **A `fillOpacity`-off-live-scene probe drifts across the intro auto-rotate, but
  `browser.newContext({ reducedMotion: 'reduce' })` kills it in one line.** `MetaphorIntro` reads
  `matchMedia('(prefers-reduced-motion: reduce)').matches` and skips the whole 1.4 s auto-rotate
  when it is true. Without that, three consecutive same-fixture same-viewport probe runs drifted
  by up to two labels per viewport (toaster phone 5 vs 7 vs 5 across three runs at 4.5 s of
  settle) — the auto-rotate had ended three seconds before the sample, but the declutter pass
  had stabilised on a not-quite-final camera position and stayed there. A longer settle wait
  does not help; 6.5 s and 8 s show the same drift because the drift is spatial, not temporal.
  With `reducedMotion: 'reduce'`, three consecutive runs match to the label. This applies to
  every camera-independent live-scene probe in this domain — the technique is legitimate (it
  needs no projection), and the reduced-motion flag is the missing preamble.
  **It is necessary and not sufficient: the verify skill's ~5 s settle is too short, and 9 s is
  where these scenes stop moving.** Measured on the subway slice with the flag already set, two
  identical 5 s runs of three fixtures × three viewports scored 68 and 70 legible names and
  disagreed on five names on the phone viewports alone; the same two runs at 9 s returned 78 and
  78, cell for cell identical, and the 9 s number is HIGHER — 5 s was sampling a scene still
  settling, so the shortfall reads as labels the change failed to rescue. Add a metric the
  declutter and the camera cannot touch as the control: **whether a name has any troika `Text` in
  the scene at all**, which is a fact about the render tree rather than about a frame. That one
  was stable to the name across all four runs (69 before, 87 after), and it is the metric that
  states the actual defect when the bug is a name the scene never builds.
- **A fused route is solved against the world's surface, and the moment it stopped flying it
  needed its own ink.** A path layer's stations sit on the sites they bind to and the spline used to
  run straight from one island's crest to the next, so the channel held island-top height over open
  water and over any third island in the way — a blue pipe laid across the map. Measured over the
  three composite fixtures, mean clearance over the ground beneath was 0.55–0.72 world units (worst
  1.69) and 42–86% of each route was more than a full channel width clear of it; after
  `routeAlongSurface` (`fusedCompositePlanner.js`) it is 0.154–0.157 mean, 0.35 worst, **0% aloft**.
  Four things are load-bearing. The surface model is a **smoothstep dome** per site over a flat sea
  — a cylinder puts a wall at the shoreline and a cone or hemispheroid has its steepest slope
  exactly AT the rim, which is where a channel spends most of its samples, so both put a kink where
  the route crosses the beach. **Stations keep their own height and are never re-solved by the pass**
  (they are what the labels, glyphs, markers and hover anchors are placed from); only the samples
  between them and the two tangent tails are. A **bridge is exempt** — a crossing's whole thesis is
  the gap it spans. And the one that is not obvious until you look: **the channel and the ocean were
  both `theme.waterColor`, so only ALTITUDE had been telling them apart** — the first correct-looking
  version of this change made the journey layer vanish into the sea it now lies in. The ink is
  `theme.riverDeepColor` with `ensureReadableInk` at **1.7:1** as a floor, not the 3.4:1 type bar,
  which came back near-white and read as foam. A muted layer keeps the flat ink for the reason the
  link casings already document. Framing and labels both measured neutral across 3 fixtures ×
  390x844 / 717x512 / 1440x900 (subject pixels up in 8 of 9, net +1 legible name).
- **`scale` on a tube mesh squashes the CURVE, not the profile.** `FusedPath`'s crossing branch
  carries `scale={[1, 0.45, 1]}`, which reads like "flatten the deck" and actually pulls the whole
  bridge's elevation to 45% of what the planner placed. Flattening a channel the same way was tried
  and reverted: it would have undone the surface-following above and moved the route 24% outward on
  the other two axes. A profile cannot be changed by a mesh transform — three's `TubeGeometry` has
  no elliptical cross-section, so it would take post-processing the vertices against the curve. The
  crossing's 0.45 is left alone deliberately: no composite fixture carries a `bridge` layer, and
  changing it blind is exactly the move this domain's screenshot rule exists to stop.
- **A shared station writes a compound name, and a stacked label needs the box AND the anchor to
  know it.** `subwayNetworkLayout.js`'s `subwayStationTitle` joins an interchange's members with
  `\n`, deduped, in authored order — because drawing only `members[0]`'s label deleted every other
  member's concept from the picture, not merely from that frame: measured over three subway
  fixtures × phone/cover/desktop, **6 of 29 authored names had no troika `Text` in the scene at any
  viewport** ("Pack", "Preferences", "Semantic layer", "Feature store", "Serve", "Where is it?"),
  so hover was the only way to learn they existed. The suppression's stated reason — an interchange
  is ONE place and three stops there stamp one name three times over itself — is true and is not an
  argument for one name: the members are different user concepts the author declared co-located,
  and a real network answers that with King's Cross St. Pancras. Repeats still collapse, because
  the canonical example in `metaphorSystemPrompt.js` labels both members of its interchange "Auth".
  Two things a multi-line label costs, both in `labelRoles.js` and both invisible to a test that
  only checks the text: `labelPlateEm` must measure **the longest line for width and the line count
  for height** (measuring the joined string has the sign claim a box three names wide and drop
  everything beside it; reporting one line's height under-claims exactly the half the pass then
  lets a neighbour into — the same trap tracking and capitals already document, on the other axis);
  and troika anchors at the block's **middle**, so extra lines grow DOWN, which is where the thing
  being named stands. `labelStackLiftEm` lifts the drawn block by half a line per extra line, from
  **inside the screen-constant group** — a world-unit lift is undone by the camera like every other
  viewer-relative size here — and the declutter pass registers that lifted group rather than the
  Billboard, or the box it reserves sits a lift below the box it draws. Measured: 60/87 →
  78/87 names legible, every one of the nine fixture×viewport cells improved or tied, and the one
  buried name in the baseline ("Ship", under its own platform) went to zero.
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
  already carries the word (the archipelago chain does this too now). **The archipelago `chain` was
  the open exception, and closing it says what a group placard's plan owes.** No lateral move fixed
  it — its circles overlap and their centres cluster at the world centre, so `± radius` on any axis
  lands the name on open water or past the frame edge (at 717x512 the near-edge move put DISCOVER
  in a corner and BUY off-canvas). The chain plan now carries `labelLift` + `labelOffset` the way a
  fused site does, and `ChainLabel` is `pinned` — it was the only group placard in any kind the
  declutter pass could drop outright. Three things were measured on 390x844 / 717x512 / 1440x900:
  the lift is a **ridge, not a floor** (raising it bought one island name on the phone and cost two
  placards on the cover); the shoulder points **away from the chain's own tallest island**, not out
  from the world, because the lift is measured from that island's crest and lands on its name —
  and when that island is the accented one, both labels are pinned, neither yields, and they draw
  on top of each other ("BUY" over "Payments"); and the shoulder is 0.32 of the chain radius, not
  the fused planner's 0.68, because the islands already reach the frame edge.
- **That rule had two more open violators, and nothing mechanical was checking.** The subway wrote
  each route's name at `curve.getPoint(1)` — its own terminus platform — and the machine wrote each
  axle's name at `-axle.radius * 0.78`, which is both the FAR edge and _inside_ the bed. Both
  placards are `pinned` and so is an interchange's name, so neither yields: on a 390x844 phone the
  subway drew 3 of 6 station names and the machine 1 of 5 gear names. Fixed by moving the geometry
  into the layouts (`subwayRouteSign`, `axle.placard`) where it can be asserted —
  `metaphorGroupPlacards.test.js` fails 5 of 7 against the old positions. Three things the fix
  taught, each of which cost a capture round:
  - **A route sign belongs PAST its terminus, along the direction of travel** — where a real
    platform signs a destination — not at it and not at the midpoint (which lands on whatever
    crosses there, the reason it was moved to the terminus in the first place).
  - **A lane diagram's long axis is the one a portrait canvas runs out of.** Pushing the sign along
    the track ran FULFIL off a 390px phone, because the camera frames the stations and the plate is
    `FRAME_IGNORE`. `subwayRouteSign` clamps to the network's own reach on both axes and spends
    what the clamp takes back on the near edge (+z), the short axis, which is free.
  - **Height and lateral offset fix different cameras, and height is not free.** A steep phone
    camera collides the sign with the platform it names (lateral offset fixes that); a flat 717x512
    cover projects it down onto the platform's face (only height lifts it off). But the sign is
    pinned and a station name is not, so raising it back to its old 1.7 won the declutter pass
    against the very names it had just stopped colliding with: 5 of 6 station names down to 3 of 6
    on the cover. Lateral offset is the fix; height only trades. It sits at `TRACK_Y + 1.15`.
  - The machine's placard is measured from where the gears **actually ended up**, not from
    `axle.radius`: the `mesh` pull drags partners into contact _after_ each bed's radius is
    recorded, so a placard sized off the bed alone ends up under a gear that has since slid out.
  - Counted across 390x844 / 717x512 / 1440x900: subway 22 → 24 readable of 27, machine 9 → 18 of
    24, and zero group placards left drawn on their own members in any of the six captures.
- **Clearing a group's own members is necessary and not sufficient, and the subway proved it.**
  The route sign above cleared every platform rim in plan view and still deleted the terminus
  station's name: measured on three fixtures x three viewports, only **17 of 24** terminus names
  were drawn, and hiding the signs brought back **exactly those 7 and no others**. Two reasons the
  plan-view test cannot see. A placard sits about a metre above the plate, so a tilted camera
  projects it straight back down onto whatever is under it — which is why the height ladder in the
  entry above only ever traded victims. And the `reachX` clamp had already eaten the along-track
  standoff it was clamping: the terminus IS the network's furthest station, so the clamp fires
  there every time and hands the sign back to the rim it just left. A route name now goes
  **alongside its own track, on a station-free stretch of it** — where a printed transit map names
  a line, and the one part of a lane diagram that is empty by construction. 65 of 66 station names
  legible, all 24 terminus names, all 24 route names kept (`subwayRouteSign`). Three things that
  cost a round each:
  - **Score the candidates, do not threshold them.** Taking the first placement that cleared a
    margin brought every terminus name back and lost three mid-route names instead — a candidate
    that scrapes past a test is still drawn into the neighbour it scraped past. Maximising the
    smallest clearance a placement leaves anywhere is what reached the ceiling.
  - **Two pinned placards need solving as a set.** Route names are pinned, so where two meet
    neither yields and one line's name prints through another's; per-route solving put ASSISTED and
    ENGINEER in the same square metre. Longest route first (it has the most gaps to give up), each
    scored against the ones already placed — but as a **penalty, never a second gate**: gating on it
    starved a two-stop line in a seven-stop network into the terminus fallback this whole change
    exists to stop using.
  - **A better model of the geometry measured worse.** Scoring x separation as worth less than z —
    correct, since a billboarded word is several times wider than it is tall — pushed signs off the
    lane axis into the neighbouring route's stations and cost three names (65 of 69 down to 62).
    The round metric ships. A model is a hypothesis; the probe is the referee.
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

- **A relation is hit-tested in SCREEN SPACE, not with a raycast**
  (`metaphorScenes/metaphorLinkPick.js`). The obvious pick target for a link is an invisible fat
  tube along its route; it cannot be made to work, for the reason every other size in this renderer
  is in CSS pixels — a tube's radius is a WORLD size, these scenes run from a 14-unit layercake to
  a 60-unit bridge, and a tap target has to be ~24 px on a phone at either. `MetaphorLinks`
  publishes each route's LOCAL points in `userData.archislopLink`; the picker multiplies by the
  group's world matrix, projects, and measures point-to-segment distance in pixels. Two rules that
  fall out. **A point behind the camera must be rejected, not projected** — `Vector3.project`
  divides by a negative `w` and returns a plausible MIRRORED position, which reads as a segment
  crossing the whole canvas and makes every tap near that diagonal pick it. And **the pick runs
  from the canvas's `onPointerMissed`**, which is what makes "a link wins only when no item was
  hit" structural rather than arbitrated: `HoverableItem` handles and stops its own pointer events,
  so a tap that reaches the picker is one no item claimed.

---

## Full findings

- **A scene's categorical grouping axis was drawn as a placard and nothing else, and a placard is
  the first thing a small screen throws away.** `district`, `bed`, `chain`, a fused world's
  affinity group — the legend names one of these in almost every scene, which is a promise that
  grouping is among the things the picture draws. It was not drawing it. Measured on the whiteboard
  theme: every `CityBuilding` painted `theme.buildingColor` regardless of district, so a
  four-district commerce city rendered in one blue; every `GardenBed`'s edging was built from
  `districtPalette` (a pale `#dbeafe`) and then lifted another 0.12 in lightness, which clamps, so
  every bed in every theme drew the same white border; and every `IslandPrimitive` drew
  `treeLeafColor` over `treeSoilColor`, so the commerce composite's three domains merged into one
  brown landmass and the layer key's "Archipelago · 3" was the only thing in the frame that said
  there were three of anything. **The mobile case is the whole argument**: a group placard is a
  label, so the declutter pass drops it first — on the 390×844 baseline `EDGE` came out as `GE`
  behind its own towers and `CATALOG` was gone entirely, leaving an axis with no representation on
  screen at all. A tint cannot be decluttered, costs no screen space, and survives at any distance.
  `metaphorScenes/groupIdentity.js` holds it, and four things are load-bearing. **Nudge the scene's
  own colour, never substitute a palette entry** — the same idiom as `ensureReadableInk` and
  `recedeTheme`; `districtPalette` is four shades of one hue and `clusterPalette`'s four hues are
  unevenly spread (190° sits next to 155°), so either one makes two groups of a four-group scene
  agree, which is the exact failure being fixed. **Group 0 is the identity**, so a one-district city
  is byte-identical to before and only a scene that has the axis pays for it. **Every rung LIFTS
  lightness**: the first pass laddered both ways and the worst district was the one that had barely
  moved in hue, because darkening a saturated colour is the fastest way to make it look more
  saturated — `-0.08` turned the theme's own blue into an indigo that shouted over the four it was
  meant to sit beside. And **saturation falls as the hue travels**: at full saturation the ladder is
  correct and unusable (blue, mint, magenta, indigo — unmistakable, and nothing anyone would put in
  front of an architecture review), while muting in proportion to the distance leaves the chalked
  versions of those hues, which is what neighbourhoods should look like. Where a body **already**
  carries a colour encoding the group takes the ground under it instead — a garden plant's colour is
  its `health`, and two encodings in one channel would stop an at-risk plant reading as at-risk.
  `GROUP_TINT_EARTH` is the reduced strength for a real substance: the full ladder walks a warm
  brown a third of the way round the wheel, which in the garden lands the second bed on a green
  that argues with the lawn it is set into. An island's **sand deliberately does not move** — a
  shoreline is the one thing the islands genuinely share, and holding it fixed is what keeps three
  tinted islands reading as one archipelago rather than three unrelated worlds.
- **A grouping colour is an ordinal, never a hash.** `makeGroups` drew `colorIndex` from
  `Math.floor(seeded(worldKey, key, 'group-color') * 8)` — a uniform draw over eight slots, so a
  three-group world had two territories the same colour about a third of the time (1 − 7/8 · 6/8)
  and a five-group world more than half. It is a bad failure to have left to chance because it does
  not look like a bug: two territories simply agree, which is the one thing a shared grouping noun
  exists to deny. Seeding bought nothing — the groups are already in a stable declaration order and
  there is no second world to stay distinct from. Assign by array index, and do it **after** the
  `memberIds.size >= 2` filter, or the dropped groups eat slots and the survivors collide anyway.
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
- **A relation is a claim, and it was drawn as a scratch — links now carry their own
  halo and state a direction.** The items say what the topic is made of; the LINKS
  say how the parts stand to one another, which is most of what understanding it
  means, and they were the least legible thing in every scene. Three measurements
  on the default whiteboard theme. A `dependency` line came to **2.56:1 nominal and
  1.70:1 as actually rendered** — a 1 px line is mostly antialiasing, so it never
  reaches its own colour — against the **3.4:1** bar `ensureReadableInk` already
  holds the caption printed on that same line to. A `flow` line was worse and
  invisible for a reason nobody would look for: it is drawn in `binaryGlowColor`,
  the same pale yellow the scene glows with, and its peak pixel in a 1440×900 city
  capture measured **lum 219 against a sky of 218** — one part in 255, not faint but
  **absent**. And there was **no direction at all**: `from`→`to` is directional in all
  three kinds, only `flow` carried a pulse, so "Orders depends on Payments" and its
  opposite rendered identically. The fix is the one the labels already use — a
  **casing** in `theme.labelOutline` under a core in the link colour (`linkRoutes.js`),
  which is what makes a link readable against the sky, against a tower it crosses,
  and on a dark theme _without any scene knowing which backdrop it painted_: galaxy's
  near-black space and garden's pale blue take the identical treatment. Four things
  are load-bearing. **`linkInk` is not a precaution** — swept over every theme × kind,
  exactly one pair fails and it is the default theme's most common link (`#fef08a` at
  1.16:1 → `#928001` at 3.95:1, still yellow, because nudging lightness rather than
  substituting a neutral is what keeps a kind readable off its colour); adding a theme
  means keeping that sweep in `metaphorLinkRoutes.test.js`. The **arrowhead is
  depth-test-free**, the accent pin's call by the same door — the first depth-tested
  version was invisible on _every_ city link, buried inside the spire its own tower
  stacks above the anchor, and a taller standoff only moves that to the next kind.
  Widths and the arrow are **screen pixels** (the sixth time that rule has been paid
  for here), tapering only past ~24 links and never back to the hairline. And in the
  fused composite a **muted or dimmed link loses the casing rather than gaining one**
  — a haloed line is louder, so haloing what the layer key just dismissed makes
  receding a way of shouting. Links are also out of the camera fit now: they join
  items already in it, and Line2's `attributes.position` is the unit quad template
  rather than the polyline, so an unflagged link was contributing a phantom 2-unit
  box at the origin.
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
  Four rules are load-bearing. **One edge per panel**, the one a reservation is _thinnest_ on — a
  corner card is not a frame and reserving both its edges pays for it twice. **A corner card costs
  less than a band**: the claim scales with how much of the perpendicular axis the panel spans,
  because a scene can lean away from a card and cannot lean away from a strip. **The transient
  panels are excluded** — the read and the pick are user-raised and already own the screen through
  the one-panel CSS rule, so refitting when one opens would slide the scene sideways at the moment
  the viewer is reading about one item. And the **margin is applied inside** `solveFrameFit`, not by
  the caller: the off-centre shift is proportional to the final distance, so multiplying afterwards
  slides the subject straight back under the chrome by exactly the margin. Adding a persistent
  panel means tagging it; `metaphorOverlays.test.jsx` pins the tagging panel by panel, because a
  sweep over a set nothing joins passes while examining nothing.
- **The app's own bands are chrome over this canvas too, and the bottom one had never been
  measured.** `.diagram-output` runs the whole viewport, so the composer band and the OS taskbar
  paint over the bottom **139px of a 390x844 phone, 141px of a 717x512 foldable cover and 101px of
  a 1440x900 desktop** — and every panel anchored to the canvas's bottom edge was drawn underneath
  them, the guided read's Back/Next included. `TopShell.jsx`, `BottomRow.jsx` and `DeskOsTaskbar.jsx`
  carry `data-app-chrome`, and `measureExternalChromeInsets` publishes
  `--metaphor-app-top-inset` / `--metaphor-app-bottom-inset` for the panels while the fractional
  path reserves the same bands for the camera. Four things this cost, each worth keeping. The
  edge-choice rule had to become **thinnest claim, not nearest edge**: the composer band sits 7px
  from a phone's left and 42px from its bottom, so nearest-edge read a 97px-tall band as a
  left-hand panel and claimed 94% of the left edge. The edge is picked on **raw** thickness and the
  span discount applied only to the winner — discounting first makes a thin full-width strip's
  left, right and top claims agree to within a rounding error, and which edge the reading strip
  lands on becomes a coin toss (it flipped to `left`, and the reading strip's own test caught it).
  Every `bottom` in the phone block has to **re-state the variable**, same specificity and later in
  the file, or the panel goes back under the band on exactly the screens where the band is tallest.
  And **native fullscreen keeps the chrome's layout rect while painting none of it**, so the
  measurement skips anything outside `document.fullscreenElement` — layout alone cannot tell you a
  fixed element is invisible. The insights embed opts out entirely (`measureAppChrome={false}`):
  `.bottom-chrome` keeps the width it pads away when the pane is open, so an embed inside that pane
  would reserve a band for chrome that has already stepped aside for it.
- **The composite's layer key is a control now, and receding beats hiding.** Pressing a row in the
  fused world's layer key reads that layer on its own; the others recede and drop their names
  (`metaphorLayerFocus.js`). Three decisions carry it. It recedes **by colour, never by opacity** —
  three sorts transparent objects by centroid distance, so fading a dozen bodies re-opens the
  sorting trap the iceberg's submerged blocks are opaque to avoid; `recedeTheme` in `sceneUtils.js`
  hands the muted layers a whole theme lerped into the scene's own horizon, which is aerial
  perspective and correct in the depth pass. That substitution is also what keeps focus out of
  thirteen primitive signatures: every body already derives its colours from `theme.*`, so only
  `IslandPrimitive` learns a `muted` prop, and only because it draws its own name. And the loud
  additive things — the river's flow motes, a link's pulse — are **unaffected by a colour
  substitution**, so they are dropped explicitly or a muted layer still wins the eye. Note the
  saturation is pulled toward _the horizon's own_, not scaled toward grey: scaling desaturates the
  horizon away from itself, so "recede" could move a colour further from what it recedes into.
  Links are judged by their endpoints — one that touches the focused layer survives, because what a
  layer is wired to is most of what reading it means.
- **A portrait canvas is looked at from higher up, a letterbox one from lower down — and the
  aspect that decides is the FRAMED one, not the canvas.** Almost every kind here is a wide flat
  world, and from the desktop three-quarter angle its footprint projects to under half its width in
  height — right in a landscape frame, wasteful in a portrait one (measured: the fused composite
  left 46% of a phone canvas empty above and below a width-bound world). `frameDirectionForAspect`
  lifts the elevation toward 52° as the aspect falls and drops it toward 19° as it rises past 1.6,
  and **touches only elevation** — the diagonal azimuth is what makes these read as built rather
  than plotted. The letterbox end is the one a foldable cover hands you: a 717x512 cover is a
  comfortable 1.4 landscape, while the window its reading strip and the app's composer band leave
  is a **3.0**, and those two want the scene seen from very different heights. `framedAspect`
  computes it; pass that, never `camera.aspect`. It applies to the FIRST fit only, and a resize
  re-opens the question **only while the viewer has not orbited**: OrbitControls' `start` event
  fires on input and not on the intro's programmatic auto-rotate, which is exactly the difference
  between "nobody has chosen an angle" and "this is the angle they chose". A foldable opening from
  a cover to an inner screen is a resize nobody asked for.
- **A short landscape window is height-bound twice, so its chrome must stop standing on the height.**
  A 717x512 foldable cover spends ~29% of its height on the app's own bands before the metaphor
  draws anything, and what is left is a letterbox. Every grounded kind here projects roughly square
  — towers and all — so it fits to the HEIGHT and leaves about 60% of the width as empty gradient.
  A full-width reading strip in that window is spending the axis that ran out to decorate the axis
  that did not. Under `@media (max-height: 620px) and (orientation: landscape)` the strip is now a
  **side rail** instead, and the rest follows for free: `overlaySafeArea` picks the edge a panel is
  cheapest to reserve on, and a tall narrow card is cheapest on the side, so the camera's window
  goes from **717x282 (framed aspect 2.55) to 589x364 (1.62)** — about a third more subject in
  every direction, with the panel now standing in emptiness it was never using. Three things carry
  it. The width is capped in **both** units (`min(38%, 15rem)`): past ~38% a rail stops being a
  margin and becomes a second column, and past 15rem it is just a desktop panel on a small screen.
  Every line inside it has to be allowed to **wrap** — the base rules ellipsize the title and
  `nowrap` the axis chips because a band is wide and short, and in a rail the only alternative to
  wrapping is overflowing the card ("Commerce platform current" rendered as "Commerce plat…" beside
  400px of empty sky). And the subtitle comes back, for the same reason the phone block dropped it:
  a band pays for a row out of the scene's height and a rail's rows are free. Pinned by
  `metaphorOverlayStyles.test.js`; the earlier "go back to a row" rule this replaced was still a
  band, and a band was the shape that was wrong.
- **The panels can collide with each other, not only with the app's bands.** In fullscreen the
  legend is left-anchored at `min(50% - 14px, 12.5rem)` and a composite's layer key right-anchored
  at `min(100% - 20px, 17rem)`, so the two clear each other above ~492px of canvas width and
  overlap below it. Measured by driving **real** fullscreen (`requestFullscreen` after a click —
  the `isFullscreen` prop alone does not raise `:fullscreen`, so the stacking rules that deconflict
  the key from the kind switcher never applied) on a 390x844 phone: **87x84px**, the key drawn
  straight across the legend's own rows, three of six axes already scrolled out of sight
  underneath. The layer key takes that corner under `@media (max-width: 500px)`: it is the fused
  world's only explanation of what each grammar is doing, while every legend phrase is still
  reachable from the guided read (which speaks them), the tap inspector (which labels each metric)
  and the reading strip's `+N` tooltip. It is a **sibling** rule (`.metaphor-layers-overlay ~
.metaphor-legend-overlay`), not a blanket hide, because only a composite raises a key and a base
  kind's legend is in no conflict — which makes the overlay DOM order load-bearing one rung
  further: read ▸ pick ▸ layer key ▸ legend, pinned in `metaphorOverlayStyles.test.js` against
  `MetaphorRenderer.jsx`'s source, since jsdom has nothing to notice a reorder with.
- **Two opposed panels are the one case where reserving honestly is worse than overlapping.** The
  per-edge cap is a rule about ONE panel, and a short screen has a band at each end: on a 717x512
  foldable cover the reading strip claimed 0.28 of the top and the composer band plus taskbar 0.26
  of the bottom — each legal, and together they left the city 46% of the height, so it rendered as
  a small island of towers in a frame of nothing. `MIN_AXIS_WINDOW` (0.55) floors what an axis
  keeps for the subject and scales the excess back across the pair **in proportion**, so the
  thicker band still claims more. The annotation headroom is applied AFTER that scaling, because it
  is the subject's own margin rather than a claim by a panel.
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
- **A screen-constant label is not a constraint on the fit, it is a fixed point of it — so text is
  out of the fit entirely.** A label's world size grows as the camera pulls back, so a solve that
  contains labels settles wherever the labels stop growing rather than where the subject fits.
  Measured on a 717x512 foldable cover: the city's own geometry needed 45 units and its labels
  pushed the answer to 118, so the towers rendered at **22% of the canvas width** inside a frame of
  empty gradient. `collectFramePoints` now prunes troika text by its material, the same way
  `itemBounds.js` does — the same "is it the subject or scaffolding" rule the shadow catcher and
  the ambience layers are pruned by, applied to the one thing that had been missed: **a name is not
  the thing it names.** Two things carry the other half. `SceneFrame` reserves
  `ANNOTATION_HEADROOM_PX` (one label's drawn height) above the subject, because labels are drawn
  ABOVE their items and a fit ending at the tallest item ends where its label starts — that is a
  pixel constant, not a fraction, so it costs a 4K display nothing and a foldable cover a visible
  slice. And the declutter pass decides readability in screen space, where the question actually
  lives (below). `SceneFrame` still re-solves until the distance stops moving; with text out of the
  fit the second pass now agrees immediately on most scenes.
- **The declutter pass knows where the panels are, and "unreadable" outranks "contested".** A label
  the canvas CLIPS or a panel COVERS is worse than an absent one, and it was still holding its box
  against every label that would have fitted. Both bars are near-absolute for an ordinary label
  (`MIN_ON_CANVAS` 0.97 — 0.9 was not close enough; "Fulfillment" hung 6px off a 390px phone,
  scored 0.94 and rendered as "Fulfillmen") and laxer for a **pinned** one, because pinning means
  "this name has no second copy". Pinning is a claim about CONTESTED space, so it buys a laxer bar
  rather than an exemption: a fused world's affinity placards sit at the frame edge by
  construction (`assignSiteLabelOffsets` puts them outward from the world centre), and the accented
  item's own label floats above the tallest thing in the scene, which on a short screen is inside
  the reading strip. `yieldWhenUnreadable` is the third setting, for an annotation whose text is on
  screen anyway — only the accent caption uses it. Two implementation notes: coverage is the
  **largest single panel**, never the sum (the composer band and the taskbar overlap on every
  phone, so summing reads a grazed corner as a buried label), and it is measured against
  `measureChromeRects` — the panels' real rectangles — **not** the camera's safe area, which is a
  reservation (span-discounted, capped, scaled back) and a poor map of which pixels are covered.
- **The accent caption has to CLAIM its box, not merely be drawn over everything.** It is
  depth-test-free by design (the accented item is often the buried one), which meant item labels
  knew nothing about it and landed underneath — measured on the city, the caption covered both
  "API Gateway" and the tower beside it. It now registers with the declutter store as a pinned,
  high-importance entry, so the labels around it step aside instead.
- **The caption stands down where the reading strip is a band, and that is a deduplication rather
  than a compromise.** The strip prints the accented item's note as the scene's thesis
  (`accentThesisFromDsl`), so below the 720px phone breakpoint — the same number App.css uses,
  because the layout is what the rule is about — the pin's copy is the same sentence twice within
  one glance, and the second copy is drawn across the subject. Measured on the fused commerce
  composite: 224 CSS px of a 390px phone and 220 px of a 717px foldable cover, over two item labels
  and a link caption. The pin, stem and ring stay; they carry the part the strip cannot — WHICH
  item. `accentCaptionFit.js` holds the rule (a sibling module, because a component file that also
  exports a function loses fast refresh); a second bar catches a four-line note in a short
  landscape window, and there is deliberately no width bar because `CAPTION_MAX_WIDTH` already caps
  the plate at ~238 CSS px, which no canvas past the band threshold cares about.
- **The compact reading strip caps its axis chips on a small canvas.** Every chip is a whole
  authored phrase ("relative service importance from prompt"), so a phone gives each one a row of
  its own: the fused commerce composite's six axes built a **277px band on an 844px screen**, a
  third of the phone spent explaining a scene that then had two thirds left to be in — and the
  camera dutifully reserved all of it. Three chips plus a `+N` counter that names the rest in its
  tooltip. Nothing is lost: the guided read speaks every legend phrase, the tap inspector labels
  each metric it prints, and fullscreen restores the full legend panel. The markup is identical on
  every canvas — the phone and short-landscape CSS blocks decide — so the safe-area measurement
  picks the change up on its own.
- **A group's name must not be drawn where its own members stand.** Three separate versions of one
  bug. City district placards sat on the patch's FAR edge, so from the default (+x, +y, +z) view
  every district name — the only thing naming what the legend calls the district axis — was behind
  its own towers and read as "the model did not label them". A fused composite's affinity ring is
  drawn on the ocean, which its islands then sit **on top of**, placard included; groups now carry
  `surfaceY` so the placard stands on the ground it covers. And an island's own label sat dead
  centre, which is precisely where its landmarks are planted. Outward from the world centre helps
  — a fixed near corner only changes which islands lose, because attachment offsets are seeded, and
  "away from the landmarks" in world space is often "behind them" in screen space — but it is not
  the fix, and the reason generalizes: **no lateral answer can be, because a tower is about as wide
  as the shoulder is long, and which side clears it depends on where the viewer is standing, which
  a plan cannot know.** Outward is simply the direction that fails for the half of the world whose
  outward points away from the camera; at the default azimuth "Catalog" still rendered as "og".
  `assignSiteLabelPlacement` keeps the shoulder and adds `labelLift` — above the crest of the
  tallest node `attachedTo` that site, which IS a fact about the island — and the glyph rides up
  with the name, or the icon reads as a second, unrelated mark. It was decided by measurement, not
  by looking: ray-test every label from the camera (recipe in `apps/web/.claude/skills/verify/`)
  and score `legible / hidden / buried`, where **hidden** is what the declutter pass already faded
  and **buried** is what it kept and the scene ate. Over 3 composite fixtures × phone/cover/desktop
  (148 labels): 71→80 legible, 4→0 buried, no viewport worse. Two rival placements looked like wins
  in the frame that motivated them and lost ground elsewhere — a camera-facing shoulder resolved
  per frame came out **worse** (74), because it walks a back island's name into the tower of the
  island in FRONT of it, and writing the name on the near shore at ground level buried six.
  Lifting a label costs the camera fit nothing: text is pruned from it by material.
  A fourth instance was the **garden beds**, fixed the city's way (near edge, `+z`). The
  **archipelago `chain` was the open exception, and closing it is what says why no lateral move
  could have worked**: a chain circle is a poor anchor, because the chains overlap and their
  centres cluster at the world centre, so `± radius` on any single axis lands the name on open
  water nowhere near its islands — measured at 717x512, near-edge put DISCOVER in the bottom-left
  corner and BUY off-canvas entirely, which is strictly worse than being hidden. The chain plan
  now carries `labelLift` + `labelOffset` the way a fused site does (`archipelagoLayout`), and the
  placard is **`pinned`** — it was the only group placard in any kind the declutter pass was
  allowed to drop outright, which is what let the earlier bug read as "the model did not label
  them". Measured over three fixtures × phone / foldable cover / desktop, all three chain names
  come back on every viewport where the baseline drew none, and what pays for them is two link
  captions and one island name — exactly the bottom of the rank ladder. Three findings are worth
  keeping. **The lift is a ridge, not a floor**: raising the crest clearance from 1.15 to 2.4
  bought one island name on the phone and cost two placards on the cover (FULFIL dimmed under the
  reading strip, BUY faded out) — a portrait screen is width-bound, so its spare vertical room is
  real, and a short landscape one has none. **The shoulder points away from the chain's own
  tallest island, not out from the world**, which is the fused planner's rule and is wrong here:
  the lift is measured from that island's crest, so it lands on that island's own name, and when
  that island is also the accented one **both labels are pinned, neither yields, and they render
  on top of each other** ("BUY" over "Payments" came out as `BÙYments`). And the shoulder is 0.32
  of the chain radius rather than 0.68, because the islands already reach the frame edge — at the
  fused number FULFIL walked off the left of a 390x844 phone.
- **A territory named after one of its own members gets no placard.** When an island's label and a
  tower's `district` are the same noun — which is exactly what the composite prompt asks authors to
  do — the group and the island name the same thing, and drawing both puts the same word twice
  within a few pixels. `namedByMember` on the plan suppresses the duplicate; a shared chain nobody
  is named after still earns its placard.
- **Open water reaching past the subject is scaffolding.** The iceberg's sea plane runs 1.22x the
  berg ring and was the binding constraint on every iceberg — measured, the bergs rendered at 43%
  of the frame height with the tip pushed under the reading strip. It now carries
  `FRAME_IGNORE_DATA`, like the ground-shadow catcher and the fused ocean disc.
- **The GROUND is scaffolding too, and it was the largest instance of the rule.** Every grounded
  kind stands on a disc sized `max(floor, contentRadius × pad)`, so on an ordinary 6–10 item scene
  the ground is 1.3–1.5× the widest item — and because it is a **circle** around a layout that is
  rarely circular, its rim reaches furthest exactly where nothing stands. Measured: the city's
  subject at 77% of the width it could have, the garden's at 65%. City footing, cycle plaza,
  machine plate, tree and river meadows, garden lawn, subway plate and archipelago ocean all carry
  `FRAME_IGNORE_DATA`; `metaphorSceneFraming.test.js` sweeps the set on source, the way the fused
  ocean disc already was, and asserts each slice contains its own geometry so a slice that stops
  matching fails rather than passing on an unrelated hit. Cutting a ground plane off at the frame
  edge is also the better picture: a floor that runs out of frame reads as a world, a disc with
  margin all round reads as a coaster.
- **What the ground owed the subject was LATERAL room for the labels, and it is a few glyphs.**
  `ANNOTATION_GUTTER_PX` is the horizontal twin of `ANNOTATION_HEADROOM_PX` (both pixel constants,
  because a screen-constant label needs the same room on every canvas). The number is the whole
  finding, and both ends were measured on a 390x844 phone rather than reasoned about. At **58**
  (half a plate) the reservation cost more than the substrate opt-out gained — the fused composite
  came back **smaller than before either change and one label short**, because its ocean was
  already out of the fit, so it paid the gutter and collected nothing. At **0** the city and the
  composite were both bigger _and_ showed more names, which nearly makes the case for dropping it;
  what stops that is the subway, where "SIGNUP" rendered as "SIGNU". A pinned placard survives at
  the relaxed on-canvas bar precisely so a fused world's edge placards are not all dropped, and
  that relaxation is what lets a genuinely cut one through. So the gutter's job is **not** to fit a
  whole label past the subject — the declutter pass already drops one that lands too far out — but
  to buy back the last glyph of a name the pinning rule has decided to keep. Hence **26**.
- **A label's RANK is now visible, and it is the difference between a scene and a list.** Every
  name used to be the same white chip, so a district placard, a service and a link caption were
  indistinguishable — measured on the city, six identical chips down one diagonal where three were
  towers, two were districts and one was an edge, and nothing in the picture said which. A scene
  that encodes four metrics in geometry and then flattens its own vocabulary in the one layer that
  names things is harder to read than the list it replaced. `labelRoles.js` (a pure sibling module,
  like `accentCaptionFit.js`, so it is testable and does not cost `MetaphorSceneChrome.jsx` its
  fast refresh) holds three ranks, and they cost no new colour: `item` — a thing, chip + name,
  **unchanged**; `group` — a territory (district, bed, chain, line, berg, axle, cluster), uppercase,
  letter-spaced and with **no chip**, because a region name is written ACROSS the ground it covers
  rather than stamped on a card standing in it, its heavier outline doing the work the chip did;
  `link` — a relation, smaller with a fainter chip, because an edge caption is a footnote on a line
  and at item weight it competed with the things it joins. A scene passes the **noun**, never a
  font size. Two traps: the declutter box estimate must carry the tracking **and** the capitals
  (`labelPlateEm`), or a placard claims a box a third narrower than it draws; and the rank's size
  is spent in **screen** pixels (`targetPx * scale`), never in world units, since these labels are
  screen-constant and a world-size bump is undone by the next frame. `metaphorLabelRoles.test.js`
  sweeps all eight placards and both link captions — a missed one still renders, just wearing the
  wrong rank, which is exactly the kind of failure nothing else notices.
- **A scene-identity colour is chosen as a SURFACE and has to be re-chosen as type.** Dropping the
  group placard's chip left the subway's route names standing on nothing but their own halo, and a
  route colour is picked to look right lit and shaded on a 3D track: "SIGNUP" and "BUY" measured
  contrast **1.16 and 1.35** against the light outline they were drawn with — invisible, and route
  names are the one thing a transit map exists to publish. `ensureReadableInk(ink, halo)` in
  `sceneUtils.js` walks lightness away from the halo until it clears 3.4:1 and stops at the first
  step that does, so a darkened yellow still reads as the yellow line. Nudging rather than
  substituting a neutral is what keeps the point; reading the direction off the halo is what means
  a dark theme needs no second rule. Applied to every rank, because an item label's chip IS the
  outline colour, so the same problem was always there.
- **A distant bird must LOSE contrast with its sky, or it is a hole punched in it.** `SoaringBirds`
  drew each wing as a 0.52 × 0.15 quad — a 3.5:1 rectangle — in near-black at 0.8 alpha, which at
  the distances these scenes actually solve to landed as ~30px hard dark chevrons in a pale sky and
  read as rendering artefacts (they were reported as "stray dark checkmarks"). Now ~7:1, 0.55
  alpha, and lerped 42% toward `hazeColor`, which every call site passes as the scene's own
  horizon. That is aerial perspective — the same rule `recedeTheme` applies to a muted composite
  layer — and it is the part that matters: proportion and alpha alone still leave a hard silhouette.
- **The reading strip's squeeze is spent on its chips, never on the scene's name.** The strip is a
  flex row of heading + axes and the axes are `flex: 0 1 auto`, so with only `min-width: 0` on the
  heading the name lost every fight: on a 1440x900 desktop the fused commerce world rendered
  "Commerce plat…" and "Domains, service la…" beside 700px of empty strip. A floor on the heading
  spends the squeeze on the axes, which is right twice over — an axis chip already has somewhere to
  go (it wraps, and below the small-canvas limit it folds into the `+N` counter that names the rest
  in its tooltip), and a truncated title is the one line in the whole overlay that cannot be
  recovered from anywhere else on screen.
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
- **Six adapters' worth of link mutators were live, tested and unreachable, and what was missing
  was a hit-test, not a mutator.** `renameCityEdge`/`deleteCityEdge` and the four `canLink`
  flat-kind equivalents were registered and green for weeks; nothing in the UI could call them,
  because the only producer of a `kind: 'edge'` descriptor was the SVG resolver in
  `DiagramCanvas.jsx` and a Three.js scene never goes near it (#495). Three decisions worth
  keeping. **The `{from, to}` pair IS the edge's identity** — `findLinkedEdge`/`renameLinkedEdge`
  resolve on it and `connectCityNodes` refuses a duplicate pair, so a synthetic edge id would be a
  second name for one thing with nothing keeping them in step; `metaphorLinkDescriptor` carries no
  such id. **`useFlowchartGraphEdit.js` needed no change at all** — its edge path keys on
  `descriptor.kind` and never branches by diagram family, which is why this looked like a
  cross-rung handoff and was not. And **link picking is offered only where the adapter can honour
  it** (`LINK_EDITABLE_METAPHORS`: city, layercake, galaxy, machine, terrain): tree's and garden's
  relations are implied by structure, their `renameEdge` returns `not-graph` on purpose, and a menu
  entry whose only outcome is an error toast is worse than no entry. The gate is one context value
  in `MetaphorRenderer`, not a branch in fourteen scene modules — an absent store makes the links
  layer skip publishing altogether.
- **A picked link is ranked BELOW the caption it confirms** (`metaphorDrawOrder.js`
  `PICKED_LINK_ORDER = 6`). The highlight is a fat depth-free stroke and a link's own label sits at
  the route's midpoint, i.e. exactly on the line, so ranking it above the label plate paints over
  the very caption the pick is confirming — the accent stem's mistake, one rung down the ladder. It
  still has to be depth-free: on a city an elbow route crosses the skyline it spans, so a
  depth-tested highlight answers "which wire did I tap" from behind a tower.
- **The pick colour is sky-400 for a link exactly as it is for an item**, held out of every theme
  palette (`LINK_PICK_COLOR`, matching `MetaphorSelectionMarker`'s `MARKER_COLOR`). That shared
  constant is also what makes the hit-test verifiable without a camera: tap a pixel, screenshot,
  and measure the distance from the tap to the nearest sky-blue pixel. A wrong projection cannot
  fake that — it aims off the wire and no highlight appears near the tap. It caught the probe's own
  first version, where the camera had not finished its `SceneFrame` fit at a fixed 9 s settle and
  every desktop aim was ~190 px above the wire; **wait for the projected routes to stop moving
  rather than for a timeout**. Measured after: 20 of 21 link/viewport cells pick as an edge, always
  the aimed one, highlight a mean 0.59 px from the tap.
- **Verify metaphor changes by rendering them.** The scoped skill under
  `apps/web/.claude/skills/verify/` has the headless-capture recipe; every finding above came from
  a screenshot, not from reading the code.
