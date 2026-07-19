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
| **D. Office ambience (this doc)** | **7 colleagues + the stakeholders** | **OfficeLayer chrome, `/api/office/*`** |

Key boundary: **colleagues never appear in the radial action menu** — they live purely in the
ambience layer. Stakeholders participate in office life (send emails, take meeting seats) by
reference. Office XP flows into System C through the same reducer/emission pipeline; meeting
minutes flow into the Thinking pane through System B's attributed-note rendering path.

## 3. Character roster

The cast is split into **three tiers** (`apps/web/src/utils/castTiers.js` — `CAST_TIERS` /
`tierOf`). The tier is a tag, not a data move: `exec` still lives in `VARIANT_PERSONAS` and
`ciso` in `OFFICE_COLLEAGUES`.

| Tier       | Who                                                      | How they reach you                                                              |
| ---------- | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **team**   | refine, innovate, goMad, critique, explain               | Proactive roundtable (`ADVISOR_ORDER`) + the agent actions. Your collaborators. |
| **senior** | exec (VP), ciso (Sasha), cto (Marcus), cfo (Diane)       | Steering meetings + ≤1 high-stakes email/session. Never ambient pings.          |
| **office** | intern, scrumMaster, helpdesk, facilities, hr, greybeard | Emails, IMs, walk-bys, coffee, battles. The floor around you.                   |

