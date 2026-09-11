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

| 2026-09-06 | Queue 2 — `interruption-leaves-a-mark` | **3 runs, one arm: `no-llm-calls` / `llmConfigured: false`.** 7/7 steps `ok`, 11 speech lines, `bySource.model: 0`, `pageErrors: []`, roomDelta identical to 2026-09-05. **The trace did not move, and it cannot see this slice** — see `visit-cannot-see-afterwards` below. JSON under the table. | New: 6 (4 in `officeWorkingMemoryStore.test.js`, 2 in `officeFloorWander.test.jsx`), all four/two **red before the fix and green after** (stash-and-rerun, both directions recorded). `test:floor` 37/575, blast bundle 44/612, content ladder 19/352, shared `office` 379, server `office` 57, `npm run precommit` 270 files / 3107 cases. | #582 | Branch `office-life/interruption-leaves-a-mark`. Backlog was empty first (#552, this rung's own filing, was closed by `resolve` at 01:21Z). Spend: no new counter, no new call site — `OFFICE_DWELL_LLM_CAP` (3/visit) simply becomes reachable for somebody you walked into. Two instrument findings recorded below; neither fixed tonight (one slice per run). |

| 2026-09-07 | Queue 0 (continued) — `instrument-tells-the-truth` | **3 runs before, 3 after, one arm (`no-llm-calls`, `llmConfigured: false`) — and the trace moved on every axis this slice touches.** `speech.count` 11 / 9 / 11 → **10 / 10 / 10**; `byChannel.dwell` 2 → **1** on each run the dwell fired; a new `afterwards` block reports working memory, `workingMemoryPromptLines` and the log digest; `mode.askedTheModel` / `answeredByModel` sit beside `llmConfigured`. JSON under the table. | No suite touched: the harness is a `.mjs` and not a vitest file. Proof is the six real-browser runs. Preamble green before and after — `test:floor` 37/575, blast bundle 44/612, content ladder 19/352, shared `office` 380, server `office` 57; `npm run precommit` 270 files / 3119 cases; `npm run check` exit 0. | #595 | Branch `office-life/instrument-tells-the-truth`. Backlog checked first and empty of office work (#547 apps/web complexity, #536 metaphor3d, #452 digest log). **No product file in the diff.** Taken ahead of queue 3 because two of the three defects it fixes make the acceptance rule unmeetable, and the ledger's own rule says to fix the instrument in its own run. Three findings recorded below; none fixed tonight. |

| 2026-09-08 | Queue 2 (verification) — `interrupt-step-writes-no-beat` | **3 runs before, 3 after, one arm (`no-llm-calls`, `llmConfigured: false`) — and the axis that had never moved, moved.** `afterwards.workingMemory` gains an `intern` row with `interrupted: "gotIt"` in **3 of 3** runs against **0 of 3** before; `speech.count` 10 / 9 / 10 → **11 / 11 / 11**, the new line on a channel the trace had no name for until tonight (`interrupt`). Step 3's note goes from "clicked the wanderer's own tile" to "clicked the wanderer's own tile (at their mark); interrupted: gotIt". JSON under the table. | No suite touched: the harness is a `.mjs`, not a vitest file, and the product change is a corrected comment. Proof is the six real-browser runs. Preamble green before and after — `test:floor` 37/575, blast bundle 44/612, content ladder 19/352, shared `office` 380, server `office` 57; `npm run check` exit 0. | #608 | Branch `office-life/interrupt-step-writes-no-beat`. Backlog checked first and empty of office work (#547 apps/web complexity, #536 metaphor3d, #452 digest log). **The verdict on the 2026-09-07 finding is: the instrument, not the product.** #582 works in a real browser and always did; the visit was clicking the wrong tile. Diff is the harness, one corrected comment in `useFloorWander.js`, this ledger and the domain file. |

| 2026-09-09 | Queue 3 — `shop-talk-replier-not-prop` | **3 runs before, 3 after, one arm (`no-llm-calls`, `llmConfigured: false`) — six traces identical on every axis, and that is the expected reading.** 7/7 steps `ok`, `speech.count` 11 (`narration` 9 / `interrupt` 1 / `dwell` 1), `bySource.model` 0, `afterwards.workingMemory` `dinesh` + `intern:gotIt`, `pageErrors: []` in all six. **The instrument can label a `shopTalk` line** (`channelOf` maps `office-floor-shop-talk-line`) and never saw one, before or after: the fixed visit never stands in the overhearing ring while a wanderer dwells. The number that did move is a pure-module sweep — see the PR body. JSON under the table. | New: 2 (`officeFloorShopTalk.test.jsx`), both **red before the fix and green after** (stash-and-rerun, both directions recorded: `expected 'jared' to be null`, and `whiteboard's bank is written for one voice and is answered by 2`). `test:floor` 37/575, blast bundle 44/612, content ladder 19/352, shared `office` 380, server `office` 57. `npm run check` green. | #619 | Branch `office-life/shop-talk-replier-not-prop`. Backlog checked first and empty of office work (#614 anything, #547 apps/web complexity, #536 metaphor3d, #452 digest log). Of § 8's two named fixes the run took **exclude the second-nearest seat** over **key the bank on the replier**, because the second needs a new bank in four locales to buy what the first buys by construction — recorded as a decision, not a preference. No new copy, no locale key, no cap touched. |

### 2026-09-09 trace

Three runs before the change and three after, one machine, inside one hour, no `DEEPSEEK_API_KEY`
in the shell. **All six are the `no-llm-calls` arm** (`askedTheModel: 0`; the two
`/api/office/speak` calls are Cloud TTS, return 502 with no credentials, and are excluded by
construction) and may only be read against each other and against 2026-09-06/07/08's runs. Note the
wall clock: **82–87 s per run here against 43–45 s on 2026-09-08's machine**, so `durationMs` is a
property of the host and not of the office.

