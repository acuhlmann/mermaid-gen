---
name: anything
todos:
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

| Date       | Decision                                                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-08-21 | **Never write to a live session's anything slot.** This automation improves the repository gate and agent only (ADR-0010 scope).                                                                                                     |
| 2026-08-21 | **Never weaken a must-stay-rejected corpus case** to green a bench. Fix the gate or the fixture, not the expectation.                                                                                                                |
| 2026-08-21 | **Generation bench needs `--samples 3` minimum** for any baseline recorded here. One sample is a smoke test, not a measurement.                                                                                                      |
| 2026-08-21 | **Schedule is 01:00 GMT+8** (`0 17 * * *` UTC). Do not move without checking stagger against Metaphor3D (20:00 UTC) and `resolve` (03:00 UTC).                                                                                       |
| 2026-08-21 | **Cursor automation** [ca0aeb36-9d76-11f1-a7d1-d6b4613131ce](https://cursor.com/automations/ca0aeb36-9d76-11f1-a7d1-d6b4613131ce). Loader prompt is the contract template in [`README.md`](../README.md).                            |
| 2026-08-21 | **Refine cases use `transformMode` + `applyTransformIntent`.** The measured turn passes `prompt` as `advisorPrompt` and reports `editTool` in the generation bench summary. Do not revert refine cases to `applyIntent` (mode `go`). |

## Run log

| Date       | Slice taken            | PR  | Bench verdict                                                                 | Notes                                                                                                                                  |
| ---------- | ---------------------- | --- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-21 | Edit-tool bench wiring |     | corpus `expectationMatch` 100; gen first-pass 97.22% (36 runs, `--samples 3`) | Routed `refine-add-control` through `applyTransformIntent` (`barker`); smoke `editToolRate` 100% (1/1). Summary adds `editTool` block. |
