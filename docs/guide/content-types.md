# Content types

```mermaid
flowchart LR
  Toggle["Mode toggle\n(UI)"] -->|"contentType: mermaid"| MS["Mermaid slot\ndiagramSource = Mermaid text"]
  Toggle -->|"contentType: infographic"| IS["Infographic slot\ndiagramSource = AntV DSL"]
  Toggle -->|"contentType: metaphor3d"| ME["Metaphor3D slot\ndiagramSource = Metaphor DSL JSON"]
  Toggle -->|"contentType: chart"| CS["Chart slot\ndiagramSource = Vega-Lite DSL"]
  MS --> MR["Mermaid.js renderer\n(SVG via JSDOM)"]
  IS --> IR["@antv/infographic renderer\n(InfographicRenderer.jsx)"]
  ME --> R3F["React Three Fiber renderer\n(MetaphorRenderer.jsx)"]
  CS --> VR["Vega-Embed renderer\n(ChartRenderer.jsx)"]
```

Each HTTP request and SSE payload carries `contentType`, which is forwarded from the UI to the `DiagramAgentDispatcher`. The dispatcher selects the Mermaid, Infographic, Metaphor3D, or Chart service transparently; routes and stream events are otherwise identical from the client's perspective.

The active content type defaults to `mermaid` and is persisted in `localStorage` under `archislop:content-mode`. **Mermaid, Infographic, and Metaphor3D** are persisted across page reloads; **Chart** mode is session-only (reverts to Mermaid on reload).

## metaphor3d kinds

The `metaphor3d` slot stores a JSON DSL with a `metaphor` discriminator picking one spatial story:

| metaphor    | item caps | spatial idea                                                                  |
| ----------- | --------- | ----------------------------------------------------------------------------- |
| `city`      | ≤ 50      | Buildings on the XZ plane; `height` + `footprint` + `district`. Optional per-item `lighting` (lit/dim/dark) and `condition` (new/aging/crumbling). |
| `layercake` | ≤ 20      | Vertical stack of cylindrical slabs; `thickness` + `components`. Optional `cracks` (0–1 brittleness) + `tilt` (0–15° instability). |
| `galaxy`    | ≤ 150     | Scattered stars with `magnitude` + `cluster`. Optional per-item `binary` (paired star id) + scene-level `nebula` clouds. |
| `tree`      | ≤ 60      | Radial branching from one or more roots; items reference a `parent` id. `weight` controls branch thickness. |
| `terrain`   | ≤ 40      | Procedural heightmap surface from Gaussian peaks; `elevation` + `intensity` per item. Optional scene-level `surface: { metric, baseline }`. |

Scene-level options (apply to every kind):

- `scene.theme`: `whiteboard` (default) · `noir` · `arcade` · `blueprint`. Each theme also tunes the post-processing (bloom, vignette) and contact-shadow mood — see `metaphorThemePresets.js` `postfx`.
- `scene.camera`: still accepted by the schema, but the renderer now always uses user-controlled **orbit** navigation (drag to rotate, scroll to zoom). The fixed/auto-rotate modes and the in-canvas camera toggle were removed — the viewer always drives the camera.
- `scene.title` / `scene.subtitle`: rendered as a title card overlaid on the canvas, **shown only in fullscreen** (in the inline view it would collide with the app's logo).
- `scene.legend.<axis>`: short phrases naming each encoding axis (`height` = "team size", `elevation` = "risk score"); drawn as a legend panel **in fullscreen** (the inline view would collide with the corner controls) and reused as the hover-tooltip metric labels.

Per-item and per-link extras:

- Item `glyph`: one of ~30 procedural icons. Item `note`: a ≤140-char phrase shown when the viewer hovers the item.
- Link `kind`: `flow` (a glowing pulse animates along the edge) · `dependency` · `ownership` — sets the edge colour and whether it animates.

Validation lives in `packages/shared/src/metaphorSchema.ts` and `metaphorSanitizer.ts`. Rendering lives in `apps/web/src/components/MetaphorRenderer.jsx`, with per-metaphor layout helpers under `apps/web/src/utils/metaphorLayouts/`. See also [Agents](agents.md) and [Validation & repair](validation.md) for how each slot is validated.

**In-fullscreen kind switching** — while the canvas is in native fullscreen, a kind-switcher pill in the overlay lets the viewer change the spatial metaphor (e.g. city → terrain) without leaving fullscreen. The transition re-maps item magnitudes and groupings to the new encoding axes via `switchMetaphorKind.js`. The exit button (×) is also available in-fullscreen because the native browser fullscreen toggle disappears once the overlay surface takes over (`DiagramFullscreenOverlay.jsx`).

## chart

The `chart` slot stores a Vega-Lite-compatible DSL. The agent writes valid Vega-Lite JSON with a `chart <type>` header processed by `parseChartDsl` in `packages/shared`. The renderer (`apps/web/src/components/ChartRenderer.jsx`) lazy-loads `vega-embed` and uses `vega-interpreter` to satisfy the CSP `unsafe-eval` restriction.

- Validation: `validateAndPrepareChartPatch` in `apps/server/src/tools/chartDslTool.js`.
- Agent service: `ChartAgentService` (`apps/server/src/agents/chartLangChainAgent.js`).
- **Style** edits are also supported for the chart slot (same `/api/copilotkit/style` route as Mermaid).
- Chart mode is **not persisted** in `localStorage`; a page reload returns to Mermaid.

See also [Agents](agents.md) and [Validation & repair](validation.md).
