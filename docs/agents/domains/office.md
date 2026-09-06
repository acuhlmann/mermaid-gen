# Office layer gotchas

**Scope.** The parody-OS desk frame, the isometric floor, the cast, office moments and set pieces,
narration and TTS, and the office locale bundles — `apps/web/src/components/OfficeFloor*`,
`officeFloor/`, `OfficeLayer*`, `DeskOs*`, `personaFaces/`, `apps/web/src/state/office*`,
`apps/web/src/utils/office*`, `apps/web/src/i18n/locales/office.*`, and the server's
`apps/server/src/agents/office*` / `_lib/office*`.

**Who loads this, and how.** One file, four readers — deliberately agent-agnostic:

| Agent           | Route in                                                                           |
| --------------- | ---------------------------------------------------------------------------------- |
| Claude Code     | `apps/web/src/components/officeFloor/CLAUDE.md` and `apps/web/src/state/CLAUDE.md` |
| Cursor          | `.cursor/rules/office.mdc` (glob-scoped, `alwaysApply: false`)                     |
| qwen and others | the index table in [`AGENTS.md`](../../../AGENTS.md)                               |
| any of them     | [`docs/office-parody.md`](../../office-parody.md) and the docs it links            |

**Why it is not in the root files any more.** 48 KB in `CLAUDE.md` and 27 KB in `AGENTS.md`, both
read in full at the start of every session in this repo. Nothing here got less important; it is
scoped to the code it describes. Add findings here, once — the rule requiring both root files is
retired for domain content (`docs/routines/README.md` rule 8).

**The one thing to internalise before editing anything here.** The office is built out of
_moments_, and almost every rule below is a consequence of two of them:

- **Ambient vs reactive** (§ 11). A timer interrupted you → stay canned-heavy. You started it or
  answered it → lean LLM, because a canned reply to a sentence you typed is the clearest possible
  tell that nobody is home.
