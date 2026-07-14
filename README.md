# ArchiSlop

Single-repo JavaScript prototype for **collaborative diagram editing**: humans in the browser, built-in LangChain agents, and **external agents over MCP** in the same session. Six canvas modes: **Mermaid** (flowcharts, sequences, etc.), **Infographic** (AntV template-based layouts), **Metaphor3D** (immersive spatial stories: city, layer-cake, galaxy, tree, terrain, orrery, river, garden, archipelago, or a multi-layer **composite** montage), **Chart** (Vega-Lite charts), **Anything** (sandboxed freeform HTML/CSS/JS), and **Forms** (the agent authors interactive A2UI intake forms directly — the app's endless corporate-IT-forms parody). The active mode is toggled from the UI; Mermaid, Infographic, and Metaphor3D are persisted across sessions; Chart, Anything, and Forms are session-only.

## Quick start

1. `npm run setup` then `cp .env.example .env` and set at least one LLM backend: `DEEPSEEK_API_KEY` (local default when set), `OPENROUTER_API_KEY`, or Vertex vars (`VERTEX_PROJECT_ID` / ADC).
2. `npm run dev` — API on `http://localhost:4000`, UI on `http://localhost:5173` (`VITE_API_BASE_URL` → API).
3. Open the UI, use **Go** in the prompt bar; switch modes (**Diagram**, **Infographic**, **3D**, **Chart**, **Anything**, **Forms**) from the AI corner controls.
4. `curl http://localhost:4000/api/health` — `llmConfigured: true` when AI routes are ready.

Step-by-step setup, env vars, and MCP pairing: **[`docs/guide/`](docs/guide/)**.

## Documentation

> **Visual tour of the generative-UI stack:** [architecture-generative-ui-visual.html](https://acuhlmann.github.io/mermaid-gen/architecture-generative-ui-visual.html) — one self-contained page of diagrams explaining how AG-UI (transport), A2UI and the content DSLs (payload abstraction spectrum), and MCP Apps (placement) fit together. Hosted on [GitHub Pages](https://acuhlmann.github.io/mermaid-gen/); also open `docs/architecture-generative-ui-visual.html` locally from a clone.

Human guides (split for faster GitHub preview — diagrams live on focused pages):

| Guide                                            | Topics                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| [`docs/guide/README.md`](docs/guide/README.md)   | Index of all guides                                                 |
| [Quick start](docs/guide/quick-start.md)         | Local run, health check                                             |
| [Product & web UI](docs/guide/product.md)        | Toolbar modes, Insights pane                                        |
| [System overview](docs/guide/system-overview.md) | Web ↔ server ↔ MCP; Gen UI layers                                   |
| [Content types](docs/guide/content-types.md)     | Six slots: Mermaid, Infographic, Metaphor3D, Chart, Anything, Forms |
| [Agents](docs/guide/agents.md)                   | Intent / transform / analysis; user modes                           |
| [Validation & repair](docs/guide/validation.md)  | Mermaid ladder, Infographic pipeline                                |
| [External agents](docs/guide/external-agents.md) | MCP join, Apps table                                                |
| [Configuration](docs/guide/configuration.md)     | `.env`, LLM, reliability                                            |
| [API endpoints](docs/guide/api-endpoints.md)     | REST + SSE routes                                                   |
| [Development](docs/guide/development.md)         | Stack, tests, VS Code                                               |

Integrator & operator references:

| Doc                                                                                                                      | Audience                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| [architecture-generative-ui-visual.html](https://acuhlmann.github.io/mermaid-gen/architecture-generative-ui-visual.html) | **Visual tour** — the Gen UI stack in diagrams ([GitHub Pages](https://acuhlmann.github.io/mermaid-gen/)) |
| [`docs/architecture-generative-ui.md`](docs/architecture-generative-ui.md)                                               | AG-UI, A2UI, MCP Apps map                                                                                 |
| [`docs/architecture-external-agents.md`](docs/architecture-external-agents.md)                                           | Guest agents, session-events                                                                              |
| [`docs/architecture-ag-ui.md`](docs/architecture-ag-ui.md)                                                               | AG-UI SSE contract                                                                                        |
| [`docs/architecture-a2ui.md`](docs/architecture-a2ui.md)                                                                 | A2UI — server-built (critique) vs model-authored (Forms)                                                  |
| [`docs/llm-config.md`](docs/llm-config.md)                                                                               | Model tiers and providers                                                                                 |
| [`docs/deploy/gcp.md`](docs/deploy/gcp.md)                                                                               | Cloud Run deploy                                                                                          |
| [`AGENTS.md`](AGENTS.md)                                                                                                 | Coding-agent operator manual                                                                              |
| [`STRUCTURE.md`](STRUCTURE.md)                                                                                           | Concept → file index                                                                                      |
| [`GLOSSARY.md`](GLOSSARY.md)                                                                                             | Terminology                                                                                               |

## Stack

- `apps/web` — React + Vite + CopilotKit UI
- `apps/server` — Express, CopilotKit routes, LangChain agents, MCP
- `packages/shared` — Zod schemas, sanitizers, AG-UI/A2UI types
