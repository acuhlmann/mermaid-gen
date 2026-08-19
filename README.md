# ArchiSlop

Single-repo JavaScript prototype for **collaborative diagram editing**: humans in the browser, built-in LangChain agents, and **external agents over MCP** in the same session. Six canvas modes: **Mermaid** (flowcharts, sequences, etc.), **Infographic** (AntV template-based layouts), **Metaphor3D** (immersive spatial stories: city, layer-cake, galaxy, tree, terrain, orrery, river, garden, archipelago, machine, or a multi-layer **composite** fused world), **Chart** (Vega-Lite charts), **Anything** (sandboxed freeform HTML/CSS/JS), and **Forms** (the agent authors interactive A2UI intake forms directly — the app's endless corporate-IT-forms parody). The active mode picker (including **Auto**) persists in `localStorage`; all six slot sources live in server memory per session id and survive page reload while the server process is up. The client diagram cache omits Anything HTML (large/untrusted); Forms is web-only (MCP hosts do not render it).

## Quick start

1. `npm run setup` then `cp .env.example .env` and set at least one LLM backend: `DEEPSEEK_API_KEY` (local default when set), `OPENROUTER_API_KEY`, or Vertex vars (`VERTEX_PROJECT_ID` / ADC).
2. `npm run dev` — API on `http://localhost:4000`, UI on `http://localhost:5173` (`VITE_API_BASE_URL` → API).
3. Open the UI, use **Go** in the prompt bar; switch modes (**Auto**, **Diagram**, **Infographic**, **3D**, **Chart**, **Forms**, **Anything**) from the AI corner controls.
4. `curl http://localhost:4000/api/health` — `llmConfigured: true` when AI routes are ready.

Step-by-step setup, env vars, and MCP pairing: **[`docs/guide/`](docs/guide/)**.

## Documentation

> **Visual tour of the generative-UI stack:** [architecture-generative-ui-visual.html](https://acuhlmann.github.io/mermaid-gen/architecture-generative-ui-visual.html) — one self-contained page of diagrams explaining how AG-UI (transport), A2UI and the content DSLs (payload abstraction spectrum), and MCP Apps (placement) fit together. Hosted on [GitHub Pages](https://acuhlmann.github.io/mermaid-gen/); also open `docs/architecture-generative-ui-visual.html` locally from a clone.

Human guides (split for faster GitHub preview — diagrams live on focused pages):

| Guide                                                        | Topics                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| [`docs/guide/README.md`](docs/guide/README.md)               | Index of all guides                                                 |
| [Quick start](docs/guide/quick-start.md)                     | Local run, health check                                             |
| [Product & web UI](docs/guide/product.md)                    | Toolbar modes, Insights pane                                        |
| [System overview](docs/guide/system-overview.md)             | Web ↔ server ↔ MCP; Gen UI layers                                   |
| [Content types](docs/guide/content-types.md)                 | Six slots: Mermaid, Infographic, Metaphor3D, Chart, Anything, Forms |
| [Agents](docs/guide/agents.md)                               | Intent / transform / analysis; user modes                           |
| [Validation & repair](docs/guide/validation.md)              | Mermaid ladder, Infographic pipeline                                |
| [External agents](docs/guide/external-agents.md)             | MCP join, Apps table                                                |
| [Configuration](docs/guide/configuration.md)                 | `.env`, LLM, reliability                                            |
| [API endpoints](docs/guide/api-endpoints.md)                 | REST + SSE routes                                                   |
| [Development](docs/guide/development.md)                     | Stack, tests, VS Code                                               |
| [Metaphor USDA mapping](docs/guide/metaphor-usda-mapping.md) | Metaphor3D DSL → `.usda` interchange stub (ADR-0009 steps 1–2)      |
| [OpenUSD approach](docs/guide/openusd-approach.md)           | Remaining OpenUSD path: stub round-trip now; Stage not canonical    |

Integrator & operator references:

| Doc                                                                                                                      | Audience                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| [architecture-generative-ui-visual.html](https://acuhlmann.github.io/mermaid-gen/architecture-generative-ui-visual.html) | **Visual tour** — the Gen UI stack in diagrams ([GitHub Pages](https://acuhlmann.github.io/mermaid-gen/)) |
| [`docs/architecture-generative-ui.md`](docs/architecture-generative-ui.md)                                               | AG-UI, A2UI, MCP Apps map                                                                                 |
| [`docs/architecture-external-agents.md`](docs/architecture-external-agents.md)                                           | Guest agents, session-events                                                                              |
| [`docs/architecture-ag-ui.md`](docs/architecture-ag-ui.md)                                                               | AG-UI SSE contract                                                                                        |
| [`docs/architecture-a2ui.md`](docs/architecture-a2ui.md)                                                                 | A2UI — server-built (critique) vs model-authored (Forms)                                                  |
| [`docs/office-parody.md`](docs/office-parody.md)                                                                         | The Office Update™ — ambience layer, colleagues, WG meetings                                              |
| [`docs/office-isometric-mode.md`](docs/office-isometric-mode.md)                                                         | Isometric floor (renderer #2) — parody-OS frame, slices, geometry                                         |
| [`docs/office-continuity.md`](docs/office-continuity.md)                                                                 | Office continuity — working memory + runWalk (v1 shipped)                                                 |
| [`docs/canvas-graph-edit.md`](docs/canvas-graph-edit.md)                                                                 | Canvas Add / Delete / Rename / Link — shipped families + incremental plan                                 |
| [`docs/office-narration-roadmap.md`](docs/office-narration-roadmap.md)                                                   | Office TTS — Chirp3-HD ladder (shipped) + polish roadmap                                                  |
| [`docs/office-window-manager.md`](docs/office-window-manager.md)                                                         | Office windows on a phone — sheets, minimize-to-taskbar (designed, not shipped)                           |
| [`docs/llm-config.md`](docs/llm-config.md)                                                                               | Model tiers and providers                                                                                 |
| [`docs/deploy/gcp.md`](docs/deploy/gcp.md)                                                                               | Cloud Run deploy                                                                                          |
| [`AGENTS.md`](AGENTS.md)                                                                                                 | Coding-agent operator manual                                                                              |
| [`STRUCTURE.md`](STRUCTURE.md)                                                                                           | Concept → file index                                                                                      |
| [`GLOSSARY.md`](GLOSSARY.md)                                                                                             | Terminology                                                                                               |

## Stack

- `apps/web` — React + Vite + CopilotKit UI
- `apps/server` — Express, CopilotKit routes, LangChain agents, MCP
- `packages/shared` — Zod schemas, sanitizers, AG-UI/A2UI types

## Credits

The office audio in `apps/web/src/assets/audio/` — the room-tone bed and every `cue-*.mp3` — was
generated with [ElevenLabs](https://elevenlabs.io) sound effects. Baked at build time and committed
— ElevenLabs is not a runtime dependency. Generated under the free tier, which is licensed for
**non-commercial use with attribution**; see [`docs/audio-assets.md`](docs/audio-assets.md).

Attribution covers the whole directory rather than a named file on purpose: the sampled cues are
from the same generator as the bed, and a list of filenames goes stale the first time somebody adds
one. The authoritative inventory is the `ASSETS` manifest in `scripts/generate-office-audio.sh`.