- **Record, never trigger** (ADR-0010 consequence #4). The log, working memory and the errand all
  _record_. The moment any of them schedules or fires something, it has become auto-fix-on-idle in
  a new hat.

**Two globals every floor test that mounts inherits, and never names:** the wall clock and
`Math.random`. Pin both — `vi.setSystemTime(new Date(2026, 7, 11, 12, 0, 0))` and
`vi.spyOn(Math, 'random').mockReturnValue(0.75)` — or the suite passes in isolation and fails in
file order, or passes for 16 hours a day and fails for the other 8.

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
  [`docs/office-continuity.md`](../../office-continuity.md) and
  [ADR-0013](../../decisions/0013-office-continuity.md). Working memory records and never
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
  (`officeFloorStyles.test.js`). See [`docs/office-isometric-mode.md`](../../office-isometric-mode.md)
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
  second one. See [`docs/office-parody.md`](../../office-parody.md) § Desk verbs.
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
  descendant. See [`docs/office-window-manager.md`](../../office-window-manager.md).
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
  never the office half. See [`docs/office-window-manager.md`](../../office-window-manager.md) §11.
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
  [`docs/office-isometric-mode.md`](../../office-isometric-mode.md) §4b.
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
  `listVoices` before re-adding. See [`docs/office-narration-roadmap.md`](../../office-narration-roadmap.md).
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
- **The office has a scripted visit now, and it reads the store as well as the room.**
  `apps/web/test/officeVisitTrace.mjs` (not a `*.test.js` — it needs a browser, a server and
  ~45 s) drives one fixed visit and prints one JSON object. Four things it had to learn, and
  each of them is a way an office measurement lies. **`/api/office/speak` answers `200` with
  `audio: null` when TTS is off**, by design, so counting office calls generically reports
  `llmConfigured` on a room that asked no model anything — the LLM tell is `/moment` and its
  siblings, never `/speak`. **Figure positions must be stage-relative** (`rect` minus the
  `.office-floor-stage` rect, over its width): the stage is CSS-scaled to fit, so the fit-scale
  settling once after mount moves every viewport rect in one tick and "who moved first" reports
  a reflow instead of a person. **A drawn bubble is not the record** — voice leads and text is
  the fallback, so `onUsage` (tokens actually spent) and the store's own `imHistory` are what
  distinguish "nobody spoke" from "somebody spoke and the room never showed it". And
  **`chromium.launch()` with no `executablePath` fails here**: the preinstalled browsers are
  revision 1194, a fresh `playwright-core` looks for its own, and the error names a
  `chromium_headless_shell-<n>` path nobody chose. Resolve the binary off `PLAYWRIGHT_BROWSERS_PATH`.
- **`channel: 'talk'` is what makes speech physical — every spoken path must set it.**
  `isSpokenLine` is exactly `msg.channel === 'talk'`, `latestTalkLine` returns nothing else, and
  both pushers (`pushOfficeImPing`, `pushOfficeImReply`) drop the field entirely when the channel
  is `'im'` (their default). #552: `handleTalkReply` — the floor's own composer — filed both
  halves of a conversation you had standing in front of somebody as ordinary Slop Chat IMs, so
  the model answered and no surface drew a thing. Now fixed on both sides:
  `pushOfficeImReply({ colleagueId, body, channel: 'talk' })` for the user's spoken line, and
  `desk.imSomeone(colleagueId, ctx, 'talk')` — a medium passthrough onto the same
  `deliverImReply` ladder Slop Chat uses — for the colleague's answer. `useDeskActions.test.jsx`
  pins the pair. Two invariants to keep when adding any new talk path — `FloorTalk`'s header says
  physical speech stays out of Slop Chat, and § 11 says a line you provoked must be responsive —
  so an untagged spoken line is the suspect when a bubble never lifts.
- **A working-memory beat is validated twice, and a field taught to only one side is a fact that
  dies at the next reload.** `rememberWorkingMemoryBeat`
  (`apps/web/src/state/officeWorkingMemoryStore.js`) and `sanitizeWorkingMemoryBeat`
  (`apps/web/src/utils/officeAmbienceStorage.js`) each build a fresh object field by field and each
  drop a beat that ends up with nothing they recognise — so a new field added to the writer alone
  works perfectly until F5. Both now call one exported `normalizeWorkingMemoryBeat`, which makes
  agreeing structural rather than a promise; beat values that reach a prompt are **enums, never
  free text** (`OFFICE_WORKING_MEMORY_INTERRUPTIONS`), for the reason `officeScript.ts`'s
  situations are.
- **`hasWorkingMemoryFact` is the dwell gate, so who writes a beat decides who the office can be
  bothered to think about.** `useDeskActions.remarkTo` passes `cap: 0` when a colleague has no fact
  about you, which deals from the canned deck; the writers are `officeMomentDelivery.js` (a
  delivered moment) and, since the interrupt slice, `useFloorInterruptMemory.js`. Measured on the
  scripted visit, three runs: the colleague you loiter beside answers from the bank with **zero**
  `/api/office/moment` calls, because nobody in the room had a fact about you yet. Before adding a
  "the office feels canned here" finding, check which side of the gate it is on — a missing call is
  usually a missing **fact**, not a missing cap.
- **After presence / TTS / desk-frame edits**, prefer `apps/web/test/officePresence.test.js`,
  `deskOsPresenceStrip.test.jsx`, `deskOsFrameStyles.test.js`, `apps/server/test/officeTts.test.js`,
  `officeRoute.test.js` (or `npm run test:affected`). **After isometric-floor edits**, `npm run
test:floor`; the floor test map is [`docs/agents/isometric-floor-tests.md`](../../agents/isometric-floor-tests.md).

---

## Full findings

- **Office sound is one posture, not four checkboxes.** Menu bar **Admin** carries 🎧 **Headphones**
  (how the office reaches you) and 🔕 **Focus** (whether it does), plus the Approved vendors strip.
  The composer band holds Mail / Chat / Meeting as direct icons (`DeskActionsDock`), not a helmet
  menu. `setOfficeHeadphones` in `apps/web/src/state/officeMomentStore.js` is a **macro** that
  writes `narration`/`soundscape`/`captions` — read those three, never `headphones`, from a
  consumer. Boot runs `reconcileOfficeHeadphonesPosture()` so a stale pre-macro Voice key cannot
  desync the menu from speech. Focus is also the advisor roundtable's mute; don't reintroduce a
  second one. See [`docs/office-parody.md`](../../office-parody.md) § Desk verbs.
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
- **Office windows have three placements and one minimize; both live outside the window.**
  `FloatingWindow` resolves a `presentation` from the viewport (`useWindowPresentation`):
  free-dragging ≥1025px, docked panel 640–1024px, bottom sheet ≤639px. A sheet has **no
  `left`/`top` at all** — don't "fix" phone clipping by tuning `minVisiblePx` in
  `useDraggablePosition`; that hook is disabled at that breakpoint and `useSheetSnap` owns the
  gesture instead. **Minimize is `overlayStack` state, not a local `useState`** — a minimized
  window renders nothing and the `DeskOsTray` pill restores it. Three traps: the placement CSS
  must remain the **last block in `App.css`** (every window sets its own size at (0,1,0), so
  the (0,2,0) placement rules win by order too); a sheet reserves **only** `--desk-taskbar-h`,
  because the taskbar is where minimize sends things; and `minimizeOtherOverlays` (the phone's
  one-window-at-a-time rule) spares anything with `manageable: false`, which is the only thing
  stopping it from swallowing IM pings. Never re-add `touch-action` to `.floating-window` — the
  drag handlers are on the handle, and on the root it vetoes touch scrolling for every
  descendant. See [`docs/office-window-manager.md`](../../office-window-manager.md).
- **The taskbar's leading cluster is the office; the composer band is two lanes.** Mail / Slop
  Chat / Meeting live in `DeskOsTaskbar` beside Stand up and the presence strip, arriving by
  **portal** through `deskSlotStore` — so the bar still owns no office state, and the anchor
  `#office-desk-bottom-slot` must exist exactly once (a second one silently steals the portal).
  The composer band's lanes each carry their own tool: notebook inside `.desk-work-order-group`,
  roster inside `.desk-talk-group`. Three traps, all invisible to jsdom and all found by driving
  a browser: **`.desk-actions` is a corner dock** (`position: fixed; top: 124px`) so any new
  placement needs a reset at `(0,2,0)` or the corner rules' `:not(.desk-actions--bottom)` wins
  `top` and drops it off-screen; **`.desk-work-order-group` is `flex-direction: column`**, so a
  second child stacks unless the lane is forced to `row`; and the flat-tool-row
  `.desk-chrome-tool { order: 1 }` **reverses a nested lane**, so lane order must be declared on
  every child. Below 640px the bar sheds Concentration + the HR chip (both have a second home),
  never the office half. See [`docs/office-window-manager.md`](../../office-window-manager.md) §11.
- **Which verb goes where is frequency, not category.** Most-runs verbs stay on the bottom
  composer band; few-times-a-session verbs go to the menu bar (`DeskOsMenuBar`), persistent status
  goes to the taskbar tray (`DeskOsTaskbar`). Don't add a sixth command surface. See
  [`docs/office-isometric-mode.md`](../../office-isometric-mode.md) §4b.
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
  `listVoices` before re-adding. See [`docs/office-narration-roadmap.md`](../../office-narration-roadmap.md).
- **A soft errand is defined by the timer it does not have.** `officeMomentStore.errand`
  (slice 26) is the office's one standing request — Linda's email grows a **Go and find Chad**
  CTA, pressing it stands you up carrying one, speaking to Chad on _either_ renderer settles it.
  Three things are load-bearing and each looks like an oversight. It has **no TTL, reminder or
  re-offer** — ADR-0010 consequence #4, and a quest that nags is the quietest way to break it.
  The email marker **raises nothing on arrival**; only the press does, so an errand you never
  read cannot exist. And it is deliberately **absent from `hasActiveOfficeSurface`**: that
  predicate gates the ambient director, and something with no expiry counted there would hold
  the whole office silent until you ran it. Its card is the **last** rung in `FloorCardSlot`
  and its line replaces only the **at-rest** narration, both for the same reason — it is the
  first durable entry in two orderings built for momentary ones, so ranking it higher
  suppresses every transient offer (and, in the live region, stops reporting that you are
  walking). `settleOfficeErrand` returns the errand rather than a boolean because the log needs
  `fromId`; it still awards nothing, so XP and the log keep one `onOfficeEvent` funnel.
- **Declining a set piece no longer cancels it, and pacing is what keeps that safe.** Slice 28:
  `declineOfficeCoffee` marks the break `declined` instead of nulling it, so the cast still
  walks to the machine and talks and the floor can offer a way in (`sceneJoinOfferFor` →
  `FloorSceneJoinCard`). The trap is `hasActiveOfficeSurface`, which counts `coffee`: a scene
  that survives declining is a **live surface nobody is watching**, so if it is not paced it
  never reaches `onDone`, never dismisses, and holds the ambient director silent for the rest
  of the session — the errand trap by another door. Hence `useOfficeLayerPerformances` runs on
  `accepted || declined`, and the **award** moved to the `accepted` test instead (a break you
  skipped is worth nothing; joining is what earns `coffeeBreak`). An unattended scene is
  **silent**, and the silence must be a wrapper returning `{spoken:false}` — never `undefined`,
  which makes `useScenePacing` flush the whole script in a tick. Joining **ends** the scene:
  `joinOfficeCoffee` swaps the remaining script for one canned beat and mints a **fresh `id`**,
  because pacing keys on `sceneId` and reusing it leaves `visibleLines` past the end of a
  one-line script. Unlike shop talk the offer has **no inner bound** — a scene's cast are
  `awayIds`, so `dwellTargetAt` cannot pick them and there is no collision to dodge. The
  cubicle battle is deliberately not converted (its verdict panel makes "ends it" ambiguous).
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
- **Saying something out loud has four answers, and the one that walks over is a `walkby`.**
  `talkOutLoud` used to have exactly one outcome — a reply card, every time — which is a chat
  window in a costume. `pickTalkAnswer` (`officeCadence.js`, beside the rest of the office's
  appetite) rolls **shout** / **walkover** / **ignored**; naming somebody never rolls (they are
  looking at you) and yields **turnedTo**. Two rules are easy to undo by accident. A walk-over must
  go through `pushOfficeWalkBy` rather than growing a renderer of its own: that is what buys both
  the desk head-over-shoulder and the floor colleague who **actually gets up and walks**, and its
  prompt already demands the line name something visible — which is the whole difference between
  coming over for a reason and saying something you could have said from your chair. And silence
  needs a **delay** (`TALK_SILENCE_DELAY_MIN_MS`) plus a self-clearing card: instant silence reads
  as a broken send button, and a silence you have to dismiss is paperwork about nobody answering.
  The user's line is recorded either way — you said it. Pin the roll by driving `random` at the
  weight bands, never by stubbing `pickTalkAnswer`; the weights _are_ the design, and the desk
  suites' `random: () => 0` seed must keep landing on an answer.
- **A talk reply is speech, and the wire has to say so or it comes back written like Slack.**
  `kind: 'im'` carries "Lowercase chat energy welcome" and reply mode opens "The user just sent you
  a chat message" — both false about somebody who said it out loud. `OFFICE_MOMENT_SITUATIONS`
  (shared) therefore splits: the **silent** ones (`dwell`, `run`) stand down for a `userMessage`,
  the **spoken** ones (`outLoud`, `turnedTo`, `walkover`) arrive _with_ one and **replace** the
  typed reply mode (`isSpokenMomentSituation` in `officePersonas.js`), swapping the body rule for
  `imSpoken`. `runWalk` is spoken **without** a `userMessage` — they walked over because a run
  landed, they did not answer a shout. Adding a spoken situation is a constant, a rule block, a
  reminder line _and_ the predicate — miss the predicate and the block is dead code that the typed
  rule silently outranks.
  Each block must state its **geometry** (how far away, who else heard), because that sets the
  length and register and it is the only thing the model cannot read off the words.
- **The office log records; it never triggers.** `officeLogStore.js` is what lets the cast say
  "since this morning's thing" (docs/office-parody.md §11 context contract). Writers hook the
  funnels that already exist — `onOfficeEvent` in `useRunCeremony.js`, the moment-store push
  mutators, the adopt handler in `OfficeLayerSlot.jsx` — so **don't add an observer to feed it**.
  Making it schedule or trigger anything would be `auto-fix-on-idle` in a new hat, which
  ADR-0010 consequence #4 rules out. Two rules its tests pin: DM bodies never enter the digest
  (email subjects do), and the log is **day-stamped** while Slop Chat scrollback is not.
  It ships as `officeLog` on every office LLM surface (`/moment`, `/meeting`, `/huddle`,
  `/meeting/interject`, `/advisor/suggest`) via `agents/_lib/officeLogPrompt.js` — which lives
  in `_lib/` because `officePersonas.js` and `advisorPrompts.js` are deliberately separate
  prompt systems. Pass `purpose: 'work'` for the advisor: its 80-char envelope cannot afford the
  dialogue rule, so it is told to use the log **only** to avoid re-proposing what was just done.
- **The log is read twice, and the second read is a projection, not a store.**
  `buildOfficeRelationship(entries, colleagueId)` (`officeLogDigest.js`, bound as
  `getOfficeRelationshipWith` in the store) answers "what have you and I been to each other
  today", which the shared digest structurally cannot: that one is capped at 12 lines / 700
  chars and drops from the front, so a colleague's own history scrolls off by mid-afternoon.
  Ships as `officeRelationship` on `/moment` **only** — the one surface with a single speaker —
  and covers only the four kinds carrying a `colleagueId` (`email`, `chat`, `walkby`, `pitch`).
  `battle` is excluded on purpose: its id is in `detail` and means _winner_.
- **Office continuity (working memory + runWalk) shipped in v1.** Colleagues feel
  real because the same person remembers you, not because they talk more. Spec:
  [`docs/office-continuity.md`](../../office-continuity.md) and
  [ADR-0013](../../decisions/0013-office-continuity.md). Working memory records and never
  triggers. The only new initiation is a completed run (`runWalk` on the floor, IM at the desk,
  existing run-reaction budget). Adding a situation is still a four-place contract: enum,
  predicate, rule block, reminder — never reuse `run` or `walkover` for this beat.
- **In a prompt rule, prohibitions crowd out a hedged permission — lead with the register.**
  Measured on the relationship block: three "do NOT"s against one "let this colour how you
  sound" auditioned **inert**, its arm indistinguishable from the control. The killer is a
  blanket escape hatch ("say nothing if nothing here earns it") — a model takes that branch
  every time, and the block is only built when there _is_ something, so the branch was never
  worth offering. Put the wanted behaviour first and in the imperative, keep one guard.
- **A meeting's roster and its speakers are two different lists.** `POST /api/office/meeting` takes
  `attendees` (scripted, bounded by `MEETING_MAX_ATTENDEES`) and an optional `audience` (present,
  silent — the all-hands crowd, §10.4). Do **not** raise `MEETING_MAX_ATTENDEES` to seat a crowd:
  it lets _every_ meeting seat one, and asks the model to give N people lines inside
  `MEETING_MAX_BEATS` (14). The audience is listed **by speakerId and forbidden one in the same
  breath** — `normalizeMeetingScript` drops beats from speakers outside `attendees`, so an audience
  member who "speaks" costs a beat and can push the script under `MEETING_MIN_BEATS`, which the
  client renders as a _cancelled_ meeting rather than a big one. Note `speakerLabel` returns the
  raw id for the whole team tier (their voices live in `STAKEHOLDER_MEETING_VOICES`, which stores
  strings, not `{name,title}`) — don't reach for it to pretty-print a roster.
- **The escalation rung is a wire contract duplicated verbatim (§10.10).** `MEETING_VENUES =
['workingGroup','steering','cab']` exists in BOTH `officePersonas.js` and `officeCast.js`; the
  server zod-defaults an omitted `venue` to `workingGroup` and 400s an unknown rung. Keep the two
  copies in lockstep or one side books a room the other can't script. Escalation is a scripted beat,
  never a picker: `escalationRosterFor` picks the roster, `nextMeetingVenue` picks the destination
  (a senior+facilitator room jumps straight to the CAB). A completed CAB hearing fires `cabApproved`
  (NOT `meetingSurvived`) — +40 XP and its own one-shot achievement.
- **`MOMENT_WEIGHTS` in `officeCadence.js` is a cumulative roll, so adding a kind moves every lane
  boundary.** Tests that pin a lane with a magic `random` value (`useOfficeAmbience.test.jsx`)
  will start asserting on the wrong surface — re-derive the value against the new total rather than
  hunting for a logic break.
- **The stand-up/sit-down transition is one fact in two places: the JS exit timer and the CSS exit
  fade.** `useFloorViewPhase` (`officeFloor/viewTransition.js`) keeps the floor mounted for the
  sit-down beat after the store flips; `OfficeFloor.css` owns the camera choreography on
  `data-view-phase`. `officeFloorViewTransition.test.js` pins the two durations to the same
  number — change one, change both. Never animate `main.app-shell` or the OS chrome to sell the
  transition: a transform/filter there re-anchors the fixed-position floor and every portaled
  window. The desk side is `.office-view-desk-veil` (backdrop-filter, one z-layer below the
  floor). Multi-line comma-terminated values in `OfficeFloor.css` are a separate trap — the
  sheet's reduced-motion scanner (`officeFloorStyles.test.js`) mis-parses them as selectors. See
  `docs/office-isometric-mode.md` § 1a.
- **A second live `FormsRenderer` breaks the `forms` slot unless you opt out of two things.**
  Linda's training window (`OfficeTrainingWindow.jsx`, §10.1) is the first non-slot forms surface
  and the template for any future one. Pass `exportable={false}` — the exporter registry in
  `viewportPngExport.js` is a `Map` keyed by content type and unregistering is identity-matched, so
  a second instance overwrites the slot's entry and then fails to restore it, leaving Export-PNG
  broken until the real renderer remounts. Do **not** pass `preview` — that is the read-only
  thinking-pane mirror and it early-returns out of the action handler, so the form renders
  perfectly and silently refuses to submit. The training document never reaches the `forms` slot
  (ADR-0010); `officeTraining.test.jsx` pins that by asserting no _import path_ exists, not merely
  that one flow avoided it. Server side, `/api/office/training` reuses `FORMS_CORE_RULES` rather
  than restating the A2UI contract, and `createOfficeChatModel` needs `purpose: 'training'` — a
  form document does not fit the 512/2048-token moment/meeting ceilings and truncates into a
  validation failure that reads like "the model cannot author A2UI".
- **`@archislop/shared` resolves to `dist`, so a new shared file is invisible until you build it.**
  Adding a new module under `packages/shared/src/` and importing it from `apps/web` yields
  `undefined` at runtime rather than a module error — the symptom is a constant that silently
  became `"undefined"`. Run `npm run build -w packages/shared` after adding or changing a shared
  export.
- **Set-piece markers on office email templates are fields, not text — mirror them per locale.**
  `training: <module>` and `phishing: true` (`officeCast.js` + all three `office.*.js` bundles) are
  what grow the CTA on an email. The slot-fill parity test only inspects strings, so a missing
  marker makes the set piece unreachable in that locale with nothing rendered to notice;
  `officeLocale.test.js` now pins the markers explicitly.
- **The office's LLM appetite is one table in `officeCadence.js`.** `OFFICE_LLM_MOMENT_CAP`,
  `EMAIL_LLM_RATIO`/`IM_LLM_RATIO`, `OFFICE_RUN_REACTION_LLM_CAP`, `OFFICE_DESK_LLM_CAP`,
  `OFFICE_TALK_LLM_CAP`, `OFFICE_DWELL_LLM_CAP` — `useDeskActions.js` and `useOfficeRunReactions.js` re-export from it
  rather than declaring their own, and `officeCadence.test.js` pins that identity. Tune there,
  not at the use site. The governing split is §11's: **ambient** (a timer interrupted you) stays
  canned-heavy; **reactive** (you started it or answered it) leans LLM, because a canned reply to
  a sentence you typed is the clearest possible tell that nobody is home.
- **`officeCadence.js` owns the office's other clock too — the wall clock.** `officeDayPhaseAt`
  - `OFFICE_DAY_PHASES` are the office day (mugs early, the remote stand-up, trait rows midday,
    papers at wind-down, cool→warm→dark light). The dial lives there and **not** on the floor,
    because an office day is ambient content on a timer; the floor owns only what a phase looks
    like (`PHASE_ART` in `officeFloorActivity.js`, `[data-day-phase]` in `OfficeFloor.css`). The
    hour is **rung 5** in `floorActivityFor` — above the trait row, below everything live — so
    anybody a moment is drawing (walk-by, set piece, commuter) deliberately gets no phase at all.
    One trap it found: a `headwear: null` **cannot take a headset off**, because `PersonaFace`
    resolves `accessoryOverride ?? traits.accessory` and only the literal `'none'` strips a baked
    trait — Dave's headset is his face, not his activity.
- **`officeCadence.js` now carries two wall clocks, and which one a fact belongs to is
  "does it change how the room looks, or where people go".** `OFFICE_DAY_PHASES` is the first
  (mugs, papers, light); `WANDER_BIAS_WINDOWS` / `wanderBiasAt` is the second (slice 24: from
  two until half four an errand is 3× likelier to be a coffee run). The slump is deliberately
  **not** a sixth phase — three in the afternoon _looks_ exactly like eleven in the morning, so
  promoting it would change the light at 2 pm and owe `officeFloorStyles.test.js` a sixth rule
  to buy a fact about walking. Both dials stay in the cadence; the floor still owns only what a
  phase looks like. The bias table's one row is also the design: `PHASE_ART` already puts a mug
  in every hand at nine and papers at five, so biasing traffic there would tell the same thing
  twice. **The wall clock (slice 25) is a third _face_ of the same clock, not a third clock**:
  `FloorWallClock` reads `officeWallClockAt` (cadence), the same instant the phase dial reads,
  so hands and light can never disagree. A clock that read its own `Date`, or polled on a
  one-second second-hand, would repaint the floor continuously against the
  "re-render only on change" budget — `OFFICE_WALL_CLOCK_POLL_MS` is a heartbeat, and the poll
  bails on a same-value set. Placement is `FLOOR_WALL_CLOCK` in `officeFloorPlan.js`, drawn via
  the plan module's `wallPoint` (the windows share it); the face is self-lit (reads on all five
  phase walls) and unanimated (owes the reduced-motion block nothing).
