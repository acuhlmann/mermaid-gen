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
`tierOf`). The tier is a tag, not a data move: `barker` lives in both `VARIANT_PERSONAS` (his
advisor seat) and `SENIOR_STAKEHOLDERS` (his tier), and `ciso` in `OFFICE_COLLEAGUES`.

| Tier       | Who                                                                       | How they reach you                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **team**   | gilfoyle, dinesh, erlich, goMad, critique, explain (+ `barker` dual-home) | Proactive roundtable (`ADVISOR_ORDER`) + agent actions. Full-weight peers; Barker at **throttled** pick weight (`ADVISOR_PICK_WEIGHTS.barker` = 0.5) — ≈8% of a long rotation against ≈15% per peer. |
| **senior** | barker (Jack), ciso (Sasha), cto (Marcus → Belson), cfo (Diane)           | Steering meetings + ≤1 high-stakes email/session. Never ambient walk-bys/IMs. Belson (when shipped) scarcer than Barker — never roundtable; Jack reports to him.                                     |
| **office** | intern, scrumMaster, helpdesk, facilities, hr, greybeard                  | Emails, IMs, walk-bys, coffee, battles. The floor around you.                                                                                                                                        |

Boundary rules worth keeping: senior stakeholders are excluded from
`OFFICE_{WALKBY,EMAIL,IM}_LLM_CAST` and from the canned day-to-day banks — their one ambient
outlet is `SENIOR_EMAIL_TEMPLATES`. They **may still be overheard** in coffee/battle set pieces
(Sasha's DNS postmortem, the Friday-deploy war): overhearing leadership argue is not the same as
leadership pinging your desk.

### Senior stakeholders

| id       | Name        | Title                          | Emoji | Bit                                                                                                                                                                  |
| -------- | ----------- | ------------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `barker` | Jack Barker | CEO — Success Theater          | 🧘    | **Named Silicon Valley replication** — 6th radial advisor; dual-home team+senior; throttled roundtable (see note)                                                    |
| `ciso`   | Sasha       | CISO — The Department of No    | 🔐    | Everything is an attack surface; runs the phishing sims                                                                                                              |
| `cto`    | Marcus      | CTO — Ships Keynotes, Not Code | 🚀    | Visionary word salad; wants the diagram to pulse; no IDE since 2016. **Slated:** full Gavin Belson replication (`belson`) — scarcer than Barker; Jack reports to him |
| `cfo`    | Diane       | CFO — The Budget Is a No       | 🧮    | Every box is a cost center; asks what the diagram costs per month                                                                                                    |

> **The Barker experiment / SV program.** `barker` is a deliberate replication of Jack Barker from
> HBO's _Silicon Valley_ — the first test of how faithfully a named TV character can live in this
> cast. His voice cards (`STAKEHOLDER_MEETING_VOICES.barker` in
> `apps/server/src/agents/officePersonas.js`, `ADVISOR_PERSONAS.barker` in
> `apps/server/src/agents/advisorPrompts.js`) were tuned against `scripts/barker-fidelity.mjs`
> (final sustained score ≈ 4.2/5). In July 2026 he **inherited The VP's team seat** (the retired
> `exec` id): sixth radial advisor, board-deck simplify, senior trappings (steering meetings, one
> rare email). **Reachability (locked 2026-07-27; shipped in Session 2):** he is part of Your Team
> and appears in the proactive roundtable at **throttled** weight — `ADVISOR_PICK_WEIGHTS.barker`
> = 0.5, so roughly half as often as a peer advisor — not summoned-only. He does not get office
> walk-by/IM spam. Fiction: he reports to
> **Gavin Belson** (`belson`, Session 8), who stays harder to reach (senior-only; never
> roundtable). Status: **local experiment** — before public deploy, decide real names vs
> legally-distinct aliases. Locked roster: Erlich → `erlich` (shipped), Gilfoyle → `gilfoyle` (shipped),
> Dinesh → new seventh engineer seat (`dinesh`, gilfoyle-class, core team + battle dual-home),
> Jared → `jared`, Russ → `goMad`, Richard → `richard` (comment-only), Belson replaces Marcus.
> Single source of truth for remaining sessions:
> [docs/recipes/replicate-tv-character.md](recipes/replicate-tv-character.md).

