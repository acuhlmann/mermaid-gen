---
name: review
tier: code-writing
schedule: '30 21 * * *'
maxFiles: 6
maxIssues: 2
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

`30 21 * * *` (05:30 HKT) sits after all four feature automations have landed their PRs —
`metaphor3d` (`0 15`, 50–120 min), `office-life` (`0 18`), `anything` (`30 19`),
`canvas-graph-edit` (`30 20`). Their work gets reviewed by nobody else. It runs _before_ `improve`
and `resolve` so the issues it files are in the backlog when `resolve` reads it just over two hours
later.

> **The night ladder** (all crons UTC; the owner is GMT+8, so the whole pipeline runs while
> they're asleep and the digest is waiting when they wake). The window is **23:00 → 08:45 HKT**:
> it opens when the owner is off the machine and closes just before they sit down to read the digest
> and merge what is held. Gaps are sized from _measured_ run durations, not a flat stagger — an
> earlier flat 1 h stagger overlapped twice.
>
> | HKT   | UTC           | Job                 | shelf       | host   | worst end (UTC)    |
> | ----- | ------------- | ------------------- | ----------- | ------ | ------------------ |
> | 23:00 | `0 15 * * *`  | `metaphor3d`        | automations | Claude | 17:00              |
> | 23:30 | `30 15 * * *` | `prune`             | routines    | Claude | 15:50              |
> | 02:00 | `0 18 * * *`  | `office-life`       | automations | Claude | 19:10              |
> | 03:30 | `30 19 * * *` | `anything`          | automations | Claude | 20:00              |
> | 04:30 | `30 20 * * *` | `canvas-graph-edit` | automations | Claude | 20:35 — **parked** |
> | 05:30 | `30 21 * * *` | `review`            | routines    | Claude | 22:20              |
> | 06:30 | `30 22 * * *` | `improve`           | routines    | Cursor | ~00:00             |
> | 07:45 | `45 23 * * *` | `resolve`           | routines    | Cursor | ~00:30             |
> | 08:45 | `45 0 * * *`  | `digest`            | routines    | Claude | ~01:00             |
>
> **Trigger ids** (read back from the API on 2026-09-14). `digest` watchdog 4 should `get` a rung by
> these instead of scanning `claude -p '/schedule list'`, which returns only the newest 20 routines and
> ignores its own cursor — see [`digest.md`](digest.md) § Watchdog 4.
>
> | Rung                 | Trigger id                          | Host   |
> | -------------------- | ----------------------------------- | ------ |
> | `metaphor3d`         | **unknown** — off page 1, see below | Claude |
> | `prune`              | `trig_016hHBBM3gvFUABH8TovEnus`     | Claude |
> | `office-life`        | `trig_01XBthD1GSYCJJdwQLV2WVt9`     | Claude |
> | `anything`           | `trig_015dexe7woDn9aGf3qN5cW9B`     | Claude |
> | `canvas-graph-edit`  | `trig_018pjzUAiH5yQsuiMWfUk8Kc`     | Claude |
> | `review`             | `trig_01HDohnas6PHZR8YvuUBownG`     | Claude |
> | `deps`               | `trig_01Dk8ZwZCpXfXGREJyHnh9Up`     | Claude |
> | `digest`             | `trig_018WLnVs2MAVHAHzGG6YMUYr`     | Claude |
> | `improve`, `resolve` | n/a — Cursor automation             | Cursor |
>
> `metaphor3d` is the one rung nobody on this machine can address: it is the oldest routine, so the
> 20-row page cap has already swallowed it, and `get_run_log` on one of its sessions carries no trigger
> id either. Retreiving it is a claude.ai/code/routines lookup (the owner's), and once it is written
> here it stops being a problem — **the 2026-09-14 retiming is the reason to do it**, because that rung
> is the only one this document commands that no cron change was applied to.
>
> The order is a dependency order, not a convenience. The four **producers** come first
> (`metaphor3d` → `office-life` → `anything` → `canvas-graph-edit`), longest first: a long job at the
> head of the chain absorbs its own overrun, whereas a long job in the middle delays everything behind
> it by whatever it overran — which is what `metaphor3d` at `0 15` against `anything` at `15 17` did
> until 2026-09-14 (a 15-minute buffer on a 2-hour job). `review` reads what they landed, `improve`
> works the quality queue that `review` just priced, `resolve` works the backlog the first two just
> filed, and `digest` reports on all of it as the last line before the owner wakes.
> `prune` is in the table now, and it sits at the **head** of the ladder rather than its tail — see the
> paragraph below. Its own slot is the one thing `metaphor3d`'s presence at the top forced: 30 minutes
> apart is under this shelf's "stagger by at least an hour" convention, and it is deliberate. That rule
> exists so two rungs do not fight over `main`, and a rung that can only ever propose a PR cannot fight
> with anything. The hour it buys in exchange (pruning a tree that `metaphor3d` is concurrently
> changing) is worth less than the day it used to cost the owner's attention.
>
> Until 2026-08-30 the live crons ran `improve` → `review` → `resolve` with `review` firing _during_
> `improve`'s run, which inverted the two rationales the playbooks state below. `resolve` moved to
> Cursor on 2026-09-01 (ADR-0017) so that the routine which _finds_ work and the one which _pays_ for
> it are not one account's two failures: when `anything` went dark for four nights in late August,
> every job that should have noticed was on the same host. `improve` moved to Cursor on 2026-09-11
> when its cron slot began firing from a Cursor automation (#644); retire any parallel Claude-side
> `improve` trigger so only one worker runs per window (see #660).
>
> [`deps`](deps.md) (`30 4,14 * * *`, Claude) sits **off** the ladder on purpose, and its night firing
> now lands **thirty minutes before the window opens** rather than inside it. Dependency queues move in
> bursts when an advisory lands, a twice-daily read of a short list costs minutes, and it should never
> share a four-hour window with a review that costs an hour. The old `30 16` UTC slot put a Dependabot
> merge into `main` in the middle of `metaphor3d`'s run; a rung that moves the base commit should do it
> while nothing is branched, because every producer that started afterwards inherits the change and
> every one already running gets a surprise conflict.
>
> [`prune`](prune.md) joined the ladder on 2026-09-14, second behind `metaphor3d`. Its two prior
> firings were 2026-09-13 (owner-triggered by hand, `stale-doc`, #670, merged by the owner in 31 min)
> and 2026-09-14 (first on-cron firing, `dead-file`, #681, merged by the owner in 51 min) — evidence a
> scheduled `prune` is safe to stand up, and the same evidence the owner read the next morning when they
> lifted its `mergePolicy: hold` and made it self-merging too (`prune.md` § 5).
> **(1)** It must precede `digest`, which reports on whatever merged inside its window; a prune firing
> an hour _after_ the digest left the owner finding an unannounced deletion in `git log`. **(2)** It
> branches off the quietest `main` of the day — the owner's daytime merges have all landed and nothing
> else merge-capable has started — and landing at 23:30 means `office-life`, `anything` and
> `canvas-graph-edit` each run `npm run check` against the tree it deleted from, before anyone is awake
> to be surprised. Its candidates come from `npm run prune:scan`, a report that is deliberately absent
> from `check`, so a row in this table is also the only thing that makes the rung visible to a reader at
> all.
>
> **One fleet per 24-hour window.** Two hosts scanning the same commits is not redundancy — on
> 2026-08-29 `review` and Cursor's unregistered `critical-bug-memory` automation both found the same
> `renameErNode` label-guard bug and each paid for a PR (#442 closed unmerged, redundant with #446).
> Any automation with write access to product code must appear in the table above or in
> [`docs/automations/README.md`](../automations/README.md); one that appears in neither is
> unregistered, and its next finding is somebody else's duplicate work.
>
> **Nothing here is enforced by the crons — it is enforced by the mirrors.** Nine files state these
> nine crons, and `npm run verify:agent-infra` fails if any of them disagree, if a ladder rung moves
> outside the 15:00–01:00 UTC window, or if a rung's UTC hour and the HKT column stop matching. That
> sensor landed the same day as this retiming, because a ladder restated in nine places is nine places
> to get wrong.

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

**Filing is a budget, not a release valve** (`README.md` rule 12). `maxIssues: 2` is this routine's
ceiling for a rolling 24 h and `routine:guard --postflight` counts the real number; `review` filed
three findings in one night on 2026-09-04 while the only rung that clears them takes one a night, so
the third now goes into a standing issue instead of a new number. Every body you open starts with the
line `filed-by: review` — without it your filing has no author, since you post on the owner's
credentials like everything else here (rule 9). And a `review` run already carrying more than three of
its own findings older than five days files nothing until it resolves one: check with
`npm run routine:guard -- --filings` before you open anything.

One exception is deliberate: a **product-shaped** finding (a hit-test, a new mutator, an affordance)
is not `ready-for-agent` — label it `enhancement`. `resolve` § 2 refuses design questions on sight, so
the other label would only add a permanent resident to a queue nobody is scheduled to serve. #495,
#523 and #536 are that mistake, made three times.

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
