---
name: metaphor3d
tier: code-writing
schedule: '0 15 * * *'
maxFiles: 10
maxIssues: 1
prTitlePrefix:
  - 'Metaphor3D:'
branchPrefix:
  - claude/gifted-davinci
allowedPaths:
  - docs/automations/ledger/metaphor3d.md
  - docs/agents/domains/metaphor3d.md
  - docs/guide/validation.md
  - docs/guide/metaphor-usda-mapping.md
  - packages/shared/src/metaphor*
  - packages/shared/test/metaphor*
  - apps/server/src/tools/metaphorDslTool.js
  - apps/server/src/agents/metaphor*
  - apps/server/src/prompts/metaphor*
  - apps/server/scripts/benchMetaphor.js
  - apps/server/test/metaphor*
  - apps/web/src/components/metaphorScenes/**
  - apps/web/src/components/MetaphorRenderer.jsx
  - apps/web/src/utils/metaphorLayouts/**
  - apps/web/src/utils/metaphor*
  - apps/web/src/utils/switchMetaphorKind.js
  - apps/web/test/metaphor*
  - apps/web/src/styles/**
forbiddenPaths:
  - apps/server/src/mcp/apps/**
  - apps/web/src/assets/**
  - apps/server/bench-results/**
---

# Feature automation: `metaphor3d`

**Read [`docs/automations/README.md`](README.md) first — it carries the rules this playbook assumes.**

Incrementally improves the **Metaphor3D** slot: DSL ladder, layouts, scene composition, camera
framing, label legibility, the fused composite, and the USDA mapping. One slice per run, then stop.
Opens a PR and merges it when CI is green.

`0 15 * * *` UTC (23:00 HKT) opens the night ladder — see [`docs/routines/review.md`](../routines/review.md)
for the full table. It runs first because it is the longest job (measured 48–118 min over ten runs)
and because `review` at `0 20` reads what it landed.

## Why this file exists

This automation ran unattended every night from 2026-08-18 and shipped a merged improvement on
almost all of them — the most productive job on either shelf. It also had **no playbook, no ledger,
no budget and no guard**, and its instructions lived only in the cron blob. That is the exact shape
[ADR-0014](../decisions/0014-autonomous-nfr-routines.md) was written to replace, and ADR-0014 named
this job by name as one of the two it had not yet replaced.

It also had nowhere to put what it learned, so twelve nights of durable findings went into the root
`CLAUDE.md` § Metaphor3D scene gotchas — 54 KB there and 27 KB more mirrored into `AGENTS.md`, both
loaded in full by every agent session in this repo before it did anything.

Findings now have two homes, and the distinction matters:

- **This run's story** — what was tried, what was measured, what was decided — goes in
  [`docs/automations/ledger/metaphor3d.md`](ledger/metaphor3d.md).
- **A rule a future agent would otherwise rediscover the hard way** goes in
  [`docs/agents/domains/metaphor3d.md`](../agents/domains/metaphor3d.md), as a short-form entry
  naming the file plus a Full-findings entry. That file is in this automation's `allowedPaths`.

Do **not** write either into the root `CLAUDE.md` / `AGENTS.md`. The domain file already reaches
Cursor (`.cursor/rules/metaphor3d.mdc`), Claude Code (nested `CLAUDE.md` in the scene and layout
directories) and everything else (the `AGENTS.md` domain index). See `docs/routines/README.md`
rule 8.

## 1. Preamble — run every night, before picking a slice

```bash
node apps/server/scripts/benchMetaphor.js --tag preamble
```

Read **`expectationMatch`**, not the accept rate. `acceptRate` is a property of the corpus — how
many fixtures are _meant_ to pass — and it falls as the corpus grows, because every fixture added
for a newly-caught failure is a must-reject case. A drop in `expectationMatch` is a real
regression; a drop in `acceptRate` may be a success.

The snapshot lands in `apps/server/bench-results/`, which is on the don't-touch list. **Read it and
delete it.** Never commit one.

Then run the fast inner loops — both are green, both are under eight seconds, and between them
they cover every pure module this automation touches:

```bash
npx vitest run test/metaphor --root apps/web        # ~34 files / 440 cases, 7.3 s
npm run test -w packages/shared -- metaphor
```

## 2. Queue

Take **one** slice. Read the last three ledger rows first and do not take the same area twice
running — this automation's failure mode is not idleness, it is polishing one corner.

### 1. Ladder and doc accuracy

The Metaphor3D validation ladder is real and complete — fence strip (`stripJsonCodeFence`) →
`sanitizeMetaphorDsl` (~40 rescue passes) → the Zod discriminated union → `metaphorSyntaxFixer.js`
→ agent repair turns bounded by `METAPHOR_REPAIR_MAX_ATTEMPTS` — and it is **the one slot missing
from `CLAUDE.md` § Validation ladder**, which documents the other five. An agent reading that file
concludes this slot has no gate.

Known drift to fix, all mechanical: `docs/guide/validation.md` § Metaphor3D lists **10 of the 15
kinds** (missing `bridge`, `cycle`, `subway`, `iceberg`, `composite`); `benchMetaphor.js`'s own
header says "~14 deterministic rescue passes" against ~40 in `metaphorSanitizer.ts`; the committed
bench baseline is from 2026-07-11 with 13 cases against ~17 in the script today.

### 2. Legibility and composition on small screens

The standing brief, and the source of nearly every finding already recorded: make each metaphor
express the user's topic more clearly, mobile and foldable first, with the 3D panels never
colliding with the app's own chrome. Camera framing, label placement and declutter, link
readability, group placards, the reading strip and the safe-area reservation.

**This work is decided by measurement, not by looking at the code.** See § 3.

### 3. The fused composite

The layer key, affinity groups, per-layer name ranking, `recedeTheme`, and the shared grouping
nouns that are the whole point of a composite. Two rules already paid for: recede by **colour**,
never opacity (three.js sorts transparent objects by centroid distance, which is the trap the
iceberg's opaque submerged blocks exist to avoid); and rank names **round-robin across layers**,
because world size is not one scale across grammars.

### 4. Sanitizer and schema coverage, driven by the bench

When the bench shows a class of source the sanitizer cannot rescue, add the rescue pass and a
fixture. Adding a metaphor **kind** is a ten-place change — the list is in
[`docs/agents/domains/metaphor3d.md`](../agents/domains/metaphor3d.md) — and is too big for one
slice; do not start one without filing an issue first.

### 5. USDA mapping

`metaphorUsda.ts` / `metaphorUsdaFields.ts`. Additive fields need
`METAPHOR_USDA_MAPPING_VERSION` bumped, the mapping doc updated, and the round-trip in
`metaphorUsda.test.ts` extended. Nothing here is verifiable by eye — it is all round-trip tests,
which makes it the right slice for a night when the browser is unavailable.

### 6. Link hit-testing, so the dead `renameEdge` adapters go live (#495)

City, layercake, galaxy, machine and terrain each implement `renameEdge`/`deleteEdge` against their
top-level `links[]`, are registered on the adapter, and are covered by tests — and nothing in the UI can
invoke them, because `MetaphorGraphEditBridge.jsx` only ever emits `kind: 'metaphor-item'` descriptors.
The shape is already decided, in #495's 2026-09-05 comment: `{ kind: 'edge', edgeFrom, edgeTo }`
carrying the two item ids in the `{from,to}` order `renameLinkedEdge`/`findLinkedEdge` already resolve
against, yielded by a raycast against the connector geometry a link wins **only when no item was hit**,
so an existing item tap never changes meaning. Do not invent an edge id; the pair is the identity,
because `connectCityNodes` already refuses a duplicate pair.

`apps/web/src/features/canvas/useFlowchartGraphEdit.js` needs **no change** — its edge path keys on
`descriptor.kind === 'edge'` and does not branch by family (`selectionKind` `:20`, `edgeFields` `:30`,
`deleteEdge` `:282`, `renameEdge` `:387`). That file is not in this automation's `allowedPaths`, which
is why #495 read like a cross-rung handoff when it is not: the whole change is scene work plus the
bridge, and both are here.

This is § 3 visual work. The evidence is a screenshot showing that the link highlighted is the link
under the cursor, at the three standing viewports, on a kind that actually has links — and § 3's "prove
the captured camera before trusting a number from it" applies with full force to a picking change,
where a wrong projection looks exactly like a working hit-test. That proof, not the size of the diff,
is what has kept this open since 2026-09-01.

## 3. Verifying visual work — the rule that makes this automation safe

**A change to anything under `metaphorScenes/`, `MetaphorRenderer.jsx` or a layout is not done
until it has been rendered and looked at.** [`apps/web/.claude/skills/verify/SKILL.md`](../../apps/web/.claude/skills/verify/SKILL.md)
is the recipe: standalone Vite on 5199, `playwright-core` against the preinstalled Chromium with
`--enable-unsafe-swiftshader`, a throwaway harness HTML + JSX at the `apps/web` root, **deleted
before commit**. Every durable finding in the domain file came out of a screenshot; not one came
out of reading the code.

Three things that catch a run out and do not look like failures:

- Two CDN fetches blank the whole R3F tree silently — drei `<Text>` resolves troika fonts inside a
  blob worker that bypasses `page.route`, and `<Environment preset>` fetches an `.hdr`. The skill
  carries the exact fulfil payloads. A blank canvas here is a harness bug, not a scene bug.
- **Prove the captured camera before trusting a number from it.** The label-legibility probe once
  projected every label at half its true screen position and reported a clean sweep of wins the
  screenshots did not show. Append DOM markers at the computed pixels and screenshot; if the
  markers are not sitting on the names, throw the run away.
- The throwaway harness files live in `apps/web/`, inside this automation's `allowedPaths`. They
  must not reach the PR. `routine:guard --postflight` counts them against `maxFiles` if they do,
  which is the intended stop.

**The PR body must carry the evidence**: which viewports were captured (the standing three are
390×844 phone, 717×512 foldable cover, 1440×900 desktop), what was measured, and the before/after
numbers. A claim like "more legible" with no measurement behind it is the thing `review`'s Spec
axis exists to catch the next night, and it will.

This is deliberately a _prose_ rule enforced by another agent rather than a path ban. Banning
`.jsx` would be mechanically enforceable and would also delete this automation's proven capability
— the scene files are where the visual work is, and it has been doing that work correctly, with
screenshots, for weeks.

## 4. Not this automation's job

No slot content, ever (ADR-0010): improving the renderer, the schema and the prompts is in scope;
writing a metaphor document into the `metaphor3d` slot is not. The corpus fixtures in
`benchMetaphor.js` are test data, not slot content.

No new dependencies. No `benchMetaphorGeneration.js` run — that harness does not exist yet, and
when it does it will cost tokens per run and belongs on a weekly cadence with `--samples 3`, never
in this nightly preamble.

## 5. Close

Append a ledger row: date, slice taken, what changed, the bench numbers from the preamble, the
viewports captured if the slice was visual, and the PR number. Rows for runs that changed nothing
are still rows.

## Verification

```bash
npm run routine:guard -- --preflight metaphor3d    # BEFORE starting
npm run precommit
npm run check
npm run routine:guard -- --postflight metaphor3d   # BEFORE pushing
```

`npm run build -w packages/shared` first if the slice touched `packages/shared/src/metaphor*` —
`@archislop/shared` resolves to `dist`, so an unbuilt change reads as `undefined` at runtime and
produces typecheck errors that look like unrelated breakage in `apps/server`.
