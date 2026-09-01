# ADR-0017: Routine ownership, a `deps` routine, and the attention bar

## Status

Accepted — 2026-09-01. Amends [ADR-0014](0014-autonomous-nfr-routines.md) (budgets, tiers) and
[ADR-0015](0015-resolve-routine-and-escalation.md) (the escalation exception, whose label mechanism
this replaces).

## Context

[ADR-0016](0016-routine-autonomy-for-splits-and-lint-promotion.md) granted `improve` two more
self-merging powers, and the nightly fleet kept shipping: seven rungs, most merging a PR a night, and
a `digest` that could honestly open with "nothing needs you this morning". Three things were still
reaching the owner anyway, and each had the same shape — a rule that was true in prose and unenforced
in code.

1. **`ready-for-human` was where work went to disappear.** ADR-0015's escalation path relabelled an
   issue `ready-for-human` whenever a routine held a PR. `resolve` gathers `ready-for-agent`,
   `needs-triage` and unlabelled — so the label removed the issue from every routine's gather set
   permanently. The two issues that ever carried it were not human decisions at all: #402 was blocked
   by `resolve`'s `maxFiles: 6` needing nine files (diagnosed twice, in the issue, by the routines
   themselves), and #431 was a lint-complexity regression `improve` exists to fix. The owner was
   asked to arbitrate arithmetic.
2. **`ready-for-agent` promised something nobody checked.** #461, #462 and #473 were scoped and
   labelled correctly, and their fixes lived in `scripts/routine-guard.mjs` and
   `scripts/test-affected-lib.mjs` — outside every `allowedPaths` on both shelves. They could not be
   resolved by any agent forever, and `resolve` logged a skip each night against a backlog that looked
   handled.
3. **Nobody owned dependencies.** `resolve.md` § 2b carried the duty as a footnote to a routine whose
   job was elsewhere: "after the issue pick and only if the pick left budget", one PR per run, only
   after seven days. #378 and #379 each sat green for eight days for a human to find; #455 for two;
   nineteen Dependabot alerts have been open since 2026-08-22 with one PR to their name.

