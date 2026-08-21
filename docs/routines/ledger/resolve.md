---
name: resolve
todos:
  - id: first-run
    content: 'First supervised run — confirm the backlog read works, one issue gets picked, the escalation path (open PR, no merge, ready-for-human relabel) is exercised at least once across the first few runs, and the merge path is exercised at least once too'
    status: pending
  - id: label-dependency
    content: 'ready-for-agent / needs-triage / needs-info / ready-for-human must exist as real GitHub labels before this routine can filter on them — review.md ledger flagged the same gap and it may still be open; confirm on first run'
    status: pending
---

# Ledger: `resolve`

Durable memory for the [`resolve`](../resolve.md) routine. Read the run log and the escalation
counts before picking an issue — one already escalated twice with no human action is not a fresh
pick, and a finding already attempted is not attempted again from scratch.

## Locked

Owner decisions this routine must not re-litigate. Add a dated row rather than arguing with one.

| Date       | Decision                                                                                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-21 | `resolve` exists to work down the backlog `review`/`improve` file, not to replace their one-bug-per-run confidence bar — it applies the same bar per issue.                                                                              |
| 2026-08-21 | Merging is the default outcome; **escalation (open PR, don't merge, relabel `ready-for-human`) is for genuine uncertainty or risk, not a routine hedge.** Escalating everything defeats the point as surely as merging everything would. |
| 2026-08-21 | `needs-triage` issues are only attempted when they're already effectively scoped despite the label; a genuinely underspecified report gets a `needs-info` comment, not a guess.                                                          |

## Open observations

Things seen but not yet worth a locked decision. Promote to `Locked` when a second run confirms.

_(none yet)_

## Run log

Append one row per firing, including quiet runs (empty backlog).

| Date                | Issue picked | Outcome | PR  | Notes |
| ------------------- | ------------ | ------- | --- | ----- |
| _pending first run_ | —            | —       | —   | —     |
