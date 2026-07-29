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

| Tier       | Who                                                                   | How they reach you                                                                                                                                                                                   |
| ---------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **team**   | gilfoyle, dinesh, erlich, russ, jared, richard (+ `barker` dual-home) | Proactive roundtable (`ADVISOR_ORDER`) + agent actions. Full-weight peers; Barker at **throttled** pick weight (`ADVISOR_PICK_WEIGHTS.barker` = 0.5) — ≈8% of a long rotation against ≈15% per peer. |
| **senior** | barker (Jack), ciso (Sasha), belson (Gavin), cfo (Diane)              | Steering meetings + ≤1 high-stakes email/session. Never ambient walk-bys/IMs. Belson scarcer than Barker — never roundtable; Jack reports to him.                                                    |
| **office** | intern, scrumMaster, helpdesk, facilities, hr, greybeard              | Emails, IMs, walk-bys, coffee, battles. The floor around you.                                                                                                                                        |

Boundary rules worth keeping: senior stakeholders are excluded from
`OFFICE_{WALKBY,EMAIL,IM}_LLM_CAST` and from the canned day-to-day banks — their one ambient
outlet is `SENIOR_EMAIL_TEMPLATES`. They **may still be overheard** in coffee/battle set pieces
(Sasha's DNS postmortem, the Friday-deploy war): overhearing leadership argue is not the same as
leadership pinging your desk.

### Senior stakeholders

| id       | Name         | Title                                | Emoji | Bit                                                                                                                                                                                                                                                          |
| -------- | ------------ | ------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `barker` | Jack Barker  | CEO — Success Theater                | 🧘    | **Named Silicon Valley replication** — 6th radial advisor; dual-home team+senior; throttled roundtable (see note)                                                                                                                                            |
| `ciso`   | Sasha        | CISO — The Department of No          | 🔐    | Everything is an attack surface; runs the phishing sims                                                                                                                                                                                                      |
| `belson` | Gavin Belson | CTO — Makes the World a Better Place | 🌐    | **Named Silicon Valley replication** (Session 8; ex-Marcus/`cto`) — messianic vision with a two-gear register (measured manifesto **or** cold fury / clipped swears when thinking is undersized); scarcer than Barker; Jack reports to him; never roundtable |
| `cfo`    | Diane        | CFO — The Budget Is a No             | 🧮    | Every box is a cost center; asks what the diagram costs per month                                                                                                                                                                                            |

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
> **Gavin Belson** (`belson`, Session 8 — shipped), who stays harder to reach (senior-only; never
> roundtable). Status: **local experiment** — before public deploy, decide real names vs
> legally-distinct aliases. Locked roster: Erlich → `erlich` (shipped), Gilfoyle → `gilfoyle` (shipped),
> Dinesh → new seventh engineer seat (`dinesh`, gilfoyle-class, core team + battle dual-home),
> Jared → `jared` (shipped), Russ → `russ` (shipped, ex-`goMad`), Richard → `richard` (shipped, ex-`explain`, comment-only), Belson → `belson` (shipped; Marcus/`cto` retired).
> Single source of truth:
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
>
> **The engineers get different instincts (2026-07-27).** Cloned budgets left the two seats doing
> the same job in different accents, so each now has a **tendency** — what it reaches for first when
> you ask for help. Jack Barker is the seat that makes your diagram _smaller_; both engineers make
> it _bigger_, but not in the same way. **Gilfoyle draws what is already true and simply undrawn** —
> the dependency nobody admitted, the box quietly doing two jobs; he invents nothing, the drawing
> was lying and he corrected it. **Dinesh draws what has not survived contact yet** — the failure
> branch nobody drew, the handoff with no owner, the trigger someone will misread; he is the one who
> gets paged when the happy path ends. Which is the whole rivalry in one line: Gilfoyle thinks
> Dinesh is drawing hypotheticals, and Dinesh knows Gilfoyle's "it was always there" is the thing
> that woke him at 3am. It is a **tendency, not a rule** — both can still make any correct small
> fix, and the hard node/edge caps stay shared in `mermaidTransformPolicy.ts`. See §1b of
> [the recipe](recipes/replicate-tv-character.md) for the axis table and what it cost to measure.

> **Jared inherits the Auditor seat (Session 5, 2026-07-28).** The fifth named replication and the
> first **analyze-path** inheritance: **Jared Dunn** took over the retired generic `critique` id —
> `DiagramAnalyzeSchema.kind`, advisor analyze kind, radial Critique action (label kept as the
> generic verb), hotkey `C`, mascot row, floor desk, TTS/narration, XP variant. The seat contract
> travelled unchanged (findings-only; no diagram mutation; temp 0.5) and only the voice was
> re-skinned: anxious earnestness, soft openers that never soften the finding, process and
> accountability as religion. Cards live in `STAKEHOLDER_MEETING_VOICES.jared` and
> `ADVISOR_PERSONAS.jared`; harness profile: `node scripts/barker-fidelity.mjs jared`. Full-weight
> roundtable peer. The Critique _feature_ (A2UI checklist, Fix-from-critique, MCP critique-map)
> keeps its product name — only the persona seat id moved.

> **Russ inherits the Go Mad seat (Session 6, 2026-07-28).** The sixth named replication: **Russ
> Hanneman** took over the retired generic `goMad` id wholesale — `TransformModeSchema` mode,
> depth/streak escalation (`russDepth` / `russStreak`, ex-`goMadDepth`), radial action with streak
> labels (Russ → This Guy Ships → Tres Commas → Radio Silence), hotkey `M`, mascot row, floor desk,
> TTS/narration, XP variant, ceremony FX. The seat contract travelled unchanged (subject-rooted
> escalation; type/template roulette by depth; hottest advisor temp 1.45; transform temp ramp
> 0.95→1.15) and only the voice was re-skinned: tres commas, tequila, "this guy SHIPS", Radio
> Silence as rare war story, mocks empty synergy-speak; TV-Russ swearing OK (`fuck` / what the
> fuck when hyped) — bro swagger, never sexual/explicit, never mean to the user. Cards live in
> `STAKEHOLDER_MEETING_VOICES.russ` and `ADVISOR_PERSONAS.russ`; harness profile:
> `node scripts/barker-fidelity.mjs russ`. Full-weight roundtable peer.

> **Richard inherits the Explain seat (Session 7, 2026-07-28).** The seventh named replication and
> another **analyze-path** inheritance: **Richard Hendricks** took over the retired generic
> `explain` id — `DiagramAnalyzeSchema.kind`, advisor comment-only kind, radial Explain action
> (label kept as the generic verb), hotkey `E`, mascot row, floor desk, TTS/narration, XP variant,
> dumb-down ladder. The seat contract travelled unchanged (comment-only; never mutates the canvas;
> ADR-0010; temp 0.75) and only the voice was re-skinned: anxious pattern-naming, hedge-then-precision,
> over-explain catch. Cards live in `STAKEHOLDER_MEETING_VOICES.richard` and
> `ADVISOR_PERSONAS.richard`; harness profile: `node scripts/barker-fidelity.mjs richard`.
> Full-weight roundtable peer. The Explain _feature_ (structured sections, dumb-down, label "?")
> keeps its product name — only the persona seat id moved.

> **Belson inherits the CTO seat (Session 8, 2026-07-28).** The eighth named replication and the
> first **senior-only** one (§4a): **Gavin Belson** took over the retired Marcus/`cto` display id
> as `belson` — `SENIOR_MEETING_VOICES`, `SENIOR_STAKEHOLDERS`, `MEETING_SENIOR_POOL`, senior email
> bank, TTS/narration, persona face, floor leadership desk. No advisor seat, no roundtable, no
> transform mode: scarcer than Barker by design; fiction: Jack reports to him. Voice card is
> two-gear Belson — measured messianic altitude **or** cold fury with clipped swears when the
> vision is undersized (altitude, manifesto cadence, enlarge-the-vision) rather than the old
> Marcus homage. Harness profile: `node scripts/barker-fidelity.mjs belson` (`advisor:
false`, `seniorEmail: true`).

### Shipped colleagues (v1)

| id            | Name            | Title                             | Emoji | Bit                                                                                                  |
| ------------- | --------------- | --------------------------------- | ----- | ---------------------------------------------------------------------------------------------------- |
| `intern`      | Chad            | The Intern (Unpaid, Strategic)    | 🧃    | Reply-alls the apology for the reply-all; naive questions that are accidentally profound ~1 in 5     |
| `scrumMaster` | Pam             | Agile Coach — CSM, CSPO, SAFe 6.0 | 📅    | Way-too-friendly facilitator cheese; everything is a ceremony; parking-lot enthusiast                |
| `helpdesk`    | Ticket Bot Dave | IT Helpdesk — Tier 1 (of 1)       | 🖥️    | Closes tickets as duplicates of themselves; canned-email workhorse (zero LLM)                        |
| `facilities`  | Gary            | Facilities & Fridge Czar          | 🧹    | ALL-CAPS fridge cleanouts; controls the thermostat with an iron fist                                 |
| `hr`          | Linda           | People Ops Business Partner       | 📎    | Weaponized cheerfulness; 847-days-overdue trainings; Craig's birthday card                           |
| `greybeard`   | Ulrich          | Staff Engineer Emeritus           | 🧓    | "We tried that in 2009"; darker mainframe punchlines; unsettlingly good advice                       |
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

1. **Linda's welcome email** — introduces the whole floor by name/role, plus the desk menu
   Focus / Noise / Voice escape hatches, and greets the user by their chosen name (`{userName}`). Timed
   ~1.5 s after the user's first pointer/key gesture (so the sound gate is open and the
   **"You've got mail!"** announce — speech synthesis, chime-only fallback — actually plays),
   with a 15 s no-interaction fallback.
