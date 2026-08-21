# ADR-0015: `resolve` routine, and an escalation exception to self-merge

## Status

Accepted — 2026-08-21

## Context

[ADR-0014](0014-autonomous-nfr-routines.md) shipped two NFR routines, `review` and `improve`. Both
write code, open a PR, and merge it themselves once CI is green — that part works. But `review`
fixes at most one bug per run and files the rest as issues (`ready-for-agent` / `needs-triage`), and
nothing ever came back for those. They accumulated, and the only thing that worked them down was the
owner manually handing one back to an agent. That is exactly the admin overhead ADR-0014 was trying
to remove, one layer up: routines stopped requiring manual PR integration, but still required manual
issue triage-and-dispatch.

Two additional gaps, both from the same root cause (a routine still assumed a human closes the loop):

1. Neither routine's default path had any way to say "I fixed this, but I'm not confident enough in
   the fix to merge it unattended" — the only outcomes were merge or file-as-issue. A fix that clears
   the correctness bar (a failing test now passes) but not the unattended-merge-risk bar had nowhere
   to go.
2. `needs-triage` issues — genuinely unscoped reports — sat on the same backlog as `ready-for-agent`
   ones with no routine reading them at all.

## Decision

**1. Add a third routine, `resolve`, that works the issue backlog.** `docs/routines/resolve.md` +
`docs/routines/ledger/resolve.md`, same shape as the other two: small `maxFiles`, explicit
`allowedPaths`/`forbiddenPaths`, one issue per run, a fix ships only with a test that fails without
it — identical bar to `review` § 3, applied per-issue instead of per-commit-window. It reads
`ready-for-agent` and `needs-triage` issues; a `needs-triage` issue that turns out to still be
genuinely unscoped gets a `needs-info` comment, not a guess.

**2. Add one exception to "merges itself once CI is green": escalation.** When a fix is correct
(test-proven) but the routine judges the _unattended-merge_ risk high — it touches a trust-boundary
sanitizer/allowlist, the right approach was ambiguous, the regression test needed real product
judgement to write rather than being a direct transcription of the bug, or the diff sits adjacent to
a don't-touch path — it still pushes the branch and opens the PR, but does **not** merge it. It
comments what it's unsure of, relabels the issue `ready-for-human`, and stops. This is not a new
tier (`routine-guard.mjs`'s two tiers, `report` and `code-writing`, are unchanged and still the whole
mechanical model) — it is a per-run judgement call inside `code-writing`, enforced by nothing but the
playbook's own bar, the same way "one bug per run" already was.

Escalation is deliberately narrow. A routine that escalates by default has just re-invented "always
ask a human," which is the overhead this whole shelf exists to remove; a routine that never escalates
has no honest way to represent "I'm not sure" and will merge things it privately doubts. The bar in
`resolve.md` § 4 is written to be checkable against the diff and the issue, not a vibe.

**3. Nothing about ADR-0014's constraints changes.** `resolve` inherits every rule in
`docs/routines/README.md`: no hub splits, no new dependencies, no lint-severity promotion, no slot
content, the don't-touch list, one branch at a time. It is bound by the same budget mechanics
(`npm run routine:guard`) as the other two — a new playbook file, picked up automatically by
`verify:agent-infra` and `verify:doc-paths`, which already scan `docs/routines/`.

## Consequences

Positive:

- The loop actually closes: a bug found by `review`, filed as an issue, can be fixed and merged by
  `resolve` two hours later without the owner touching either the tracker or a PR.
- The escalation exception gives routines an honest way to say "correct, but I wouldn't bet on this
  merging unattended" instead of forcing a binary between full autonomy and filing-and-abandoning.
- `needs-triage` issues get a first pass instead of silently waiting for a human to notice the label.

Negative:

- **A third cron job merging to `main`, which auto-deploys.** The same negative ADR-0014 already
  accepted for two routines now applies to three. Mitigation is unchanged: small `maxFiles`, a path
  allowlist, green CI, and now the escalation valve for cases the routine itself doubts.
- **Escalation is judged by the routine, not measured mechanically.** Unlike `maxFiles` or forbidden
  paths, "was this genuinely risky" has no guard script behind it — the bar in `resolve.md` § 4 is
  prose, the same way "confident enough to fix" already was in `review.md` § 3. If it escalates too
  eagerly, the ledger's escalation rows are the tell and the bar gets tightened; if it escalates too
  rarely, an unattended merge the owner disagrees with is the tell, and the fix is the same shape
  (tighten `resolve.md`, not touch the guard script).
- **A three-routine backlog can starve.** If `resolve` picks the same easy issue class every night,
  harder filed issues age indefinitely. The ledger's `todos` and escalation-nag rule (three runs, no
  human action, stop re-touching) exist to surface that rather than hide it, not to prevent it
  outright.

## Alternatives considered

- **Fold backlog-working into `review` itself.** Rejected: `review`'s job is "review what landed in
  the last 24h," and conflating that with "burn down an arbitrary-age backlog" risks the small
  `maxFiles` budget being spent on old issues instead of fresh findings, on a schedule sized for the
  smaller job.
- **No escalation path — `resolve` only merges or only files.** Rejected as the two failure modes
  this ADR is explicitly trying to avoid: merge-everything (a routine that is the sole judge of its
  own confidence, which `review.md` already argues against) or file-everything (the status quo this
  ADR exists to fix).
- **A formal third tier (`report` / `code-writing` / `code-writing-supervised`) enforced by
  `routine-guard.mjs`.** Considered and rejected for now: escalation is a per-issue judgement, not a
  property of the routine as a whole (the same `resolve` run merges most issues and escalates one),
  so it does not fit the guard's per-playbook tier model. If escalation logic outgrows prose — e.g. a
  future rule like "always escalate any diff touching `packages/shared/src/*Sanitizer*`" — that
  specific rule can become a mechanical guard check without needing a new tier.

## Where this lives in code

| Concern            | File                                                                       |
| ------------------ | -------------------------------------------------------------------------- |
| Playbook           | [`docs/routines/resolve.md`](../routines/resolve.md)                       |
| Durable memory     | [`docs/routines/ledger/resolve.md`](../routines/ledger/resolve.md)         |
| Shared contract    | [`docs/routines/README.md`](../routines/README.md)                         |
| Budget enforcement | [`scripts/routine-guard.mjs`](../../scripts/routine-guard.mjs) (unchanged) |

## References

- ADR-0014 — Autonomous NFR routines (the shape this extends)
- [`docs/agents/triage-labels.md`](../agents/triage-labels.md) — the label taxonomy `resolve` reads and writes
