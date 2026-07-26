# Isometric mode — the office floor as a second renderer

> **Status: adopted design (2026-07-25), near-term program.** Vision text:
> [`original-prompt-isometric-mode.md`](original-prompt-isometric-mode.md). Vocabulary:
> [`GLOSSARY.md`](../GLOSSARY.md) — _Desktop screen mode / Isometric mode_, _One state, two
> renderers_, _Workstation diegesis_. Cast behavior doctrine:
> [`office-parody.md`](office-parody.md) §11. The multi-human future of this floor:
> [`multi-human-office.md`](multi-human-office.md) (backburnered).

## 1. The two modes

|            | **Desktop screen mode**                                                                                                                                             | **Isometric mode**                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| What it is | Today's UI: canvas + chrome. The work.                                                                                                                              | The office floor, embodied: desks, kitchen, glass meeting room, situated cast.     |
| Diegesis   | Your standard-issue corporate **workstation screen** — a parody desktop OS. Clean desk policy: there is no physical desk fiction on screen (no phones, no drawers). | The only physical world. You either look at your screen or you stand up.           |
| Role       | Work mode. Functionally untouched.                                                                                                                                  | Arrival + social space: talk to characters, coffee, wander, (later) peek at desks. |
| Transition | **Stand up** → floor                                                                                                                                                | **Sit down** (at your desk) → screen                                               |

First run **begins isometric**: reception check-in → walk the floor past the cast → arrive
at your desk → sit down → desktop screen mode. This replaces the card-based Meet-the-Office
tour when ready; the card tour remains as the reduced-motion / "skip the ceremony" fallback.

## 2. Binding rules

1. **One state, two renderers.** All office life (moment store, cadence, threads, presence)
   stays presentation-agnostic in stores. `OfficeLayer`'s chrome windows are renderer #1;
   the floor is renderer #2. A moment fires once and renders per mode — a walk-by is a
   slide-in card on screen, a sprite walking over on the floor; a WG meeting is a
   video-call window on screen, the glass room on the floor. No forked state, no
   mode-exclusive functionality: the floor ships surface-by-surface and desktop users lose
   nothing.
2. **Diegesis duplicates, never replaces.** A diegetic object may be a _bonus_ affordance
   (the coffee machine pours a coffee break); every function keeps its labeled conventional
   control as the primary path. Applies to both worlds (screen-world OS skin and
   floor-world props).
3. **Responsive from day one.** Every slice ships for desktop, mobile (pan/zoom floor,
   same flows), and foldables (reuse the existing segment-aware posture handling). No
   "mobile later."

## 3. Rendering technology & art direction

**DOM/CSS + SVG.** The floor is positioned DOM elements on an isometric projection (2:1
grid or a CSS-3D-transformed plane); walking is CSS transitions along waypoints. Characters
reuse `PersonaFace` heads on SVG bodies; every character and prop stays a real DOM
element — accessibility, tooltips, and click targets come free; responsiveness is ordinary
CSS; **no new dependency**.

Rejected: PixiJS/canvas (a11y overlay burden + a second input system for performance
headroom a dozen sprites never need); three.js orthographic (text, hit areas, and reflow
all get harder; the metaphor3d chunk stays deliberately isolated). Escape hatch: a later
set piece that genuinely needs depth drama (all-hands confetti) may use a scoped canvas
_inside_ one DOM tile — an exception per set piece, never an engine commitment.

**Art direction: flat vector isometric** — the parametric-faces philosophy extended to the
room. A desk, a fridge, a glass wall are SVG components with palettes from the existing
accent colors. A new prop costs a component, not art assets; a new cast member still costs
a trait row.

## 4. The screen-world skin (parallel track)

Desktop mode's chrome leans into being a parody corporate OS: the `FloatingWindow` system
already behaves like a windowing UI — the skin makes it fiction. Inbox = the mail client;
Slop Chat = the messenger; Settings = the control panel; the WG meeting = a video-call
window (the existing docked "Look at my screen" card is literally a minimized call). This
track touches chrome only, never the floor, and never blocks the floor slices.

## 5. Phasing (each slice independently shippable)

1. ~~**Floor substrate**~~ — ✅ **shipped**: the room (floor plate, tile grid, zone plates,
   two back walls with windows), all 15 cast members plus you situated at desks with idle
   life, click-a-person cards, and stand up / sit down (desk verb, floor button, Escape).
   Slop Chat™ from the person card reuses the desk's existing IM verb. See §6 for the
   geometry constraints this slice established.
