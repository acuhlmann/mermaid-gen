---
name: digest
tier: report
schedule: '0 23 * * *'
prTitlePrefix:
  - 'digest:'
---

# Routine: `digest`

**Read [`docs/routines/README.md`](README.md) first — it carries the rules this playbook assumes.**

Reports on the night that just ended, as one comment on the standing issue
[**#452 — 📋 Nightly agent digest**](https://github.com/acuhlmann/mermaid-gen/issues/452).

`0 23 * * *` (07:00 HKT) is the last rung of the night ladder and fires ~45 min after `resolve`,
the last code-writing job. Everything it reports on has already merged.

## Tier `report` means this routine writes nothing

No branch, no commit, no PR. `npm run routine:guard -- --postflight digest` **fails on a non-empty
diff** — that is the enforcement, not this sentence. Its run-log lives in the issue thread rather
than in `docs/routines/ledger/digest.md`; the ledger file holds only Locked decisions, for a human
or for `improve` to edit in a normal PR.

If you find yourself wanting to commit something, you have found work for a different routine.
File an issue and name it in the digest.

## 1. Gather

Everything below is read-only and key-free. **Do not run `npm ci`** — nothing here needs
`node_modules`. `verify-ratchet.mjs` imports only node builtins, so calling it directly (rather
than through `npm run`) saves this routine an install it would otherwise pay for every morning to
read four numbers.

```bash
git fetch origin main
SINCE='24 hours ago'

# what landed, and who produced it
git log --format='%h|%an|%ad|%s' --date=short --since="$SINCE" origin/main

# the backlog, and what is stuck in it
gh issue list --state open --limit 60 --json number,title,labels,createdAt,updatedAt
gh pr list --state open --limit 40 --json number,title,headRefName,createdAt,isDraft,statusCheckRollup

# is main actually green
gh run list --branch main --limit 6 --json name,conclusion,createdAt,event

# quality trend (gates nothing — read the deltas)
node scripts/verify-ratchet.mjs --json
```

Then the ledgers — **the tails only, never the whole file**:

```bash
for f in docs/routines/ledger/*.md docs/automations/ledger/*.md; do
  echo "### $f"; grep -c '^| 20' "$f"; grep '^| 20' "$f" | tail -2 | cut -c1-400
done
head -12 docs/routines/*.md docs/automations/*.md | grep -E '^(==>|schedule:|name:)'
```

**Do not `Read` a ledger file whole.** `improve.md` is 74 KB, `resolve.md` 67 KB and `review.md`
61 KB — over 200 KB together, and a single run-log row can be 4 KB of prose on its own. The first
live firing of this routine read all three in full, hit auto-compaction mid-run, lost the gathered
data, and then wrote a digest containing several claims it had invented. What this routine needs
from a ledger is the row count and the last two rows.

## 1b. Report only what you gathered

**Every line of the digest must be traceable to output from § 1.** This routine summarises; it does
not reason about what probably happened.

Specifically, and each of these was invented by the first live firing:

- A job "ran" only if it has a `main` commit, a PR, or a ledger row in the window. Do not infer it
  from its cron. **A job that fired and did nothing looks exactly like a job that did not fire, and
  telling them apart is this routine's entire watchdog value** — so if the evidence is absent, the
  finding is "no evidence it ran", not "it ran".
- Quote issue and PR numbers from the gathered JSON. Do not describe an issue you did not read.
- Ratchet numbers come from `verify-ratchet.mjs --json` and nowhere else. "No violations" and "no
  improvements" are different statements; print the deltas it actually reported.
- If you cannot establish something, write "unknown" and say what you would have needed. An honest
  gap is useful; a confident wrong line teaches the reader to stop believing the whole digest.

## 2. The five sections

Write them in this order. Lead with what changed; a digest that opens with an alert nobody can act
on teaches the reader to skim past the part that matters.

### Merged

Group last night's `main` commits by the job that produced them, using the PR-title prefix
(`Metaphor3D:`, `anything automation:`, `review:`, `improve:`, `resolve:`, `feat(web)`/`fix(web)`
for the Cursor fleet). One line each: PR number, one clause of what it actually did, and the number
the PR body claims if it claims one. **Do not re-verify the claims** — that is `review`'s job and
duplicating it is how this routine turns into a second reviewer that costs an hour.

### Filed / blocked

- Issues opened in the window, with labels. **Skip anything labelled `log`** — that is this
  routine's own standing thread (#452) and reporting it as backlog every morning is the shape of
  noise that gets a digest muted.
- **Unreachable `ready-for-agent` issues.** For each one, check whether the file it names is inside
  the `allowedPaths` of a routine that reads the backlog. An issue no routine can reach is not
  waiting — it is stuck, and it will stay stuck silently. (#441 sat like this from 2026-08-29:
  a `docs/**` fix filed by `review`, labelled for an agent, and `resolve` had identical paths.)
- `ready-for-human` issues older than three days, with their age.

### Watchdog

This is the section the routine exists for. Report each of these or say explicitly that it is clear:

1. **A job that did not run.** Any playbook on either shelf whose ledger has no row for last
   night, or which produced no `main` commit and no PR. Name it and say how many nights it has
   been quiet. A job going dark is silent by construction — nothing else in the system notices.
2. **A PR left open overnight.** Any open PR older than 24 h, with its CI state. Say whether
   `routine-guard --preflight` will now refuse that routine's next firing, because it will.
3. **Red `main`.** Any failed CI run on `main` in the window, with the job name. Rule out the
   documented `anythingRuntimeCheck.test.js` load-contention flake before calling it a regression
   (`docs/agents/sensors.md` § Known flakes) — the tell is a uniform timing shift across every
   case in that one file.
4. **Schedule drift.** The `Claude_Code_Remote` connector is attached for exactly this: list the
   routines and compare each live `cron_expression` against the `schedule:` in the matching
   playbook's front-matter. Report any pair that disagrees, with both values. `routine-guard` does
   not read that key, so it drifts in silence — on 2026-08-30 **all four** live crons disagreed
   with their playbooks, and two playbooks stated an ordering rationale that the real firing order
   inverted. For the Cursor-hosted automations, which this connector cannot see, fall back to
   comparing the declared schedule against when their PRs actually landed.
5. **Stale dependency PRs.** Dependabot PRs open more than seven days, by age.

### Ratchet

Deltas only, from `verify-ratchet.mjs --json`. A metric that did not move gets one summary line, not
a row. Call out any `violations` entry loudly — the ratchet gates no build on purpose, so a
regression is visible here or nowhere.

### Cost

Which jobs ran, and roughly how long each took (PR open→merge is a good enough proxy). One line.

## 3. Post — and this is the step the routine exists for

**`gh` is not authenticated in the cloud sandbox.** Measured on the first live firing: the guard's
own preflight printed `could not read open PRs (gh missing, unauthenticated or offline)`. Reads in
§ 1 that go through `gh` will fail the same way; use the **GitHub MCP tools** for anything that
touches the API, and keep the `gh` forms above only as the local-development equivalent.

Post the comment with the GitHub MCP tool for adding an issue comment, on issue **452**. Confirm it
landed by reading the issue's comment count back. **A run that composes the digest and returns it
as its final message has failed** — that is what the first firing did, and it reported `success`.
The digest is a comment on #452 or it is nothing.

Title the comment with the date. Keep the whole thing under ~60 lines: it is read on a phone,
before coffee, by someone deciding whether anything needs them today. **If the answer is "no", say
so in the first line and let the sections below carry the detail.**

Never open an issue, never label one, never close one. If the digest finds something that needs
work, it names it and the next night's `resolve` picks it up from the backlog `review` and
`improve` maintain — a reporter that also files becomes a third filer competing with them.

## Verification

```bash
npm run routine:guard -- --preflight digest    # BEFORE starting
npm run routine:guard -- --postflight digest   # BEFORE finishing: proves the diff is empty
```

There is no `npm run check` rung here, because there is nothing to check: this routine's whole
output is one comment.
