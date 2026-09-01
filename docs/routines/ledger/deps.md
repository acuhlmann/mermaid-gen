---
name: deps
todos:
  - id: actionable-alerts
    content: 'OPEN 2026-09-01 — 7 alerts have a patched version and no PR (playbook § 3b): nanoid → 3.3.18 (high), @hono/node-server → 1.19.15 (med), dompurify → 3.4.9 / 3.4.11 / 3.4.12 / 3.4.13 (2 med, 2 low), uuid → 11.1.1 (med). "Open the update" in the Security tab is page bar #2; § 2 merges whatever arrives'
    status: pending
  - id: waiting-upstream
    content: 'OPEN 2026-09-01 — @ai-sdk/provider-utils (low) has no patched version yet. Not a queue that can move: count it, do not chase it'
    status: pending
  - id: no-dependabot-yml
    content: 'There is no .github/dependabot.yml in this repo: the schedule and the npm_and_yarn grouping live in account settings, which no agent can read and no PR can review. That is why 19 alerts opened 2026-08-22 produced one PR on 2026-08-30. Decide whether to commit one so the cadence is versioned (a config file is not a new dependency)'
    status: pending
  - id: verify-trigger
    content: 'First firing: confirm the live cron is 30 4,16 * * * UTC against this schedule key (digest watchdog 4), and pin the observed branch slug into branchPrefix — it is inert until then, and the title prefix is what identifies this routine’s PRs'
    status: pending
---

# Ledger: `deps`

Durable memory for the [`deps`](../deps.md) routine. Read the run log before acting: a PR already
rebased twice, or an advisory already analysed and parked, is not fresh work.

**State at creation, 2026-09-01** (measured, not assumed): open Dependabot PRs — none; #378, #379 and
#455 are merged, so the queue starts empty. Open alerts — 8 (1 high, 4 medium, 3 low), 7 of them
actionable. `main` is green.

## Locked

| Date       | Decision                                                                                                                                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-01 | **The lockfile is not this routine's to write.** `package-lock.json` stays always-forbidden; every dependency change reaches `main` through a merged Dependabot PR, and a source-side compat fix gets Dependabot to `recreate` its PR afterwards. This keeps one author for resolved trees. |
| 2026-09-01 | **Green + mergeable + patch/minor merges the same day.** No age threshold. The seven-day rule it replaced waited for a clock while the actual failure was that nobody read the queue.                                                                                                       |
| 2026-09-01 | **Never ignore, cancel, or close an advisory.** Dismissing somebody else's vulnerability is a risk decision and sits on the page bar (README § 10), not in this routine's budget.                                                                                                           |
| 2026-09-01 | A major is **attempted**, not escalated. It becomes a comment-plus-`todo` only when the fix is a design change or exceeds `maxFiles`; `ready-for-human` is not available for "too much work".                                                                                               |
| 2026-09-01 | Runs **twice daily**, off the night ladder (`30 4,16 * * *` UTC), because advisories arrive in bursts and one daily read leaves a `high` sitting up to 24 h.                                                                                                                                |

## Open observations

**2026-09-01 — the duty existed and nobody could reach it.** `resolve.md` § 2b told a routine whose
job is the issue backlog to also read a dependency queue "after the issue pick and only if the pick
left budget". Budget is never left: `resolve` logged "quiet" on nights an actionable dependabot PR sat
green two hours earlier. #378 and #379 waited eight days for a human, #455 two, and 19 security alerts
have been open since 2026-08-22 with one PR to their name.

**2026-09-01 — Dependabot is configured outside the repo.** There is no `.github/dependabot.yml`; the
schedule and the `npm_and_yarn` grouping live in account settings, which no agent can read and no PR
can review. That is the shape ADR-0014 was written against — instructions living where the repo cannot
see them — and it is why the first `todo` above asks to commit one rather than why the queue is slow.

## Run log

Append one row per firing, including runs where the queue was empty.

| Date | Queue | Merged | Left open (cause + age) | Benches | Notes |
| ---- | ----- | ------ | ----------------------- | ------- | ----- |
