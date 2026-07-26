# ADR-0011: One office state, two renderers — and the isometric floor is DOM/CSS + SVG

## Status

Accepted — 2026-07-25 (design decision from the office grilling session; floor implementation pending)

## Context

The app is gaining an **isometric mode**: the office floor embodied — situated cast, walk-bys that walk, a first run that arrives through reception (`docs/office-isometric-mode.md`; vision text in `docs/original-prompt-isometric-mode.md`). The obvious ways to build "the game part" are a game-engine-shaped scene (its own state, its own loop) or a canvas/WebGL renderer. A future reader will wonder why neither was chosen.

## Decision

1. **One state, two renderers.** All office life — moment store, cadence, threads, presence — stays presentation-agnostic in the existing stores. `OfficeLayer`'s chrome windows are renderer #1; the isometric floor is renderer #2. A moment fires once and renders per mode (walk-by: slide-in card on screen / walking sprite on the floor; WG meeting: video-call window on screen / glass room on the floor). No forked state, no mode-exclusive functionality.
2. **The floor is DOM/CSS + SVG.** Positioned DOM on an isometric projection; walking via CSS transitions along waypoints; `PersonaFace` heads on SVG bodies; props are SVG components on the existing accent palette ("a new prop costs a component, not art assets").
3. **Diegesis duplicates, never replaces** (both worlds): a diegetic object may duplicate an affordance; every function keeps a labeled conventional control. Desktop mode's diegesis is a parody corporate _OS screen_, not a physical desk (clean desk policy) — the only physical world is the floor.

## Consequences

- The floor ships **surface-by-surface** (substrate → walk-bys → arrival → set pieces → meetings → desk peeking) with desktop users losing nothing at any point — the phasing in `office-isometric-mode.md` §5 depends on rule 1.
- Every character and prop is a real DOM element: accessibility, tooltips, hit targets, and responsive/foldable behavior come from ordinary CSS, not an a11y overlay bolted onto a canvas.
- No new dependency; no second input system; no engine loop competing with React.
- Ceiling accepted: a dozen animated sprites, not ten thousand. A set piece that genuinely needs depth drama may use a scoped canvas **inside one DOM tile** — an exception per set piece, never an engine commitment.
- Anything that would fork office state per mode (a "floor-only" event type, a screen-only moment kind) is an architecture smell against rule 1; extend the store and render it in both worlds, or don't build it.

## Alternatives considered

- **PixiJS / canvas sprites.** Performance headroom this scene never needs, paid for with an a11y overlay burden and a parallel input system.
- **three.js orthographic** (dependency already present via metaphor3d). Text, hit areas, and reflow all get harder as meshes/billboards; the metaphor3d chunk is deliberately isolated from the main UI and should stay that way.
- **Isometric as the app shell** (always on the floor; click the monitor to work). Rejected: puts a navigation layer between a utility user and their canvas, against the tool-first spine and the "skip the ceremony" doctrine — the floor is arrival + social space; the screen is work.

## Where this lives in code

All eight slices in `docs/office-isometric-mode.md` § 5 have shipped: the floor substrate, walk-bys embodied, the isometric arrival, set pieces at their locations, meetings in the glass room, desk peeking, free roam, and conversation in the room.

