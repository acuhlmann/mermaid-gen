# NFR routines — the contract

Scheduled, unattended agent runs that do the **boring non-functional work**: reviewing what landed,
repairing doc drift, hardening tests, keeping quality metrics from sliding backwards.

Every routine is three things:

| Piece        | Where                                          | What it is                                            |
| ------------ | ---------------------------------------------- | ----------------------------------------------------- |
| **Playbook** | `docs/routines/<name>.md`                      | What this routine does, and the budget it may spend   |
| **Ledger**   | `docs/routines/ledger/<name>.md`               | What it has already done — durable memory across runs |
| **Trigger**  | a Claude Routine or a Cursor automation (cron) | Three lines that point at the two files above         |

Five routines ship today: `review`, `improve`, `resolve` and `deps` (code-writing) and
[`digest`](digest.md) (report). Their crons and the feature automations' form one **night ladder**
— see [`review.md`](review.md) for the table, which also names which host runs which rung. `digest`
is last and reports on everything before it.

| Routine                 | Host   | Shelf | What it owns                                                     |
| ----------------------- | ------ | ----- | ---------------------------------------------------------------- |
| [`review`](review.md)   | Claude | NFR   | last 24 h on `main`, one proven bug, the trap checklist          |
| [`improve`](improve.md) | Claude | NFR   | the ratchet, the sensors, **every routine's budget** (ADR-0017)  |
| [`resolve`](resolve.md) | Cursor | NFR   | the open-issue backlog                                           |
| [`deps`](deps.md)       | Claude | NFR   | Dependabot PRs, advisories, and code that breaks when they move  |
| [`digest`](digest.md)   | Claude | NFR   | one comment a day on #452, and the watchdog that notices silence |

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

See [ADR-0014](../decisions/0014-autonomous-nfr-routines.md) for why these exist,
[ADR-0016](../decisions/0016-routine-autonomy-for-splits-and-lint-promotion.md) for what they are
allowed to do that ADR-0014 originally reserved for a human, and
[ADR-0017](../decisions/0017-routine-ownership-dependabot-and-the-attention-bar.md) for the three
things that were still reaching the owner on 2026-09-01: a backlog that no routine could reach, a
dependency queue nobody read, and an escalation label that meant "nobody will look at this".

## Tiers, and what actually keeps this safe

A routine declares a `tier` in its playbook front-matter:

| Tier           | Writes code                    | Declares a budget                         | Examples                       |
| -------------- | ------------------------------ | ----------------------------------------- | ------------------------------ |
| `report`       | no — **enforced**              | no `maxFiles`, no `maxIssues`, no paths   | `digest`                       |
| `code-writing` | yes, within its declared paths | `maxFiles` + `maxIssues` + `allowedPaths` | `review`, `improve`, `resolve` |

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

