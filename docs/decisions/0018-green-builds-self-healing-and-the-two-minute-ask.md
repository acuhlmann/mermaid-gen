# ADR-0018: Green builds, a self-healing Claude side, and the two-minute ask

## Status

Accepted — 2026-09-19. Amends [ADR-0014](0014-autonomous-nfr-routines.md) (a `report` rung may act
on a closed list), [ADR-0016](0016-routine-autonomy-for-splits-and-lint-promotion.md) (the
self-merge default gets a crash-proof shape), and [ADR-0017](0017-routine-ownership-dependabot-and-the-attention-bar.md)
(rule 10 gains a format for the asks that legitimately remain, and the `test-only` class stops
reaching the owner at all).

## Context

The week of 2026-09-12 → 09-19 was the fleet's best production week on record — eight ladder rungs,
every one self-merging, digests opening "nothing needs you" — and it still ended with the owner
named as the fix for four things, none of which were product decisions:

1. **A crashed run leaves a green draft, and the draft stops the next run.** The 2026-09-09 firing
   left #619 green-but-draft; 09-17 left #716 the same way after a FAILED session; 09-18 crashed
   opening #726 the same way a third time. Each cost its successor the start of the run — rule 5's
   preflight refusal, which is correctly designed, must be _served_ by finishing or closing the
   predecessor, so every crash converts into routine-seconds spent on the previous night instead of
   tonight. The protocol made the run itself responsible for the moment between "CI green" and
   "merged" — and run liveness is the least reliable part of a cloud runner.
2. **A dark Claude rung is a report, not a repair.** `office-life` skipped 09-15 and the ledger
   itself recorded that no one could inspect its trigger; `metaphor3d` reported success with no
   trace on `main` on 09-19. But ADR-0017's own Correction had already established that
   `claude -p '/schedule run'` can fire any recorded trigger, and `digest` already reads trigger
   ids from the ladder table for watchdog 4. The shelf had the capability and had never used it
   for recovery — so the distance between "the fleet noticed" and "the fleet fixed" was still a
   owner's browser.
3. **The `test-only` class asked the owner a detail.** #686 (four module+test pairs, filed
   `needs-triage` 2026-09-14) is rule 10's exact violation: nothing could answer it because
   `routine-guard` refused test deletions for every routine — a line of code, not a judgement.
   The wire-or-delete question was answered the moment it was looked at: the shipped tree reaches
   none of the four; a wire-up nobody has done in five weeks is a feature proposal, not debris.
