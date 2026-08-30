# NFR routines — the contract

Scheduled, unattended agent runs that do the **boring non-functional work**: reviewing what landed,
repairing doc drift, hardening tests, keeping quality metrics from sliding backwards.

Every routine is three things:

| Piece        | Where                            | What it is                                            |
| ------------ | -------------------------------- | ----------------------------------------------------- |
| **Playbook** | `docs/routines/<name>.md`        | What this routine does, and the budget it may spend   |
| **Ledger**   | `docs/routines/ledger/<name>.md` | What it has already done — durable memory across runs |
| **Trigger**  | a Claude Routine (cron)          | Three lines that point at the two files above         |

Four routines ship today: `review`, `improve` and `resolve` (code-writing) and
[`digest`](digest.md) (report). Their crons and the feature automations' form one **night ladder**
— see [`review.md`](review.md) for the table. `digest` is last and reports on everything before it.

The trigger prompt is deliberately almost empty:

```
Run the NFR routine `<name>`.
Read docs/routines/README.md (the contract), then docs/routines/<name>.md (the playbook),
and follow them exactly. Those two files are authoritative; this message adds nothing to them.
```

**That indirection is the point.** A prompt living in a cron job is invisible to the repo, cannot be
reviewed, and cannot improve. A playbook in `docs/` is diffable, reviewable in a PR, and can be
sharpened by the routine that runs it. If you find yourself pasting instructions into a trigger,
you are building the thing this shelf exists to replace.

See [ADR-0014](../decisions/0014-autonomous-nfr-routines.md) for why these exist, and
[ADR-0016](../decisions/0016-routine-autonomy-for-splits-and-lint-promotion.md) for what they are
allowed to do that ADR-0014 originally reserved for a human.

## Tiers, and what actually keeps this safe

A routine declares a `tier` in its playbook front-matter:

| Tier           | Writes code                    | Declares a budget           | Examples                       |
| -------------- | ------------------------------ | --------------------------- | ------------------------------ |
| `report`       | no — **enforced**              | no `maxFiles`, no paths     | `digest`                       |
| `code-writing` | yes, within its declared paths | `maxFiles` + `allowedPaths` | `review`, `improve`, `resolve` |

`report` is mechanical as of 2026-08-30: such a playbook declares neither `maxFiles` nor
`allowedPaths`, and `routine:guard --postflight` **fails on a non-empty diff**. Before that the
tier was validated as if it wrote code — it had to name a budget it was forbidden to spend — so
the one property distinguishing the two tiers was the one nothing checked.

**Every `code-writing` routine opens a PR and merges it itself once CI is green, by default.** The PR
exists so the owner has something to skim, not as a gate — a routine that waits for review on every
change is a routine that saves nobody any time.

What keeps that safe is **the budget, not the tier and not a human in the loop**: a small `maxFiles`,
an explicit path allowlist, `npm run check` green, and — for any fix to a bug — a test that fails
without it. If a routine's output is ever wrong, the correction is one line in its playbook
(`maxFiles` down, or a path into `forbiddenPaths`); the guard enforces it mechanically from the next
run.

### The one exception: escalation

A routine may push a fix, open the PR, and **not** merge it — when the fix is correct (test-proven)
but the routine itself judges the unattended-merge risk high: a trust-boundary sanitizer/allowlist,
an ambiguous "correct" approach, a regression test that needed real product judgement rather than a
direct transcription of the bug, or a diff adjacent to the don't-touch list. It says what it's unsure
of in the PR, and — for a routine working off the issue tracker — relabels the issue `ready-for-human`
instead of closing it. See [`docs/routines/resolve.md`](resolve.md) § 4 for the concrete bar and
[ADR-0015](../decisions/0015-resolve-routine-and-escalation.md) for why this is a per-run judgement
call rather than a new tier.

Escalation is narrow by design: a routine that escalates by default has just reinvented "always ask a
human" (the overhead this whole shelf exists to remove), and a routine that never escalates has no
honest way to represent "I'm not sure." Escalating on the same finding three runs running with no
human action is a nag, not a service — stop repeating it and say so once instead (see `resolve.md`'s
Escalation section for the concrete rule).

## The rules every routine inherits

### 1. Behaviour-preserving by default

NFR work must not change product behaviour. The test suite is the oracle.

Tests may be **added** freely. An existing test may be weakened or deleted **at most once per run**,
and only with a written reason in the PR body naming what the test was actually asserting. A test
that has never executed is not load-bearing — see the `vi.mock` note in
[`docs/agents/sensors.md`](../agents/sensors.md) — but establish that before removing it, because
repairing such a mock is a real behaviour change while deleting it is not.

