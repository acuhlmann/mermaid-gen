---
name: resolve
tier: code-writing
schedule: '15 22 * * *'
host: Cursor
maxFiles: 9
maxIssues: 1
prTitlePrefix:
  - 'resolve:'
  - 'resolve ledger:'
branchPrefix:
  - resolve/
allowedPaths:
  - docs/routines/ledger/resolve.md
  - docs/**
  - '*.md'
  - apps/**
  - packages/**
forbiddenPaths:
  - apps/server/src/mcp/apps/**
  - apps/web/src/assets/**
---

# Routine: `resolve`

**Read [`docs/routines/README.md`](README.md) first — it carries the rules this playbook assumes.**

Works down the open-issue backlog `review` and `improve` leave behind. Those two routines file
findings and fix at most one bug each per run — nothing previously came back for the rest, so they
sat waiting for a human to hand them back to an agent. `resolve` is that hand-back, done on a
schedule.

`15 22 * * *` (06:15 HKT) is the last code-writing rung of the night: `review` (`0 20`) and
`improve` (`0 21`) have both merged by then, so tonight's freshly filed issues are visible in the
backlog before this routine reads it, and the `digest` at `0 23` reports on everything including
this run.

Until 2026-08-30 this playbook claimed it sat "two hours after `review` (`0 1 * * *`)". Neither
number was the live cron, and the real firing order was the exact inverse of the one this
rationale depends on.

## Two things that changed on 2026-09-01, and the arithmetic behind each

**The host moved to Cursor.** The rest of the ladder stays on Claude Routines. That split is about
ownership rather than credits: `review` and `improve` _find_ the work and `resolve` _pays_ for it, so
with all three on one host a single degraded account darkens the whole pipeline and nothing notices —
which is precisely how `anything` went silent for four days in late August. `branchPrefix` is now
inert on purpose: cloud runners generate branch names (`claude/awesome-hawking-…`,
`cursor/critical-bug-memory-…`), and a fleet-wide prefix like `cursor/` would make preflight refuse to
start behind **another** fleet's PR. This routine is identified by its `resolve:` / `resolve ledger:`
title prefixes, which the run log already enforces. Pin the observed Cursor slug here after the trigger
has fired twice — do not invent one.

**`maxFiles` went 6 → 9.** The number, not the judgement, is what stranded #402 for a week. Two runs
recorded the arithmetic in the ledger: three source files, three updated test files, one new test for
the only uncovered call path, the shared hook, and this routine's own run row. Nine. The seventh file
being a test is the whole point — a budget that forces a routine to drop the test in order to fit is a
budget that pays for "confident enough to merge unattended" with the thing that proves it. If a pick
now needs more than nine, the honest record is `blocked-by-budget` in the ledger (see § 5), which
`improve` § 2b reads and prices; it is never a reason to label the issue for a human.

Raising this playbook's own number is legal for exactly one reason: the edit came from outside, in a
PR a human authored. A `resolve` run that edited this file now fails its postflight —
`routine-guard`'s `BUDGET_OWNERS` allows only `improve` to touch a playbook or a shelf README
(ADR-0017, closing #461).

## Why `docs/**` is in this routine's budget

`review` and `resolve` shipped with **byte-identical** `allowedPaths`, and this routine's own
ledger diagnosed what that costs on 2026-08-23, -26, -28 and -29 before anyone acted on it:

> `review` files a `docs/**` finding _precisely because_ it is out of `review`'s own budget. If
> `resolve` has the same budget, that class of issue is not merely often unresolvable by this
> routine — it is **never** resolvable by it. A hand-back that cannot reach the work it is handed
> is not a hand-back.

#441 was the concrete case: a one-line markdown-table fix in `docs/canvas-graph-edit.md`, filed by
`review`, labelled `ready-for-agent`, and unreachable by the only routine that reads the backlog —
so the 2026-08-29 run logged "quiet" with an actionable issue sitting in front of it.

`docs/**` here is for **fixing what the backlog asks for**, not for rewriting playbooks. Editing
this file, another routine's playbook, a shelf README, an ADR or a ledger that is not this routine's
own is `improve`'s to edit — and as of ADR-0017 it is refused mechanically, by
`routine-guard`'s shelf-ownership rule, not merely advised against here.

## 1. Gather

```bash
git fetch origin main
```

List open issues labelled `ready-for-agent` or `needs-triage`, **plus open issues carrying no
triage label at all** (`docs/agents/triage-labels.md`). The unlabelled case is not hypothetical:
`improve`'s own ratchet-violation issues (e.g. #381) are filed by `gh issue create` with no label
argument, and nothing else in this repo ever labels them after the fact — an issue that starts
unlabelled stays invisible to a gather step that only looks for `ready-for-agent`/`needs-triage`
forever, not just until the next triage pass. Do not treat "no label" as "not yet triaged and
therefore not this routine's problem"; treat it as `needs-triage` that a filer forgot to stamp.

**Exclude anything labelled `log`.** That label marks an append-only thread, not work — today
that is #452, the nightly digest. It carries no other label precisely so a human reading
`gh issue list` sees it, which means the unlabelled-issues rule above would otherwise hand this
routine a log to "fix" every night.

**Exclude `enhancement` too, and say why it is there.** A product slice — a new mutator, a hit-test,
an affordance — is not this routine's queue: § 2 tells it to refuse a design question on sight, and no
feature automation works another's backlog. When #495, #523 and #536 carry `ready-for-agent` they are
gathered, examined, refused and re-refused nightly, which is rule 11's false promise (README) in its
least useful form: the issue is writable by an agent and scheduled never to be taken. `enhancement` is
the honest label, it costs no filer anything, and it takes the count out of the queue that is meant to
be able to reach zero.

For a `needs-triage` issue, or an unlabelled one: read it in full. If it already names the file,
the symptom, and what correct looks like, treat it as scoped even though the label hasn't caught
up. If it genuinely does not — no repro, no file, no clear "correct" — this routine cannot safely
act on it: leave a comment asking for the missing piece, apply `needs-info`, and move on. Guessing
at an underspecified report is exactly the shape of mistake this routine exists to avoid.

**`ready-for-human` enters this set after three days.** The label's whole meaning was "a maintainer
will decide", and the maintainer is not reading the tracker — #431 and #402 sat there five and eight
days while each was a number in a playbook and a lint warning respectively. As of ADR-0017 the label
is reserved for the four page-bar conditions in [`README.md`](README.md) § 10, nothing on this shelf
may _file_ one, and an aged one is therefore evidence that a routine was over-cautious, not that a
human is busy. Re-triage it: fix it if it is fixable, strip the label and apply the one that matches
what you found if it is not. Leave a `ready-for-human` in place only if the page bar genuinely holds
and say so in the issue in one line.

**Check reachability before assuming a `ready-for-agent` label means an agent can do it.** Three
issues were in the backlog on 2026-08-31 labelled ready-for-agent with fixes in
`scripts/test-affected-lib.mjs` and `scripts/routine-guard.mjs` — files no playbook's `allowedPaths`
reached, so the label was a promise no one had checked could be kept:

```bash
node scripts/routine-guard.mjs --reachable <file-the-issue-names>
```

`-> improve` means hand it to `improve`'s queue rather than skipping it in silence; `-> NONE` means the
backlog has an ownership gap, which is itself a finding worth a ledger row (`improve` § 2b reads them).
Skipping a reachable-looking issue because a label pointed at a routine that cannot serve it is exactly
the "quiet run in front of actionable work" failure this routine was created to end.

Read the ledger's run log and `Locked`/`Open observations` sections first — an issue already
attempted twice with no human action is not a fresh pick (see Escalation below), and an issue
already escalated is not re-escalated on the same finding.

## 2. Pick one

Take the **highest-confidence issue that fits the budget** — same bar as `review` § 3: if you would
not bet on it being real and locally fixable, do not attempt it. Confidence decides _whether_ a pick is
allowed; it must not decide _which_ one, or the queue's hard tail is passed over every single night
forever (§ 3, oldest first). Small and mechanical stays the tiebreak among equals, not the reason to
reach past an eight-day-old finding to a two-day-old one. Push everything else back into the ledger's
`todos` untouched.

Skip on sight, leave filed, do nothing further this run:

- Anything asking for a hub split or refactor (`docs/agents/balanced-coupling-priorities.md`: split
  on contact, and a schedule has no feature to be on contact with). Hand it to `improve` § 7 in the
  ledger — it is the only routine with ADR-0016 authority to split one unattended.
- Anything asking for a new dependency, a lint-severity promotion, or slot content (ADR-0014's three
  carve-outs — see `README.md` § What routines may not do).
- Anything whose fix cannot be expressed inside this routine's `allowedPaths`, within `maxFiles`.
  Skipping is right; **skipping quietly is not.** Write the row as `blocked-by-budget` with the file
  count you needed, or `blocked-by-paths` with the path. Those two strings are what `improve` § 2b
  greps for, and a skip without one is indistinguishable from a lazy run — which is how #402 managed
  to be correctly diagnosed twice and correctly unblocked zero times.

## 2b. Dependency PRs are not this routine's job (`deps` owns them)

Until 2026-09-01 this section told a backlog routine to also read the Dependabot queue — "after the
issue pick and only if the pick left budget". Budget is never left, so on the nights this routine did
real work the queue went unread, and on the nights it had nothing to do it merged one PR out of a
group of three. #378, #379 and #455 each sat green for a week or more while a human eventually
noticed them. A duty attached to a routine whose job is something else is not a duty.

[`deps`](deps.md) owns dependencies now: every open Dependabot PR, the advisories behind them, the
merge decision, and the source-side fix when a bump breaks code. If this routine happens to find a
dependency PR while gathering, it links it in a comment and moves on. It does not merge it, does not
close it, and does not label it.

## 3. Fix — same bar as `review`, same budget, more than one pick where the risk is low

Write the regression test first, run it against the unfixed code, **observe it red**, then fix and
watch it go green. An issue you cannot make a test fail for is not one you understand well enough to
resolve unattended — comment why on the issue (what's missing to make it testable) and leave it
`ready-for-agent` for a future run or a human, whichever adds the missing piece.

Never widen the fix beyond the issue. Never touch a don't-touch path.

**"One issue per run" was written when `maxFiles` was 6, and it stopped being the binding constraint
on 2026-09-01 when the budget went to 9.** The rule is now the thing stranding the tail: with six
rungs filing at a measured 3.3 issues a night and one consumer taking exactly one pick, the queue
cannot drain at any confidence level, and a greedy easy-first pick (§ 2) means the residue is
permanently the hard half. Two classes show it exactly: the five `lintWarnings` regressions (#431,
#447, #465, #478, #499) and the five self-contradicting records (#475, #513, #527, #528, #542) — **ten
issues, none of them closed**, sitting in a backlog whose mean age is passing a week. So the rule is
per-class now, and the file budget is still the safety property:

- **One product-code bug** per run, at `review`'s bar — red first, then green. Unchanged.
- **Plus the record-and-reference class, batched to the budget**: doc corrections, ledger/claim
  contradictions, a stale measurement baked into a comment, a test-file map missing rows, a label or
  link that points at a closed tracker. These change no behaviour and cannot go red first, so their
  oracle is `npm run check` staying green — which is why they may share one run: the risk in a
  behaviour-preserving doc diff is _size_, and `maxFiles: 9` already bounds size. Take as many of
  those as fit, oldest first. Eight missing rows in one table (#529) is one issue and half a budget;
  pricing it as a run's whole allowance is what makes a ten-deep queue move one row a night.

**Oldest first, and never silently.** Among the candidates that clear § 2's confidence bar, take the
oldest, not the easiest. Any reachable issue older than seven days that you pass over gets a row in
this ledger naming it and the reason — `blocked-by-budget` with the file count you needed, or
`blocked-by-paths`, or one line of why § 2 says it is not pickable. A pass without a reason is
indistinguishable from a run that did not look, which is the failure this routine's own ledger has
been diagnosing since 2026-08-23 in writing.

**Filing.** This routine's `maxIssues` is 1 (rule 12) and it exists for exactly one case — README rule
3's blocker issue when a run cannot get to green. `resolve` is the shelf's consumer, not a producer; if
you find yourself wanting a second issue, you have found a `blocked-by-` row instead.

## 4. Hold the PR instead of merging — when the risk is real and it is not the owner's decision to make

Default path: push the branch, open the PR, wait for `npm run check` + CI green, **merge it
yourself**, close the issue with a link to the merged PR. That is the common case and needs no
extra ceremony.

Take the hold path instead — push the fix, open the PR, comment on it explaining exactly what is
unclear or what is at risk, **do not merge it**, and **leave the issue labelled as it is** — when
**any** of these hold:

- The fix touches a trust boundary: a sanitizer or allowlist that is the whole safety model for a
  slot (`mermaidSanitizer.ts`, `infographicSanitizer.js`, `chartSchema.ts`/`vega-lite` compile gate,
  `parseAnythingHtml`/`lintAnythingPolicy`/`runAnythingRuntimeCheck`, `parseFormsA2ui`), the Anything
  sandbox/CSP wiring (`AnythingRenderer.jsx`, `wrapAnythingSrcDoc` — never add `allow-same-origin`),
  or anything auth/session/secret-adjacent.
- The correct fix isn't obvious from the issue and the code — you're choosing between two plausible
  approaches, or the "what correct looks like" the issue names turns out to be ambiguous once you're
  in the code.
- The regression test needed real product-behaviour judgement to write (as opposed to being a direct
  transcription of the bug report) — a test you're not fully sure is asserting the right thing is not
  a green light, it's the uncertainty in a different shape.
- The diff would touch a path adjacent to (not on, but near) the don't-touch list, or a file the
  ratchet/ADR-0005 table is already tracking as a monolith under active budget pressure.
- CI is green but flaky-adjacent — the one documented exception in `README.md` § 3 aside, any red you
  had to reason your way past rather than cleanly reproduce and fix.

This is not a lower bar than "confident enough to fix" — it's what happens when a fix clears that
bar for _correctness_ (you can prove it with a test) but not for _unattended-merge risk_. Both can
be true at once, and conflating them is how a routine ends up merging something it was privately
unsure of.

**Holding a PR is not the same as messaging the owner, and only the second one costs them time.**
Before ADR-0017 the hold path also flipped the issue to `ready-for-human`, which quietly converted "I
am unsure about this diff" into "a person must now act" — and since the person does not read the
tracker, the effect was to delete the work rather than queue it. Two of the three issues that reached
`ready-for-human` were blocked by a _number_ (`resolve`'s `maxFiles`) and one by a lint warning, none
of which ever needed a human. The hold now leaves the label alone, so the next firing re-reads it.

`ready-for-human` remains available **only** for the four page-bar conditions in
[`README.md`](README.md) § 10 — money, credentials/permissions, irreversible destruction, or the
product's direction. Not for a large diff. Not for an ambiguous one. Not for "out of my budget". If
you are holding a PR because you are unsure, the label that fits is the one it already has.

## 5. Close

Append a ledger row: date, issue picked (number + title), outcome (merged PR number, held PR number +
what is unsure, or `blocked-by-budget` / `blocked-by-paths` + the arithmetic), and anything skipped
with a one-line reason. Move the issue's tracking entry in the ledger `todos` to `completed` (merged)
or leave it `pending` with the hold noted.

The three outcome strings are how the next run and `improve` § 2b read this backlog without re-deriving
it. A row that says "quiet" while an issue sat reachable-but-too-big is the row that made #402 last a
week.

## When a hold repeats

A held PR that no one acts on is not a request to a human — it is a decision the shelf has not made
yet. Second firing to find the same issue held:

- If the blocker is a **number** (budget, a path, a rule) → record `blocked-by-budget` /
  `blocked-by-paths` and stop touching it; `improve` owns the number and § 2b greps for the row.
- If the blocker is **genuine uncertainty about the code** → re-read it with the PR's own comments in
  hand. A second pass over a diff you already wrote is cheaper than a third hold, and if it now looks
  safe, merge your own PR and say what changed your mind in the merge comment.
- If the blocker looks like **the product's direction** → that is page bar #4. Say so once, in the
  issue, in one line, and let `digest` carry it. Do not repeat it nightly: `digest` surfaces anything
  still open, and a routine that re-raises the same question every night is the reason digests get
  muted.

## Verification

```bash
npm run routine:guard -- --preflight resolve    # BEFORE starting
npm run precommit
npm run check
npm run routine:guard -- --postflight resolve   # BEFORE pushing
```

The guard is the safety model, not a formality: it re-reads `maxFiles` / `allowedPaths` /
`forbiddenPaths` from this playbook's own front-matter and checks the real diff, because a routine
runs unattended and its safety cannot rest on the model having read the prose.

Preflight also enforces README rule 5 — it refuses to start behind an open PR of this routine's
own, matched on the PR title prefix (branch names are generated by the cloud runner, so the branch
alone cannot identify who opened a PR). If it _warns_ that it could not read open PRs, `gh` is
missing or unauthenticated and that check did not run: confirm by hand before pushing. An absent
answer is not "no open PR".
