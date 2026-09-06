# Ledger: `office-life`

Durable memory for the office-life feature automation. Read the last three run rows and the
**Baselines** block before starting; they are what stop a cold-start run from re-deciding something
that was decided, or from believing a number it did not measure.

Playbook: [`../office-life.md`](../office-life.md). Contract: [`../README.md`](../README.md).
Domain findings (the rules a future agent would otherwise rediscover the hard way) go in
[`../../agents/domains/office.md`](../../agents/domains/office.md) — **not** here, and never in the
root `CLAUDE.md` / `AGENTS.md`.

## Locked

| Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-05 | Playbook and trigger created together on `0 13 * * *` UTC (21:00 HKT), one rung **ahead of** `metaphor3d`. It is there and not at the owner's suggested midnight because the ladder's gaps are sized from measured durations: `metaphor3d` runs 48–118 min from `0 15`, so a `0 16` start lands inside it, and `deps` fires at `30 16`.                                                                                                                                                                                                                    |
| 2026-09-05 | **"Canned" is not a defect on the provoked-free channels.** Overheard shop talk stays canned (the module header's own argument: a model improvising two colleagues talking about nothing writes a _scene_, and scenes are `FloorScene`'s job) and the ambient wanderer stays silent (slice 11). The live rule is `docs/office-parody.md` § 11: a line you provoked must be responsive; a timer that interrupted you may be canned. Disagreement is a ledger row with a reason, never a 21:00 rewrite.                                                      |
| 2026-09-05 | **The scripted visit is the acceptance instrument, not a nice-to-have.** No slice counts as done without a replayed trace that differs from last night's, plus a red→green test or a browser capture. The trace must name its mode (`llmConfigured` or canned-fallback): with no backend the office falls back to its banks and looks exactly like a worse office. The visit script is fixed — a run that edits the visit to move the numbers has measured nothing.                                                                                        |
| 2026-09-05 | **Ambient generation is permitted once, on a budget, and it is bounded mechanically**: one generated exchange per visit, cached, ahead of time; inside `officeCadence.js`'s existing caps and kill switches; respecting `hasActiveOfficeSurface()` and `shouldHoldAmbientOfficeMoments()`; and the PR body carries calls-per-session before → after. No new vendor, no runtime ElevenLabs, no baked-audio regeneration. A run that cannot produce the number is not permitted to add the call. (Owner's decision, 2026-09-05, when the rung was stood up.) |
| 2026-09-05 | **A `situation` states the circumstance, never a delta.** Measured in this domain: 8 of 12 turns fabricated a change to the diagram when the moment prompt ended "react to what changed", against 0 of 12 with no situation. Any prompt change is auditioned with a throwaway script, one fixed diagram, ~4 samples per arm and **a control arm**, then the script is deleted. Prohibitions crowd out a hedged permission; never offer the model a way to say nothing.                                                                                     |
| 2026-09-05 | **Never grow the office monoliths; register them instead.** `officeCast.js` 2790, `OfficeFloor.css` 1971, `OfficeLayer.jsx` 1791, `officeFloorPlan.js` 1065 — none of them appears in `ratchet.json`'s `monolithLoc` (nine tracked files, zero office), so nothing watches them and `improve`'s register-accuracy item never sees them. New copy goes in a module beside the bank. The register fix is `blocked-by-paths` below: budgets and `ratchet.json` are `improve`'s.                                                                               |
| 2026-09-05 | Experiment, not standing duty: nightly until **2026-09-26** (~21 firings), then this ledger answers whether it improved the app and the owner decides whether the rung continues. Stop rule: by the 14th firing, no merged product PR or no movement in the visit trace → write `experiment-inconclusive`, stop taking slices, and let `digest` watchdog 1 report it. Deleting or disabling the routine is the owner's (page bar #2; `claude -p '/schedule'` cannot delete).                                                                               |