```json
{
  "runs": "3 before, 3 after",
  "mode": {
    "llmConfigured": false,
    "verdict": "no-llm-calls",
    "askedTheModel": 0,
    "answeredByModel": 0
  },
  "visit": "7/7 steps ok in every run, before and after",
  "speech": {
    "count": { "before": [11, 11, 11], "after": [11, 11, 11] },
    "byChannel": { "narration": 9, "interrupt": 1, "dwell": 1 },
    "bySource": { "model": 0, "bank": 11 },
    "shopTalk": "0 of 6 — the channel the slice is on never fired"
  },
  "afterwards": {
    "workingMemory": {
      "before": ["dinesh (dwell)", "intern (interrupted: gotIt)"],
      "after": ["dinesh (dwell)", "intern (interrupted: gotIt)"]
    }
  },
  "pageErrors": [],
  "durationMs": { "before": [82526, 82496, 82231], "after": [86717, 82519, 82209] }
}
```

**The trace could not see this slice, and unlike 2026-09-06 that is not a hole in the instrument.**
That night the report was blind to an axis it should have carried (working memory), and the fix was
to add an observation. This time `channelOf` already has a `shopTalk` row, so the instrument is
_able_ to report the thing — the visit simply never enters the state, because overhearing needs a
wanderer settled at a prop while you stand two to three tiles off it with nothing else speaking, and
the seven fixed steps put you at a prop mark or in a conversation the whole time. **Adding an eighth
step is not available** (§ 2: the visit is fixed), so the honest measurement for this slice is a
different instrument, and the run used one: a sweep of all 33 wanderer×prop combinations the floor
can produce.

