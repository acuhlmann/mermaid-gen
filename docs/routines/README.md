# NFR routines — the contract

Scheduled, unattended agent runs that do the **boring non-functional work**: reviewing what landed,
repairing doc drift, hardening tests, keeping quality metrics from sliding backwards.

Every routine is three things:

| Piece        | Where                            | What it is                                            |
| ------------ | -------------------------------- | ----------------------------------------------------- |
| **Playbook** | `docs/routines/<name>.md`        | What this routine does, and the budget it may spend   |
| **Ledger**   | `docs/routines/ledger/<name>.md` | What it has already done — durable memory across runs |
| **Trigger**  | a Claude Routine (cron)          | Three lines that point at the two files above         |

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

See [ADR-0014](../decisions/0014-autonomous-nfr-routines.md) for why these exist and what they are
deliberately not allowed to do.

## Tiers, and what actually keeps this safe

A routine declares a `tier` in its playbook front-matter:

| Tier           | Writes code                    | Examples            |
| -------------- | ------------------------------ | ------------------- |
| `report`       | no                             | —                   |
| `code-writing` | yes, within its declared paths | `review`, `improve` |

**Both shipped routines open a PR and merge it themselves once CI is green.** The PR exists so the
owner has something to skim, not as a gate — a routine that waits for review is a routine that saves
nobody any time.

What keeps that safe is **the budget, not the tier and not a human in the loop**: a small `maxFiles`,
an explicit path allowlist, `npm run check` green, and — for any fix to a bug — a test that fails
without it. If a routine's output is ever wrong, the correction is one line in its playbook
(`maxFiles` down, or a path into `forbiddenPaths`); the guard enforces it mechanically from the next
run.

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

### 8. Write durable learnings in both places

If a run discovers something a future agent would otherwise rediscover the hard way, it goes in
**both** [`AGENTS.md`](../../AGENTS.md) and [`CLAUDE.md`](../../CLAUDE.md). Cursor tends to start
from the first, Claude Code from the second; a tip in only one leaves the other blind. That is the
repo's existing mirroring rule, not a new one.

## What routines may not do

These are the boundaries [ADR-0014](../decisions/0014-autonomous-nfr-routines.md) sets, and each
answers a rule the repo already wrote down:

- **No unprompted hub splits or refactors.** `docs/agents/balanced-coupling-priorities.md` says
  split _on contact_ — when a feature already requires editing the file. A scheduled run has no
  feature to be on contact with. Coupling work is therefore **report-only**: it updates the
  priorities doc and files issues.
- **No slot content, ever.** ADR-0010 reserves diagram generation for the human's own pipeline.
  Routines operate on the repository, not on the product's six slots.
- **No unilateral lint-severity promotion.** ADR-0007 requires a two-week quiet period with no
  unexplained suppressions before a rule moves from `warn` to `error`. A routine may open an issue
  presenting that evidence; a human makes the call.
- **No new dependencies.** Adding a package is a decision with a licence, a supply chain and a
  bundle cost. File an issue.
- **No silent ratchet loosening.** `docs/agents/ratchet.json` gates no build, so relaxing an entry
  never unblocks anything — it only erases the record that something got worse. Raise a budget with
  a written `reason` or not at all.

## Adding a routine

1. Write `docs/routines/<name>.md` with the frontmatter block (`name`, `tier`, `schedule`,
   `maxFiles`, `allowedPaths`, `forbiddenPaths`) and a numbered work queue.
2. Create `docs/routines/ledger/<name>.md` from an existing ledger.
3. Create the Claude Routine with the three-line loader prompt above, on a cron that does not
   collide with an existing routine. Stagger by at least an hour.
4. Fire it once by hand and watch the whole run before leaving it on a schedule.

`npm run verify:agent-infra` checks that every `npm run <script>` a playbook names actually exists,
and `npm run verify:doc-paths` checks its file references resolve. Both run in CI.
