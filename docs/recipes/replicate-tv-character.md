# Recipe: replicate a TV character as an office cast member

Playbook for the Silicon Valley character program: how one named character gets replicated into
the office cast. Proven out twice with Jack Barker — first as a senior stakeholder (fidelity ≈
4.2/5 sustained), then by **inheriting The VP's team seat** (2026-07-25): Barker is now the sixth
radial advisor, simplifying diagrams in his own voice (re-tuned to ≈3.95–4.0/5 on the extended
harness, which added the harder advisor-suggestions probe). Proven a third time with **Erlich
Bachman inheriting the Chief Innovation Officer's team seat** (2026-07-27, `innovate` → `erlich`)
— the first inheritance run against the generalized harness (§3), and the template for the
remaining sessions. Session 2 (2026-07-27) then landed the reachability half of Barker's seat: he
is in the proactive roundtable at throttled weight. Proven a fourth time with **Bertram Gilfoyle
inheriting the engineer seat** (Session 3, 2026-07-27, `refine` → `gilfoyle`) — the first
inheritance where the retired id was a _generic verb_, which changes the sweep (§4b.0). Proven a
fifth time with **Dinesh Chugtai on a brand-new seventh seat** (Session 4, 2026-07-27, `dinesh`)
— the first run that is _not_ an inheritance, so §4c is the drill it produced. The cast
map and **reachability ladder** below are **locked** (2026-07-26 program plan; reachability
2026-07-27) — one character per agent session, in the order listed.
**Next up: Session 5, Jared Dunn inherits the `critique` seat (`critique` → `jared`).**

## Status board

| Character         | Target seat / tier                       | Status                                                                                               |
| ----------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Jack Barker       | team+senior — 6th advisor (`barker`)     | ✅ Shipped — advisor seat + Session 2 throttled roundtable (part of team, less often than peers)     |
| Erlich Bachman    | team — `erlich` (ex-`innovate`)          | ✅ Shipped — seat inheritance; courageous pivots, incubator swagger                                  |
| Bertram Gilfoyle  | team — `gilfoyle` (ex-`refine`)          | ✅ Shipped — seat inheritance; deadpan verdicts, always actionable; battle-eligible (dual-home)      |
| Dinesh Chugtai    | team — **new** `dinesh` (gilfoyle-class) | ✅ Shipped — new seventh seat (not an inheritance); correct fix + a bid for credit; battle dual-home |
| Jared Dunn        | team — `critique` → `jared`              | ⬜ **Session 5 (next)** — findings-only Auditor; anxious compliance                                  |
| Russ Hanneman     | team — `goMad`                           | ⬜ Session 6 — highest content-policy risk (innuendo, not profanity)                                 |
| Richard Hendricks | team — `explain` → `richard`             | ⬜ Session 7 — comment-only Wise Architect (no transform powers — ADR-0010)                          |
| Gavin Belson      | senior — `cto` → `belson`                | ⬜ Session 8 — named CTO; scarcer than Barker; Jack reports to him; retires Marcus                   |
| Marcus            | senior — `cto`                           | 🚮 Retires when Belson lands — currently a Belson _homage_, not a replication                        |

Session 0 locked the map; the fidelity harness (§3) is generalized — one profile per character,
reused every session. Each character session ends with registry/TTS/locale tests green,
`npm run precommit`, live smoke, and the fidelity report in the PR body.

### Reachability ladder (locked — do not re-litigate)

| Who                                                                                            | How you reach them                          | Frequency                                                                                                                                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full-weight team advisors (Erlich, Gilfoyle, Dinesh; then Jared / Russ / Richard as they land) | Roundtable + radial / hotkey / mascot       | Peer weight in `pickNextPersona`                                                                                                                   |
| **Jack Barker**                                                                                | Same Your Team surfaces                     | **Throttled** — in `ADVISOR_ORDER` at `ADVISOR_PICK_WEIGHTS.barker` = 0.5 (~half as often as a peer). ≤1 senior email/session. No walk-by/IM spam. |
| **Gavin Belson** (ex-Marcus)                                                                   | Steering meetings + ≤1 senior email/session | **Scarcer than Barker** — never proactive roundtable, never a team transform seat. Fiction: Barker reports to him.                                 |

