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

10. ~~**The floor without a mouse**~~ — ✅ **shipped**: accessibility, which § 8 had been
    recommending since slice 6 on the grounds that it was the only item getting _worse_ with
    waiting. Three parts, and the first is the reason the other two work.

    **A figure's hit box is now the figure.** This was § 8's oldest debt and the general form
    of § 6 rule 22, and clearing it turned out to be the prerequisite rather than the
    housekeeping: taking the name chip out of the button's layout flow does not move a single
    pixel of the room — the before and after captures are identical — but it takes every seat's
    clickable box from 34–116 px wide down to the 34 × 48 figure. See rule 23 for what the scan
    found, including a bug nobody knew about.

    **One live region instead of five.** `FloorLiveRegion` is mounted for as long as the floor
    is and says where bodies are; `floorAnnouncement` derives that sentence from state already
    on the view, in the **same order the card slot uses** — one ordering rule, now two surfaces.
    The cards stopped being live regions, which is rule 24. Nothing here remembers anything:
    the sentence is a function of where everybody is standing, and the region announces because
    the sentence changed. That makes narration a third _renderer_ of the same state on exactly
    the terms rule 1 sets for the window and the floor, rather than a parallel account of it —
    and it is why the region cannot drift out of step with what the stage is drawing.

    **Focus that renders.** Rule 25 — the indicator that was never there. Plus a
    `forced-colors` block, because every indicator on this floor is a coloured glow and
    forced-colors mode is entitled to throw colours away.

    Reduced motion needed no new behaviour: `useWalkAnimation` and `useFloorAutoPan` both
    already checked it. What it needed was to be **asserted**, since the jsdom suites lean on
    that path for every floor test and nothing would have caught its removal. Two tests now pin
    it — one that a walk arrives without animating, one that fails if any selector the
    stylesheet animates is missing from the reduced-motion block.

11. ~~**Ambient floor life**~~ — ✅ **shipped**: the room breathes when nothing is scripted. One
    colleague at a time leaves their desk (which stays, empty), stands at a prop for a few
    seconds, and walks back. Nobody speaks, nothing is written to any store, and the whole
    thing dies when you sit down — this is `office-parody.md` § 11's _ambient_ register taken
    literally: ambient content is timer-driven and canned-heavy on a tiny budget, and this
    spends **none** of it, because motion is not content. The line to keep: the moment a
    wanderer could say something they would be a walk-by, and walk-bys are moments that belong
    to the store.

    **Nothing new was derived, and that is the whole design.** A wander mark _is_ a prop mark
    (`propTileFor`), so every § 6 rule that validated where you stand to use the coffee machine
    is validating where Chad stands to loiter at it. The only per-person question is whether
    they can get out, and that is `pathCrossesGlass` again — which makes who wanders an answer
    the room gives rather than a list somebody maintains. **Leadership never leave their
    desks**, because there is no route out of the fishbowl that does not cross glass. Rule 17's
    payoff running backwards: nobody had to write down that executives do not fetch their own
    coffee. Confirmed over a 70 s run in Chromium — four colleagues wandered, zero executives.

    It is the first floor-only state about **somebody else**, which is the one genuinely new
    thing, and it means ambience always loses. Three yields, all of them "somebody who outranks
    me wants this": a meeting or a scene claiming the wanderer clears them outright (§ 6 rule 5
    does not allow two of anybody, and whatever claimed them is already drawing one); you
    heading for their tile walks them home; and reduced motion never starts a trip at all —
    the first slice to decide _against_ doing something, because a walk with no engine is a
    teleport and a colleague blinking between their desk and the kitchen is not calmer than one
    walking there.

    Two things the build turned up, both in § 6: rule 19 has a second walker now (26), and the
    room's standability test carries a you-shaped assumption a wanderer inherits (27). Cost, in
    full: one derivation, one hook, one actor component — and `OfficeFloorView` finally shedding
    the branches § 8 had been asking it to shed, since the wiring pushed it to 16 and the
    stage's six conditional actors moved out to `FloorActors`.

