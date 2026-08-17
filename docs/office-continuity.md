# Office continuity — working memory + runWalk

> **Status: shipped (v1, 2026-08-17).**
> Grilling locked this spec; do not re-derive the product forks.
> ADR: [`docs/decisions/0013-office-continuity.md`](decisions/0013-office-continuity.md).
> Doctrine it sits on: [`office-parody.md`](office-parody.md) §11, [ADR-0010](decisions/0010-cast-agency-sign-off.md), [ADR-0011](decisions/0011-two-office-renderers.md).

Read this when you are about to make colleagues feel more “real,” remember the user, react to a completed run on the isometric floor, or add a value to `OFFICE_MOMENT_SITUATIONS`.

## Goal

The isometric office feels real because **the same person remembers you**, not because they talk more. Presence stays the floor texture. Helpfulness is the 1-in-3, and only on channels the user opened.

## Locked doctrine

- **Continuity** is the product goal. Presence is the room. Collaboration is accidental competence, not a second Copilot.
- Primary gap today: they do not notice **you**. Repetition is second.
- Keep the ambient/reactive split. The only new initiation is **a completed run**.
- Overheard / coffee / battle stay entertainment. Talk the user starts is mostly helpful.
- Memory **records**. It never schedules a moment (ADR-0010).
- One moment in the shared store; both renderers read it (ADR-0011).

## v1 slice

Ship these together. Memory without a floor proof, or a walk-over without beats, will still feel like a canned walk-by.

1. Per-colleague **working memory** (office day).
2. **Dwell LLM gate** — spend `OFFICE_DWELL_LLM_CAP` only when memory has a fact to notice.
3. **runWalk** — if a run lands while the user is idle on the floor, one colleague walks over (else IM).

Desk IM for this producer uses the **same picker** as the floor walk. Caps stay the existing run-reaction budget (max 5/session, 3 LLM, 40s cooldown, 55% chance). Do not spend `OFFICE_LLM_MOMENT_CAP`. Focus Time still kills it.

### Build order

Each step’s completion criterion is what “done” means before starting the next.

1. **Working memory store** that both renderers can read, day-stamped like the office log, with no producer that fires from it.
   Done when tests pin write / read / same-day reload / new-calendar-day clear, and no cadence or ambience hook reads it as a trigger.
2. **Writers.** Stamp a board fingerprint on the colleague who fires the run reaction. Append beats when the user dwells or talks with someone (their line, the user’s line, whether a pitch was taken).
   Done when those are the only fingerprint/beat writers.
3. **Dwell LLM gate.** Empty memory → canned social deck, depleted per person. Memory has a fact → LLM under `OFFICE_DWELL_LLM_CAP`. Still one line per approach; leaving re-arms.
   Done when an empty-memory dwell is canned and a memory-hit dwell is LLM.
4. **`runWalk` wire.** Add the value to `OFFICE_MOMENT_SITUATIONS`. Mark it spoken in `isSpokenMomentSituation`. Add one rule block + one reminder. Circumstance only: they walked over because work just landed; comment on how the diagram **stands now**; they did not see a delta; no `userMessage`; no `actionPrompt`.
   Done when `officePersonas` tests pin the block, the reminder, spoken classification, and the no-delta / no-pitch rules.
5. **Run-reaction presentation.** View at fire time: seated → IM (`kind: im`). Floor and idle → one walk-by (`kind: walkby`, `situation: runWalk`, `channel: talk`). Lift `floorActive` for this producer only. Idle = today’s run-reaction gates minus `floorActive`, plus not in talk, not in a floor card, not mid-commute, not mid-dwell line. Picker below. If nobody can walk or LLM fails on the floor: **no fake walk** — IM-in-tray or silence.
   Done when seated is IM, floor-idle is walk-by, busy floor is IM or silence, and the payload has no `actionPrompt`.
6. **Prompt the memory.** runWalk and memory-hit dwell receive the colleague’s working-memory beats (and the relationship block still on `/moment`).
   Done when a second approach the same day to that person is visibly not a first meeting.

### Picker

One colleague. Prefer someone already in today’s working memory who **can walk**. Else the intersection who can both IM and walk: `intern`, `scrumMaster`, `greybeard`. Never senior. Never already away in a set piece. Path must exist. Otherwise IM-in-tray, no spoken walk.

### Idle on the floor

Walk-by is a live surface (`hasActiveOfficeSurface`). Stacking it on a conversation the user already started is the overload this slice exists to avoid.

Gates: Focus, meeting, streaming run, hidden tab, another office surface — **plus** not in talk, not in a floor card, not mid-commute, not currently being spoken to (dwell line live). Standing still for `DWELL_MS` is **not** required; the 2.2s run-reaction delay is the “it just landed” beat.

### Two-beat proximity (v1 uses beat 1 only as a gate)

