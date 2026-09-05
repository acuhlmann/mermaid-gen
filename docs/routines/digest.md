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
Name it in the digest and the backlog already carries it: `review` and `improve` file from their own
findings and `resolve` gathers what is filed. **This routine files nothing** — § 3's "never open an
issue, never label one, never close one" is the rule, and it is why a `report` playbook may not declare
a `maxIssues` budget either (`README.md` rule 12, refused by `loadPlaybook`). A reporter that also files
is a third filer competing with the two whose job it is, on a shelf whose measured failure was three
filers against one consumer.

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

# the dependency queue (watchdog 5): PRs and the advisories behind them
gh api '/repos/acuhlmann/mermaid-gen/dependabot/alerts?state=open' \
  --jq '.[] | "\(.number)|\(.security_advisory.severity)|\(.dependency.package.name)|\(.security_vulnerability.first_patched_version.identifier)"'

# quality trend (gates nothing — read the deltas)
node scripts/verify-ratchet.mjs --json

# the queue itself: size, oldest, net inflow, and who filed what (README rule 12)
node scripts/routine-guard.mjs --filings --json
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

- **The queue, as one number.** Open issues (excluding `log`), the oldest and its age, and the net
  inflow from `routine-guard --filings --json` — `created` minus `closed` over 24 h. Say how it moved
  since your previous comment on #452, which is the only place the trend is stored: the thread is read
  back, not reconstructed. One line, e.g. `backlog 23 open (was 21), oldest #431 at 8d, net +2`. This
  is the shelf's own output and nothing else in the system counts it — every other watchdog asks about
  one issue, one PR, one job. **It is a section line, not a `Needs you:` line** (rule 10): a growing
  backlog is a budget problem that `resolve` and `improve` own, not an emergency.
- **Filings by routine, against each `maxIssues`.** Same JSON, `perRoutine[]`: name any rung over its
  ceiling or `owes` (it filed while carrying more than three of its own findings past five days —
  `README.md` rule 12), and report `unattributed` when a filing arrived without its `filed-by:` line.
- Issues opened in the window, with labels. **Skip anything labelled `log`** — that is this
  routine's own standing thread (#452) and reporting it as backlog every morning is the shape of
  noise that gets a digest muted.
