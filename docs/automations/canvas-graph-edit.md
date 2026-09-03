---
name: canvas-graph-edit
tier: code-writing
schedule: '30 18 * * *'
maxFiles: 10
prTitlePrefix:
  - 'canvas graph edit:'
  - 'graph edit:'
branchPrefix:
  - claude/canvas-graph-edit
allowedPaths:
  - docs/automations/ledger/canvas-graph-edit.md
  - docs/canvas-graph-edit.md
  - docs/recipes/add-graph-edit-family.md
  - apps/web/src/utils/canvasGraphEdit.js
  - apps/web/src/utils/diagramGraphEditNodeResolve.js
  - apps/web/src/utils/mermaid*Edit.js
  - apps/web/src/utils/mermaidEdgeDisambiguation.js
  - apps/web/src/utils/mermaidSourceLocate.js
  - apps/web/src/utils/infographicGraphEdit.js
  - apps/web/src/utils/chartGraphEdit.js
  - apps/web/src/utils/metaphor*Edit.js
  - apps/web/src/components/metaphorScenes/MetaphorGraphEditBridge.jsx
  - apps/web/src/components/buildRadialActions.js
  - apps/web/src/utils/metaphorFlatItemsCore.js
  - apps/web/src/features/canvas/useFlowchartGraphEdit.js
  - apps/web/src/features/canvas/useCanvasGraphEdit.js
  - apps/web/test/*Edit.test.js
  - apps/web/test/*GraphEdit.test.js
  - apps/web/test/*GraphEdit.test.jsx
  - apps/web/test/canvasGraphEdit.test.js
  - apps/web/test/graphEditChrome.test.jsx
  - apps/web/test/useCanvasGraphEdit.test.jsx
  - apps/web/test/useFlowchartGraphEdit.test.jsx
  - apps/web/test/mermaidEdgeDisambiguation.test.js
  - apps/server/test/copilotRoute.test.js
  - packages/shared/src/diagramSchema.ts
forbiddenPaths:
  - apps/server/src/mcp/apps/**
  - apps/web/src/assets/**
---

# Feature automation: `canvas-graph-edit`

**Read [`docs/automations/README.md`](README.md) first — it carries the rules this playbook assumes.**

Extends and hardens **direct manipulation on the canvas**: the four verbs (Add, Delete, Rename,
Link) across every diagram family. One slice per run, then stop. Opens a PR and merges it when CI
is green.

`30 18 * * *` UTC (02:30 HKT) is the third rung of the night ladder — see
[`docs/routines/review.md`](../routines/review.md).

The contract, the family table and the trap list are [`docs/canvas-graph-edit.md`](../canvas-graph-edit.md);
the step-by-step is [`docs/recipes/add-graph-edit-family.md`](../recipes/add-graph-edit-family.md).
Neither is restated here.

## Two hard constraints, before anything else

**`DiagramCanvas.jsx` is not in this automation's paths, and that is deliberate.** It sits on the
ratchet at 1889 lines (down from 1968) and a new family must not grow it. Slice 1's hit-test and
connect-source resolvers were extracted to `diagramGraphEditNodeResolve.js` for exactly this
reason — extend that module. If a slice genuinely cannot be done without touching the canvas
component, file an issue and stop; that is an ADR-0005 split, which is `improve`'s queue item 7.

**There is no fifth verb.** Add, Delete, Rename, Link. Reparent, multi-select and drag-to-reorder
are not missing features — the recipe rules them out. A slice proposing one is out of contract.

## Queue

Take **one** slice. Read the last three ledger rows first.

### 1. The backlog, first

```bash
gh issue list --state open --json number,title,labels
```

Anything naming a graph-edit family, `docs/canvas-graph-edit.md`, or one of the mutators is this
automation's work tonight, ahead of everything below. #441 (the Mermaid ER row's unescaped `||--o{`
pipes splitting the markdown table) is the standing example: labelled `ready-for-agent` since
2026-08-29 and unreachable by the routine that reads the backlog.

### 2. `renameEdge` on the non-mermaid families

`renameCityEdge` in `metaphorCityEdit.js` is literally `return fail('not-graph')`, and garden,
chart and composite are the same. Only the mermaid families implement it, via `pickParallelEdgeRef`.
Metaphor `links[]` entries carry a `kind` (`METAPHOR_LINK_KINDS`: `flow` / `dependency` /
`ownership`) and a label, none of it reachable from the canvas — so a relation, which is the part
of a metaphor that carries most of the meaning, is the one thing a user cannot edit in place.

One family per slice, each with its refuse path.

### 3. `useFlowchartGraphEdit` → `useCanvasGraphEdit`

The name is leftover from slice 1 and the doc reserves the rename for a **dedicated cleanup, not a
family slice** — take it as a whole slice or not at all. `git mv` the hook and its test, update
every importer, leave behaviour untouched. Pure rename: if the diff shows a logic change, split it.

### 4. New mermaid families

`gantt` and `journey` are the cheapest remaining: both are flat ordered lists in the DSL, so they
are structurally the shipped `timeline`/`pie` mutators with a different row grammar and Link off.
`quadrantChart`, `gitGraph`, `sankey-beta`, `block-beta`, `requirement` and `xychart` all have rule
packs in `mermaidSyntaxGuard.js` and no adapter; each is a bigger slice.

### 5. Coverage of the seams the basename mirror cannot see

Four dispatch points are shared across families — `graphEditAdapterFor`,
`diagramGraphEditNodeResolve.js`, the hook, and `MetaphorGraphEditBridge.jsx` — plus two shared
helpers (`pickParallelEdgeRef` across flowchart/state/class/ER, and `findSequenceMessageRange`, a
**deliberately** separate third implementation). A break in a shared helper surfaces in a family
whose own test file was never selected.

`GRAPH_EDIT_BLAST_TESTS` in `scripts/test-affected-lib.mjs` exists because of this; the whole set
runs in ~6 s (`npx vitest run test/.*Edit --root apps/web`). Run it, not just the mirror.

## Do not "fix" these

They are decisions, and each has been re-litigated at least once:

- AntV `data-indexes` (root `"0"`, first child `"0,0"`) does **not** match `parseInfographicTree`'s
  path (first child `"0"`). Do not unify them.
- `findSequenceMessageRange` is a third implementation beside `pickParallelEdgeRef` on purpose. Do
  not fork a fourth, and do not merge it into the other two.
- `relation-network-*` is a star; extra `relations:` lines do nothing, so Link stays off.
- `origin: user` must survive on every patch, or undo and history collapse into the agent stream.
- `hierarchy-structure` is flat `items`, not `root`/`children` — the one hierarchy template that
  goes through the list mutator.

## Close

Append a ledger row: date, slice, family touched, the refuse paths added, test count before/after,
PR number. Rows for runs that changed nothing are still rows.

## Verification

```bash
npm run routine:guard -- --preflight canvas-graph-edit    # BEFORE starting
npm run precommit
npm run check
npm run routine:guard -- --postflight canvas-graph-edit   # BEFORE pushing
```

A new family also needs the wire check — `POST /user-edit` must accept the content type and reject
the others (`apps/server/test/copilotRoute.test.js`) — and the family table in
`docs/canvas-graph-edit.md` updated in the same PR. A producer-only diff is what
`npm run check:wire` exists to catch.
