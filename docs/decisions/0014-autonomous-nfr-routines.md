# ADR-0014: Autonomous NFR routines

## Status

Accepted — 2026-08-20

## Context

Most of this repo's changes now arrive from scheduled or human-prompted agent runs. **Two**
unattended feature automations already run daily: a Cursor automation at 08:00 HKT (00:00 UTC), and
a Claude Routine at 20:00 UTC that improves the Metaphor3D deliverables and merges its own PRs. They
work, and they have three properties that are fine for feature work and would not survive being
copied into a quality-enforcement mechanism:

1. **Nothing reviews its output.** Its PRs merge minutes after opening. The repo has had zero open
   issues and no PR that ever waited for a human. Feature work lands unreviewed by construction.
2. **Its instructions are not in the repo.** The whole prompt is one blob inside the cron trigger:
   not versioned, not diffable, not reviewable, and unable to improve.
3. **Non-functional quality drifts unobserved.** Measured while writing this ADR: every row of the
   `CLAUDE.md` file-size budget table was stale, `DiagramCanvas.jsx` by 592 lines. All 1206 ESLint
   findings are `warn`, so `npm run lint` cannot fail on severity and ADR-0007's promotion clause
   has never been exercised. There is no coverage tooling across 364 test files. Six offline,
   key-free benchmark drivers exist and nothing runs them.

None of that is a correctness bug, which is exactly why nothing catches it: no gate is red. It is
the boring, endless, low-glamour work that a schedule is genuinely good at — provided the schedule
cannot quietly make things worse while nobody is watching.

Three existing decisions argue against a scheduled improvement bot, and must be answered rather
than routed around ([`docs/agents/domain.md`](../agents/domain.md) requires surfacing an ADR
conflict, not silently overriding it):

- **[`docs/agents/balanced-coupling-priorities.md`](../agents/balanced-coupling-priorities.md)**:
  _"Do not start hub splits unless you are already editing that file for a feature."_ A scheduled
  run has no feature to be on contact with.
- **[ADR-0010](0010-cast-agency-sign-off.md)** consequence 4: _"the retracted commission/lane
  machinery must not creep back in feature-shaped disguises (auto-fix-on-idle, 'let Chad try',
  scheduled refreshes)."_
- **[ADR-0007](0007-sensors-for-coding-agents.md)** rollout: threshold rules stay warnings until a
  rule has had _"a two-week quiet period with no unexplained suppressions."_

## Decision

Adopt **NFR routines**: scheduled agent runs whose instructions live in the repository and whose
budget is enforced by a script rather than by prose.

**1. The playbook is a repo file; the trigger is a loader.** Each routine is
`docs/routines/<name>.md` (what it does, and a YAML budget) plus `docs/routines/ledger/<name>.md`
(durable memory across cold-start runs). The cron prompt is three lines pointing at those two files
and adds nothing to them. A playbook can therefore be reviewed in a PR, diffed, and improved —
including by the routine that runs it. [`docs/routines/README.md`](../routines/README.md) holds the
rules every playbook inherits.

**2. Both routines write code, open a PR, and merge it themselves once CI is green.** The PR exists
so the owner has a reference to skim, not as a gate. What keeps that safe is the **budget**, not a
human in the loop: a small `maxFiles`, an explicit path allowlist, and — for `review` — the rule
that a fix ships only with a test that fails without it. A playbook may still declare
`tier: report` to write no code at all; the two shipped routines do not.

**3. The budget is mechanical.** `npm run routine:guard` re-reads the playbook and checks the actual
diff: file count, allowed and forbidden path globs, an always-forbidden list mirroring
`AGENTS.md` § Don't-touch, no deleted test files, and no test file whose case count fell. Preflight
additionally refuses to start a second branch while the routine's previous PR is open.

**4. Quality metrics are tracked, and gate nothing.** `docs/agents/ratchet.json` records a budget
and an `initial` value for monolith size, lint warning volume, strict-island coverage and suite
size. `npm run verify:ratchet` reports which have moved the wrong way, and is deliberately **not**
in `npm run check`, not in CI, and not in any hook.

A hard gate was the first design and was wrong. With two unattended feature automations, a metric
that reddens a build at 00:00 or 20:00 UTC does not get the code fixed — the agent is blocked by
something unrelated to its task, and the cheapest way out is raising the budget. That teaches
exactly the habit the ratchet exists to prevent, and costs an unattended run.

So the ratchet is an **instrument the `improve` routine owns**: it reads the numbers (`--json`),
writes them to its ledger, and a wrong-way move becomes its next work item. Quality is pulled by the
routine rather than pushed by a red build. Raising a budget still needs a written `reason`, and the
script reports a budget that differs from its `initial` without one — so the file carries the
history of every concession.

**5. The three constraints above are honoured, not overridden:**

- **Split on contact stands.** No routine performs an unprompted refactor or hub split. Coupling
  work is report-only: it updates the priorities doc and files issues.
