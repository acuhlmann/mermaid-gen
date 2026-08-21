---
name: review
todos:
  - id: first-run
    content: 'First supervised run — confirm the 24h window resolves, both review axes report, the five benches run key-free, and the PR self-merges'
    status: completed
  - id: label-bootstrap
    content: 'Create the four missing triage labels (needs-triage, needs-info, ready-for-agent, ready-for-human) on first use — only wontfix exists today'
    status: completed
  - id: bench-variance
    content: 'Collect bench latency p95 across ~10 runs before deciding whether latency belongs in the ratchet'
    status: pending
---

# Ledger: `review`

Durable memory for the [`review`](../review.md) routine. Read the run log before filing anything —
a finding already reported is not a new finding.

## Locked

Owner decisions this routine must not re-litigate. Add a dated row rather than arguing with one.

| Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-08-20 | `review` **may fix one bug per run**, and a fix ships only with a test that fails without it — written first, observed red. A bug it cannot make a test fail for is filed, not fixed.                                                                                                                                                                                                                                                                        |
| 2026-08-20 | It opens a PR and **merges it itself** once CI is green. The PR is your reference, not a gate.                                                                                                                                                                                                                                                                                                                                                               |
| 2026-08-20 | Bench snapshots are **not** committed by this routine. `apps/server/bench-results/` is on the don't-touch list and a daily snapshot would bury the meaningful baselines.                                                                                                                                                                                                                                                                                     |
| 2026-08-20 | Latency is informational. Only an **expectation** drift — a case whose accept/reject flipped — earns an issue.                                                                                                                                                                                                                                                                                                                                               |
| 2026-08-21 | `issue_write`'s `labels` param **auto-creates** a missing label on first use (verified: `ready-for-agent` didn't exist, issue #348 created with it, label now exists). No separate bootstrap action needed — `needs-triage`/`needs-info`/`ready-for-human` will create themselves the first time a finding actually needs one.                                                                                                                               |
| 2026-08-21 | A pre-existing (not-from-this-window) doc/script bug found while executing the playbook's own steps (e.g. a broken bench command) is still in scope — "your own machinery is fair game" per this run's fire payload, and the review step that surfaces it (Benches) is itself part of the last-24h diff (PR #337 created `review.md`). Filed, not fixed (out of `allowedPaths` — `docs/routines/review.md` and `CLAUDE.md` are not in `review`'s allowlist). |

## Open observations

Things seen but not yet worth an issue. Promote to an issue when a second run confirms, or drop
when three runs pass without recurrence.

- **2026-08-21 — `officeLogStore.js` and `officeWorkingMemoryStore.js` duplicate the day-reconcile
  shape.** Both add a `loadedDay` var + `reconcileOfficeDay()` doing the same "clear on rollover"
  logic independently (Standards axis, Fowler "Duplicated Code"). Not fixed here — one bug per run,
  and this is a style judgement call, not the bug. Could move into `officeAmbienceStorage.js` if a
  future `improve` slice wants it.
- **2026-08-21 — `officeAmbienceStorage.js`'s `dayStampOf` is now a dead one-line wrapper** around
  the newly-exported `officeDayStamp`, with 5 call sites left unrenamed (Standards axis, Fowler
  "Middle Man"). Cosmetic.
- **2026-08-21 — `graphEditIdFromDescriptor` maps any `node_N`-shaped id to `~node:N` unconditionally**,
  not scoped to mindmap. Spec axis flagged it as a latent edge case (a flowchart node literally named
  `node_5`), not a reproduced bug — grep confirms flowchart/state edit code never emits `node_N`-shaped
  ids today. Watching, not filing.
- **2026-08-21 — a second known CI flake matched the "your own machinery" invitation.**
  `apps/server/test/anythingRuntimeBrowser.test.js` → "a browser that hangs on startup does not
  reject a valid page" went red under `npm run check` and again under `npm run precommit`
  (full-suite contention), green both times in isolation. This is the flake `improve` documented in
  `sensors.md` this same morning and already filed as issue #347 — not a regression from this run's
  fix, not duplicated here.

## Run log

Append one row per firing, including quiet runs.

| Date       | Commits reviewed                                                                                                                                 | Issues filed                                                                                  | Benches                                                                                                                                                                                                                       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-21 | `748c9c4..origin/main` (PR #337 NFR routines, PR #345 Cursor day-rollover + mindmap fix, PR #346 improve routine's first run) — 20 commits total | #348 (bug fixed this run, filed for record), #349 (benchMermaid.js documented command broken) | mermaid 87.5% accept (needs `--import ./scripts/register-antv-layout-esm.mjs --import tsx`, see #349), infographic 57.14%, chart 38.46%, metaphor 61.54%, anything 8/16 accepted — all five `expectationMatch: 100`, no drift | First supervised run. Fixed one bug: `officeWorkingMemoryStore.js`'s day-rollover write path (`rememberWorkingMemoryBeat`/`stampWorkingMemoryBoard`) dropped the beat that triggered the rollover, because `rowFor()` read/merged stale pre-rollover state before `persist()`'s `reconcileOfficeDay()` wiped it. Regression test added and observed red on unfixed code, green after. `npm run check` clean except the pre-existing, already-filed #347 flake (confirmed transient by isolated re-run). |