2. ~~**Walk-bys embodied**~~ — ✅ **shipped**: the colleague leaves their desk (which stays,
   empty), walks an L-shaped route to a visitor tile beside yours, says their line in a
   speech bubble with the same **Do it** / dismiss actions as the desk-mode card, and walks
   back when the moment clears. `OfficeLayer` renders the card **or** the floor walker,
   never both. Footsteps and the spoken line needed no new wiring at all — they already
   fire from `OfficeLayer`'s effect on `snapshot.walkBy`, which is the two-renderer rule
   paying for itself.
3. ~~**Isometric arrival**~~ — ✅ **shipped**: first run now _begins_ on the floor. You stand
   at reception (your desk visibly empty), fill in the name badge, and **Check in** — the
   gesture that unlocks speech. Linda welcomes you, then each colleague introduces themselves
   from their own desk, glowing and named, auto-advancing on their voice. **Clock in** walks
   you to your desk, and arriving there completes boot into desktop screen mode. Content
   parity with the card tour is exact — same roster, same `introLine`s, same narrator, same
   pacing — so this is a second _renderer_ of the orientation, not a second orientation.
   `OfficeDirectory` stays mounted for replays from the level panel and remains the fallback
   for anyone who skips.
4. ~~**Set pieces at their locations**~~ — ✅ **shipped**: a coffee break happens at the
   machine, a cubicle battle across the aisle between two desks. Participants leave their
   desks (which stay, empty) for the duration; the invite ("coffee?", "they're at it
   again") and the battle's verdict prompt appear _between the two of them_ rather than in
   a corner. Line pacing and narration come from a shared `useScenePacing` hook extracted
   from `CoffeeBreakOverlay`, so a scene performs identically in both worlds — and, as with
   the walk-by, `OfficeLayer` renders its overlays **or** the floor scene, never both, or
   every line would be spoken twice.
5. ~~**Meetings in the glass room**~~ — ✅ **shipped**: the meeting whose screen-side render
   is the call window now also happens as a place. Attendees leave their desks (which stay,
   empty) for chairs around the table — the facilitator at the head, across from you — and
   the meeting is the one place **you** are visibly in the room rather than at your screen.
   The newest transcript beat appears as a speech bubble in the speaker's column while they
   glow. `useMeetingPlayback` already owned pacing, narration, interjections and minutes, so
   the floor renderer only _reads_ state and there was no double-narration to guard against;
   `OfficeLayer` still hides the call window while you stand, for the visual reason alone.
   Sitting down leaves the meeting running and hands it back to the window — the floor's
   equivalent of the window's docked mode — which is also how you read the minutes, since
   paperwork belongs on a screen. Two geometry surprises, both caught by a capture: see §6
   rules 12–14.
6. ~~**Desk peeking**~~ — ✅ **shipped**: every monitor on the floor now shows what its
   owner is pretending to work on (`officeDeskWork.js` — Ulrich's green terminal, Chad's
   forty tabs, Pam's wall-to-wall calendar), and the person card gains **👀 Their screen**,
   which empties your own desk and walks you to a mark beside theirs. They glow, say one
   line about it, and **Back to my desk** walks you home; Escape does the same before it
   sits you down. Fiction only — no slot content, no artifacts (Sign-off rule /
   one-producer model), and the peek writes to no store at all: it is view state that dies
   when you sit down. The marks are **derived, not authored** (`peekTileFor`), which is
   what makes "who can you peek at" fall out of the room rather than out of a list:
   leadership sit behind glass with no route in, Gary has no desk, and everyone else gets
   the nearest tile that clears their monitor, their neighbours' faces, and the furniture.
   Three geometry surprises: see §6 rules 15–17.

7. ~~**Free roam**~~ — ✅ **shipped**: the floor is walkable. Click any clear tile (or press an
   arrow key) and you walk there; you stay a visible figure until you go back to your chair,
   and your desk stands empty the whole time. Before this the room had **no camera to move**
   — `useStageScale` fits the whole stage to the viewport, so you always see all of it — and
   what was actually pinned was _you_: every walk was scripted, with `peekTileFor` deriving
   _the_ mark and you never choosing one. Where you may stand is **derived** from the
   furniture (`standableTileAt`, built on `isStandableTile`, which slice 6's
   `isPeekMarkClear` now delegates to) rather than authored as a walkable mask, so the same
   § 6 rules that place a peek mark also decide where a click puts you. Clicking a desk steps
   you beside it; clicking somewhere with nothing legal within a tile does nothing, which is
   what keeps the rooms you cannot enter reading as rooms you cannot enter. Two surprises,
   both real bugs: see § 6 rules 18–19.

8. ~~**Conversation in the room**~~ — ✅ **shipped**: the person card's first verb is now **💬
   Go and talk**, which walks you to a mark beside them, opens with a live line in persona
   voice, and gives you quick replies and a composer in the card slot. This is the clearest
   worked example of rule 1 yet: the conversation **is** the Slop Chat™ thread. The opener and
   every reply go through the same `imSomeone` verb the messenger sends, land in the same
   `imHistory`, and come back through the same reactive-LLM ladder — the floor just renders
   the newest inbound line as a speech bubble over whoever said it, and the window renders the
   same messages as a thread. Walk away and the whole exchange is still in Slop Chat, because
   it was never anywhere else. The one thing that needed guarding is the mount-one-renderer
   rule: `OfficeLayer` holds back the IM toast for whoever you are stood in front of, or their
   answer arrives as a bubble _and_ a toast and the narrator reads it twice.

   Marks are `approachTileFor`, deliberately **not** `peekTileFor`: a peek must clear the
   monitor (§ 6 rule 16), a conversation must not — standing on somebody's screen is what
   talking to them at their desk looks like. It also has to work for Gary, who has no desk to
   peek at but is perfectly easy to walk up to. Both gates on the verb agree by accident
   rather than by construction, which is worth knowing: the **tier** decides whether there is
   anything to say (office tier only), the **room** decides whether you can get close enough
   to say it — and the room's answer is what keeps leadership out of reach, since an approach
   mark needs a clear line to the person and the glass is in the way. One geometry surprise:
   see § 6 rule 20.

9. ~~**Props you can use**~~ — ✅ **shipped**: the furniture answers to a click. Walk up to the
   coffee machine and it pours a coffee break — the same break the desk dock's labelled **Get
   coffee** pours, through the same `getCoffee` verb — while the printer and the whiteboard
   have a line about themselves and nothing else. This is binding rule 2's first worked example
   on the floor, and the rule's own illustration made literal: a diegetic object is a **bonus**
   path to a function that keeps its conventional control, never a second way of doing
   anything. The ones that produce nothing are not an unfinished state but the honest default —
   a printer that jams is a joke, not a feature (Sign-off rule), and slice 6 set the precedent
   that a look and a line are all a floor affordance is allowed to be.

   Cost, in full: a third `startWalk` caller and a third projection in `useFloorActivity`,
   which is that file's standing claim ("adding a third reason to walk somewhere should mean
   another projection here, not another state machine") finally being tested. The only thing
   that had to generalize was that an intent's subject need not be a person. Which props are
   usable is **derived** (`propTileFor` → `usablePropKinds`), so a prop the room cannot give
   you a mark for never renders a button at all — no dead click, and no disabled control
   explaining why it is disabled. Two surprises, and this is the first slice where neither was
   visible in a screenshot: see § 6 rules 21–22, and the hit-coverage recipe at the end of § 6
   that found them.

**There is no slice 10 yet, and that is deliberate.** The list above was written one slice at
a time, each defined when it was picked up rather than planned in advance — so "continue with
slice _n_" only means something once somebody has chosen what _n_ is. § 8 has the candidates,
a recommendation, and the debts that argue for one over another. Pick from there, write the
entry here when it ships, and add anything the room taught you to § 6.

## 6. Geometry constraints (learned by looking at it)

The layout is `apps/web/src/utils/officeFloorPlan.js` — tiles, seats, props, zones, plus
`projectIso` / `depthOf` and walk routing. These rules are invisible in code review, and
1–20 are all obvious in a screenshot; every one of those cost a capture to find, and later
slices must preserve them. Rules 21–22 are the exception and worth knowing as one: once the
floor grew things you can _click_, a surface could be perfectly drawn and still not work, so
the capture stopped being enough — see the hit-coverage recipe at the end of this section.

1. **Monitors sit to the screen-left of a desk, never centred on it.** A centred monitor is
   ~26 px wide and eclipses the 34 px head behind it — every seated character vanishes. The
   sideways shift is an equal move along `-x` and `+y` (which cancels in screen `y`).
2. **Seated figures are lifted 30 px** (`.office-floor-person.is-seated`). A desk's top-back
   edge is ~42 px above the tile centre, so an unlifted figure shows only a sliver of scalp.
   The lift leaves head, shoulders and a little torso above the desk; the desk hides the
   rest, which is exactly what reads as "sitting at".
3. **Zone labels live on a signage layer above the props**, not painted into the room SVG.
   As floor paint they are physically correct and practically illegible — a desk standing on
   a zone hides most of its label.
4. **Paint order within a seat is chair → person → desk.** That single ordering is what makes
   an occupant read as sitting rather than standing inside the furniture.
5. **A walker vacates the person, not the desk** (`FloorSeat`'s `vacant` prop). Skipping the
   whole seat deletes the furniture too, and the room grows a hole where somebody works.
6. **A talking walker is raised above the signage layer.** Depth ordering is right while they
   travel, but at your desk the speech bubble has to clear the zone labels (z 9000) or the
   "Do it" button ends up behind the word POD.
7. **The speech bubble counter-scales** (`transform: scale(1 / stageScale)`). Inside the
   scaled stage a 0.78 rem line is ~6 px on a phone; counter-scaling keeps text at a constant
   physical size while the room around it zooms.
8. **Highlight the head, not the floor.** A spotlight ring on a speaker's tile is the obvious
   design and is invisible in practice — their own desk stands on that tile. The glow (and
   their name chip) goes on the figure, which clears the desk.
9. **Modifier rules must follow the rules they modify.** `.office-floor-card-action--primary`
   and its base are both single-class selectors, so source order decides. Declared earlier,
   the modifier lost the background and left white text on a white pill — a button that
   rendered as an empty capsule.
10. **Tiles sharing `x − y` land in the same screen column.** A standing mark a couple of
    tiles of depth from a desk in that column puts the standing figure's head on the seated
    one's. Set-piece marks therefore pick a column no seat occupies (asserted in
    `officeFloorPlan.test.js`), and pair up at equal `x + y` so the two participants stand
    side by side rather than one behind the other.
11. **Props stand where people need to.** The water cooler sat exactly on a coffee-break
    mark and hid a participant from the chest up. When a mark and a prop collide, move the
    prop — the marks are column-validated, the furniture is not.
12. **Counter-scaled chrome does not fit in a small room.** The glass room renders ~170 px
    wide; a `FloorBubble` is ~264 px and a `FloorPanel` ~300 px. A panel pinned to the
    meeting table — the obvious choice, and the one slice 5's plan called for — covered all
    nine people sitting at it. Chrome for a crowded room goes in the floor **card** slot,
    which is off the stage and never occludes anything. Diegesis is the room; the controls
    are allowed to be controls (rule 2 wants a labelled conventional path anyway).
13. **A bubble for somebody in a crowd parks on a depth line, not on their tile.** Anchored
    per-speaker it blankets the room and leaps across the table every beat. `liftToDepth`
    keeps the speaker's screen column — so the tail still points at them — while pinning
    every bubble to one baseline above the back row (`MEETING_BUBBLE_DEPTH`).
14. **A figure is 48 px tall, not 58.** Head (34) plus torso (24) minus the head's −10 px
    `margin-bottom`, which is what fuses them into one figure. Anything that reasons about
    occlusion has to use the real number; `officeFloorPlan.test.js` measures with it, and
    the value was confirmed against `getBoundingClientRect()` rather than read off the
    stylesheet. It now lives in `officeFloorPlan.js` (`figureBox` / `headBox` /
    `boxesOverlap`) so the marks and the tests measure with one definition.
15. **A bubble over a seated speaker must clear the figure, not the chair.** The seated
    anchor lifts by 30 px — the seat lift — which puts the balloon's bottom edge on their
    feet, and a ~70 px bubble then covers them from the chest up. It hid the colleague
    introducing themselves in the arrival ceremony (glow and all, since slice 3) and hid
    the person you had walked across the floor to look at. The lift is 30 + 48 = the whole
    figure: `.office-floor-walker-anchor--over-seat`, kept separate from `--seated`, which
    still means "a figure sitting on a tile that owns no `FloorSeat`" in the glass room.
16. **Stand to the screen-right of a desk, never one tile along `+y`.** The monitor sits
    ~34 px screen-left of its desk (rule 1) and is ~26 px wide, so the obvious "beside
    them" mark lands 56 px screen-left — squarely between the viewer and the screen you
    walked over to read. Column offsets of 0 or ±112 clear it; −56 is the only one that
    does not, and `coversTheMonitor` is that arithmetic.
17. **Glass answers "can I see it?" and "can I walk there?" differently.** A proximity test
    is wrong for both: the meeting-room wall runs _parallel_ to goMad's mark half a tile
    away and blocks nothing, while the leadership wall is exactly what stands between you
    and the CFO. Sight lines and walk routes therefore use a segment-**crossing** test
    (`pathCrossesGlass`), and proximity is kept for furniture, which is what makes the CEO
    unpeekable — there is a standable tile in front of him and a server rack in the way.
    The pay-off is that the fishbowl seals itself: no list of who is off-limits, just a
    room you cannot walk into.

18. **The leadership fishbowl was only sealed from the south.** Rule 17's payoff — "no list of
    who is off-limits, just a room you cannot walk into" — held only because `PEEK_OFFSETS`
    all approach from `+x/+y`. The glass ran x 5.2…9.8 while the row runs x 6…10, so the
    first thing free roam did was walk **around the end of the partition** and stand beside
    the CTO. The panel now spans the `leadership` zone rect exactly (`[5.3, -0.5, 10.7, 1.0]`)
    with two short returns closing the ends, and the floor plate's own edge closing the back.
    The lesson generalises: a barrier derived for one family of marks is only tested by the
    directions that family approaches from. The assertion to write is the one about the
    _room_ ("no click anywhere puts you inside this rect"), not the one about the marks
    ("clicking a director returns null") — the latter is both weaker and wrong, since tiles
    just _outside_ the west wall are ordinary floor you may stand on.
19. **A `fill: forwards` animation outranks inline style.** `useWalkAnimation`'s cleanup set a
    `cancelled` flag but never called `animation.cancel()`, and the `animation` was scoped
    inside the leg loop where the cleanup could not reach it. Harmless for six slices because
    walks could never overlap; free roam interrupts them by design, and an abandoned walk
    would have gone on holding the figure at the leg it reached while the next walk silently
    did nothing. Its sibling: a new `walkKey` re-places the element at the _new_ path's start,
    so an interrupted walk snaps back across the room unless the caller passes the position
    you had actually reached — which is what `liveTileOf` reads back off the transform, and
    the second reason `unprojectIso` exists. Neither is visible in a capture (
    `--virtual-time-budget` fast-forwards timers but not WAAPI frames), so both are asserted
    in `useWalkAnimation.test.jsx` against a stubbed engine instead.

20. **A bubble's lift has to match whether they are actually sitting.** Rule 15 established
    that a bubble over a seated speaker clears 30 px of seat lift _plus_ the 48 px figure.
    `FloorDeskSpeech` applied that to everyone — including Gary, who has no desk and is
    therefore never seat-lifted, so his balloon floated a clear tile above his head while
    everybody else's sat on theirs. The lift is a property of the _speaker_, not of the
    component: `--over-seat` (82 px) for somebody at a desk, `--over-standing` (52 px) for
    somebody on their feet at their own tile. Slice 6 never hit this because Gary has nothing
    to peek at; slice 8 walks up to him, which is the point of `approachTileFor` existing.

21. **A prop tucked out of everybody's way is a prop nobody can reach.** Rule 11 moved the
    water cooler into the kitchen corner because it stood exactly where a coffee-break
    participant has to and hid them from the chest up. Slice 9 is the bill for that: there is
    no longer a standable tile nearer the cooler than the coffee machine, so it has no mark and
    quietly went back to being scenery. The two rules pull opposite ways and rule 11 wins,
    because being _seen_ beats being _usable_ — but the pair only stays honest because the
    derivation reports it. `propTileFor` returning `null` removes the button entirely, so the
    cooler reads as furniture rather than as a control that does nothing. The general form:
    every "move the prop out of the way" is a decision that nobody will ever interact with it.
22. **A figure's hit box is its _name chip_, which is invisible and wider than the figure.**
    `.office-floor-person` is a flex column of the name span (opacity 0 until hover) above the
    34 px figure, so a seat's clickable box is as wide as the longest name and reaches ~20 px
    higher than any head. Harmless for eight slices, since the only thing under it was floor.
    The printer at 3.4/0.6 sat on exactly that band between Linda's and Pam's chips: **11 of
    441 sampled points on the printer reached the printer, and its own centre selected Pam.**
    Nothing about this is visible in a capture — the printer looked perfect and simply did not
    answer. Moving it one row back (2.4/0.6) clears both chips on depth alone and takes its
    centre back. The lesson is that a new _clickable_ thing must be checked against the cast's
    invisible boxes, not against what the room looks like; the coffee machine (32 cells) and
    whiteboard (35) were fine because nothing overlaps them.

Note on rule 10: "no mark may share `x − y` with a desk" is the integer shorthand, and it
does not survive fractional marks — the glass room is a diagonal strip in column space, so
every seat around its table has a fractional column. The precise form of the rule (screen
boxes must not intersect, and no figure may cover another's head) is `figureBox` /
`headBox` / `boxesOverlap` in `officeFloorPlan.js`, asserted by the meeting-seat and
peek-mark suites in `apps/web/test/officeFloorPlan.test.js`; prefer it for any new mark
family. Slice 6 went one step further and let the derivation _apply_ the rule rather than
be checked against it: `peekTileFor` walks a preference ladder of offsets and returns the
first that survives every constraint, so "there is nowhere to stand" is an answer the room
gives (leadership, Gary) instead of a list somebody maintains. The suite then pins the
resulting roster, which is what catches a layout change that silently opens the fishbowl.

One more paint-order rule the meeting table forced: a big prop has **one** z-index, so a
mark's depth decides which side of it that figure lands on. `MEETING_SEATS` is arranged so
the far row paints before the table (their laps disappear behind it) and the near row after
(their torsos sit in front). A cosmetic `depthOf(...) + 5` nudge — copied from `FloorScene` —
is enough to push the outermost far mark past the table and float that attendee over it.

Verification recipe (this is how 1–3, 5, 6 and 12–17 were caught): temporary Vite harness + headless
Edge screenshot, per the `apps/web:verify` skill. Drive the real UI from the harness rather
than faking state — slice 6's harness took a `?peek=<castId>` param and clicked the person
and then the card action, which is also how it found that the walk can finish off-screen on
a phone. Two Windows gotchas worth knowing before you trust a capture:

- Edge **crops** to the requested `--window-size` rather than scaling, and display scaling
  inflates the CSS viewport (a 390 px window reported a 492 px viewport). Measure
  `getBoundingClientRect()` in-page before believing an apparent clipping bug — one "button
  overflows on mobile" turned out to be pure screenshot artefact.
- `--virtual-time-budget` fast-forwards **timers, not Web Animations frames**, so a walk
  appears frozen partway however long the budget. To capture the arrival state, pass
  `--force-prefers-reduced-motion`: the walker then skips travel by design, which is exactly
  the state you want to inspect.
- Headless Edge on this machine fails to write the PNG on roughly half of runs. A fresh
  `--user-data-dir` per invocation and a retry is the whole workaround; the `LoadEnclaveImageW`
  and `fallback_task_provider` lines on stderr are noise and appear on successful runs too.

**Hit-coverage recipe (slice 9).** Rules 21–22 are the first two that a screenshot could not
have found: the floor _looked_ right and the printer simply did not answer to a click. What
finds them is `document.elementFromPoint` in the harness, scanned on a grid over each
interactive element's box and tallied by what it actually reaches. Report the counts rather
than a yes/no — "16 of 441 cells reach the printer, 30 reach Linda" is a diagnosis, where
"the printer is not clickable" is only a symptom. Two things to get right: sample in
**fractions of the client rect**, never in stage pixels (the stage is CSS-scaled to fit, so
`PROP_VIEW`'s 260 px is ~215 on a 1440-wide viewport, and stage-unit offsets silently probe
the wrong place); and check the empty corners of a box as well as its middle, which is how
the `pointer-events` bug below was caught. Sanity-check any coverage number against the
prop's own drawn area — a printer is a small object and will never score like a whiteboard.

One CSS finding worth keeping, since it is the reason usable props do not swallow the floor:
`pointer-events: visiblePainted` **has to land on the SVG shapes, not the `<svg>` root**. The
root is an HTML-flow box, where Chrome treats an SVG-only value as `auto` and hands back the
whole 260×260 rectangle — so a corner of the coffee machine's box a full tile away from the
machine still answered to the machine, and free roam went dead around it. The working shape
is `pointer-events: none` on the button _and_ the `<svg>`, re-enabled on `.office-floor-prop-art *`.

## 7. The bench (for whatever comes next)

Slices 1–9 have shipped. Anything new on the floor should be built out of the
pieces below rather than beside them — and should read §2 (binding rules) and §6 (geometry
constraints) first, because every one of those cost a screenshot to find. Verification
recipe is in §6; repo commands are in `CLAUDE.md` (`npm run check:affected`,
`npm run format:affected`).

**Components** (`apps/web/src/components/officeFloor/`): `FloorStage` (scaled stage; takes
`vacantIds`, `speakingId`, `interactive`, `onWalkTo`/`roamOrigin`, `onUseProp`/`activePropKind`,
and arbitrary `children` as
extra actors), `FloorRoam` (the click surface + hover marker), `FloorProps` (the furniture, and
the ones you can use — mind § 6 rule 22 before making anything else on the stage clickable) +
`FloorPropCard`, `useFloorPropUse` (what happens when you get there, once), `useFloorPresence`
(where you
are standing — view state, like the peek it absorbed), `useFloorActivity` (presence plus the
reasons you went there, as one object), `useFloorTalk` (a conversation's composer, not its
dialogue), `FloorTalk` + `FloorTalkCard`, `useFloorKeyboard` (Escape ladder + arrow stepping),
`useFloorAutoPan`, `FloorTopBar`, `FloorCardSlot`, `FloorScenes`,
`FloorSeat`, `FloorFigure`, `FloorBubble` (counter-scaled speech), `FloorDeskSpeech` (a line
above somebody at their own desk — mind §6 rule 15), `FloorPanel` (counter-scaled panel
pinned to a tile — mind §6 rule 12), `FloorWalker` + `useWalkAnimation` (WAAPI path
walking), `FloorPlayer` (you, walking, wherever you are not at your own desk), `FloorScene`
(set pieces), `FloorMeeting` + `FloorMeetingCard` (the glass room, and why its chrome is a
card), `FloorPeek` + `FloorPeekCard` (desk peeking), `FloorArrival` (the ceremony).

**Data**: layout, routing and mark derivation in `apps/web/src/utils/officeFloorPlan.js`;
where you may walk, who you may walk up to and which props you may walk over to use in
`apps/web/src/utils/officeFloorMovement.js`; what using a prop does in
`apps/web/src/utils/officeFloorProps.js`; the cast's fictional
workload in `apps/web/src/utils/officeDeskWork.js`; who is away from their desk in
`apps/web/src/utils/officeSceneCast.js`.

**Three habits worth keeping.** A new mark family should be _derived and asserted_ rather than
hand-placed (see the note under §6 rule 10) — the geometry rules are cheap to encode and
expensive to rediscover. A new surface belongs in the floor **card slot** unless it has
earned a place on the stage: the slot is single-occupancy and ordered by how much of your
body is committed (meeting → talk → peek → prop → person card → hint). And anything new that
is **clickable on the stage** gets the hit-coverage scan from §6 before you believe it works —
slice 9's printer was drawn perfectly and answered 11 clicks in 441.

Still open, and what to do next: §8.

## 8. Where to take this next

Nothing here is designed yet. The ordering below is a recommendation, not a queue.

### The next slice

**Floor accessibility is the one to do next.** It is the oldest thing on this list, it is the
only item that makes the floor _worse_ the longer it waits, and every slice since 6 has added
to the debt: walking, roaming, glowing, speech bubbles and now prop buttons are all motion and
visual-only state. Two concrete halves, both previously deferred from build time:

- **Reduced-motion behavior on the floor itself**, beyond the card-tour fallback. Note the
  behaviour already exists by accident and is load-bearing for the tests: without a WAAPI
  engine `useWalkAnimation` settles immediately, which is exactly what reduced motion should
  do (arrive without travelling), and it is why the jsdom suites can click a verb and assert
  the arrived state in one tick. Making it deliberate is mostly making it _stated_.
- **A screen-reader narrative for spatial events** ("Chad is walking to your desk"). The floor
  already has the state; what it lacks is a live region. Cards use `aria-live="polite"`
  individually, which is not the same as narrating the room.
- While in here, revisit **slice 9's focus indicator**: a usable prop suppresses its outline
  (it would trace the 260×260 box, not the machine) and relies on a stronger glow. That is a
  visible indicator and defensible, but it has not been checked against a contrast requirement
  or in forced-colors mode.

The two alternatives considered and not chosen, kept so nobody re-derives them: **ambient
floor life** (the cast moving between moments, so the room breathes when nothing is scripted —
careful, it must stay reactive/ambient colour and never agent initiative, per
`office-parody.md` §11), and **where the mode toggle lives in desktop chrome** (the "stand up"
affordance + a keyboard shortcut; small, and still genuinely open).

### Debts the shipped slices left behind

- **A figure's hit box is its name chip** (§6 rule 22) — this is the general form of the bug
  that moved the printer, and moving the printer only dodged it. `.office-floor-person` is a
  flex column of an invisible name span above the figure, so _every_ seat's clickable box is
  as wide as the longest name and reaches ~20 px above every head, eating roam clicks around
  desks as well. The fix is to constrain the button to the figure and position the name chip
  as an overlay that does not contribute layout. Worth doing **before** anything else on the
  stage becomes clickable; verify with the §6 hit-coverage scan, which will also tell you
  whether free roam near the pod improves.
- **The floor is English-only.** The `office.*.js` locale bundles (en-AU / zh-CN / zh-TW) have
  no `floor` key at all — every slice from 3 onward has put its copy in `officeCast.js` only,
  so this is a standing gap rather than one slice's oversight. It is invisible because the
  merge falls back to English. Deciding to localize it is a real chunk of copy (arrival,
  peek, talk, meeting, props, zones) and should be its own pass.
- **The water cooler is unreachable** (§6 rule 21). Left as scenery on purpose, but the other
  branch is open: move it and re-validate `COFFEE_TILES` against rule 11, which is what put it
  in that corner in the first place. Only worth it if something wants a second kitchen prop.
- **`FLOOR_ZONES.leadership` and the glass disagree.** The zone rect is `[5.3, -0.5, 9.7, 1.0]`
  while the glass panel spans 5.3…10.7 and Barker sits at x 10 — so the tinted zone plate
  probably stops short of his tile. Suspected cosmetic regression from adding Barker
  (`f2ed7fe`); §6 rule 18's parenthetical quotes `10.7` as the zone rect, so the prose and the
  code disagree and one of them is wrong. Confirm with a capture of the back-right corner
  before changing either — the fishbowl-seal assertion passes today and must keep passing.
- **Unverified composition:** standing at the coffee machine _while the coffee-break scene
  plays around you_. Safe by construction (the mark passes `isStandableTile`, which rejects
  anything within 0.5 of a `COFFEE_TILE`) and unit-tested at the verb, but never looked at —
  the slice 9 harness stubbed `onGetCoffee`. Driving it for real needs `OfficeLayer`'s wiring
  in the harness, not just `OfficeFloor`.
- **Complexity warnings** (thresholds, so CI stays green): `FloorCardSlot` 16, `FloorStage` 14,
  `useFloorActivity` 14, `OfficeFloorView` 14, against a max of 12. `FloorCardSlot`'s if-chain
  is the ordering rule the file exists to express and should probably be left alone; the other
  three would each shed a branch or two if a slice happens to be in them anyway.

### Answered, kept for the reasoning

- ~~Floor layout source of truth~~ — `officeFloorPlan.js`, with `officeFloorMovement.js` as
  its sibling for "where may _you_ go".
- ~~Camera/controls detail~~ — answered by slice 7, and the answer is that there is no camera
  to control: the stage fits the viewport, so tap-to-walk and tap-to-talk are both just taps
  on the same stage, distinguished by whether they land on a person. Zoom levels stay out.
- ~~How much of the room should be interactive~~ — answered by slice 9, and the answer is
  deliberately "not much": four props are usable and the rest is scenery, because a room where
  a few things work teaches you to try things and a room where thirty things say "nothing
  happens" teaches you to stop. Adding a fifth usable prop needs a reason beyond "it is there".