**A bug fix ships only with a test that fails without it.** Write the regression test first, run it
against the unfixed code and observe it red, then fix. This is what "confident enough to merge
unattended" has to mean — a routine cannot be the sole judge of its own confidence, and this repo's
own notes are full of tests that pass while examining nothing. A bug you cannot make a test fail for
gets filed, not fixed.

### 2. Spend only your budget

The playbook's frontmatter declares `maxFiles`, `allowedPaths`, and `forbiddenPaths`.
`npm run routine:guard` enforces all three; it is not advisory and it does not read the prose.

Small diffs are the whole safety model. A run that wants to touch thirty files has misunderstood
its playbook — do the smallest useful slice, write the rest to the ledger, and stop.

### 3. Green, or nothing

`npm run check` must pass before anything is pushed, and CI must be green before the PR is merged.
If the run cannot get to green, it pushes **nothing**: delete the branch and file an issue
describing the blocker. A half-fixed branch left open is worse than no run at all, because the next
firing's preflight will refuse to start behind it — which is the intended stop, not a bug.

**Before you conclude the tree is red, rule out your own checkout.** `npm ci` and
`npm run build -w packages/shared`, then re-run. A stale `node_modules` or a stale
`packages/shared/dist` produces reproducible, non-flaky failures whose error messages point
nowhere near the cause — a constant that became `undefined`, a type that lost a field, a missing
`CSS.escape`. See [`docs/agents/sensors.md`](../agents/sensors.md) § Not a flake. And never read a
gate's result through `tail` without `set -o pipefail`: the pipeline exits with `tail`'s status,
so a failing `npm run check` reports success.

**One documented exception.** `apps/server/test/anythingRuntimeCheck.test.js` fails up to six tests
at once under full-suite load contention while passing 16/16 in isolation. The tell is a uniform
timing shift across every case in the file, not assertion content. Re-run that file alone before
concluding anything; see [`docs/agents/sensors.md`](../agents/sensors.md) § Known flakes. A routine
that treats every red as a regression will chase this one forever.

### 4. Commit the way cloud agents must

Husky does not run in cloud VMs. Before **every** commit:

```bash
npm run precommit
git add -A
```

`git add -A` rather than `-u`, so files Prettier rewrote get re-staged. This is the same rule as
[`.cursor/rules/sensors.mdc`](../../.cursor/rules/sensors.mdc); it is restated here because
scheduled routines are precisely the case it was written for.

### 5. One branch at a time

`npm run routine:guard -- --preflight <name>` refuses to start when this routine already has an
open PR. Two overlapping branches from one routine is how a scheduled job starts fighting itself.

If preflight refuses, the correct action is to **finish or close the open PR**, not to start a
second branch under a different name.

**How it identifies "this routine's PR", and why that matters.** Branch names come from the cloud
runner (`claude/eager-hopper-74jcfu`), so a branch cannot say which routine opened a PR. The
_title_ can, and every playbook already enforces one — so the match is on `prTitlePrefix`
(defaulting to `<name>:`) or `branchPrefix` (defaulting to `<name>/`), either declared in the
front-matter. A Cursor branch or a dependabot bump matches neither and is correctly ignored.

**A warning is not a pass.** When `gh` is missing, unauthenticated or offline the guard prints a
warning and lets the run continue, because a routine that cannot reach GitHub still has useful
work to do. It deliberately does not report "no open PR" in that case: an absent answer and an
empty answer mean opposite things, and conflating them is what this check existed on paper — and
not in code — to prevent.

> This check was documented here, in `docs/automations/README.md` § 4 and in ADR-0014 clause 3
> from day one, and **was not implemented until 2026-08-30**. In the interim PR #442 sat open for
> two days holding a `review` ledger row hostage, the next firing started a second branch behind
> it, and that run then reasoned _from preflight's silence_ that the previous night had never
> fired. A safety property that exists only in prose reads exactly like one that works.

### 6. Never touch the don't-touch list

Inherited verbatim from [`AGENTS.md`](../../AGENTS.md) § Don't-touch list: `.agents/`, `.env*`,
`scripts/deploy-*.sh`, `scripts/push-*-secret-cloud-run.sh`, `apps/server/src/mcp/apps/*.js` HTML
strings, `apps/server/bench-results/`, `apps/web/src/assets/audio/*.mp3`, `package-lock.json`,
`skills-lock.json`, and any `dist/` or `.tsbuildinfo` build output.

One cost trap deserves naming twice: `./scripts/generate-office-audio.sh` **with no asset name**
regenerates the entire manifest — 900 ElevenLabs credits and every committed `.mp3` overwritten. No
routine runs it. `--verify` is free and needs no key.

### 7. Leave the ledger better than you found it

Append a run-log row every time, including runs that changed nothing. "Nothing to do today" is
information; a gap in the log is not. Move finished `todos` to `completed` rather than deleting
them, so a month from now the question "did this actually improve anything?" has an answer.

