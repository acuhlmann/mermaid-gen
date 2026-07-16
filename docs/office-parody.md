# The Office Update™ — office-parody ambience layer

> Design + roadmap for making archislop feel like working inside a parody corporate-IT office:
> emails, instant messages, walk-bys, coffee breaks, and working-group meetings, delivered by a
> cast of fictional colleagues who mix meaningless smalltalk with occasionally-useful input about
> the user's actual diagram.

## 1. Vision & tone

archislop already ships an enterprise-parody **cast** (the six Stakeholders) — but a cast without a
workplace. The office layer builds the workplace around the user: the diagram is the thing the
office keeps interrupting you about. Comedy rules:

- **Comedy from specificity.** The best moments reference the user's actual node labels ("the
  fridge email" is funny; "the fridge email about _Bake → Slice_" is funnier).
- **Chaos with accidental competence.** Roughly 1 in 3 moments says something genuinely useful
  about the diagram (advisor-style "voice, not topic" rule); the rest is pure office noise. The
  useful ones are what make the parody land.
- **Never mean, never blocking, always dismissible.** Every surface has an ✕, an escape hatch, and
  a hard cap. "Focus Time" mutes the whole office.
- **Degrade in-fiction.** Offline / LLM-less sessions still get canned office noise; a failed
  meeting becomes a cancellation email ("Rescheduled to: never."), not an error toast.

## 2. Systems map

The office layer is a **fourth character system**, orthogonal to the existing three:

| System                            | Cast                                | Delivery                                |
| --------------------------------- | ----------------------------------- | --------------------------------------- |
| A. Stakeholders (advisor)         | 6 personas (`VARIANT_PERSONAS`)     | Proactive speech bubble, radial actions |
| B. External agents (MCP)          | Real Cursor/Claude/VS Code guests   | session-events SSE, presence, proposals |
| C. Run gamification               | XP/levels/achievements              | StreakHud, XP bar                       |
| **D. Office ambience (this doc)** | **6 colleagues + the stakeholders** | **OfficeLayer chrome, `/api/office/*`** |

Key boundary: **colleagues never appear in the radial action menu** — they live purely in the
ambience layer. Stakeholders participate in office life (send emails, take meeting seats) by
reference. Office XP flows into System C through the same reducer/emission pipeline; meeting
minutes flow into the Thinking pane through System B's attributed-note rendering path.

## 3. Character roster

### Shipped colleagues (v1)

| id            | Name            | Title                             | Emoji | Bit                                                                                             |
| ------------- | --------------- | --------------------------------- | ----- | ----------------------------------------------------------------------------------------------- |
| `intern`      | Chad            | The Intern (Unpaid, Strategic)    | 🧃    | Replies-all; naive questions that are accidentally profound ~1 in 5                             |
| `scrumMaster` | Pam             | Agile Coach — CSM, CSPO, SAFe 6.0 | 📅    | Everything is a ceremony; parking-lot enthusiast; facilitates every meeting                     |
| `helpdesk`    | Ticket Bot Dave | IT Helpdesk — Tier 1 (of 1)       | 🖥️    | Closes tickets as duplicates of themselves; canned-email workhorse (zero LLM)                   |
| `facilities`  | Gary            | Facilities & Fridge Czar          | 🧹    | ALL-CAPS fridge cleanouts; controls the thermostat with an iron fist                            |
| `hr`          | Linda           | People Ops Business Partner       | 📎    | Weaponized cheerfulness; 847-days-overdue trainings; Craig's birthday card                      |
| `greybeard`   | Ulrich          | Staff Engineer Emeritus           | 🧓    | "We tried that in 2009"; maintains the mainframe nobody admits exists; unsettlingly good advice |

### Future bench (roadmap)

- **The Product Manager** 🗺️ — "quick question" that is never quick; scope creep as a love language.
- **The CISO** 🔐 — phishing tests, "everything is an attack surface, especially the arrows".
- **The Consultant** 💼 — external, billable in 6-minute increments; answers live on slide 87; while
  present, applies an hourly multiplier to the Stakeholder Damage Report™.