- **A sensor swept over a _filtered_ set only ever fails inside the filter.** The shop-talk
  bank check swept `WANDER_BIAS_WINDOWS`, so it asserted the cap only for props the clock
  favours — the printer and whiteboard sat under the floor for two slices, invisible to it by
  construction, and the test was green the whole time. The tell is a sweep whose set is
  narrower than the invariant: `OFFICE_SHOP_TALK_CAP` counts exchanges **per visit**, so it was
  never a fact about favoured props. Sweep the widest set the invariant actually covers
  (`usablePropKinds()` here), and if a subset deserves a stronger claim make that a **second**
  assertion rather than narrowing the first. Same family as the non-empty companion rule below:
  both are ways a passing test can be examining almost nothing.
- **A weighted random pick must consume the same number of `Math.random()` calls as the
  unweighted one it replaced.** Weight by repeating entries in a list and roll **once**; never
  roll a second time to decide whether the bias applies. This is the direct consequence of the
  PRNG-stream finding below — an unpinned floor suite shares one stream across a file, so
  changing the _count_ of randoms re-seeds who is wandering in every other test in that file.
  `officeFloorWander.test.jsx` pins the count in both the biased and unbiased arms.
- **The office day's light is a token palette on `[data-day-phase]`, and it must stay one rule
  per phase.** `--office-window-tint` / `--office-wall-ne` / `--office-wall-nw` /
  `--office-floor-plate` / `--office-surround-veil` all default on `.office-floor` to the
  literals `FloorRoom` shipped with, so an unphased mount (first-run `FloorArrival`) is
  unchanged. `officeFloorStyles.test.js` pins `dayRules.length === OFFICE_DAY_PHASES.length`, so
  a **new token goes into the five existing phase rules, never into a rule of its own**. Zone
  plates get no token on purpose — they are alpha washes and re-grade with the plate for free.
  The surround veil is a **background layer, not an overlay element**: a background paints
  behind the element's children, so it grades the backdrop and cannot tint the room, the cast or
  the chrome. None of it is transitioned, which is what keeps it out of the reduced-motion
  contract. **A blackout is the wrong reflex for `afterHours`** — you are standing in the room,
  and the 7 %-alpha grid plus dark-glyph/white-halo zone labels both need the light.