### Session 2 drill — Barker throttled roundtable (✅ shipped 2026-07-27)

Not a new character — accessibility only, and the smallest session in the program (one hook + its
test + doc sweep). What shipped, as the template for any future weight change:

1. `barker` added to `ADVISOR_ORDER` in `apps/web/src/hooks/useAdvisorOrchestrator.js` (last —
   mirrors the mascot roster, where he sits under the "Upstairs" divider).
2. `pickNextPersona` swapped from a uniform index to `pickWeightedPersona(pool, roll)`, a
   cumulative-weight walk over `ADVISOR_PICK_WEIGHTS` (peers 1, `barker` 0.5). Both helpers are
   exported so the throttle is asserted directly instead of through the timer loop.
   **Watch the repeat filter when you retune a weight:** `pickNextPersona` drops the previous
   speaker first, so a single draw is exactly half but the _run_ frequency is the chain's
   stationary distribution, `π(j) ∝ w(j)·(total − w(j))` — which lands Barker slightly above a
   flat 0.5×. **Both numbers move every time the pool grows**, so the sweep in
   `useAdvisorOrchestrator.test.js` is written as fractions of the live pool, not as literals:
   with 6 peers + Barker at 0.5 (total 6.5) a single draw is 2/13 per peer vs 1/13, and the
   120k-turn rotation is 5.5/36 (≈15%) per peer vs 3/36 (≈8%) for Barker, i.e. 0.545×. When
   Session 5 seats Jared these shift again — recompute from `π`, don't nudge the literal.
3. Belson / Marcus (`cto`), `ciso`, `cfo` stay OUT — a regression test pins that list.
4. Senior email cap untouched; roster + radial ordering already had him findable-but-not-first
   (radial: after `goMad`, before `critique`; roster: last, under "Upstairs"), so no reorder.
5. `castTiers.js` deliberately **not** changed — `barker` stays a single-tier `senior` tag
   (`tierOf` is first-match and the meeting directory iterates the tiers, so a second membership
   would double him in the picker). Roundtable membership is `ADVISOR_ORDER`'s job; the tier
   table's comment now says so.
6. Verified with `npm run check:affected` + the smoke below.

Note: **the user is basically Richard** — the fiction casts you as the anxious builder the office
keeps interrupting. Richard-the-advisor (`explain`) is your alter-ego Wise Architect giving
comment-only advice, not a second "you" — which is very Richard. No skinnable-seat machinery is
needed: each character replaces the generic persona id wholesale, the way Barker replaced `exec`.
**Dual-home comedy:** Gilfoyle and Dinesh stay eligible for cubicle battles / office distraction
set pieces (same pattern as Barker living in senior + advisor). Team seats stay non-claimable as
Acting roles.

## The method (voice card → harness → wire-in)

Named-character replication works because the LLM already knows the show. The craft is the voice
card; the harness proves it; the wire-in is a mechanical drill whose size depends on the tier.

### 1. Pick the tier (decides the touch list)

- **team** (Erlich→innovate→`erlich`, Gilfoyle→refine→`gilfoyle`, Jared→critique, Russ→goMad, Richard→explain): the
  character INHERITS an existing advisor seat — the generic persona id is retired and the
  character id takes over everything the seat touched, including the transform/analyze behavior
  and the wire enum. This is the seat-inheritance drill below; Barker proved it on the `exec`
  seat. ~40 files, mostly mechanical, plus real prompt-craft on the behavior blocks.
  - **Dinesh was the exception (shipped):** a NEW seventh mode, not an inheritance — clone
    `gilfoyle`'s budgets/temps (`*_MAX_NODES`, `TRANSFORM_MODE_MODEL`), distinct persona id, plus
    his own XP/radial/hotkey/mascot rows, so both engineer seats coexist on the floor (desk next
    to Gilfoyle in `apps/web/src/utils/officeFloorPlan.js`). The drill is §4c.
- **senior** (Gavin Belson → the `cto` seat): steering meetings + ≤1 canned email/session.
  Smallest surface, richest dialogue. Add to `SENIOR_MEETING_VOICES` + `SENIOR_STAKEHOLDERS` +
  `MEETING_SENIOR_POOL` + `SENIOR_EMAIL_TEMPLATES`. Belson is a full named replication, not a
  blurb rename: the drill additionally retires Marcus — sweep the `cto` display id everywhere the
  seat-inheritance list (§4b) touches senior trappings.