- **Beat 1** (dwell): they notice you. Social. One line per approach.
- **Beat 2** (helpful): only if the user **talks or joins**. Standing still is them going back to work.

v1 does not add an auto-helpful second dwell line.

## Working memory

Not the office log (shared, lossy, 12 lines). Not `buildOfficeRelationship` (counts and recency only). Those stay.

Per colleague, for **this office day**:

- Last few beats between you and them (their line, yours, pitch taken or not).
- Last board fingerprint they “saw” — stamped on the run-reaction speaker, and on anyone the user later dwells or talks with.

Reload the same calendar day keeps it. A new calendar day clears it. “We have not spoken today” is still not a line anyone says.

Stamping everyone on a board-sample edge is omniscience. Desk peek is display, not “they read the labels.”

## `runWalk` on the wire

`run` is silent (written IM) and must not claim it saw a delta — that was measured to invent changes. `walkover` is spoken, but it means they answered something the user shouted. Neither is “a run landed, so they got up.”

Adding `runWalk` is a four-place contract:

| Place            | File                                                                    |
| ---------------- | ----------------------------------------------------------------------- |
| Enum             | `packages/shared/src/officeScript.ts` (`OFFICE_MOMENT_SITUATIONS`)      |
| Spoken predicate | `isSpokenMomentSituation` in `apps/server/src/agents/officePersonas.js` |
| Rule block       | `MOMENT_SITUATION_RULES` in the same file                               |
| Reminder         | `buildMomentSituationReminder` in the same file                         |

Then `npm run build -w packages/shared` so consumers see the export. Blast radius: [`docs/agent-blast-radius.md`](agent-blast-radius.md) § Office moment situations.

Lead the rule with the register (they walked over because work just landed; pick up as if they looked at the screen). One guard: they can see the diagram only as it stands — do not name a change. No escape hatch of the form “say nothing if nothing earns it.”

## Files to extend (v1)

| Concern                     | Path                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Situation enum              | `packages/shared/src/officeScript.ts`                                                                                             |
| Prompt + spoken predicate   | `apps/server/src/agents/officePersonas.js`                                                                                        |
| Run-reaction producer       | `apps/web/src/hooks/useOfficeRunReactions.js`                                                                                     |
| Delivery / picker           | `apps/web/src/utils/officeMomentDelivery.js`                                                                                      |
| Cast pools                  | `apps/web/src/utils/officeCast.js` (`OFFICE_IM_LLM_CAST`, `OFFICE_WALKBY_LLM_CAST`)                                               |
| Dwell                       | `apps/web/src/components/officeFloor/useFloorDwell.js`, `apps/web/src/hooks/useDeskActions.js` (`remarkTo`)                       |
| Cadence caps (do not raise) | `apps/web/src/utils/officeCadence.js`                                                                                             |
| Day stamp precedent         | `apps/web/src/state/officeLogStore.js`                                                                                            |
| New store (likely)          | sibling of `officeLogStore.js` / `officeAmbienceStorage.js` — presentation-agnostic                                               |
| Floor idle / talk / cards   | `OfficeFloor.jsx`, `useFloorTalk.js`, `FloorCardSlot`                                                                             |
| Tests                       | `useOfficeRunReactions` tests, `officePersonas.test.js`, `officeRoute.test.js`, `officeFloorDwell.test.jsx`, `npm run test:floor` |

## Done / revert

**Done** when a floor run-walk names something on the current board, does not invent a change, does not pitch, and a second approach the same day to that person is visibly not a first meeting.

Pin at least:

- no `actionPrompt` on run-walk / this producer’s initiation
- `situation: 'runWalk'` is spoken and the reminder forbids naming a change
- picker never selects senior / already-away
- `floorActive` no longer swallows the producer; talk/card/commute still do
- working memory clears on a new calendar day and survives same-day reload
- empty-memory dwell stays canned

Audition the `runWalk` block the same way `run` was measured (fixed diagram, situation the only variable, control arm). Fabricating a change is a revert, not a prompt tweak to “try harder.”

**Revert** if people hit Focus because of it, or if the line could have been a random walk-by.

## Explicitly out of v1

Do not smuggle these in as “part of the same beat”:

- Join-in context (offer stays textless; composer stays empty; first _reply_ knowing the prop is v2)
- Per-person deplete of **overheard** shop talk (addressed-to-you canned already depletes per person on dwell)
- Expanding the walker pool past memory-bias + intern / scrum / greybeard
- Any new ambient volume or timer-driven speech
- Any pitch on initiation
- New canned walk banks for `runWalk` (LLM fail → IM or silence, not a mismatched fallback)

## v2 (parked)

- Join: offer stays textless; first reply may know the **prop** and that they were talking — not a quote of the canned lines.
- Per-person deplete on overheard floor canned if repetition still fails after v1.
- Whether a later slice may widen the walker pool.

Re-grill v2 if any of those look load-bearing; they are not implied by shipping v1.