Boundary rules worth keeping: senior stakeholders are excluded from
`OFFICE_{WALKBY,EMAIL,IM}_LLM_CAST` and from the canned day-to-day banks — their one ambient
outlet is `SENIOR_EMAIL_TEMPLATES`. They **may still be overheard** in coffee/battle set pieces
(Sasha's DNS postmortem, the Friday-deploy war): overhearing leadership argue is not the same as
leadership pinging your desk.

### Senior stakeholders

| id     | Name   | Title                          | Emoji | Bit                                                                 |
| ------ | ------ | ------------------------------ | ----- | ------------------------------------------------------------------- |
| `exec` | The VP | SVP of Synergy & Co-Design     | 👔    | Subtractive; wants the one-pager; hard stop in four minutes         |
| `ciso` | Sasha  | CISO — The Department of No    | 🔐    | Everything is an attack surface; runs the phishing sims             |
| `cto`  | Marcus | CTO — Ships Keynotes, Not Code | 🚀    | Visionary word salad; wants the diagram to pulse; no IDE since 2016 |
| `cfo`  | Diane  | CFO — The Budget Is a No       | 🧮    | Every box is a cost center; asks what the diagram costs per month   |

### Shipped colleagues (v1)

| id            | Name            | Title                             | Emoji | Bit                                                                                                  |
| ------------- | --------------- | --------------------------------- | ----- | ---------------------------------------------------------------------------------------------------- |
| `intern`      | Chad            | The Intern (Unpaid, Strategic)    | 🧃    | Replies-all; naive questions that are accidentally profound ~1 in 5                                  |
| `scrumMaster` | Pam             | Agile Coach — CSM, CSPO, SAFe 6.0 | 📅    | Everything is a ceremony; parking-lot enthusiast; facilitates every meeting                          |
| `helpdesk`    | Ticket Bot Dave | IT Helpdesk — Tier 1 (of 1)       | 🖥️    | Closes tickets as duplicates of themselves; canned-email workhorse (zero LLM)                        |
| `facilities`  | Gary            | Facilities & Fridge Czar          | 🧹    | ALL-CAPS fridge cleanouts; controls the thermostat with an iron fist                                 |
| `hr`          | Linda           | People Ops Business Partner       | 📎    | Weaponized cheerfulness; 847-days-overdue trainings; Craig's birthday card                           |
| `greybeard`   | Ulrich          | Staff Engineer Emeritus           | 🧓    | "We tried that in 2009"; maintains the mainframe nobody admits exists; unsettlingly good advice      |
| `ciso`        | Sasha           | CISO — The Department of No       | 🔐    | Everything is an attack surface, especially the arrows; runs the phishing sims; "noted in your file" |

### How a character is drawn

The emoji column above is now a **fallback**, not the render path. Every avatar surface
renders `<PersonaFace id={...} />`
(`apps/web/src/components/personaFaces/index.jsx`) — one parametric SVG face driven by a
trait row per character in `./registry.js` (skin, hair + color, facial hair, glasses,
accessory, expression). The accent disc/ring uses the character's existing `accentColor`
from `officeSenderInfo`, so faces stay distinguishable at a glance even at 16 px.

Rules worth knowing before you touch it:

- **Traits are read off the character's prose, not invented.** Ulrich "Staff Engineer
  Emeritus" is `receding` + `beard` + `tired`; Dave "Tier 1 (of 1)" wears the `headset`.
- **A new cast member costs a trait row, not new art** — that is the whole reason this is
  parametric rather than 15 hand-drawn SVGs. The future bench below needs one row each.
- **Below ~24 px the component drops fine detail** (glasses, facial hair, accessory) and
  keeps silhouette + ring, so the 1.35 rem cast strip stays legible.
- **Faces stay `aria-hidden`.** Every call site already shows the name next to the avatar;
  passing `title` promotes the SVG to a named image and duplicates that text in the a11y
  tree. Where a hover tooltip is wanted, put `title` on a wrapper span instead.
- Emoji deliberately remain where a glyph sits **inline in a sentence** (meeting minutes,
  battle verdict, invite toast) and in the Markdown transcript — those are text, not
  avatars.
- Unknown ids fall back to `avatarEmoji` (or an explicit `fallbackEmoji`, which is how the
  meeting's non-persona "you" seat keeps its 🙋).

### Future bench (roadmap)

- **The Product Manager** 🗺️ — "quick question" that is never quick; scope creep as a love language.
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
| `battle`         | Invite pill → battle arena overlay        | Canned holy-war scenes; the user votes a winner               | Opt-in (+5 XP for settling) |
| `meeting-invite` | Calendar-invite toast                     | Canned invite; the meeting itself is LLM                      | Opt-in (the flagship)       |

Actionable moments carry an `actionPrompt` — a "Do it" button that feeds the normal intent-prompt
path (same adopt flow as the stakeholder advisor).

**Every surface shows who is talking**: name **and** role ride along on IM pings, inbox rows,
meeting-invite attendee chips, meeting seats, transcript bubbles, coffee scenes, and battle
arenas (tooltips where space is tight) — never a bare emoji.

### Cubicle battles (the holy-war system)

From time to time two colleagues go to war over the eternal questions — tabs vs. spaces, the
Friday deploy, the thermostat (20.5°C, allegedly), monolith vs. microservices, "it was DNS", the
unlabeled tupperware. Three-phase flow, all in `OfficeBattleOverlay`:

1. **Invite pill** — "🥊 {a} and {b} are at it again" with [Grab popcorn] / [Not my circus].
2. **The arena** — both combatants' avatars face off under the topic; their lines **pace in one
   by one** (`BATTLE_LINE_PACE_MS`) so the escalation lands like a live spat. The boxing bell
   (`playBattleBell`) rings the match in.
3. **The verdict** — the user settles the holy war by siding with someone ("You've heard both
   sides. Someone has to be wrong."). The winner gets a closing zinger (per-side `verdicts` in
   the scene bank), a victory sting plays, and settling is worth **+5 XP**. Walking away
   ("Escalate to HR") costs nothing and resolves nothing, like real life.

Battles are **pure canned theater** — zero LLM, fully offline-capable (`OFFICE_BATTLE_SCENES` in
`officeCast.js`, localized like every other bank), never mean, and rare by design: weight 1.25 in
the cadence mix and a hard cap of **2 per session** (`OFFICE_BATTLES_PER_SESSION`). Scenes may
reference the diagram via `{label}` slots (the monolith battle argues about splitting the user's
actual node). Store lifecycle mirrors coffee: invite → accept → vote → dismiss
(`pushOfficeBattleInvite` / `acceptOfficeBattle` / `voteOfficeBattle` / `dismissOfficeBattle`).

### First-run onboarding (the office introduces itself)

Two once-ever beats, gated by `archislop:office-welcomed` (`useOfficeWelcome`):

1. **Linda's welcome email** — introduces the whole floor by name/role, plus the Focus Time /
   Soundscape escape hatches. Timed ~1.5 s after the user's first pointer/key gesture (so the
   sound gate is open and the **"You've got mail!"** announce — speech synthesis, chime-only
   fallback — actually plays), with a 15 s no-interaction fallback.
2. **Chad's welcome IM** ~8 s later.

The entry screen additionally mounts the **office directory** (`OfficeDirectory`): a
focused "meet the floor" tour. First run it opens as a stepped intro (welcome beat →
one colleague at a time → Clock in), persisted via `archislop:office-directory-seen`;
afterwards it lives as a "🏢 Meet the floor" chip that reopens the full roster.
Floating office surfaces (directory, IM pings, walk-bys, coffee invites) use an opaque
`--office-surface-bg` so canvas ink underneath never bleeds through the copy.

### Day One (the new-hire frame)

The empty state is staged as **your first day at ArchiSlop Corp.** — the user is the
newest architect on the floor and the diagram slots are their work deliverables:

- **`DayOneBadge`** (`apps/web/src/components/DayOneBadge.jsx`) tops the entry cluster:
  "ArchiSlop Corp. · Employee Badge / New Hire — {userTitle}" (the gamification level
  title), one HR gag line, and the rockstar pitch line. Dismiss persists via
  `archislop:day-one-badge-seen` (`officeAmbienceStorage`), like the directory tour.
- **Assignment chips** — `controls.prompt.starters` entries carry `fromId` (any cast id
  `officeSenderInfo` can resolve — stakeholders and colleagues both work) and `ask` (the
  requester's one-liner). `TopicStarters` renders a From-attribution stack; entries
  without `fromId` (untranslated locale bundles) fall back to plain chips. The
  `label`/`prompt` fields stay the real generation inputs — the fiction never touches
  prompt quality.
- **"Pitch your own initiative"** — the free-prompt placeholder; the entry "Render as"
  strip is labeled **"Deliverable format"**.

Assignments are canned-only for now. Roadmap: an LLM-refreshable assignment inbox
(new requests referencing the user's recent work), budgeted like other office LLM calls.

Roadmap moments: the desk phone nobody answers, desk-drop pastries from Facilities, the fire
drill (all surfaces evacuate for 30 s), the printer that prints one page reading "soon".

### Desk verbs (what _you_ do)

The ambience director decides when the office interrupts you; the **desk verbs** are the other
direction — you deciding to get up. `DeskActionsDock` (ArchiSlop helmet stamp in the bottom row)
opens a short menu wired to `useDeskActions` (plus one chrome sink for the XP / People Ops panel):

| Verb                       | Does                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 📈 Check my HR progression | Toggles the level-up / People Ops scorecard (`LevelUpInfoPanel`) — always enabled                                                  |
| ☕ Get a coffee            | Pushes an unseen coffee scene and auto-accepts it — you walked over, there is no invite                                            |
| 🚶 Walk the floor          | An on-demand walk-by (LLM within the desk budget, canned fallback); with a blank canvas you overhear a coffee/battle scene instead |
| 💬 Message someone         | DMs a teammate or colleague; reply is LLM-or-canned. Senior tier excluded — you don't cold-DM the CFO                              |
| 📥 Check your mail         | Opens the inbox popover (`openSignal` counter prop)                                                                                |
| 📅 Call a meeting          | Same handler as the inbox's shortcut (two entry points, one behavior)                                                              |
| 👥 Talk to your team       | `advisor.promptNext({})` — asks the roundtable for a fresh take                                                                    |

**Gating differs from the ambient director on purpose.** Verbs skip the random scheduler and
**bypass Focus Time** (it mutes interruptions, not your own initiative), but still respect
one-surface-at-a-time, an open meeting, and a streaming agent run. Blocked verbs stay visible and
disabled with an in-fiction tooltip ("Deploy in progress — nobody leaves their desk."), so the menu
never silently no-ops.

**Budget.** Verb-triggered LLM calls have their own cap (`DESK_LLM_CAP` = 3/session) and never
spend the ambient `OFFICE_LLM_MOMENT_CAP`; asking for something yourself should not use up the
office's background allowance. Verbs stamp `lastFiredAt` (so the ambient director backs off
afterwards) but never consume its session caps. XP reuses the existing awards, plus
`walkedFloor` (+2).

Both producers share `apps/web/src/utils/officeMomentDelivery.js` — the canned-bank and
LLM-moment paths live there, so a desk verb and an ambient moment resolve content identically.

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
- **Attendees**: 3–4 seats, drawn as a **steering committee** (`pickMeetingAttendees`) — Pam always
  facilitates, 1–2 **senior stakeholders** from {`exec`, `ciso`, `cto`, `cfo`} outrank the room, and
  exactly one **team presenter** from {`refine`, `critique`, `explain`} walks the deck upstairs. The
  showrunner prompt tells the seniors to ask for the headline, the cost, and the risk while the
  presenter defends the diagram. Server-side the seat allowlist is `isOfficeSpeaker`
  (`officePersonas.js`), which now spans colleagues + stakeholders + `SENIOR_MEETING_VOICES`.
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
the pure cadence brain (`officeCadence.js`) on a 5 s tick:

- Quiet first ~20 s of a session, then a **warm-up**: the first 2 moments arrive on a short
  45–75 s leash (the office notices the new arrival) before the cadence settles to the 3–5 min
  jittered cruise gap; **hard cap ~10 moments/session**; 1 meeting invite/session; 2 cubicle
  battles/session; **1 senior email/session** (`OFFICE_SENIOR_EMAILS_PER_SESSION`) — a canned email
  has a ~20 % chance of coming from upstairs instead of the floor while that cap is open, and the
  senior draw never spends an LLM call.
- Never fires while: an agent run streams, the stakeholder advisor bubble is up, a meeting is
  open, another office surface is on screen, the tab is hidden, or **Focus Time** is on
  (persisted; colleagues mostly respect it).
- **LLM budget ≤3 ambient calls/session** + ≤2 per meeting, all on the fast/decorative model tier
  (same policy as the advisor), all billed to the **Stakeholder Damage Report™** via the same
  usage sink. ~70 % of content is canned (template banks in `officeCast.js` with `{label}` /
  `{userTitle}` slot fills; seen-template memory prevents repeats across sessions).
- LLM failure → 30 s backoff + canned fallback. Offline sessions keep a fully-functional office.

### Soundscape (room tone)

A second, sound-only cadence: sporadic synthesized cues — the desk textures **keyboard clatter**,
**mouse clicks** (with the occasional scroll-wheel ratchet), and **paper shuffle** (may repeat),
plus the set pieces **distant printer**, **chair squeak** (with caster roll), **desk phone**
(nobody answers), **watercooler glugs**, **espresso machine**, **vending machine** (coin, spiral
motor, thunk), and **elevator ding** (nobody gets out) — never back-to-back — in
`agentChimes.js`, all quieter than any event chime. The pure brain (`officeSoundscape.js`,
mirroring `officeCadence.js`) enforces a ~6 s quiet start, a 12–26 s warm-up gap for the first
~2 min (the room fades in), then a jittered 35–75 s cruise gap; the `useOfficeSoundscape`
director holds while the tab is hidden or Focus Time is on and plays through App's sound gate
(global sound toggle + user gesture). Defaults ON with a persisted opt-out toggle ("Soundscape")
next to Focus Time in the inbox dock. Zero LLM, zero assets, zero network.

Event SFX on top of the room tone: the session's first email plays **"You've got mail!"**
(speech synthesis via the localized `mailAnnounce` line; plain chime fallback), walk-bys get
approaching **footsteps** plus the colleague **speaking the line** when Narration is on (per-cast
pitch/rate profiles in `officeNarration.js`; emails stay silent — nobody reads your inbox out
loud), meeting invites a **calendar bing-bong**, accepting a coffee break fires the espresso
machine, entering a cubicle battle rings the **boxing bell**, and settling one lands a small
**victory sting**. WG meeting beats are paced to the spoken line when Narration is on (fallback
to the reading-pace timer when synthesis is muted or unavailable). The inbox dock's **Narration**
toggle (defaults ON, persisted opt-out) sits next to Soundscape; Focus Time cancels in-flight
speech.

## 7. Gamification

`applyOfficeEvent` (same reducer/emission contract as `applyCompletedRun`): email read +1, IM
quick-reply +2, battle settled +5, coffee break +10, meeting left early +5, meeting survived +25.
Deliberately small — attending meetings must never out-earn shipping slop. Achievements: 📭 INBOX
ZERO, 📅 SURVIVED THE SYNC, ☕ THIRD SHIFT, 💬 REPLY GUY, 🥊 HOLY WAR REFEREE (three battles
settled in one session).

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

`attendees` accepts any id that passes `isOfficeSpeaker` — colleagues, stakeholders, and (since the
tier split) the senior execs. No shared-schema change was needed: `speakerId`/`colleagueId` are
plain strings and the allowlist is the trust boundary. Producer is the client's
`pickMeetingAttendees`; consumer is `normalizeAttendees`.

The session-events bus is **not involved in v1** (client-driven request/response, no second
consumer). Reserved for later MCP-app parity: `office_moment` / `meeting_started` event types (per
`docs/recipes/add-session-event.md`) so real external agents can join the watercooler.

## 9. Code map

| Piece                                                                  | Path                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared schemas                                                         | `packages/shared/src/officeScript.ts`                                                                                                                                                                                                                                                                                                                                                                                                    |
| Colleague voices + prompt builders + parsers + model factory           | `apps/server/src/agents/officePersonas.js`                                                                                                                                                                                                                                                                                                                                                                                               |
| Routes                                                                 | `apps/server/src/routes/office.js` (mounted at `/api/office`)                                                                                                                                                                                                                                                                                                                                                                            |
| Cast + canned template banks + chrome copy                             | `apps/web/src/utils/officeCast.js`                                                                                                                                                                                                                                                                                                                                                                                                       |
| Locale bundles (en-AU, zh-CN, zh-TW office copy)                       | `apps/web/src/i18n/locales/office.*.js` → merged in `getUiLocaleBundle.js`, applied via `setActiveOfficeBundle` (UiLocaleContext)                                                                                                                                                                                                                                                                                                        |
| Pure cadence brain                                                     | `apps/web/src/utils/officeCadence.js`                                                                                                                                                                                                                                                                                                                                                                                                    |
| Soundscape brain (pure) + director hook                                | `apps/web/src/utils/officeSoundscape.js`, `apps/web/src/hooks/useOfficeSoundscape.js`                                                                                                                                                                                                                                                                                                                                                    |
| DND + soundscape + narration + cadence + welcome/directory persistence | `apps/web/src/utils/officeAmbienceStorage.js`                                                                                                                                                                                                                                                                                                                                                                                            |
| First-run welcome sequence                                             | `apps/web/src/hooks/useOfficeWelcome.js` (beats: `OFFICE_WELCOME_EMAIL` / `OFFICE_WELCOME_IM` in `officeCast.js`)                                                                                                                                                                                                                                                                                                                        |
| Entry-screen office directory                                          | `apps/web/src/components/OfficeDirectory.jsx` (mounted in App's entry cluster; colleague `blurb`s in `officeCast.js`)                                                                                                                                                                                                                                                                                                                    |
| Ambience store (useSyncExternalStore)                                  | `apps/web/src/state/officeMomentStore.js`                                                                                                                                                                                                                                                                                                                                                                                                |
| Director hook (cadence + caps)                                         | `apps/web/src/hooks/useOfficeAmbience.js`                                                                                                                                                                                                                                                                                                                                                                                                |
| Shared moment delivery (both producers)                                | `apps/web/src/utils/officeMomentDelivery.js`                                                                                                                                                                                                                                                                                                                                                                                             |
| Desk verbs (player-initiated)                                          | `apps/web/src/hooks/useDeskActions.js` + `apps/web/src/components/DeskActionsDock.jsx`                                                                                                                                                                                                                                                                                                                                                   |
| Cast tiers (team / senior / office)                                    | `apps/web/src/utils/castTiers.js`                                                                                                                                                                                                                                                                                                                                                                                                        |
| Day One entry framing                                                  | `apps/web/src/components/DayOneBadge.jsx` + attributed `controls.prompt.starters` (`TopicStarters.jsx`)                                                                                                                                                                                                                                                                                                                                  |
| Meeting playback state machine                                         | `apps/web/src/hooks/useMeetingPlayback.js`                                                                                                                                                                                                                                                                                                                                                                                               |
| Chrome                                                                 | `apps/web/src/components/OfficeLayer.jsx` (+ `DeskActionsDock`, `OfficeInboxDock`, `OfficeImPing`, `OfficeWalkBy`, `CoffeeBreakOverlay`, `OfficeBattleOverlay`, `MeetingInviteToast`, `MeetingOverlay`)                                                                                                                                                                                                                                  |
| Office XP reducer                                                      | `applyOfficeEvent` in `apps/web/src/state/runGamificationStore.js`                                                                                                                                                                                                                                                                                                                                                                       |
| Minutes → Thinking pane                                                | `officeMinutesToInsightEntry` in `apps/web/src/utils/appInsightHelpers.js`                                                                                                                                                                                                                                                                                                                                                               |
| SFX                                                                    | `playMailChime` / `playYouveGotMail` / `playImPing` / `playFootsteps` / `playCalendarDing` / `playMeetingJoinBlip` / `playBattleBell` / `playVictoryDing` + soundscape cues (`playKeyboardClatter` / `playMouseClicks` / `playPaperShuffle` / `playDistantPrinter` / `playChairSqueak` / `playDeskPhone` / `playWaterCooler` / `playEspressoMachine` / `playVendingMachine` / `playElevatorDing`) in `apps/web/src/utils/agentChimes.js` |
| Walk-by / meeting / battle / coffee narration                          | `apps/web/src/utils/officeNarration.js` + `POST /api/office/speak` (`apps/server/src/agents/officeTts.js` WaveNet); emails/IMs stay silent; inbox Narration toggle                                                                                                                                                                                                                                                                       |
| Narration roadmap (WaveNet follow-ups)                                 | [`docs/office-narration-roadmap.md`](office-narration-roadmap.md)                                                                                                                                                                                                                                                                                                                                                                        |
| App integration                                                        | one `<OfficeLayer/>` mount next to `<ErrorToast/>` in `apps/web/src/App.jsx`                                                                                                                                                                                                                                                                                                                                                             |

## 10. Future roadmap (beyond v1)

1. **Compliance-training minigame** — A2UI forms gauntlet ("Synergy & You: Module 3 of 11") reusing
   `FormsRenderer`; XP for completion; Linda sends the overdue notices.
2. **Phishing test** — the CISO sends a too-good-to-be-true email; clicking it = achievement
   ("Security Incident #1") + a mandatory training form. (Sasha the CISO ✅ shipped with the
   ambience cast — including a phishing-_report_ email gag; the interactive click-bait minigame
   is the part that remains.)
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
    emails/IMs/walk-bys/coffee scenes/battle scenes, meeting copy, chrome strings, quick replies,
    `{label}` slot fallbacks) localizes to en-AU / zh-CN / zh-TW via `office.*.js` bundles merged
    in `getUiLocaleBundle.js` and applied through `setActiveOfficeBundle`. Template ids stay
    aligned across locales so the seen-template memory survives locale switches. Server-side (LLM)
    moments remain English-first — a persona-prompt locale hint is the natural follow-up.
13. ~~**Cubicle battles**~~ — ✅ shipped (see §4 "Cubicle battles"). Future escalations: best-of-three
    rematches with a running score, stakeholders wading in as tag-team partners, an LLM battle mode
    that argues about the user's actual diagram, and betting XP on the outcome before the first line
    lands.
14. ~~**Walk-by / meeting narration (Web Speech)**~~ — ✅ shipped: per-cast pitch/rate profiles in
    `officeNarration.js`; emails stay silent; inbox Narration toggle.
15. ~~**Google Cloud WaveNet TTS + overheard battles/coffee**~~ — ✅ shipped: `POST /api/office/speak`,
    `officeTts.js` WaveNet cast map, client prefers cloud MP3 with Web Speech fallback; cubicle
    battles and coffee scenes are spoken (emails/IMs stay silent). Polish + caching ladder:
    [`office-narration-roadmap.md`](office-narration-roadmap.md).
