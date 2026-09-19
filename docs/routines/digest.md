---
name: digest
tier: report
schedule: '45 0 * * *'
prTitlePrefix:
  - 'digest:'
---

# Routine: `digest`

**Read [`docs/routines/README.md`](README.md) first — it carries the rules this playbook assumes.**

Reports on the night that just ended, as one comment on the standing issue
[**#452 — 📋 Nightly agent digest**](https://github.com/acuhlmann/mermaid-gen/issues/452).

`45 0 * * *` (**08:45 HKT**) is the last rung of the night ladder and fires ~1 h after `resolve`, the
last code-writing job. Everything it reports on has already merged, and the digest lands while the
owner is at the keyboard rather than two hours before they wake — which is the whole point of the
window: `prune` opened it at 23:00 HKT by filing a deletion PR nobody can merge for them, and this rung
closes it by saying so.

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

**Acting is not filing and not committing.** Since [ADR-0018](../decisions/0018-green-builds-self-healing-and-the-two-minute-ask.md)
this rung carries the closed watchdog-action list of § 2c — re-fire a dark Claude-hosted rung whose
trigger id is recorded, and un-stick a crashed routine's stranded green draft. Neither authors work;
each executes something the owner already scheduled and already paid for once. The tier's
mechanical invariant is about the diff and stays exactly as `--postflight` enforces it.

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
head -12 docs/routines/*.md docs/automations/*.md | grep -E '^(==>|name:|tier:|host:|schedule:|paused:|mergePolicy:)'
```

That one line answers three of the five watchdogs, and it is the only cheap place where a parked rung
and a deleted one can be told apart. **Read the four keys, not just `schedule:`:** `paused:` means
`enabled: false` is a decision rather than an outage (watchdogs 1 and 4), and `mergePolicy:` means a
held PR is not a stalled diff. Both are in the front-matter and nowhere else a watchdog can see — a
prose note forty lines into a playbook is not reachable on a 3-minute no-op firing, and it is why these
two fields exist as keys at all.

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
   **A dark Claude-hosted rung whose trigger id is recorded in `review.md` § the night ladder is
   also § 2c's to re-fire — write the line about the action taken, not just the gap.**
   **Except a playbook whose `schedule:` is `none`, or which declares `paused:`.** Such a rung is
   manual-only or parked, so an empty ledger is its correct state and reporting it nightly is exactly
   the noise that gets a digest muted. Read `schedule:` and `paused:` from the `head -12` pass in § 1;
   either one means skip the rung and do not mention it as a gap. **`paused:` exists because a
   playbook's prose does not reach this check** — the exception note for `canvas-graph-edit` is 60 lines
   below the front-matter, and § 1 reads twelve. A park that is not in the front-matter is a park
   `digest` will report as a failure every morning until someone mutes the report rather than the
   report being wrong. The inverted finding _is_ reportable: a `schedule: none` playbook with a live
   cron behind it means somebody scheduled it without editing the playbook. **That finding was not
   hypothetical** —
   `prune` shipped manual-only on 2026-09-07, acquired a live `0 0 * * *` cron that no document knew
   about, and watchdog 4 caught the disagreement on 2026-09-13. It was resolved the next day by
   declaring the rung at `30 15 * * *` and giving it a ladder row
   ([`review.md`](review.md) § the night ladder), which is the correct direction to fix it in: the
   shelf's oldest failure mode is a playbook nobody runs, and a live cron that the playbook denies is
   the same failure wearing the opposite hat. **There is no `schedule: none` routine today, and one
   `paused:` routine** (`canvas-graph-edit`, owner's decision 2026-09-14 — see watchdog 4 for what to
   check about it). The exemption stays because "Adding a routine" step 4 still offers `none`, and a
   future rung may take either — but do not assume a rung is unscheduled because its name is missing
   from `claude -p '/schedule list'`. See watchdog 4's page cap.
2. **A PR left open overnight.** Any open PR older than 24 h, with its CI state. Say whether
   `routine-guard --preflight` will now refuse that routine's next firing, because it will.
   **A green, mergeable, routine-owned draft in that set is § 2c's to un-stick** — the stranded
   leftovers of crashed runs (#619, #716, #726) each cost their successor the start of a firing,
   and an un-stick is the one recovery that should happen before morning, not at the next preflight. A held PR
   (a routine that finished a fix and declined to merge it — `resolve.md` § 4) belongs in this line
   with what it is unsure of, in the same sentence: holding is a state in the repo, not a request to
   the owner, and it should read that way.
   **Say what the hold disables.** A held PR is not a paused question, it is a stopped routine —
   rule 5 refuses that routine's own next firing. Measured 2026-09-04: `improve` held PR #531 and its
   two following runnings were ~3-minute no-ops, and `improve` § 2b is the only place a
   `blocked-by-` row, a stale `allowedPaths` glob, or any playbook budget on either shelf ever gets
   priced. When the held PR belongs to `improve`, name what froze with it — the shelf has no budget
   owner while it sits, which is worth more in one sentence than three nights of "sitting untouched".
   **Say which kind of hold it is** (README § "Two kinds of hold"), because they need opposite things
   from the reader. A `resolve:` hold means _an agent is unsure_ and nobody has to do anything tonight.
   **No routine files a policy hold any more.** `prune` — the shelf's only one, on the reasoning that a
   deletion is page-bar #3 — began self-merging on 2026-09-14 under five mechanical controls
   ([`prune.md`](prune.md) § 5), so a `prune:` PR that is still open in the morning is **news and not
   the design**: either CI is red on it, which after a deletion means a sensor was wrong and the
   candidate was live, or the run took a judgement hold, which § 5 allows and wants named in the body.
   Report an open `prune:` PR with its CI state and its age, and say which of those it is — do not
   repeat the old "this is the gate working as designed" line, because that sentence is now false and
   would talk the owner out of looking at a red build.
3. **Red `main`.** Any failed CI run on `main` in the window, with the job name. Rule out the
   documented `anythingRuntimeCheck.test.js` load-contention flake before calling it a regression
   (`docs/agents/sensors.md` § Known flakes) — the tell is a uniform timing shift across every
   case in that one file.
4. **Schedule drift.** Compare each live routine's cron against the `schedule:` in the matching
   playbook's front-matter and report any pair that disagrees, with both values. The **repo-side** half
   of this is no longer yours: since 2026-09-14 `npm run verify:agent-infra` parses every playbook's
   `schedule:` and fails CI if the nine mirror tables disagree with it, if a ladder rung moves outside
   the 15:00–01:00 UTC window, or if a rung's HKT column stops matching its UTC hour. On 2026-08-30
   **all four** live crons disagreed with their playbooks and two playbooks stated an ordering
   rationale the real firing order inverted; what nothing could catch then was live-versus-declared,
   and that is the half left here.
   **Direct source for the Claude rungs: `claude -p '/schedule list'`** — cheaper and more literal than
   the `Claude_Code_Remote` connector, and it carries each routine's id, live cron in UTC, model and
   enabled state.
   > **The list is capped at 20 and the cursor does not work.** Measured 2026-09-14: the `list` action
   > returns the newest 20 routines sorted by `created_at` descending, reports `has_more: true`, and
   > **ignores** both `cursor` and `limit` — retried with each and got a byte-identical page. So this
   > source can silently omit a live rung, and absence from it is **not** evidence a routine was deleted.
   > The failure is self-worsening: eleven inert fired one-shots (mostly `deps` CI re-checks) were
   > already occupying page-1 slots, which is exactly why `metaphor3d` — the oldest rung, firing nightly,
   > merged #672 the same afternoon — disappeared from this list on 2026-09-12 and a later digest
   > described the fleet as six crons. Ask for one rung by name and it will still be missing; the answer
   > is not "deleted", it is page 2. **And the id cannot be recovered from the other direction either**:
   > on 2026-09-14 `get_run_log` was run against a `metaphor3d` session taken from that commit's
   > `Claude-Session:` trailer, paged back to the provisioning events at the start of the run, and no
   > trigger id appears anywhere in it — so a rung that has aged off page 1 cannot be `get`ted, `update`d
   > or `run` at all from this machine. That is why the 2026-09-14 retiming deliberately chose slot
   > changes that left the unreachable rung where it already belonged instead of asking for it.
   > **So: never report a missing Claude rung from the list alone.** Confirm it the way you confirm a
   > Cursor rung — did that playbook's PR or `main` commit actually land in the window? Say which of the
   > two methods you used. If a rung is absent from the list _and_ produced nothing, that is a dark job
   > (watchdog 1) and you should say so; absent from the list alone is a listing artifact. Report a
   > **disabled** routine you can actually see as a finding, but a rung that has aged off page 1 cannot
   > be told from a deleted one here, and saying "deleted" about one is a false alarm the owner cannot
   > act on. The durable fix exists as of 2026-09-14 and it is yours to use: seven of the nine rungs
   > have their **trigger id recorded in [`review.md`](review.md) § the night ladder**, so `get` those by
   > id and treat `list` as a way to spot routines that are _not_ in the playbooks (an unregistered
   > fleet, watchdog 7's business) rather than a way to prove a registered one is gone. The remaining
   > gap is `metaphor3d`, whose id nobody on this machine can reach. Clearing the fired one-shots at
   > claude.ai/code/routines would fix the underlying cap, but deleting a routine is page bar #2 — name
   > the count in one line and leave it there.
   > **A parked rung is not a dark rung, and `paused:` is the field that tells them apart.** A playbook
   > whose front-matter declares `paused:` has an owner's decision behind its `enabled: false` — today
   > that is `canvas-graph-edit`, parked 2026-09-14 with its cron kept so a resume is one toggle and not
   > a re-derivation. Do not report it as a finding; do not ask for it to be re-enabled; a line in §
   > the quiet lines saying which rung is parked and since when is the whole of it. **Check the
   > inversion, which is the one that actually matters:** a trigger reading `enabled: true` on a
   > playbook that declares `paused:` means somebody un-parked a rung without editing the shelf —
   > spending on a decision the owner already made, in the one direction this shelf has no other
   > sensor for. Both fields are on the `head -12` pass in § 1 precisely so this is answerable without
   > reading a playbook end to end; a prose note deep in a file is not, which is why the field exists
   > at all and not just a paragraph.
   > **Cursor-hosted rungs are not visible to either source** — `improve` and `resolve` today; the
   > `agent` CLI has no `automations` command at all, so there is nothing to call. For those, compare the
   > declared `schedule:` against when that routine's PRs actually landed, and say which method you used.
   > A rung whose host you cannot query is not evidence that it is fine: `deps` declares two crons in one
   > (`30 4,14 * * *`), so a half-day of silence from it is invisible to a PR-time heuristic alone.
   > `schedule: none` is not drift and is not a missing cron — it is a declaration that no trigger should
   > exist. No playbook uses it today; if one appears, compare the list against it the other way and treat
   > a live routine matching a `schedule: none` playbook as a finding **about the playbook**, not about
   > the cron.
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

## 2c. Watchdog actions — the closed list

A report that can only describe the stuck fleet makes the owner the fix for everything it notices;
[ADR-0018](../decisions/0018-green-builds-self-healing-and-the-two-minute-ask.md) moved exactly two
recoveries here, bounded, because both are actions the owner **already scheduled and already paid
for once** — the rung's nightly firing, the PR's green CI gate. Nothing outside this list is
permitted, and every use is self-reported in the same comment, in the section whose finding caused
it. This list does not change the tier's mechanical invariant: `--postflight digest` still fails on
a non-empty diff, because both actions are trigger-API and PR-state calls, not commits, not issues,
not labels, not closes, and never a merge button this rung presses.

**1. Re-fire a dark Claude-hosted rung, once.** Conditions, all of them, checked against § 1's
evidence: the rung's `host:` is Claude; its playbook declares neither `paused:` nor
`schedule: none`; it produced no `main` commit, no PR, and no ledger row in the window; **and** its
trigger id is recorded in [`review.md`](review.md) § the night ladder. Method:
`claude -p '/schedule run <id>'` — read the id from the table, never from `/schedule list`
(watchdog 4's page cap can hide the very rung you are healing). Bound: at most one re-fire per
rung per digest run and at most three re-fires per run — that is the whole pre-authorized spend,
one extra firing each of rungs whose nightly firing was already budgeted. A rung dark **two
nights running** is not re-fired a second time by this rule's second night: that is an outage
(revoked login, quota, deleted trigger), and re-firing an outage is spend without information —
report it as such instead, and say the page where it is diagnosable.

**2. Un-stick a routine's stranded green draft.** Conditions, all of them: the PR is open **and
draft**, older than 24 h, its title matches a routine's `prTitlePrefix` on either shelf, every
reported check is green, and it is mergeable-clean. That is a run that crashed holding the door —
it cannot be a judgement hold, because a hold says what it is unsure of in the body and the owner's
question here is why a green diff is standing at preflight blocking its own routine. Method: mark
ready and enable auto-merge (`gh pr ready <n>` then `gh pr merge <n> --auto --merge`; in the cloud,
their MCP/REST equivalents — see § 3's rule 9 note). **If the checks were already all green, the
PR may merge the instant you enable auto-merge: that is the green gate landing, not a gate skipped
— this action can enable a merge, never perform one.** Bounds: never a red or pending-checks PR
(that is the owning routine's finish-or-close decision at its next preflight, with tonight's full
context), never a non-routine PR, never a human's PR, never a PR under 24 h old — the run that
opened it may still be alive and polling. A routine-owned draft counts **whatever host ran the
routine**: ADR-0018's Cursor carve-out (Decision 5) is about trigger reach, and a green PR is
GitHub state — if `improve` crashes holding one, un-sticking it is squarely in this list.

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
destruction, or the product's direction. At most three such lines exist in a digest — and at most
one in practice, because three legitimate page-bar items in one night is itself a fact the sections
should be doubting. **Each one is a decision, not a topic** (rule 10's corollary, ADR-0018): the
binary question, this routine's recommendation with its one-clause reason, and what silence does —
which is always _nothing_: the status quo holds, the line ages into the sections, and it re-raises
only if the facts change. A page-bar item phrased as an open-ended "worth confirming" is not an ask,
it is an investigation you are assigning to a phone at 07:00; the 2026-09-17 stray-connector line
was right to page and wrong to be unanswerable. Everything else — an unowned issue, a held PR, a
budget that moved, a red bench, a job that skipped — belongs in a _section_ below. Reporting
routine-manageable work as an alert is how a real one gets missed: before ADR-0017 the shelf flagged
a stalled issue every time one aged three days, and every instance was a number in a playbook or a
lint warning that an agent could have handled and chose not to. The reader cannot tell an
over-cautious agent from an emergency, so the agent has to make that distinction instead. **No held
PR earns the line any more, `prune:` included** — the deletion hold came off on 2026-09-14 and an
open `prune:` PR in the morning is a watchdog-2 fact, not a page-bar question (watchdog 2 says how
to read it). A `resolve:` hold — an agent saying _I am unsure_ — never did.

**Never open an issue, never label one, never close one** — the § 2c list is the only other GitHub
state this routine may touch, and only the ready-flag and the auto-merge enable on it. If the digest
finds something that needs
work, it names it and the next night's `resolve` picks it up from the backlog `review` and
`improve` maintain — a reporter that also files becomes a third filer competing with them.

## Verification

```bash
npm run routine:guard -- --preflight digest    # BEFORE starting
npm run routine:guard -- --postflight digest   # BEFORE finishing: proves the diff is empty
```

There is no `npm run check` rung here, because there is nothing to check: this routine's whole
output is one comment.