2. **Chad's welcome IM** ~8 s later (also on a first-name basis).

The entry screen additionally mounts the **office directory** (`OfficeDirectory`): an
interactive game-style **"Meet the Team"** orientation. **First run it is the entire
app is** — nothing else mounts until the tour is dismissed or skipped — then the empty
state, Day One badge, and the rest of the chrome appear. The cinematic flow is reception
check-in → name badge with Linda's auto-voiced welcome → Meet the team
auto-plays each intro in walk order (Dinesh, Erlich, Jared, Richard, Barker — **not**
Gilfoyle, Russ, or a second Linda self-intro; Linda's distinct closing handoff plays
last) → auto sit at your desk / desk wizard, persisted via
`archislop:office-directory-seen`; afterwards reopen via the **desk verb** once you
have canvas content, so everybody can introduce themselves again anytime.
On the isometric floor the same beats are a **walk**: you leave reception, visit each
desk with the camera zoomed in and following, then walk home while Linda's closing
plays, and land in the desk wizard.
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

| Zone                | Fiction                      | Controls                                                                                 |
| ------------------- | ---------------------------- | ---------------------------------------------------------------------------------------- |
| Your seat           | Personal cognition           | Notebook (Thinking pane), Concentration (Rush job / Deep work → wire `fast` / `quality`) |
| Work surface        | The deliverable              | Work order, Desk tray (Deliverable format, Facilities, Shredder)                         |
| People around you   | Colleagues at adjacent desks | Your Team menu (delegate to a teammate, Huddle up, Summon a sync)                        |
| Get up              | Leave the chair              | Mail, IM, outbox (+ Stand up is a primary bottom-nav control; coffee is on the floor)    |
| Under the desk / IT | Cubicle plumbing             | Adjust workstation (contractors + code drawer), HR progression                           |

