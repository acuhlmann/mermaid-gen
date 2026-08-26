---
name: anything
tier: code-writing
schedule: '0 1 * * *'
timezone: Asia/Hong_Kong
maxFiles: 12
allowedPaths:
  - docs/automations/ledger/anything.md
  - apps/server/src/agents/anything*
  - apps/server/src/prompts/anything*
  - apps/server/src/tools/anything*
  - apps/server/scripts/benchAnything*
  - apps/server/test/anything*
  - packages/shared/src/anything*
  - packages/shared/test/anything*
  - apps/web/src/components/AnythingRenderer.jsx
  - apps/web/src/utils/anything*
  - apps/web/test/anything*
forbiddenPaths:
  - apps/server/src/mcp/apps/**
  - apps/web/src/assets/**
  - apps/server/bench-results/**
---

# Feature automation: `anything`

**Read [`docs/automations/README.md`](README.md) first — it carries the rules this playbook assumes.**

Incrementally improves the **Anything** slot: validation ladder, prompts, benches, and renderer.
One slice per run, then stop. Opens a PR and merges it when CI is green.

`0 1 * * *` at **GMT+8** (01:00 Hong Kong) — `0 17 * * *` UTC the previous calendar day. Sits
between the Metaphor3D routine (20:00 UTC) and the NFR `resolve` routine (03:00 UTC / 11:00 HKT).

Take the **highest unfinished queue item that fits the budget**. Push the rest back into the
ledger's `todos`.

## Queue

Work top to bottom. Skip an item only when it genuinely does not fit today's budget — record why
in the ledger and take the next one.

### 1. Corpus bench health

```bash
node apps/server/scripts/benchAnything.js --tag auto-$(date +%F)
```

- **`expectationMatch` must stay 100.** A case whose accept/reject flipped is either a real
  regression or a deliberate gate change — fix or update the corpus with a written reason in the PR.
- Do **not** commit snapshots to `apps/server/bench-results/` (don't-touch list). The run tag is
  for the ledger row only.
- Read `acceptRate` only beside `expectationMatch` — it is a property of the corpus, not quality.

### 2. Attack the top rejection code

Read the ledger's last generation-bench row (if any) or run a **smoke** generation bench when the
queue has no recent numbers and a backend resolves:

```bash
node --import ./scripts/register-antv-layout-esm.mjs --import tsx \
  apps/server/scripts/benchAnythingGeneration.js --tag auto-$(date +%F) --samples 3
```

Pick the **largest histogram bucket** that is a fixable gate or prompt issue — not `transport`.
Before changing a prompt, **print the offending document** (the bench records codes and sizes, not
the HTML). The `external_url` / namespace-string lesson in
[`docs/guide/validation.md`](../guide/validation.md) is the template: fix the lint, not the model,
when the page was doing the right thing.

Ship the smallest fix: policy lint, quality lint, prompt rule, or corpus case. One code class per
run.

### 3. Corpus expansion

Add one hand-written fixture to `apps/server/scripts/benchAnythingCorpus.js` when a generation-bench
failure is **reproducible without the model** — a static HTML document that should pass or must
stay rejected. Re-run `benchAnything.js` and confirm `expectationMatch: 100`.

Follow the existing `kind` taxonomy: `valid`, `policy`, `quality`, `runtime`, `shape`.

### 4. Generation corpus expansion

Add one prompt to `apps/server/scripts/benchAnythingGenerationCorpus.js` when repeated user-shaped
asks fail first-pass for a reason no existing family covers. Keep prompts short — measure the
agent, not the corpus author.

Prefer families that stress blind spots: `canvas` and `layout` (jsdom cannot see blank canvases or
collapsed layout). See the file header for the full family list.

### 5. ~~Edit-tool coverage~~ — shipped (#359)

The refine case (`refine-add-control` in `benchAnythingGenerationCorpus.js`) routes through
`applyTransformIntent` with `transformMode: 'barker'` and reports `editToolUsed` /
`editToolRate` in the generation bench summary. Do not revert refine cases to `applyIntent`
(mode `go`). Extend with **additional** transform families (Gilfoyle, Fix) only when bench
evidence shows a class of scoped-edit failures the Barker arm does not cover.

### 6. Prompt and design-guide craft

Tune `apps/server/src/prompts/anythingSystemPrompt.js`, `anythingDesignGuide.js`, or
`anythingSyntaxGuard.js` when bench evidence shows a **class** of failures, not a one-off. Read
[`docs/recipes/add-anything-lib.md`](../recipes/add-anything-lib.md) before touching the allowlist.
When the top rejection code is `runtime_error`, check whether the page was doing the right thing
and the fix belongs in the design guide (null DOM guards, `getTotalLength` on geometry elements
only, d3 selection chaining, d3 `forceLink` node ids, d3 drag handler order / TDZ, Matter
`body.isSleeping` vs `Matter.Sleeping.isSleeping`, standalone KPI formatters rather than
`k.fmt` on data rows, no top-level `await` in classic scripts) before tightening policy lint.
Corpus fixtures must reject under **both** browser and jsdom engines — a jsdom-only expectation
is a drift trap ([#393](https://github.com/acuhlmann/mermaid-gen/issues/393)).

A prompt change that might shift model behaviour should be justified by corpus or generation-bench
numbers in the PR body — not by intuition alone.

### 7. Runtime rung hardening

Improve `apps/server/src/tools/anythingRuntimeCheck.js`, `anythingRuntimeBrowser.js`, or
`anythingRuntimeProbe.js` when the corpus bench shows a runtime false negative/positive. Both
engines must stay on the **same** `anythingRuntimeCheck.test.js` suite — identity is what stops
them drifting.

Do not enable `ANYTHING_RUNTIME_VISUAL_REJECT` in production without a generation bench at
`--samples 3` or more showing repair converges on the new rejections.

### 8. Renderer and client sandbox

`apps/web/src/components/AnythingRenderer.jsx` and `apps/web/src/utils/anything*` when the bug is
**client-side** (sandbox, `wrapAnythingSrcDoc`, lib expansion, postMessage error bridge). Verify
with `apps/web/test/anything*` — UI proof needs the scoped skill under
`apps/web/.claude/skills/verify/` when the change is visual.

## Not this automation's job

- **No new npm dependencies** or allowlisted libraries without an issue and ADR-0008 review.
- **No scheduled token spend** on `--samples` greater than 3 unless the queue item names a baseline
  comparison and a backend is confirmed.
- **No NFR work** — register drift, ratchet, locale parity, and office-floor tests belong to
  [`docs/routines/`](../routines/).
- **No hub splits** of unrelated monoliths. Touch only anything blast-radius paths.

## Verification

```bash
npm run routine:guard -- --preflight anything
npm run precommit
git add -A
npm run check
npm run routine:guard -- --postflight anything
```

Anything server tests are slow (child-process runtime). When the diff is anything-only,
`npm run test:affected` is enough for a pre-push loop; run full `npm run check` before merge.