4. **A legitimate page-bar ask arrived in an unanswerable shape.** The 09-17 digest asked the owner
   to "confirm" a stray `Google_Drive` connector grant on `deps`'s trigger. Right page-bar item
   (#2, permissions), wrong artifact: no question in binary form, no recommendation, no stated
   default if it goes unanswered. An ask that costs the reader a context-switch to decode is a
   format failure.

## Decision

**1. A dead module+test pair is prune's to delete, proved mechanically.** Shipped first, in the
human PR that edits the one file no routine may (`routine-guard` is always-forbidden):
`DEAD_PAIR_DELETE_ROUTINES` admits a test-file deletion only as the second half of a shape — the
test's relative imports resolve to non-test files deleted in the same diff, and at the base
revision no file outside the diff's deleted set names their stems. The playbook grows the class
(`prune.md` § 6) and § 5.1 gets its second sensor for it: where the orphan list is structurally
blind (the test edge is what makes dep-cruiser see the module), the independent checker is the
guard itself. Revert is whole: one commit per pair.

**2. The merge is GitHub's job, not the run's — and the platform is the gate.** Every code-writing
rung opens its PR ready (never draft) and enables auto-merge at opening; GitHub queues it and lands
it only when the six required `main` checks are green, so a crash after the enable is a merge that
happened anyway and no run polls. The full history is the cautionary one, same day: this ADR first
shipped "enable at opening" against a `main` with no required checks; that's unsafe — an auto-merge
enabled with jobs not yet reported merges against the queue, not the gate (#734 did exactly this).
The interim fix (#735) was "enable at whole-set green, never at opening" — safe but it left the
human-authored dogfood doing the polling. The owner then made `build`, `sensors`, `test-scripts`,
`test-server`, `test-shared`, `test-web` required on `main`, and the gate was verified end-to-end
(#736: auto-merge enabled at opening held `OPEN` through every pending check and merged the instant
they went green), so the protocol returned to its original shape — now with the platform, not the
prose, enforcing it. **The one hole the gate leaves:** `enforce_admins` is off (so the owner's own
pushes and the routines' owner-credentialed tooling still work), which means a **direct**
`gh pr merge` without `--auto` bypasses all six — the flag is mandatory, its absence is the hazard.
If the required set is ever loosened, the enable must move back to whole-set green. A run that sees
red gets one repair attempt; still red, it closes **its own** PR, deletes the branch, and records
the ledger row. Preflight refusals now have a checklist instead of a puzzle: green means finish the
predecessor first (that is tonight's opening move, not a reason to stop), red means close and
re-derive. Codified in both shelf READMEs (rules 3 and 4/5), which every runner already reads.

**3. `digest` carries a closed watchdog-action list** (`digest.md` § 2c) — re-fire a dark
Claude-hosted rung whose trigger id is recorded (≤1 per rung, ≤3 per morning), and un-stick a
routine's stranded draft by marking it ready and enabling auto-merge (green + mergeable +
routine-owned + >24 h only; it never merges, never touches a red or human PR, never a Cursor
rung's output it did not author the stop of). The report tier's mechanical invariant is untouched:
postflight still fails on a non-empty diff, because both actions are calls to the trigger API and
one PR's ready-state — systems whose owner already scheduled and paid for them once — not work
this rung authored. Every action is self-reported in the same comment.

**4. A page-bar ask must be decidable in two minutes, from a phone.** Rule 10 gains a corollary:
each `Needs you:` line is a binary question, a recommendation with its one-clause reason, and an
explicit silence-default — which is always "status quo", never spend, never grant. No answer means
nothing happens, the line ages into the sections, and it re-raises only if the facts change.

**5. The Cursor rungs stay Cursor.** Offered the choice on 2026-09-19, the owner kept
`improve`/`resolve` on Cursor rather than making the whole ladder scriptable: the
finder-vs-payer host split (ADR-0017 § 6) is worth more than full self-healing. The consequence
is named honestly — a dark Cursor rung is still the owner's browser, and `digest`'s job is to make
that visit thirty seconds: name the rung, the declared schedule, and the exact page
(cursor.com/automations), never an investigation.

## Consequences

Positive: a mid-merge crash stops costing the next firing's opening minutes; a dark Claude rung
recovers by 07:00 HKT without a human; the `test-only` class drains nightly through prune and
closes #686 itself; and the owner's remaining asks arrive as decisions rather than topics.

Negative and accepted: `digest` can now spend up to three extra firings a night of the subscription
(bounded, self-reported, and each one is a firing already budgeted for the day); an auto-merged PR
can land without the run that opened it writing its ledger row — rule 7's gap is caught by
watchdog 1's "no evidence it ran", so the record still gets made, just by the next firing; the
re-fire action trusts the ladder table's trigger ids, and a stale id fails loudly (`get`/`run`
error, reportable) rather than firing the wrong rung; and one failure face (Cursor) stays
manually repaired by design.

## Alternatives considered

- **Keep `digest` pure-report.** The status-quo answer is that a report tier that acts is a second
  `improve` without a budget — rejected, because the actions on the list author no work: they
  re-execute the owner's own schedule and land the owner's own green gate.
- **Move `improve`/`resolve` to Claude for total self-healing.** Rejected by the owner: see
  Decision 5 and ADR-0017 § 6's single-point-of-failure reasoning, which is this shelf's answer to
  exactly how late-August `anything` stayed dark for four days.
- **A separate "watchdog-actor" rung** that consumes digest's findings and heals them. Rejected:
  it needs the same evidence pass a second time, and it introduces a second actor coordinating with
  a reporter about the same stuck PRs — two authorities over one recovery is rule 5's failure mode
  in a new hat. The rung that sees the problem carries the closed list of fixes for it.
- **Raise an owner prompt per `test-only` pair, forever.** Rejected on rule 10: the blocker was
  mechanical, the risk is bounded by revert and `check:full`, and the class's empirical answer
  ("nothing reached it in 14+ days") is exactly as good a decision-maker as the person who asked
  the question in the first place.

## Where this lives in code

- [`scripts/routine-guard.mjs`](../../scripts/routine-guard.mjs) — `DEAD_PAIR_DELETE_ROUTINES`,
  `collectDeadPairings`, the pair branch of `checkRoutineDiff` (shipped in #733, `d612f8cd`).
- [`docs/routines/README.md`](../routines/README.md) — the tiers paragraph (report acts ≠ commits),
  rule 3 (auto-merge), rule 5 (recovery checklist), rule 10 (the two-minute-ask corollary).
- [`docs/routines/digest.md`](../routines/digest.md) § 2c + watchdogs 1–2 + the `Needs you:` format
  in § 3. [`docs/automations/README.md`](../automations/README.md) rules 3–4 mirror the merge and
  recovery protocol for the feature shelf.
- [`docs/routines/prune.md`](../routines/prune.md) §§ 1, 1b, 2 gate 5, 5.1–5.2, 6, 7 (#733).
- [`docs/agents/sensors.md`](../agents/sensors.md) § Routine budget row (#733).
