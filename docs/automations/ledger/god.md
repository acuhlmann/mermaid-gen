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
- **Config:** repo variables `GOD_*` (defaults from `godBudget.ts`). `GOD_ENABLED=false` until the
  owner flips it from the God window (2c) or by hand.
- **Data branch:** `god-log` (orphan). Per-run JSON records; this ledger is for code-PR rows only.
- **Schedule:** `17 * * * *` UTC; gate window default `06-12` UTC. Off the night ladder on purpose.

## Baselines

Filled from the first sufficient brief after signals accumulate in `god-signals`.

## Run log

| Date (UTC) | Trigger | Verdict | Notes                                                                                                                                                                | PR  |
| ---------- | ------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 2026-10-15 | setup   | —       | Stage 2b lands: gate + brief hourly; act pipeline still later.                                                                                                       |     |
| 2026-10-15 | code    | —       | Observe act wired. Propose still does not open a PR.                                                                                                                 |     |
| 2026-10-15 | code    | —       | Propose opens a ready PR after postflight and check:affected. Ship does not merge.                                                                                   |     |
| 2026-10-16 | code    | —       | Brief learns: findings for all ten God metrics, recent-action deprioritisation, and `regressionSuspect` derived from god-log history (brief job now stages history). |     |

## Open observations

- Ship (`gh pr merge --auto`) is still later. Propose stops at an open PR.
- Owner window + `/api/god` is stage 2c.
- Live-ingest HMAC and GitHub App for settings/PR open are not created yet.
