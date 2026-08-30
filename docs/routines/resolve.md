---
name: resolve
tier: code-writing
schedule: '15 22 * * *'
maxFiles: 6
prTitlePrefix:
  - 'resolve:'
  - 'resolve ledger:'
branchPrefix:
  - claude/awesome-hawking
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
this file, another routine's playbook, an ADR or a ledger that is not this routine's own is
`improve`'s queue item, and doing it from here would mean a routine quietly widening its own
budget — which is the one edit that must always be visible in a PR a human reads.

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

For a `needs-triage` issue, or an unlabelled one: read it in full. If it already names the file,
the symptom, and what correct looks like, treat it as scoped even though the label hasn't caught
up. If it genuinely does not — no repro, no file, no clear "correct" — this routine cannot safely
act on it: leave a comment asking for the missing piece, apply `needs-info`, and move on. Guessing
at an underspecified report is exactly the shape of mistake this routine exists to avoid.

Read the ledger's run log and `Locked`/`Open observations` sections first — an issue already
attempted twice with no human action is not a fresh pick (see Escalation below), and an issue
already escalated is not re-escalated on the same finding.

## 2. Pick one

Take the **highest-confidence issue that fits the budget** — same bar as `review` § 3: if you would
not bet on it being real and locally fixable, do not attempt it. Prefer small, mechanical,
single-file fixes over anything that reads like a design question. Push everything else back into
the ledger's `todos` untouched.

Skip on sight, leave filed, do nothing further this run:

- Anything asking for a hub split or refactor (`docs/agents/balanced-coupling-priorities.md`: split
  on contact, and a schedule has no feature to be on contact with).
- Anything asking for a new dependency, a lint-severity promotion, or slot content (ADR-0014's three
  carve-outs — see `README.md` § What routines may not do).
- Anything whose fix cannot be expressed as a change inside this routine's `allowedPaths`, within
  `maxFiles`.

## 2b. Stale dependency PRs — one per run, merge only

Dependabot opens PRs that nothing in this repo ever reads. #378 (mermaid 11.16→11.17) and #379
(hono) sat open and green for eight days before a human noticed.

Once per run, after the issue pick and only if the pick left budget:

```bash
gh pr list --state open --author app/dependabot --json number,title,createdAt,statusCheckRollup
```

Merge **at most one** that satisfies all four: open more than 7 days, every check green, a
**patch or minor** bump of a dependency the repo already has, and no conflict with `main`. That is
merging someone else's PR, not writing one — this routine's own branch diff is unchanged, and
`package-lock.json` stays on the always-forbidden list for anything it authors itself.

A **major** bump is escalated, never merged: label it `ready-for-human` and say why in one line. A
red or conflicted one is left alone and named in the ledger row.

This does not contradict "no new dependencies" (README § What routines may not do). That rule is
about **adding** a package — a licence, a supply chain and a bundle cost, each a decision. Moving
an existing one forward a patch release with green CI is the boring maintenance this shelf exists
to absorb, and leaving it undone is how a security bump waits a week.

## 3. Fix — same bar as `review`, one issue per run

Write the regression test first, run it against the unfixed code, **observe it red**, then fix and
watch it go green. An issue you cannot make a test fail for is not one you understand well enough to
resolve unattended — comment why on the issue (what's missing to make it testable) and leave it
`ready-for-agent` for a future run or a human, whichever adds the missing piece.

Never widen the fix beyond the issue. Never touch a don't-touch path.

## 4. Escalate instead of merging — when uncertainty or risk is real

Default path: push the branch, open the PR, wait for `npm run check` + CI green, **merge it
yourself**, close the issue with a link to the merged PR. That is the common case and needs no
extra ceremony.

Take the escalation path instead — push the fix and open the PR, but **do not merge it**, comment on
the PR explaining exactly what you're unsure about or what's at risk, and switch the issue's label
to `ready-for-human` (leave a comment on the issue pointing at the PR) — when **any** of these hold:

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

## 5. Close

Append a ledger row: date, issue picked (number + title), outcome (merged PR number, or escalated
PR number + why), and anything skipped with a one-line reason. Move the issue's tracking entry in
the ledger `todos` to `completed` (merged) or leave it `pending` with the escalation noted (still
open, now on a human).

## Escalation nagging

If the same issue gets escalated three runs running with no human action on the PR, say so once in
the ledger and stop re-touching it that run — pick the next candidate instead. Re-escalating the same
finding every night is the routine version of the review nag rule, and it burns budget that could
fix something else.

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
