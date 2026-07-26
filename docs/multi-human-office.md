# Multi-human office — design spec (backburnered)

> **Status: adopted design, not scheduled.** Decisions were fixed in a grilling session
> (2026-07-25) and are binding _as design_: when implementation starts, begin from this spec
> (and write the implementation ADR then — deliberately no ADR while nothing is built).
> Vocabulary lives in [`GLOSSARY.md`](../GLOSSARY.md) § "Multiplayer (design-stage)".
> Near-term single-human work should avoid contradicting these shapes where cheap
> (see §4 "Early dividends").

The pitch this spec resolves: evolve archislop into a **multi-human-user app where the NPC
characters are real agents**, keeping the product simultaneously a game, a corporate-IT
parody, and a genuinely useful topic-discovery/viz tool.

## 1. Decisions

Each entry: the decision, then the load-bearing rationale.

1. **Spine: collaborative discovery workshop.** 2–8 humans explore a topic together and
   co-produce the viz; the office is the comedy stage around that. Role-play (humans playing
   cast roles) is a designed _mode inside_ the workshop, not a separate product. Game-first
   (co-op office sim) was rejected: it fights the standing doctrine that shipping slop must
   out-earn attending meetings.

2. **Shared canvas.** One session = one topic = **one** six-slot deliverable set; slot
   authority moves server-side (a promotion of the existing per-session
   `DiagramStateStore`, not a new store). No per-human slot state — a coworker's desk is
   where they _sit_, not where their state lives. Rejected: per-human desks with cross-desk
   proposals (less surgery, but makes collaboration review-shaped instead of
   co-creation-shaped).

3. **Host-owned, egalitarian defaults.** The creating participant is the **host** (fiction:
   **Office Manager** — "your name's on the lease"). Everyone can prompt, edit, and accept
   proposals by default; the host holds the safety keys (kick, lock canvas, end session) and
   anchors per-session LLM budgets. Facilitation is **fiction, not permissions**: pacing and
   phase-running are delivered by the cast (Pam), never by disabling other humans' buttons.

4. **Anonymous session-scoped identity, account-compatible shapes.** Join link → name-badge
   check-in (the existing reception fiction becomes literal onboarding) → server-issued
   `participantId` + secret rejoin token in localStorage. No accounts, no user DB.
   `participantId` stays stable and self-contained in wire contracts so a future account
   system is a mapping table, not a migration.

5. **NPCs are session participants.** The ambience director moves server-side, one per
   session; every moment (email, IM, walk-by, battle, meeting) is a session event all humans
   see simultaneously. Substantive NPC contributions go through the **real proposal queue**
   (same ritual as external agents) — the group deciding whether to take Ulrich's advice is
   simultaneously a workshop mechanic, a comedy beat, and real diagram work. _Refinement
   (2026-07-25): NPC contributions enter the queue as **pitches** (instruction + rationale;
   accept = human-commissioned run), not eager concrete proposals — see the pitch/proposal
   split and the Sign-off rule / one-producer model in `GLOSSARY.md`. Eager validated
   proposals remain the domain of contractors only; the built-in cast never produces
   slot content._ Cost/locale
   design: the server emits **template ids + slot fills** for canned moments; each client
   renders them through its own locale bundle. Localization machinery stays client-side;
   only the _choice_ of moment centralizes.

