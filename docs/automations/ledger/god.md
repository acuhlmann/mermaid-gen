---
name: god
todos: []
---

# Ledger: `god`

## Locked

- **ADR:** [0019-archislop-god.md](../../decisions/0019-archislop-god.md) — accepted 2026-10-14.
- **Host:** GitHub Actions (`.github/workflows/god.yml`), environment `god`.
- **Harness:** DeepSeek Harness (`dsh`), pins in `scripts/god/dsh/versions.json`. Spike GO on
  2026-10-14 (~$0.02, all 14 checks).
- **Signals:** `agent_turn` + `ux_signal` → Cloud Logging bucket `god-signals` (30 days). Reader SA
  `god-observer@[REDACTED].iam.gserviceaccount.com` (viewAccessor on that bucket only; WIF scoped to
  `acuhlmann/mermaid-gen`).
- **Config:** repo variables `GOD_*` (defaults from `godBudget.ts`). `GOD_ENABLED=true` since the
  owner flipped it by hand (the 2c God window is what makes it self-service); `GOD_AUTONOMY=propose`,
  `GOD_EVERY_HOURS=24`, `GOD_WINDOW_UTC=06-12`, `GOD_MAX_USD_PER_RUN=1`, `GOD_MAX_USD_PER_MONTH=20`.
- **Data branch:** `god-log` (orphan). Per-run JSON records; this ledger is for code-PR rows only.
- **Schedule:** `17 * * * *` UTC; gate window default `06-12` UTC. Off the night ladder on purpose.

## Baselines

Filled from the first sufficient brief after signals accumulate in `god-signals`.

## Run log

| Date (UTC) | Trigger | Verdict | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | PR  |
| ---------- | ------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 2026-10-15 | setup   | —       | Stage 2b lands: gate + brief hourly; act pipeline still later.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |     |
| 2026-10-15 | code    | —       | Observe act wired. Propose still does not open a PR.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |     |
| 2026-10-15 | code    | —       | Propose opens a ready PR after postflight and check:affected. Ship does not merge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |     |
| 2026-10-16 | code    | —       | Brief learns: findings for all ten God metrics, recent-action deprioritisation, and `regressionSuspect` derived from god-log history (brief job now stages history).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |     |
| 2026-10-17 | code    | —       | Money rails fixed: cadence and monthly spend now derive from `runs/*.json`, and the tick→branch merge moved out of the workflow heredoc into a tested `mergeGodLogTick`. The `cp`-before-merge order had rewritten `index/2026-10.json` to a single row every tick (52 run records, 1 index row), so `GOD_MAX_USD_PER_MONTH` and `GOD_EVERY_HOURS` would have read a one-run history the first time God spent.                                                                                                                                                                                                                                                                                                                                                             |     |
| 2026-10-17 | code    | —       | Idle God is now self-explanatory: each run record carries `reason` (an enum spanning the gate's and `decideAct`'s vocabularies, so no loose string can reach a prompt) and `digest` (the brief's five counts plus `sufficient`). Both are `.optional()` — a required field would have made `loadRunRecords` drop all 52 pre-existing records. `recordTick.test.mjs` scans both producers and fails on an unlisted reason literal.                                                                                                                                                                                                                                                                                                                                          |     |
| 2026-10-17 | code    | —       | Stage 2c, read half: `GET /api/god/status` (`apps/server/src/god/godLogView.ts`, `routes/godStatus.ts`) serves the month rollup to the owner. Credential-free because the repo and `god-log` are public; reports only what a tick recorded, never a recomputed gate decision (Actions variables are unreadable from the server, so recomputing would lie). The rollup row is now schema-pinned (`GodRollupRowSchema`, validated on write in `recordTick.mjs`) and carries the full `digest`; the view itself joined the frozen rails so God cannot edit the panel showing its own spend.                                                                                                                                                                                   |     |
| 2026-10-17 | code    | —       | The observe contract now records **which** of its three outcomes happened (`narration`: `finding` / `waiting` / `dropped`), so an act that billed, completed and named nothing is no longer indistinguishable from one that correctly waited. Only a `completed` run owes the contract an answer — a crashed harness leaves the field absent rather than booking its cost against silence. `monthTotals` adds `unproductiveActs`/`unproductiveUsd`, **omitted rather than zeroed** when the month's acts predate the field (every month on the branch today, October included). While writing the test I asserted that `finalizeActRecord` drops the finding when a patch lands; it does not, and no doc claims it does — the belief was mine, corrected against the code. |     |

## Open observations

- **No scheduled tick has ever acted, and the reason is measured, not suspected.** Every hourly tick
  is `noop`. Inside the 06-12 UTC window the gate goes `go=true reason=go`; the live brief builds (no
  fixture fallback) on 2 agent turns and 3 ux signals against a floor of 30 new signals
  (`GOD_HARD_LIMITS.minNewSignals`), so the act decision returns `insufficient`. A per-slot finding
  needs 20 turns of one slot (`MIN_SAMPLE_FOR_FINDING`) on top of that. Nothing is broken: the rails
  work and the tank is empty. Traffic is the only thing that unblocks this, and lowering the floor is
  a documented owner decision rather than a bug fix.
- **Correction, same day: no _scheduled_ tick has ever acted, but one tick did act.** Re-reading the
  whole branch (not the last 25 records) found `38759172829`: `trigger: manual`, `tier: observe`,
  harness `dsh 0.2.0-rc.2`, 16 s, **$0.018813**, `verdict: observed`, and `findingId` and `hypothesis`
  both null. So October is 54 records — 53 `noop` plus that one act. Two things follow: the rung can
  reach the harness when the owner dispatches it, and the one time it did, it billed and completed
  without naming a finding. The observe narration contract accepted nothing, and nothing downstream
  noticed. That gap is the next candidate, not the signal floor.
- **The month rollup's lost rows are no longer harmless, and are now repaired at read time.**
  `index/2026-10.json` still carries one row while `runs/` holds 54 records, and the owner status view
  reads that file. The fold therefore stamps the true month totals (`ticks`, `acts`, `monthSpendUsd`,
  `lastActAt`) onto it from the records, and the view reports `numbersFrom: records` — so a truncated
  month can no longer be presented as a small one, including its spend.
- Ship (`gh pr merge --auto`) is still later. Propose stops at an open PR.
- Stage 2c is half shipped: `GET /api/god/status` is read-only. The window UI, settings writes (needs
  the narrow Actions token) and live ingest (needs its HMAC secret) are still open.
- Live-ingest HMAC and GitHub App for settings/PR open are not created yet.
