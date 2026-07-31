# ADR-0012: Five collaboration acts, one of which produces

## Status

Accepted — 2026-07-31 (design decision from the parody-OS reimagining session). Shipped across slices 3–6 of [`docs/office-isometric-mode.md`](../office-isometric-mode.md) §4; behaviour lives in [`docs/office-parody.md`](../office-parody.md) § Desk verbs, § 5b, § 5c.

## Context

[ADR-0010](0010-cast-agency-sign-off.md) fixed the vocabulary — **pitch**, **delegation**, **proposal** — and the one-producer rule. What it did not do was give the UI a way to express any of it.

Concretely: the desk had exactly **one prompt and it went to the production pipeline**. There was no way to say something to the room from your chair. Meanwhile **Fix** appeared in the radial menu, the Desk tray and the Notebook checklist, and in none of those places did it sit next to Jared, whose critique it acts on. The cast could be _delegated to_ and could _interrupt you_, and that was the whole of the relationship.

The risk in fixing this is obvious and worth naming: adding channels through which a cast of fifteen can talk to you is adding fifteen ways to spend LLM budget and fifteen ways to erode the one-producer rule by accident.

## Decision

1. **Five acts, drawn from how a real team works, and exactly one of them produces.**

   | Real act                       | In the app          | Yields                     |
   | ------------------------------ | ------------------- | -------------------------- |
   | Say something out loud         | **undirected talk** | a reply, sometimes a pitch |
   | Turn to the person next to you | **directed talk**   | a reply, sometimes a pitch |
   | "Everyone look at my screen"   | **mob**             | beats, each maybe a pitch  |
   | Pair programming               | **pair**            | remarks that keep coming   |
   | "Can you do this for me?"      | **delegate**        | **a pipeline run**         |

   Four of the five never generate slot content. That is not a limitation to be lifted later; it is the shape that keeps ADR-0010 true while the cast becomes genuinely conversational.

2. **Talk is one verb with and without a target**, not two features. Undirected and directed both route through `imSomeone`, which already picked a random teammate when handed a null id. It gets its own reactive cap (`TALK_LLM_CAP`), separate from the ambient one, because a talk channel sharing the 3-moment ambient budget would fall back to canned within three sentences — which reads as broken rather than as in-character.

3. **Mob and pair share one state slice, differing only in roster size and end condition.** Both are `officeMomentStore.huddle`; `mode: 'mob' | 'pair'` is the only new field. What they share — seated faces, paced remarks, a Do-it, freezing while a delegated run streams — is everything except how many people and how it ends. A mob ends itself when the last remark lands; **a pair does not end itself**, because somebody who pulled up a chair does not evaporate because they finished a sentence.

   But **a pair is not "a mob with one seat" at the prompt layer**: every huddle prompt rule breaks at N=1 (take turns, one remark each, wrap up). Pairing gets `buildPairSystemPrompt` and `parsePairScript`, whose behaviour is the exact inverse of the mob parser's first-line-wins — it keeps repeats and model order, because one voice with a train of thought is what it is asking for.

4. **Pitches come from the whole cast, on a condition rather than at a rate.** Any speaker may attach an `actionPrompt` to a remark; the field was already optional on every beat, walk-by, email and IM. Two things changed: the prompt asks for one **when the speaker actually has something** (replacing a "roughly 1 in 3 moments" frequency rule), and every renderer surfaces it attributed to whoever said it. Critique stays Jared's _delegation_ specialty — a full `runAnalyze` pass — rather than the sole source of actionable feedback.

5. **A surface that only observes may exist, if it produces nothing.** The presence strip watches the office permanently and is a pure projection of the moment store plus the seating plan. This is the same carve-out that licenses ambient floor life under ADR-0011, claimed from a chair instead of from the floor.

## Consequences