> **Gilfoyle inherits the engineer seat (Session 3, 2026-07-27).** `gilfoyle` is the third named
> replication and the second seat inheritance: **Bertram Gilfoyle** took over the retired generic
> `refine` id wholesale — wire mode, transform/analyze behavior, radial action, hotkey `R`, mascot
> row, floor desk, TTS/narration rows, XP variant. The seat contract travelled unchanged (always
> actionable, never a pure comment; same node/edge budgets and temperature 0.42/0.55) and only the
> voice was re-skinned: flat terminal declaratives, unmarked sarcasm, a verdict on the state the
> diagram was left in, contempt aimed at the work rather than the user. Cards live in
> `STAKEHOLDER_MEETING_VOICES.gilfoyle` and `ADVISOR_PERSONAS.gilfoyle`; tuned against
> `node scripts/barker-fidelity.mjs gilfoyle`. Two invented colleagues who used to be described
> _as_ him (Dave "Gilfoyle-adjacent", Ulrich "Gilfoyle-calm") were re-worded so the real character
> is the only Gilfoyle on the floor. He stays a full-weight roundtable peer — the throttle is
> Barker's alone.

> **Dinesh takes a new seventh seat (Session 4, 2026-07-27).** The fourth named replication and
> the first that is **not** an inheritance: **Dinesh Chugtai** got a brand-new wire mode
> (`dinesh` in `TransformModeSchema`) cloned from Gilfoyle's budgets and temperatures — same
> diagram-type lock, same ~4 node / 6 edge ceiling, same 0.42 transform temperature — so both
> engineers sit on the floor at once instead of one replacing the other. Because the budgets are
> identical by design, the two share a single branch in `mermaidTransformPolicy.ts` /
> `infographicTransformPolicy.ts`; split it only on a deliberate retune. Everything else is his
> own: radial action, hotkey `D`, mascot row, persona face, XP variant, chime family, violet
> accent, and the desk at (7, 4) directly beside Gilfoyle's — which is the entire joke. The voice
> diverges where it matters: where Gilfoyle is a flat verdict on the state the work was left in,
> Dinesh is the correct fix **plus a bid for credit**, and unlike Gilfoyle he mixes in pure
> comments (~1 in 4). Two playbook lessons applied: a character with a real-world specialty needs
> an explicit topic refusal (he may love Java on his own time, but the seat is subject-agnostic),
> and the needling is aimed — it lands on the work and on Gilfoyle, never on the user, who is the
> one person he actually wants to impress. Cards live in `STAKEHOLDER_MEETING_VOICES.dinesh` and
> `ADVISOR_PERSONAS.dinesh`; harness profile: `node scripts/barker-fidelity.mjs dinesh`. The
> battle dual-home landed as one canned scene, `battle-commit-credit` — the two of them arguing
> over whose name goes on the fix.

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

| Kind             | Channel                                   | Content                                                                   | Interruption level          |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------------- | --------------------------- |
| `email`          | Inbox dock (envelope + unread badge)      | 2-in-3 canned noise, 1-in-3 LLM about the diagram                         | Passive (badge + soft ding) |
| `im`             | Slop Chat™ ping bubbles (TTL ~9 s, max 2) | Mostly canned with `{label}` slot fills                                   | Low                         |
| `walkby`         | Colleague slides in beside the canvas     | **Always LLM** (must reference a real label); canned fallback             | Medium (~11 s)              |
| `coffee`         | Invite pill → watercooler scene overlay   | Canned two-hander scenes                                                  | Opt-in (+10 XP)             |
| `battle`         | Invite pill → battle arena overlay        | Canned holy-war scenes; the user votes a winner                           | Opt-in (+5 XP for settling) |
| `meeting-invite` | Calendar-invite toast                     | Canned invite; the meeting itself is LLM                                  | Opt-in (the flagship)       |
| `run-reaction`   | Slop Chat™ ping, right after a run lands  | Canned IM (occasional LLM); a colleague reacts to what you just generated | Low                         |

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
   Soundscape escape hatches, and greets the user by their chosen name (`{userName}`). Timed
   ~1.5 s after the user's first pointer/key gesture (so the sound gate is open and the
   **"You've got mail!"** announce — speech synthesis, chime-only fallback — actually plays),
   with a 15 s no-interaction fallback.
2. **Chad's welcome IM** ~8 s later (also on a first-name basis).