| Sweep (`wanderingSeatIds()` × `usablePropKinds()`, 11 × 3) | before    | after   |
| ---------------------------------------------------------- | --------- | ------- |
| combinations that produce an exchange                      | 32 / 33   | 31 / 33 |
| exchanges whose reply is not the prop's resident           | 1         | 0       |
| distinct repliers per prop (coffee / printer / whiteboard) | 1/1/**2** | 1/1/1   |

**Three readings worth keeping.**

- **The cost is one combination and it is the right one to lose.** The lost case is `dinesh`
  wandering to the whiteboard he sits beside — the visitor and the resident are the same person, so
  the conversation the bank describes has nobody in it. Silence there is the truthful answer rather
  than a gap, and the room already gave it at the printer.
- **The printer was correct by accident, and that is the transferable finding.** `helpdesk` is the
  only seat within a tile of that mark, so the roster walk ran out instead of reaching a second
  candidate — identical behaviour, arrived at by luck of the layout. When one place on a floor
  behaves differently from its siblings, check whether the siblings are _correct_ or merely
  _lucky_ before copying either.
- **A sweep is not a licence to skip the trace.** The six runs bought a regression check the sweep
  cannot give — `pageErrors: []`, 7/7 steps, the interrupt beat still written — on a change to a
  module three floor components read. They are worth the twenty minutes even when the headline
  number lives somewhere else.

| 2026-09-10 | Queue 4 — `their-own-work-in-context` | **3 runs before, 3 after, one arm (`no-llm-calls`, `askedTheModel: 0`) — six traces identical on every axis, and that is the correct reading.** `officeDeskWork` rides only on `/moment`, and the visit has made zero `/moment` calls on all twelve runs since 2026-09-06, so the instrument is **structurally blind** to any context field. The measurement for this slice is the audition below (24 real model calls, two arms, control included). Trace as regression check: 7/7 steps `ok`, `speech.count` 11 (`narration` 9 / `interrupt` 1 / `dwell` 1), `bySource.model` 0, `afterwards.workingMemory` = `dinesh:theirs` + `intern:gotIt`, `pageErrors: []`, `durationMs` 45.3–53.0 s — all six. | New: 6 (3 in `officeDeskWork.test.js`, 1 in `officeMomentDelivery.test.js`, 2 in `officePersonas.test.js`/`officeRoute.test.js`), **red before the fix and green after**, stash-and-rerun in both directions (web 4 red → 17 pass; server 2 red → 0 fail). `test:floor` 37/580, blast bundle 44/614, content ladder 19/353, server `office` 676+58, `npm run check` **exit 0** (web 270 files / 3160 cases). | #624 | Branch `office-life/their-own-work-in-context`. **Merged after a ~90-minute CI delay that was not this PR's**: `test-server`'s Chromium `apt-get` step took 15–30+ min on three runs and three runners (it normally takes seconds), with `main` green on the same step 90 min earlier. Filed as #625 (`ci.yml` is reachable by no routine). **It was slow, not hung** — see the correction below. **Started by finishing #619**, which the 2026-09-09 firing left green but unmerged as a draft — preflight refused a second branch until it landed (contract rule 4). Backlog checked and still empty of office work (#547 apps/web complexity, #536 metaphor3d, #452 digest log). Spend: **no new call site and no new cap** — the field rides requests the funnel already makes. One finding recorded below; the prompt-drafting one went in the domain file. |

| 2026-09-11 | Queue 5 — `per-persona-wander-habit` | **3 runs before, 3 after, one arm (`no-llm-calls`, `askedTheModel: 0`) — six traces byte-identical on every axis, and the reason is new.** The harness pins `Math.random` to 0.75, `floor(0.75 × 11)` is index 8 of `wanderingSeatIds()`, and that is `intern` — Chad, who holds nothing and so is the one colleague on the roster this slice cannot touch. Trace as regression check: 7/7 steps `ok`, `speech.count` 11 (`narration` 9 / `interrupt` 1 / `dwell` 1), `bySource.model` 0, `afterwards.workingMemory` = `dinesh` + `intern:gotIt`, `pageErrors: []`, `durationMs` 83.2–91.6 s — all six. The measurement is the closed-form sweep below. | New: 8 (all in `officeFloorWander.test.jsx`), **red before the fix and green after** — proven by restoring the API and neutralising only the behaviour (`wanderHabitFor` → `null`, the pre-slice room), so each of the eight failed on its own claim and the 43 pre-existing cases stayed green. `test:floor` 37/580 → **37/588**, blast bundle 44/614 → **44/622**, content ladder 19/353, shared `office` 380, server `office` 678+60. `npm run check` **exit 0** (web 270 files / 3175 cases). Also re-ran `test:floor` under `TZ=Europe/Berlin` (local 15:29, inside the slump) — 37/588 green, because the afternoon-red class below is exactly what a second dial on the same pick could have revived. | #636 | Branch `office-life/a-habit-per-colleague`. Backlog checked first and empty of office work (#625 CI, #547 apps/web complexity, #536 metaphor3d, #452 digest log). Spend: **zero** — no call site, no cap, no counter, no new table row; the habit is derived from two tables the room already keeps. Two findings in the domain file, one below. |

### 2026-09-11 sweep (the measurement for this slice)

The trace is structurally blind (above), so the number is the same shape as 2026-09-09's: a sweep
of the pure modules. This one is **closed-form rather than sampled** — `wanderTripWeight` is pure
and every wanderer has at most three errands, so the exact destination distribution of all eleven
can be printed instead of estimated. Throwaway script, deleted before commit.

```json
{
  "11:00 (no hour bias)": {
    "distinct destination distributions across the roster": { "before": 2, "after": 4 },
    "colleagues with a strictly likeliest errand": { "before": 0, "after": 5 },
    "printer": ["jared 33%→60%", "scrumMaster 33%→60%", "hr 50%→75%"],
    "coffeeMachine": ["erlich 33%→60%", "greybeard 33%→60%"],
    "unchanged": ["gilfoyle", "dinesh", "richard", "russ", "helpdesk", "intern"]
  },
  "15:00 (the slump)": {
    "distinct destination distributions across the roster": { "before": 2, "after": 3 },
    "printer share, owner vs everybody else": { "before": "20% vs 20%", "after": "43% vs 20%" },
    "coffee share, printer's owner": { "before": "60%", "after": "43%" }
  }
}
```

**Three readings worth keeping.**

- **"Before: 2 distinct distributions" was not two characters, it was one character and one
  accident.** Ten of the eleven were literally 33/33/33; the eleventh is `hr`, whose row differs
  only because the glass puts the kitchen out of reach. The room had no per-person movement at all,
  and the one apparent exception was geometry — the same "correct by accident" shape 2026-09-09
  found at the printer. Check whether an outlier is a character or a layout before reading it as
  evidence that variety already exists.
- **`Math.max` makes the slump a tie for the printer people, and the tie is the honest answer.**
  At 15:00 Jared sits at 43% printer / 43% coffee against everybody else's 20% / 60%: the hour and
  the habit pull equally and neither wins, so he is twice as likely as the room to run his own
  errand and his coffee share **falls**. Read against the playbook's phrasing ("the printer belongs
  to somebody at 14:00") that is the weaker of two possible claims — the printer is not his
  likeliest destination in the slump, it is merely no longer dragged out of him — and it is the
  claim the max rule buys. Raising the habit weight above 3 would buy the stronger one and make it
  a rota; it was declined on that ground, not overlooked.
- **A pinned seed selects one actor, and a per-actor feature the pinned actor lacks is invisible to
  every suite that pins it.** `test:floor`, the blast bundle and all six browser runs were green and
  byte-identical, which is normally the evidence that a change is safe and here was evidence of
  nothing at all. The tell was cheap and should be routine: compute `floor(seed × roster.length)`
  and ask whether that person is in scope before reading a green suite as coverage.

### 2026-09-10 audition (the measurement for this slice)

The trace cannot see a `/moment` context field, so the number is the domain's own prompt-audition
method: a throwaway script replicating the route handler, one fixed diagram, **4 samples per arm per
colleague** across three cast members with contrasting `officeDeskWork` rows (`russ` phone/tabs,
`jared` papers/tickets, `greybeard` mug/terminal), **and a control arm** — 24 real `deepseek` calls,
script deleted before commit.

```json
{
  "draft1": {
    "note": "closed with TWO prohibitions against one hedged permission",
    "control": { "n": 12, "ownActivity": 0, "fabricatedDelta": 0, "meanChars": 262 },
    "deskWork": { "n": 12, "ownActivity": 2, "fabricatedDelta": 0, "meanChars": 230 },
    "verdict": "INERT — arms inseparable; 1 line of 12 showed the block at all"
  },
  "draft2": {
    "note": "re-led with the register in the imperative, cut to ONE guard",
    "control": { "n": 12, "ownActivity": 0, "fabricatedDelta": 0, "meanChars": 271 },
    "deskWork": { "n": 12, "ownActivity": 6, "fabricatedDelta": 0, "meanChars": 258 },
    "verdict": "live — 0 of 12 -> 6 of 12, and shorter, not longer"
  },
  "samples": [
    "[deskWork/russ] alex. buddy. i'm on hour two of a call about a call, but i looked — login to auth to billing to ledger, that's a money pipe.",
    "[deskWork/jared] sorry alex, mid-printout here — the shape reads fine, auth fanning to billing and profile is clear. one thing though: does auth fail open or closed when billing is down?",
    "[deskWork/greybeard] sure, alex. login → auth → billing → ledger. that's a straight line and a fork, hard to get wrong. anyway, my terminal and i are still arguing."
  ]
}
```

**Read `ownActivity` beside its own definition, not as a quality score.** It counts a first-person
present-activity clause, and it is deliberately **not** scored on the persona's own vocabulary:
scoring Russ on the word "call" measures Russ, who says "call my guy" in the control arm too. The
regex undercounts — by eye ~10 of 12 carry the speaker's own work, against 0 of 12 control — so 6 is
a floor, not an estimate.

**The finding worth more than the slice: the inert-prompt rule replicated on a second block,
drafted by an agent that had just read it.** `docs/agents/domains/office.md` says in as many words
that prohibitions crowd out a hedged permission, and draft 1 was written with two "never"s against
one "let it colour how you sound" anyway. Same symptom, same fix, same size of effect. Two things
follow: the rule is a property of these prompts rather than a one-fixture artefact from the
relationship block, and **reading the entry is not sufficient to avoid the mistake** — every new
block gets a control arm before anybody believes it does anything. The guard that survived is the
one the measurement justifies (fabricating a diagram delta, the 8-of-12 finding in a new hat):
**0 of 12 in both arms**, so the block bought no fabrication.

### 2026-09-08 trace

Three runs before the change and three after, one machine, inside one hour, `DEEPSEEK_API_KEY`
present and `apps/server` built and running on `:4199`. **Both sets are the `no-llm-calls` arm**
(`askedTheModel: 0` in all six — the two `/api/office/speak` calls are Cloud TTS and are excluded by
construction) and may only be read against each other and against 2026-09-06's and 2026-09-07's
runs.

```json
{
  "runs": "3 before, 3 after",
  "mode": {
    "llmConfigured": false,
    "verdict": "no-llm-calls",
    "askedTheModel": 0,
    "answeredByModel": 0
  },
  "visit": "7/7 steps ok in every run, before and after",
  "step-into-their-path": {
    "before": "\"clicked the wanderer’s own tile\" — 7463 / 7941 / 7967 ms",
    "after": "\"clicked the wanderer’s own tile (at their mark); interrupted: gotIt\" — 9569 / 9565 / 9533 ms"
  },
  "speech": {
    "count": { "before": [10, 9, 10], "after": [11, 11, 11] },
    "byChannel": {
      "before": { "narration": 9, "dwell": "0 or 1" },
      "after": { "narration": 9, "interrupt": 1, "dwell": 1 }
    },
    "bySource": { "model": 0, "bank": "9-11" }
  },
  "afterwards": {
    "interruptBeat": {
      "before": "none, 0 of 3 runs",
      "after": {
        "colleagueId": "intern",
        "interrupted": "gotIt",
        "theirs": "Yep, go ahead.",
        "promptLines": [
          "you took the spot they were using; they had finished and stepped aside",
          "they said: Yep, go ahead."
        ],
        "runs": "3 of 3"
      }
    },
    "dwellBeat": {
      "before": ["facilities", "none", "erlich"],
      "after": ["dinesh", "dinesh", "dinesh"]
    }
  },
  "roomDelta": {
    "surfaces": "+office-floor-player, +office-floor-talk-card, +office-floor-wanderer",
    "seatsVacated": ["intern", "you"]
  },
  "durationMs": { "before": [49309, 43038, 42744], "after": [44356, 45011, 44300] },
  "pageErrors": []
}
```

**What this settles.** `interrupt-step-writes-no-beat` had two candidates and the trace could not
separate them: the click was landing somewhere the wanderer had left, or `useFloorInterruptMemory`'s
latch never saw the interruption. It is the **first** — entirely the instrument, and #582's product
chain works in a real browser exactly as `officeFloorWander.test.jsx` says it does in jsdom.
`useFloorWander`'s gate is `sameTile(wanderer.to, yourOrigin)`: their **destination**, which is the
prop's mark. The step waited for the wanderer element to _attach_ and clicked its live rect, and the
element attaches the instant the trip departs — so the visit was clicking the chair they had just
stood up from, measured at ~7.6 s against a first movement at 15.8 s. The fix waits for
`data-settled="true"` (`phase === 'dwell'`, the one moment their rect **is** their destination) and
then asserts `data-said`, which the room writes only when `goHome({ byYou })` fired.

**Three readings that are not the headline and are worth keeping.**

- **The `after` column is also more _stable_**, not merely larger: three identical runs against a
  `before` that varied on every axis. A step that waits for a state instead of racing one removes
  the variance the ledger's "one visit is a smoke test" note is about — the arm still needs three
  runs, but they now agree.
- **The dwell remark changed speaker, `facilities` / none / `erlich` → `dinesh` ×3, and that is a
  consequence of the fix rather than a second finding.** The step now leaves the player standing at
  a prop mark instead of on a corridor tile, so who is within dwell range is a different person. Any
  future row comparing dwell speakers across this date is comparing two different visits.
- **The composer sentence still asked the model nothing**, nine runs out of nine across three nights
  (`askedTheModel: 0`; `imHistory` ends with the outbound `talk` to Gilfoyle and no inbound reply).
  That is `dwell-then-nothing`'s territory, it is now the oldest unexplained observation this
  instrument has, and it still needs a control arm.

### 2026-09-07 trace

Three runs before the change and three after, one machine, inside one hour, `DEEPSEEK_API_KEY`
present and `apps/server` built and running on `:4199`. **Both sets are the `no-llm-calls` arm** and
may only be read against each other and against 2026-09-05's runs 4–5 / 2026-09-06's three.

```json
{
  "runs": "3 before, 3 after",
  "mode": {
    "llmConfigured": false,
    "verdict": "no-llm-calls",
    "askedTheModel": 0,
    "answeredByModel": 0
  },
  "visit": "7/7 steps ok in every run, before and after",
  "speech": {
    "count": { "before": [11, 9, 11], "after": [10, 10, 10] },
    "byChannel": {
      "before": { "narration": 9, "dwell": "0 or 2" },
      "after": { "narration": 9, "dwell": "0 or 1" }
    },
    "bySource": { "model": 0, "bank": "9-10" }
  },
  "afterwards": {
    "workingMemory": [
      {
        "colleagueId": "facilities",
        "beats": [
          { "interrupted": null, "theirs": "Motion lights on 3 are haunted…", "yours": null }
        ],
        "sawTheBoard": true,
        "promptLines": [
          "last board they noticed: mermaid::50",
          "they said: Motion lights on 3 are haunted…"
        ]
      }
    ],
    "logDigest": [
      "04:00 you and facilities traded messages",
      "04:00 hr emailed you: \"Welcome aboard, Intern Architect! 🎉…\"",
      "04:00 you and intern traded messages"
    ]
  },
  "movement": { "firstMover": "office-floor-player", "unchanged": true },
  "roomDelta": {
    "surfaces": "+office-floor-player, +office-floor-talk-card",
    "seatsVacated": ["you"]
  },
  "pageErrors": []
}
```

**Read the `after` column as a correction, not an improvement.** The office did not get quieter; the
instrument stopped counting one sentence twice. Every `dwell: 2` in this ledger — including the
2026-09-05 baseline that the acceptance rule has been measured against ever since — is one line.

**And the first reading off the new block is a hole, which is what it was added to find.** In all
three runs the only colleague with any memory of the visit is **`facilities`**, whose beat carries
`theirs` (the dwell remark) and `interrupted: null`. **No interrupt beat exists** — the very fact
#582 was landed to write, on a step that reports `ok` and "clicked the wanderer's own tile" every
single run. That is either the step never actually intercepting anybody or the product not writing
the beat, and the trace cannot yet tell those apart. It is the next slice, not this one: a run that
added the observation _and_ changed the thing it observes could not claim the observation was
neutral.

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

| Id                              | State                    | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `visit-harness`                 | **done** 2026-09-05      | Queue item 0. Landed as `apps/web/test/officeVisitTrace.mjs` — one file, one JSON object, seven fixed steps, scratch harness page written under `apps/web/` and deleted on the way out. Needs `playwright-core` installed **outside** the repo (`OFFICE_VISIT_PLAYWRIGHT=…`), because a new dependency is an issue first per the shelf contract, and an explicit `executablePath` for Chromium.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `visit-harness-home`            | **done** 2026-09-05      | Resolved by `improve`: pointed § 2's prose at `apps/web/test/office*` (the file's actual, already-reachable home) rather than widening `allowedPaths` to `scripts/` — no file move needed, the harness was already inside `office-life`'s budget. See `improve`'s 2026-09-05 run-log row.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `dwell-then-nothing`            | pending                  | From the first baseline: on the two runs where the dwell remark fired, the visit made **zero** LLM-bearing office calls and the sentence typed into the floor composer sat in `imHistory` with no reply; on the three where the dwell did not fire, the same sentence got a model answer in ~1.5 s. Two samples either side of a harness change that also grew the visit ~8 s, so it is an observation, not a cause. ≥3 samples per arm **and a control** before touching `officeCadence.js`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `floor-talk-channel-tag`        | **filed** #552           | `OfficeLayer.handleTalkReply` calls `pushOfficeImReply({ colleagueId, body })` with no `channel`; the default `'im'` is then omitted from the stored message, `isSpokenLine` is exactly `msg.channel === 'talk'`, so `latestTalkLine` is null and `FloorTalk` draws nothing. Measured: Gilfoyle's generated 58-token reply reached `imHistory` and no surface in the room showed it, while the dwell remark — which does tag `'talk'` — lifted a bubble in the same visit. Product change; not queue item 0's to make.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `ratchet-office-monoliths`      | **blocked-by-paths**     | `officeCast.js` (2790), `OfficeFloor.css` (1971), `OfficeLayer.jsx` (1791) and `officeFloorPlan.js` (1065) are absent from `ratchet.json`'s `monolithLoc`, so `improve`'s register-accuracy item never measures them and the four largest office files in the repo are unbounded. `ratchet.json` and every budget are `improve`'s. This row is the ask; do not widen it from a run.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `officefloor-suite-blast-wall`  | **blocked-by-paths**     | `scripts/test-affected.test.mjs` reverse-sweeps `apps/web/test/` for `/^officeFloor.*\.test\.(js                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | jsx)$/`and **fails`npm test`** on any match absent from `ISOMETRIC_FLOOR_BLAST_TESTS`, so a new `officeFloor*`suite cannot be landed by this rung at all — the script is`improve`'s. Two separate asks: (1) `useOfficeDayPhase`is in`test:floor`but not the bundle, and`officeErrand`/`personaFaces`/`useFloorArrivalFocus`/`useFloorAway`are in the bundle but not`test:floor`— the two sets should agree on what "the floor is green" means; (2)`docs/agents/isometric-floor-tests.md` (33/33 since #529) stays in sync whichever way it settles. |
| `interruption-leaves-a-mark`    | **done** 2026-09-06      | Queue 2, landed in #582. `useFloorInterruptMemory.js` writes a beat from `interruptSpeech`'s own answer (so memory cannot quote a line nobody heard); the beat carries an enum reaction and `workingMemoryPromptLines` owns the sentence. `hasWorkingMemoryFact` now returns true for somebody you have never spoken to, which is what opens `remarkTo`'s `cap`. Still record-only — nothing schedules.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `interrupt-step-writes-no-beat` | **done** 2026-09-08      | **The instrument, not the product** — settled in #608 by six runs (3 before / 3 after). `useFloorWander`'s gate is `sameTile(wanderer.to, yourOrigin)`, their **destination**; the step waited for the wanderer element to attach and clicked its live rect, which at that instant is the chair they were leaving. Waiting for `data-settled="true"` and asserting `data-said` produces the beat in 3 of 3 runs (`intern`, `gotIt`), so #582's chain works in a real browser and always did. Original entry: **Measured 2026-09-07, three runs, off the new `afterwards` block: no `interrupted` beat exists at the end of the visit.** The only working-memory row is `facilities`, written by the dwell remark. Yet `step-into-their-path` reports `ok` and "clicked the wanderer's own tile" in every run — the shape the ledger's Open observations already warn about, a green step that performs nothing. Two candidates and the trace cannot separate them: the click walks you to a tile the wanderer has already left (ambient traffic starts at 10.6–15.7 s and the step waits only for a selector), or `useFloorInterruptMemory`'s latch never sees an in-flight interruption on this path. Diagnose before touching either — and note that making a no-op step perform is **not** editing the visit to move a number (the precedent is the two steps fixed on 2026-09-05), while changing the product to satisfy the step would be. |
| `visit-double-counts-dwell`     | **done** 2026-09-07      | Fixed in #595 by keeping only the innermost node that matches the speech selector. Confirmed on three runs either side: `speech.count` 11 / 9 / 11 → 10 / 10 / 10, `dwell` 2 → 1. Every `dwell: 2` recorded in this ledger before that date is **one line counted twice**; the finding is now in `docs/agents/domains/office.md` because the nesting is a fact about office markup, not about the harness.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `visit-llm-not-configured`      | **withdrawn** 2026-09-07 | **Misdiagnosed, and the misdiagnosis is the finding.** The 2026-09-06 runs reported `verdict: "no-llm-calls"`, which the row read off the boolean beside it as "the backend is not configured". It means the opposite kind of thing: the office **never asked**, so the run says nothing about the server. Confirmed 2026-09-07 with a reachable `api.deepseek.com` (401) and a 35-char key — six runs, `askedTheModel: 0` in all six. `mode` now carries `askedTheModel` / `answeredByModel` so the boolean cannot be read alone. What remains real is the product question underneath: **the composer sentence provoked zero `/api/office/moment` calls in all six runs**, which is `dwell-then-nothing`'s territory and still needs a control arm.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `visit-cannot-see-afterwards`   | **done** 2026-09-07      | Closed in #595 by an `afterwards` block reporting working memory, `workingMemoryPromptLines` and the log digest, read through the dev server's module graph at the end of the visit — an addition to the **report**, not an eighth step. Its first reading opened `interrupt-step-writes-no-beat` above. Original entry: **The acceptance instrument cannot observe queue 2, 4 or 7's consequence, so "the trace moved" is unmeetable for the whole afterwards axis.** The visit steps into the _wanderer's_ path and loiters beside the _named colleague_ — never the same person — and the trace reports no store state at all, so a beat written at step 3 is invisible at step 4 and absent from `roomDelta`. Deliberately **not** fixed alongside the slice: editing the harness in the same PR as the feature it would measure is the shape § 2 warns about. A later run adds the observation to the report (not to the seven steps) and re-measures both arms.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `shop-talk-replier-not-prop`    | **done** 2026-09-09      | Queue 3, landed in #619 by **excluding the second-nearest seat** — the other named fix (key the bank on the replier) buys the same coherence but only after a new bank in four locales, so it was declined on cost, not on taste. `shopTalkPartnerFor` now resolves the prop's **resident** (single nearest seat; you and the glassed-in `senior` tier skipped as structural non-neighbours) and returns `null` when that person is the wanderer or is out of their chair, instead of walking on to a second candidate. Sweep over all 33 wanderer×prop combinations: exchanges 32 → 31, wrong-voice exchanges **1 → 0**. Original entry: at the whiteboard `dinesh (7,4)` and `jared (8,5)` are both one tile from the mark, so seat order — not character — decides who answers, and an engineer's-voice reply lands on Jared whenever Dinesh walked over. Its neighbour (a third participant unreachable by construction) is the same function and is **unchanged**; the bystander-withdraws-the-join-offer item is still parked **until measured**, and the visit harness still cannot measure it — see the 2026-09-09 trace note on why overhearing is out of the fixed visit's reach.                                                                                                                                                                                                                                                     |
| `their-own-work-in-context`     | **done** 2026-09-10      | Queue 4, landed in #624. `deskWorkPromptLines` turns the two closed sets into two durative sentences (durative on purpose — the moment funnel fires when the speaker may be walking, so "your screen has had a spreadsheet on it all morning" survives what "you are sitting at a spreadsheet" does not), the funnel ships them on every `/moment`, and `buildOfficeDeskWorkBlock` is the fourth and last context block. `line` is deliberately never sent. Measured 0 of 12 → 6 of 12 against a control; fabricated-delta 0 in both arms. Original entry: Queue 4. `officeDeskWork.js` holds a `look` and a `doing` per cast member and is shown on peek but **fed to no prompt**; `docs/office-parody.md` § 11 names "their own work" as its own open context hole. Wire it into the dwell/talk paths' existing `/moment` context, respecting the field caps on both sides. Never by letting the cast initiate a run.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `per-persona-wander-habit`      | **done** 2026-09-11      | Queue 5, landed in #636. `wanderHabitFor` is **derived, not declared** — `deskDoingFor(id).hold` × `propHandsFor(kind)`, the prop that refills what they are already holding, so `papers` → printer and a desk `mug` → the machine that hands out `coffee` (`FLOOR_PROP_USES` documents those two as one object at two stages). No table gained a row, the whiteboard belongs to nobody because it hands nothing over, and six of eleven have no habit. `wanderTripWeight` folds the hour and the habit into one weighted list with `Math.max`, **never a product** — one roll, so slice 23's PRNG-count rule holds — and reads `deskDoingFor`, never `baseDoingFor`, or `PHASE_ART` hands the whole roster one habit twice a day. Exact sweep: distinct destination distributions 2 → 4 at 11:00, 2 → 3 in the slump; colleagues with a strictly likeliest errand 0 → 5. Original entry: Queue 5. One global `WANDER_BIAS_WINDOWS` row today. Pure module, seeded PRNG, no browser needed. **Not** by adding a day phase.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `props-that-do-something`       | pending                  | Queue 6. Printer and whiteboard have copy but no verb (only coffee does, by ADR-0011 rule 3); the whiteboard reads the user's diagram and never writes back. Compose through `floorActivityFor`; no diagram-store subscription in the floor.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `provoked-lines-not-recited`    | pending                  | Queue 7, one channel per slice: dwell deck → `pickTalkAnswer`'s `ignored` → walk-by fallbacks → IM replies. Where the channel is already LLM-first, the finding is usually a missing fact rather than a missing call — that is `interruption-leaves-a-mark` or `their-own-work-in-context`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `room-tone-from-occupancy`      | pending                  | Queue 8. `officeRoomTone.js` / `officeSoundscape.js` tick on 5 s clocks and never ask who is in the room.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `batched-ambient-exchange`      | pending                  | Queue 9, the owner-approved spend exception. Needs the calls-per-session number and the caps in `officeCadence.js`, never a new counter.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `two-walkers-collision`         | pending                  | Queue 10. Slice 11 answered this as needing collision rules that do not exist. Issue with the model in it first; never an impulse slice.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `alive-while-seated`            | pending                  | `docs/office-isometric-mode.md` § 8: `OfficeFloor` renders nothing in desk mode — "almost certainly correct, but a choice nobody made explicitly". Do not pick this up without reading ADR-0011 rule 1 first (one state, two renderers); the desk already has the moment surfaces, and a second way to see the room is how they diverge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `ci-chromium-install-hangs`     | **filed** #625           | 2026-09-10. `.github/workflows/ci.yml`'s `test-server` step 4 ("Install Chromium (Anything runtime check)") took **15–30+ minutes on three runs and three runners**, against the seconds it normally takes, turning a 7.5-min job into ~20 min. It has no `timeout-minutes`, and `check` is an `if: always()` aggregator, so nothing goes red or green while it sits. `routine:guard --reachable` answers **`NONE`** for that path, so it is filed against `improve` and deliberately not `ready-for-agent`. **The issue was filed calling it a hang and corrected when the step completed** — the fix is a _generous_ `timeout-minutes` (20–25, above the 15 min 14 s measured) plus caching the browser, never a tight one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `app-css-chrome`                | **blocked-by-paths**     | `apps/web/src/App.css` holds the desk chrome budget (`--desk-taskbar-h`, pinned by `deskOsFrameStyles.test.js`) and is deliberately outside this playbook, so a chrome slice that needs it stops and records. It is a shared file three other rungs reach.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `office-dead-code-pair`         | pending                  | Two unfixed `review` observations from 2026-08-21 that were never filed as issues, both inside this playbook: `officeLogStore.js` and `officeWorkingMemoryStore.js` duplicate the `loadedDay` + `reconcileOfficeDay()` day-reconcile shape (candidate: `officeAmbienceStorage.js`), and `officeAmbienceStorage.js`'s `dayStampOf` is a dead one-line wrapper with five unrenamed call sites. Small, provable, and the kind of slice a night with no Chromium is for.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

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
- **The third of the visit's seven steps to be caught performing nothing while reporting `ok`.**
  2026-09-05 fixed two (the dwell hold measured nothing with the talk card open; the interrupt click
  arrived before any walker existed); 2026-09-08 fixed the same step again, for a different reason —
  it now waited for a walker and still aimed at the wrong tile. Three for seven is not a run of bad
  luck, it is the shape of this instrument: **every step here asserts what it did to the room, and
  almost none of them asserted what the room did back** until the note was made to carry the
  consequence (`interrupted: gotIt`) instead of the action ("clicked the wanderer's own tile"). The
  four steps not yet audited that way are `use-the-printer`, `open-the-whiteboard`,
  `walk-to-a-named-colleague` (which does assert the player moved) and
  `say-one-sentence-in-the-composer` — and the last of those is already the subject of the
  observation below.
- **The most reactive step in the visit asked the model nothing, nine times out of nine** (six as of
  2026-09-07, three more on 2026-09-08 with the interrupt step fixed, which changes nothing about
  it). The
  composer sentence ("Does this diagram make sense to you?") reaches `imHistory` as an outbound
  `talk` message to Gilfoyle and produces **zero** `/api/office/moment` calls; on 2026-09-07 run 1
  an `officeEvent: imReply` fired 34.6 s in with no fetch behind it and no inbound message in
  `imHistory` at the end. Against § 11 — _you typed it, so a canned reply is the clearest possible
  tell that nobody is home_ — that is the single most on-brief observation the instrument has
  produced, and it is **not yet a diagnosis**: it shares its shape with `dwell-then-nothing`, and
  every run that has seen it was the `no-llm-calls` arm. It needs a control (the same visit with a
  colleague who _does_ have a fact about you) before anybody changes a cap.
- **A run may spend itself on the instrument, and this is what that looks like.** 2026-09-07 shipped
  no product file: two of the three defects it fixed made the acceptance rule unmeetable, and one
  of them had already put a wrong number (`dwell: 2`) into a baseline that two later rows were read
  against. The general form, which 2026-09-06 wrote and this run followed: **when the instrument
  cannot see the slice, fix the instrument in its own run, and never in the run that needs the
  number.** The corollary this run adds is that the fix must be an addition to the **report** — the
  seven steps stay fixed, and `afterwards` is a read of stores the room already writes.
- **The fixed visit cannot reach the overheard channel, and this is a boundary rather than a
  defect.** `channelOf` in the harness already maps `office-floor-shop-talk-line` → `shopTalk`, so
  the instrument is able to report one; across nine runs on three nights it never has, because
  overhearing needs a wanderer settled at a prop while you stand two to three tiles off it with
  nothing else speaking, and the seven fixed steps keep you at a prop mark or inside a conversation
  throughout. § 2 forbids an eighth step, so **queue 3, the parked bystander-withdraws-the-offer
  measurement, and anything else on `useFloorShopTalk` are measured by a sweep of the pure modules,
  not by the visit.** 2026-09-09 is the first row to do that, and the general form is worth keeping
  separate from 2026-09-06's: _the instrument cannot see the slice_ was a hole to fix in its own
  run; _the instrument's subject does not contain the slice_ is a different instrument's job, and
  conflating them would grow the visit until it is a test suite.
- **A firing that leaves its PR open costs the next firing its slice, and the fix is to finish it,
  not to start beside it.** 2026-09-09 landed #619 green on all eleven checks and left it a draft;
  2026-09-10's `--preflight` refused outright ("open PR #619 already belongs to office-life"), which
  is contract rule 4 doing exactly its job. The right move is the cheap one — verify the open PR
  still merges clean against the moved `main`, undraft, merge, re-run preflight — and it cost about
  five minutes. **The rung's own definition of done includes the merge** ("opens a PR and merges it
  when CI is green"), so a run that stops at "PR opened" has not finished, and the evidence it left
  behind is a green PR nobody will merge until the next night notices.
- **The instrument's blindness has two different shapes and only one of them is worth fixing.**
  2026-09-06's was a _report_ hole — the trace could have carried working memory and did not, and
  #595 added the observation. 2026-09-09's and 2026-09-10's are _structural_: shop talk needs the
  visit to stand two tiles off a prop it never stands off, and a `/moment` context field needs a
  `/moment` call the visit has never made (`askedTheModel: 0`, twelve runs, four nights). No
  addition to the report reaches either — the first needs a step the seven forbid, and the second
  needs the composer sentence to provoke a model call, which is the ledger's oldest open
  observation and a slice of its own. Two of the last three slices have now been measured by
  something other than the trace, and that is the honest state of the acceptance rule rather than a
  gap to paper over: **when the visit is structurally blind, say which measurement replaced it and
  keep the six runs as the regression check.**
- **A third shape of blindness, and it is the instrument's determinism rather than its report or
  its subject.** 2026-09-06's was a report hole (fixable, and fixed). 2026-09-09's and 2026-09-10's
  were structural in the visit's _subject_ — overhearing needs a tile the seven steps never stand
  on, a `/moment` context field needs a call the visit has never made. 2026-09-11's is neither:
  the visit _does_ send a wanderer somewhere, and the axis is exactly the one the slice moved. It
  is blind because **§ 2's own pinned seed always picks the one actor the slice cannot touch** —
  `floor(0.75 × 11)` is `intern`, who holds nothing and so has no habit. The pin is not the defect
  (it is what makes a capture and a test talk about the same trip, and unpinning it would trade a
  reading for noise), and no addition to the report reaches it either, because **a distribution
  cannot be measured by one fixed visit whatever the seed** — three runs of an identical trip are
  three copies of one sample. So the rule from 2026-09-09 stands unchanged and gains a cheap
  precondition: before reading a green seeded suite as coverage for a **per-actor** change,
  compute `floor(seed × roster.length)` and check whether that actor is in scope.
- **A step with no timeout does not just risk a long job — it removes the information an unattended
  run needs to decide anything.** 2026-09-10: `test-server`'s Chromium `apt-get` step, normally
  seconds, ran 30 min (attempt 1, cancelled by this run), 19 min (attempt 2, superseded by a push)
  and finally **15 min 14 s, succeeding** on the third. Three data points said "hung"; the truth was
  "slow", and the difference was only visible by waiting past the point where waiting felt
  unreasonable. Two costs worth remembering. The one re-run the drive-to-green rules allow was
  **spent on a run that was probably about to pass**. And #625 was filed proposing
  `timeout-minutes: 5`, which would have failed _every_ `test-server` run for the duration of the
  slowdown — a fix that would have caused the outage it was meant to prevent, corrected in the issue
  once the step completed. The general form: **before calling an unbounded step hung, say what
  duration would change your mind, and wait for it.** A cancel is not free — it destroys the
  evidence that would have settled the question.
- The floor's known ESLint complexity offenders are recorded in `docs/office-isometric-mode.md` § 8,
  which also warns the figures had themselves drifted and one was backwards. Re-measure before
  quoting them, and remember most floor complexity points are **default parameters** (`= null`
  counts as a branch), so extracting is the fix and rewording conditions usually is not.