- **office** (the invented colleagues — Pam, Linda, Chad, Dave, Gary, Ulrich — stay as-is):
  emails, IMs, walk-bys, coffee, **cubicle battles**. Bigger drill: `OFFICE_COLLEAGUES` (server +
  client), the `OFFICE_{WALKBY,EMAIL,IM}_LLM_CAST` arrays, canned template banks,
  `canJoinMeetings`. Gilfoyle/Dinesh don't need this tier — they get battle eligibility as a
  dual-home add-on to their team seats (existing cubicle-battle casting arrays; no new battle
  infrastructure).

### 2. Write the voice card (server, the core artifact)

Add the entry in `apps/server/src/agents/officePersonas.js` (`STAKEHOLDER_MEETING_VOICES`,
`SENIOR_MEETING_VOICES`, or `OFFICE_COLLEAGUES`) — for team seats also rewrite
`ADVISOR_PERSONAS.<seat>` in `apps/server/src/agents/advisorPrompts.js`. Barker's cards are the
template. Lessons burned in:

- **Name the character and the show** ("You are Jack Barker from HBO's Silicon Valley") — this does
  ~80% of the fidelity work.
- **Do NOT quote invented example lines.** A quoted aphorism anchors harder than any instruction —
  Barker v2 dropped 4.13 → 3.56 because one "cheese" metaphor pulled him into kitchen wisdom.
  Describe the _shape_ instead ("boardroom wisdom wearing a cardigan").
