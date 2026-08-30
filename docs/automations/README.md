# Feature automations — the contract

Scheduled, unattended **feature** work on a diagram slot. Unlike [NFR routines](../routines/README.md)
(`review`, `improve`, `resolve`), these automations ship product improvements — validation gates,
prompts, benches, and renderer fixes for one slot at a time.

Every feature automation is three things:

| Piece        | Where                               | What it is                                             |
| ------------ | ----------------------------------- | ------------------------------------------------------ |
| **Playbook** | `docs/automations/<name>.md`        | What this automation does, and the budget it may spend |
| **Ledger**   | `docs/automations/ledger/<name>.md` | What it has already done — durable memory across runs  |
| **Trigger**  | a Cursor automation (cron)          | Three lines that point at the two files above          |

The trigger prompt is deliberately almost empty:

```
Run the feature automation `<name>`.
Read docs/automations/README.md (the contract), then docs/automations/<name>.md (the playbook),
then docs/automations/ledger/<name>.md (durable memory).
Follow them exactly. Those three files are authoritative; this message adds nothing to them.
```

**That indirection is the point.** A prompt living only in the cron job is invisible to the repo,
cannot be reviewed, and cannot improve. A playbook in `docs/` is diffable, reviewable in a PR,
and can be sharpened by the automation that runs it.

## How this differs from NFR routines

|                          | NFR routines (`docs/routines/`)         | Feature automations (`docs/automations/`)                  |
| ------------------------ | --------------------------------------- | ---------------------------------------------------------- |
| **Goal**                 | Repo hygiene — review, ratchet, resolve | Slot quality — gates, prompts, benches, renderer           |
| **Touches product code** | Only when fixing a proven bug           | Yes — that is the job                                      |
| **Writes slot content**  | Never (ADR-0010)                        | Never — operates on the **repository**, not a user session |
| **Budget guard**         | `npm run routine:guard`                 | Same script — playbooks share the front-matter shape       |

Both shelves inherit the cloud-agent commit loop from [`.cursor/rules/sensors.mdc`](../../.cursor/rules/sensors.mdc):
`npm run precommit`, then `git add -A`, before every commit.

## The rules every feature automation inherits

### 1. One slice per run

Take the **highest unfinished queue item that fits the budget**. Push the rest back into the
ledger's `todos`. A run that does one thing properly beats a run that half-does four.

### 2. Spend only your budget

The playbook's frontmatter declares `maxFiles`, `allowedPaths`, and `forbiddenPaths`.
`npm run routine:guard` enforces all three against the actual diff.

### 3. Green, or nothing

`npm run check` must pass before anything is pushed, and CI must be green before the PR is merged.
If the run cannot get to green, push **nothing**: delete the branch and file an issue describing
the blocker.

**Known flake.** `apps/server/test/anythingRuntimeCheck.test.js` can fail up to six tests at once
under full-suite load contention while passing in isolation. Re-run that file alone before concluding
anything; see [`docs/agents/sensors.md`](../agents/sensors.md) § Known flakes.

### 4. One branch at a time

`npm run routine:guard -- --preflight <name>` refuses to start when this automation already has an
open PR. Finish or close the open PR before the next firing.

It matches on the PR **title** prefix (`prTitlePrefix`, defaulting to `<name>:`) or the branch
prefix (`branchPrefix`, defaulting to `<name>/`) — the cloud runner generates branch names, so a
branch alone cannot say who opened a PR. When `gh` is unreachable the guard warns and continues
rather than reporting "no open PR"; see `docs/routines/README.md` rule 5 for why that distinction
is the whole point of the check.

### 5. Never touch the don't-touch list

Inherited verbatim from [`AGENTS.md`](../../AGENTS.md) § Don't-touch list.

### 6. Leave the ledger better than you found it

Append a run-log row every time, including runs that changed nothing. Move finished `todos` to
`completed` rather than deleting them.

### 7. Write durable learnings once, where the code is

Domain findings go in `docs/agents/domains/<domain>.md` — one file per domain, auto-loaded by every
agent through a glob-scoped `.cursor/rules/<domain>.mdc`, a nested `CLAUDE.md`, and the index in
[`AGENTS.md`](../../AGENTS.md) § Domain gotchas. Repo-wide findings still go in **both**
[`AGENTS.md`](../../AGENTS.md) and [`CLAUDE.md`](../../CLAUDE.md).

See `docs/routines/README.md` rule 8 for why this stopped being "both files, always".

## What feature automations may not do

- **No slot content.** ADR-0010 reserves diagram generation for the human's own pipeline. These
  automations improve the **gate and the agent**, never a live session's `anything` slot.
- **No new dependencies** without filing an issue first — adding a package is a licence, supply
  chain, and bundle decision.
- **No weakening a safety gate** to make a bench pass. A "must stay rejected" corpus case flipping
  to accepted is a regression, not a win.
- **No generation bench on a schedule without a key.** `benchAnythingGeneration.js` spends tokens.
  Run it only when the queue item calls for measurement and a backend resolves.

## Registered automations

| Playbook                                    | Schedule (UTC) | Trigger                                                |
| ------------------------------------------- | -------------- | ------------------------------------------------------ |
| [`metaphor3d`](metaphor3d.md)               | `0 15 * * *`   | Claude Routine "Feature automation: metaphor3d"        |
| [`anything`](anything.md)                   | `15 17 * * *`  | Claude Routine "Feature automation: anything"          |
| [`canvas-graph-edit`](canvas-graph-edit.md) | `30 18 * * *`  | Claude Routine "Feature automation: canvas-graph-edit" |

Every schedule on both shelves is **UTC**. `routine-guard` does not read the `schedule` key, so a
second timezone convention is invisible to every mechanical check — which is how four live crons
drifted out of sync with their playbooks by 2026-08-30. The `digest` routine now diffs the two
nightly (`docs/routines/digest.md` § Watchdog 4).

All three sit at the head of the night ladder in [`docs/routines/review.md`](../routines/review.md),
so the three NFR routines review what they land a few hours later.

`anything` and `canvas-graph-edit` moved off Cursor on 2026-08-30. `anything` had been dark since
2026-08-28 with nothing anywhere to notice; `canvas-graph-edit` had no playbook at all and its
prompt lived only in Cursor's UI. Both now carry the same three-piece contract as everything else
on this shelf.

## Adding a feature automation

1. Write `docs/automations/<name>.md` with frontmatter (`name`, `tier`, `schedule`, `maxFiles`,
   `allowedPaths`, `forbiddenPaths`) and a numbered work queue.
2. Create `docs/automations/ledger/<name>.md` from an existing ledger.
3. Create the trigger — a Cursor automation at [cursor.com/automations](https://cursor.com/automations)
   or a Claude Routine at [claude.ai/code/routines](https://claude.ai/code/routines); this shelf is
   host-agnostic and both are in use — with
   the loader prompt above, on a cron that does not collide with an existing automation.
   Stagger by at least an hour from [`docs/routines/`](../routines/) and other feature automations.
4. Record the automation URL in the ledger's **Locked** section and fire it once by hand before
   leaving it on a schedule.

`npm run verify:agent-infra` checks that every `npm run <script>` a playbook names actually exists.