- Renderer #2: `apps/web/src/components/OfficeFloor.jsx` + `components/officeFloor/` (`FloorStage`, `FloorRoom`, `FloorRoam`, `FloorSeat`, `FloorFigure`, `FloorWalker`, `FloorBubble`, `FloorDeskSpeech`, `FloorPlayer`, `FloorTopBar`, `FloorCardSlot`, `FloorScenes`, `FloorTalk`, `useFloorActivity`, `useFloorPresence`, `useFloorTalk`, `useFloorKeyboard`, `useFloorAutoPan`, `useFloorWalker`, `useWalkAnimation`, `FloorPersonCard`, `FloorMeeting`, `FloorPeek`, `FloorArrival`, `isoArt`) + `components/OfficeFloor.css`; stage scaling in `hooks/useStageScale.js`
- **Sharpest worked example of rule 1: conversation on the floor** (slice 8). Walking up to somebody and talking to them _is_ the Slop Chat™ thread — `imSomeone` for the opener and every reply, `imHistory` for the messages, the same reactive-LLM ladder for the answers. `FloorTalk` renders the newest inbound line as a bubble; `OfficeMessenger` renders the same messages as a thread; neither owns anything. The rule's one hard requirement shows up here as a guard: `OfficeLayer` suppresses the IM toast for whoever you are stood in front of, because two renderers of one line means the narrator says it twice
- Where rule 1 stops applying, and why that is still fine: **desk peeking** is a floor-only _interaction_ (walking to a desk), not a moment — nothing fires, nothing is stored, and the fiction it shows (`utils/officeDeskWork.js`) is presentation-agnostic data both renderers could read. "No mode-exclusive functionality" binds office _state_; a view affordance that produces nothing costs desktop users nothing
- Second instance of that same carve-out: **free roam** (slice 7). Clicking the floor to walk somewhere fires no moment and writes to no store — `useFloorPresence` is `useState` that dies when you sit down, exactly like the peek it absorbed. It is the strongest case for the carve-out precisely because it produces the least: a position is not content. Note it also _subsumed_ peeking rather than sitting beside it — once you could already be standing somewhere, a peek that rendered its own player starting from your desk would have teleported you home first, so a peek became a destination with an `intent` attached and there is one of you on the floor at any moment
- Third worked example of rule 1: **set pieces**. `FloorScene` and the `CoffeeBreakOverlay` / `OfficeBattleOverlay` cards drive one scene through the shared `hooks/useScenePacing.js`; participants come from `utils/officeSceneCast.js`, marks from `COFFEE_TILES` / `BATTLE_TILES`. The mount-one-renderer-at-a-time rule is load-bearing here: two paced performances would speak every line twice
- Second worked example of rule 1: **the orientation**. `FloorArrival` (boot) and `OfficeDirectory` (replays, and the skip fallback) render the same roster, `introLine`s, narrator and pacing — two renderers of one ceremony, not two ceremonies. Mounted in `ArchiSlop.jsx` on `officeBootPending`
- Layout source of truth (pure): `apps/web/src/utils/officeFloorPlan.js` — tiles, seats, props, zones, `projectIso` / `unprojectIso` / `depthOf`, standing room (`isStandableTile`), and walk routing (`walkPathFrom` / `pathCost` / `VISITOR_TILE`). Its sibling `utils/officeFloorMovement.js` answers where _you_ may go (`standableTileAt`) and who you may walk up to (`approachTileFor`)
- Worked example of rule 1: the walk-by. One `snapshot.walkBy`, two renderings — `OfficeWalkBy` (card) when you are at your desk, `FloorWalker` (sprite) when you are standing. Footsteps and TTS already hung off the shared state, so embodying the moment added no wiring; the departing-walker copy in `useFloorWalker` is presentation state (an exit animation), never office truth
- Mode: `apps/web/src/state/officeViewModeStore.js` (`standUp` / `sitDown`; not persisted)
- Mounted by renderer #1 so both share one wiring point: `OfficeLayer.jsx` (also supplies the floor's "Message" action from the existing desk IM verb); entered via the **Stand up** desk verb in `DeskActionsDock.jsx`
- Presentation-agnostic stores rule 1 depends on, unchanged: `state/officeMomentStore.js`, `utils/officeCadence.js`, `hooks/useOfficeAmbience.js`
- Tests: `apps/web/test/officeFloorPlan.test.js` (projection, its inverse, layout invariants, derived mark families, and a drift guard that every `CAST_TIERS` member has a seat), `apps/web/test/officeFloorMovement.test.js` (the snap ladder, and that no click anywhere on the plate puts you inside the leadership glass), `officeFloorRoam.test.jsx`, `officeFloorTalk.test.jsx` (the floor as a second renderer of the IM thread), `useWalkAnimation.test.jsx` (walk interrupts, against a stubbed animation engine), `apps/web/test/officeFloor.test.jsx`, `officeFloorMeeting.test.jsx`, `officeFloorPeek.test.jsx`, `officeDeskWork.test.js`