- **A floor test that _mounts_ inherits two globals it never named: the wall clock and
  `Math.random`.** The random half was found by slice 23 — `useFloorWander` sends somebody out on
  an unstubbed roll, so an unpinned suite shares one PRNG stream across the whole **file**, and any
  change anywhere that consumes a different number of randoms re-seeds who is wandering.
  `officeFloorDwell.test.jsx` went red on a test that **passed in isolation and failed in file
  order**, which is this class's signature; pin with `vi.spyOn(Math, 'random').mockReturnValue(0.75)`
  (the floor suites' seed) unless the suite is about the roll. **Since slice 24 the seed alone
  is not enough**: `wanderBiasAt` gave the clock a say in _where_ a seeded wanderer goes (3× the
  coffee machine from 14:00 to 16:30), so the two globals stopped being independent — and it
  shipped that way, leaving slice 23's join tests and two `officeFloorWander.test.jsx` describes
  red on `main` every afternoon and green the rest of the day. The signature is that the
  **coverage assertions still pass** (he is Chad, he is settled — just at the wrong prop), so it
  reads as a broken card rather than a clock. A mounting floor suite that asserts geometry needs
  **both** `vi.setSystemTime(new Date(2026, 7, 11, 12, 0, 0))` and the 0.75 seed. Neither failure mentions time or
  randomness — both read as a broken assertion about the feature under test.
- **Any floor test that _mounts_ rather than calling `floorActivityFor` directly is
  time-dependent.** The hour is rung 5, above the trait row, so a render test asserting what a
  character's own row gives them is silently wrong whenever `PHASE_ART` has an entry —
  `officeFloorActivity.test.jsx` was red for ~7.5 h a day (mugs in `earlyMorning`, empty hands
  in `standUp`) and survived because CI kept landing in the quiet window. Pin the clock with
  `vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] })` to a **midday** instant —
  one of the two phases with no `PHASE_ART` — and fake `Date` only, or the floor's poll timer
  and React's scheduling stop and nothing renders.
- **Why a colleague is speaking is a wire field, not an inference.** `situation` on
  `POST /api/office/moment` (`OFFICE_MOMENT_SITUATIONS` in shared: `dwell` | `run`) picks one
  rule block in `buildMomentSystemPrompt` and one terse restatement at the end of the user
  prompt. **Enum, never free text** — it shapes a system prompt, so a client picks from the set
  and cannot write into it. **Absent is the default** and keeps the cold-open "MUST SURPRISE"
  framing every ambient moment wants; **a reply beats a situation**, since the dwell block's
  premise is that nothing was said. Adding a third is a constant, a rule block and a reminder
  line. **A situation may state the circumstance, never a delta the prompt does not carry** —
  `run` used to end with "React to what changed" while the prompt ships only the current diagram,
  and the first audition measured the model inventing that change in **8 of 12** samples against a
  fixed diagram (**0 of 12** with no situation, so the field caused it). Naming the wrong change
  to somebody looking at their own work is worse than the non-sequitur the field exists to fix.
  See docs/office-parody.md §11.
- **Prompt changes are auditionable now, and a fixed fixture + a control arm is the whole
  method.** `api.deepseek.com` is reachable from the session proxy and `DEEPSEEK_API_KEY` is
  live, so an office prompt can be driven for real instead of reasoned about: replicate the
  route handler in a throwaway script (`buildMoment*Prompt` → `createOfficeChatModel` →
  `parseMomentReply`), hold the diagram **constant**, vary one field, sample ~4× per arm, read
  the arms side by side. The control arm is load-bearing — a failure rate means nothing without
  it. Check reachability before promising an audition (`curl -sS -o /dev/null -w "%{http_code}"
https://api.deepseek.com/` — 401 is reachable, 000 is blocked); never route around a block.
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
- **`useScenePacing` reveals every line at once when it has no narrator.** That is right for the
  coffee/battle cards and wrong for anything that lights one speaker at a time — pass a narrator
  wrapper that returns `{spoken:false}` instead of passing `undefined`.
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
- **A wanderer speaks only when _you_ caused it, and `goHome({ byYou })` is the whole gate.**
  Ambient floor traffic is silent by design (slice 11: a wanderer with something to say is a
  walk-by). Slice 18's "excuse me" is not an exception to that — it is §11's ambient/reactive
  split applied to a **tile you claimed**, so nothing can fire while you sit still. Don't give
  ambience a second reason to talk. Two facts the code leans on: `interrupted` and `carrying`
  are both read off `phase === 'dwell'`, so somebody can never apologise for a coffee they are
  visibly holding; and an interrupted trip **lingers** at the desk (`LINGER_MS`) before it
  clears, because the walk home is as short as 420 ms and a line nobody can read is a flash.
  Do not "simplify" `handleArrive` back to clearing on arrival. Copy is `floor.interrupt` in
  `officeCast.js` — all three locale bundles or it is a silently dead feature in that language
  (`officeLocale.test.js` pins the bank lengths and the `{prop}` count).
- **Standing next to somebody is the floor's one mechanic with a trigger of its own, and
  `channel: 'talk'` is what makes it safe.** Slice 19 fires a remark after five seconds within
  `NAME_CHIP_RANGE_TILES` — **reuse that constant**, never a second radius, or the person who
  speaks stops being the person whose name chip is lit. The line goes out through
  `desk.remarkTo` on `channel: 'talk'`, and that channel is load-bearing rather than cosmetic:
  `pushOfficeImPing` skips the desk arrival toast for talk lines and keeps them out of Slop
  Chat™ threads and unread counts, which is the only thing stopping one remark rendering as a
  balloon _and_ a notification. Send it as `'im'` and you get both. Two more facts: the
  `senior` exclusion is **the glass** (`tileDistance` is Chebyshev, so a legal tile is one step
  from three executives), not politeness; and holding the target in place is a **cycle** —
  the target needs `floorState`, which `useFloorAway` returns, and `holdId` is one of its
  arguments — so a passing colleague can finish their errand and leave mid-countdown, which is
  accepted rather than unfixed.
- **Speech is spoken, writing is read — and `imHistory` holds both, so the medium is one
  field.** Walk-bys, meetings, battles, coffee, huddles, desk/floor talk, dwell remarks and shop
  talk get a voice; **an email or a Slop Chat™ message never does** (you read those yourself).
  `isSpokenLine` (`officeImThreads.js`) is the only answer, the exact complement of
  `isSlopChatMessage`. The trap is the **default**: `pushOfficeImPing` omits `channel` entirely
  for `'im'`, so _written is unmarked_ and any reader that forgets the question treats writing as
  speech. That is not hypothetical — the floor's `lastInboundFrom` had no channel filter and so
  lifted a typed IM into a balloon over somebody's head and narrated it in their voice, worst
  after a reload, since `persistImHistory` keeps Slop Chat lines **only** and a restored session
  therefore offers nothing else. Pinned by `officeVoiceMedium.test.jsx`, including the companion
  claim that genuinely-spoken lines still speak — without it, a floor gone silent passes.
- **Text is the fallback channel, not the primary — but never delete it.** With narration on and
  CC off, `shouldShowSpokenText` suppresses the balloon for anything spoken, which is why § 6
  rules 29/32 (bubble overlap geometry) are **closed** and should not attract another capture.
  Captions remain the accessibility path and the TTS-failure path; "voice-first" orders the two
  channels, it does not remove one.
- **The cast may talk to each other, and _your position_ is the whole licence.** Slice 22 has a
  wanderer who settles at a prop trade two canned lines with whoever sits beside it — the first
  line in this office not addressed to you. It does not contradict "don't give ambience a second
  reason to talk" **only** because no exchange exists unless you are stood in earshot, so the
  room never chatters to itself in a corner you are not in. Delete that gate and it still looks
  right in every screenshot while becoming exactly the timer-driven chatter the program spent
  eight slices unwinding; `officeFloorContracts.test.js` pins it. Two rules ride along: an
  overheard line **may never ask for anything** (no Do-it, no thread, no unread count — the
  moment it does it is a walk-by, which belongs in the moment store), and it is **canned**, like
  the other two overheard performances (coffee, battles). Who replies is derived from the layout
  (`shopTalkPartnerFor` — nearest seat within `NAME_CHIP_RANGE_TILES` of the _mark_), which is
  why the copy bank is keyed by prop: the prop picks the voice.
- **Joining an overheard conversation is a walk, not a reply — and that is the only reason it is
  allowed to exist.** Slice 23's _Join in_ fires `startTalk` at a `talkTileFor` mark, which is
  what the person card's _Go and talk_ and a double-click already do; the offer carries two seat
  ids and a prop kind and **none of the exchange's text**. Put a line, a quote or an
  `actionPrompt` on it and the exchange has started addressing the user, which makes it a walk-by
  and moves it to the moment store (`officeFloorContracts.test.js` pins the payload). The
  composer opens **empty** on arrival — `handleTalkGreet` is still slice 8's deliberate silence,
  and joining must not become the exception that seeds an opener. Two facts worth reusing: the
  offer must **outlive** its exchange (`armed.done` rather than clearing, or an invitation dies
  seven seconds after it appears), and it is read off the **exchange** so an untranslated locale
  offers nothing rather than inviting you to join two people standing in silence.
- **A verb you pressed can hold somebody in place; a place you are standing cannot.** Joining
  gets `useFloorAway`'s hold for free — `startTalk` sets `activity.talk` immediately and that is
  `holdId`, so the wanderer's dwell clock stops while you cross the room. Slice 19's dwell wanted
  the identical hold and could not have it, because its target is derived from `floorState`, which
  is `useFloorAway`'s output, and `holdId` is its input. The difference is not effort, it is which
  side of that hook the signal starts on — check that before recording another "limitation".
- **`NAME_CHIP_RANGE_TILES` and `EARSHOT_RANGE_TILES` are two rungs of one ladder.** Inside the
  chip range somebody talks _to_ you (slice 19); between there and earshot (3) you overhear two
  others (slice 22); past it the room is quiet. Each rung is defined as **what the one inside it
  is not** — an exchange refuses to exist while you are within a tile of either speaker — and
  that is the only thing stopping a single approach producing a dwell remark _and_ a two-hander
  inside five seconds. The inner bound is measured **per speaker, not to the mark** (the replier
  sits a tile off it, so you can be two tiles from the whiteboard and shoulder to shoulder with
  Jared). Assert any new rung over **every standable tile**, not a sample: what breaks it is a
  layout change. Two traps in doing that — `isStandableTile` takes a **tile object**, not `(x,
y)`, so the obvious sweep silently iterates an empty list; and pacing the exchange through
  `useScenePacing` needs a narrator **wrapper** returning `{spoken:false}`, never `undefined`,
  or every line reveals at once and two balloons land in one square of screen.
- **A sweep over a derived set needs a companion assertion that the set is non-empty.** Slice 22
  shipped two probes that passed while examining nothing — the `isStandableTile` one above, and a
  DOM overlap scan keyed on a class that does not exist (`covers no heads` was true because it
  found no heads). Same family as the `vi.mock` paths that resolve nowhere: green for the wrong
  reason. Pair every loop with a coverage claim, and get one positive hit out of a DOM probe
  before trusting a negative.
- **The glass room is entered through a threshold, and its cast is bigger than its
  commuters.** Slice 27 walks meeting attendees to `MEETING_THRESHOLD_TILES` — a fan of eight
  tiles _outside_ the sealed room — and cuts them into their chairs on arrival; **no geometry
  changed**, `pathCrossesGlass` still refuses every route through the glass. Three facts are
  load-bearing. The **leadership tier can never walk**: they sit inside their own fishbowl, so
  no glass-free route to a threshold exists and they keep appearing in their chair — which is
  why `FloorMeeting` takes `walkingIds` and **not** the `settledIds` its siblings take. Absent-
  from-settled means "still walking" only when the whole cast commutes; here it deletes every
  executive from the meeting. The fan is as long as `MEETING_SEATS` because attendees set off
  together, and it is deliberately **out** of `reservedMarks()` for the reason `HUDDLE_TILES`
  is. And a mark may carry **`arriving`** to opt out of `useFloorCommute`'s first-pass seed:
  calling a physical meeting from your desk stands you up, so the floor mounts on a room that
  has not started, and seeding it teleports everybody into the chairs the slice exists to walk
  them into. An empty `transcript` is the test for "still convening".
- **A moment's cast walks to it and walks home; the desk stays empty for the whole trip.**
  `officeFloorCommute.js` is the pure `out ▸ there ▸ home ▸ gone` machine, `useFloorCommute` holds
  it, and `useFloorAway` merges the commuting ids into `awayIds` — miss that merge and a scene
  ends with people blinking back into their chairs while their own figures are still crossing the
  kitchen. `settledIds` is the hand-off: **exactly one** surface may draw a person (§ 6 rule 5), so
  `FloorScene` / `FloorHuddle` skip anybody who has not arrived, and `null` means "don't ask" for
  standalone mounts. Marks are indexed by the **renderer's** index, never a compacted one, or a
  walker pops to a different tile on arrival. The glass-room meeting is excluded on purpose — its
  chairs are inside sealed glass with no route in.
- **The office never re-renders while you type, and anything showing your work must be
  _sampled_.** `OfficeLayerSlot.jsx` hands `OfficeLayer` the diagram as **getters**
  (`getDiagramSource` / `getContentType`), not props — that is load-bearing, not an accident.
  Slice 16 puts your current slot on your monitor, the whiteboard and the glass-room table
  (`officeFloorBoard.js` → `board` on the floor bridge), and it refreshes on three **edges** via
  `useOfficeBoard`: a completed run (`runSignal`), standing up, a meeting opening. Do **not**
  "fix" it into a `diagramStore` subscription — that repaints sixteen animated figures, a walk
  animation and a directed camera on every keystroke. The constraint is also the better fiction:
  a whiteboard shows what was _drawn_ on it. Two reuse traps it found:
  `getAdvisorVisibleLabels`'s mermaid/infographic branches read the **rendered** SVG filtered by
  viewport intersection (meaningless once the floor covers the canvas), and
  `collectFlowchartParticipantInfo` anchors its definition regex to line start, so it counts
  nodes but cannot name the ones defined mid-line.
- **`officeChromeCopy()` swaps whole bundles, it does not merge** (`office()?.OFFICE_CHROME_COPY
?? OFFICE_CHROME_COPY`), so a key missing from a locale is a **silently dead feature**, not an
  English fallback. en-AU had shipped with no `floor.props.*.details` at all, which hid the
  **Look closer** button entirely in that locale for months. `officeLocale.test.js` now pins the
  prop copy; add a parity assertion there for any new chrome-copy branch a feature depends on.
  `UiLocaleProvider` must call `setActiveOfficeBundle` **during render** (not only in an
  effect) — otherwise a language switch re-renders with fresh `controls` while
  `officeChromeCopy()` still returns the previous language (NameTag "HELLO" stuck in English).
- **`getUiLocaleBundle` has the opposite failure mode — it merges too well, so "untranslated"
  is invisible.** Overrides deep-merge onto English (`deepMergeLocale`), so a key a translator
  never wrote renders in English forever and no key-shape check can see it; only comparing
  **values** finds it. Two corollaries, both of which had shipped: **arrays replace wholesale**,
  so a step added to English is silently missing from every older locale — `controls.prompt
.entryPointers` is what `useEntryDeskFlow` actually walks, so en-AU ran a five-step desk tour
  with no _Precision edits_ beat while EN and zh ran six; and **a dropped `{placeholder}` is
  silent**, because `formatLocale` simply has nothing to substitute (all three locales had lost
  `{userName}` from the welcome mail/IM). `uiLocale.test.js` now pins placeholder parity and
  `entryPointers` id parity for every locale. Related trap when translating: the office zh
  bundles are the **only** ones that had mixed half-width ASCII `,?!:;` with full-width CJK
  punctuation — keep new Chinese copy full-width after a CJK character.
- **The reception language picker is `IntroLocaleToggle` in its `intro` variant, and its labels
  are endonyms on purpose.** First run mounts `FloorArrival`, not `OfficeDirectory` — put the
  strip at the top of the **reception card** (above the name badge), not only on the card-tour
  welcome body. Somebody who cannot read the current UI cannot be asked to open a menu labelled
  in it. `LOCALE_ENDONYMS` lives in the component, never in a copy bundle, for the same reason.
  Reception must wait for **Check in** (no auto-advance): that is the name-badge edit window
  and the TTS cost guardrail. The desk **Language pack** menu keeps the `inline` variant.
- **A working-memory beat passes two validators, and the second one is the reason a memory bug can
  look like a caching bug.** `rememberWorkingMemoryBeat` normalises on the way in and
  `sanitizeWorkingMemoryBeat` in `officeAmbienceStorage.js` does it again on the way back off disk,
  and both end with "if nothing recognised survived, drop the beat". They used to build the object
  field by field, separately: teach one of them a field and the fact is real, queryable and
  prompt-visible until the user refreshes, at which point it silently is not — the worst shape a
  memory bug can have, because the reproduction step is "wait". Both now call one exported
  `normalizeWorkingMemoryBeat`, which is also what took each of them back under the complexity
  threshold the extra branch pushed them over. The vocabulary of any enum-shaped beat field lives
  beside it in the **storage** module (`OFFICE_WORKING_MEMORY_INTERRUPTIONS`); the sentence that
  vocabulary renders as lives beside `you said:` / `they said:` in `workingMemoryPromptLines`,
  because the beat carries the fact and that function owns every sentence in the prompt.
  `officeWorkingMemoryStore.test.js` asserts the reload, not just the write — a write-side-only
  test passes on a half-taught field.
- **The consequence of an interruption is a _fact_, not a trigger — and `hasWorkingMemoryFact` is
  where facts turn into behaviour.** Slice 18 could already ruin somebody's errand
  (`goHome({ byYou: true })`, a line, a 1800 ms linger) and nothing remembered it, so
  `useDeskActions.remarkTo`'s `cap: hasWorkingMemoryFact(id) ? OFFICE_DWELL_LLM_CAP : 0` stayed at
  zero for the one colleague with most reason to mention you. `useFloorInterruptMemory` writes the
  beat from `interruptSpeech`'s answer — the same value the balloon draws and the narrator speaks,
  so working memory can never quote a line nobody heard. Two things about that writer generalise.
  It is keyed on `seatId:leg` and **clears the latch when no interruption is in flight**, because a
  later trip by the same person restarts `leg` at 1 and a latch that never cleared swallows the
  second collision entirely; and `interrupted` survives into the `lingering` update that follows the
  turn for home, so a writer keyed on the trip _object_ files the same collision twice. Spend is
  unchanged in the worst case (`OFFICE_DWELL_LLM_CAP` is 3 per visit and no new counter was added);
  what changed is that the cap is now reachable at all.
- **After presence / TTS / desk-frame edits**, prefer `apps/web/test/officePresence.test.js`,
  `deskOsPresenceStrip.test.jsx`, `deskOsFrameStyles.test.js`, `apps/server/test/officeTts.test.js`,
  `officeRoute.test.js` (or `npm run test:affected`). **After isometric-floor edits**, `npm run
test:floor`; the floor test map is [`docs/agents/isometric-floor-tests.md`](../../agents/isometric-floor-tests.md).