**Trigger**: `trig_01XBthD1GSYCJJdwQLV2WVt9` — "Feature automation: office-life",
`claude-opus-5`, cron `0 13 * * *` UTC, environment `env_015KGMf1S9omDAMDfwGgMqUt` (GCP Deployment),
`mcp_connections: []`, `persist_session: false` (every firing is a cold start with a fresh checkout,
which is why this ledger is the only memory it has). Created 2026-09-05 15:47Z; first fire was the
manual one at 15:52Z (`cse_01UUUWxEbVkZyEUgAXzE88rw`), per the contract's "fire it once by hand and
read the whole run". **The `branchPrefix` pin is not a run's to make**: playbook front-matter belongs
to `improve` (`BUDGET_OWNERS`, ADR-0017), so a firing records the branch it actually used in its own
run row and the front-matter moves in an owner's or `improve`'s commit. Until then `--preflight`
enforcement rides on the title prefix (`office life:`), which is why `prTitlePrefix` is declared and
why this rung's PRs must open with it.

## Baselines

Re-measure these, do not quote them. A row that repeats a baseline instead of measuring it has
told the next run something false.

| Metric                                                    | 2026-09-05                                                                                               | Notes                                                                                                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/utils/officeCast.js` LOC                    | 2790                                                                                                     | Unregistered on the ratchet. Contains every canned bank **and** `OFFICE_CHROME_COPY` (~940 of those lines).                                        |
| `apps/web/src/components/OfficeFloor.css` LOC             | 1971                                                                                                     | Unregistered.                                                                                                                                      |
| `apps/web/src/components/OfficeLayer.jsx` LOC             | 1791                                                                                                     | Unregistered.                                                                                                                                      |
| `apps/web/src/utils/officeFloorPlan.js` LOC               | 1065                                                                                                     | Unregistered. Also the home of both proximity constants.                                                                                           |
| Canned dialogue entries (`id:`-bearing, English defaults) | ~124                                                                                                     | 28 emails, 9 senior, 24 IM, 13 IM replies, 8 email replies, 11 walk-by fallbacks, 19 coffee, 11 battle. `pickUnseenTemplate` depletes per session. |
| Overheard (`floor.shopTalk`)                              | 14 pairs / 28 lines                                                                                      | coffeeMachine 6, printer 4, whiteboard 4. Canned by decision.                                                                                      |
| `ISOMETRIC_FLOOR_BLAST_TESTS` suites                      | 40                                                                                                       | `scripts/test-affected-lib.mjs`. **Not** the same set as `npm run test:floor`.                                                                     |
| `lintWarnings.apps/web` ratchet budget                    | 836                                                                                                      | Measured over budget before this rung existed; do not attribute a new warning to the office without `git blame`.                                   |
| LLM caps (`officeCadence.js`)                             | moment 5 / session 10 / talk 12 / dwell 3 / run-reaction 3 / desk 4 / training 2 / shop-talk 4 per visit | Ambient `coffee` and `battle` are zero-LLM by design.                                                                                              |
| Proximity ladder                                          | chip 1 tile / earshot 3 tiles                                                                            | Rungs are mutually exclusive by construction.                                                                                                      |

Two measured inner loops, so a run can promise a fast one (2026-09-05, local):

- `npm run test:floor` — **37 files / 572 cases / 23.0 s.** Geometry and behaviour only.
- The office content ladder — `npx vitest run test/officeLocale test/officeVoiceMedium
test/officeCadence test/officeMoment test/officeLog test/officeImThreads
test/officeWorkingMemory test/officeWireContract test/uiLocale test/deskOs
test/officeComponents test/castTiers test/officeErrand --root apps/web` — **19 files / 348 cases /
  10.3 s.** This is the loop that pins canned-vs-generated and spoken-vs-written, and `test:floor`
  pins none of it.

## Run log

Append one row per firing, including quiet runs. The first row is expected to be queue item 0 —
the harness and its baseline trace, with no product file in the diff.

| Date       | Slice                                   | Visit trace (mode · what changed)                                                                                                                                                                                                                          | Tests before → after                                                                                                                               | PR  | Notes                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-05 | Queue 0 — `visit-harness`, and baseline | **5 traces, 2 modes.** `generated` (`POST /api/office/moment` 200, `deepseek-v4-flash`, 1360 in / 44–58 out) and `no-llm-calls` (zero LLM-bearing office calls). All 7 steps `ok` in every run. JSON below the table — **re-measure it, do not quote it**. | `test:floor` 37 files / 572 cases, blast bundle 44 / 609, shared `office` 376, server `office` 57 — green before and after. `npm run check` green. | —   | Branch `office-life/visit-harness`. **No product file in the diff**, as queue item 0 requires: the deliverable is the instrument. Harness at `apps/web/test/officeVisitTrace.mjs`, **not** `scripts/` — see `visit-harness-home` below. Two findings out of the first baseline, both recorded, neither fixed tonight: `floor-talk-channel-tag` (filed as #552) and `dwell-then-nothing` (needs samples). |

| 2026-09-06 | Queue 2 — `interruption-leaves-a-mark` | **3 runs, one arm: `no-llm-calls` / `llmConfigured: false`.** 7/7 steps `ok`, 11 speech lines, `bySource.model: 0`, `pageErrors: []`, roomDelta identical to 2026-09-05. **The trace did not move, and it cannot see this slice** — see `visit-cannot-see-afterwards` below. JSON under the table. | New: 6 (4 in `officeWorkingMemoryStore.test.js`, 2 in `officeFloorWander.test.jsx`), all four/two **red before the fix and green after** (stash-and-rerun, both directions recorded). `test:floor` 37/575, blast bundle 44/612, content ladder 19/352, shared `office` 379, server `office` 57, `npm run precommit` 270 files / 3107 cases. | — | Branch `office-life/interruption-leaves-a-mark`. Backlog was empty first (#552, this rung's own filing, was closed by `resolve` at 01:21Z). Spend: no new counter, no new call site — `OFFICE_DWELL_LLM_CAP` (3/visit) simply becomes reachable for somebody you walked into. Two instrument findings recorded below; neither fixed tonight (one slice per run). |

### 2026-09-06 trace

Three runs of the fixed visit, one machine, `DEEPSEEK_API_KEY` present in the shell but
`mode.llmConfigured: false` in every run — so this is the **`no-llm-calls` arm** and may only be
read against 2026-09-05's runs 4–5, never against its runs 1–3.

```json
{
  "runs": 3,
  "mode": { "llmConfigured": false, "verdict": "no-llm-calls", "apiCallsTotal": 1 },
  "visit": "7/7 steps ok in every run",
  "speech": {
    "count": 11,
    "byChannel": { "narration": 9, "dwell": 2 },
    "bySource": { "model": 0, "bank": 11 }
  },
  "movement": {
    "firstMover": "office-floor-player (3.5-8.4 s)",
    "wanderer": "first step at 10.7-15.7 s",
    "Chad": "77-79 position changes"
  },
  "roomDelta": {
    "surfaces": "+office-floor-player, +office-floor-talk-card",
    "seatsVacated": ["you"],
    "changed": {}
  },
  "pageErrors": []
}
```

**Nothing here moved, and the honest reading is that the instrument is blind to the axis this slice
is on** rather than that the slice did nothing. The chain is interrupt → beat → `hasWorkingMemoryFact`
→ dwell asks the model; the fixed visit steps into the **wanderer's** path and then loiters beside the
**named colleague**, who are never the same person, so the beat is written and then never consulted.
What the trace does confirm, three times out of three, is the diagnosis: the dwell line came from the
bank with zero `/api/office/moment` calls, which is `cap: 0` — the gate this slice opens.

### 2026-09-05 baseline trace

Five runs of the fixed visit, one machine, one hour, with `DEEPSEEK_API_KEY` set and `apps/server`
built and running on `:4199`. **`mode` decides whether any other field may be compared with another
night's** — a canned-fallback trace and a generated one are not comparable, and the same visit
landed on both.

```json
{
  "runs": 5,
  "durationMs": "35.6k (--no-llm) · 41.3k–45.1k (server up)",
  "mode": {
    "--no-llm": "canned-fallback — /api/office/{speak,moment} both 502 through the vite proxy",
    "server up, runs 1-3": "generated — POST /api/office/moment 200 in 1458-1845 ms",
    "server up, runs 4-5": "no-llm-calls — zero LLM-bearing office calls made at all"
  },
  "visit": "7/7 steps ok in every run",
  "speech": {
    "count": "8-11 lines",
    "byChannel": { "narration": "7-9", "dwell": "0 or 2", "other": "0 or 1" },
    "bySource": { "model": 0, "bank": "8-11" },
    "modelTurns": "runs 1-3: one turn, 1360 in / 44-58 out, deepseek-v4-flash. runs 4-5: none."
  },
  "movement": {
    "firstMover": "office-floor-player (3.4-4.2 s)",
    "wanderer": "first step at 10.6-11.3 s",
    "Chad": "77-81 position changes — the walker",
    "everyone else": "6-7 changes, longest still 13.5 s"
  },
  "roomDelta": {
    "surfaces": "+office-floor-player, +office-floor-talk-card",
    "seatsVacated": ["you"],
    "viewPhase/dayPhase": "unchanged"
  },
  "pageErrors": []
}
```

**Read `bySource.model: 0` beside `modelTurns`, never alone.** They disagree on purpose: on runs 1–3
the model produced a real, in-character, provoked answer and **no surface in the room drew it**, so
the DOM-side counter is right about what a visitor saw and wrong about what the office did. An
instrument keeping only one of them would have made the opposite claim depending on which.

## Todos

| Id                             | State                | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `visit-harness`                | **done** 2026-09-05  | Queue item 0. Landed as `apps/web/test/officeVisitTrace.mjs` — one file, one JSON object, seven fixed steps, scratch harness page written under `apps/web/` and deleted on the way out. Needs `playwright-core` installed **outside** the repo (`OFFICE_VISIT_PLAYWRIGHT=…`), because a new dependency is an issue first per the shelf contract, and an explicit `executablePath` for Chromium.                                                                                                                                                                                                                                              |
| `visit-harness-home`           | **done** 2026-09-05  | Resolved by `improve`: pointed § 2's prose at `apps/web/test/office*` (the file's actual, already-reachable home) rather than widening `allowedPaths` to `scripts/` — no file move needed, the harness was already inside `office-life`'s budget. See `improve`'s 2026-09-05 run-log row.                                                                                                                                                                                                                                                                                                                                                    |
| `dwell-then-nothing`           | pending              | From the first baseline: on the two runs where the dwell remark fired, the visit made **zero** LLM-bearing office calls and the sentence typed into the floor composer sat in `imHistory` with no reply; on the three where the dwell did not fire, the same sentence got a model answer in ~1.5 s. Two samples either side of a harness change that also grew the visit ~8 s, so it is an observation, not a cause. ≥3 samples per arm **and a control** before touching `officeCadence.js`.                                                                                                                                                |
| `floor-talk-channel-tag`       | **filed** #552       | `OfficeLayer.handleTalkReply` calls `pushOfficeImReply({ colleagueId, body })` with no `channel`; the default `'im'` is then omitted from the stored message, `isSpokenLine` is exactly `msg.channel === 'talk'`, so `latestTalkLine` is null and `FloorTalk` draws nothing. Measured: Gilfoyle's generated 58-token reply reached `imHistory` and no surface in the room showed it, while the dwell remark — which does tag `'talk'` — lifted a bubble in the same visit. Product change; not queue item 0's to make.                                                                                                                       |
| `ratchet-office-monoliths`     | **blocked-by-paths** | `officeCast.js` (2790), `OfficeFloor.css` (1971), `OfficeLayer.jsx` (1791) and `officeFloorPlan.js` (1065) are absent from `ratchet.json`'s `monolithLoc`, so `improve`'s register-accuracy item never measures them and the four largest office files in the repo are unbounded. `ratchet.json` and every budget are `improve`'s. This row is the ask; do not widen it from a run.                                                                                                                                                                                                                                                          |
| `officefloor-suite-blast-wall` | **blocked-by-paths** | `scripts/test-affected.test.mjs` reverse-sweeps `apps/web/test/` for `/^officeFloor.*\.test\.(js                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | jsx)$/`and **fails`npm test`** on any match absent from `ISOMETRIC_FLOOR_BLAST_TESTS`, so a new `officeFloor*`suite cannot be landed by this rung at all — the script is`improve`'s. Two separate asks: (1) `useOfficeDayPhase`is in`test:floor`but not the bundle, and`officeErrand`/`personaFaces`/`useFloorArrivalFocus`/`useFloorAway`are in the bundle but not`test:floor`— the two sets should agree on what "the floor is green" means; (2)`docs/agents/isometric-floor-tests.md` (33/33 since #529) stays in sync whichever way it settles. |
| `interruption-leaves-a-mark`   | **done** 2026-09-06  | Queue 2. `useFloorInterruptMemory.js` writes a beat from `interruptSpeech`'s own answer (so memory cannot quote a line nobody heard); the beat carries an enum reaction and `workingMemoryPromptLines` owns the sentence. `hasWorkingMemoryFact` now returns true for somebody you have never spoken to, which is what opens `remarkTo`'s `cap`. Still record-only — nothing schedules.                                                                                                                                                                                                                                                      |
| `visit-cannot-see-afterwards`  | pending              | **The acceptance instrument cannot observe queue 2, 4 or 7's consequence, so "the trace moved" is unmeetable for the whole afterwards axis.** The visit steps into the _wanderer's_ path and loiters beside the _named colleague_ — never the same person — and the trace reports no store state at all, so a beat written at step 3 is invisible at step 4 and absent from `roomDelta`. Deliberately **not** fixed alongside the slice: editing the harness in the same PR as the feature it would measure is the shape § 2 warns about. A later run adds the observation to the report (not to the seven steps) and re-measures both arms. |
| `visit-double-counts-dwell`    | pending              | Instrument bug, pre-existing, changes the reading of the 2026-09-05 row. `speech.lines` records the dwell remark **twice** at an identical `atMs` — once from the container (`"Gary · Facilities & Fridge CzarMotion lights…"`, the speaker name concatenated into the text) and once from its child. So the baseline's `dwell: 0 or 2` is **one line, counted twice**, and `speech.count` is inflated whenever a dwell fires. Fix the scrape to one node per line before any row compares dwell counts.                                                                                                                                     |
| `visit-llm-not-configured`     | pending              | Three runs on 2026-09-06 reported `mode.llmConfigured: false` with `DEEPSEEK_API_KEY` set in the launching shell and the server spawned with `{ ...process.env }`. Either the flag is read from something the harness does not forward or the server resolves the backend differently under `NODE_ENV=development`. Until it is known, this rung cannot produce a `generated` arm on demand — which is the arm every question-3 slice needs.                                                                                                                                                                                                 |
| `shop-talk-replier-not-prop`   | pending              | Queue 3, from `docs/office-isometric-mode.md` § 8's open debts. At the whiteboard `dinesh (7,4)` and `jared (8,5)` are both one tile from the mark, so seat order — not character — decides who answers, and an engineer's-voice reply lands on Jared whenever Dinesh walked over. Named fixes: key the bank on the replier, or exclude the second-nearest seat. Its neighbour (a third participant unreachable by construction) is the same function; the bystander-withdraws-the-join-offer item is parked **until measured** — the visit harness is the measurement.                                                                      |
| `their-own-work-in-context`    | pending              | Queue 4. `officeDeskWork.js` holds a `look` and a `doing` per cast member and is shown on peek but **fed to no prompt**; `docs/office-parody.md` § 11 names "their own work" as its own open context hole. Wire it into the dwell/talk paths' existing `/moment` context, respecting the field caps on both sides. Never by letting the cast initiate a run.                                                                                                                                                                                                                                                                                 |
| `per-persona-wander-habit`     | pending              | Queue 5. One global `WANDER_BIAS_WINDOWS` row today. Pure module, seeded PRNG, no browser needed. **Not** by adding a day phase.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `props-that-do-something`      | pending              | Queue 6. Printer and whiteboard have copy but no verb (only coffee does, by ADR-0011 rule 3); the whiteboard reads the user's diagram and never writes back. Compose through `floorActivityFor`; no diagram-store subscription in the floor.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `provoked-lines-not-recited`   | pending              | Queue 7, one channel per slice: dwell deck → `pickTalkAnswer`'s `ignored` → walk-by fallbacks → IM replies. Where the channel is already LLM-first, the finding is usually a missing fact rather than a missing call — that is `interruption-leaves-a-mark` or `their-own-work-in-context`.                                                                                                                                                                                                                                                                                                                                                  |
| `room-tone-from-occupancy`     | pending              | Queue 8. `officeRoomTone.js` / `officeSoundscape.js` tick on 5 s clocks and never ask who is in the room.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `batched-ambient-exchange`     | pending              | Queue 9, the owner-approved spend exception. Needs the calls-per-session number and the caps in `officeCadence.js`, never a new counter.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `two-walkers-collision`        | pending              | Queue 10. Slice 11 answered this as needing collision rules that do not exist. Issue with the model in it first; never an impulse slice.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `alive-while-seated`           | pending              | `docs/office-isometric-mode.md` § 8: `OfficeFloor` renders nothing in desk mode — "almost certainly correct, but a choice nobody made explicitly". Do not pick this up without reading ADR-0011 rule 1 first (one state, two renderers); the desk already has the moment surfaces, and a second way to see the room is how they diverge.                                                                                                                                                                                                                                                                                                     |
| `app-css-chrome`               | **blocked-by-paths** | `apps/web/src/App.css` holds the desk chrome budget (`--desk-taskbar-h`, pinned by `deskOsFrameStyles.test.js`) and is deliberately outside this playbook, so a chrome slice that needs it stops and records. It is a shared file three other rungs reach.                                                                                                                                                                                                                                                                                                                                                                                   |
| `office-dead-code-pair`        | pending              | Two unfixed `review` observations from 2026-08-21 that were never filed as issues, both inside this playbook: `officeLogStore.js` and `officeWorkingMemoryStore.js` duplicate the `loadedDay` + `reconcileOfficeDay()` day-reconcile shape (candidate: `officeAmbienceStorage.js`), and `officeAmbienceStorage.js`'s `dayStampOf` is a dead one-line wrapper with five unrenamed call sites. Small, provable, and the kind of slice a night with no Chromium is for.                                                                                                                                                                         |

## Open observations

- **What the map looked like at the start** (2026-09-05, so a later run can tell whether the room
  changed rather than whether its own memory did): reactivity is broad but shallow — a tile click
  walks you, a settled figure opens a person card, a double-click walks you over to talk, stepping
  into somebody sends them home, six seconds beside them may earn a remark, three props have copy
  and one has a verb, a completed run can get up and walk over (`runWalk`). Everything else in the
  room is a clock: ambient moments, wander, shop talk's _content_, soundscape, day phase, the wall
  clock, welcome timings, every TTL. That asymmetry — many verbs in, few consequences out — is what
  the afterwards question is actually pointing at.
- Three memories already exist (`officeLogStore.js`, `officeWorkingMemoryStore.js`, the relationship
  digest) with a strict _record, never trigger_ rule between them and the floor. The interesting
  slices are all consumers of facts that are already being written, not new producers of facts. Check
  which side of the store a signal starts on before recording another limitation — that is how
  slice 19's dwell got mis-filed as a constraint for a while.
- **One visit is a smoke test, not a measurement.** Five runs of the identical fixed visit, on one
  machine within one hour, split 3/2 between `generated` and `no-llm-calls`. That is the
  `benchAnythingGeneration` lesson (`--samples 3` or more; two single-sample runs of the same 12
  cases measured 66.7% and 91.7%) arriving in this domain on night one. A future row that reports a
  single trace and calls a number moved has not measured anything — run the visit at least three
  times per arm, and say how many.
- **Two steps of the fixed visit are load-bearing in a way § 2's prose does not say, and both were
  silent no-ops until this run fixed them.** "Stand beside them for six seconds" cannot produce a
  dwell line while the talk card is open, because `useFloorDwell` is gated on `active` and a card
  open is a _reason_ to be stood there — the step has to leave the conversation first or it measures
  nothing while reporting `ok`. And "step into their path" clicked at ~5 s found no walker at all:
  ambient traffic starts when the room decides to, measured at 10.6–11.3 s, so the step waits for
  one. Neither is the visit being edited to move a number; both are the difference between a step
  that performs and a step that reports `ok` for doing nothing. **This is the failure mode to look
  for in every later step added here**: a green step is not evidence until you have seen it go red.
- The 2026-09-05 15:52Z manual first fire (PR #549) left **no run-log row** — this row is the first.
  Contract rule 6 asks for one every firing, including runs that change nothing, and a rung whose
  memory has a hole in it is exactly what a cold-start run cannot detect.
- **A slice can be real and still not move the trace, and saying so is the row's job.** 2026-09-06
  is the first instance: six red→green tests, one of them through the real floor wiring, against a
  trace identical to the night before on every axis it records. The temptation was to add a
  working-memory field to the harness's report in the same PR — which is not editing the seven fixed
  steps, and is still exactly what § 2's warning looks like from the outside. Splitting it costs one
  night and keeps the instrument's next reading trustworthy. The general form: **when the instrument
  cannot see the slice, fix the instrument in its own run, and never in the run that needs the
  number.**
- The floor's known ESLint complexity offenders are recorded in `docs/office-isometric-mode.md` § 8,
  which also warns the figures had themselves drifted and one was backwards. Re-measure before
  quoting them, and remember most floor complexity points are **default parameters** (`= null`
  counts as a branch), so extracting is the fix and rewording conditions usually is not.