- **The CEO** 🏆 — rare cameo; vague inspiration; suddenly cares deeply about AI.
- **Sales** 📈 — already sold the customer a feature that appears nowhere in the diagram.
- **The Data Scientist** 📊 — "the numbers don't say that"; brings a notebook nobody can run.

## 4. Moment catalog

A **moment** is one interruption: `{kind, colleague, channel, content source}`. Shipped kinds:

| Kind             | Channel                                   | Content                                                       | Interruption level          |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------- | --------------------------- |
| `email`          | Inbox dock (envelope + unread badge)      | 2-in-3 canned noise, 1-in-3 LLM about the diagram             | Passive (badge + soft ding) |
| `im`             | Slop Chat™ ping bubbles (TTL ~9 s, max 2) | Mostly canned with `{label}` slot fills                       | Low                         |
| `walkby`         | Colleague slides in beside the canvas     | **Always LLM** (must reference a real label); canned fallback | Medium (~11 s)              |
| `coffee`         | Invite pill → watercooler scene overlay   | Canned two-hander scenes                                      | Opt-in (+10 XP)             |
| `meeting-invite` | Calendar-invite toast                     | Canned invite; the meeting itself is LLM                      | Opt-in (the flagship)       |

Actionable moments carry an `actionPrompt` — a "Do it" button that feeds the normal intent-prompt
path (same adopt flow as the stakeholder advisor).

Roadmap moments: the desk phone nobody answers, desk-drop pastries from Facilities, the fire
drill (all surfaces evacuate for 30 s), the printer that prints one page reading "soon".

## 5. The WG meeting system (flagship)

**Invite** (cadence-driven, max 1/session) or **"Call a meeting"** button in the inbox dock →
**meeting room overlay**: avatar row with speaking highlight, transcript bubbles pacing in,
"Raise hand ✋" input, leave button, and a **minutes card** at the end.

- **One LLM call generates the whole beat script** (`POST /api/office/meeting`, `scriptVersion: 1`);
  the client paces playback beat-by-beat so it feels live. Join latency hides behind an in-fiction
  gag ("Waiting for the organizer to admit you…"). Deliberately no SSE in v1 — the script exists
  before the first byte is useful, and local timers are trivially testable; `scriptVersion` leaves
  room for a per-turn v2.
- **Beat grammar** (`MeetingBeatSchema`): `procedural` (facilitation), `smalltalk`, `offRails`
  (derailments: tangents, fridge politics, war stories), `substantive` (a concrete diagram idea
  with an `actionPrompt`). Server enforces: 6–14 beats, ≥1 substantive, speakers from the attendee
  list only, facilitator opens and closes.
- **Attendees**: 3–4 seats — Pam always facilitates, plus a rotating mix of
  {`exec`, `critique`, `goMad`, `intern`, `greybeard`}. Attendees react to each other by name and
  bicker gently.
- **Interjections**: the user speaks up to 2× per meeting; `POST /api/office/meeting/interject`
  rewrites only the remaining beats to react to the user's point. On failure, Pam parks the point
  ("Great point — parking-lotting that.") and the meeting rolls on.
- **Outcomes**: substantive beats become **meeting minutes** — posted to the Thinking pane as an
  attributed note (origin "📅 WG Meeting") with per-item "Do it" buttons. Surviving a full meeting
  is +25 XP and an achievement; leaving early is +5 XP and zero judgment (some judgment).

Roadmap: user-picked attendees, recurring meeting series with memory ("as discussed last sync"),
the escalation ladder (WG → steering committee → CAB hearing, each stricter and less useful; CAB
approval unlocks an achievement), and the all-hands (CEO cameo, everyone attends, nothing is
decided, confetti).

## 6. Cadence & cost policy

The **ambience director** (`useOfficeAmbience`, client-side — the server stays request-driven) asks
the pure cadence brain (`officeCadence.js`) on a 15 s tick:

- Quiet first ~90 s of a session; 3–5 min jittered gap between moments; **hard cap ~8
  moments/session**; 1 meeting invite/session.
- Never fires while: an agent run streams, the stakeholder advisor bubble is up, a meeting is
  open, another office surface is on screen, the tab is hidden, or **Focus Time** is on
  (persisted; colleagues mostly respect it).
- **LLM budget ≤3 ambient calls/session** + ≤2 per meeting, all on the fast/decorative model tier
  (same policy as the advisor), all billed to the **Stakeholder Damage Report™** via the same
  usage sink. ~70 % of content is canned (template banks in `officeCast.js` with `{label}` /
  `{userTitle}` slot fills; seen-template memory prevents repeats across sessions).
- LLM failure → 30 s backoff + canned fallback. Offline sessions keep a fully-functional office.

### Soundscape (room tone)

A second, sound-only cadence: sporadic synthesized cues — **keyboard clatter** from the next desk
(the workhorse), the **distant printer**, and the **espresso machine** (set pieces, never
back-to-back) — in `agentChimes.js`, all quieter than any event chime. The pure brain
(`officeSoundscape.js`, mirroring `officeCadence.js`) enforces a ~45 s quiet start and a jittered
35–75 s gap; the `useOfficeSoundscape` director holds while the tab is hidden or Focus Time is on
and plays through App's sound gate (global sound toggle + user gesture). Defaults ON with a
persisted opt-out toggle ("Soundscape") next to Focus Time in the inbox dock. Zero LLM, zero
assets, zero network.

## 7. Gamification

`applyOfficeEvent` (same reducer/emission contract as `applyCompletedRun`): email read +1, IM
quick-reply +2, coffee break +10, meeting left early +5, meeting survived +25. Deliberately small —
attending meetings must never out-earn shipping slop. Achievements: 📭 INBOX ZERO, 📅 SURVIVED THE
SYNC, ☕ THIRD SHIFT, 💬 REPLY GUY.

Roadmap: the **performance review** (quarterly A2UI self-assessment pre-filled from real XP/streak/
Damage-Report stats), promotion ceremonies, "meeting-free day" streak bonuses (broken by the app
itself, obviously).

## 8. Wire contracts

Shared schemas in `packages/shared/src/officeScript.ts` (`OfficeMomentKindSchema`,
`OfficeMomentResponseSchema`, `MeetingBeatSchema`, `MeetingScriptSchema`,
`normalizeMeetingScript`). Routes (`apps/server/src/routes/office.js`, advisor-route pattern:
zod → 400, unconfigured LLM → 503, invoke → parse-with-rescue → 200 + `usage`/`model`):

- `POST /api/office/moment` — `{kind, colleagueId, contentType, diagramSource, visibleLabels,
recentMoments}` → `{moment: {colleagueId, kind, subject?, body, actionPrompt?} | null, usage?,
model?}`.
- `POST /api/office/meeting` — `{contentType, diagramSource, visibleLabels, attendees, topic?}` →
  `{script: MeetingScript | null, usage?, model?}`.
- `POST /api/office/meeting/interject` — `{…context, attendees, transcriptSoFar, interjection}` →
  `{beats: MeetingBeat[] | null, usage?, model?}`.

The session-events bus is **not involved in v1** (client-driven request/response, no second
consumer). Reserved for later MCP-app parity: `office_moment` / `meeting_started` event types (per
`docs/recipes/add-session-event.md`) so real external agents can join the watercooler.

## 9. Code map

