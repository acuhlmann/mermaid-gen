# ADR-0013: Office continuity — memory that never triggers, runWalk as the only new initiation

## Status

Accepted — 2026-08-17 (design grilling; implementation pending). Spec: [`docs/office-continuity.md`](../office-continuity.md).

## Context

The isometric floor already has presence (wander, shop talk, dwell) and a generous you-started LLM budget (talk, dwell, run-reaction IMs). Ambient interruption is canned-heavy and tiny. The remaining complaint is that colleagues still feel like **little canned lines**: they do not remember you, and a completed run is silent on the floor because `useOfficeRunReactions` holds fire while `floorActive`.

The obvious upgrades — more ambient LLM, LLM shop talk, unsolicited pitches after every run — are how this office becomes annoying. ADR-0010 already spends the realism budget on **reactive dialogue + memory**, and forbids memory from scheduling work. ADR-0011 forbids a floor-only moment kind.

## Decision

1. **Continuity over chatter.** Colleagues feel real because the same person remembers you, not because they talk more.
2. **Working memory records; it never triggers.** Per-colleague, office-day beats + a board fingerprint. Same clock as the office log. Distinct from the shared digest and from count-only `officeRelationship`.
3. **The only new initiation is a completed run.** View at fire time: seated → IM; idle on the floor → one walk-by. Same run-reaction budget. No `actionPrompt` on that beat. New spoken situation `runWalk` (circumstance only; no delta; no `userMessage`).
4. **Helpful beat only if the user talks.** Dwell stays one social line per approach. Standing still is them going back to work.

## Consequences

- Implementing agents follow [`docs/office-continuity.md`](../office-continuity.md) v1; they do not re-open ambient volume, join-in quotes, or initiation pitches in the same PR.
- `OFFICE_MOMENT_SITUATIONS` gains `runWalk`. Reusing `run` (silent) or `walkover` (user shouted) is a medium lie — the class of bug `isSpokenMomentSituation` exists to stop.
- `floorActive` must stop swallowing this producer; talk / floor card / commute / live dwell still do.
- A fabricated “what changed” on `runWalk` is a revert. The `run` situation already taught that lesson; the new block must not reintroduce a delta the prompt does not carry.

## Alternatives considered

- **Raise ambient life** (more LLM walk-bys, LLM shop talk, timer-started conversations). Rejected: that is the annoyance the last floor slices spent unwinding.
- **Walk-over without working memory** (counts-only relationship, existing log). Rejected: still a canned walk-by with better timing.
- **Memory only, keep run reactions desk-IM.** Rejected: no floor proof of the goal the isometric office was asked to meet.
- **Unsolicited Do-it on the run-walk.** Rejected: quest marker while you are walking; ADR-0010 queue flood. Pitch waits until the user replies or talks.

## Where this lives in code

Nothing yet — this ADR constrains the v1 slice. Target files and the four-place `runWalk` contract are listed in [`docs/office-continuity.md`](../office-continuity.md). Update this section when the slice ships.
