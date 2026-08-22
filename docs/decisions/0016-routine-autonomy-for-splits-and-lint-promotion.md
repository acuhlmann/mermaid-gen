# ADR-0016: Routine autonomy for coupling splits and lint promotion

## Status

Accepted — 2026-08-22

## Context

[ADR-0014](0014-autonomous-nfr-routines.md) shipped the `improve` routine with three human-decision
carve-outs (its clause 5): no unprompted hub splits (`balanced-coupling-priorities.md`'s "split on
contact"), no product-slot writes (ADR-0010), and no unilateral lint-severity promotion (ADR-0007's
two-week quiet period). The first and third both resolve to the same shape: the routine measures a
real regression, cannot act on it, and instead writes a report a human has to read and decide on.

[Issue #363](https://github.com/acuhlmann/mermaid-gen/issues/363) is that shape working exactly as
designed: `DiagramCanvas.jsx` crossed its ADR-0005 budget in a pattern the routine recognised (a
diagram-family graph-edit handler that should live in a sibling module, same as the mindmap /
flowchart / infographic extractions already done), and the playbook correctly filed an issue instead
of acting, per ADR-0014 clause 5. The repo owner's response: that hand-off is not wanted. The point
of NFR routines was to remove exactly this kind of recurring, low-judgement decision from a human's
queue, and these two carve-outs route the routine's clearest-cut findings straight back into it.

Neither carve-out was protecting against an unsafe mechanism — [`docs/routines/README.md`](../routines/README.md)'s
rules (behaviour-preserving by default, a budget the guard enforces mechanically, green CI or
nothing, the escalation exception for genuine judgement calls) already decide whether _any_ routine
change is safe to self-merge, independent of whether that change is a bugfix, a doc correction, or a
split. The carve-outs were a categorical "refactors are different" on top of those rules, not a
different safety mechanism.

## Decision

**1. `improve` may perform coupling refactors and monolith splits itself, self-merged, under the same
rules as any other change it makes.** This supersedes ADR-0014 clause 5's first bullet. The
`balanced-coupling-priorities.md` "split on contact" guidance still governs **feature** work — a
human or feature-driven agent still should not go split-hunting mid-feature — but it no longer
constrains the `improve` routine, which has no feature to be on contact with by design and is exactly
the actor a schedule-driven split is safe for. Concretely:

- `docs/routines/improve.md`'s `forbiddenPaths` drops the blanket exclusion of `components/`,
  `state/`, `routes/`, and `mcp/` — those are precisely where the tracked monoliths live. `maxFiles`
  rises modestly to fit one extraction slice (new sibling module + the original file's edit + its
  test + the ADR-0005/priorities doc update).
- Still **one slice per run**, same as every other queue item — this is not a licence for a flag-day
  rewrite, it is the existing "small diffs are the whole safety model" rule applied to a new class of
  diff.
- The [ADR-0015](0015-resolve-routine-and-escalation.md) escalation exception is the pressure valve:
  when a split's correctness rests on real product judgement rather than a mechanical extraction
  (ambiguous ownership of a shared helper, a seam the existing pattern doesn't cover), the routine
  pushes the branch, opens the PR, does not merge, and says what it's unsure of — the same as it
  already does for an ambiguous bugfix.

**2. `improve` may promote a lint rule from `warn` to `error` once it can show the ADR-0007 quiet
period held.** This supersedes clause 5's third bullet. "Show" is mechanical, not a vibe: the routine
greps the git history of the rule's suppression sites (`// eslint-disable... <rule>`) since the later
of (a) the rule's introduction or (b) the last promotion attempt recorded in the ledger, and promotes
only if that window is at least two weeks old and empty — no new suppression, explained or not. It
records the evidence (the git log excerpt, the date range) in the PR body and the ledger row. A
window that isn't old enough yet, or that isn't empty, stays a ledger `todo` — not an issue, since
there is nothing for a human to decide here that the grep doesn't already answer.

**3. Unchanged.** ADR-0010's product-agency boundary (no routine ever writes to a diagram slot) and
"no new dependencies" were not part of this request and stay exactly as ADR-0014 left them — a
routine still never authors slot content and still never adds a package unasked.

## Consequences

Positive:

- The two most common recurring "routine found a real thing, filed an issue, human has to read and
  decide" hand-offs go away. ADR-0005 and ADR-0007's promotion clause progress on the routine's own
  schedule instead of on a human's queue.
- Issue #363-shaped findings become PRs instead of issues.

Negative:

- Unattended refactors and lint-severity changes now ship to a repository whose `main` auto-deploys
  to Cloud Run. The safety model is unchanged in kind (tests, budget, green CI, escalation) but is now
  carrying more weight per class of change — a bad split reaches production the same way a bad bugfix
  already could, with no categorical stop that used to exist for refactors specifically.
- The routine is the sole judge of whether a split is "the established pattern" versus something
  novel enough to escalate. If it escalates too rarely, a judgement-heavy split ships without the
  human read it should have had — watch the ledger and the PR history, and tighten
  `docs/routines/improve.md`'s paths or add a `forbiddenPaths` entry if that happens.
- The quiet-period grep is a floor, not a full audit — it catches new suppressions of the _promoted_
  rule but not, say, a rule renamed to dodge the check. Acceptable because the routine's own
  suppression-adding runs are themselves budgeted and logged.

## Alternatives considered

- **Keep the carve-outs, only relabel #363-shaped issues `ready-for-agent` for a human to
  fast-approve.** Cheaper to write, but it is still a human decision in the loop on every occurrence
  — the thing this ADR was asked to remove.
- **Let `improve` raise the ratchet budget instead of splitting.** Rejected — that is exactly the
  "silent ratchet loosening" ADR-0014 rule 8 already forbids, and it erases the regression rather than
  fixing it.
- **Full autonomy including the ADR-0010 and new-dependency carve-outs.** Out of scope for this
  decision; not requested, and each rests on a different justification (product-agency boundary,
  licence/supply-chain risk) that this ADR's reasoning doesn't address.

## Where this lives in code

| Concern                            | File                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Routine contract                   | [`docs/routines/README.md`](../routines/README.md)                                         |
| `improve` playbook                 | [`docs/routines/improve.md`](../routines/improve.md)                                       |
| Coupling priorities (routine note) | [`docs/agents/balanced-coupling-priorities.md`](../agents/balanced-coupling-priorities.md) |
| Mirrored gotchas                   | `CLAUDE.md`, `AGENTS.md` § Scheduled NFR routines                                          |

## References

- ADR-0014 — Autonomous NFR routines (the clauses this supersedes)
- ADR-0005 — Splitting monolithic files for agent-friendly editing
- ADR-0007 — Sensors for coding agents (the quiet-period rollout clause)
- ADR-0015 — `resolve` routine and escalation (the exception this reuses)
- [Issue #363](https://github.com/acuhlmann/mermaid-gen/issues/363) — the case that prompted this
