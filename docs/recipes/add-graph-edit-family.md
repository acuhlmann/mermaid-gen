# Recipe: add a canvas graph-edit family

Use when a rendered graph should grow **Add / Delete / Rename / Link** without a prompt. The verbs already exist; a family is a (content type, layout/kind) pair with one node identity and one mutator.

Read [`docs/canvas-graph-edit.md`](../canvas-graph-edit.md) first — families, verbs, identity traps, and the slice order live there. This recipe is the file-by-file order for one slice.

Do **not** add a second hook, a second chrome, or a fifth verb name. Families that cannot Link set `canLink: false`.

## Preconditions

- The layout is a node graph (or a tree whose parentage is the edge). Lists/sequences can share Add/Delete/Rename with `canLink: false`. Free HTML (`anything`) and A2UI (`forms`) are out of scope.
- You know the **hit identity** the renderer stamps (mermaid node id, AntV `data-indexes`, mesh `userData.id`). Edits must use that identity, not a parallel highlighter path.
- One family per change. Skip a slice rather than stretching a mutator across two identities.

## Steps (order matters)

1. **Mutator** — add `apps/web/src/utils/<family>GraphEdit.js` (or extend the existing infographic/mermaid module if the source shape is the same). Export `is<Family>Source`, the four verbs, and any `canLink` predicate. Return `{ ok, source, newId?, newLabel? }` or `{ ok: false, reason }`. Refuse paths need a stable `reason` (`root`, `no-link`, `missing`, `duplicate`, `self`, `empty`, `not-graph`).
2. **Mutator tests** — `apps/web/test/<family>GraphEdit.test.js`. Cover add, delete, rename, at least one refuse path, and (if Link exists) connect + duplicate. For infographic, run `@antv/infographic` `parseSyntax` on mutated DSL when the compiler is the cheap check.
3. **Adapter row** — `apps/web/src/utils/canvasGraphEdit.js` `graphEditAdapterFor`. Map `contentType` + source sniff onto `{ contentType, canLink, addLinked, connect, deleteNode, deleteEdge, renameNode, renameEdge }`. Extend `graphEditIdFromDescriptor` only when the renderer uses a new hit key.
4. **Hook** — `useFlowchartGraphEdit` already dispatches through the adapter. Add a `nextSelection` branch only if the post-Add descriptor is not a mermaid node. Do not fork the hook; rename it to `useCanvasGraphEdit` in a dedicated cleanup, not in a family slice.
5. **Radial** — `buildRadialActions.jsx` already hides Link when `canLink === false`. Add a test in `buildRadialActions.test.jsx` only if you change visibility rules.
6. **Canvas identity** — if the renderer stamps a new attribute, teach `DiagramCanvas.jsx` (connect highlight + click targeting) and the renderer to re-select after remount. AntV wipes the DOM on every source change; mermaid keeps node ids.
7. **`POST /user-edit` allowlist** — `handleUserDiagramEdit` in `apps/server/src/routes/copilot.ts`. Add the content type only when this is the first family for that slot. Update the `UserDiagramEditSchema` comment in `packages/shared/src/diagramSchema.ts`. Reject still-unsupported types with 400. Add cases in `apps/server/test/copilotRoute.test.js` (apply + reject).
8. **Hook / wire tests** — drive `useFlowchartGraphEdit` with the new `contentMode` (`useFlowchartGraphEdit.test.jsx`) and assert `applyUserDiagramEdit` sees the mutated source and the right `contentType`.
9. **Plan table** — mark the family **shipped** in [`docs/canvas-graph-edit.md`](../canvas-graph-edit.md). Mention any new identity trap in that doc's Traps section, not only in the mutator comment.
10. **Human pointers** — if this is a new content type on the route, update [`docs/guide/api-endpoints.md`](../guide/api-endpoints.md), [`docs/guide/product.md`](../guide/product.md) canvas row, and [`docs/guide/agents.md`](../guide/agents.md) interaction flow. `STRUCTURE.md` if you added a mutator file.

## Files you'll touch

- `apps/web/src/utils/<family>GraphEdit.js` + `apps/web/test/<family>GraphEdit.test.js`
- `apps/web/src/utils/canvasGraphEdit.js`
- `apps/web/src/features/canvas/useFlowchartGraphEdit.js` (only for a new selection descriptor)
- `apps/web/src/components/DiagramCanvas.jsx` / the slot renderer (only for a new hit key)
- `apps/server/src/routes/copilot.ts` + `apps/server/test/copilotRoute.test.js` (only for a new content type)
- `packages/shared/src/diagramSchema.ts` (comment on `UserDiagramEditSchema`)
- `docs/canvas-graph-edit.md`

## Don't forget

- Keep `origin: user` on the patch. Canvas edits must not go through the agent stream or Monaco debounce.
- `canLink: false` is how a tree or star says "Add is a child/spoke, not a free edge." Do not invent Connect-as-child as a fifth radial id — Add already does that (`connect` without `linkMode`).
- Infographic hierarchy indexes are AntV's (`"0"` = root, `"0,0"` = first child). Do not route edits through `parseInfographicTree` in shared — that path numbers the first child as `"0"`.
- Infographic `user-edit` still runs `sanitizeInfographicDsl`. A star with generic spoke labels can still be rewritten into a hierarchy-tree; pick labels that do not look like default spokes when asserting network round-trip through the route.
- After shared-schema comment-only changes you do not need `npm run build -w packages/shared`. After a real export change, you do.
- Verify with `npm run test:affected` (or the web + server files above) and `npm run precommit` before commit.
