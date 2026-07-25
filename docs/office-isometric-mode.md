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
5. **Meetings in the glass room** — floor-side render of the meeting whose screen-side
   render is the call window. Plan: §7.1.
6. **Desk peeking** — walk over to "see what they're working on": the _Their-own-work_
   fiction visualized on colleague monitors (Ulrich's green terminal, Chad's forty tabs).
   Fiction only — the cast produces no real artifacts (Sign-off rule / one-producer model).
   Plan: §7.2.

## 6. Geometry constraints (learned by looking at it)

The layout is `apps/web/src/utils/officeFloorPlan.js` — tiles, seats, props, zones, plus
`projectIso` / `depthOf` and walk routing. These rules are invisible in code review and
obvious in a screenshot; every one of them cost a capture to find, and later slices must
preserve them:

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

Verification recipe (this is how 1–3, 5 and 6 were caught): temporary Vite harness + headless
Edge screenshot, per the `apps/web:verify` skill. Two Windows gotchas worth knowing before
you trust a capture:

- Edge **crops** to the requested `--window-size` rather than scaling, and display scaling
  inflates the CSS viewport (a 390 px window reported a 492 px viewport). Measure
  `getBoundingClientRect()` in-page before believing an apparent clipping bug — one "button
  overflows on mobile" turned out to be pure screenshot artefact.
- `--virtual-time-budget` fast-forwards **timers, not Web Animations frames**, so a walk
  appears frozen partway however long the budget. To capture the arrival state, pass
  `--force-prefers-reduced-motion`: the walker then skips travel by design, which is exactly
  the state you want to inspect.

## 7. Plan for the remaining slices

Written at the end of slice 4 so a fresh session can pick either slice up cold. Read §2
(binding rules) and §6 (geometry constraints) first — every one of those cost a screenshot
to find. Verification recipe is in §6; repo commands are in `CLAUDE.md`
(`npm run check:affected`, `npm run format:affected`).

**What already exists to build on** (`apps/web/src/components/officeFloor/`):
`FloorStage` (scaled stage; takes `vacantIds`, `speakingId`, `interactive`, and arbitrary
`children` as extra actors), `FloorSeat`, `FloorFigure`, `FloorBubble` (counter-scaled
speech), `FloorWalker` + `useWalkAnimation` (WAAPI path walking), `FloorScene` (set pieces),
`FloorArrival` (the ceremony, including an `ArrivalPlayer` that walks you to your desk).
Layout and routing: `apps/web/src/utils/officeFloorPlan.js`.

### 7.1 Slice 5 — meetings in the glass room

**The key fact that makes this cheap:** `useMeetingPlayback` (mounted in `OfficeLayer`)
already owns beat pacing, narration, interjections and minutes. It appends one beat at a
time to `meeting.transcript`, so a floor renderer only has to _read_ state:
`{ state, title, attendees[], facilitatorId, transcript[], completed, interjectionsLeft }`.
Nothing needs extracting — unlike slice 4, **there is no double-narration risk**, because
pacing lives in the hook rather than in the view. The reason to hide one renderer is purely
visual.

Steps:

1. **Seats around the table.** Add `MEETING_SEATS` to `officeFloorPlan.js` — 8 marks ringing
   `meetingTable` (10.4, 6.9) inside the glass room, ordered so the first 2–4 fill the near
   side. Obey §6 rule 10: no mark may share `x - y` with a desk. Extend the existing
   set-piece test to cover them.
2. **`FloorMeeting.jsx`** — seat `meeting.attendees` on those marks (the facilitator at the
   head), render the newest `transcript` beat as a `FloorBubble` above its speaker, and
   glow the speaker with the `is-speaking` treatment from slice 3. Attendees' own desks go
   into `vacantIds`; the player takes a seat too (the meeting is the one place "you" should
   be visibly in the room rather than at your desk).
3. **Chrome for the two inputs**: "Raise hand" (`interject`, capped by `interjectionsLeft`)
   and leave. Reuse `ScenePanel`'s counter-scale trick anchored on the table, or the floor
   card — the panel is the closer fit.
4. **Wiring**: `OfficeLayer` passes `meeting` + handlers into `OfficeFloor` (same shape as
   `sceneHandlers`) and renders `MeetingOverlay` only when `!onFloor`. Careful: the overlay's
   **docked mode** exists so a meeting doesn't confiscate your screen; on the floor the
   equivalent escape is sitting down, which should leave the meeting running and hand it
   back to the overlay. Verify that round trip explicitly.
5. **Minutes** still post to the Thinking pane through the existing path — do not duplicate.

Risks: `MeetingOverlay` is 333 lines with its own layout; resist porting it. The floor
version renders _state_, not the overlay's markup.

### 7.2 Slice 6 — desk peeking

This slice needs **new data**, which slices 1–5 did not: the _Their-own-work_ fiction
(`GLOSSARY.md`) has never been written down. Follow the established parametric pattern —
one row per cast member, like `personaFaceTraits` and the floor's seat rows.

Steps:

1. **`officeDeskWork.js`** (new, in `apps/web/src/utils/`): one row per cast id —
   a screen "look" (`terminal` | `tabs` | `spreadsheet` | `slides` | `tickets` | `calendar`),
   and a short line they say when you look over their shoulder. Traits read off their
   existing prose, never invented: Ulrich is `terminal`, Chad is `tabs`, Diane is
   `spreadsheet`, Marcus is `slides`, Dave is `tickets`, Pam is `calendar`. Add a drift-guard
   test that every `CAST_TIERS` member has a row.
2. **Screen looks in `isoArt.jsx`**: a `MonitorScreen({ look })` that draws a few coloured
   bars per look on the existing monitor face. Boxes only — no new art pipeline (§3).
3. **Walking to them.** Today `OfficeFloor` renders you _seated_ at your desk even while
   you are standing on the floor. To walk over, vacate `you` and render a player actor —
   generalize `FloorArrival`'s `ArrivalPlayer` into a shared `FloorPlayer` taking a target
   tile, driven by the existing `useWalkAnimation`. Clicking a colleague's desk walks you
   there; the person card gains a "look at their screen" action.
4. **Sign-off rule (ADR-0010) applies literally here**: what you see is fiction. No slot
   content, no artifacts, no implication the cast produced anything.

Risk: this is the slice most likely to grow. The screen looks are ambience — a handful of
rectangles each is the right fidelity.

## 8. Open implementation questions (deferred to build time)

- Floor layout source of truth (a small declarative map module, presumably shared with
  walk-path waypoints).
- Camera/controls detail: zoom levels, tap-to-walk vs. tap-to-talk on mobile.
- Reduced-motion behavior on the floor itself (beyond the card-tour fallback).
- Screen-reader narrative for spatial events ("Chad is walking to your desk").
- Where the mode toggle lives in desktop chrome ("stand up" affordance + shortcut).
