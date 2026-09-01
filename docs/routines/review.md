---
name: review
tier: code-writing
schedule: '0 20 * * *'
maxFiles: 6
prTitlePrefix:
  - 'review:'
branchPrefix:
  - review/
  - claude/practical-newton
allowedPaths:
  - docs/routines/ledger/review.md
  - apps/**
  - packages/**
forbiddenPaths:
  - apps/server/src/mcp/apps/**
  - apps/web/src/assets/**
---

# Routine: `review`

**Read [`docs/routines/README.md`](README.md) first — it carries the rules this playbook assumes.**

Reviews everything that landed on `main` in the last 24 hours, fixes at most one bug it can prove,
and files the rest as issues. Opens a PR, merges it when CI is green.

`0 20 * * *` (04:00 HKT) sits after all three feature automations have landed their PRs —
`metaphor3d` (`0 15`, 50–120 min), `anything` (`15 17`), `canvas-graph-edit` (`30 18`). Their work
gets reviewed by nobody else. It runs _before_ `improve` and `resolve` so the issues it files are
in the backlog when `resolve` reads it three hours later.

> **The night ladder** (all crons UTC; the owner is GMT+8, so the whole pipeline runs while
> they're asleep and the digest is waiting when they wake). Gaps are sized from _measured_ run
> durations, not a flat stagger — an earlier flat 1 h stagger overlapped twice.
>
> | HKT   | UTC           | Job                 | shelf       | host   |
> | ----- | ------------- | ------------------- | ----------- | ------ |
> | 23:00 | `0 15 * * *`  | `metaphor3d`        | automations | Claude |
> | 01:15 | `15 17 * * *` | `anything`          | automations | Claude |
> | 02:30 | `30 18 * * *` | `canvas-graph-edit` | automations | Claude |
> | 04:00 | `0 20 * * *`  | `review`            | routines    | Claude |
> | 05:00 | `0 21 * * *`  | `improve`           | routines    | Claude |
> | 06:15 | `15 22 * * *` | `resolve`           | routines    | Cursor |
> | 07:00 | `0 23 * * *`  | `digest`            | routines    | Claude |
>
> The order is a dependency order, not a convenience: the feature automations produce the code,
> `review` reads what landed, `improve` works the quality queue, `resolve` works the backlog the
> first two just filed, and `digest` reports on all of it. Until 2026-08-30 the live crons ran
> `improve` → `review` → `resolve` with `review` firing _during_ `improve`'s run, which inverted
> the two rationales the playbooks state below. `resolve` moved to Cursor on 2026-09-01 (ADR-0017) so
> that the routine which _finds_ work and the one which _pays_ for it are not one account's two
> failures: when `anything` went dark for four nights in late August, every job that should have
> noticed was on the same host.
>
> [`deps`](deps.md) (`30 4,16 * * *`, Claude) sits **off** the ladder on purpose. Dependency queues
> move in bursts when an advisory lands, a twice-daily read of a short list costs minutes, and it
> should never share a four-hour window with a review that costs an hour.
>
> **One fleet per 24-hour window.** Two hosts scanning the same commits is not redundancy — on
> 2026-08-29 `review` and Cursor's unregistered `critical-bug-memory` automation both found the same
> `renameErNode` label-guard bug and each paid for a PR (#442 closed unmerged, redundant with #446).
> Any automation with write access to product code must appear in the table above or in
> [`docs/automations/README.md`](../automations/README.md); one that appears in neither is
> unregistered, and its next finding is somebody else's duplicate work.

## 1. Window

```bash
git fetch origin main
git log --oneline --since='24 hours ago' origin/main
```

Nothing landed → append a quiet row to the ledger and stop. That is a successful run.

Read the ledger's run log first. A finding already reported is not a new finding, and a bug already
filed does not get a second issue.

## 2. Review

Two axes, run as parallel sub-agents so they do not pollute each other's context, reported
separately — never merged or reranked, because a change can pass one and fail the other. Method:
[`.claude/skills/mattpocock/engineering/code-review/SKILL.md`](../../.claude/skills/mattpocock/engineering/code-review/SKILL.md).

- **Standards** — repo conventions plus the Fowler smell baseline the skill carries. Skip anything
  the sensors already enforce; `npm run check` has spoken on formatting, boundaries and types.
- **Spec** — does the diff do what its PR body said? Behaviour nobody asked for is a finding.

Then the archislop trap checklist. These are failure modes this repo has actually shipped, and every
one **passes while examining nothing**, so none appear as a red build:

| Look for                                                                       | Why                                                                                     |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| A `vi.mock` path that resolves nowhere                                         | Vitest no-ops it; the real module runs and the suite passes for the wrong reason        |
| A loop over a derived set with no companion non-empty assertion                | A sweep over an empty list passes while testing nothing                                 |
| `rerender(...)` and `advanceTimersByTimeAsync(...)` in one `act` block         | The clock advances before the timer exists                                              |
| A mounting floor test missing the midday clock pin or the `0.75` PRNG seed     | Passes alone, fails in file order — or is red only in the afternoon                     |
| A locale key added to `en` only                                                | Office bundles swap wholesale; UI bundles merge onto English. Both fail silently        |
| A wire field added producer-side only                                          | Server works, web silent — see [`docs/agent-blast-radius.md`](../agent-blast-radius.md) |
| A new `packages/shared` module used without `npm run build -w packages/shared` | Resolves to `dist`, so the import is `undefined` at runtime                             |
| A second composition of floor activity outside `floorActivityFor`              | ADR-0011: six components draw figures                                                   |

## 3. Fixing — what "confident" has to mean

**One bug per run, and a fix ships only with a test that fails without it.**

Write the regression test first. Run it against the unfixed code and _observe it red_. Then fix, and
watch it go green. A bug you cannot make a test fail for is not one you understand well enough to
fix unattended — file it and move on.

This is not ceremony. This repo's own notes are full of tests that pass while examining nothing, and
"does not throw" being a dangerous assertion shape. An unattended self-merged fix with no failing-
first test is exactly that shape.

Also: file the issue even when the fix lands, so there is a record; never widen the fix beyond the
bug; never touch a don't-touch path.

Everything else found becomes an issue, labelled per
[`docs/agents/triage-labels.md`](../agents/triage-labels.md) — `ready-for-agent` when it names the
file, the symptom and what correct looks like, `needs-triage` otherwise.

**Before applying `ready-for-agent`, ask the guard whether any agent can actually reach the file**
(`README.md` rule 11):

```bash
npm run routine:guard -- --reachable apps/web/src/utils/theFileTheFindingNames.js
```

`-> NONE` means the label would be a promise this routine cannot keep — #462 and #473 were exactly
that for a week. Label it `needs-triage`, name the file in the body, and `improve` § 2b widens the
budget. Never `ready-for-human`: it is page-bar-only (README rule 10) and a finding that "looks like a
human decision" is nearly always, on inspection, a number in a playbook that `improve` owns.

**Confidence bar for filing:** if you would not bet on it being real, do not file it. A tracker
that fills with speculation gets ignored, which costs more than the findings were worth.

## 4. Benches

Five corpus-only drivers, no API key, non-zero exit on expectation drift:

```bash
node --import ./scripts/register-antv-layout-esm.mjs --import tsx \
  apps/server/scripts/benchMermaid.js --tag review-$(date +%F)
node apps/server/scripts/benchInfographic.js --tag review-$(date +%F)
node apps/server/scripts/benchChart.js --tag review-$(date +%F)
node apps/server/scripts/benchMetaphor.js --tag review-$(date +%F)
node apps/server/scripts/benchAnything.js --tag review-$(date +%F)
```

**Never `benchAnythingGeneration.js`** — it drives a real model, so it costs tokens and needs a key.
A scheduled job quietly spending tokens every morning is the kind of thing nobody notices until the
bill.

An **expectation** drift (a case whose accept/reject flipped) earns an issue — that is a real
validator behaviour change. Latency on a shared runner is informational; worth a sentence, never an
issue. Do not commit snapshots: `apps/server/bench-results/` is on the don't-touch list, and a daily
snapshot would bury the meaningful baselines.

## 5. Close

Append a ledger row: date, commits reviewed, bug fixed (or none), issues filed with numbers, bench
verdict. Open the PR, wait for CI, merge it when green.

## Holding a PR, and not nagging

A fix that is correct but risky to merge unattended uses the same hold as
[`resolve.md`](resolve.md) § 4: push it, open the PR, say plainly in it what is unsure, do not merge —
and **leave every label alone**. The hold is a state in the repo, not a message to the owner; the only
things that reach them are the four conditions in `README.md` rule 10.

If the same finding recurs three runs running with nothing actioned, say so once in the ledger and
then stop repeating it. Nagging is how a routine gets muted — and a muted routine is how `anything`
went four nights unnoticed.

## Verification

```bash
npm run routine:guard -- --preflight review    # BEFORE starting
npm run precommit
npm run check
npm run routine:guard -- --postflight review   # BEFORE pushing
```

The guard is the safety model, not a formality: it re-reads `maxFiles` / `allowedPaths` /
`forbiddenPaths` from this playbook's own front-matter and checks the real diff, because a routine
runs unattended and its safety cannot rest on the model having read the prose.

Preflight also enforces README rule 5 — it refuses to start behind an open PR of this routine's
own, matched on the PR title prefix (branch names are generated by the cloud runner, so the branch
alone cannot identify who opened a PR). If it _warns_ that it could not read open PRs, `gh` is
missing or unauthenticated and that check did not run: confirm by hand before pushing. An absent
answer is not "no open PR".
