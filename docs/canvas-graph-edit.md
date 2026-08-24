# Canvas graph edit

Point-and-click **Add / Delete / Rename / Link** on a rendered graph, without a prompt. The verbs land as `origin: user` patches through [`POST /api/copilotkit/user-edit`](guide/api-endpoints.md) and sit in the same undo/history as agent patches.

This is **not** a second editor. The source of truth stays the slot's DSL. The canvas only names a node (or two) and a verb; a pure mutator rewrites the text.

## Who owns what

| Layer                                                                 | Owns                                                                     | Does not own           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------- |
| Canvas (`DiagramCanvas`)                                              | Wires selection/hover to the resolvers below, connect-mode highlight     | DSL shape              |
| `diagramGraphEditNodeResolve.js`                                      | Per-family DOM node lookup by logical id / `data-indexes` / mermaid `id` | Rendering, mutation    |
| Radial + `GraphEditChrome`                                            | The four verbs + inline rename + undo toast                              | Per-family rules       |
| `useFlowchartGraphEdit`                                               | Session: connect mode, pending rename, apply + toast                     | Which mutator to call  |
| `canvasGraphEdit.js`                                                  | Adapter lookup (`graphEditAdapterFor`)                                   | Rendering              |
| Family mutator (`mermaidFlowchartEdit.js`, `infographicGraphEdit.js`) | Parse → mutate → serialize                                               | HTTP                   |
| `POST /user-edit`                                                     | Slot apply + sanitizer + revision                                        | Family-specific syntax |

A new family is a mutator module + an adapter row. Do not grow a second hook or a second chrome.

## Families

A **family** is a (content type, layout/kind) pair that shares one node identity and one set of verbs.

| Family                        | Content type | How you recognise it                                    | Node identity                                      | Add                          | Delete                                  | Rename       | Link                                               | Status      |
| ----------------------------- | ------------ | ------------------------------------------------------- | -------------------------------------------------- | ---------------------------- | --------------------------------------- | ------------ | -------------------------------------------------- | ----------- |
| Flowchart                     | mermaid      | `flowchart` / `graph` header                            | mermaid node id                                    | child of selected            | node + incident edges                   | node label   | new edge                                           | **shipped** |
| Infographic hierarchy         | infographic  | `infographic type hierarchy-tree` / `hierarchy-mindmap` | AntV `data-indexes` (`"0"`, `"0,0"`)               | child of selected            | node + descendants; **root is refused** | item `label` | n/a (tree edge is parentage)                       | **shipped** |
| Infographic dagre             | infographic  | `type relation-dagre`                                   | `data-indexes` (`"0"`…`"n"`) or `~label:` fallback | sibling + `from -> new`      | node + incident relations               | item `label` | `from -> to`                                       | **shipped** |
| Infographic network           | infographic  | `type relation-network-*`                               | same as dagre                                      | append a spoke (`- label X`) | node                                    | item `label` | **off** — extra `relations` do not change the star | **shipped** |
| Infographic lists / sequences | infographic  | `list-*`, `sequence-*`                                  | list index (`"0"`…`"n-1"`)                         | sibling of selected          | item                                    | item `label` | n/a                                                | **shipped** |
| Mermaid mindmap               | mermaid      | `mindmap` header                                        | indent path                                        | child                        | node + descendants                      | label        | n/a                                                | **shipped** |
| Mermaid state                 | mermaid      | `stateDiagram-v2`                                       | state id                                           | new state + transition       | state                                   | label        | transition                                         | **shipped** |
| Mermaid sequence              | mermaid      | `sequenceDiagram`                                       | participant id                                     | participant + message        | participant or message                  | alias        | message between participants                       | **shipped** |
| Metaphor3D tree               | metaphor3d   | `kind: "tree"`                                          | item `id` + `parent`                               | child item                   | item + descendants; **root is refused** | `label`      | n/a                                                | **shipped** |
| Metaphor3D city               | metaphor3d   | `kind: "city"`                                          | item `id`                                          | sibling of selected          | item; **last building refused**         | item `label` | `links[]` edge `{from,to}`                         | **shipped** |
| Metaphor3D garden             | metaphor3d   | `kind: "garden"`                                        | item `id`                                          | sibling of selected          | item; **last plant refused**            | item `label` | n/a                                                | **shipped** |
| Chart values                  | chart        | Vega-Lite `data.values`                                 | row index                                          | sibling of selected          | row                                     | label field  | n/a                                                | **shipped** |

Out of scope on purpose: **anything** (free HTML), **forms** (A2UI). Those are not node graphs.