- **Unowned `ready-for-agent` issues** — the fix lives in a file no playbook's `allowedPaths`
  reaches. `resolve` gathers by label and skips on the path check, so one of these is invisible
  work: it looks triaged and will never be done. Check the paths each issue names:

  ```bash
  npm run routine:guard -- --reachable <path> ...   # exits 1 when any path prints NONE
  ```

  Name each `NONE` line. Before 2026-09-01 three issues (#461, #462, #473) sat in that state for a
  week while every routine correctly declined to touch them.

- **`blocked-by-` rows** in any ledger (`grep -rn 'blocked-by-' docs/routines/ledger
docs/automations/ledger`). These are routines recording that the only thing between them and a fix
  was a number. `improve` § 2b owns those numbers; report the count and the age, not each row.
- **`ready-for-human` at all.** Report each one with its age and say in one clause whether it meets
  the page bar (`README.md` rule 10). Nothing on either shelf may apply that label any more, so after
  this change any instance of it is either the owner's own filing or a stale one that `resolve` will
  re-triage on its next firing. It is never a request for you to act unless it names money,
  credentials, destruction or product direction.

### Watchdog

This is the section the routine exists for. Report each of these or say explicitly that it is clear:

1. **A job that did not run.** Any playbook on either shelf whose ledger has no row for last
   night, or which produced no `main` commit and no PR. Name it and say how many nights it has
   been quiet. A job going dark is silent by construction — nothing else in the system notices.
2. **A PR left open overnight.** Any open PR older than 24 h, with its CI state. Say whether
   `routine-guard --preflight` will now refuse that routine's next firing, because it will. A held PR
   (a routine that finished a fix and declined to merge it — `resolve.md` § 4) belongs in this line
   with what it is unsure of, in the same sentence: holding is a state in the repo, not a request to
   the owner, and it should read that way.
   **Say what the hold disables.** A held PR is not a paused question, it is a stopped routine —
   rule 5 refuses that routine's own next firing. Measured 2026-09-04: `improve` held PR #531 and its
   two following runnings were ~3-minute no-ops, and `improve` § 2b is the only place a
   `blocked-by-` row, a stale `allowedPaths` glob, or any playbook budget on either shelf ever gets
   priced. When the held PR belongs to `improve`, name what froze with it — the shelf has no budget
   owner while it sits, which is worth more in one sentence than three nights of "sitting untouched".
3. **Red `main`.** Any failed CI run on `main` in the window, with the job name. Rule out the
   documented `anythingRuntimeCheck.test.js` load-contention flake before calling it a regression
   (`docs/agents/sensors.md` § Known flakes) — the tell is a uniform timing shift across every
   case in that one file.
4. **Schedule drift.** The `Claude_Code_Remote` connector is attached for exactly this: list the
   routines and compare each live `cron_expression` against the `schedule:` in the matching
   playbook's front-matter. Report any pair that disagrees, with both values. `routine-guard` does
   not read that key, so it drifts in silence — on 2026-08-30 **all four** live crons disagreed
   with their playbooks, and two playbooks stated an ordering rationale that the real firing order
   inverted. **Direct source for the Claude rungs: `claude -p '/schedule list'`**, which returns every
   routine's id, live cron in UTC, model and enabled state — cheaper and more literal than the
   `Claude_Code_Remote` connector, and it also reports a rung that was **deleted** rather than one
   that quietly stopped. Compare each against the playbook's `schedule:` and name both values.
   **Cursor-hosted rungs are not visible to either**: for `resolve` (since 2026-09-01) and anything on
   [`docs/automations/`](../automations/) still wired through
   [cursor.com/automations](https://cursor.com/automations), compare the declared `schedule:`
   against when that routine's PRs actually landed, and say which method you used. A rung whose host
   you cannot query is not evidence that it is fine: `deps` declares two crons in one
   (`30 4,16 * * *`), so a half-day of silence from it is invisible to a PR-time heuristic alone.
   Report a **disabled** Claude routine as a finding — a paused rung and a missing one look the same
   from the outside and both mean the ladder is not running.
5. **The dependency queue.** `deps` owns it now (`docs/routines/deps.md`), and this is the check that
   `deps` is working it: open Dependabot PRs with age and CI state, and the count of open Dependabot
   _alerts_ from `GET /repos/:owner/:repo/dependabot/alerts?state=open` — separate what has a patched
   version from what is waiting upstream, because only the first is a queue that could move. Report
   the worst age, and name any PR that has been green for more than a day: #378 and #379 waited eight
   days each for a human to notice, which is the exact gap that routine exists to close.
6. **A budget that moved.** Any `improve:` PR whose body carries a `budget-change:` line, plus any
   diff touching a playbook or a shelf README (there should be no other kind — `routine-guard`'s
   `BUDGET_OWNERS` refuses it). One line each: which routine, which key, before → after. This is the
   only place the shelf's own growth is visible, because the routine that spends a budget is not the
   one that changed it and nobody approved either.
7. **A fleet doing work the repo does not know about.** Any `claude/*`, `cursor/*` or `agents/*` branch
   or merged PR whose author matches no playbook's `prTitlePrefix` on either shelf. Cursor's
   unregistered `critical-bug-memory` automation duplicated a `review` finding on 2026-08-29 and both
   paid for the same PR; an automation that isn't in the registry can't be in the ledger, the budget,
   or the watchdog, so it is invisible by construction.

8. **The queue is not draining.** Seven rungs file; one consumes, and `resolve.md` § 3 caps it at one
   product bug a night. Report the arithmetic when it is lopsided: issues filed in the window vs
   closed, and — from the last seven days of your own thread — how many nights the difference has run
   positive. Then name the two failure shapes this shelf keeps producing, because they are invisible to
   every other watchdog here:
   - **A class with zero closures.** Recurring findings mint a number each time instead of appending:
     the five `lintWarnings` regressions and the five self-contradicting records sitting open since late
     August are ten issues describing two facts. `README.md` rule 12 is the rule; `improve` § 2b owns
     the number.
   - **A `ready-for-agent` promise no scheduler can keep.** An `enhancement`-shaped finding (a mutator,
     a hit-test, an affordance) carrying `ready-for-agent` is gathered, examined and refused every
     night, forever — `resolve` § 2 refuses design questions on sight and no automation reads another's
     queue. Name it and say the label is wrong, not the issue.
     A queue that grows for a week is a budget finding, not a page-bar one: it belongs here, never in the
     `Needs you:` line.

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

**The first line is the only thing guaranteed to be read, so it is the only place this routine may
raise its voice.** Start it `Needs you: <one clause>` **only** when something in the night meets the
page bar in [`README.md`](README.md) rule 10 — money, credentials or permissions, irreversible
destruction, or the product's direction. At most three such lines exist in a digest, and each names
what to do about it. Everything else — an unowned issue, a held PR, a budget that moved, a red bench,
a job that skipped — belongs in a _section_ below. Reporting routine-manageable work as an alert is
how a real one gets missed: before ADR-0017 the shelf flagged a stalled issue every time one aged
three days, and every instance was a number in a playbook or a lint warning that an agent could have
handled and chose not to. The reader cannot tell an over-cautious agent from an emergency, so the
agent has to make that distinction instead.

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
