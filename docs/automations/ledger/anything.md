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

| Date       | Slice taken                         | PR   | Bench verdict                                                                 | Notes                                                                                                                                                           |
| ---------- | ----------------------------------- | ---- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-24 | Design guide: d3 forceLink node ids | #397 | corpus `expectationMatch` 100 (26 cases); gen first-pass 86.11% (36 runs)     | Top code `runtime_error` (7): 6× d3 "node not found" on lib-d3-network. Rule for .id() + matching link endpoints; corpus `runtime-d3-force-link-mismatch`.      |
| 2026-08-23 | Prompt: runtime-safe JS craft rules | #386 | corpus `expectationMatch` 100 (25 cases); gen first-pass 86.11% (36 runs)     | Top code `runtime_error` (4). Design-guide rules for null DOM queries, getTotalLength-on-path-only, d3 selection chaining; corpus `runtime-svg-gettotallength`. |
| 2026-08-22 | Policy: JS iframe lint              | #372 | corpus `expectationMatch` 100 (24 cases); gen first-pass 80.56% (36 runs)     | Caught `createElement('iframe')` + `contentWindow` as `embedded_browsing` before runtime; corpus `policy-js-iframe-create`. Prompt rule.                        |
| 2026-08-21 | Edit-tool bench wiring              | #359 | corpus `expectationMatch` 100; gen first-pass 97.22% (36 runs, `--samples 3`) | Routed `refine-add-control` through `applyTransformIntent` (`barker`); smoke `editToolRate` 100% (1/1). Summary adds `editTool` block.                          |