## Verbs

Same four names everywhere. A family that cannot support a verb returns `canLink: false` (or the mutator returns `{ok:false, reason}`) — the radial hides or no-ops; it does not grow a fifth name.

| Verb   | User gesture                     | Mutator                            | Refused when                                   |
| ------ | -------------------------------- | ---------------------------------- | ---------------------------------------------- |
| Add    | radial + on a selected node      | `addLinkedNode(source, id, label)` | no selection                                   |
| Delete | radial trash                     | `deleteNode` / `deleteEdge`        | hierarchy root (`reason: 'root'`)              |
| Rename | radial or Enter; inline field    | `renameNode`                       | empty / identical label                        |
| Link   | radial link, then click a target | `connectNodes`                     | `canLink === false`; self-loop; duplicate edge |

## Adapter contract

`graphEditAdapterFor(contentType, source)` returns `null` or:

```
{
  contentType,     // 'mermaid' | 'infographic' | 'metaphor3d' | 'chart' (posted on /user-edit)
  canLink,         // false hides the Link radial item
  addLinked(source, fromId, label?),
  connect(source, fromId, toId),
  deleteNode, deleteEdge, renameNode, renameEdge
}
```

Each method returns `{ ok, source, newId?, newLabel? }` or `{ ok: false, reason }`. `graphEditIdFromDescriptor` is the canvas-side helper: mermaid uses `id` / `match`; infographic uses `data-indexes`, then `~label:<text>` when AntV painted a title-only hit (no indexes).

### Infographic identity (load-bearing)

AntV writes `data-indexes` from the **rendered** item list, not from `parseInfographicTree` in `@archislop/shared`.

- Hierarchy: root is `"0"`; first child `"0,0"`; that child's first child `"0,0,0"`. This is **not** the shared highlighter's path (that one numbers the first child as `"0"`). Graph edit must keep using AntV's scheme or clicks land on the wrong item.
- Dagre / network: nodes are `"0"` … `"n-1"` in source order.
- Flat lists / sequences: items are `"0"` … `"n-1"` under `lists` / `sequences`.

Do not "fix" this by routing edits through `parseInfographicTree`. Fix the highlighter in its own slice if it still disagrees.

### Network vs dagre

`relation-network-*` is a **star**: item 0 is the hub, everyone else is a spoke. Extra `relations:` lines do not change the layout (verified against `@antv/infographic` `parseSyntax` + `getItemList`). Add therefore appends `- label X` with **no** `id` and **no** new edge. Link stays off.

`relation-dagre` is a real DAG. Add mints `id nK` and `hub -> nK`; Link writes `from -> to`.

## Incremental slices

Land one family per change. Each slice is: mutator + tests, adapter row, `user-edit` allowlist if the content type is new, canvas identity if the renderer uses a new hit key, a row in this table, a recipe tick.