6. **Naming package** (glossary'd): **Participant** (`kind: "human" | "npc" | "agent"`) is
   the wire term for anything with presence. Humans are **coworkers** / **the working
   group** — never "colleagues" (reserved for the NPC office tier). External MCP agents are
   **contractors** (pre-existing desk fiction; handshake = vendor onboarding). The
   multi-human session is just the session; fiction: **the office**.

7. **Direct-apply with per-slot run lock; egalitarian acceptance.** Any coworker's prompt
   runs immediately if the slot is free; everyone watches the same stream; shared revision
   history is the undo. Busy slot → "Deploy in progress — nobody leaves their desk." NPCs
   and contractors keep the proposal path. Any coworker may accept/reject proposals. A
   later **converge mode** (humans routed onto the proposal path for a review ceremony) is a
   routing flip, not new machinery — both paths must exist anyway.

8. **Role-play = masks.** A cast role is worn by a coworker: participant stays
   `kind: "human"`; the role is presence dressing + a persona voice pack. Scene-scoped by
   default (claimed for a meeting), session-scoped allowed; attribution always visible
   ("Jack Barker — played by Sam"; badge: **Acting** CFO). Claimable: senior + office tiers
   only — never team (functional agents; a human wearing Critique's face would make machine
   output attribution ambiguous). Claimed role ⇒ the NPC's ambient self goes quiet. The
   flagship scene: the review meeting — working group presents, human-played seniors grill,
   minutes become proposals.

9. **Game layer: personal careers + Employee of the Month.** Careers (XP/levels/
   achievements) stay local-per-browser exactly as single-player; office events award to
   whoever did the thing. The session adds one ephemeral shared scoreboard — **Employee of
   the Month**, a wall plaque awarded at session end. **NPCs are eligible** (Chad beating
   three humans is the point; it keeps human rivalry a joke — the workshop spine needs
   cooperation). The Damage Report™ is session-scoped and visible to all: "this working
   group has cost the company $0.43 today."

10. **Organic genesis + slot lanes + frictionless late join.** Host starts solo exactly as
    today, then invites. The named multiplayer discovery pattern is **slot lanes**:
    the run lock is per-slot and there are six slots, so the group parallelizes by lane and
    reconvenes in meetings; UI acknowledges lanes (presence shows who's where), workflow
    never enforces them. Late join always allowed; the joiner's compressed reception
    check-in renders only in their own viewport. A kickoff-meeting beat is a cheap later
    add ("Call a meeting" with topic = choosing the topic).

11. **Locale split.** A **session locale** (host-chosen at creation, announced at the door)
    governs everything _generated_ — LLM moments, meeting scripts, agent outputs,
    deliverable labels (the shared artifact must speak one language). Canned moments and UI
    chrome stay per-viewer via template ids. TTS: canned lines in the listener's locale,
    generated lines in the session locale. Mid-session change affects only future
    generation.

12. **Durability: in-memory + idle TTL + host re-seed.** Sessions live in RAM on the
    existing `max-instances=1` shape; idle TTL ~4h after the last coworker leaves ("the
    cleaning crew comes through"). Crash recovery: every client holds a replica; the host
    re-seeds a fresh session from it (doubles as session export). **Binding design rule:
    session state is one serializable snapshot object from day one** — Redis checkpointing
    (or a durable store, once accounts exist) becomes a persistence adapter, not a redesign.

## 2. Open questions (deliberately not yet grilled)

- Wire protocol details: extend `session-events` vs. a new channel; broadcasting AG-UI run
  streams to all viewers.
- TTS fan-out cost policy with N listeners.
- Can guests invite contractors, or host-only?
- Moderation depth beyond kick (bans, rejoin-token revocation).
- The Employee-of-the-Month award ceremony; the converge-mode review ritual.
- Account system trigger conditions (Q4-C).

## 3. Relationship to existing docs

- Supersedes/expands `docs/office-parody.md` §10.8 ("Multiplayer watercooler") — that item
  imagined agents at the watercooler; this spec makes _everyone_ a participant.
- `docs/architecture-external-agents.md` remains the contract for contractors; handshake,
  proposals, and presence generalize per decision 5–6.

## 4. Early dividends (single-human work that implements this spec ahead of time)

These pieces of the spec are valuable _now_, with zero humans added:

- **NPC contributions through the real proposal queue** (decision 5) — works today with one
  human as the sole accepter.
- **Snapshot-serializable session state** (decision 12) — cheap discipline during the slot
  authority work, pays off twice.
- **The participant model** (decision 6) — presence that can list NPCs and contractors
  uniformly is buildable before any human guest exists; humans plug into it later.
