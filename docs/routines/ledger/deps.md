---
name: deps
todos:
  - id: dompurify-nested-pins
    content: 'BLOCKED, NOT AWAITING ANYONE — 4 dompurify alerts (3, 4, 5, 23) stay open because the vulnerable copies are exact-pinned by their dependents: @a2ui/markdown-it → `3.4.11`, monaco-editor → `3.4.8`. Measured 2026-09-01, three routes all fail: `npm update` cannot cross an exact pin; a root `overrides.dompurify = "3.4.14"` left both nodes untouched; and the nested form (`"monaco-editor": { "dompurify": … }`) also left them untouched while making `npm ls` report both as `invalid: "3.4.14"` — a permanently broken tree for no fix, which is why it was reverted. **The Security-tab "Open the update" button is a no-op too**: Dependabot ran update #1549666558 over exactly these packages minutes later and opened nothing. Only route: the two dependents widening their own pins — and that is not imminent, because at latest today `monaco-editor@0.56.0` still pins `3.4.8` exactly and `@a2ui/markdown-it@0.1.1` still pins `3.4.11` exactly (and `@a2ui/web_core` moving 0.10.5 → 0.10.7 under the existing override would still land markdown-it's exact pin). So: report the count, do not re-derive it'
    status: pending
  - id: uuid-copilotkit-pin
    content: "RECLASSIFIED 2026-09-01 (16:30Z firing) — the earlier '§ 4, not blocked' framing missed that landing `@copilotkit/runtime@1.70.0` means editing `apps/server/package.json` (and `apps/web`'s paired `@copilotkit/react-core` / `runtime-client-gql`), and CI runs `npm ci` (`.github/workflows/ci.yml`), which fails hard on any manifest/lockfile mismatch — so this cannot land as a working PR without also writing `package-lock.json`, which is unconditionally `ALWAYS_FORBIDDEN` in `scripts/routine-guard.mjs` for every routine, this one included. Confirmed still unfixed: `apps/server/node_modules/uuid` is still `10.0.0`, `apps/server/package.json` still pins `@copilotkit/runtime` at `1.64.2`. This is actually § 3b case 2 (patched version exists, no PR, nothing has run since) — the fix is a manifest constraint plus a resolved tree, which is exactly the shape this routine cannot author itself. Correct next step: count it in the digest's dependency-queue line and leave the Security-tab 'Open the update' click for the owner (page-bar #2 is the click, not this ledger row) — do not attempt a manifest-only edit again"
    status: pending
  - id: alert-read-permission-gap
    content: "NEW 2026-09-01 (16:30Z firing) — this session's GitHub token (`GH_TOKEN`/`GITHUB_TOKEN`) cannot read Dependabot alerts at all: `GET /repos/acuhlmann/mermaid-gen/dependabot/alerts` returns HTTP 403 `Resource not accessible by integration` (confirmed via direct REST call through the proxy, which reached GitHub and got a real permission denial, not a proxy block — contrast `secret-scanning/alerts`, which the proxy itself blocks with a different message). Meanwhile `issues` and `pulls` list endpoints return 200 fine, and there is no GitHub MCP tool exposed for Dependabot alerts either. So § 1 Gather and § 3b (the alert-without-a-PR classification, this routine's whole reason to exist per README rule) cannot run this firing or any future one until the GitHub App installation is granted 'Dependabot alerts: Read' permission — that is a page-bar #2 item (README rule 10, credentials/permissions), not something a routine or a Security-tab click can fix. Every alert-specific fact below (severities, counts, blocked/actionable classifications) is carried forward from a prior session that evidently did have alert access and is UNVERIFIED as of this firing. § 2 (PR merge queue) is unaffected — it only needs the PR list, which reads fine. One partial corroboration: `git push`'s own remote hook (not the blocked API) printed 'GitHub found 6 vulnerabilities on acuhlmann/mermaid-gen's default branch (3 moderate, 3 low)' for this push — a total of 6 matches the prior 'queue is 8 → 6' note, and 0 high/critical is good news, but the hook gives no package names or alert numbers, so it cannot resolve which specific alerts are still open"
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

| Date                | Queue                                           | Merged | Left open (cause + age) | Benches                                              | Notes                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------- | ----------------------------------------------- | ------ | ----------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-01 (16:30Z) | 0 open Dependabot PRs, 0 open PRs of any author | none   | none                    | not run — no PR touched a rendering/parse dependency | Alert reads are blocked (HTTP 403, `Resource not accessible by integration`) for this session's token; § 1/§ 3b could not run. Reclassified `uuid-copilotkit-pin` — it needs a `package-lock.json` write, which is always-forbidden, so it is a digest/page-bar item, not a PR this routine can land. See `alert-read-permission-gap` and `uuid-copilotkit-pin` todos. |
