---
name: office-life
tier: code-writing
schedule: '0 13 * * *'
maxFiles: 12
maxIssues: 1
prTitlePrefix:
  - 'office life:'
branchPrefix:
  - office-life/
  - claude/office-life
allowedPaths:
  - docs/automations/ledger/office-life.md
  - docs/agents/domains/office.md
  - docs/agents/isometric-floor-tests.md
  - docs/office-parody.md
  - docs/office-continuity.md
  - docs/office-isometric-mode.md
  - docs/office-narration-roadmap.md
  - docs/office-window-manager.md
  - apps/web/src/components/officeFloor/**
  - apps/web/src/components/OfficeFloor.jsx
  - apps/web/src/components/OfficeFloor.css
  - apps/web/src/components/Office*.jsx
  - apps/web/src/components/DeskOs*.jsx
  - apps/web/src/components/personaFaces/**
  - apps/web/src/features/shell/OfficeLayerSlot.jsx
  - apps/web/src/hooks/useOffice*.js
  - apps/web/src/hooks/useDesk*.js
  - apps/web/src/hooks/useScene*.js
  - apps/web/src/state/office*
  - apps/web/src/utils/office*
  - apps/web/src/i18n/locales/office.*
  - apps/web/test/office*
  - apps/web/test/deskOs*
  - apps/web/test/personaFaces*
  - apps/web/test/useFloor*
  - apps/web/test/useOffice*
  - apps/web/test/useDesk*
  - apps/web/test/uiLocale.test.js
  - apps/server/src/routes/office.js
  - apps/server/src/agents/office*
  - apps/server/src/agents/_lib/officeLogPrompt.js
  - apps/server/test/office*
  - packages/shared/src/officeScript.ts
  - packages/shared/test/office*
forbiddenPaths:
  - apps/web/src/assets/**
  - apps/server/src/mcp/apps/**
  - apps/server/bench-results/**
---

# Feature automation: `office-life`

**Read [`docs/automations/README.md`](README.md) first — it carries the rules this playbook assumes.**

Incrementally makes the **isometric office feel like a place rather than a player**: participants
that remember what you did to them, behave differently from each other, start things for a reason
they can show, and answer you in a line that was not written in advance. One slice per run, then
stop. Opens a PR and merges it when CI is green.

`0 13 * * *` UTC (**21:00 HKT**) opens the night ladder, one rung ahead of `metaphor3d` (`0 15`) —
see [`docs/routines/review.md`](../routines/review.md) for the table. It sits there rather than at
midnight because the ladder's gaps are sized from measured durations, not a flat stagger:
`metaphor3d` measures 48–118 min, so a 16:00 UTC start would land inside its run and 30 min ahead
of `deps` (`30 4,16`). Two hours of clear deck, and the PR still lands seven hours before `review`
reads the night's work at `0 20`.

## The brief, as three questions

The founding ask was "make the app, and in particular the isometric office, feel more like a real
office you want to be in — interactive, fun, helpful, with very little canned lines, participants
that react to your actions and have a life of their own". Read as prose, that is a mood. Read as a
queue, it is three questions, and **a run takes the highest one it can answer with a change you can
demonstrate**:

1. **Afterwards.** If I do something to a person — click them, walk into them, stand beside them,
   hand them a sentence — do they behave differently _later_, and differently from each other?
2. **Because of me.** Did anything in the room happen because of something I did, rather than
   because a clock reached a number?
3. **Provoked, not recited.** Is there a line addressed _to me_ — a reply, a remark, a greeting —
   that arrived already written?

A slice is **done** when last night's scripted visit (§ 2) replays and records a different outcome,
**and** a test that went red before it went green, or a browser capture, proves the change is real.
A PR that only adds copy is not an answer to any of the three; it is a PR that makes the room bigger
without making it more alive.

### Where that leaves the canned banks, and why it is narrower than the ask

Two decisions in this domain are **closed by argument, and this automation does not reopen them
by reading the word "canned" as a defect**:

- **Overheard chatter stays canned.** [`apps/web/src/utils/officeFloorShopTalk.js`](../apps/web/src/utils/officeFloorShopTalk.js)
  says so in its own header, and it is a real argument: a model asked to improvise two colleagues
  talking about nothing writes a _scene_, and a scene is what `FloorScene` is for. Its 14 pairs
  (28 lines) are not debt.
- **A wanderer stays silent.** Slice 11's rule — _"a wanderer with something to say is a walk-by,
  and that lives in the moment store"_ — and one walker at a time, because a second needs collision
  rules that do not exist (queue 10 is where that changes, and it changes by an issue first).

What is fair game is exactly what the repo's own rule already names
([`docs/office-parody.md`](../office-parody.md) § 11): **a timer interrupted you → canned is
honest; you started it or answered it → a canned reply is the clearest possible tell that nobody is
home.** So the target of question 3 is the provoked channels — the dwell deck that fires when a
colleague has no memory of you, `pickTalkAnswer`'s `ignored`, `OFFICE_WALKBY_FALLBACKS`, the IM
reply bank — not the overheard ones. If you disagree with a closed decision, that goes in a ledger
row with a reason. It does not go in a rewrite at 21:00 on a Tuesday.

## 1. Preamble — run every night, before picking a slice

```bash
npm run test:floor                              # the floor's own 8 filter patterns
npx vitest run test/officeFloor test/officeErrand test/personaFaces \
  test/useFloor test/officeLayer --root apps/web   # the blast bundle's coverage (40 suites)
```

`npm run test:floor` and `ISOMETRIC_FLOOR_BLAST_TESTS` in `scripts/test-affected-lib.mjs` are **not
the same set** — the bundle adds `officeErrand`, `personaFaces`, `useFloorArrivalFocus` and
`useFloorAway`; `test:floor` adds `useOfficeDayPhase`. Run both. A green `test:floor` does not mean
the errand still settles.

**Neither of them runs the office's copy, cadence or voice rules**, which is most of what this brief
is about. `test:floor` is a geometry-and-behaviour set: it does not contain `officeLocale`,
`officeVoiceMedium`, `officeCadence`, `officeMomentStore`, `officeLogStore`, `officeImThreads`,
`officeWorkingMemoryStore`, `officeWireContract`, `deskOs*` or `uiLocale`. Run that ladder too:

```bash
npx vitest run test/officeLocale test/officeVoiceMedium test/officeCadence test/officeMoment \
  test/officeLog test/officeImThreads test/officeWorkingMemory test/officeWireContract \
  test/uiLocale test/deskOs test/officeComponents test/castTiers test/officeErrand \
  --root apps/web
```

Measured 2026-09-05: **19 files / 348 cases / 10.3 s** (`test:floor` is 37 files / 572 cases /
23.0 s). Three of those nineteen are the ones this playbook's rules actually depend on:
`officeLocale` catches a key added to English and missing from zh-CN — a feature that silently does
not exist in that language; `officeVoiceMedium` catches the floor reading a typed IM aloud;
`officeCadence` catches a cap declared at the use site instead of in the appetite table.

Then the two seams the trap checklist exists for:

```bash
npm run test -w packages/shared -- office       # the wire enums and the script schema
npm run test -w apps/server -- office           # routes: 400 on an invented enum, 503 with no backend
```

If the slice touches `packages/shared/src/officeScript.ts`, build it first —
`npm run build -w packages/shared`. The workspace resolves to `dist`, so an unbuilt change reads as
`undefined` at runtime and produces errors in `apps/server` that look like someone else's breakage.

Until queue item 0 lands, that is the whole preamble. After it lands, item 0's harness runs too, and
its trace is the first thing in the ledger row.

## 2. The instrument — how "is it improving?" gets answered instead of asserted

This shelf's productive rungs all have a number they re-measure nightly (`benchMetaphor.js`,
`benchAnything.js`). The office's number is a **scripted visit**, and it is item 0 because until it
exists the acceptance rule above is unmeetable.

One file under `scripts/`, driven by `playwright-core` against the preinstalled Chromium — the
idiom already recorded in `apps/web/.claude/skills/verify/SKILL.md`. That skill's floor section is
not optional reading; five of its traps make a working feature look broken or a broken one look
fine, and the harness will meet all five:

- import `components/OfficeFloor.css` yourself — `ArchiSlop.jsx` is its only importer, and the tell
  is **geometry, not blankness** (props measure at `y ≈ 2000` in an 844 px viewport);
- seek animations to their **end**, not 0 — `office-floor-cover` is `both`-filled from `opacity: 0`,
  so seeking to 0 renders the whole room invisible while every DOM measurement stays healthy;
- **never diff two frames across a remount** — `OfficeFloor` re-randomises walkers and idle phases
  each mount; a sit→stand A/B once reported 235/255 for a band worth 18/255;
- one store call per `page.evaluate` — `standUp()` then `sitDown()` in a single block never enters
  `sit-down` at all, because both land in one React tick;
- **always assert you actually moved**, reading the player's transform before and after — a walker is
  a zero-size anchor (so wait with `state: 'attached'`), a tile clicked by scaling a `transform`
  against the roam element's rect lands ~430 px away, and the room's response to an illegal tile is
  _silence_, which reads exactly like the feature failing to clear.

Pin `Math.random` to `0.75` in an init script so a capture and a test are talking about the same
trip, and shoot small art at `deviceScaleFactor: 4`.

It performs a fixed visit — enter the floor, walk to a named colleague, step into their
path, stand beside them for six seconds, use the printer, open the whiteboard, say one sentence in
the composer — and prints one JSON object:

- who spoke, on which channel (`talk` / `im` / `email` / `narration`), and whether the line came from
  a bank or from the model;
- how long each figure stayed where it was, and who moved first;
- what the room looked like at the end that did not look like that at the start;
- **the mode it ran in.**

That last field is the whole point of the instrument. With no LLM backend the office falls back to
its banks and looks exactly like a worse office — a `503` and a regression are identical from the
outside, which is the generation bench's `transport` trap wearing a different hat. So: report
`llmConfigured` on every row, and never compare a canned-fallback trace with a generated one.

**The JSON goes in the ledger row. The harness's scratch output, its harness HTML and any throwaway
page never reach the PR** — they count against `maxFiles` if they do, which is the intended stop.
The visit script is fixed. A run that edits the _visit_ to make the _numbers_ better has measured
nothing, and the diff will show it did.

## 3. Queue

Take **one** slice. Read the last three ledger rows first and do not take the same area twice
running — this automation's failure mode will not be idleness, it will be polishing the desk you
already like.

### 0. Build the visit harness, and record its baseline trace

Nothing else in this file is verifiable until this exists. Budget the whole run; the deliverable is
the harness plus one baseline row, and a change to no product file at all.

### 1. The backlog, first

```bash
gh issue list --state open --json number,title,labels
```

Anything naming the floor, the desk, the cast, an office route, or a `floor.*` locale key is this
automation's work tonight, ahead of everything below. In the cloud sandbox `gh` has no token — use
the GitHub MCP tool for listing issues (shelf rule 8).

**As stood up, that queue was empty**: no open issue named an office file (the last one, #529 on the
floor test map, merged 2026-09-04), and `docs/office-isometric-mode.md` § 8 carries a _debt list_ the
repo has already written down and priced. So read those two things in order — open office issues,
then the § 8 debts — and **file rarely**: this shelf is capped at one filing a run and the backlog is
what `resolve` sweeps at one a night. A gap that is already documented in § 8 does not need an issue
number to be worked; it needs a PR.

### 2. An interruption leaves a mark

`apps/web/src/utils/officeFloorInterrupt.js` lets you stand in somebody's way: they turn for home
with `goHome({ byYou })`, apologise with a line from `floor.interrupt`, and linger 1800 ms so you
can read it. Then **nothing records it.** `officeWorkingMemoryStore.js` holds no fact about it, so
`useFloorDwell.js` — which asks the model only when the colleague has memory of you, and otherwise
deals from the canned deck — almost never fires, and the person who just lost their coffee to your
elbow has forgotten you by the time you reach them. A colleague who forgets being run over has no
life; they have a script with a pause in it. This is the cheapest answer to question 1 in the file,
and it stays on the record side of _record, never trigger_ (ADR-0010): the mark changes how the next
exchange goes, it does not schedule one.

### 3. The whiteboard joke is told by whoever wins a tie-break

`officeFloorShopTalk.js` nominates an overheard partner by nearest eligible seat — and at the
whiteboard, `dinesh (7,4)` and `jared (8,5)` are **both exactly one tile from the mark**, so
`FLOOR_SEATS` order is the only reason Dinesh ever answers. The pair's reply is written in an
engineer's voice, and it becomes **Jared's** line whenever Dinesh is the one who walked over. Jared
is on the wander roster, so that is a reachable state, not a theoretical one: the room puts words in
a mouth that the words don't fit, and it does so on the channel where nobody is watching closely
enough to ask. This is a canned line mismatched to a person, which makes it question 3's cheapest
instance, and § 8 already names both honest fixes — key the bank on the **replier**, or exclude the
second-nearest seat. Do the one that keeps the pair's voice coherent; do not widen the radius.

The same file records two neighbours of this defect, so you can decide whether you are fixing one
thing or three: a **third participant is unreachable by construction** (only the nearest seat is
nominated, and slice 23 sharpened it — _you_ can now join and Jared still can't), and a bystander's
dwell remark **withdraws the join offer**, because every listening tile on this floor is within one
tile of somebody. The second one is explicitly parked until someone measures how often it happens;
the visit harness (§ 2) is what would measure it.

### 4. Colleagues have work, and never mention it

`apps/web/src/utils/officeDeskWork.js` is a row per cast member — a `look` and one of five `doing`
values (`typing`, `phone`, `headset`, `papers`, `mug`) — and it is shown when you peek at somebody's
screen. **It is fed to no prompt.** `docs/office-parody.md` § 11 states its own remaining hole in
plain words: _"Still open: deliverable context (last-run summary), and 'their own work'."_ That is
the biggest unfilled "life of their own" gap the doctrine already names, and it is the one that costs
nothing in new call sites: a colleague who is on the phone asks you something different than one
with a stack of papers, and a remark that carries their own fiction is the difference between an NPC
and a person with a job. Wire `doing` into the context the dwell and talk paths already send —
`/moment` already takes `officeWorkingMemory` and `officeRelationship` — and watch the field caps on
both sides (§ 4) while you do it.

**Not** by giving the cast a run to initiate. One producer, many commentators: the cast pitches, it
never proposes or runs (ADR-0010, `office-parody.md` § 11), and a validated _proposal_ stays
contractor-only.

### 5. A habit per colleague

`apps/web/src/utils/officeFloorWander.js` is 83 lines and reads one global
`WANDER_BIAS_WINDOWS` row — 14:00–16:30, coffeeMachine ×3, every persona alike. Give each colleague
their own bias so the printer belongs to somebody at 14:00 and the window seat is always the same
person's. It is a pure module with a seeded PRNG and an every-tile test already (`officeFloorPlan`,
`officeFloorWander.test.jsx`), so it is measurable without a browser — which is the right shape for
a night when Chromium is unavailable.

**Not** by adding a day phase. `docs/agents/domains/office.md` is emphatic that the three faces of
one instant (day phase, wander bias, wall clock) must not become four to express an hour-shaped fact
about movement.

### 6. The two props that do nothing when you use them

`apps/web/src/utils/officeFloorProps.js` gives all three props a `name`, `note`, `useLabel`, `line`,
`blocked` and four `details` — and `useFloorPropUse.js` grants a verb to exactly one of them, the
coffee machine, because ADR-0011 rule 3 makes that the honest case. The whiteboard already _reads_
your diagram (`officeFloorBoard.js` → `useOfficeBoard.js`) and gives nothing back; the printer is
pure scenery in a room whose whole parody is paperwork. Making one of them **helpful** — a note you
leave on the board that the next meeting inherits, a page that comes out of the printer carrying
something you actually made — is the one slice here that answers "interactive **and helpful**"
rather than only "interactive". It must compose through `floorActivityFor` (ADR-0011) and it must
not add a floor subscription to the diagram store (§ 4).

### 7. A provoked line that arrived prewritten

Question 3, on the provoked channels only: the dwell fallback deck, `pickTalkAnswer`'s
`ignored: 'Nobody looks up.'`, `OFFICE_WALKBY_FALLBACKS` (11), `OFFICE_IM_REPLY_TEMPLATES` (13),
`OFFICE_EMAIL_REPLY_TEMPLATES` (8). About 124 id-bearing dialogue entries live in
`apps/web/src/utils/officeCast.js`, and `pickUnseenTemplate` depletes them per session. Where a
provoked channel is already LLM-first (`walkby` is always the model; desk talk carries
`OFFICE_TALK_LLM_CAP = 12`, the largest number in `officeCadence.js`), the fix is usually not
another call — it is noticing that the call was skipped because it had no fact to speak from, which
is queue 2 or queue 4 again.

### 8. Room tone that listens to the room

`officeRoomTone.js` and `officeSoundscape.js` tick every 5 s against gap tables and never ask who is
standing in the room. Six people at 10:30 and two at 19:00 sound the same. Occupancy is already
derived and already cheap to read; what is missing is a consumer.

### 9. Ambient that is generated, within a budget the owner signed

The office's appetite table (`apps/web/src/utils/officeCadence.js`) is deliberately canned-heavy for
ambient moments — `coffee` and `battle` are baked theatre, 19 and 11 scenes, zero model calls. The
brief asks for a room that feels alive even when you are not touching it, and the owner has allowed
**one** ambient exception: a generated exchange may be produced **ahead of time, once per visit,
and cached** — never per line, never per tick, never per frame.

The hard edges of that permission, all of them mechanical, none of them taste:

- Ride the existing caps and the existing kill switch. New spend goes in `officeCadence.js` beside
  `OFFICE_LLM_MOMENT_CAP` (5) and `OFFICE_SESSION_MOMENT_CAP` (10), not in a new counter nobody
  reads, and it must respect `hasActiveOfficeSurface()` / `shouldHoldAmbientOfficeMoments()` — the
  two predicates that already hold everything ambient while the user is typing or has a surface
  open. Ambient that ignores those is the auto-fix-on-idle failure in a new hat.
- **The PR body carries a calls-per-session number, before → after.** That number is the whole
  contract with the owner's wallet; a run that cannot produce it is not permitted to add a call.
- No new paid vendor, no new dependency, no ElevenLabs at runtime (it is build-time only, and never
  in a route, CI run or deploy script), and no regeneration of baked audio —
  `scripts/generate-office-audio.sh` with no asset name costs 900 credits and rewrites every
  committed `.mp3`, which is on the don't-touch list twice over.

### 10. Two walkers at once

The floor is sparse and slice 11 already answered this: one walker, because a second needs collision
rules that do not exist. Do not "start with two and see" — file the issue with the collision model
in it, or take a ledger row. This is a design, not a constant.

## 4. Rules this domain already paid for

[`docs/agents/domains/office.md`](../agents/domains/office.md) is the domain's own findings file —
read its Short form before touching a scene, and append to it rather than rediscovering. What follows
is the subset that has burned runs before, including the ones that stayed green while doing it.

- **A new `situation` is a four-place contract.** `packages/shared/src/officeScript.ts`'s
  `OFFICE_MOMENT_SITUATIONS` enum → `isSpokenMomentSituation` → `MOMENT_SITUATION_RULES` →
  `buildMomentSituationReminder` in `apps/server/src/agents/officePersonas.js`. Miss the predicate
  and your rule block is dead code the typed path silently outranks. `situation` is an **enum, never
  free text** — the route 400s prose, and a client writing sentences into a system prompt is an
  injection surface. Field caps must match on both sides (`officeLogDigest.js` 12 / relationship 3 /
  working memory 6 vs the zod restate in `apps/server/src/routes/office.js`); a client that drifts
  becomes a 400 the user experiences as "the office went quiet".
- **A situation may state the circumstance, never a delta the prompt does not carry.** Measured:
  **8 of 12** turns fabricated a change to the diagram when the moment ended "react to what changed",
  against **0 of 12** with no situation at all. The method that found it is the method for any prompt
  change here: a throwaway script replicating the route handler, one fixed diagram, ~4 samples per
  arm, **a control arm** — a failure rate means nothing without one — and the script deleted before
  commit. `api.deepseek.com` reachable check: `curl -sS -o /dev/null -w "%{http_code}"` → 401 means
  reachable, 000 means blocked. Never route around a block; report it and take a canned-free slice.
- **Prohibitions crowd out a hedged permission.** Three "do NOT"s against one "let this colour how
  you sound" auditioned _inert_. Lead with the register in the imperative, keep one guard, and never
  offer an escape hatch ("say nothing if nothing earns it") — the model takes that branch every time.
- **Locale copy does not fall back, and the UI side merges too well.** `officeChromeCopy()` swaps
  whole bundles, so a key missing from `apps/web/src/i18n/locales/office.zh-CN.js` is a feature that
  does not exist in that language, silently. Add the key to all three bundles **and** a parity
  assertion to `apps/web/test/officeLocale.test.js`; sweep the per-prop bank over
  `usablePropKinds()`, not over `WANDER_BIAS_WINDOWS` (narrowing that sweep hid two props for two
  slices). `apps/web/test/uiLocale.test.js` pins `{placeholder}` parity and array-id parity — array
  entries **replace wholesale** across locales, so a step added to English is absent everywhere else.
- **The floor must not re-render while you type.** `OfficeLayerSlot.jsx` hands the diagram over as
  getters on purpose. Anything that reflects the user's work is _sampled_ on an edge. A new
  `diagramStore` subscription in a floor component repaints sixteen animated figures per keystroke.
- **ADR-0010: record, never trigger.** The office log, working memory and the errand all _record_.
  The moment one of them schedules or fires something, it is auto-fix-on-idle in a new hat. The
  soft errand is defined by the timer it does not have, and is absent from `hasActiveOfficeSurface()`
  deliberately — do not "fix" either.
- **ADR-0011: `floorActivityFor` is the only composer of floor activity.** Six components draw
  figures; a second composition point is the finding that started this rule.
- **Voice leads, text is the fallback.** `shouldShowSpokenText` hides the balloon when TTS speaks;
  emails and Slop Chat™ messages are never voiced (`isSpokenLine`, not an inline check); captions
  stay because they are the accessibility path and the TTS-failure path. **Never delete captions or
  optimise bubbles to make the room feel less scripted** — that is § 6 of
  `docs/office-isometric-mode.md`, closed.
- **Proximity is one ladder, not two radii.** `NAME_CHIP_RANGE_TILES` (1) is _they talk to you_;
  `EARSHOT_RANGE_TILES` (3) is _you overhear two others_; an overheard exchange refuses to exist
  inside a tile of either speaker. Define any new rung as what the one inside it is not, and assert
  it over **every standable tile** — a layout change, not a logic change, is what breaks it.
- **A test that loops over a derived set needs a companion non-empty assertion**, and an
  `act`-block pair: `rerender(...)` and `advanceTimersByTimeAsync(...)` in one block advances the
  clock before the timer exists. Two slice-22 probes came back green while examining nothing.
- **Three office files are large and unregistered, and growing them is not this run's call.**
  Measured: `officeCast.js` 2790, `OfficeFloor.css` 1971, `OfficeLayer.jsx` 1791,
  `officeFloorPlan.js` 1065. None is on `docs/agents/ratchet.json`'s `monolithLoc` (nine files, not
  one of them the office) — the register gap the ledger records as `blocked-by-paths` for `improve`,
  which owns every budget on both shelves. New copy goes in a new module beside the bank, not into
  the bank; a slice that cannot avoid `OfficeLayer.jsx` takes the extraction instead, and if the
  extraction is bigger than `maxFiles`, the ledger gets the row.
- **A new `officeFloor*`-named suite is a wall, not a budget.** `scripts/test-affected.test.mjs`
  reverse-sweeps `apps/web/test/` against `/^officeFloor.*\.test\.(js|jsx)$/` and fails **`npm test`**
  on any match missing from `ISOMETRIC_FLOOR_BLAST_TESTS` — that guard exists because ten floor suites
  sat unselected until #473 found them. The script is `improve`'s and outside this playbook's paths,
  so: **extend an existing office suite**, which is nearly always the right shape here anyway. A
  genuinely new file is fine when it is not a floor-geometry suite — `test:affected`'s basename
  mirror selects a new content suite on its own once a module of the same basename exists — but a new
  `officeFloor*` file cannot go green without
  `improve`, and rule 3 deletes a red branch rather than landing it. Record the ask as
  `blocked-by-paths` naming the file, and keep
  [`docs/agents/isometric-floor-tests.md`](../agents/isometric-floor-tests.md) (33/33 since #529) in
  sync with whichever way it settles.

- **Answered already — do not re-derive these.** `docs/office-isometric-mode.md` § 8 keeps a list of
  questions the floor has settled with reasoning, and each one looks like an obvious improvement from
  a cold start: **one walker at a time** (a second needs collision rules that do not exist);
  **ambient movement is never narrated** (slice 11); **only a settled figure is clickable**, so
  "reachable" and "clickable" are one question, not two; **the camera is directed, not controlled**
  (slice 14); **no sixth command surface** (verb placement is frequency, not category); **a fifth
  usable prop needs a reason beyond "it is there"** — the water cooler, fridge and server rack are
  unreachable on purpose, and moving one is a furniture change wearing a copy change's clothes, which
  must be re-validated against § 6 rule 11. And one that will specifically tempt this rung:
  **topic hotspots read off the diagram were built and removed on trial** — they ate the talk card.
  If you are about to re-add something in that list, the finding you owe the ledger is what changed
  since it was taken out, not a better implementation of it.

## 5. What this automation owns, and what it borrows

- **Owned**: the office and its chrome — the floor, the desk, the voices, the parody OS frame, the
  cast and its banks, the three locale bundles, `/api/office/*`, the `officeScript.ts` contract, the
  office suites, and `docs/agents/domains/office.md` for findings.
- **Borrowed, on request**: every budget (`improve` only — `maxFiles` and `allowedPaths` are not
  yours to edit, and the guard refuses the diff anyway); the ratchet register;
  `scripts/test-affected-lib.mjs`; `DiagramCanvas.jsx` and anything diagram-side (that is
  `canvas-graph-edit`'s and the renderers'); baked audio; `package-lock.json`.
- **Not anyone's**: slot content, ever. ADR-0010 reserves a diagram document for the human's own
  pipeline, and a run unattended at 21:00 is precisely the thing that must not write one. The
  harness drives the office with a fixture, not a user's diagram.
- The diagram **slots** belong to the other three feature automations. This one's subject is the
  room the diagram sits in. If a slice looks like it needs a renderer, it needs a ledger row and a
  different rung's queue.

## 6. The experiment, and how it ends

The owner's condition for standing this up was a few weeks of nightly runs and a look at what the app
did. So the run log **is** the verdict, and it has a date:

- **2026-09-26** — three weeks, ~21 firings. Read the ledger's rows and answer, in one paragraph
  posted as a ledger row rather than an issue: how many PRs merged, what the visit trace's numbers
  moved to, whether a provoked line still arrives prewritten, and what this rung costs.
- **Stop rule**: if by the 14th firing there is no merged product PR to its name, or the visit trace
  has not moved on any axis, write `experiment-inconclusive` in the run log and **stop taking
  slices** — one a night on the harness and the ledger only, until the owner decides. A rung that
  keeps spending while proving nothing is the thing `digest`'s watchdog 1 exists to notice, and
  noticing it is cheaper than being surprised by it.
- Deleting or disabling the routine is the owner's, not a run's (`claude -p '/schedule'` cannot
  delete anything, and that is page bar #2 anyway).

## Verification

```bash
npm run routine:guard -- --preflight office-life     # BEFORE starting
npm run test:floor
npm run precommit
npm run check
npm run routine:guard -- --postflight office-life    # BEFORE pushing
```

Before applying `ready-for-agent` to anything you file, ask the guard whether any agent can reach
the file (`routine:guard -- --reachable <path>`) — the sweep test refuses a `scripts/` path owned by
nobody, and this playbook's globs are all verified against the live tree on purpose. Every issue body
opened here starts with the line `filed-by: office-life`, takes `maxIssues: 1` seriously, and labels
a feature-shaped finding `enhancement` — `resolve` refuses design questions on sight, and
`ready-for-agent` on one is a label no scheduler will ever honour.

A visual or behavioural claim about the floor is proven by **rendering it** and putting the capture
in the PR body, the same way `metaphor3d` must: the standing viewports, what was measured, before and
after. A claim that the office feels more alive with no trace and no test behind it is exactly what
`review`'s Spec axis catches the following night, and it will.