| Piece                                                        | Path                                                                                                                                                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared schemas                                               | `packages/shared/src/officeScript.ts`                                                                                                                                                  |
| Colleague voices + prompt builders + parsers + model factory | `apps/server/src/agents/officePersonas.js`                                                                                                                                             |
| Routes                                                       | `apps/server/src/routes/office.js` (mounted at `/api/office`)                                                                                                                          |
| Cast + canned template banks + chrome copy                   | `apps/web/src/utils/officeCast.js`                                                                                                                                                     |
| Locale bundles (en-AU, zh-CN, zh-TW office copy)             | `apps/web/src/i18n/locales/office.*.js` → merged in `getUiLocaleBundle.js`, applied via `setActiveOfficeBundle` (UiLocaleContext)                                                      |
| Pure cadence brain                                           | `apps/web/src/utils/officeCadence.js`                                                                                                                                                  |
| Soundscape brain (pure) + director hook                      | `apps/web/src/utils/officeSoundscape.js`, `apps/web/src/hooks/useOfficeSoundscape.js`                                                                                                  |
| DND + soundscape + cadence persistence                       | `apps/web/src/utils/officeAmbienceStorage.js`                                                                                                                                          |
| Ambience store (useSyncExternalStore)                        | `apps/web/src/state/officeMomentStore.js`                                                                                                                                              |
| Director hook                                                | `apps/web/src/hooks/useOfficeAmbience.js`                                                                                                                                              |
| Meeting playback state machine                               | `apps/web/src/hooks/useMeetingPlayback.js`                                                                                                                                             |
| Chrome                                                       | `apps/web/src/components/OfficeLayer.jsx` (+ `OfficeInboxDock`, `OfficeImPing`, `OfficeWalkBy`, `CoffeeBreakOverlay`, `MeetingInviteToast`, `MeetingOverlay`)                          |
| Office XP reducer                                            | `applyOfficeEvent` in `apps/web/src/state/runGamificationStore.js`                                                                                                                     |
| Minutes → Thinking pane                                      | `officeMinutesToInsightEntry` in `apps/web/src/utils/appInsightHelpers.js`                                                                                                             |
| SFX                                                          | `playMailChime` / `playImPing` / `playMeetingJoinBlip` + soundscape cues (`playKeyboardClatter` / `playDistantPrinter` / `playEspressoMachine`) in `apps/web/src/utils/agentChimes.js` |
| App integration                                              | one `<OfficeLayer/>` mount next to `<ErrorToast/>` in `apps/web/src/App.jsx`                                                                                                           |

## 10. Future roadmap (beyond v1)

1. **Compliance-training minigame** — A2UI forms gauntlet ("Synergy & You: Module 3 of 11") reusing
   `FormsRenderer`; XP for completion; Linda sends the overdue notices.
2. **Phishing test** — the CISO sends a too-good-to-be-true email; clicking it = achievement
   ("Security Incident #1") + a mandatory training form.
3. **Performance review** — quarterly A2UI self-assessment pre-filled from real gamification stats.
4. **All-hands** — CEO cameo meeting; everyone attends; nothing is decided; confetti.
5. **The Re-org** — stakeholder titles/accents reshuffle for one session; the org chart renders as
   an actual Mermaid diagram in-canvas.
6. ~~**Office soundscape**~~ — ✅ shipped: keyboard clatter, distant printer, espresso machine
   (see §6 "Soundscape").
7. **Seasonal events** — Q4 budget freeze (Auditor rampant), Hackathon week (SLOPITECT rampant),
   "no-meeting Wednesday" (meetings double).
8. **Multiplayer watercooler** — real external MCP agents (System B) join coffee breaks alongside
   the fictional cast via the session event bus.
9. **Desk booking / hybrid days** — some days a colleague "isn't in" and IMs instead of walk-bys.
10. **Meeting escalation ladder** — WG → steering committee → CAB hearing; CAB approval achievement.
11. **The Consultant's invoice** — while the Consultant is in any meeting, the Damage Report ticks
    visibly per minute.
12. ~~**Locale bundles**~~ — ✅ shipped: the full office copy bank (colleague titles, canned
    emails/IMs/walk-bys/coffee scenes, meeting copy, chrome strings, quick replies, `{label}` slot
    fallbacks) localizes to en-AU / zh-CN / zh-TW via `office.*.js` bundles merged in
    `getUiLocaleBundle.js` and applied through `setActiveOfficeBundle`. Template ids stay aligned
    across locales so the seen-template memory survives locale switches. Server-side (LLM) moments
    remain English-first — a persona-prompt locale hint is the natural follow-up.
