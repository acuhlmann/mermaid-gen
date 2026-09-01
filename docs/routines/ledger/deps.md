---
name: deps
todos:
  - id: dompurify-nested-pins
    content: 'BLOCKED, NOT AWAITING ANYONE — 4 dompurify alerts (3, 4, 5, 23) stay open because the vulnerable copies are exact-pinned by their dependents: @a2ui/markdown-it → `3.4.11`, monaco-editor → `3.4.8`. Measured 2026-09-01, three routes all fail: `npm update` cannot cross an exact pin; a root `overrides.dompurify = "3.4.14"` left both nodes untouched; and the nested form (`"monaco-editor": { "dompurify": … }`) also left them untouched while making `npm ls` report both as `invalid: "3.4.14"` — a permanently broken tree for no fix, which is why it was reverted. **The Security-tab "Open the update" button is a no-op too**: Dependabot ran update #1549666558 over exactly these packages minutes later and opened nothing. Only route: the two dependents widening their own pins — and that is not imminent, because at latest today `monaco-editor@0.56.0` still pins `3.4.8` exactly and `@a2ui/markdown-it@0.1.1` still pins `3.4.11` exactly (and `@a2ui/web_core` moving 0.10.5 → 0.10.7 under the existing override would still land markdown-it's exact pin). So: report the count, do not re-derive it'
    status: pending
  - id: uuid-copilotkit-pin
    content: "ACTIONABLE via § 4, not blocked — `apps/server/node_modules/uuid@10.0.0` is the vulnerable copy (alert 1, medium, `<11.1.1`) and `@copilotkit/runtime@1.64.2` pins `uuid: ^10.0.0`. Checked 2026-09-01: **`@copilotkit/runtime@1.70.0` declares `uuid: ^11.1.0`**, so that bump closes the alert with no override. It is not a drive-by: both manifests pin CopilotKit *exactly* and in couple (`apps/server` `@copilotkit/runtime` 1.64.2, `apps/web` `@copilotkit/runtime-client-gql` 1.64.2 — they move together), the root `overrides` hold `@ag-ui/client|core|encoder|proto` at 0.0.57 which the runtime's own AG-UI version must agree with, and this is the app's wire boundary. So: § 4 evidence, not § 2 — `npm run check` plus both corpus benches on `expectationMatch`, one PR for the pair, `verify:deps` after. Do not force a uuid major by override while waiting for it"
    status: pending
  - id: closed-2026-09-01
    content: 'DONE — #486 moved nanoid → 3.3.18 and @hono/node-server → 1.19.17 and closed alerts 28 (high) and 27 (medium); root dompurify went to 3.4.14 too. Queue is 8 → 6 alerts. Do not re-open those'
    status: completed
  - id: waiting-upstream
    content: 'OPEN — @ai-sdk/provider-utils (low) has no patched version yet (vulnerable `<= 3.0.97`). Not a queue that can move: count it, do not chase it'
    status: pending
  - id: no-dependabot-yml
    content: 'There is no .github/dependabot.yml in this repo: the schedule and the npm_and_yarn grouping live in account settings, which no agent can read and no PR can review. That is why 19 alerts opened 2026-08-22 produced one PR on 2026-08-30. Decide whether to commit one so the cadence is versioned (a config file is not a new dependency)'
    status: pending
  - id: first-run-pin-branch
    content: 'Live trigger is `trig_01Dk8ZwZCpXfXGREJyHnh9Up` — cron `30 4,16 * * *` UTC, claude-sonnet-5, env GCP Deployment, prompt stored verbatim. Created from the CLI: `claude -p "/schedule …"` creates, lists, updates and fires cron routines (it cannot delete one, cannot create API triggers/tokens, and needs a claude.ai subscription login). First run lands 2026-09-01 16:30Z — read its branch slug, pin it into `branchPrefix` (inert until then), and check it did not inherit MCP connections it does not need (Drive + Claude Code Remote came by default)'
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
