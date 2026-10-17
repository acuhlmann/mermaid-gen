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

| Date (UTC) | Trigger | Verdict | Notes                                                                                                                                                                                                                                                                                                                                                                                                                             | PR  |
| ---------- | ------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 2026-10-15 | setup   | —       | Stage 2b lands: gate + brief hourly; act pipeline still later.                                                                                                                                                                                                                                                                                                                                                                    |     |
| 2026-10-15 | code    | —       | Observe act wired. Propose still does not open a PR.                                                                                                                                                                                                                                                                                                                                                                              |     |
| 2026-10-15 | code    | —       | Propose opens a ready PR after postflight and check:affected. Ship does not merge.                                                                                                                                                                                                                                                                                                                                                |     |
| 2026-10-16 | code    | —       | Brief learns: findings for all ten God metrics, recent-action deprioritisation, and `regressionSuspect` derived from god-log history (brief job now stages history).                                                                                                                                                                                                                                                              |     |
| 2026-10-17 | code    | —       | Money rails fixed: cadence and monthly spend now derive from `runs/*.json`, and the tick→branch merge moved out of the workflow heredoc into a tested `mergeGodLogTick`. The `cp`-before-merge order had rewritten `index/2026-10.json` to a single row every tick (52 run records, 1 index row), so `GOD_MAX_USD_PER_MONTH` and `GOD_EVERY_HOURS` would have read a one-run history the first time God spent.                    |     |
| 2026-10-17 | code    | —       | Idle God is now self-explanatory: each run record carries `reason` (an enum spanning the gate's and `decideAct`'s vocabularies, so no loose string can reach a prompt) and `digest` (the brief's five counts plus `sufficient`). Both are `.optional()` — a required field would have made `loadRunRecords` drop all 52 pre-existing records. `recordTick.test.mjs` scans both producers and fails on an unlisted reason literal. |     |

## Open observations

- **God has never acted, and the reason is measured, not suspected.** 52 hourly ticks, every one
  `noop`. Inside the 06–12 UTC window the gate goes `go=true reason=go`; the live brief builds (no
  fixture fallback) on `agentTurns: 2` / `uxSignals: 3` against `sufficient = agentTurns + uxSignals
  > = 30` (`GOD_HARD_LIMITS.minNewSignals`), so `decideAct`returns`insufficient`. A per-slot finding
needs `MIN_SAMPLE_FOR_FINDING = 20` turns on top of that. Nothing is broken — the rails work and
  > the tank is empty. Traffic is the only thing that unblocks this; do not "fix" it by lowering a bar.
- **The month rollup lost its rows and is now harmless.** `index/2026-10.json` only ever carried the
  last tick before this fix. Nothing reads it for money or cadence anymore, so don't spend a run
  rebuilding it — the per-tick gate reason still lives in each workflow's step summary.
- Ship (`gh pr merge --auto`) is still later. Propose stops at an open PR.
- Owner window + `/api/god` is stage 2c.
- Live-ingest HMAC and GitHub App for settings/PR open are not created yet.
