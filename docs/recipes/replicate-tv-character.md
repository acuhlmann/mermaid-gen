# Recipe: replicate a TV character as an office cast member

Playbook for the Silicon Valley character program: how one named character gets replicated into the
office cast, proven out with Jack Barker (shipped 2026-07-25, fidelity ≈ 4.2/5 sustained). Use this
for the remaining characters — Richard, Erlich, Gilfoyle, Dinesh, Russ — and any future guest cast.

## Status board

| Character      | Target tier / seat       | Status                                                      |
| -------------- | ------------------------ | ----------------------------------------------------------- |
| Jack Barker    | senior (`barker`)        | ✅ Shipped — meetings, senior emails, TTS, face, floor desk |
| Russ Hanneman  | senior or goMad skin     | ⬜ Next candidate — highest-risk voice (profanity, chaos)   |
| Erlich Bachman | senior or innovate skin  | ⬜                                                          |
| Gilfoyle       | office (battle surfaces) | ⬜ Pair with Dinesh — their bickering IS the content        |
| Dinesh         | office (battle surfaces) | ⬜ Pair with Gilfoyle                                       |
| Richard        | refine skin (defer)      | ⬜ Best done via the team-seat refactor — he IS the builder |

Note: **the user is basically Richard** — the fiction casts you as the anxious builder the office
keeps interrupting. Richard-as-a-seat only makes sense once team seats are skinnable (see
[Endgame](#endgame-team-seat-skins)).

## The method (voice card → harness → wire-in)

The experiment proved named-character replication works because the LLM already knows the show.
The craft is the voice card; the harness proves it; the wire-in is a mechanical ~10-file drill.

### 1. Pick the tier (decides the touch list)

- **senior** (Barker, Russ, Erlich): steering meetings + ≤1 canned email/session. Smallest surface,
  richest dialogue. Add to `SENIOR_MEETING_VOICES` + `SENIOR_STAKEHOLDERS` + `MEETING_SENIOR_POOL` +
  `SENIOR_EMAIL_TEMPLATES`.
- **office** (Gilfoyle, Dinesh): emails, IMs, walk-bys, coffee, **cubicle battles**. Bigger drill:
  `OFFICE_COLLEAGUES` (server + client), the `OFFICE_{WALKBY,EMAIL,IM}_LLM_CAST` arrays, canned
  template banks, `canJoinMeetings`. Pick this when the character lives in the day-to-day.
- **team** (Richard, Erlich-as-CIO, Russ-as-goMad): NOT a drill — those ids drive real agent
  behavior (`ADVISOR_PERSONAS` in `apps/server/src/agents/advisorPrompts.js` + the radial menu).
  Don't replace them; wait for seat skins ([Endgame](#endgame-team-seat-skins)).

### 2. Write the voice card (server, the core artifact)

Add the entry in `apps/server/src/agents/officePersonas.js` (`SENIOR_MEETING_VOICES` or
`OFFICE_COLLEAGUES`). Barker's card is the template. Lessons burned in:

- **Name the character and the show** ("You are Jack Barker from HBO's Silicon Valley") — this does
  ~80% of the fidelity work.
- **Do NOT quote invented example lines.** A quoted aphorism anchors harder than any instruction —
  Barker v2 dropped 4.13 → 3.56 because one "cheese" metaphor pulled him into kitchen wisdom.
  Describe the _shape_ instead ("boardroom wisdom wearing a cardigan").
- **Don't invent signature addresses/catchphrases** the character doesn't have — the judge (and
  fans) will flag them ("partner" wasn't Barker).
- Include: speech mechanics, values, a "would never" list, a catchphrase **budget** (max one per
  few lines), and how they treat others. The builders add the app rules (voice-not-topic, strict
  JSON, visible-label references) themselves.
- Keep the app's comedy contract: never mean, never blocking. Russ's profanity becomes innuendo
  ("this guy SHIPS" energy, tres commas, tequila, mocks synergy) — `MeetingScriptSchema` content
  policy will catch explicit content anyway.

### 3. Tune against the fidelity harness

`node scripts/barker-fidelity.mjs [--no-judge]` generates meeting beats, interjection reactions,
and an email through the real prompt builders, then LLM-judges 1–5 on recognizability, voice
mechanics, catchphrase budget, in-world fit. It needs an LLM key in `.env` (a few cents per run)
and is deliberately not in `npm test`.

The script is Barker-tuned: generalize by parameterizing the speaker id, attendee list, and the
rubric paragraph at the top (or copy it per character — fine for a handful of runs). Iterate the
card until ≥4/5 **sustained over two consecutive runs** (generation temp is 0.95 — single runs are
noisy; don't chase one judge's nitpick, watch for repeat complaints across runs).

### 4. Wire-in drill (every tier)

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
  full (leadership went 9.7 → 10.7 for Barker). Guarded by `apps/web/test/officeFloorPlan.test.js`.
- `apps/web/src/utils/officeCast.js` — display card (`SENIOR_STAKEHOLDERS` or `OFFICE_COLLEAGUES`:
  name, title, blurb, avatarEmoji, accentColor) + tier extras (`MEETING_SENIOR_POOL`,
  `SENIOR_EMAIL_TEMPLATES`, or the office LLM-cast arrays + canned banks).

### 5. i18n mirrors (easy to forget — `officeLocale.test.js` guards it)

Every canned-template entry must be mirrored in `apps/web/src/i18n/locales/office.en-AU.js`,
`office.zh-CN.js`, `office.zh-TW.js` with ids and `colleagueId`s aligned, `{label}`/`{userTitle}`
slots preserved, and zh fully translated. zh bundles also localize `SENIOR_STAKEHOLDERS`
title/blurb (names stay Latin); en-AU doesn't have that section. LLM-generated dialogue needs no
i18n work — the language rule in `officePersonas.js` handles it.

### 6. Verify

1. Server test: extend the registry tests in `apps/server/test/officePersonas.test.js` (Barker's
   block is the example).
2. `npm run precommit` — must exit 0 (format, typecheck, lint, boundaries, affected tests).
3. Live smoke: `npm run dev`, Call-a-meeting picker → seat the character → interject once. Route
   level: `POST /api/office/meeting` with the id in `attendees`, `POST /api/office/speak` for TTS.
4. `node scripts/barker-fidelity.mjs` (or its successor) — final report goes in the PR description.

## Guardrails that apply to every character

- **ADR-0010** (`docs/decisions/0010-cast-agency-sign-off.md`): the cast comments, pitches, and
  chats — it never produces diagram content or schedules its own runs. A character that "fixes
  your diagram" breaks the tool and the parody.
- Senior tier never pings ambiently (`OFFICE_{WALKBY,EMAIL,IM}_LLM_CAST` and the day-to-day canned
  banks stay team+office only); their one ambient outlet is `SENIOR_EMAIL_TEMPLATES`, capped at 1
  per session.
- Doc upkeep: add the character to the cast tables + a note in `docs/office-parody.md` (Barker's
  experiment note there is the template).

## Endgame: team-seat skins

The user's destination is "choose your own team": SV characters in the five team seats, unchosen
characters demoted to office participants, a default team preserved. Today seat and character are
the same id, fused across `CAST_TIERS`, `VARIANT_PERSONAS` (`apps/web/src/utils/slopitectCopy.js`),
`ADVISOR_PERSONAS` (`apps/server/src/agents/advisorPrompts.js`), TTS tables, i18n, floor, faces,
and the canned banks — and team ids drive real agent behavior (transform/analyze flows), so a
naive "rename the persona" change hits the product's core, not just the ambience layer.

The shape that works: split **seat** (functional role: builder=refine, innovator=innovate,
chaos=goMad, auditor=critique, sage=explain — keeps the agent behavior) from **character** (skin:
voice card, display data, face, TTS fingerprint — swappable per seat, persisted as a user setting).
Natural mapping: Richard→refine, Erlich→innovate, Russ→goMad, Gilfoyle→critique, Dinesh→snark
seat TBD (weakest fit for explain's sage voice), Barker→exec (senior, presenting-to dynamic —
already shipped). Design that when at least one more replication has landed; do not pre-build it.