| Verb                        | Does                                                                                                                                                                                                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📓 Open your notebook       | Toggles the Thinking / insights pane — Your seat; replaces the old Thinking board label                                                                                                                                                                                                         |
| 🎚️ Concentration            | Rush job / Deep work segment on Your seat (was Brain Fast/Quality in Settings). Wire value unchanged: `modelProfile: "fast" \| "quality"`                                                                                                                                                       |
| ↳ Delegate to a teammate    | A roster row hands the work to a **person**: `runTransform` / `runAnalyze` for that persona, with an arrow, a "Delegate to {name}" accessible name, and a "{name} took it" acknowledgement for `HANDOFF_ACK_MS`. Same verbs as the radial menu; the difference is that somebody's name is on it |
| 🤝 Huddle up                | Pulls the whole `CAST_TIERS.team` tier around your canvas, face to face — see § 5b. In the **Your Team** roster menu                                                                                                                                                                            |
| 📅 Summon a sync            | Opens the people/group picker (same as inbox / Slop Chat) — also in the **Your Team** roster menu. Toggle **Book the glass room** vs **Slap on headsets**; blank canvas is fine                                                                                                                 |
| 🧍 Stand up and look around | Primary bottom-nav control beside the desk stamp (`DeskStandUpButton`) — enters isometric floor mode. Not a menu item. While standing, the same control sits you back down                                                                                                                      |
| 📥 Check your mail          | Opens the inbox popover (`openSignal` counter prop)                                                                                                                                                                                                                                             |
| 📤 Ship from the Outbox     | Opens the headless Outbox export/share panel (`openSignal`) — no dedicated bottom-row icon                                                                                                                                                                                                      |
| 💬 Open Slop Chat / Message | Messenger history / DM a teammate or colleague                                                                                                                                                                                                                                                  |
| ⚙️ Adjust your workstation  | Opens headless Settings (guest agents, code drawer) — concentration no longer lives here                                                                                                                                                                                                        |
| 📈 Check my HR progression  | Toggles the level-up / People Ops scorecard (`LevelUpInfoPanel`) — always enabled; that panel also links to Meet the team                                                                                                                                                                       |