**And one routine does not decide how much of itself to spend.** Since 2026-09-01 the guard refuses a
diff from any routine but `improve` that touches a playbook, either shelf's README, or another
routine's ledger (`BUDGET_OWNERS` / `shelfOwnershipViolation` in
[`scripts/routine-guard.mjs`](../../scripts/routine-guard.mjs)), and `scripts/routine-guard.mjs`
itself is on the always-forbidden list for everyone. Both halves close the same gap (#461): a
routine whose `allowedPaths` contained `docs/**` could edit the numbers that bounded it and pass its
own postflight, while the prose said the budget "is not advisory and it does not read the prose". A
safety property that lives only in the file it protects is not one.

### The one exception: holding a PR

A routine may push a fix, open the PR, and **not** merge it — when the fix is correct (test-proven)
but the routine itself judges the unattended-merge risk high: a trust-boundary sanitizer/allowlist,
an ambiguous "correct" approach, a regression test that needed real product judgement rather than a
direct transcription of the bug, or a diff adjacent to the don't-touch list. It says what it's unsure
of in the PR and **leaves the issue's label alone**, so the next firing re-reads it. See
[`docs/routines/resolve.md`](resolve.md) § 4 for the concrete bar and
[ADR-0015](../decisions/0015-resolve-routine-and-escalation.md) for why this is a per-run judgement
call rather than a new tier.

Holding is narrow by design: a routine that holds by default has just reinvented "always ask a human"
(the overhead this whole shelf exists to remove), and a routine that never holds has no honest way to
represent "I'm not sure." Holding on the same finding three runs running is a nag, not a service —
stop repeating it and say so once instead (see `resolve.md`'s "When a hold repeats" for the concrete
rule).

**What changed on 2026-09-01: a held PR no longer relabels its issue `ready-for-human`.** That was
ADR-0015's mechanism, and it was the shelf's quietest failure — `ready-for-human` reads as "the owner
will handle it", but the owner does not read the tracker, so in practice the label _deleted_ the work.
Every issue that ever carried it was waiting on a number in a playbook (#402, twice diagnosed, never
unblocked) or a lint warning nobody had claimed (#431). `ready-for-human` is now reserved for the four
conditions in rule 10, and a routine may not put an issue there by itself.

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

The playbook's frontmatter declares `maxFiles`, `maxIssues`, `allowedPaths`, and `forbiddenPaths`.
`npm run routine:guard` enforces all four; it is not advisory and it does not read the prose.
**It also enforces who may change them:** only `improve` may edit a playbook, a shelf README, or
another routine's ledger. A routine that finds itself blocked by its own number records
`blocked-by-budget` in its ledger and moves on; `improve` § 2b reads those rows and prices them.

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
- **A body write is destructive, in both directions.** `gh issue edit --body-file` (and its MCP
  equivalent) _replaces_ a description — it does not append, and an empty stdin is a valid empty body,
  which GitHub keeps no recoverable revision of. Read the current body before writing one, and use a
  **comment** when a note is what you meant (#402's original body was lost this way on 2026-09-01).
  The mirror hazard is on the same field: body text that merely _quotes_ a `Closes #402`-style
  reference makes GitHub act on it, which is how #476 was auto-closed twice by PRs that were only
  describing the earlier auto-close.

### 10. The owner is not a gate — and there is a bar for reaching them

Every routine on both shelves decides, acts, and self-merges. The owner reads one digest a day and
is paged by four things, and only four:

1. **Money.** Anything that spends beyond a stated budget: a paid service, a quota about to trip, a
   regenerable asset bank (`generate-office-audio.sh` bare costs 900 ElevenLabs credits and
   overwrites every committed `.mp3`), a token spend the playbook does not already authorise.
2. **Credentials and permissions.** Secrets, IAM, billing, a service-account key, or an action that
   needs a login no routine holds. On the trigger shelf that means: **deleting** a routine, creating
   or revoking an **API** trigger/token, and anything on the Cursor side — `agent` has no
   `automations` command. Creating a _cron_ routine is **not** on the page bar: `claude -p '/schedule
…'` does it (list/create/update/fire), and a playbook that declares a `schedule:` with no trigger
   behind it is a routine that silently never runs, which is this shelf's oldest failure mode. Mind
   rule 1 while doing it — a new rung spends the owner's subscription, so stand up exactly what the
   playbook declares, at the cadence it declares, and nothing more.
3. **Irreversible destruction.** Deleting a branch with unmerged work, dropping data, dismissing a
   security advisory, force-pushing, closing somebody else's PR.
4. **The product's direction.** What ArchiSlop should be, not how a file should be written. ADR-level
   questions, a slot's behaviour changing shape, a rename of a top-level concept.

Everything else is a routine's call, and "I'd rather a human looked at this" is not on the list. If a
run cannot act, the correct output is a **ledger row that names the blocker in the machine-readable
form** (`blocked-by-budget`, `blocked-by-paths`, `held PR #nnn`) — not a label, not a comment
addressed to the owner, not a question.

Two corollaries, both learned the expensive way:

- **`ready-for-human` is page-bar-only, and no routine may apply it to its own finding.** A label
  that means "a person will handle this" is a lie when nobody reads the tracker; what it actually
  did was delete work. `resolve` § 4 holds a PR and leaves the label alone; `improve` § 2 files
  `needs-triage` and says in the body what it thinks.
- **A routine that escalates by default has rebuilt the thing this shelf removed.** Before ADR-0017
  the escalation path was the default escape from "too big", "unclear", and "out of my budget" —
  three states that are all, on inspection, a number in a playbook. Numbers are `improve`'s queue,
  not the owner's inbox.

### 11. A label is a promise about a budget

`ready-for-agent` claims _an agent can write the file this issue names_. Until 2026-09-01 nothing
checked that claim, so the backlog filled with issues that were correctly scoped, correctly labelled,
and permanently stuck: #461 needed `scripts/routine-guard.mjs`, #462 and #473 needed
`scripts/test-affected-lib.mjs`, and no `allowedPaths` on either shelf reached either.

```bash
npm run routine:guard -- --reachable apps/web/src/utils/foo.js scripts/test-affected-lib.mjs
```

The guard prints the owning routine(s) — after **both** halves of the answer: the playbook's
`allowedPaths` and rule 2's ownership restriction, so a playbook path prints `improve` alone and never
a routine whose postflight would refuse it. It prints `frozen` for an always-forbidden path, or `NONE`
and exits 1.
**Run it before applying `ready-for-agent`.** `NONE` means the finding is real and the shelf has an
ownership gap: label it `needs-triage`, name the file, and `improve` § 2b widens someone's budget —
which is a one-line PR that unblocks a class, versus an issue that gets skipped every night forever.

### 12. Filing costs the filer

`maxFiles` bounds a diff, and a run that wants a tenth file is refused. Nothing bounded a ticket —
because filing needs **no diff at all**. Six of the seven rungs are contractually required to file
and one (`resolve`) is capped at one pick a night, so the tracker was the only unbounded budget on
the shelf. Measured across 2026-08-25 → 09-05: **36 issues opened, 13 closed**, the backlog climbing
14 → 24 while every item-level watchdog correctly reported nothing to act on.

Three things are now mechanical, all of them enforced by the guard rather than by this prose:

```bash
npm run routine:guard -- --filings [--window <h>] [--json]
```

Backlog size, oldest open finding, **net inflow over the window**, filings per rung against its
ceiling, and which rungs owe. Exits 1 when a rung is over budget or in debt — the same convention as
`--reachable` exiting 1 on an unowned path, because both are "the shelf is stuck in a way nothing is
scheduled to notice". Rule 11 asks _can any agent take this?_; this asks _is anything taking them_.

- **`maxIssues`** in every code-writing playbook's front-matter: the most issues that rung may open in
  a rolling 24 h. `loadPlaybook` refuses a code-writing playbook without it and refuses a `report`
  one that declares it, and `--postflight` checks the real count. `0` is a valid budget.
- **`filed-by: <name>`** as the first line of every issue body a routine opens. Without it a filing
  has no author: every issue in this tracker — human-filed and routine-filed alike — is authored by
  the same account, because the routines reach GitHub on the owner's credentials (rule 9). The cap is
  unenforceable until this line exists, and so is any inflow report at all.
- **Pay-before-file**: a rung carrying more than `OWN_OPEN_ISSUE_LIMIT` of its _own_ findings, each
  older than `OWN_OPEN_ISSUE_AGE_DAYS`, may not open another — it has to close one instead. Those two
  constants live in `scripts/routine-guard.mjs`, **not** in front-matter, for the same reason rule 2
  puts budgets beyond their spender: a ceiling every overworked rung has an incentive to widen is not
  a ceiling. This is the half that actually binds; `maxIssues` alone only slows the inflow down.

**Do not mint a number per occurrence of a recurring class.** The standing example is five open issues
(#431, #447, #465, #478, #499) that are one thing — `lintWarnings` drifting past a ratchet budget —
filed separately, and **zero closed in eleven days**. Append to a standing issue, or hand the class to
`improve` § 2b, which already owns ratchet drift. A filer that batches costs itself one filing; one
that mints costs the backlog five.

**A product-shaped finding is not agent backlog.** A feature slice, a hit-test, a new mutator gets
`enhancement`, not `ready-for-agent`: `resolve` § 2 must skip "anything that reads like a design
question" on sight, and no feature automation reads another's queue, so `ready-for-agent` on those is
rule 11's false promise wearing a different hat — technically writable, scheduled never to be taken.
#495, #523 and #536 are that shape; three permanent residents inflating a queue nobody may serve.

**Nobody owes the past.** Issues opened before this rule carry no `filed-by:` line, so the guard
counts them `unattributed` and charges them to no one — the rule becomes live on the next filing, not
retroactively. A check that always fails is a check that gets suppressed, which is a worse outcome than
a rule that takes effect tomorrow.

**The debt blocks filing, never fixing.** No rung is ever prevented from _resolving_ something by this
rule, and the cap is not a gag: when a run genuinely cannot act and needs to say so, rule 10's answer
already exists — a ledger row naming the blocker (`blocked-by-budget`, `blocked-by-paths`, `held PR
#nnn`), which is what `improve` § 2b greps for. Pay-before-file removes the option of dumping a new
ticket on the queue; it never removes the option of recording why this run stopped.

## What routines may not do

These are the boundaries [ADR-0014](../decisions/0014-autonomous-nfr-routines.md) sets, as amended by
[ADR-0016](../decisions/0016-routine-autonomy-for-splits-and-lint-promotion.md), and each answers a
rule the repo already wrote down:

- **No slot content, ever.** ADR-0010 reserves diagram generation for the human's own pipeline.
  Routines operate on the repository, not on the product's six slots.
- **No new dependencies.** Adding a package is a decision with a licence, a supply chain and a
  bundle cost. File an issue. This binds `deps` as hard as anyone: it may advance a version the repo
  already resolves, and it must not merge a Dependabot group PR whose diff pulls in a package that has
  never appeared in the lockfile before.
- **No agent-authored resolved trees.** `package-lock.json` is always-forbidden, so no routine can
  write one. Dependency changes reach `main` through Dependabot's own commits, which is the boundary
  that lets a routine merge them at all. See [`deps.md`](deps.md).
- **No silent ratchet loosening.** `docs/agents/ratchet.json` gates no build, so relaxing an entry
  never unblocks anything — it only erases the record that something got worse. Raise a budget with
  a written `reason` or not at all.
- **No budget edit by the routine that spends it.** Only `improve` may change a playbook's
  `maxFiles`/`allowedPaths`/`forbiddenPaths`, and `scripts/routine-guard.mjs` — the thing that checks
  — is outside every routine's reach. See `docs/routines/improve.md` § 2b for what that looks like in
  practice, and ADR-0017 for why the exception is a routine rather than a review step.

Two boundaries that used to be here are gone as of ADR-0016: `improve` may now perform coupling
splits and refactors itself (not just report them), and may promote a lint rule from `warn` to
`error` itself once it can show ADR-0007's two-week quiet period held. Neither is a new safety
mechanism — both still go through the same rules above (behaviour-preserving, budgeted, green CI,
hold when unsure) that already decide whether any routine change is safe to self-merge.

## Adding a routine

1. Write `docs/routines/<name>.md` with the frontmatter block (`name`, `tier`, `schedule`,
   `host`, `maxFiles`, `maxIssues`, `allowedPaths`, `forbiddenPaths`, and optionally
   `prTitlePrefix` / `branchPrefix` when the PR titles this routine writes do not start with
   `<name>:`) and a numbered work queue.
2. Create `docs/routines/ledger/<name>.md` from an existing ledger.
3. Choose the host — a Claude Routine or a Cursor automation — and put it in the `host:` key and the
   table above. Split on duty, not on load: an automation that files issues and the one that fixes
   them gain something from living on different hosts.
4. Create the trigger with the three-line loader prompt above, on a cron that does not collide with an
   existing routine. Stagger by at least an hour. On the Claude side this is a CLI call, not a web
   visit: `claude -p '/schedule Create a routine named "NFR routine: <name>" for <repo>, cron
<expression>, model <model>, prompt exactly: …'`, then **read it back** with `/schedule list` the
   way rule 9 demands of every other write — and check what it inherited (MCP connections and the
   environment arrive by default, and a default-granted Google Drive in an unattended job is not
   something anyone chose). Deleting a routine, API triggers, and all Cursor-side setup stay the
   owner's (page bar #2).
5. Fire it once (`/schedule run`) and read the whole run before leaving it on a schedule. Then pin its
   observed branch slug in `branchPrefix` — cloud runners generate names, and a fleet-wide prefix like
   `cursor/` would make preflight refuse to start behind a _different_ fleet's PR.

`npm run verify:agent-infra` checks that every `npm run <script>` a playbook names actually exists,
and `npm run verify:doc-paths` checks its file references resolve. Both run in CI.
`npm run routine:guard -- --reachable <path>` answers the one question a new routine's budget has to
get right before it can promise anything to the backlog (rule 11), and its sweep in
`scripts/routine-guard.test.mjs` fails if a file in `scripts/` ends up owned by nobody.
