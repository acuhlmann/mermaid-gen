---
name: deps
todos:
  - id: open-queue
    content: 'Dependabot PR #455 (npm_and_yarn group: brace-expansion, fast-uri, ip-address) — green and mergeable since 2026-08-30, first thing the first firing merges'
    status: pending
  - id: alerts-without-pr
    content: '19 open alerts (2026-09-01), all in root package-lock.json: nanoid, @hono/node-server, dompurify, ip-address, fast-uri, brace-expansion, @ai-sdk/provider-utils, uuid. Several have no patched version yet — separate waiting-upstream from actionable each run'
    status: pending
  - id: no-dependabot-yml
    content: 'There is no .github/dependabot.yml in this repo: the config is account/org-level and invisible to review. Decide whether to commit one so the schedule and grouping are versioned (a config file is not a new dependency)'
    status: pending
---

# Ledger: `deps`

Durable memory for the [`deps`](../deps.md) routine. Read the run log before acting: a PR already
rebased twice, or an advisory already analysed and parked, is not fresh work.

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
