---
name: review
todos:
  - id: first-run
    content: 'First supervised run — confirm the 24h window resolves, both review axes report, and the five benches run key-free'
    status: pending
  - id: label-bootstrap
    content: 'Create the four missing triage labels (needs-triage, needs-info, ready-for-agent, ready-for-human) on first use — only wontfix exists today'
    status: pending
  - id: bench-variance
    content: 'Collect bench latency p95 across ~10 runs before deciding whether latency belongs in the ratchet'
    status: pending
---

# Ledger: `review`

Durable memory for the [`review`](../review.md) routine. Read the run log before filing anything —
a finding already reported is not a new finding.

## Locked

Owner decisions this routine must not re-litigate. Add a dated row rather than arguing with one.

| Date       | Decision                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-08-20 | `review` is **report-only**. It files issues and never opens a code PR. A finding it wants to fix is an issue, not a promotion to a writing tier.                        |
| 2026-08-20 | Bench snapshots are **not** committed by this routine. `apps/server/bench-results/` is on the don't-touch list and a daily snapshot would bury the meaningful baselines. |
| 2026-08-20 | Latency is informational. Only an **expectation** drift — a case whose accept/reject flipped — earns an issue.                                                           |

## Open observations

Things seen but not yet worth an issue. Promote to an issue when a second run confirms, or drop
when three runs pass without recurrence.

_(none yet)_

## Run log

Append one row per firing, including quiet runs.

| Date                | Commits reviewed | Issues filed | Benches | Notes |
| ------------------- | ---------------- | ------------ | ------- | ----- |
| _pending first run_ | —                | —            | —       | —     |
