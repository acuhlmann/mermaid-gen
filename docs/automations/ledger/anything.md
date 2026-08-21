---
name: anything
todos:
  - id: corpus-baseline
    content: 'Run benchAnything.js and record expectationMatch + rejection histogram in the first ledger row'
    status: pending
  - id: generation-smoke
    content: 'Run benchAnythingGeneration.js --samples 3 and record firstPassAcceptRate + failureKinds'
    status: pending
  - id: edit-tool-bench
    content: 'Generation bench does not exercise apply_anything_edit — extend harness when a run has budget'
    status: pending
  - id: visual-reject-eval
    content: 'Re-measure browser hard findings before ANYTHING_RUNTIME_VISUAL_REJECT=1 (validation.md item 2)'
    status: pending
  - id: runtime-warm-start
    content: 'Cold-start double-rung cost — one-off warm render per process (validation.md item 4)'
    status: pending
---

# Ledger: `anything`

Durable memory for the [`anything`](../anything.md) feature automation. One slice per run; push the
rest back into `todos`.

## Locked

| Date       | Decision                                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-21 | **Never write to a live session's anything slot.** This automation improves the repository gate and agent only (ADR-0010 scope).               |
| 2026-08-21 | **Never weaken a must-stay-rejected corpus case** to green a bench. Fix the gate or the fixture, not the expectation.                          |
| 2026-08-21 | **Generation bench needs `--samples 3` minimum** for any baseline recorded here. One sample is a smoke test, not a measurement.                |
| 2026-08-21 | **Schedule is 01:00 GMT+8** (`0 17 * * *` UTC). Do not move without checking stagger against Metaphor3D (20:00 UTC) and `resolve` (03:00 UTC). |

## Run log

| Date | Slice taken | PR  | Bench verdict | Notes |
| ---- | ----------- | --- | ------------- | ----- |
|      |             |     |               |       |