12. ~~**Reaching somebody who is not at their desk**~~ — ✅ **shipped**: the verbs follow the
    person. A colleague standing at a prop is now a figure you can click, with a card that says
    where they are and a **💬 Go and talk** that walks you to a mark beside _them_ rather than
    beside the chair they left. Slice 11 is what made this urgent rather than theoretical:
    `FloorSeat` renders no button for a vacant seat, so anybody away from their desk had been
    unselectable since slice 4 — unnoticed, because a scene is rare and carries its own chrome
    and a walk-by comes to you with its own actions. Ambient life put somebody out of their
    chair every twenty seconds, and the failure was silent.

    **One person, one hit target, and it travels with them.** The button is not copied onto the
    empty chair; it moves to wherever the body is (`FloorPersonButton`, now shared by `FloorSeat`
    and `FloorWanderer`, so § 6 rule 23's 34 × 48 invariant has one definition instead of two).
    That is what keeps somebody out of the tab order twice, and it is why clicking their vacant
    chair still does what it did before — you walk over there, which now _reads_ correctly,
    because their body is visibly elsewhere with their name on it.

    **Only a settled figure is anywhere.** Mid-stride there is no button at all and no mark:
    clicking a moving target is a coin flip, and a mark derived from a tile they have not reached
    is a mark they will not be at. `whereaboutsOf` gives three answers — in their chair (the
    static case every earlier slice assumed), settled on a tile, or _away with no tile_ — and the
    third covers both a walker and anybody a moment has claimed, because a set piece or a meeting
    is already drawing them with chrome of its own (§ 6 rule 5). Slice 9's rule finishes the
    sentence: the verb the room cannot honour is **absent**, and the card carries a line about
    where they are instead. That is the honest form of the "unavailable and says so" § 8 warned
    about — the note says so, not a dead button.

    **Nothing new derived, again.** `reachTileFor` is `approachTileFor` with an `at`, so every
    § 6 rule that places a mark beside a chair is placing this one. Peeking is the one verb that
    goes away outright — you cannot look over an absent shoulder — while Slop Chat™ stays, which
    is rule 2's labelled conventional path outliving the diegetic one exactly as intended.

    **Narration did not have to reopen.** § 8 predicted this slice would reverse slice 11's "no,
    ambient traffic has nothing to say", and it did not need to: the answer to "where is
    everybody" belongs on the **target's own label** ("Ticket Bot Dave — IT Helpdesk — Tier 1
    (of 1), The printer"), because a thing you can click has to say what it is, whereas a live
    region that reads out every trip to the printer is still one people turn off. One new
    behaviour did fall out: **whoever you have engaged waits for you** (`holdId`), because the
    dwell clock is 4–9 s and a conversation is longer than that. Ambience still always loses — it
    loses by waiting instead of by leaving.

    Two geometry findings, both from the capture, and neither of them fixed — see § 6 rules 28
    and 29 and the debts in § 8. Cost, in full: one derivation module, one extracted component,
    one hook parameter, and two verbs that stopped deriving their own mark twice.

**There is no slice 13 yet, and that is deliberate.** The list above was written one slice at
a time, each defined when it was picked up rather than planned in advance — so "continue with
slice _n_" only means something once somebody has chosen what _n_ is. § 8 has the candidates,
a recommendation, and the debts that argue for one over another. Pick from there, write the
entry here when it ships, and add anything the room taught you to § 6.

## 6. Geometry constraints (learned by looking at it)

The layout is `apps/web/src/utils/officeFloorPlan.js` — tiles, seats, props, zones, plus
`projectIso` / `depthOf` and walk routing. These rules are invisible in code review, and
1–20 are all obvious in a screenshot; every one of those cost a capture to find, and later
slices must preserve them.

Rules 21–27 are the ones a capture cannot reach, and they divide three ways. Once the floor
grew things you can _click_, a surface could be perfectly drawn and still not answer (21–23) —
use the hit-coverage recipe at the end of this section. Once it grew things you could be _told_
about, a surface could be perfectly marked up and still say nothing (24–25) — those want
`getComputedStyle` and a count of live regions, which the same harness gives you. And once it
grew figures that are not you (26–27), helpers written from your point of view started being
asked questions about somebody else. The through-line for all three: **the room looking right
is evidence about the room looking right, and nothing else.**

Rules 28–29 close that loop from the other end: both are back in a screenshot, and both are
about a **figure standing somewhere no figure stood before**. Slices 1–11 only ever put a
standing body on a mark derived for _you_, and you leave again; slice 12 puts a colleague on a
prop mark and then hangs chrome off them. The general form: **a position that has only ever been
occupied briefly has only ever been tested briefly.**

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
    the CTO. The panel now spans the whole row with two short returns closing the ends (x 5.3
    and x 10.7) and the floor plate's own edge closing the back. Note the returns sit **wider
    than the `leadership` zone rect**, whose far edge is 9.7: the tinted plate is signage and
    the glass is a barrier, and a barrier drawn to the signage is one you can walk around.
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

23. **A hit box that is bigger than what it draws steals from whatever is behind it —
    including other people.** Rule 22 caught this between a figure and a prop and dodged it by
    moving the printer. The general fix is to constrain the button to the figure and hang the
    name chip off it as an overlay (`position: absolute; bottom: 100%`), which changes the
    room's appearance by nothing at all and its behaviour by a lot. Measured with the rule-22
    scan, 441 samples per box, at 1440 × 900:

    |                                      | before                   | after                        |
    | ------------------------------------ | ------------------------ | ---------------------------- |
    | person box                           | 34–116 px wide × 68 tall | **34.3 × 48.5**, all sixteen |
    | clicks on Critique that hit Critique | 357 / 441                | 441 / 441                    |
    | …that hit goMad instead              | **84**                   | 0                            |
    | stage samples reaching the floor     | 3313 / 3600              | 3449 / 3600                  |
    | printer's box: floor / Linda / Pam   | 376 / 36 / 12            | 406 / 12 / 6                 |

    The Critique row is the find. Two people's invisible boxes overlapped, so **19% of clicks
    aimed at one colleague selected a different one** — a bug that had been there since slice 1,
    that no capture shows, and that nobody had reported because the wrong card still opens and
    still looks like a card. The lesson is stronger than rule 22's: an oversized hit box is not
    only a hazard to _new_ things you make clickable, it is a hazard to the things that were
    already there. Anything on this stage should be as big as it is drawn.

24. **A live region only speaks if it was already in the room.** The floor card slot is
    single-occupancy, so every card arrived as a fresh node with its text already inside it —
    which is the one shape assistive technology is not required to announce, and usually
    doesn't. Five cards each carrying `aria-live` were five regions that announced sometimes.
    The fix is one region mounted for the floor's whole life, empty until something happens.
    The distinction to carry forward: a **speech bubble** is fine as it is, because it stays
    mounted while a scene plays its beats through it and its text changes underneath — that is
    the shape live regions are specified for. Mount-with-content is the anti-pattern, not
    `aria-live` itself. A second reason applies to any card with a field in it: a region
    wrapping a composer is a region that reads itself out as you type.
25. **`drop-shadow()` has no spread, and an invalid filter takes the whole declaration with
    it.** `.office-floor-person:focus-visible` set
    `filter: drop-shadow(0 0 0 2px var(--floor-accent)) …` — four lengths, where the function
    accepts at most three (x, y, blur). The value was invalid, so browsers discarded the entire
    `filter` property, so **focusing or selecting a person had no indicator whatsoever** for
    nine slices. `getComputedStyle` on a focused figure returned `filter: none` and
    `outline: 0px none`. Nothing about this fails a review: the rule reads exactly like a focus
    ring. Two guards now exist — the sheet is scanned for `drop-shadow` calls with more than
    three leading lengths, and the person takes a real `outline`, which only became possible
    once rule 23 made the button the size of the figure.

26. **Every walk that can be interrupted needs rule 19's read-back, and "interruptible" is a
    property of the room, not of the walker.** `useWalkAnimation` re-places its element at the
    new path's _start_ when the walk key changes, so turning somebody round mid-stride snaps
    them forward onto the mark they had not reached and then walks them back from there. Free
    roam hit this first and `liveTileOf` was written for it. Ambient life hit it again the
    moment the wanderer had to yield: you can claim the tile they are walking to **before they
    arrive**, which makes it a reachable state rather than a theoretical one. The test to write
    is the mid-walk one — a yield from the standing phase passes with or without the fix, so
    asserting only that proves nothing.
27. **`isStandableTile` is asked from _your_ point of view, and a mark handed to somebody else
    inherits the assumption.** Its face test skips `you` on the entirely reasonable grounds
    that you are the one doing the walking — every mark family before slice 11 was a tile you
    stand on, and you are not at your desk while you stand on it. A wandering colleague breaks
    that: they stand on the mark while you are still sitting down, so nothing has checked
    whether their shoulders land across your face. The three prop marks happen to be clear
    today, which is luck of the layout rather than a guarantee, so the wander suite asserts
    every mark against **every** seat including yours. The general form, for the next mark
    family that is not about you: re-read whose point of view each geometry helper was written
    from before reusing it for somebody else.

    Slice 12 needed the same test run the other way, and it is worth seeing why it is a
    _different_ test rather than the same one reused. `isStandableTile` validates against
    `FLOOR_SEATS`, so it knows where everybody **works** — it has no idea a body is stood at the
    printer, and it still believes that body is at the desk it left. So a mark derived _around_
    somebody's live position has to re-ask both halves of the face test about the position
    itself, which is `figuresClear` in `officeFloorMovement.js`. It currently rejects nothing:
    the only offset in `APPROACH_OFFSETS` that shares a screen column with the target is
    `{1, 1}`, and two tiles of depth is 56 px against a 48 px figure. That is the constraint
    being encoded before the layout needs it rather than dead code — the ladder is what makes
    "there is nowhere to stand" an answer the room gives.

28. **A counter-scaled bubble fits beside a desk and not in the middle of the room.** § 6 rule 12
    said this about a _small_ room; the pod is the opposite problem and gives the same answer for
    the same arithmetic. A `FloorBubble` is 264 px — 2.4 screen columns — and its tail is pinned
    at `left: 50%`, so rule 13's requirement (keep the speaker's column) fixes where it can go.
    Talking to somebody at their desk covers **nobody**, measured; talking to the same person
    standing at the whiteboard mark covers **Ulrich's head**, two columns screen-left. Nothing
    changed about the bubble: every desk mark slice 8 ever exercised happens to sit near an edge
    of the floor plate, and a prop mark is central _by construction_, because central is what
    makes a prop somewhere people gather.

    | talking to Chad                             | bubble box                | clears the speaker    | covers                                    |
    | ------------------------------------------- | ------------------------- | --------------------- | ----------------------------------------- |
    | at his desk (2, 5), `--over-seat`           | 334.7…599.1 × 248.9…323.3 | yes                   | nobody                                    |
    | at the whiteboard (8, 4), `--over-standing` | 726.2…990.6 × 421…495.4   | 8.6 px above his head | `refine`'s head (730…763.8 × 417.7…451.6) |

    **Left as it is, and the reason is that every fix is worse.** Rule 15's actual requirement —
    the balloon must not cover _the speaker_ — is met with 8.6 px to spare, and the speaker is
    also the one glowing. A bigger `--over-standing` lift needs +78 px to clear the row behind,
    which is 2.8 tiles of depth and reads as detached rather than as speech. Parking it on a
    fixed depth line (rule 13's mechanism, `liftToDepth`) works for the glass room because the
    room _has_ a back row to sit above; the pod's equivalent line is most of the way up the
    stage. Moving the column breaks the tail. Narrowing the bubble reopens the geometry of every
    other surface that uses it. So this is recorded rather than repaired — see § 8.

29. **A body standing at a prop eats that prop's clicks, and it bites hardest where there was
    least to spare.** The printer answers 16 of 441 sampled points normally (rule 22's story is
    how it got that back). With somebody loitering at it, that is **7 of 441** — their head and
    shoulders sit exactly on its lower-front face, because a prop mark is by definition a tile
    with a clear view of the prop and paints later than it. Physically this is correct and you
    should not want it otherwise: you cannot click through a person, and clicking the person is
    what you did. It is also self-limiting, since heading for their tile walks them home
    (slice 11's second yield). Recorded because rule 22's lesson was about a _new_ clickable
    thing colliding with the cast's boxes, and this is the moving version of it — the collision
    arrives and leaves on a timer, so no capture taken at the wrong moment shows it.

    Two sampling notes, both learned here. The coarse 21 × 21-over-the-whole-box scan is
    **reproducible to the cell** across repeated reads (five reads, identical tallies) — the idle
    bob does not move the answer, so a difference between two runs is a real difference. And that
    scan and a fine scan of the box's middle third can disagree completely and both be right: a
    prop's art sits near the bottom of its 260 px view box (`PROP_VIEW.minY` is −200), so the
    box's _centre_ is empty air above the object and reaches the floor for all three usable props,
    with or without anybody standing there.

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
a phone.

**On Linux (cloud sessions), drive Chromium with Playwright instead** — none of the Windows
gotchas below apply, and it is the better rig regardless: `page.evaluate` runs the probe
in-page, so a scan and a capture come out of the same run. Slice 10 used
`npx vite --port 5199 --strictPort` plus `playwright-core` installed into the scratchpad
(never the repo), launching `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` with
`--no-sandbox`. Two things it buys that Edge did not:

- **`page.emulateMedia` / the `newPage` options are how you test the modes.**
  `{ forcedColors: 'active' }` and `{ reducedMotion: 'reduce' }` gave rules 24–25 a real
  answer in seconds — a focused person's computed `outlineColor` under forced colours, and
  `document.getAnimations().length` after a walk under reduced motion.
- **A before/after diff is `git stash push -- apps/web/src`, not just the stylesheet.** Stash
  less than that and the components you added still render; slice 10's first baseline had an
  unstyled live region taking a line of layout, which changed the stage scale and made every
  measurement incomparable. The tell was prop boxes reading 246 px in one run and 262 in the
  other, when `PROP_VIEW` is a constant.

The Windows gotchas, for whoever is on that machine:

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

**Hit-coverage recipe (slice 9, extended in slice 10).** Rules 21–23 are the ones a screenshot
could not have found: the floor _looked_ right and the printer simply did not answer to a
click. What finds them is `document.elementFromPoint` in the harness, scanned on a grid over
each interactive element's box and tallied by what it actually reaches. Report the counts
rather than a yes/no — "16 of 441 cells reach the printer, 30 reach Linda" is a diagnosis,
where "the printer is not clickable" is only a symptom. Two things to get right: sample in
**fractions of the client rect**, never in stage pixels (the stage is CSS-scaled to fit, so
`PROP_VIEW`'s 260 px is ~215 on a 1440-wide viewport, and stage-unit offsets silently probe
the wrong place); and check the empty corners of a box as well as its middle, which is how
the `pointer-events` bug below was caught. Sanity-check any coverage number against the
prop's own drawn area — a printer is a small object and will never score like a whiteboard.

Slice 10 added two passes worth keeping, and the second is the one that found rule 23's real
bug. **Scan the people too, not only the thing you just added** — the scan was built to ask
"does my new prop answer?", and turning it on the cast is what showed that Critique's box was
handing 84 of 441 clicks to goMad. **And scan the whole stage as one grid**, bucketing each
sample into floor / person / prop: that single number ("3313 of 3600 samples reach the floor")
is the only measure of how much of the room free roam actually has, and it is how you tell a
hit-box fix from a hit-box rearrangement.

Slice 12 added the missing half of that: **a baseline out of the same build, by asking for
reduced motion.** Slice 11 decided no ambient trip ever starts under reduced motion, so
`newPage({ reducedMotion: 'reduce' })` gives you a floor with nobody up — from the code you are
testing, with no stash and therefore no risk of the stash changing the stage scale and making
every measurement incomparable. It reproduced slice 10's numbers exactly (floor 3449 / prop 50 /
person 101 of 3600), which is also a check that the harness itself has not drifted. With somebody
up and about it is 3441 / 50 / 109: eight cells move from floor to person, because a standing
figure occupies cells the seated one had given to its desk. That is the whole cost of the room's
first permanent stage-level hit target, and every one of the sixteen person boxes plus the
wanderer's still measured 33.8 × 47.8 and reached itself 441 times out of 441.

The other habit worth keeping is **driving a random-seeded surface through the harness rather
than around it**. Ambient life picks who gets up with `Math.random`, so the slice 12 harness
overrode it (`?rand=`) and nothing else: 0.7 puts Chad at the whiteboard, 0.5 puts Dave at the
printer. Both are needed — 0.7 alone picks an office-tier colleague with social verbs, and 0.5 is
the one that lands somebody on the tightest prop box in the room, which is where rule 29 showed
up. Note that the default 0 picks Ulrich, who is _team_ tier and has no Slop Chat™ at all, so a
seed that looks like the obvious one makes the whole verb path invisible.

One CSS finding worth keeping, since it is the reason usable props do not swallow the floor:
`pointer-events: visiblePainted` **has to land on the SVG shapes, not the `<svg>` root**. The
root is an HTML-flow box, where Chrome treats an SVG-only value as `auto` and hands back the
whole 260×260 rectangle — so a corner of the coffee machine's box a full tile away from the
machine still answered to the machine, and free roam went dead around it. The working shape
is `pointer-events: none` on the button _and_ the `<svg>`, re-enabled on `.office-floor-prop-art *`.

## 7. The bench (for whatever comes next)

Slices 1–12 have shipped. Anything new on the floor should be built out of the
pieces below rather than beside them — and should read §2 (binding rules) and §6 (geometry
constraints) first, because every one of those cost a screenshot to find. Verification
recipe is in §6; repo commands are in `CLAUDE.md` (`npm run check:affected`,
`npm run format:affected`).

**Components** (`apps/web/src/components/officeFloor/`): `FloorStage` (scaled stage; takes
`vacantIds`, `speakingId`, `interactive`, `onWalkTo`/`roamOrigin`, `onUseProp`/`activePropKind`,
and arbitrary `children` as
extra actors), `FloorRoam` (the click surface + hover marker), `FloorProps` (the furniture, and
the ones you can use — mind § 6 rule 23 before making anything else on the stage clickable) +
`FloorPropCard`, `FloorLiveRegion` + `floorAnnouncement` (the room in one sentence, for
whoever is not looking at it — a new card needs a line here, in the same position),
`FloorActors` (every figure on the stage that is not seated; a new actor is one more
`x ? <X /> : null` here rather than another branch in the view component),
`FloorPersonButton` (**the** clickable figure — one definition of § 6 rule 23's 34 × 48 box, and
where any new place a person can be clicked belongs),
`useFloorWander` + `FloorWanderer` (ambient traffic, and since slice 12 a figure you can select
where it stands — mind § 6 rules 26–29),
`useFloorPropUse` (what happens when you get there, once), `useFloorPresence`
(where you
are standing — view state, like the peek it absorbed), `useFloorActivity` (presence plus the
reasons you went there, as one object; the two social verbs are _handed_ their mark rather than
deriving one), `useFloorTalk` (a conversation's composer, not its
dialogue), `FloorTalk` + `FloorTalkCard`, `useFloorKeyboard` (Escape ladder + arrow stepping),
`useFloorAutoPan`, `FloorTopBar`, `FloorCardSlot`, `FloorScenes`,
`FloorSeat`, `FloorFigure`, `FloorBubble` (counter-scaled speech), `FloorDeskSpeech` (a line
above somebody at their own desk, or at the tile they are standing on — mind §6 rules 15, 20
and 28), `FloorPanel` (counter-scaled panel
pinned to a tile — mind §6 rule 12), `FloorWalker` + `useWalkAnimation` (WAAPI path
walking), `FloorPlayer` (you, walking, wherever you are not at your own desk), `FloorScene`
(set pieces), `FloorMeeting` + `FloorMeetingCard` (the glass room, and why its chrome is a
card), `FloorPeek` + `FloorPeekCard` (desk peeking), `FloorArrival` (the ceremony).

**Data**: layout, routing and mark derivation in `apps/web/src/utils/officeFloorPlan.js`;
where you may walk, who you may walk up to and which props you may walk over to use in
`apps/web/src/utils/officeFloorMovement.js`; **where somebody is when it is not their own chair,
and whether the room will send you to them**, in `apps/web/src/utils/officeFloorReach.js`;
who gets up on their own and where they go in
`apps/web/src/utils/officeFloorWander.js`; what using a prop does in
`apps/web/src/utils/officeFloorProps.js`; the cast's fictional
workload in `apps/web/src/utils/officeDeskWork.js`; who is away from their desk in
`apps/web/src/utils/officeSceneCast.js`.

**Five habits worth keeping.** A new mark family should be _derived and asserted_ rather than
hand-placed (see the note under §6 rule 10) — the geometry rules are cheap to encode and
expensive to rediscover. A new surface belongs in the floor **card slot** unless it has
earned a place on the stage: the slot is single-occupancy and ordered by how much of your
body is committed (meeting → talk → peek → prop → person card → hint), and since slice 10
that ordering is **also** the order `floorAnnouncement` speaks in, so a new card owes a
sentence in the same position. Anything new that is **clickable on the stage** gets the
hit-coverage scan from §6 before you believe it works — slice 9's printer was drawn perfectly
and answered 11 clicks in 441, and slice 10 found that Critique had been handing a fifth of
her clicks to goMad since slice 1. And anything new that is **as big as its box rather than as
big as its art** is the same bug waiting: constrain the element, or accept that it is stealing
from whatever is behind it.

A fifth, added by slice 11: **anything that moves a figure who is not you re-asks every
geometry question from a different point of view.** The helpers in `officeFloorPlan.js` were
written for the one walker the floor had, and two of them say so in their own comments
("you are the one doing the walking"). Reusing them for somebody else is right — there should
only ever be one definition of standing room — but read whose eyes each one is looking
through first, and assert the difference (§ 6 rules 26–27).

A sixth, added by slice 12: **a verb should be offered and executed off the same derivation.**
`usePersonDetails` used to ask the room for a mark to decide whether to render _Go and talk_, and
`useFloorActivity.startTalk` then asked again to find out where to walk — harmless while the
answer was a pure function of the layout, and a bug the moment it became a function of where
somebody is standing. The card now returns the **tile** rather than a boolean, `canTalk` is that
tile existing, and pressing the button walks to the tile that licensed it. The general rule for a
verb whose availability the room decides: derive once, and pass the answer to whoever acts on it.

Still open, and what to do next: §8.

## 8. Where to take this next

Nothing here is designed yet. The ordering below is a recommendation, not a queue.

### The next slice

Nothing is recommended over the others yet, and the reason is worth stating: slice 12 cleared
the one item that was _getting worse with waiting_, and nothing on the list below is. Slices 10
and 12 were both easy calls because ambient life had made a standing gap actively louder. What
remains is a set of genuine choices, so pick on appetite rather than on urgency.

Three candidates, none designed:

- **Where the "stand up" affordance lives in desktop chrome.** The oldest open item and the only
  one that is not floor work at all: today the floor is reachable from the desk dock, and the
  mode toggle has never had a deliberate home or a keyboard shortcut. Small, self-contained, and
  the one candidate a person who has never read § 6 could take.
- **Bubble placement for a speaker who is not against a wall** (§ 6 rule 28). The finding is
  measured and the four obvious fixes are each recorded as worse, which is exactly the shape of
  problem that wants its own slice rather than a patch inside somebody else's. It would touch
  every surface that uses `FloorBubble` and needs re-validating against rules 6, 12, 13, 15 and
  20 — so it is real work, and it is also the only known way the room draws something wrong.
- **The screen-world skin** (§ 4), which has not been touched since it was written. It is a
  parallel track by design, blocks nothing, and is the only item here that would make desktop
  mode feel like part of the same fiction rather than the thing you leave to see the fiction.

Considered and not chosen, kept so nobody re-derives them: **a second wanderer at a time**
(§ 8's original sketch imagined "two people end up at the whiteboard"; one at a time was chosen
deliberately and should stay until something wants the collision rules), and **making scene
participants and meeting attendees reachable too** — slice 12 deliberately stops at somebody
whom nothing has claimed. A colleague in a coffee break or in the glass room is already being
drawn by a surface with its own chrome, and § 6 rule 5 does not allow two of anybody; walking up
to interrupt them would mean deciding what a conversation does to a scene that is mid-script,
which is a content question rather than a geometry one.

### Debts the shipped slices left behind

- **The arrival ceremony has no live region.** Slice 10 gave `OfficeFloorView` one and left
  `FloorArrival` — a sibling that renders its own `FloorStage` from `ArchiSlop.jsx` — with
  none. It narrates in _voice_, which is not the same thing and is not available with sound
  off. This is the newest debt and the cheapest to clear: the ceremony already knows exactly
  who is speaking (`colleagueVoiceLine`), so it wants a `FloorLiveRegion` and about four
  strings, not a design.
- **A speech bubble over somebody standing in the middle of the room covers a bystander's head**
  (§ 6 rule 28). Measured, and left as it is on purpose: rule 15's real requirement (do not cover
  _the speaker_) is met with 8.6 px to spare, and each of the four available fixes breaks
  something rules 13, 15 or 20 established. It is the only known case of the room drawing
  something wrong, so it is also a candidate slice in its own right — see above.