1. **Flowchart** — shipped (`mermaidFlowchartEdit.js`).
2. **Infographic hierarchy + dagre + network** — shipped. One mutator covers all three because they share the structured-list source; verbs differ by `canLink` / root / star.
3. **Infographic lists and sequences** — shipped. Add sibling / Delete / Rename on flat `lists` / `sequences` items. No Link. Same `data-indexes` identity (`"0"`…`"n-1"`).
4. **Mermaid mindmap** — shipped. Indent-tree mutator; `canLink: false`. Canvas resolves clicks via `~label:` when Mermaid only stamps `node_N` ids.
5. **Mermaid `stateDiagram-v2`** — shipped. States + transitions; closest mermaid cousin to flowchart. Refuses delete/rename on `[*]`.
6. **Mermaid sequence** — shipped. Participants + ordered messages. **+** declares a new participant and a message from the source; **Link** picks a target participant and inserts a message (order preserved after the source's last line). `canLink: true` — messages are ordered in source, not a free edge graph.
7. **Metaphor3D tree** — shipped. JSON `parent` field; hit identity is item `id` via the Metaphor3D selection bridge (`MetaphorGraphEditBridge`). `canLink: false`.
8. **Metaphor3D city** — shipped. Flat `items[]` with `height`/`footprint`/`district`; Add inserts a sibling after the selection and clones the source building's encoding defaults. Delete refuses the last building (`reason: 'last'`). Link appends to `links[]`. Hit identity is item `id` via `MetaphorGraphEditBridge` (all metaphor kinds). `canLink: true`.
9. **Metaphor3D garden** — shipped. Flat `items[]` with `maturity`/`impact`/`health`/`bed`; Add inserts a sibling and clones the source plant's defaults. Delete refuses the last plant. `canLink: false`.
10. **Chart values** — shipped. Inline `spec.data.values` rows only (not `data.url`). Add inserts a sibling row after the selected datum index; Delete refuses the last row (`reason: 'last'`); Rename updates the primary nominal/string field for that row. Hit identity is Vega's datum index on `chart-mark` selections. `canLink: false`.

Skip a slice rather than stretching a mutator across two identities.

## Adding a family

Follow [`docs/recipes/add-graph-edit-family.md`](recipes/add-graph-edit-family.md).

## Tests

- Mutator: `apps/web/test/<family>GraphEdit.test.js` (or `mermaidFlowchartEdit.test.js`). Assert `{ok, source}` and at least one refuse path.
- Hook: drive `useFlowchartGraphEdit` with a non-flowchart `contentType` and assert `applyUserDiagramEdit` sees the mutated source (`useFlowchartGraphEdit.test.jsx`).
- Radial: `canLink: false` hides Link (`buildRadialActions.test.jsx`).
- Wire: `POST /user-edit` accepts the content type and rejects the others (`copilotRoute.test.js`).

Infographic mutators should stay parseable: `parseSyntax` from `@antv/infographic` on the mutated DSL is the cheap compiler check.

## Traps

- **`useFlowchartGraphEdit` is the canvas graph-edit hook.** The name is leftover from slice 1. Rename it to `useCanvasGraphEdit` in a dedicated cleanup, not in a family slice.
- **Sanitizer rewrite.** `sanitizeInfographicDsl` / `rewriteInfographicHubAndSpokeToTree` can still fold a star with generic edge labels into a hierarchy-tree after `user-edit`. Prefer a `label` that does not look like a default spoke if you are testing network round-trip through the route.
- **Sequence identity is participant id for structure, line order for messages.** Add declares `participant pN as …` and inserts a `->>` message after the source participant's last activity. Link inserts a message only (no new participant). Delete on a participant removes their declaration, every message/activate line that names them, and any `activate`/`deactivate` lifecycle lines for that id; delete on a message uses the edge pair (`fromId`, `toId`) plus the message label and removes the matching arrow line. **Stale message labels refuse** — `findSequenceMessageRange` returns `null` when the canvas still carries a label that no longer matches the source (e.g. after an agent rewrite between duplicate messages between the same pair), so delete/rename no-ops instead of silently hitting the first matching line. Rename updates the `as` alias, not the id.
- **Metaphor3D tree identity is item `id`.** The radial stack receives descriptors from `MetaphorGraphEditBridge`, which mirrors the tap-selection store and projects a screen anchor for the menu. Only `metaphor: "tree"` scenes get the tree adapter — composite and other kinds stay prompt-only unless listed in the family table. Delete refuses any root (no valid `parent`); Add appends `{ id, label, parent, weight }`.
- **Metaphor3D city and garden identity is item `id`.** Same `MetaphorGraphEditBridge` as tree; `graphEditAdapterFor` sniffs `metaphor` on the JSON. City Add clones `height`/`footprint`/`district` from the selected building; garden Add clones `maturity`/`impact`/`health`/`bed`. Both refuse deleting the last item (`reason: 'last'`). City Link writes `links[]`; garden keeps Link off. After Add, `useFlowchartGraphEdit` reads `metaphor` back from the mutated source so the post-add descriptor is not stuck on `"tree"`.
- **Chart values identity is the datum row index.** Only charts with inline `spec.data.values` (not `data.url`) get an adapter. The radial uses `chart-mark` descriptors with `indexes` from Vega's scenegraph item; axis/legend/title hits have no row index and graph edit stays disabled. Add clones the selected row's field shape; Delete refuses when one row remains (`reason: 'last'`); Rename writes the primary nominal/string encoding field (usually the category on `encoding.x`).
- **Connect highlight.** Infographic uses `.is-connect-source` on `[data-indexes]`. Title-only dagre hits (`~label:`) have nothing to paint; the click still works. Mindmap paints by matching node label text in `g.node` when the logical id is `~label:…`. State diagrams use mermaid node ids like flowcharts — no label fallback needed when the renderer stamps stable state ids. Sequence diagrams paint connect source on `[data-et="participant"][data-id]`. Metaphor3D tree has `canLink: false`, so Connect adds a child immediately and never arms link mode.
- **Remount.** AntV wipes the DOM on every source change. `InfographicRenderer` re-selects by `data-indexes` after paint; mermaid keeps the node id.
- **`origin: user`.** Canvas edits must keep this so undo / history stay distinct from agent patches. Do not send them through the agent stream.