**Two postures, not four checkboxes** (adopted 2026-07-29). The desk menu footer used to carry
**Focus / Noise / Voice / CC**, and the Your Team roster carried a fifth control, Headphones, which
muted the advisor roundtable. That was two mute concepts in two menus for one intent. It is now:

| Posture           | Question it answers              | What it does                                                                                                                                                                                                                                                                             |
| ----------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🎧 **Headphones** | _How_ does the office reach you? | OFF (default) = you hear it: narration on, room tone on, captions off. ON = you read it: both off, captions on. A **macro** over `narration`/`soundscape`/`captions`, not a fifth flag — every consumer reads the same fields it always did. Persisted at `archislop:office-headphones`. |
| 🔕 **Focus**      | _Whether_ it reaches you at all. | The office DND. Holds every ambient moment, the welcome flow, run reactions, room tone, narration — **and now the advisor roundtable**, absorbing the old Headphones button. `archislop:office-focus-time`.                                                                              |

**Why Focus is not folded into Headphones.** Focus is the broadest kill switch in the app. If
headphones-on also stopped interruptions, read-first mode would have nothing left to read, and
there would be no way to get quiet without switching the office off. The advisor mute rides on
`isMuted` rather than `pause` so that an explicit ask ("Grab whoever is free", delegating, huddling)
still clears it via `promptNext` — the "your own initiative bypasses Focus Time" rule below.

Per-scene **CC** buttons still exist on the floor (`FloorTopBar`, `FloorArrival`, `OfficeDirectory`)
and nudge `captions` directly. Headphones sets the posture; it does not own captions forever.

**Over-the-shoulder walk-bys are ambient only.** There is no "Walk the floor" desk verb — like
real life, you cannot decide when somebody leans over your shoulder. The ambience director still
delivers `walkby` moments; desk-mode chrome renders them as a big head dropping in from the top
of the screen (`OfficeWalkBy`). When Voice is on and CC is off, the speech text is hidden (you
hear them). What you _can_ summon is the whole team at once — see § 5b. Coffee is a floor prop —
stand up and walk to the machine.

**Gating differs from the ambient director on purpose.** Verbs skip the random scheduler and
**bypass Focus Time** (it mutes interruptions, not your own initiative). Floor coffee also bypasses a
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

## 5. The WG sync system (flagship)

**Invite** (cadence-driven, max 1/session) or **"Summon a sync"** (inbox, Slop Chat, or Your
Team) → **people/group picker** with a modality toggle → playback:

| Modality                             | Desk chrome                                 | Floor                                                                                 |
| ------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Book the glass room** (`physical`) | Call window while seated                    | Auto **Stand up**, pan/zoom to the glass room; attendees + you seated at the table    |
| **Slap on headsets** (`remote`)      | Call window (default for inbox / Slop Chat) | Everyone stays at their desk wearing headsets; speaking bubble above the active chair |

Calling a sync works like grabbing people on a real floor:

- **Inbox** — "Hop on a call" from one or more emails → picker opens seeded with those senders,
  topic from subjects, modality defaults to **headsets**.
- **Slop Chat™** — "Call to talk" on the active thread seeds that colleague (headset default);
  open the roster with no thread via "Summon a sync".