- **A body standing at a prop eats that prop's clicks** (§ 6 rule 29): the printer goes from 16 of
  441 sampled points to 7 while somebody loiters at it. Correct physics and self-limiting
  (heading for their tile walks them home), so nothing to fix — but if a future slice makes a
  fourth prop usable, that prop's coverage should be measured **with somebody standing at it**,
  not only empty.
- **The floor is English-only, and slices 10 and 12 each made it slightly worse.** The
  `office.*.js` locale bundles (en-AU / zh-CN / zh-TW) have no `floor` key at all — every slice
  from 3 onward has put its copy in `officeCast.js` only, so this is a standing gap rather than
  one slice's oversight, and `floor.narration` and `floor.away` are now part of it. It is
  invisible because the merge falls back to English. Localizing it is a real chunk of copy
  (arrival, peek, talk, meeting, props, zones, narration, whereabouts) and should be its own
  pass. Note one wart it would want to fix: `floor.away` and `floor.narration` both compose prop
  names into sentences from `props.items[kind].name`, which is capitalised ("The printer"), so
  every such sentence is punctuated around a capital rather than reading through it.
- **The name chip is still a hover affordance on a 34 px target.** Rule 23 shrank the button to
  the figure, which is right for clicking and slightly worse for _reading names_: you now have
  to be on the figure rather than anywhere in a name-width box. Nobody has complained because
  nobody had the old behaviour long enough to miss it, but if a slice wants names discoverable,
  the answer is a deliberate one (a "show all names" toggle, or the chip appearing on
  proximity) rather than growing the hit box back.
