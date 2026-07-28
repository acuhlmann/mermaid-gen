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
— the first run that is _not_ an inheritance, so §4c is the drill it produced. Sessions 2–4 all
shipped **without a fidelity measurement** (no LLM key in those containers); a follow-up pass on
2026-07-27 ran the harness against a local `.env`, confirmed Gilfoyle, re-tuned Dinesh onto the
bar, and closed the deferred live smokes — see [Measured baselines](#measured-baselines). The same
pass added **§1b, the tendency axis**: voice alone had left the two engineers doing one job in two
accents, so each seat now also has a documented instinct for _what kind_ of change it reaches for.
Proven a sixth time with **Jared Dunn inheriting the `critique` seat** (Session 5, 2026-07-28,
`critique` → `jared`) — the first **analyze-path** inheritance (`DiagramAnalyzeSchema.kind`, not
`TransformModeSchema`). Proven a seventh time with **Russ Hanneman inheriting the `goMad` seat**
(Session 6, 2026-07-28, `goMad` → `russ`) — subject-rooted escalation with tres-commas / tequila /
"this guy SHIPS" energy; content-policy-safe innuendo (not profanity); depth/streak wire field
renamed `russDepth` / `russStreak`. Proven an eighth time with **Richard Hendricks inheriting
the `explain` seat** (Session 7, 2026-07-28, `explain` → `richard`) — comment-only analyze-path
inheritance (ADR-0010); anxious pattern-naming; dumb-down ladder travels with the seat. The cast
map and **reachability ladder** below are **locked** (2026-07-26 program plan; reachability
2026-07-27) — one character per agent session, in the order listed.
**Next up: Session 8, Gavin Belson inherits the `cto` seat (retires Marcus).**

## Status board

| Character         | Target seat / tier                       | Status                                                                                                                                                          |
| ----------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jack Barker       | team+senior — 6th advisor (`barker`)     | ✅ Shipped — advisor seat + Session 2 throttled roundtable (part of team, less often than peers)                                                                |
| Erlich Bachman    | team — `erlich` (ex-`innovate`)          | ✅ Shipped — seat inheritance; courageous pivots, incubator swagger                                                                                             |
| Bertram Gilfoyle  | team — `gilfoyle` (ex-`refine`)          | ✅ Shipped — seat inheritance; deadpan verdicts, always actionable; battle-eligible (dual-home). Draws what is **already true** (§1b). Fidelity **4.50 / 4.38** |
| Dinesh Chugtai    | team — **new** `dinesh` (gilfoyle-class) | ✅ Shipped — new seventh seat (not an inheritance); correct fix + a bid for credit; battle dual-home. Draws what **will break** (§1b). Fidelity **4.00 / 4.19** |
| Jared Dunn        | team — `jared` (ex-`critique`)           | ✅ Shipped — seat inheritance; findings-only analyze seat; anxious compliance. First analyze-path inheritance. Fidelity **4.63 / 4.75**                         |
| Russ Hanneman     | team — `russ` (ex-`goMad`)               | ✅ Shipped — seat inheritance; subject-rooted escalation; tres commas / tequila / SHIPS. Depth field `russDepth`. Fidelity **4.81 / 5.00**                      |
| Richard Hendricks | team — `richard` (ex-`explain`)          | ✅ Shipped — seat inheritance; comment-only analyze; anxious pattern-naming (ADR-0010). Dumb-down travels with seat.                                            |
| Gavin Belson      | senior — `cto` → `belson`                | ⬜ Session 8 — named CTO; scarcer than Barker; Jack reports to him; retires Marcus                                                                              |
| Marcus            | senior — `cto`                           | 🚮 Retires when Belson lands — currently a Belson _homage_, not a replication                                                                                   |

Session 0 locked the map; the fidelity harness (§3) is generalized — one profile per character,
reused every session. Each character session ends with registry/TTS/locale tests green,
`npm run precommit`, live smoke, and the fidelity report in the PR body.

### Measured baselines

Scores are `node scripts/barker-fidelity.mjs <id>` overall averages across the 4 judged surfaces,
two consecutive runs, Vertex fast tier. **Treat these as the reference band, not a target to beat**
— the axes are noisy above ~4.3 (see §3).

| Character  | Runs            | Notes                                                                                                  |
| ---------- | --------------- | ------------------------------------------------------------------------------------------------------ |
| `gilfoyle` | **4.50 / 4.38** | Passed as shipped in Session 3 (4.50 / 4.63); unchanged by the §1b tendency split.                     |
| `dinesh`   | **4.00 / 4.19** | As shipped **3.81 / 4.25**; re-tuned to **4.50 / 4.31**; §1b's tendency split settled him at ~4.0–4.2. |
| `barker`   | ≈3.95–4.0       | Session 1 plateau; unchanged since (Session 2 was picker plumbing, no voice card touched).             |
| `erlich`   | 4.50 / 4.31     | Carried over from the card iteration recorded in §2; not re-measured on 2026-07-27.                    |
| `jared`    | **4.63 / 4.75** | Session 5 (2026-07-28); first analyze-path inheritance. Sustained well above bar.                      |
| `russ`     | **4.81 / 5.00** | Session 6 (2026-07-28); DeepSeek fast tier. Sustained well above bar.                                  |
| `richard`  | **4.75 / 4.63** | Session 7 (2026-07-28); DeepSeek fast tier. Sustained well above bar.                                  |

A session that cannot run the harness must say so in the PR (Sessions 2–4 correctly did) and leave
the row blank rather than assert a score — but the row is then **not** done. Budget ~4 minutes and a
few cents per run; two runs per candidate card, so a re-tune cycle is ~6 runs.

Dinesh is the one seat deliberately parked **at** the bar rather than above it: the §1b tendency
split is worth more than the last third of a point (see the reinforce-vs-compete finding there).
Treat a `dinesh` run in the 3.9–4.3 band as expected, not as a regression to chase — his variance is
almost entirely the advisor surface, where the 80-char cap makes the fix, the tendency and the
credit bid compete. If you need headroom for a future change, buy it from that cap, not from his
voice card.

### Reachability ladder (locked — do not re-litigate)

| Who                                                                        | How you reach them                          | Frequency                                                                                                                                          |
| -------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full-weight team advisors (Erlich, Gilfoyle, Dinesh, Jared, Russ, Richard) | Roundtable + radial / hotkey / mascot       | Peer weight in `pickNextPersona`                                                                                                                   |
| **Jack Barker**                                                            | Same Your Team surfaces                     | **Throttled** — in `ADVISOR_ORDER` at `ADVISOR_PICK_WEIGHTS.barker` = 0.5 (~half as often as a peer). ≤1 senior email/session. No walk-by/IM spam. |
| **Gavin Belson** (ex-Marcus)                                               | Steering meetings + ≤1 senior email/session | **Scarcer than Barker** — never proactive roundtable, never a team transform seat. Fiction: Barker reports to him.                                 |

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
   (radial: after `russ`, before `critique`; roster: last, under "Upstairs"), so no reorder.
5. `castTiers.js` deliberately **not** changed — `barker` stays a single-tier `senior` tag
   (`tierOf` is first-match and the meeting directory iterates the tiers, so a second membership
   would double him in the picker). Roundtable membership is `ADVISOR_ORDER`'s job; the tier
   table's comment now says so.
6. Verified with `npm run check:affected` + the smoke below.

Note: **the user is basically Richard** — the fiction casts you as the anxious builder the office
keeps interrupting. Richard-the-advisor (`richard`, ex-`explain`) is your alter-ego Wise Architect giving
comment-only advice, not a second "you" — which is very Richard. No skinnable-seat machinery is
needed: each character replaces the generic persona id wholesale, the way Barker replaced `exec`.
**Dual-home comedy:** Gilfoyle and Dinesh stay eligible for cubicle battles / office distraction
set pieces (same pattern as Barker living in senior + advisor). Team seats stay non-claimable as
Acting roles.

## The method (voice card → harness → wire-in)

Named-character replication works because the LLM already knows the show. The craft is the voice
card; the harness proves it; the wire-in is a mechanical drill whose size depends on the tier.

### 1. Pick the tier (decides the touch list)

- **team** (Erlich→innovate→`erlich`, Gilfoyle→refine→`gilfoyle`, Jared→critique, Russ→russ, Richard→explain): the
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

### 1b. What the seat DOES to the diagram (the tendency axis)

Voice alone does not make two seats different. Every transform seat also has a **tendency** — the
kind of change it reaches for first when you ask it for help. Locked 2026-07-27:

| Seat         | Reaches for first                                                                                             | Net effect                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Barker**   | what will not fit the slide                                                                                   | **shrinks** it                                  |
| **Gilfoyle** | what is **already true and undrawn** — the dependency nobody admitted, the node quietly doing two jobs        | grows it                                        |
| **Dinesh**   | what **has not survived contact** — the failure branch, unowned handoff, ambiguous trigger, biting ordering   | grows it                                        |
| **Erlich**   | the bolder shape nobody proposed                                                                              | restructures it                                 |
| **Jared**    | process and accountability gaps — who owns the step, what happens when it fails, whether the handoff is named | **findings only** (analyze; no canvas mutation) |
| **Russ**     | escalation rooted in the subject                                                                              | anything                                        |
| **Richard**  | the named pattern / over-specific insight hiding in a visible label                                           | **comment only** (analyze; no canvas mutation)  |

Both engineers grow the diagram; Barker is the only one who shrinks it. The two engineers are
separated **only** by this axis — they deliberately share budgets, temperature and one policy
branch, so without it they are one seat with two names. Gilfoyle invents nothing (the drawing is
lying, he corrects it); Dinesh draws what happens when reality misbehaves, because he is the one
who gets paged. Each card names the other seat so the model has the contrast, not just its half.

**Write it as a tendency, never a rule.** Each card ends the block with "a tendency, not a rule you
obey" plus an escape hatch to any other correct small fix. The hard caps stay in
`mermaidTransformPolicy.ts` / `infographicTransformPolicy.ts`, which the two engineers still share.

Two failure modes this introduced, both measured (see §3):

- **A narrow pole loops on a thin diagram.** The harness fixture has one decision node, so Dinesh's
  first cut ("what is missing") collapsed to _"Add 'No X' path"_ three times running, and the score
  fell 4.31 → 3.81. The escape hatch has to say that a gap you already named counts as **covered**,
  and the pole itself has to span several move types (branches, owners, orderings, labels) with an
  explicit "VARY THE FIX, not only the bid".
- **Content instructions crowd out voice.** Adding ~100 words of what-to-fix ahead of the card's
  `STRUCTURE` block cost Dinesh a full point before any of it was wrong — the voice simply lost
  salience. Keep the tendency block short (~50 words), and keep each rule adjacent to what it
  governs (the "rotate the bid" rule belongs under the rotation list, not in the closing paragraph).

**A tendency is free when it reinforces the seat's signature and costs fidelity when it doesn't.**
This is the finding to carry into Sessions 5–8. Gilfoyle's signature is _a flat verdict on the state
the work was left in_, and "what is already true and undrawn" IS a verdict — the two say the same
thing, so his score never moved (4.50 → 4.50 / 4.38). Dinesh's signature is _a bid for credit_,
which is orthogonal to "what will break": inside an 80-character suggestion the two compete for the
same words, and he settled ~0.3–0.4 lower (4.50 / 4.31 before, straddling 4.0 after). **Before
assigning a tendency, check whether it restates the seat's structural signature or competes with
it.** If it competes, expect to pay, and decide deliberately: the differentiation is worth more than
the last third of a fidelity point, because two seats scoring 4.4 that behave identically are one
seat with two names. Levers if you want it back: put the tendency only on the transform surface
(which has prose room and no character cap), or raise the per-seat `MAX 80 characters` cap in
`COMMON_RULES` so the fix, the kind and the bid all fit.

Surfaces to update when you change a tendency: `ADVISOR_PERSONAS` (advisorPrompts.js), the
transform branch in `mermaidAnalysisPrompts.js`, `INFOGRAPHIC_TRANSFORM_INSTRUCTIONS` +
`INFOGRAPHIC_TRANSFORM_PERSONAS`, the `modeInstructions` map in each of the anything / chart /
forms / metaphor agents, and the `hotkeys.*` description in all four `controls.*` locales (that
line is the user's only advance notice of what the seat will do).

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
- **Never ration a signature that has no detachable prop.** The template's closing line ("at most
  ONE prop per few replies and usually none — props, in order of preference: …") works for Gilfoyle
  and Erlich because their props really are removable garnish (Satanism, Canada; Aviato, Jobs) —
  delete them and the voice survives. Dinesh's card copied that line and filled it with three items
  that were _already_ the mandatory `STRUCTURE` rotation, so the same card called the bid required
  every reply **and** capped at "usually none". The model resolved the contradiction by never using
  the capped slots and repeating the one uncapped slot, which the judge scores as a budget failure —
  the axis punishes "zero flavor" and repetition exactly as hard as catchphrase salad, so it sat at
  3/5 on every sample while `recog`/`voice`/`world` all read 4–5. **Test before you write the line:
  is there a prop you could delete and still have the character?** If not, say so explicitly ("you
  have NO detachable catchphrase — the bid IS your signature and never counts against a budget") and
  ration _repetition_ instead ("do not reuse the same bid shape twice in a row").
- **Off-subject examples protect the fix half of a line, not the signature half.** The parroting
  guard above (move examples off the harness's subject) only re-anchors the part of the sample that
  _has_ a subject. In a two-part line — concrete fix PLUS a trailing signature clause — the clause is
  subject-independent, so it survives the subject swap and comes back verbatim: Dinesh's samples sat
  on a bike-repair co-op, yet "Yes, I checked all of them" returned word-for-word on a pizza diagram.
  Label the clause as shape rather than wording ("the trailing bid clause illustrates a SHAPE, not
  supplying wording: never reuse one of these clauses verbatim").
- **A comment-only seat must still be told which JSON field to fill.** `ALWAYS emit kind: "comment".
Never kind: "suggestion".` reads to the model as _never emit the word "suggestion"_, so it renames
  the envelope field to `"comment"` — and `parseAdvisorReply` drops any reply without a `suggestion`
  field. The seat then never speaks, silently, at full LLM cost. Every comment-capable card carries
  the re-anchor ("the text still goes in the `suggestion` field; `kind` is the only difference");
  `explain` was missing it and was dead in the roundtable until 2026-07-27. Pinned by
  `apps/server/test/advisorPrompts.test.js`. **Session 7 inherits this seat — verify it speaks before
  blaming Richard's new voice card.**
- Include: speech mechanics, values, a "would never" list, a catchphrase **budget** (max one per
  few lines), and how they treat others. The builders add the app rules (voice-not-topic, strict
  JSON, visible-label references) themselves.
- **Team seats: keep the seat's behavior spec, change only the voice.** The seat's contract
  (Barker: subtractive-only suggestions, ~1 in 5 deliberately too far, ~1 in 3 pure comment;
  refine: always actionable; critique: findings only; russ: escalation with diagram-type
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

### 4a-bis. Don't let a later session silently delete an earlier character's tests

A hazard the program hit twice by 2026-07-27, worth one paragraph because it is invisible when it
happens. Character sessions all edit the **same** small set of fixture files
(`mermaidTransformPolicy.test.ts`, `infographicTransformPolicy.test.ts`, `planBeatMessages.test.js`,
`officePersonas.test.js`, `diagramSchema.test.ts`). Sessions 3 and 4 rewrote the regions where PR
#233 had added Erlich's only policy/plan-beat/meeting-voice coverage, so main ended up with **zero**
`erlich` assertions in all four files while every test still passed — a widened Erlich budget or a
dropped Aviato anchor would have gone unnoticed. Recovered 2026-07-27 (PR #233 closed as ported).

When you finish a session, run `grep -rn "<previous character id>" apps/*/test packages/*/test` for
**every** already-shipped character and confirm each still has: a policy-budget test, a wire-enum
entry, and a meeting-voice assertion. Adding your character's tests next to theirs is the goal —
replacing theirs is the failure. If an open PR touches these files, port it before it rots: a test
PR written against the pre-rename world will conflict, and conflicts are usually resolved by taking
whichever side is newer, which is exactly how the coverage got dropped.

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
6. **A rivalry needs a target and a _shape_ — budget it per surface, not globally.** The Gilfoyle
   score-keeping is the funniest thing about the seat and the fastest way to make every bubble
   identical, so state where it lands (the work and Gilfoyle, never the user). But the original
   "cap it at one reference per few replies" was measured wrong in the 2026-07-27 re-tune: a
   multi-beat **meeting** does want one-per-scene, while on the **advisor** seat the rivalry is one
   slot of the mandatory bid rotation and capping it there starved the rotation (see the
   detachable-prop lesson in §2). What actually moved the score was specifying the shape: the jab is
   Dinesh measuring _up_ at Gilfoyle and still going unnoticed, never a clean put-down from above —
   "a jab that costs you nothing is his register, not yours." Both judge complaints ("too direct a
   jab" and "needs more Gilfoyle") were the same defect, and the shape rule fixed both.
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
   Team seats also: radial menu → run their transform/analyze on a real diagram. Route-level smoke
   without a browser (what the 2026-07-27 pass used):

   ```bash
   # meeting + TTS (expects beats from the id; audio.audioBase64 non-empty; retired id 400s)
   curl -sX POST localhost:4000/api/office/meeting -H 'content-type: application/json' \
     -d '{"attendees":["scrumMaster","<id>","cto"],"diagramSource":"flowchart TD\n A --> B","visibleLabels":["A","B"]}'
   curl -sX POST localhost:4000/api/office/speak -H 'content-type: application/json' \
     -d '{"speakerId":"<id>","text":"one line"}'
   # the advisor seat actually speaks (catches a card that never parses — see §2)
   curl -sX POST localhost:4000/api/advisor/suggest -H 'content-type: application/json' \
     -d '{"persona":"<id>","diagramSource":"flowchart TD\n A --> B","visibleLabels":["A","B"]}'
   # transform: sync the source into the slot first, then send the returned revisionId
   curl -sX POST localhost:4000/api/copilotkit/state -H 'x-session-id: smoke' -H 'content-type: application/json' \
     -d '{"contentType":"mermaid","diagramSource":"flowchart TD\n A --> B"}'
   curl -sX POST localhost:4000/api/copilotkit/transform -H 'x-session-id: smoke' -H 'content-type: application/json' \
     -d '{"revisionId":1,"contentType":"mermaid","mode":"<id>","diagramSource":"flowchart TD\n A --> B"}'
   ```

   `/suggest` returning `{"suggestion": null}` is a **parse failure**, not an empty opinion — the
   route falls back to null whenever `parseAdvisorReply` rejects the reply. Never read it as "the
   seat had nothing to say"; run every seat in `ADVISOR_ORDER` through it once per session.

4. `node scripts/barker-fidelity.mjs <characterId>` — final report goes in the PR description, and
   the [Measured baselines](#measured-baselines) row gets the numbers. Needs an LLM key in `.env`;
   a container without one cannot run it, so say so in the PR rather than reporting a score you did
   not measure — then the character is **not** done, and the next session with a key owes the
   measurement before starting its own character (that debt is what the 2026-07-27 pass paid off for
   Sessions 2–4).

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
2026-07-26; reachability 2026-07-27): **Russ → `russ`** (shipped, ex-`goMad`), **Erlich → `erlich`** (shipped),
**Gilfoyle → `gilfoyle`** (shipped), **Dinesh → new seventh seat `dinesh`** (gilfoyle-class; core team +
battle dual-home), **Jared → `jared`** (shipped), **Richard → `richard`** (shipped, ex-`explain`), **Barker → sixth seat** (shipped,
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
