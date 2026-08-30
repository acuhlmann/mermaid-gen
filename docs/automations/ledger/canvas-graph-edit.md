# Ledger: `canvas-graph-edit`

Durable memory for the canvas graph-edit feature automation. Read the last three rows before
starting.

## Locked

| Date       | Decision                                                                                                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-30 | Playbook created. This work ran as an unversioned Cursor automation (`cursor/delivery-content-graph-editing-*`, `cursor/metaphor-*-graph-edit`, `cursor/infographic-chart-class-graph-edit`) from ~2026-08-22 and shipped all 28 families; its prompt was never in the repo.          |
| 2026-08-30 | **`DiagramCanvas.jsx` is out of `allowedPaths`.** It is on the ratchet at 1889 lines and a family slice must not grow it — extend `diagramGraphEditNodeResolve.js`, which was extracted from it for this reason (issue #363). A slice that cannot avoid the canvas files an issue.    |
| 2026-08-30 | **Four verbs, no fifth.** Reparent, multi-select and drag-to-reorder are ruled out by the recipe, not merely unimplemented.                                                                                                                                                           |
| 2026-08-30 | `useFlowchartGraphEdit` → `useCanvasGraphEdit` is a **dedicated cleanup slice**, never folded into a family slice. `docs/canvas-graph-edit.md` § Traps says so; it is a pure rename and mixing it with logic hides both.                                                              |
| 2026-08-30 | `GRAPH_EDIT_BLAST_TESTS` added to `scripts/test-affected-lib.mjs` the same day. Before it, editing one family's mutator selected that family's test and nothing else — and the 2026-08-28/29 colon-less-ER defect crossed the shared `pickParallelEdgeRef` seam between two families. |

## Run log

Append one row per firing, including quiet runs.

| Date | Slice | Family | Tests before → after | PR  | Notes |
| ---- | ----- | ------ | -------------------- | --- | ----- |

_No rows yet under this playbook. The 18 slices shipped between 2026-08-22 and 2026-08-30 predate
it; their record is the family table in `docs/canvas-graph-edit.md`, where all 28 are `shipped`._

## Todos

| Id                        | State   | Item                                                                                                                                                                                                                                 |
| ------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `issue-441-er-table`      | pending | #441 — `docs/canvas-graph-edit.md`'s Mermaid ER row has unescaped `\|\|--o{` pipes splitting the table. `ready-for-agent` since 2026-08-29, unreachable by `resolve` until its paths were widened the same day this playbook landed. |
| `rename-edge-non-mermaid` | pending | `renameEdge` is `fail('not-graph')` on city, garden, chart and composite. Metaphor link `kind` + label are unreachable from the canvas. One family per slice.                                                                        |
| `hook-rename`             | pending | `useFlowchartGraphEdit` → `useCanvasGraphEdit`, whole-slice, pure rename.                                                                                                                                                            |
| `gantt-journey`           | pending | Cheapest remaining families — flat ordered lists, structurally the shipped timeline/pie mutators.                                                                                                                                    |
| `composite-layer-add`     | pending | A composite can Add within a layer's `as` kind but cannot add or remove a layer. Bigger than one slice — file an issue first.                                                                                                        |

## Open observations

_(none yet)_