- **The water cooler is unreachable** (§6 rule 21). Left as scenery on purpose, but the other
  branch is open: move it and re-validate `COFFEE_TILES` against rule 11, which is what put it
  in that corner in the first place. Only worth it if something wants a second kitchen prop.
- **Unverified composition:** standing at the coffee machine _while the coffee-break scene
  plays around you_. Safe by construction (the mark passes `isStandableTile`, which rejects
  anything within 0.5 of a `COFFEE_TILE`) and unit-tested at the verb, but never looked at —
  the slice 9 harness stubbed `onGetCoffee`. Driving it for real needs `OfficeLayer`'s wiring
  in the harness, not just `OfficeFloor`.
- **Ambient life only exists while you are standing on the floor.** `OfficeFloor` renders
  nothing in desktop screen mode, so the room does not keep breathing behind your back — it
  starts when you stand up and stops when you sit down. Almost certainly correct (a floor
  nobody is looking at has no reason to animate, and the alternative is a timer running under
  the editor forever), but it is a choice nobody made explicitly, and it is worth knowing
  before anybody wonders why the office is always calm for the first five seconds.
- **Complexity warnings** (thresholds, so CI stays green): `FloorCardSlot` 16, `FloorStage` 14,
  `useFloorActivity` 14, `FloorWalker` 13, `FloorScene` 21, against a max of 12. `OfficeFloorView`
  came off this list in slice 11 — its stage actors moved to `FloorActors` — and slice 12 had to
  work to keep it off: the wiring took it to 18 before `talkView` moved the whereabouts
  projection out. The general lesson is worth more than the individual numbers: **most of these
  are default parameters**, which ESLint counts one apiece. `floorAnnouncement` went from 28 to 11
  mostly by dropping seven `= null` defaults on fields that are read for truthiness; `FloorActors`
  was born at 16 for the same reason; and slice 12 got `FloorPersonCard` and `FloorWanderer` back
  under budget purely by dropping `= false` from props that are truthiness-tested a few lines
  later and always passed. Check that before restructuring anything. `FloorCardSlot`'s if-chain is
  the ordering rule the file exists to express and should be left alone.