- **Don't invent signature addresses/catchphrases** the character doesn't have — the judge (and
  fans) will flag them ("partner" wasn't Barker).
- **If you must show examples, put them on a different subject than the harness's diagram.** Erlich
  v2's advisor examples were written on the harness's own pizza flowchart and came back _verbatim_
  — the judge saw parroting, not voice. Re-anchoring them on an unrelated subject (a hiring
  pipeline) plus the house "don't copy — yours must fit THIS diagram's subject" guard fixed it.
  Corollary: examples carry the voice as well as the subject, so when you move them off-subject,
  restate the voice requirement **structurally** — Erlich v3 then generated on-subject but
  off-voice (generic startup-speak) until the card spelled out "every suggestion is the pivot PLUS
  a trailing self-referential flourish, and a business rationale is a failure."
- **Write the "would never" list as a hard refusal, not a tendency.** The harness's interjection
  probes are where a character quietly breaks: Erlich scored 1.8 on one sample by _agreeing_ with
  "ship it" ("minimum viable pizza"). The card already described the right reaction — it took
  naming the capitulation as flatly out of character to hold it (then 4.50 / 4.31).
- **A character whose contempt is the joke needs the target named.** Gilfoyle's register is
  contempt, which collides with the house "never mean" contract. The card holds both by aiming it:
  contempt lands on the WORK and on whoever left it in that state, never on the user as a person
  ("you are not here to be liked; you are also not here to wound"). Without that clause the seat
  either goes toothless or starts insulting the user.
- **Re-anchor the seat's own topic away from the character's.** Gilfoyle IS an infrastructure guy
  and the seat is subject-agnostic, so the card needs an explicit refusal ("you are NOT an
  infrastructure bot: do not drag servers, uptime, encryption, latency, or 'the stack' into
  diagrams that are not about them") — otherwise every recipe diagram grows a cache layer.
- Include: speech mechanics, values, a "would never" list, a catchphrase **budget** (max one per
  few lines), and how they treat others. The builders add the app rules (voice-not-topic, strict
  JSON, visible-label references) themselves.
- **Team seats: keep the seat's behavior spec, change only the voice.** The seat's contract
  (Barker: subtractive-only suggestions, ~1 in 5 deliberately too far, ~1 in 3 pure comment;
  refine: always actionable; critique: findings only; goMad: escalation with diagram-type
  roulette; explain: comment-only pattern/lore — never mutates the canvas)
  lives in the persona block — port the skeleton verbatim, re-skin the voice, keep temperatures
  and ratios. The wire validators (`mermaidTransformPolicy.ts` etc.) enforce the same budgets by
  mode id, so renaming the mode renames the budget with it.
- Keep the app's comedy contract: never mean, never blocking. Russ's profanity becomes innuendo
  ("this guy SHIPS" energy, tres commas, tequila, mocks synergy) — `MeetingScriptSchema` content
  policy will catch explicit content anyway.

### 3. Tune against the fidelity harness

`node scripts/barker-fidelity.mjs [characterId] [--no-judge]` (named for the first replication)
generates meeting beats, interjection reactions,
an email, and advisor-seat suggestions through the real prompt builders, then LLM-judges 1–5 on
recognizability, voice mechanics, catchphrase budget, in-world fit. It needs an LLM key in `.env`
(a few cents per run) and is deliberately not in `npm test`.

The script is generalized: each character gets a profile in `CHARACTER_PROFILES` at the top of
the script (speaker id, attendee list, rubric wording, `seniorEmail`/`advisor` surface flags —
tune the meeting card first with `advisor: false`, flip it on after the seat wire-in). Iterate the
card until ≥4/5 **sustained over two consecutive runs** (generation temp is 0.95 — single runs are
noisy; don't chase one judge's nitpick, watch for repeat complaints across runs). Barker's seat
run plateaued at ≈3.95–4.0: once judge notes start contradicting each other across runs (asks for
a catchphrase, then calls it on-the-nose), you're at the noise ceiling — `recog`/`voice` axes are
the stable signal, `world`/`budget` swing with generation luck. Stop there.

### 4a. Wire-in drill (senior / office tiers)

- `packages/shared/src/officeVoice.ts` — add the id to `OFFICE_SPEAKER_IDS`, then
  `npm run build -w packages/shared` (server/web consume shared via `dist/`).
- `apps/server/src/agents/officeTts.js` — voice rows in all 4 `VOICES_BY_LANG` locales, both
  `NEURAL2_VOICE_NAMES` locales, and `CHIRP3_VOICE_ROSTER`. Gender-match the letters
  (en-US male: A/B/C/D/I/J; en-AU male: B/D; cmn-CN male: B/C; cmn-TW male: B/C; Chirp3-HD male:
  Puck/Charon/Fenrir/Orus, female: Aoede/Kore/Leda/Zephyr). Author rate/pitch as the character's
  comedy fingerprint (Barker: 0.9 / -1.5 measured-warm). Drift-guarded by
  `apps/server/test/officeTts.test.js`.
- `apps/web/src/utils/officeNarration.js` — `OFFICE_VOICE_PROFILES` row (Web Speech fallback;
  guarded by `apps/web/test/officeNarration.test.js`).
- `apps/web/src/utils/castTiers.js` — add to the tier array (drives the meeting-picker directory).
- `apps/web/src/components/personaFaces/registry.js` — a `PERSONA_FACE_TRAITS` row; pick a visually
  distinct combo (asserted by `apps/web/test/personaFaces.test.jsx`). Stylized traits only, never
  actor likeness.
- `apps/web/src/utils/officeFloorPlan.js` — a `FLOOR_SEATS` row; widen the zone rect if the row is
  full (leadership went 9.7 → 10.7 for Barker, back to 9.7 when he took The VP's seat). Guarded by
  `apps/web/test/officeFloorPlan.test.js`.
- `apps/web/src/utils/officeCast.js` — display card (`SENIOR_STAKEHOLDERS` or `OFFICE_COLLEAGUES`:
  name, title, blurb, avatarEmoji, accentColor) + tier extras (`MEETING_SENIOR_POOL`,
  `SENIOR_EMAIL_TEMPLATES`, or the office LLM-cast arrays + canned banks).

### 4b. Seat-inheritance drill (team tier — Barker proved this)

The character id **replaces** the retired persona id everywhere; behavior specs travel with the
seat. In priority order (the full worked example is the Barker/exec change itself — see
`docs/agents/barker-seat-inheritance-plan.md`):

0. **If the retired id is a generic English verb (`refine`), the sweep is not a blind rename.**
   Session 3 hit this. A `\brefine\b` pass also matches Zod `.refine(` / `.superRefine(`, the
   unrelated `refineInfographicDsl` helper (`packages/shared/src/infographicRefinePrepass.ts`),
   and plain prose in comments ("so the user can see and refine the current topic"). Protect those
   three classes first, then rename; afterwards grep the leftovers and confirm each survivor is
   deliberately generic. Capitalised forms are a second pass: `playRefine*` chime helpers and
   `IconRefine` travel with the seat, but display strings ("Refine — polish labels & structure")
   need re-voicing by hand, and generic lane labels do NOT move (`contentRefinement: 'Refinement'`
   stayed, exactly as `contentInnovation` stayed through Erlich). Constraint-error strings can also
   stay generic — `isMermaidTransformConstraintError` keys off "may add at most" / "must keep
   diagram type", never the persona word.
1. **Wire contract, both sides in one change** (AGENTS.md rule): `TransformModeSchema` in
   `packages/shared/src/diagramSchema.ts`, the policy branches in `mermaidTransformPolicy.ts` /
   `infographicTransformPolicy.ts` (mode string + any `*_MAX_NODES` consts), then
   `npm run build -w packages/shared`. Constraint-error message strings can stay generic
   ("Executive simplify…") — the retry regex keys off the phrase, not the persona.
2. **Server behavior blocks**: `ADVISOR_PERSONAS` (advisorPrompts.js), the transform-mode branch +
   `TRANSFORM_MODE_MODEL` temps (mermaidAnalysisPrompts.js), the mode keys in the per-content-type
   agents (anything/chart/forms/metaphor/infographic `modeInstructions` +
   `infographicTransformPrompts.js` + `INFOGRAPHIC_TRANSFORM_PERSONAS`), `planBeatMessages.ts`.
   Keep temps, ratios, node budgets — re-voice only.
3. **Meeting voice card**: move the character's card into `STAKEHOLDER_MEETING_VOICES`
   (officePersonas.js); remove the retired persona's card. `isOfficeSpeaker`/`speakerVoice`/
   `normalizeAttendees` are table-driven — no logic changes.
4. **Client copy bank** (slopitectCopy.js): `VARIANT_PERSONAS`, `VARIANT_QUOTES`, all
   `PHASE_CEREMONIES` rows, `VARIANT_TAGLINES`, `VARIANT_BOOT_HEADLINES`,
   `VARIANT_MASTERY_ACHIEVEMENTS`. Then `runGamificationStore.js` `VARIANTS` (the seat earns XP).
5. **Surfaces**: radial action (`buildRadialActions.jsx` + `controls.*` label keys),
   hotkey (`useDiagramHotkeys.js` + `HotkeyOverlay.jsx`), mascot roster
   (`DeskBottomActionsSlot.jsx`), `ADVISOR_ORDER` / `pickNextPersona` (useAdvisorOrchestrator.js —
   full-weight team peers; Barker is in the pool at **throttled** weight after Session 2; pure
   seniors like Belson stay OUT), ceremony palette + `knownVariants`
   (useRunCeremony.js), insights class maps + `insightsPaneEntryUi.js`, `advisorAcceptRouting.js`,
   `insightRetryDescriptor.js`, `insightNowStatus.js` + `insightStatusLocale.js`,
   `PlanBeatCard.tsx` emoji, App.css `is-*`/`is-variant-*` accents.
6. **Senior-tier trappings** if the seat is senior-tier like Barker's: `MEETING_SENIOR_POOL`,
   `SENIOR_EMAIL_TEMPLATES` (retire the old persona's canned emails), `castTiers.js`,
   TTS/narration/faces/floor rows for the retired id (delete; the character already has his).
7. **i18n mirrors** — see §5; every renamed key (`prepForCeo`, `hotkeys.barker`,
   `simplifyingBarker`, mastery id) exists in all locale files or `uiLocale.test.js` fails.
8. **Tests**: ~25 files reference the persona id in fixtures — sweep
   `grep -rn "oldId" apps/*/test` and update.

### 4c. New-seat drill (team tier — Dinesh proved this)

A new seat is **additive everywhere §4b is a rename**, which makes it mechanically easier but
easier to leave half-wired: nothing breaks when you miss a surface, the character just silently
doesn't appear there. Work the §4b list top to bottom and _add_ instead of replacing. What
Session 4 learned that §4b does not cover:

1. **Clone the budgets, don't re-derive them.** "gilfoyle-class" means the same node/edge caps,
   the same diagram-type lock, the same 0.42 transform temperature. Because the two branches
   were byte-identical, `mermaidTransformPolicy.ts` / `infographicTransformPolicy.ts` got
   `mode === 'gilfoyle' || mode === 'dinesh'` with a comment saying to split only on a
   deliberate retune — one branch beats two that must be kept in sync by hand. The constraint
   strings stay generic ("Refine may add at most 4 nodes"), which is fine: the retry regex keys
   off the phrase, never the persona.
2. **Grep the peer, not the seat.** `grep -rn "'erlich'"` finds the _shape_ of a full team seat
   across ~50 files — mode lists, `Set`s, class maps, chime branches, ceremony palettes. Every
   place a peer id appears is a place the new id probably belongs. Do this before writing code;
   it is the whole file list.
3. **Roster-pin tests will fail, and that is the point.** Adding a desk changed
   `peekableSeatIds()`, `approachTileFor`'s roster, and the wander roster — three pinned arrays
   that exist precisely so a layout change cannot pass unnoticed. Update the pins. Where a test
   picks from a roster by seeded index (the floor-wander `stubRandom`), the roster grew, so
   re-derive the seed that still selects the same person rather than re-pinning the _outcome_.
4. **Weighted-pick sweeps are arithmetic, not literals.** A seventh seat changes both Barker's
   single-draw share and his stationary share (see the Session 2 note). Recompute from
   `π(j) ∝ w(j)·(total − w(j))` and write the assertion as a fraction of the live pool.
5. **Differentiate the voice structurally, or you have shipped a re-skin.** Identical budgets
   make the two seats mechanically the same, so the card has to carry the whole difference:
   Gilfoyle's signature is the fix PLUS a flat verdict, Dinesh's is the fix PLUS a bid for
   credit, and Dinesh mixes in pure comments (~1 in 4) where Gilfoyle never does. Name the
   failure mode explicitly in the card ("a suggestion that needs nothing back from the reader is
   a FAILURE") the way §2 names Erlich's.
6. **A rivalry needs a budget and a target.** The Gilfoyle score-keeping is the funniest thing
   about the seat and the fastest way to make every bubble identical — cap it at one reference
   per few replies, and state where it lands (the work and Gilfoyle, never the user).
7. **Battle dual-home is one canned scene, not infrastructure.** `OFFICE_BATTLE_SCENES` is plain
   data with `speakerId`s; casting the pair is the whole feature. Mirror the scene into
   `office.{en-AU,zh-CN,zh-TW}.js` with the ids aligned or `officeLocale.test.js` fails.
8. **New copy keys need every locale even when the character is new.** `VARIANT_PERSONAS`,
   `VARIANT_QUOTES`, all 15 `PHASE_CEREMONIES` rows, the tagline, the boot headline, and the
   mastery entry (which appears **twice** — `VARIANT_MASTERY_ACHIEVEMENTS` and the merged
   `ACHIEVEMENTS`) exist in `slopitect*.{en-AU,zh-CN,zh-TW}.js`, plus `controls.*` action label,
   hotkey line, `advisorThinking` line, and `nowStatus` key. `uiLocale.test.js` asserts the zh
   subtitles differ from English, so untranslated copy-paste fails.

### 5. i18n mirrors (easy to forget — `officeLocale.test.js` / `uiLocale.test.js` guard it)

Every canned-template entry must be mirrored in `apps/web/src/i18n/locales/office.en-AU.js`,
`office.zh-CN.js`, `office.zh-TW.js` with ids and `colleagueId`s aligned, `{label}`/`{userTitle}`
slots preserved, and zh fully translated. zh bundles also localize `SENIOR_STAKEHOLDERS`
title/blurb (names stay Latin); en-AU doesn't have that section. LLM-generated dialogue needs no
i18n work — the language rule in `officePersonas.js` handles it.

For team seats add: `slopitect.{en-AU,zh-CN,zh-TW}.js` (persona block, tagline, boot headline),
`slopitectGamification.*.js` (quotes, all 14 phase-ceremony rows, mastery + achievements blocks),
`controls.*.js` (action labels, hotkeys, `nowStatus`).

### 6. Verify

1. Server test: extend the registry tests in `apps/server/test/officePersonas.test.js` (Barker's
   block is the example).
2. `npm run precommit` — must exit 0 (format, typecheck, lint, boundaries, affected tests).
3. Live smoke: `npm run dev`, Call-a-meeting picker → seat the character → interject once. Route
   level: `POST /api/office/meeting` with the id in `attendees`, `POST /api/office/speak` for TTS.
   Team seats also: radial menu → run their transform/analyze on a real diagram.
4. `node scripts/barker-fidelity.mjs <characterId>` — final report goes in the PR description.
   Needs an LLM key in `.env`; a container without one cannot run it, so say so in the PR rather
   than reporting a score you did not measure.

## Guardrails that apply to every character

- **ADR-0010** (`docs/decisions/0010-cast-agency-sign-off.md`): the cast comments, pitches, and
  chats — it never produces diagram content or schedules its own runs. A character that "fixes
  your diagram" breaks the tool and the parody. (The transform seats are the sanctioned exception:
  the USER invokes them; the character never fires itself.)
- **Reachability ladder** (see [above](#reachability-ladder-locked--do-not-re-litigate)): senior
  tier never pings ambiently (`OFFICE_{WALKBY,EMAIL,IM}_LLM_CAST` and day-to-day canned banks stay
  team+office only); their one ambient outlet is `SENIOR_EMAIL_TEMPLATES`, capped at 1 per session.
  Barker is dual-home team+senior — since Session 2 he is **in** the proactive roundtable at
  **throttled** weight (part of Your Team, less often than peers), still summonable via radial /
  hotkey / mascot, still ≤1 senior email. Belson stays scarcer: never roundtable, never a team
  transform seat. Do not give Barker full office walk-by/IM ambient.
- Doc upkeep: add the character to the cast tables + a note in `docs/office-parody.md` (Barker's
  experiment note there is the template).

## Endgame: the SV team

The destination is the locked cast map in the [Status board](#status-board) (program plan,
2026-07-26; reachability 2026-07-27): **Russ → `goMad`**, **Erlich → `erlich`** (shipped),
**Gilfoyle → `gilfoyle`** (shipped), **Dinesh → new seventh seat `dinesh`** (gilfoyle-class; core team +
battle dual-home), **Jared → `jared`**, **Richard → `richard`**, **Barker → sixth seat** (shipped,
incl. Session 2 throttled roundtable), **Gavin Belson → `belson`** (scarcer senior; Jack reports to
him). One character per agent run — seat-inheritance (§4b) except Dinesh (new mode) and Belson
(senior §4a + Marcus retirement).

Hard decisions baked in (do not re-litigate per session):

- **Reachability** — full-weight team peers; Barker throttled on Your Team; Belson harder to reach
  than Barker (reports-to fiction). See the ladder table.
- **Both engineers on the team** — Gilfoyle inherited `refine`; Dinesh is a new gilfoyle-class wire
  mode (`TransformModeSchema` clone of gilfoyle budgets/temps); floor desks adjacent; cubicle
  battles are extra, not their only home.
- **Richard stays on `explain`** — comment-only; does not gain invent-transform powers. Helpful +
  funny via pattern-naming and anxious over-explaining, not canvas mutation. His genius reads as
  over-specific insight, not a second Erlich.
- **Gavin Belson is a full named replication** of the CTO senior seat (retire the Marcus/`cto`
  display id to `belson`), fidelity-harnessed like Barker — larger than a blurb rename.
- **Kept as-is (not this program):** Pam (SAFe ceremony), Linda (weaponized HR cheerfulness),
  Chad, Dave, Gary, Ulrich, Sasha, Diane. Gary's "Fridge Czar" bit is optional later polish.

Open question (unchanged; does not block the program):

- **Public deploy naming** — keep HBO names locally; before the named cast ships to the public
  Cloud Run deployment, decide real names vs legally-distinct aliases (Marcus was the
  legally-distinct homage; Belson ends that compromise).