- **Your Team / desk** — **Summon a sync** opens the empty picker (defaults to glass room) with
  quick groups: Your team, Steering, The floor, Leadership.
- **Ambient calendar invite** — still accepts straight into the **glass room** (no picker).

Blank canvas is allowed: huddles and syncs no longer require a diagram. When the slot is empty the
script ribs you for not having started and substantive beats suggest a first stroke.

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

## 5b. The team huddle (the face-to-face one)

**"Huddle up" in the Your Team menu** → the six `CAST_TIERS.team` members snap in from all four
edges of the canvas and each says one thing about the diagram, one at a time, then everyone goes
back to their desk. It is the counterpart to a summoned sync (inbox / Slop Chat / Summon a sync):
a sync is either _in the glass room_ or _on headsets_ (picker, roster, optional agenda); a huddle is
_at your monitor_ (no picker, no agenda, no facilitator, and Barker stays Upstairs — you huddle with
peers). Blank canvas is allowed — then they rib you for not having started. Starting a huddle closes
the team roster.

- **Seated before scripted.** `startOfficeHuddle(attendees)` draws the ring at `phase: 'gathering'`
  the moment you click, then `POST /api/office/huddle` fills it in and flips to `'speaking'`. The
  crowd arriving _is_ the feedback that the click landed, so nothing waits on the LLM.
- **Click a head to pin their Do-it.** Any teammate's face is a hit target. If they already have a
  remark (scripted or on-spot), their bubble pins so you can go back to an earlier suggestion and
  delegate. If they have not said anything yet, the click fetches an on-spot suggestion via
  `/api/advisor/suggest` into `huddle.suggestions` (beside the spoken queue, so pacing does not
  restart).
- **Do it keeps the ring watching.** Adopting a prompt sets `phase: 'watching'`, opens the notebook,
  and freezes turn-taking (`useScenePacing` `paused`) while faces stay seated. When the agent run
  finishes, the huddle resumes `speaking` from where it left off.
- **Motion is the deliberate opposite of the walk-by.** The walk-by is one head dropping in over
  720 ms and then looming at you forever (`office-shoulder-loom`) — it is an interruption you did
  not ask for. The huddle snaps six faces in at **240 ms with a 55 ms stagger** and then **holds
  still**: no idle loom, because you called this one. Per-side keyframes
  (`office-huddle-in{,-bottom,-left,-right}`) live inside `prefers-reduced-motion: no-preference`,
  with a plain fade under `reduce`.
- **One remark each, in attendee order.** `parseHuddleScript` re-sorts the model's beats into the
  order the seats were drawn, drops speakers who were not invited, and keeps the first line per
  person — a duplicate or a stranger would light the wrong face.
- **Voice-first, same rule as everywhere else.** Voice on + CC off shows only "{name} is talking"
  and never the line. `HuddleOverlay` always hands `useScenePacing` a narrator (a wrapper that
  reports `spoken:false` when voice is off) — otherwise the hook's silent branch reveals every line
  at once, which is right for a card of overheard chat and wrong for a ring of faces.
- **"Hard stop ✋"**, Escape, or the last remark timing out (`HUDDLE_TAIL_MS`) all end it. A huddle
  that got as far as speaking (or watched a Do-it) is worth `huddled` XP; one you cut short before
  anyone spoke is not.
- **Replaces the advisor bubble while it runs.** Ambient advising is retired entirely; `huddleActive`
  still feeds `useAdvisorPause` so nothing talks over the six you called. An active huddle also
  counts in `hasActiveOfficeSurface()`, so the ambience director and desk verbs back off.
- **Cost:** one LLM call per huddle, `purpose: 'meeting'` (fast tier), exactly like `/meeting`, plus
  optional `/api/advisor/suggest` calls when you click a silent head. An empty or failed script
  dissolves the ring silently — no error toast.
- **ADR-0011 status: desk renderer only, for now.** The state is presentation-agnostic in
  `officeMomentStore`, so the floor version (the six physically ringing your desk) is a clean
  follow-up slice. Until it exists, huddling while you are standing **sits you down first** rather
  than starting a scene nobody can see.