### Answered, kept for the reasoning

- ~~Floor layout source of truth~~ — `officeFloorPlan.js`, with `officeFloorMovement.js` as
  its sibling for "where may _you_ go".
- ~~Camera/controls detail~~ — answered by slice 7, and the answer is that there is no camera
  to control: the stage fits the viewport, so tap-to-walk and tap-to-talk are both just taps
  on the same stage, distinguished by whether they land on a person. Zoom levels stay out.
- ~~Should ambient movement be narrated~~ — answered by slice 11, **and slice 12 did not reopen
  it after all.** The answer is still no: ambient traffic is the one class of event on this floor
  with nothing to say, and a live region that reads out every trip to the printer is one people
  turn off — and then it is not there for the walk-by that mattered. § 8 expected making the cast
  reachable to force the question, on the grounds that "where is everybody" would stop being
  answerable from the room. What it missed is that the answer belongs on the **target**, not in
  the region: a figure you can click has to say what it is, so the button's own label carries the
  place ("…, The printer"). Narration reports what is _happening_; a control reports what it _is_.
  That distinction is the reusable part.
- ~~What a moving figure means for a pointer~~ — answered by slice 12, and the answer is that only
  a **settled** figure is clickable at all. Clicking somebody mid-stride is a coin flip and a mark
  derived from a tile they have not reached is a mark they will not be at, so both legs of a trip
  render the plain slice 11 figure with no button. The corollary is the more useful half: because
  only a settled figure has a position, "are they reachable" and "are they clickable" are the same
  question, asked once in `whereaboutsOf`.