- **A rate became a condition, and that is the load-bearing change in (4).** "One in three moments carries a pitch" produces wallpaper: buttons appear on a schedule, so they stop meaning anything, and the user learns to ignore them. A condition means a Do-it button is evidence that somebody had an idea. It also gives voices that observe rather than propose (Richard) an honest out.
- **Four non-producing acts cost LLM budget with nothing to show in the canvas**, which is the trade being accepted deliberately: the spend buys the office being an office. The reactive cap, the canned bank as a floor, and the ambient/reactive split from ADR-0010 are what bound it.
- **The huddle slice now carries two acts**, so any change to it must state which mode it is for. The live example: the mid-scene diagram refresh is **mob-only** for a mechanical reason — a mob's re-script returns exactly one beat per teammate who has not spoken, so `lineCount` is unchanged and `useScenePacing` keeps its place. A pair's re-script comes back a different length, `lineCount` is in that effect's dependency array, and the loop restarts and re-speaks lines. Wiring pair refresh means fixing the hook to append without restarting first.
- **Pitch rendering is now a per-surface obligation.** Desk speech, Slop Chat, the inbox, walk-bys and huddle beats all surface one. `FloorTalk` does not yet — the floor's bubble receives `talk` and `draft` but not the latest inbound line, and threading it touches the floor props contract pinned by `officeFloorPropsTable.test.js`. That gap is a known debt, not a decision.
- **Two composers, not a toggle.** A toggle makes you choose before you know which one you meant; the roster sitting between the lanes answers both, with the chip delegating and the name/face addressing.

## Alternatives considered

- **One composer with a mode toggle** (work order ↔ talk). Rejected: the choice comes before the intent, and the two lanes have different consequences — one spends a pipeline run and one does not. Making that distinction a hidden mode is exactly the wrong place for it.
- **Pair as its own store slice.** Rejected: it would fork four behaviours (seating, pacing, Do-it, pause-for-run) that are genuinely identical, to express two that are not. The two that differ are cheaper as a `mode` field and a prompt-layer branch.
- **Pair as a mob with `attendees.length === 1`, reusing the huddle prompt.** Tried and rejected during the slice: every rule in the huddle prompt is about turn-taking, and a single attendee handed those rules writes a scripted goodbye and stops. The parser inversion (keep repeats, keep model order) is the other half of the same finding.
- **Keeping pitches to Jared.** Rejected: it made "actionable feedback" a property of one persona rather than of having something to say, and it left the other fourteen able to comment but never to hand anything over.
- **A pitch rate.** See consequences — the reason it was replaced is the main finding of slice 4.
- **Deriving the presence strip from `officeFloorWander`** (as the plan proposed). Rejected on inspection: wandering is floor-local and dies when you sit down, so reading it from the desk would present _who could get up_ as _who is around_. The pod — the desks adjoining yours — is what a seated person can honestly see.

## Where this lives in code

- **Talk:** `apps/web/src/hooks/useDeskActions.js` (`talkOutLoud`, `imSomeone`, `TALK_LLM_CAP`), `components/DeskTalkComposer.jsx`, `components/OfficeDeskSpeech.jsx`; `channel: 'talk'` in `state/officeMomentStore.js` (`pushOfficeImPing`) is what keeps a reply out of the arrival-toast lane.
- **Mob / pair:** `state/officeMomentStore.js` (`huddle` slice, `PAIR_SEATS`, `startOfficeHuddle(attendees, {mode})`), `hooks/useHuddlePlayback.js`, `hooks/useHuddleRingControls.js` (withholds `onDone` while pairing — the "a pair never auto-ends" mechanism), `components/HuddleOverlay.jsx`; server side `apps/server/src/routes/office.js` (`HuddleModeSchema`, `huddleAttendeesForMode`, `planHuddleTurn`) and `agents/officePersonas.js` (`buildPairSystemPrompt` / `parsePairScript`).
- **Pitches:** `agents/officePersonas.js` (`buildMomentSystemPrompt`'s conditional pitch rule + `pitchReplyHint`), `apps/web/src/utils/officeMomentDelivery.js`, and the `onAdoptPrompt` paths in `components/MessengerLog.jsx`, `OfficeDeskSpeech.jsx`, `OfficeInbox.jsx`, `HuddleOverlay.jsx`.
- **Presence:** `apps/web/src/utils/officePresence.js` (`officePresenceOf`, `podSeatIds`), `components/DeskOsPresenceStrip.jsx`.
- **Delegation** is unchanged: `components/StakeholdersMascot.jsx` roster chips → `runTransform` / `runAnalyze`.
