---
name: improve
tier: code-writing
schedule: '0 21 * * *'
maxFiles: 12
maxIssues: 1
prTitlePrefix:
  - 'improve:'
branchPrefix:
  - claude/eager-hopper
allowedPaths:
  - docs/**
  - '*.md'
  - scripts/**
  - packages/eslint-config/**
  - apps/*/test/**
  - packages/shared/test/**
  - apps/*/tsconfig.strict.json
  - apps/web/src/utils/**
  - apps/web/src/components/**
  - apps/web/src/state/**
  - apps/server/src/agents/**
  - apps/server/src/routes/**
  - apps/server/src/mcp/**
---

# Routine: `improve`

**Read [`docs/routines/README.md`](README.md) first — it carries the rules this playbook assumes.**

Makes the project a little better every day. One slice per run, then stop. Opens a PR, merges it
when CI is green.

This routine is also the **owner of every routine's budget**. ADR-0016 made it the quality owner;
ADR-0017 made that mechanical: `routine-guard`'s `BUDGET_OWNERS` means only an `improve` diff may
touch a playbook or a shelf README, and every other routine's postflight rejects it. That is the
asymmetry the whole shelf needs to stay autonomous without self-approving — the routine that widens
a budget is never the routine that spends the widening. `scripts/**` is in this routine's allowlist
for the same reason: the sensors, `test-affected-lib.mjs` and the guard's own tests are quality
infrastructure, and until 2026-09-01 no playbook could reach most of `scripts/`, which stranded
#461, #462 and #473 as "ready for an agent" that no agent could serve. `ALWAYS_FORBIDDEN` still
applies inside that directory — `scripts/routine-guard.mjs` (the referee), the deploy scripts and
`bench-results/` are outside every routine including this one.

## Picking tonight's slice

**Rotate by weekday. Do not walk the queue top-down.**

| Weekday   | Slice                                                      |
| --------- | ---------------------------------------------------------- |
| Monday    | 3. Test hardening                                          |
| Tuesday   | 5. TypeScript leaves                                       |
| Wednesday | 7. Coupling splits                                         |
| Thursday  | 4. Sensor gaps                                             |
| Friday    | 8. Lint severity promotion                                 |
| Saturday  | 6. Doc drift                                               |
| Sunday    | 3–8, whichever the ledger shows has gone longest untouched |

Items **1 (register accuracy)**, **2 (ratchet drift)** and **2b (ownership gaps)** are a **preamble,
not a slice**: run them every night, take the numbers, and record them in the ledger row. They only
_become_ the slice when they turn up something that actually moved the wrong way. Otherwise the run
continues to the weekday's item.

If the rotated item has nothing to do tonight, say so in the ledger row and take the next weekday's
item — not item 1. A run that does one thing properly beats a run that half-does four.

> **Why a rotation and not a priority order.** "Highest unfinished item that fits the budget" ran
> for ten consecutive runs and reached items **1 and 2 every single time**. Items 3–8 were never
> started; `strictIslandFiles` sat at 15/22 from the day the ratchet was created; and both powers
> ADR-0016 granted on 2026-08-22 — self-merged coupling splits and lint-severity promotion — were
> still unused eight days later. The registers and the ratchet drift _slightly_ every night by
> construction, because the other automations keep landing code, so a top-down queue whose first
> two items are "notice that something drifted" can never reach its third. That is a defect in the
> selection rule, not in the routine's judgement.

## Queue

### 1. Register accuracy

Three hand-maintained registers claim numbers reality has moved past. Recompute and correct:
the `CLAUDE.md` § File-size budgets table, [`docs/decisions/0005-monolith-splits.md`](../decisions/0005-monolith-splits.md),
and [`docs/agents/balanced-coupling-priorities.md`](../agents/balanced-coupling-priorities.md)
§ Implementation progress (including its **Last reviewed** date).

### 2. Ratchet drift

```bash
npm run verify:ratchet -- --json
npm run verify:ratchet -- --with-lint      # when lint numbers are the question
```

Whatever moved the wrong way is a candidate task. Whatever moved the right way past its budget is a
free win — tighten that budget to lock it in (tightening needs no written reason; only loosening
does). Record the numbers in the ledger row either way: that log is the trend line, and it is the
only thing that can answer "is this project actually getting better?" in three months.

The ratchet gates no build. Nothing is blocked by a regression here — it is simply this routine's
work.

**When you file rather than fix, label it `needs-triage` — never `ready-for-human`.**
`ready-for-human` is reserved for the page bar in [`README.md`](README.md) § 10, which no filing ever
meets on its own.

```bash
gh issue create --title '…' --body 'filed-by: improve

…' --label needs-triage
```

The `filed-by:` line is the first line of the body, not decoration (`README.md` rule 12): this
routine posts on the owner's credentials, so without it your filing is indistinguishable from theirs
and the shelf cannot see its own inflow. `maxIssues: 1` is your ceiling for a rolling 24 h, and
pay-before-file refuses a new filing while more than three of your own findings sit open past five
days — which, given that this routine is the ratchet's owner, is the point.

**A ratchet regression is a class, not an event, and classes get one issue.** `verify:ratchet` reports
the current set; the set changes nightly and the finding does not. Five open issues (#431, #447, #465,
#478, #499) are all `lintWarnings` past a budget, filed separately between 2026-08-27 and 09-01, and
**none of the five has been closed** — each one costs a gather, a pick, a ledger row and a `review`
pass, and the metric they describe is a single number in `docs/agents/ratchet.json`. Append to the
standing issue for the metric, or fix the number here — you are the only rung with both
`docs/agents/ratchet.json` and the split authority in your budget, and the warning that regressed is
usually the one this routine's own § 7/§ 8 exist to work down.

Escalation is a judgement a routine earns by _inspecting_ the work and refusing it; `resolve` has a
whole section (`resolve.md` § 4) defining that bar. A filer that pre-stamps its own finding
`ready-for-human` is asserting that judgement about something it never attempted, and it closes the
hand-back before it opens: `resolve` gathers `ready-for-agent`, `needs-triage` and unlabelled
issues, so a `ready-for-human` filing **never enters its gather set at all** — not skipped, never
seen.

That is not hypothetical. #431 was filed here already carrying `ready-for-human`, and `resolve`
logged two of its next three runs as "quiet" for precisely that reason, with the issue sitting in
front of it. If you genuinely believe a finding needs a human, say so **in the issue body** and let
the routine whose job it is decide.

Also: `gh issue create` with no `--label` argument leaves an issue unlabelled forever, because
nothing in this repo ever labels one after the fact. `resolve` compensates by gathering unlabelled
issues too, but that is a workaround for this routine's omission — pass the flag.

### 2b. Ownership gaps and budget shortfalls

Two failure shapes strand an issue permanently, and both are a number in a playbook rather than a
judgement. This routine is the only one that can see them from outside, and the only one allowed to
fix them.

```bash
# 1. Is every file named by an open issue reachable by the routine its label promises?
gh issue list --state open --limit 60 --json number,title,labels,body > /tmp/backlog.json
node scripts/routine-guard.mjs --reachable $(grep -ohE '`(apps|packages|scripts|docs)/[^`]+`' /tmp/backlog.json | tr -d '`' | sort -u)
```

Exit 1 with a `NONE` line is a stuck issue: correctly scoped, correctly labelled `ready-for-agent`,
and no budget on either shelf can reach the file. Three were in that state on 2026-08-31 (#461, #462,
#473) and `resolve` logged a skip against each of them every night it ran. Widen the owning playbook
here — this is exactly the case ADR-0016's authority was granted for. Name the change in the PR body
with a line starting `budget-change:` so the `digest` watchdog can list it.

```bash
# 2. Whose ledger says it was one file short, or one path short?
grep -rn 'blocked-by-' docs/routines/ledger docs/automations/ledger
```

A `blocked-by-budget` row is a routine recording that the only thing between it and a fix is
`maxFiles`. #402 carried two such rows across two runs — nine files needed, six allowed, the seventh
being the regression test the fix cannot ship without — and stayed `ready-for-human` for a week while
a human it never needed went unread. Raise the number, cite the ledger row as the reason, and relabel
the issue `ready-for-agent`. Do not lower the bar instead: the missing file is never the test.

Playbook prose that a routine could not reach because of a rule, rather than a path, stays this
routine's queue item too — but the front-matter rule is the guard's, not this paragraph's: `review`,
`resolve` and `deps` are mechanically refused when they touch a playbook or a shelf README.

**Third: the backlog that points at you.** Any open issue whose named files `--reachable` attributes
to `improve` and to no one else is yours **tonight, ahead of the weekday rotation**. You are the only
routine that can serve it, and `resolve` will log a skip against it every night it exists — which is
what #461, #462, #473 and #476's remaining item each did for a week. Same bar as `resolve` § 3 (a
regression test that fails without the fix), same budget, and the issue gets closed with the PR link.

### 3. Test hardening

Apply the trap checklist from [`review.md`](review.md) § 2 to **existing** suites, not just new
diffs. Dead `vi.mock` paths, sweeps with no non-empty companion assertion, one-block `act`, floor
tests missing the midday clock pin or the `0.75` PRNG seed.

**Never delete a test.** Before repairing a dead mock, establish what it was doing: one that has
never executed is not load-bearing, so deleting it is a zero-behaviour change while making it live
is a real one.

### 4. Sensor gaps

Turn a class of drift into a check that catches it for free. One per run, with tests **and a
deliberate negative case** — break the thing on purpose, watch the sensor fail, put it back. A
sensor never observed failing has not been tested.

Known gaps: `formatter.cjs`'s `GUIDANCE` map duplicates `guidance.js` with nothing asserting they
agree.

Closed, and left here as worked examples of the shape: `SERVER_STRICT_ISLAND_FILES` vs
`apps/server/tsconfig.strict.json` (sensor added by #466 — but neither file _selected_ it until
#462/#473's fix, so the sensor existed and was unreachable, which is the second half of this item);
and the one-directional bundle guards in `scripts/test-affected-lib.mjs`, where "every listed path
exists" was checked and "every suite on disk is listed" was not — four metaphor and ten
`officeFloor*` suites had drifted out of reach of `test:affected` before the reverse guard landed.

### 5. TypeScript leaves

One or two per run, following [`docs/recipes/convert-js-leaf-to-ts.md`](../recipes/convert-js-leaf-to-ts.md)
exactly — `git mv` to preserve history, importers untouched, path appended to the relevant
`tsconfig.strict.json`.

Respect ADR-0006's sequencing: order by **churn, not size**; `mcpServer.js` waits for its ADR-0005
split, `diagramStore.js` likewise, `App.jsx` converts _as_ it splits and never both at once. Pure
`apps/web/src/utils/*.js` leaves are the intended starting ground, which is why they are the only
`apps/web/src` path in this routine's allowlist.

### 6. Doc drift

**Start by reading the backlog, not the docs.**

```bash
gh issue list --state open --label ready-for-agent --json number,title,body
```

Any of those whose fix lives under `docs/**` or a root `*.md` is **this routine's** work on this
night. `review` files such findings precisely because they are outside its own `allowedPaths`, and
until 2026-08-30 `resolve` had those same paths, so a doc finding was visible only to routines that
could not act on it (#441 sat that way, correctly labelled, for days). `resolve` can reach `docs/**`
now, but this routine gets first refusal on the doc-shaped ones because it already carries the
whole doc surface and `resolve`'s budget is better spent on `apps/**`.

Then, if the backlog is clear:

`GLOSSARY.md` is scanned by no check at all, while [`docs/agents/domain.md`](../agents/domain.md)
tells every agent to prefer its terms — so glossary drift silently degrades every downstream issue
title and test name. `README.md` and [`docs/guide/README.md`](../guide/README.md) carry
near-identical operator tables that will diverge.

### 7. Coupling splits (ADR-0016)

A file over its [ADR-0005](../decisions/0005-monolith-splits.md) budget, or a duplicated wire
constant flagged in [`docs/agents/balanced-coupling-priorities.md`](../agents/balanced-coupling-priorities.md),
is in budget **when it matches an extraction pattern already used elsewhere in the file** —
closure helpers into a sibling `*Helpers.{js,ts}`, a per-feature `register*`/feature hook, a
duplicated enum into `packages/shared`. Do the smallest slice that clears the specific violation
(e.g. the one family of graph-edit handlers that pushed the file over budget), not a full
reorganisation. Update the ADR-0005 table and `balanced-coupling-priorities.md` § Implementation
progress in the same PR.

If the extraction isn't a clear instance of an existing pattern — the seam is ambiguous, or fixing
it means picking between two reasonable designs — push the branch, open the PR, do **not** merge,
and say what's unsure in the PR body (ADR-0015's escalation exception). One split per run.

### 8. Lint severity promotion (ADR-0016)

For a rule that has sat at `warn` for at least two weeks: `git log --since="2 weeks ago" -S'<rule
name>' -- '**/*.js' '**/*.jsx' '**/*.ts' '**/*.tsx'` (or grep the diff of each commit touching
`eslint-disable` lines) for any suppression added in that window. If the window since the later of
the rule's introduction or its last promotion attempt (check the ledger) is at least two weeks and
turns up nothing, flip the rule to `error` in `packages/eslint-config/**`, run `npm run check`, and
record the evidence (the command and its empty output, the date range) in the PR body and ledger. If
the window isn't old enough yet or turns up a suppression, leave it as a ledger `todo` — nothing to
decide, just not ready.

## Not this routine's job

No new dependencies. Adding a package is a licence/supply-chain/bundle decision — file an issue.

No slot content, ever — ADR-0010 reserves the product's six diagram slots (mermaid, infographic,
metaphor3d, chart, anything, forms) for the user's own pipeline. Refactoring the code that manages a
slot (e.g. splitting `diagramStore.js`) is in scope; generating or editing what a slot actually
contains is not.

## Verification

```bash
npm run routine:guard -- --preflight improve    # BEFORE starting
npm run precommit
npm run check
npm run routine:guard -- --postflight improve   # BEFORE pushing
```

The guard is the safety model, not a formality: it re-reads `maxFiles` / `allowedPaths` /
`forbiddenPaths` from this playbook's own front-matter and checks the real diff, because a routine
runs unattended and its safety cannot rest on the model having read the prose.

Preflight also enforces README rule 5 — it refuses to start behind an open PR of this routine's
own, matched on the PR title prefix (branch names are generated by the cloud runner, so the branch
alone cannot identify who opened a PR). If it _warns_ that it could not read open PRs, `gh` is
missing or unauthenticated and that check did not run: confirm by hand before pushing. An absent
answer is not "no open PR".

A sensor or script change also needs `npm run test:scripts` plus the negative case from § 4.