- ~~How many wander at once~~ — answered by slice 11, and the answer is one. The brief is a
  room that breathes, not one that bustles; one walker is one `useWalkAnimation` whose
  interactions with everything else are countable; and ten eligible colleagues on a ~20 s
  cadence is already plenty of life. A second would need collision rules that do not exist.
- ~~How much of the room should be interactive~~ — answered by slice 9, and the answer is
  deliberately "not much": four props are usable and the rest is scenery, because a room where
  a few things work teaches you to try things and a room where thirty things say "nothing
  happens" teaches you to stop. Adding a fifth usable prop needs a reason beyond "it is there".
- ~~`FLOOR_ZONES.leadership` and the glass disagree~~ — **the debt was recorded on a false
  premise and is closed.** It read "Barker sits at x 10, so the tinted plate probably stops
  short of his tile". Barker sits at **x 9** (`FLOOR_SEATS`), so his tile spans 8.5…9.5 and is
  entirely inside the zone rect's 5.3…9.7 — as are all four leadership seats. Nothing stops
  short of anybody. What was actually wrong was a **comment**: `officeFloorPlan.js` quoted the
  zone rect as `[5.3, -0.5, 10.7, 1.0]`, and §6 rule 18 repeated the misquote. The glass
  genuinely _is_ wider than the plate, and has to be — the returns at 5.3 and 10.7 are what
  seal the ends, and a barrier drawn only to the tint is a barrier you can walk around, which
  is the exact bug rule 18 exists to record. The untinted strip between 9.7 and 10.7 is where
  the server rack stands. Confirmed against a capture of the back-right corner; both the
  comment and rule 18 now say so.
