# ADR-0010: Cast agency — the Sign-off rule, one producer, and the pitch/proposal split

## Status

Accepted — 2026-07-25 (design decision from the office grilling session; governs all future cast/agent work; first implementation pending)

## Context

The office cast (team / senior / office tiers) was gaining real capabilities: reactive LLM dialogue, persistent memory, and a path into the review queue. The infrastructure could obviously go further — NPCs generating diagram DSL, running bounded "deep work" iterations on slot lanes, auto-reacting to slot changes with their own runs. A staged program in exactly that direction (per-lane agent commissions producing eager validated proposals) was designed and then **deliberately retracted** by the product owner. A future reader will wonder why the cast never produces anything when the plumbing could clearly support it.

## Decision

Two clauses, plus a vocabulary split:

1. **No agent-initiated runs.** Agent compute spend follows human initiative, always. Nothing in the cast schedules its own pipeline.
2. **One producer.** The human's own pipeline is the sole producer of slot content. The built-in cast — every tier — never generates DSLs or code. They comment, **pitch**, and chat. Their "own work" exists only as fiction they can talk about (see _Their own work_ in `GLOSSARY.md`). The single exception is a **contractor** — a real external MCP agent the human explicitly invited — which keeps its server-validated proposal path.
3. **Pitch ≠ proposal.** A _pitch_ is an actionable suggestion (instruction + rationale, attributed, persistent card in the unified review queue); accepting it triggers a run through the human's pipeline, attributed to the pitcher. A _proposal_ is a concrete validated change and stays contractor-only. One queue, two honest card types — never one card type meaning two things.

## Consequences

- The app's "multi-agent" feel must come from **reactive dialogue quality and memory** (office-parody.md §11), not from autonomous production — that is where the realism budget goes.
- Ambient LLM budgets stay tiny; the generous spend class is _reactive_ (human-addressed), which is self-limiting because the human is in the loop by definition.
- Review load stays proportional to human intent; there is no queue-flooding failure mode and no "the office redesigned my diagram while I was at lunch."
- The retracted commission/lane machinery must not creep back in feature-shaped disguises (auto-fix-on-idle, "let Chad try", scheduled refreshes) without superseding this ADR.
- The backburnered multi-human spec (`docs/multi-human-office.md`) inherits clause 2: NPC contributions enter its shared queue as pitches.

## Alternatives considered

- **Deep-work commissions** (brief a team persona onto a slot lane; bounded private iteration; one eager proposal back). Fully designed, then rejected by the product owner: the human decides what gets worked on; cast output beyond commentary dilutes both the tool (trust in what's on the canvas) and the parody (colleagues who actually do your job stop being funny).
- **Eager NPC proposals** (ambient moments escalate into real validated patches). Rejected on economics and honesty: full agent runs spent where the rejection rate is highest, and a "proposal" card whose content nobody asked for.
- **Standing assignments** (agent re-runs when its lane changes). Ruled out directly by clause 1.

## Where this lives in code

Nothing yet — this ADR _constrains_ future code. Design docs: `docs/office-parody.md` §11, `GLOSSARY.md` (_Sign-off rule / one-producer model_, _Pitch_, _Reactive vs. ambient_, _Their own work_). Today's ancestor of the pitch is the ephemeral `actionPrompt` "Do it" flow in `apps/web/src/utils/officeMomentDelivery.js`; the contractor proposal path is `apps/server/src/state/agentProposalStore.js`. Update this section when the pitch queue ships.