Code: `apps/server/src/routes/office.js` (`createHuddleHandler`), `officePersonas.js`
(`buildHuddleSystemPrompt` / `buildHuddleUserPrompt` / `parseHuddleScript`),
`apps/web/src/hooks/useHuddlePlayback.js`, `apps/web/src/components/HuddleOverlay.jsx`,
huddle slice in `apps/web/src/state/officeMomentStore.js`.

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
`agentChimes.js` / `officeCueSamples.js`, all quieter than any event chime.

**Diegetic prop cues.** Walking up to a usable floor prop fires the matching sample at near
gain (centred, louder): the **printer** plays `printer` then `paper` ~1.6 s later (the page that
says "soon"); accepting a **coffee** break plays `espresso`. The **water cooler** is scenery-only
today (§6 rule 21 of the isometric doc — no standable mark in the crowded kitchen corner), so its
sample stays ambient-only ("someone at the cooler down the hall"). Standing up / sitting down
plays `chair`. Shared path: `officeCuePlayers.js` (`playOfficeCue` / `playPropCues`).

**Sampled where synthesis loses.** Seven of those ten cues — keyboard, paper, printer, chair,
watercooler, espresso, vending — now play baked recordings from
`apps/web/src/assets/audio/cue-*.mp3` (139 KB for the set) via `officeCueSamples.js`. They are the
broadband mechanical and textural ones, where oscillators read as synth buzz rather than as a room.
The other three keep their synthesized versions **on purpose**: the elevator ding, the desk phone
ring and the mouse click _are_ tones, and synthesis is the right tool for a bell.

Sampling is best-effort, never load-bearing. `playCueSample` reports whether it played and
`playOfficeCue` falls back to the synthesized cue whenever it did not — while the buffer is still
decoding (the first play of each cue always falls back, and warms the sample for the next one), if
the asset is missing, or where Web Audio is unavailable. A cue is never dropped waiting on a
download. Each asset is peak-normalized to −3 dBFS, so its playback gain is just the hand-tuned
synth `peakGain` divided by 0.708 — the sampled cue peaks exactly where its predecessor did, which
keeps the balance against the event chimes that was already tuned by ear. Desk textures (keyboard /
paper) sit a notch louder so typing reads as the room's heartbeat. Diegetic `near` plays multiply
gain and centre the pan. Per play, rate and gain jitter slightly and ambient set pieces are panned
randomly across the room.

The pure brain (`officeSoundscape.js`,
mirroring `officeCadence.js`) enforces a ~4 s quiet start, a 7–15 s warm-up gap for the first
~2 min (the room fades in), then a jittered 18–38 s cruise gap; while you are **at your desk** the
brain heavily prefers keyboard/mouse/paper, and on the **floor** kitchen/printer set pieces step
forward. The `useOfficeSoundscape` director holds while the tab is hidden or Focus Time is on and
plays through App's sound gate (global sound toggle + user gesture). Defaults ON with a persisted
opt-out toggle ("Soundscape" / Noise) next to Focus in the desk menu footer. Zero LLM, zero network.

**Room-tone bed.** Underneath those cues runs one continuous ~30 s seamless loop of open-plan
office ambience — distant unintelligible conversation over a soft air-handling hum. The cues are
_events_ in the room; the bed is the room. It is the layer's **only binary asset**
(`apps/web/src/assets/audio/office-room-tone.mp3`, 240 KB, stereo — the loop has real width and
collapsing it to mono flattens the room), generated once at build time and committed; see
[`docs/audio-assets.md`](audio-assets.md). Still zero LLM and — after one cache-hit fetch — zero
network, so the office keeps working offline.

`useOfficeRoomTone` owns the lifecycle and `officeRoomTone.js` owns the playback. The director is
declarative, not event-driven: one `sync()` reads whether the room should be audible (Soundscape
on, Focus Time off, tab visible, sound gate open) and makes reality match. It runs on every store
change — so Focus Time and the Soundscape toggle mute the bed _instantly_ rather than waiting out
a tick — on `visibilitychange`, and on a 5 s tick that self-heals the one transition nothing
notifies us about: the sound gate opening when the user first interacts with the page. For that
last case `playChime` now reports whether it let the call through, so muting the app mid-session
also stops a bed that is already looping. The bed fades in over 3 s, fades out over 1.2 s, and
**ducks to a third of its level while a colleague is speaking** so narration stays intelligible.