Underneath all three: a routine whose `allowedPaths` contained `docs/**` could edit its own budget and
pass its own postflight (#461), and every job on the ladder — including the watchdog that notices
silence — ran on one host.

## Decision

**1. Budgets are owned, and the owner is never the spender.** `routine-guard` now refuses any diff
from a routine other than `improve` that touches a playbook, either shelf's README, or another
routine's ledger (`BUDGET_OWNERS`, `shelfOwnershipViolation`); each routine keeps write access to its
own ledger, which rule 7 requires. `scripts/routine-guard.mjs` is added to `ALWAYS_FORBIDDEN` — the
enforcer sits outside every budget it enforces. `improve` gains `scripts/**` and a queue item (§ 2b)
that reads `blocked-by-budget` / `blocked-by-paths` ledger rows and prices them in its own PR.

**2. The attention bar is four conditions, and everything else is a routine's call.** Money;
credentials or permissions; irreversible destruction; the product's direction. Codified as
`docs/routines/README.md` rule 10, binding on both shelves. No routine may apply `ready-for-human` to
its own finding. `digest` may lead with `Needs you:` only for these; everything else is a section
below, not an alert.

**3. A held PR keeps its labels.** ADR-0015's mechanism changes: a routine that finishes a fix and
judges the unattended-merge risk high still pushes and opens, states what is unsure, does not merge —
and leaves the issue where it is, so the next firing re-reads it. `resolve` gathers `ready-for-human`
again after three days on the assumption that a routine was over-cautious, not that a person is busy.

**4. `ready-for-agent` means reachable.** New `npm run routine:guard -- --reachable <path>` prints
which routine may write a file, `frozen` for an always-forbidden one, or `NONE` with exit 1. Filers
run it before labelling; `digest` runs it over every open issue's named file in its Filed/blocked
section. A test asserts nothing in `scripts/` is left ownerless.

**5. Dependencies get their own routine, twice daily, off the ladder.** [`deps`](../routines/deps.md)
owns every Dependabot PR and advisory: merge green patch/minor **the same day** (no age threshold);
classify red or conflicted ones and act — `@dependabot rebase`, re-run a known flake once, or fix the
compatibility break in **source** and let Dependabot `recreate` its PR; attempt majors within budget
rather than parking them. Two hard boundaries make that safe without a human: `package-lock.json`
stays always-forbidden, so no agent authors a resolved tree and every dependency change arrives as a
Dependabot commit; and the routine never ignores, cancels or closes an advisory, because dismissing
someone else's vulnerability is page-bar #3.

**6. `resolve` moves to Cursor.** The first host split since 2026-08-30 emptied Cursor. Chosen by
duty, not by load: `review`/`improve` find the work and `resolve` pays for it, so one degraded account
can no longer both generate the backlog and stall it. `deps` and the rest stay on Claude for now, and
`Adding a routine` step 3 makes host choice a documented part of standing anything up. Neither CLI can
list or create these triggers, so that remains the owner's action — page bar #2, and the reason this
ADR ships with a handoff list rather than a finished fleet. _(Wrong as written — see **Correction**
below. The `deps` trigger was created from the CLI the same day.)_

**7. Every fleet must be in the registry.** Cursor's unregistered `critical-bug-memory` automation
found the same bug `review` had already filed on 2026-08-29 and both paid for a PR. `digest`
watchdog 7 now reports any agent-authored branch or PR matching no playbook's `prTitlePrefix`.

## Consequences

Positive: the backlog drains without an owner in the loop; a stuck issue is now a machine-detected
ownership gap rather than a nightly skip; dependency updates stop being the one queue a human read;
and "escalate" no longer means "notify the human", so the human's attention stays scarce and
trustworthy.

Negative and accepted: `improve` is a single point of authority over every budget, self-merging, and
accountable to nothing but the guard's ownership rule and a `digest` line — the same trust ADR-0014
placed in `maxFiles`, now placed in one routine too. `deps` merges third-party code into `main`
without a reader, so a bad upstream release can enter on a green CI run; the lockfile boundary and the
corpus benches in `deps` § 5 are the mitigations, not a review. And a `ready-for-human` that _is_
genuine now gets re-triaged by an agent every three days, which will occasionally be wrong in the
expensive direction.

## Alternatives considered

- **A `human-decision` tier in the guard.** Rejected: ADR-0015's lesson is that a state meaning "wait
  for a person" is indistinguishable from "deleted" when nobody reads the tracker.
- **Raise `maxFiles` universally.** Rejected: the number was load-bearing in both directions; what was
  missing was a route from "this number blocks the work" to the routine allowed to change it.
- **Let `deps` write `package-lock.json`.** Rejected: it would dissolve the one boundary that makes
  unattended merges of third-party code defensible, and `npm install` in a cloud sandbox produces a
  resolved tree no one diffed.
- **Move `digest` to Cursor instead.** Its value as a cross-host watchdog is real, and this may be the
  second move — but a report job on another host notices nothing that the fleet's _work_ cannot do,
  and the credits go further on code.

## Where this lives in code

- [`scripts/routine-guard.mjs`](../../scripts/routine-guard.mjs) — `ALWAYS_FORBIDDEN`, `BUDGET_OWNERS`,
  `shelfOwnershipViolation`, `ownersOfPath`, `collectPlaybooks`, the `--reachable` mode.
  Tests in [`scripts/routine-guard.test.mjs`](../../scripts/routine-guard.test.mjs) § ADR-0017.
- [`docs/routines/README.md`](../routines/README.md) rules 2, 10, 11; the routine/host table.
- [`docs/routines/deps.md`](../routines/deps.md) + ledger; [`resolve.md`](../routines/resolve.md) §§
  1, 2, 2b, 4, 5; [`improve.md`](../routines/improve.md) § 2b; [`digest.md`](../routines/digest.md)
  watchdogs 5–7; [`review.md`](../routines/review.md) ladder + filing rule.
- [`docs/agents/triage-labels.md`](../agents/triage-labels.md) — what each label commits the repo to.

## Correction — 2026-09-01, the same day, found by trying the thing

Decision § 6 said **neither CLI can list or create triggers**, and page bar #2 named trigger creation
as the owner's. Both were wrong, and the claim came from `claude --help`'s command list (which has no
`routines` verb) rather than from the docs or from trying it. `claude` carries a **`/schedule`**
slash command — alias `/routines` — that creates, lists (`/schedule list`), updates (`/schedule
update`, including an arbitrary cron expression) and manually fires (`/schedule run`) cron routines;
`claude -p '/schedule …'` drives it headlessly. What it genuinely cannot do: delete a routine, create
or revoke **API** triggers/tokens, and anything on the Cursor side (`agent` has no `automations`
command). It also needs a claude.ai subscription login, not a Console/Bedrock/Vertex credential.

So `deps` was stood up from the CLI the same day — `trig_01Dk8ZwZCpXfXGREJyHnh9Up`, cron
`30 4,16 * * *`, Sonnet 5 — which means the owner's remaining handoff is two items (delete the old
Claude `resolve`, and everything Cursor-side), not four.

The durable part is not the CLI's capability, it is **where I got it from**: "the tool's `--help` does
not list the verb" is evidence about `--help`, not about the tool. The correction is in
`docs/routines/README.md` rule 10 (page bar #2 narrowed) and § Adding a routine step 4 (the CLI route,
plus the read-back), `docs/routines/digest.md` watchdog 4 (`/schedule list` is now the direct source
for drift, and it reports a deleted or **disabled** rung, which a connector-and-PR-time heuristic
does not), and the same two lines in `AGENTS.md` / `CLAUDE.md`. A watchdog that can enumerate live
state directly is worth more than one that infers it from side effects — `resolve` sitting
`disabled` was visible only because the list is explicit.