The entry screen additionally mounts the **office directory** (`OfficeDirectory`): an
interactive game-style **"Meet the Office"** orientation. **First run it is the entire
app is** — nothing else mounts until the tour is dismissed or skipped — then the empty
state, Day One badge, and the rest of the chrome appear. The cinematic flow is reception
check-in → name badge with Linda's auto-voiced welcome → Meet the team
auto-plays each colleague intro in order → Clock in, persisted via
`archislop:office-directory-seen`; afterwards reopen via the **desk verb** once you
have canvas content, so everybody can introduce themselves again anytime.
While the directory is open it publishes pause state (`officeDirectoryUiStore`)
so ambience IMs/walk-bys, Linda's welcome email, and the advisor stay quiet.
On first visit the rest of the shell does not mount until the tour completes;
reopens use a dimmed modal overlay so Day One / starters stay behind but visible.
Floating office surfaces (directory, IM pings, walk-bys, coffee invites) use an opaque
`--office-surface-bg` so canvas ink underneath never bleeds through the copy.

Three things make the orientation more than a static list:

- **Cinematic voice (gesture-unlocked).** Check in at reception / Meet the team are the
  user gestures that unlock speech. Linda's welcome and each colleague spotlight
  then **auto-play** in order (`useIntroNarrator` + Cloud TTS), advancing when
  each line finishes — no per-character ▶ required. Roster revisit and ▶ buttons
  remain for replay/stop. Cost guardrail: nothing speaks on cold mount (scrapers
  can't burn Chirp). `useIntroNarrator` and `OfficeLayer` share one Cloud-audio
  fetcher (`officeSpeechClient.js`).
- **Name yourself in the intro.** The welcome step embeds the editable **name badge**
  (`NameTag`, see Day One below). Spoken copy stays voice-first; a **Transcript (CC)**
  toggle at reception, on the isometric arrival / floor bar, and in the Inbox ambience
  controls reveals text for users who cannot listen (or want to read along). Off by
  default so the floor is not buried under balloons when voice is playing; a silent TTS
  beat still falls back to the bubble so the line is never lost. The preference is shared
  (`archislop:office-captions`) across the card tour, isometric arrival, and ambient
  floor speech.
- **Language at reception — and on the desk.** The orientation welcome step includes the
  compact **IntroLocaleToggle** so locale is chosen before check-in. After check-in, the same
  control lives in the desk actions menu as **Language pack** (IT TICKET), next to Concentration,
  because sticky `archislop.uiLocale` survives session wipes and reception only shows sometimes.
- **Skip the ceremony.** A persistent "Skip the ceremony — just let me build →" button dismisses
  the whole orientation (marking it seen) and focuses the empty-state topic input, for anyone who
  has seen the bit or just wants the canvas.

### Day One (the new-hire frame)

The empty state is staged as **your first day at ArchiSlop Corp.** — the user is the
newest architect on the floor and the diagram slots are their work deliverables:

- **`DayOneBadge`** (`apps/web/src/components/DayOneBadge.jsx`) tops the entry cluster:
  "ArchiSlop Corp. · Employee Badge / New Hire — {userTitle}" (the gamification level
  title), one HR gag line, and the rockstar pitch line. Dismiss persists via
  `archislop:day-one-badge-seen` (`officeAmbienceStorage`), like the directory tour.
- **Name badge** — the lanyard carries an editable "HELLO, my name is ___" tag (`NameTag`).
  The chosen name lives in a small reactive store (`userIdentityStore.js`, persisted at
  `archislop:user-name`) and is the source for the `{userName}` slot (`fillOfficeSlots`), so the
  instant the user names themselves the whole office — Linda's welcome, Chad's IMs, the
  orientation greeting, and any canned line carrying `{userName}` — starts addressing them by it.
  Blank badge falls back to a funny default (`resolveUserName` → "Newbie"). The same badge shows
  in the orientation welcome step; both edit the one store, so they stay in sync live. `{userName}`
  threads through `readSlotContext` alongside `{userTitle}`, so it is available to every ambient
  moment, not just onboarding.
- **Assignment chips** — `controls.prompt.starters` entries carry `fromId` (any cast id
  `officeSenderInfo` can resolve — stakeholders and colleagues both work) and `ask` (the
  requester's one-liner). `TopicStarters` renders a From-attribution stack; entries
  without `fromId` (untranslated locale bundles) fall back to plain chips. The
  `label`/`prompt` fields stay the real generation inputs — the fiction never touches
  prompt quality.
- **"Pitch your own initiative"** — the free-prompt placeholder; Deliverable format
  lives in the **Desk tray** (🗄️), walked through on first visit instead of a separate
  empty-state chip row.

Assignments are canned-only for now. Roadmap: an LLM-refreshable assignment inbox
(new requests referencing the user's recent work), budgeted like other office LLM calls.

Roadmap moments: the desk phone nobody answers, desk-drop pastries from Facilities, the fire
drill (all surfaces evacuate for 30 s), the printer that prints one page reading "soon".

### Desk verbs (what _you_ do)

The ambience director decides when the office interrupts you; the **desk verbs** are the other
direction — you deciding to act from your cube. `DeskActionsDock` (ArchiSlop helmet stamp in the
bottom row) opens a **desk-geography** menu wired to `useDeskActions` plus chrome sinks for Outbox,
Settings, Notebook, Concentration, and the XP / People Ops panel. Meet the Office is no longer a
desk verb — first-visit boot and the level panel's "Meet the team" CTA cover the directory.

**Zones on the desk**

| Zone                | Fiction                      | Controls                                                                                              |
| ------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| Your seat           | Personal cognition           | Notebook (Thinking pane), Concentration (Rush job / Deep work → wire `fast` / `quality`)              |
| Work surface        | The deliverable              | Work order, Desk tray (Deliverable format, Facilities, Shredder)                                      |
| People around you   | Colleagues at adjacent desks | Your Team menu (teammates, Talk to team, Call a meeting, Headphones — distinct from inbox Focus Time) |
| Get up              | Leave the chair              | Mail, IM, coffee, outbox (+ Stand up is a primary bottom-nav control)                                 |
| Under the desk / IT | Cubicle plumbing             | Adjust workstation (contractors + code drawer), HR progression                                        |

| Verb                        | Does                                                                                                                                                                                                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📓 Open your notebook       | Toggles the Thinking / insights pane — Your seat; replaces the old Thinking board label                                                                                                                                                                                                               |
| 🎚️ Concentration            | Rush job / Deep work segment on Your seat (was Brain Fast/Quality in Settings). Wire value unchanged: `modelProfile: "fast" \| "quality"`                                                                                                                                                             |
| 👥 Talk to your team        | `advisor.promptNext({})` — in the **Your Team** roster menu (not the desk stamp). Disabled (in-fiction `blocked.noTeam`) on a blank canvas or while streaming/thinking. Explicit click clears Focus Time mute and ambient backoffs so the verb never silently no-ops when the roundtable _can_ speak. |
| 📅 Call a meeting           | Opens the people/group picker (same as inbox / Slop Chat) — also in the **Your Team** roster menu                                                                                                                                                                                                     |
| 🧍 Stand up and look around | Primary bottom-nav control beside the desk stamp (`DeskStandUpButton`) — enters isometric floor mode. Not a menu item. While standing, the same control sits you back down                                                                                                                            |
| 📥 Check your mail          | Opens the inbox popover (`openSignal` counter prop)                                                                                                                                                                                                                                                   |
| 📤 Ship from the Outbox     | Opens the headless Outbox export/share panel (`openSignal`) — no dedicated bottom-row icon                                                                                                                                                                                                            |
| 💬 Open Slop Chat / Message | Messenger history / DM a teammate or colleague                                                                                                                                                                                                                                                        |
| ☕ Get a coffee             | Pushes an unseen coffee scene and auto-accepts it — you walked over, there is no invite                                                                                                                                                                                                               |
| ⚙️ Adjust your workstation  | Opens headless Settings (guest agents, code drawer) — concentration no longer lives here                                                                                                                                                                                                              |
| 📈 Check my HR progression  | Toggles the level-up / People Ops scorecard (`LevelUpInfoPanel`) — always enabled; that panel also links to Meet the team                                                                                                                                                                             |

**Mute distinction.** **Headphones** (in the Your Team roster menu) mutes the advisor roundtable. **Focus Time**
(inbox) mutes office interruptions only — desk verbs still bypass it.

**Over-the-shoulder walk-bys are ambient only.** There is no "Walk the floor" desk verb — like
real life, you cannot decide when somebody leans over your shoulder. The ambience director still
delivers `walkby` moments; desk-mode chrome renders them as a big head dropping in from the top
of the screen (`OfficeWalkBy`). When Narration is on and Captions / CC is off, the speech text is
hidden (you hear them). The desk menu footer exposes the same Narration + Transcript (CC) toggles
as the isometric floor / inbox (`archislop:office-narration`, `archislop:office-captions`).

**Gating differs from the ambient director on purpose.** Verbs skip the random scheduler and
**bypass Focus Time** (it mutes interruptions, not your own initiative). Coffee also bypasses a
streaming agent run — you can step away from a deliverable in progress. Other verbs still respect
one-surface-at-a-time, an open meeting, and a streaming agent run. Blocked verbs stay visible and
disabled with an in-fiction tooltip ("Deploy in progress — nobody leaves their desk." for
deliverable-tied verbs), so the menu never silently no-ops.

**Budget.** Verb-triggered LLM calls have their own cap (`DESK_LLM_CAP` = 3/session) and never
spend the ambient `OFFICE_LLM_MOMENT_CAP`; asking for something yourself should not use up the
office's background allowance. Verbs stamp `lastFiredAt` (so the ambient director backs off
afterwards) but never consume its session caps. XP reuses the existing awards, plus
`walkedFloor` (+2).

Both producers share `apps/web/src/utils/officeMomentDelivery.js` — the canned-bank and
LLM-moment paths live there, so a desk verb and an ambient moment resolve content identically.

## 5. The WG meeting system (flagship)

**Invite** (cadence-driven, max 1/session) or **"Call a meeting"** (inbox, Slop Chat, or Your
Team) → **people/group picker** → **meeting room overlay**: avatar row with speaking highlight,
transcript bubbles pacing in, "Raise hand ✋" input, leave button, and a **minutes card** at the
end.

Calling a meeting works like grabbing people on a real floor:

- **Inbox** — select one or more emails (or open one) → picker opens seeded with those senders and
  the subject(s) as the topic; add or drop anyone before starting.
- **Slop Chat™** — "Call to talk" on the active thread seeds that colleague (Pam still facilitates
  the room); open the roster with no thread to grab a group cold.
- **Your Team / desk** — empty picker with quick groups: Your team, Steering, The floor, Leadership.
- **Ambient calendar invite** — still accepts straight into the room (no picker); roster stays the
  steering draw from `pickMeetingAttendees`.

- **One LLM call generates the whole beat script** (`POST /api/office/meeting`, `scriptVersion: 1`);
  the client paces playback beat-by-beat so it feels live. Join latency hides behind an in-fiction
  gag ("Waiting for the organizer to admit you…"). Deliberately no SSE in v1 — the script exists
  before the first byte is useful, and local timers are trivially testable; `scriptVersion` leaves
  room for a per-turn v2.
- **Beat grammar** (`MeetingBeatSchema`): `procedural` (facilitation), `smalltalk`, `offRails`
  (derailments: tangents, fridge politics, war stories), `substantive` (a concrete diagram idea
  with an `actionPrompt`). Server enforces: 6–14 beats, ≥1 substantive, speakers from the attendee
  list only, facilitator opens and closes.
- **Attendees**: user-picked roster via `CallMeetingPicker` / `normalizeMeetingRoster` (2–8 seats;
  Pam facilitates by default). Ambient invites and the **Steering** preset still draw a
  **steering committee** (`pickMeetingAttendees`) — Pam + 1–2 seniors + one team presenter. The
  showrunner prompt tells seniors to ask for the headline, the cost, and the risk while the
  presenter defends the diagram. Server-side the seat allowlist is `isOfficeSpeaker`
  (`officePersonas.js`), which spans colleagues + stakeholders + `SENIOR_MEETING_VOICES`.
- **Interjections**: the user speaks up to 2× per meeting; `POST /api/office/meeting/interject`
  rewrites only the remaining beats to react to the user's point. On failure, Pam parks the point
  ("Great point — parking-lotting that.") and the meeting rolls on.
- **Outcomes**: substantive beats become **meeting minutes** — posted to the Thinking pane as an
  attributed note (origin "📅 WG Meeting") with per-item "Do it" buttons. Surviving a full meeting
  is +25 XP and an achievement; leaving early is +5 XP and zero judgment (some judgment).

Roadmap: recurring meeting series with memory ("as discussed last sync"), the escalation ladder
(WG → steering committee → CAB hearing, each stricter and less useful; CAB approval unlocks an
achievement), and the all-hands (CEO cameo, everyone attends, nothing is decided, confetti).

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

**Run reactions** are a third producer alongside the ambient director and the desk verbs: when an
agent run lands a fresh diagram, `useOfficeRunReactions` (pure brain `planRunReaction`) has a
colleague **IM** you about the thing you just made — the office reacting to _your_ output rather
than a timer. It shares the canned/LLM IM ladder and the cadence memory (so it backs the ambient
director off), but keeps its own tiny budget: ~55 % chance per run, a 40 s cooldown, **≤5
reactions/session**, of which **≤2 spend an LLM call**. It respects the same hard gates (streaming
run, meeting, advisor bubble, active surface, hidden tab, Focus Time) and stays silent on a blank
canvas — there is no response to react to.

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
tier split) the senior execs. Seat bounds are **2–8** (`MEETING_MIN_ATTENDEES` /
`MEETING_MAX_ATTENDEES` in `packages/shared`). Producer is the client's `CallMeetingPicker` →
`normalizeMeetingRoster` (ambient invites still use `pickMeetingAttendees`); consumer is
`normalizeAttendees`.

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
| User display name (editable, reactive)                                 | `apps/web/src/state/userIdentityStore.js` (`resolveUserName`, persisted `archislop:user-name` via `officeAmbienceStorage.js`), edited through `apps/web/src/components/NameTag.jsx`                                                                                                                                                                                                                                                      |
| Orientation voice showcase (click-only)                                | `apps/web/src/hooks/useIntroNarrator.js` + `apps/web/src/components/IntroVoiceButton.jsx`; shared Cloud-audio fetcher `apps/web/src/utils/officeSpeechClient.js` (also used by `OfficeLayer`)                                                                                                                                                                                                                                            |
| Ambience store (useSyncExternalStore)                                  | `apps/web/src/state/officeMomentStore.js`                                                                                                                                                                                                                                                                                                                                                                                                |
| Director hook (cadence + caps)                                         | `apps/web/src/hooks/useOfficeAmbience.js`                                                                                                                                                                                                                                                                                                                                                                                                |
| Run-reaction hook (colleague pings you about the run you just made)    | `apps/web/src/hooks/useOfficeRunReactions.js` (pure `planRunReaction` brain; App bumps `runSignal` from `triggerCompletionDelight`; delivers an IM through the shared ladder)                                                                                                                                                                                                                                                            |     |
| Shared moment delivery (both producers)                                | `apps/web/src/utils/officeMomentDelivery.js`                                                                                                                                                                                                                                                                                                                                                                                             |
| Desk verbs (player-initiated)                                          | `apps/web/src/hooks/useDeskActions.js` + `apps/web/src/components/DeskActionsDock.jsx`                                                                                                                                                                                                                                                                                                                                                   |
| Cast tiers (team / senior / office)                                    | `apps/web/src/utils/castTiers.js`                                                                                                                                                                                                                                                                                                                                                                                                        |
| Day One entry framing                                                  | `apps/web/src/components/DayOneBadge.jsx` + attributed `controls.prompt.starters` (`TopicStarters.jsx`)                                                                                                                                                                                                                                                                                                                                  |
| Meeting playback state machine                                         | `apps/web/src/hooks/useMeetingPlayback.js`                                                                                                                                                                                                                                                                                                                                                                                               |
| Chrome                                                                 | `apps/web/src/components/OfficeLayer.jsx` (+ `DeskActionsDock`, `OfficeInboxDock`, `OfficeImPing`, `OfficeMessenger`, `OfficeWalkBy`, `CoffeeBreakOverlay`, `OfficeBattleOverlay`, `CallMeetingPicker`, `MeetingInviteToast`, `MeetingOverlay`)                                                                                                                                                                                          |
| Window management (draggable shell + global focus z + center open)     | `FloatingWindow.jsx`, `hooks/useDraggablePosition.js` (+ `utils/viewportBounds.js` `center`), `hooks/useOverlayLayer.js` + `state/overlayStack.js` (global focus elevation so desk menus / level panel / office windows cover each other by last focus), `state/floatingWindowControl.js` (programmatic position reset)                                                                                                                  |
| Office XP reducer                                                      | `applyOfficeEvent` in `apps/web/src/state/runGamificationStore.js`                                                                                                                                                                                                                                                                                                                                                                       |
| Minutes → Thinking pane                                                | `officeMinutesToInsightEntry` in `apps/web/src/utils/appInsightHelpers.js`                                                                                                                                                                                                                                                                                                                                                               |
| SFX                                                                    | `playMailChime` / `playYouveGotMail` / `playImPing` / `playFootsteps` / `playCalendarDing` / `playMeetingJoinBlip` / `playBattleBell` / `playVictoryDing` + soundscape cues (`playKeyboardClatter` / `playMouseClicks` / `playPaperShuffle` / `playDistantPrinter` / `playChairSqueak` / `playDeskPhone` / `playWaterCooler` / `playEspressoMachine` / `playVendingMachine` / `playElevatorDing`) in `apps/web/src/utils/agentChimes.js` |
| Walk-by / meeting / battle / coffee narration                          | `apps/web/src/utils/officeNarration.js` + `POST /api/office/speak` (`apps/server/src/agents/officeTts.js` Chirp3-HD default with a Chirp3-HD → Neural2 → WaveNet → Web Speech fallback ladder; `OFFICE_TTS_VOICE_TIER` pins the ladder top); emails/IMs stay silent; inbox Narration toggle                                                                                                                                              |
| Narration roadmap (TTS follow-ups)                                     | [`docs/office-narration-roadmap.md`](office-narration-roadmap.md)                                                                                                                                                                                                                                                                                                                                                                        |
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
   the fictional cast via the session event bus. Superseded by the full multi-human design spec:
   [`docs/multi-human-office.md`](multi-human-office.md) (backburnered; adopted decisions + vocabulary).
9. **Desk booking / hybrid days** — some days a colleague "isn't in" and IMs instead of walk-bys.
10. **Meeting escalation ladder** — WG → steering committee → CAB hearing; CAB approval achievement.
11. **The Consultant's invoice** — while the Consultant is in any meeting, the Damage Report ticks
    visibly per minute.

## 11. Agency & reactivity doctrine (adopted 2026-07-25)

Decisions from the design grilling; canonical vocabulary in [`GLOSSARY.md`](../GLOSSARY.md)
(entries: _Sign-off rule / one-producer model_, _Pitch_, _Reactive vs. ambient_, _Office log_,
_Their own work_). The isometric floor design is [`office-isometric-mode.md`](office-isometric-mode.md);
the backburnered multi-human future is [`multi-human-office.md`](multi-human-office.md).

- **One producer, many commentators.** The human's pipeline is the sole producer of slot
  content. The built-in cast (all tiers) never generates DSLs or code and never initiates
  runs — they comment, pitch, and chat. Contractors (explicitly invited external MCP agents)
  keep their validated-proposal path. The discovery loop stays exactly as-is: the user
  decides what they work on.
- **Pitch / proposal split.** A cast suggestion is a **pitch** — instruction + rationale,
  attributed, persistent as a card in the unified review queue; accepting it triggers a run
  through the user's own pipeline, attributed to the pitcher. Today's ephemeral "Do it"
  `actionPrompt` is the pitch's ancestor. Concrete validated **proposals** remain
  contractor-only.
- **Reactive vs. ambient spend.** Ambient (timer-driven) content stays canned-heavy on the
  existing tiny budget. _Reactive_ content — anything the user initiates or directly answers
  (IM/DM replies, email replies, walk-by responses, meeting interjections) — is **always
  LLM** in persona voice, under a generous per-session reactive cap, degrading in character
  when exhausted ("gotta run, sprint planning 🏃"), never with an error. Carve-outs by
  character design: Ticket Bot Dave stays 100% canned (being a bot is the bit); battles and
  coffee scenes stay canned theater. Note the split is about **who started it**, not about where
  somebody is standing: a colleague who has ambiently wandered to the printer costs nothing while
  they are loitering, and walking up to talk to them (isometric slice 12) is ordinary reactive
  spend through the same `imSomeone` path — you crossed the room for it, which is what makes
  reactive spend self-limiting.
- **Context contract.** Reactive calls carry: token-capped per-character thread memory; the
  **office log** (a rolling client-built digest of runs, pitches, meetings, notable
  moments — what makes six voices one office); deliverable context (source, labels, last-run
  summary); persisted across reloads (capped localStorage). **DM privacy:** a character never
  sees the user's threads with other characters.
- **Their own work.** Each character carries a slowly-evolving _fictional_ workload they
  reference and can discuss when asked — conversational color (and, later, desk-peeking
  visuals on the floor), never a real pipeline.

12. ~~**Locale bundles**~~ — ✅ shipped: the full office copy bank (colleague titles, canned
    emails/IMs/walk-bys/coffee scenes/battle scenes, meeting copy, chrome strings, quick replies,
    `{label}` slot fallbacks) localizes to en-AU / zh-CN / zh-TW via `office.*.js` bundles merged
    in `getUiLocaleBundle.js` and applied through `setActiveOfficeBundle`. Template ids stay
    aligned across locales so the seen-template memory survives locale switches. Server-side (LLM)
    moments now follow the same locale — see item 16.
13. ~~**Cubicle battles**~~ — ✅ shipped (see §4 "Cubicle battles"). Future escalations: best-of-three
    rematches with a running score, stakeholders wading in as tag-team partners, an LLM battle mode
    that argues about the user's actual diagram, and betting XP on the outcome before the first line
    lands.
14. ~~**Walk-by / meeting narration (Web Speech)**~~ — ✅ shipped: per-cast pitch/rate profiles in
    `officeNarration.js`; emails stay silent; inbox Narration toggle.
15. ~~**Google Cloud WaveNet TTS + overheard battles/coffee**~~ — ✅ shipped: `POST /api/office/speak`,
    `officeTts.js` WaveNet cast map, client prefers cloud MP3 with Web Speech fallback; cubicle
    battles and coffee scenes are spoken (emails/IMs stay silent). Voices since upgraded again to a
    **Chirp3-HD default tier** for _every_ locale — crucially including the Chinese ones, since
    Chirp3-HD ships cmn-CN / cmn-TW voices that Neural2 never had. Each `/speak` walks a runtime
    **fallback ladder** — Chirp3-HD → Neural2 → WaveNet → the client's Web Speech "system voice" —
    so any single tier's outage degrades silently. `OFFICE_TTS_VOICE_TIER` pins the top of the
    ladder (`chirp3` default, `neural2`, or `wavenet` for full switchback). Chirp3-HD carries the
    per-persona rate fingerprint but not pitch (the engine ignores it). Polish + caching ladder:
    [`office-narration-roadmap.md`](office-narration-roadmap.md).
16. ~~**LLM moments speak the UI locale**~~ — ✅ shipped: the client sends `uiLocale`
    (`officeDialogueLocale()`) on `/api/office/moment`, `/meeting`, and `/meeting/interject`;
    `buildOfficeLanguageRule` adds the directive to the system prompt and
    `buildOfficeLanguageReminder` restates it as the **last line of the user prompt**. Both
    placements are needed: with the rule only in the system prompt, short IM moments still came back
    in English because the persona voice blocks quote English catchphrases ("sorry if this is a dumb
    question") and the model copied them through. This is deliberately _not_ `promptLanguage.ts` —
    that infers language from the diagram's own script, which would keep the office English whenever
    the diagram is English. Cast language and TTS voice now agree, so `cmn-CN-Wavenet-*` reads
    Chinese text instead of pronouncing English phonetically.
17. ~~**Meetings you can look away from**~~ — ✅ shipped: `MeetingOverlay` has a **docked** mode
    (`🗕 Look at my screen`, persisted via `readOfficeMeetingDocked`) that shrinks the room to a
    corner card, drops `aria-modal`, and sets `pointer-events: none` on the backdrop so clicks reach
    the canvas — a real meeting doesn't confiscate your screen. Escape docks rather than leaves, so a
    stray keypress can't kill an in-flight meeting. On phones the docked room becomes a bottom sheet.
18. ~~**Slop Chat™ messenger**~~ — ✅ shipped: `imHistory` in `officeMomentStore.js` keeps every IM
    (capped at `IM_HISTORY_MAX`) independently of the TTL-expiring toast stack, so a ping missed in
    its nine seconds is still readable. `OfficeMessenger.jsx` renders per-colleague threads with
    unread counts, quick replies, and a composer that routes through the desk's existing
    `imSomeone` verb — replies come back through the same LLM/canned ladder as any other IM. Also
    non-modal. Follow-ups: per-thread "poke" targeting a specific colleague, and persisting history
    across reloads.
19. ~~**Coherent window management**~~ — ✅ shipped (taskbar removed): every floating office surface
    shares one window model. The shell is `FloatingWindow` (drag by the titlebar via
    `FloatingWindowDragHandle`, click-to-focus with a focus ring, viewport-clamped placement that
    reserves the mobile bottom chrome + safe areas, centered open defaults, and per-window position
    memory in `sessionStorage`). Stacking uses a **global focus z** in `overlayStack.js` (above the
    legacy group bands) so opening a desk menu / ArchiSlop level panel covers office windows, and
    focusing a floating window brings it back to the front — like a real windowing UI. Desk menus
    and the level panel portal to `document.body` so they escape the low `.bottom-chrome` /
    `.top-shell` stacking contexts. There is no separate Windows/Tidy-up bar; users drag and focus
    windows themselves. Follow-ups: minimise, remembering positions across reloads (currently
    per-session), and snapping a stranded window to the nearest foldable segment on unfold.