Level lives in one constant, `ROOM_TONE_GAIN` in `officeRoomTone.js` — the bed is mixed to sit
under the cues (which peak at 0.006–0.014), present but never competing.

Event SFX on top of the room tone: the session's first email plays **"You've got mail!"**
(speech synthesis via the localized `mailAnnounce` line; plain chime fallback), walk-bys get
approaching **footsteps** plus the colleague **speaking the line** when Narration is on (per-cast
pitch/rate profiles in `officeNarration.js`; emails stay silent — nobody reads your inbox out
loud), meeting invites a **calendar bing-bong**, accepting a coffee break fires the espresso
machine, entering a cubicle battle rings the **boxing bell**, and settling one lands a small
**victory sting**. WG meeting beats are paced to the spoken line when Narration is on (fallback
to the reading-pace timer when synthesis is muted or unavailable). The desk menu's **Voice**
toggle (defaults ON, persisted opt-out) sits next to Noise; Focus cancels in-flight
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

| Piece                                                                  | Path                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared schemas                                                         | `packages/shared/src/officeScript.ts`                                                                                                                                                                                                                                                                                                                                                                                                           |
| Colleague voices + prompt builders + parsers + model factory           | `apps/server/src/agents/officePersonas.js`                                                                                                                                                                                                                                                                                                                                                                                                      |
| Routes                                                                 | `apps/server/src/routes/office.js` (mounted at `/api/office`)                                                                                                                                                                                                                                                                                                                                                                                   |
| Cast + canned template banks + chrome copy                             | `apps/web/src/utils/officeCast.js`                                                                                                                                                                                                                                                                                                                                                                                                              |
| Locale bundles (en-AU, zh-CN, zh-TW office copy)                       | `apps/web/src/i18n/locales/office.*.js` → merged in `getUiLocaleBundle.js`, applied via `setActiveOfficeBundle` (UiLocaleContext)                                                                                                                                                                                                                                                                                                               |
| Pure cadence brain                                                     | `apps/web/src/utils/officeCadence.js`                                                                                                                                                                                                                                                                                                                                                                                                           |
| Soundscape brain (pure) + director hook                                | `apps/web/src/utils/officeSoundscape.js`, `apps/web/src/hooks/useOfficeSoundscape.js`                                                                                                                                                                                                                                                                                                                                                           |
| DND + soundscape + narration + cadence + welcome/directory persistence | `apps/web/src/utils/officeAmbienceStorage.js`                                                                                                                                                                                                                                                                                                                                                                                                   |
| First-run welcome sequence                                             | `apps/web/src/hooks/useOfficeWelcome.js` (beats: `OFFICE_WELCOME_EMAIL` / `OFFICE_WELCOME_IM` in `officeCast.js`)                                                                                                                                                                                                                                                                                                                               |
| Entry-screen office directory                                          | `apps/web/src/components/OfficeDirectory.jsx` (mounted in App's entry cluster; colleague `blurb`s in `officeCast.js`)                                                                                                                                                                                                                                                                                                                           |
| User display name (editable, reactive)                                 | `apps/web/src/state/userIdentityStore.js` (`resolveUserName`, persisted `archislop:user-name` via `officeAmbienceStorage.js`), edited through `apps/web/src/components/NameTag.jsx`                                                                                                                                                                                                                                                             |
| Orientation voice showcase (click-only)                                | `apps/web/src/hooks/useIntroNarrator.js` + `apps/web/src/components/IntroVoiceButton.jsx`; shared Cloud-audio fetcher `apps/web/src/utils/officeSpeechClient.js` (also used by `OfficeLayer`)                                                                                                                                                                                                                                                   |
| Ambience store (useSyncExternalStore)                                  | `apps/web/src/state/officeMomentStore.js`                                                                                                                                                                                                                                                                                                                                                                                                       |
| Director hook (cadence + caps)                                         | `apps/web/src/hooks/useOfficeAmbience.js`                                                                                                                                                                                                                                                                                                                                                                                                       |
| Run-reaction hook (colleague pings you about the run you just made)    | `apps/web/src/hooks/useOfficeRunReactions.js` (pure `planRunReaction` brain; App bumps `runSignal` from `triggerCompletionDelight`; delivers an IM through the shared ladder)                                                                                                                                                                                                                                                                   |     |
| Shared moment delivery (both producers)                                | `apps/web/src/utils/officeMomentDelivery.js`                                                                                                                                                                                                                                                                                                                                                                                                    |
| Desk verbs (player-initiated)                                          | `apps/web/src/hooks/useDeskActions.js` + `apps/web/src/components/DeskActionsDock.jsx`                                                                                                                                                                                                                                                                                                                                                          |
| Cast tiers (team / senior / office)                                    | `apps/web/src/utils/castTiers.js`                                                                                                                                                                                                                                                                                                                                                                                                               |
| Day One entry framing                                                  | `apps/web/src/components/DayOneBadge.jsx` + attributed `controls.prompt.starters` (`TopicStarters.jsx`)                                                                                                                                                                                                                                                                                                                                         |
| Meeting playback state machine                                         | `apps/web/src/hooks/useMeetingPlayback.js`                                                                                                                                                                                                                                                                                                                                                                                                      |
| Chrome                                                                 | `apps/web/src/components/OfficeLayer.jsx` (+ `DeskActionsDock`, `OfficeInboxDock`, `OfficeImPing`, `OfficeMessenger`, `OfficeWalkBy`, `CoffeeBreakOverlay`, `OfficeBattleOverlay`, `CallMeetingPicker`, `MeetingInviteToast`, `MeetingOverlay`)                                                                                                                                                                                                 |
| Window management (draggable shell + global focus z + center open)     | `FloatingWindow.jsx`, `hooks/useDraggablePosition.js` (+ `utils/viewportBounds.js` `center`), `hooks/useOverlayLayer.js` + `state/overlayStack.js` (global focus elevation so desk menus / level panel / office windows cover each other by last focus), `state/floatingWindowControl.js` (programmatic position reset)                                                                                                                         |
| Office XP reducer                                                      | `applyOfficeEvent` in `apps/web/src/state/runGamificationStore.js`                                                                                                                                                                                                                                                                                                                                                                              |
| Minutes → Thinking pane                                                | `officeMinutesToInsightEntry` in `apps/web/src/utils/appInsightHelpers.js`                                                                                                                                                                                                                                                                                                                                                                      |
| SFX                                                                    | `playMailChime` / `playYouveGotMail` / `playImPing` / `playFootsteps` / `playCalendarDing` / `playMeetingJoinBlip` / `playBattleBell` / `playVictoryDing` + soundscape / diegetic cues via `officeCuePlayers.js` (`playOfficeCue` / `playPropCues` — sample-first for keyboard / paper / printer / chair / watercooler / espresso / vending; synth for elevator / phone / mouse) in `apps/web/src/utils/agentChimes.js` + `officeCueSamples.js` |
| Walk-by / meeting / battle / coffee narration                          | `apps/web/src/utils/officeNarration.js` + `POST /api/office/speak` (`apps/server/src/agents/officeTts.js` Chirp3-HD default with a Chirp3-HD → Neural2 → WaveNet → Web Speech fallback ladder; `OFFICE_TTS_VOICE_TIER` pins the ladder top); emails/IMs stay silent; desk menu Voice toggle                                                                                                                                                     |
| Narration roadmap (TTS follow-ups)                                     | [`docs/office-narration-roadmap.md`](office-narration-roadmap.md)                                                                                                                                                                                                                                                                                                                                                                               |
| App integration                                                        | one `<OfficeLayer/>` mount next to `<ErrorToast/>` in `apps/web/src/App.jsx`                                                                                                                                                                                                                                                                                                                                                                    |

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
   (see §6 "Soundscape"). **Extended 2026-07-27** with a continuous room-tone bed and baked
   ElevenLabs samples for the seven cues synthesis loses on (see §6 and
   [`docs/audio-assets.md`](audio-assets.md)). Outstanding: `ROOM_TONE_GAIN` has been balanced
   against the cues on paper and approved from a rendered mix, but never tuned by ear in the
   running app — that is a one-constant change in `officeRoomTone.js`. Natural next steps, in
   rough order of value: per-room beds so the isometric floor changes character as you move
   (meeting room, kitchen — 300 credits each), and a second variant for the highest-weight cues
   (`keyboard` fires ~4× more often than anything else, so it wears first).
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
    `officeNarration.js`; emails stay silent; desk menu Voice toggle.
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