### 8. Write durable learnings once, where the code is

If a run discovers something a future agent would otherwise rediscover the hard way, write it down
— **once**.

**Domain findings go in `docs/agents/domains/<domain>.md`**, as a short-form entry naming the
file it lives in, plus its full-findings counterpart. Two exist today, `metaphor3d.md` and `office.md`. Each is auto-loaded by the
agents that need it: a glob-scoped `.cursor/rules/<domain>.mdc` for Cursor, nested `CLAUDE.md`
files in the described directories for Claude Code, and the index table in
[`AGENTS.md`](../../AGENTS.md) § Domain gotchas for qwen and anything else. Adding a domain means
adding those three pointers; the content itself stays in one file.

**Repo-wide findings** — something true of the whole codebase rather than of one domain — still go
in **both** [`AGENTS.md`](../../AGENTS.md) and [`CLAUDE.md`](../../CLAUDE.md), because Cursor tends
to start from the first and Claude Code from the second, and a tip in only one leaves the other
blind.

> **Why the split.** Until 2026-08-30 this rule said "both files, always", for every finding. Two
> domains grew under it — Metaphor3D to 54 KB + 27 KB, Office to 48 KB + 27 KB — and both root files
> are read in full at the start of every session, so ~152 KB (about 38 k tokens) was loaded before
> any work began, whether or not the work went near a 3D scene or the office. `CLAUDE.md` went
> 14 KB → 136 KB between May and August and doubled in the last two weeks of it. The rule was
> right about the goal and wrong about the mechanism: what matters is that the finding reaches the
> agent that needs it, not that it appears in a particular file.

### 9. `gh` is not authenticated in the cloud sandbox

Every `gh` snippet in every playbook on both shelves is the **local-development** form. In the
cloud environment these routines actually run in, `gh` has no token: measured 2026-08-30, the
`digest` routine's preflight printed `could not read open PRs (gh missing, unauthenticated or
offline)` and skipped its check. Reads and writes that touch the GitHub API go through the
**GitHub MCP tools** — which is what the shipped routines have always done, whatever their
playbooks say.

Two consequences worth knowing before you rely on either:

- `routine-guard`'s open-PR check falls back to the GitHub REST API when `gh` fails. Listing open
  PRs on a public repo needs no credentials; `GH_TOKEN` / `GITHUB_TOKEN` are used when present.
  Without that fallback the check would warn-and-skip on every real run — present in the tests,
  absent in production, which is the same failure it was written to fix.
- A routine whose only output is a GitHub write (posting a comment, applying a label) **must
  confirm the write landed** by reading it back. A run that composes the text and returns it as
  its final message reports `success` and has done nothing; that is exactly what the `digest`
  routine's first firing did.

## What routines may not do

These are the boundaries [ADR-0014](../decisions/0014-autonomous-nfr-routines.md) sets, as amended by
[ADR-0016](../decisions/0016-routine-autonomy-for-splits-and-lint-promotion.md), and each answers a
rule the repo already wrote down:

- **No slot content, ever.** ADR-0010 reserves diagram generation for the human's own pipeline.
  Routines operate on the repository, not on the product's six slots.
- **No new dependencies.** Adding a package is a decision with a licence, a supply chain and a
  bundle cost. File an issue.
- **No silent ratchet loosening.** `docs/agents/ratchet.json` gates no build, so relaxing an entry
  never unblocks anything — it only erases the record that something got worse. Raise a budget with
  a written `reason` or not at all.

Two boundaries that used to be here are gone as of ADR-0016: `improve` may now perform coupling
splits and refactors itself (not just report them), and may promote a lint rule from `warn` to
`error` itself once it can show ADR-0007's two-week quiet period held. Neither is a new safety
mechanism — both still go through the same rules above (behaviour-preserving, budgeted, green CI,
escalate when unsure) that already decide whether any routine change is safe to self-merge. See
`docs/routines/improve.md` for exactly what that looks like in practice.

## Adding a routine

1. Write `docs/routines/<name>.md` with the frontmatter block (`name`, `tier`, `schedule`,
   `maxFiles`, `allowedPaths`, `forbiddenPaths`, and optionally `prTitlePrefix` /
   `branchPrefix` when the PR titles this routine writes do not start with `<name>:`)
   and a numbered work queue.
2. Create `docs/routines/ledger/<name>.md` from an existing ledger.
3. Create the Claude Routine with the three-line loader prompt above, on a cron that does not
   collide with an existing routine. Stagger by at least an hour.
4. Fire it once by hand and watch the whole run before leaving it on a schedule.

`npm run verify:agent-infra` checks that every `npm run <script>` a playbook names actually exists,
and `npm run verify:doc-paths` checks its file references resolve. Both run in CI.
