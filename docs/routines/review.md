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
> | HKT   | UTC           | Job                 | shelf       |
> | ----- | ------------- | ------------------- | ----------- |
> | 23:00 | `0 15 * * *`  | `metaphor3d`        | automations |
> | 01:15 | `15 17 * * *` | `anything`          | automations |
> | 02:30 | `30 18 * * *` | `canvas-graph-edit` | automations |
> | 04:00 | `0 20 * * *`  | `review`            | routines    |
> | 05:00 | `0 21 * * *`  | `improve`           | routines    |
> | 06:15 | `15 22 * * *` | `resolve`           | routines    |
> | 07:00 | `0 23 * * *`  | `digest`            | routines    |
>
> The order is a dependency order, not a convenience: the feature automations produce the code,
> `review` reads what landed, `improve` works the quality queue, `resolve` works the backlog the
> first two just filed, and `digest` reports on all of it. Until 2026-08-30 the live crons ran
> `improve` → `review` → `resolve` with `review` firing _during_ `improve`'s run, which inverted
> the two rationales the playbooks state below.

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
file, the symptom and what correct looks like, `needs-triage` otherwise. Only `wontfix` exists on
the repo today; the rest may need creating on first use.

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

## Escalation

If the same finding recurs three runs running with no issue actioned, say so once in the digest and
then stop repeating it. Nagging is how a routine gets muted.

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