- **ADR-0010 is scoped, not superseded.** ADR-0010 governs the **product's** cast spending agent
  compute on the user's diagram slots without the user asking. NFR routines operate on the
  **repository** at development time, author no slot content, and cost the user nothing in-product.
  The human initiative ADR-0010 requires is the act of creating the routine. That distinction is the
  whole carve-out; a routine that ever writes to a diagram slot has broken it.
- **ADR-0007's quiet period stands.** No routine promotes a lint severity. A routine may open an
  issue presenting the quiet-period evidence; a human decides.

## Consequences

Positive:

- Feature work gets a second pair of eyes the morning after it lands, without blocking it.
- Regressions become visible and owned. `DiagramCanvas.jsx` gaining 592 lines past its ADR-0005
  budget went unnoticed for months because no one was measuring; now something measures daily and
  has to either fix it or say why not.
- Routine instructions become reviewable artifacts, so the routines can be improved like code.
- The ledger makes "did this actually improve anything?" answerable months later.

Negative:

- **Nothing enforces the ratchet.** Quality improves only as fast as the `improve` routine actually
  works its queue. If that routine stalls or is disabled, the numbers drift again with nobody
  noticing — the same failure this ADR set out to fix, one level up. The ledger is the tell: a run
  log that stops is the signal to look.
- **`review` writes product code, self-merges, and `main` auto-deploys to Cloud Run.** The
  failing-test rule, a small `maxFiles`, and green CI are the entire safety model. Tightening
  `maxFiles` or moving a path into `forbiddenPaths` is one line in the playbook, enforced
  mechanically from the next run.
- Baselines are a snapshot. `ratchet.json` records where the repo stood on 2026-08-20; a metric that
  was already bad is frozen at bad rather than fixed.
- Lint counting is opt-in, so lint volume can drift between routine runs.
- More scheduled surface to keep honest: two more cron jobs, two playbooks and two ledgers, all of
  which can themselves go stale. `verify:agent-infra` and `verify:doc-paths` now scan
  `docs/routines/` to limit that.

## Alternatives considered

- **Clone the feature routine's shape — one big prompt, self-merge, no guard.** Cheapest, and how
  the existing routine works. Rejected because the three gaps in Context are properties of that
  shape, and copying it multiplies them instead of fixing them.
- **Keep prompts in triggers, add only the ratchet.** Gets the measurement without the doc shelf.
  Rejected because an unversioned prompt cannot be improved, "improve over time" was the point, and
  with no routine owning the numbers the ratchet would report into the void.
- **Ratchet as a hard gate in `npm run check`.** Shipped first, then reverted before this ADR was
  accepted. The objection that killed it: with two unattended daily automations, the gate's first
  real effect would be failing a run nobody is watching, over a metric unrelated to that run's task
  — and the cheapest way out of that is raising the budget, which is the habit the gate existed to
  prevent. Visibility without a gate is genuinely weaker; visibility **plus a routine whose job is
  to act on it** is not the unowned visibility we had before, which is what let the drift happen.
- **Ratchet only routine-authored PRs.** Avoids ever blocking feature work. Rejected as the worst of
  both: it would guard everything except the source of the measured regressions.
- **Let routines refactor monoliths directly.** Highest value on paper. Rejected: it contradicts
  "split on contact" in writing, and an unattended refactor is the change least suited to a diff
  nobody reads.
- **Supersede ADR-0010 outright.** Rejected as too broad — its product-side rule is still right, and
  scoping it costs nothing.

## Where this lives in code

| Concern             | File                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared contract     | [`docs/routines/README.md`](../routines/README.md)                                                                                             |
| Playbooks           | [`docs/routines/review.md`](../routines/review.md), [`docs/routines/improve.md`](../routines/improve.md)                                       |
| Durable memory      | `docs/routines/ledger/*.md`                                                                                                                    |
| Budget enforcement  | [`scripts/routine-guard.mjs`](../../scripts/routine-guard.mjs)                                                                                 |
| Quality ratchet     | [`scripts/verify-ratchet.mjs`](../../scripts/verify-ratchet.mjs), `docs/agents/ratchet.json`                                                   |
| Doc/script coverage | [`scripts/verify-agent-infra.mjs`](../../scripts/verify-agent-infra.mjs), [`scripts/verify-doc-paths.mjs`](../../scripts/verify-doc-paths.mjs) |

## References

- ADR-0005 — Splitting monolithic files for agent-friendly editing (the LOC scoreboard)
- ADR-0006 — TypeScript migration as a sliding ratchet (the mechanism this generalises)
- ADR-0007 — Sensors for coding agents (the promotion clause, and the guidance convention)
- ADR-0010 — Cast agency (the constraint this ADR scopes)
- [`docs/agents/balanced-coupling-priorities.md`](../agents/balanced-coupling-priorities.md) — split on contact
