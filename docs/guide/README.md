# ArchiSlop guides

Human-readable documentation split into focused pages so GitHub preview stays fast and each topic is easy to skim.

| Guide                                       | What you'll learn                                                    |
| ------------------------------------------- | -------------------------------------------------------------------- |
| [Quick start](quick-start.md)               | Install, run locally, health check, first diagram                    |
| [Product & web UI](product.md)              | Vision, toolbar modes, Insights pane, Slopitect                      |
| [System overview](system-overview.md)       | How web, server, and external agents connect; Gen UI layers          |
| [Content types](content-types.md)           | Five slots: Mermaid, Infographic, Metaphor3D, Chart, Anything        |
| [Agents](agents.md)                         | Intent vs transform vs analysis; user-facing modes; interaction flow |
| [Validation & repair](validation.md)        | Mermaid four-layer ladder, Infographic pipeline, session slots       |
| [External agents (MCP)](external-agents.md) | Pairing, join flow, MCP Apps table, hybrid web workflow              |
| [Configuration](configuration.md)           | Environment variables, LLM backends, reliability tuning              |
| [API endpoints](api-endpoints.md)           | REST and SSE route reference                                         |
| [Development](development.md)               | Stack layout, tests, VS Code launch configs                          |
| [Coding agents](coding-agents.md)           | Agent read order, verification table, PR checklist                   |

## Integrator & operator docs (elsewhere)

| Doc                                                                                                                      | Audience                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| [architecture-generative-ui-visual.html](https://acuhlmann.github.io/mermaid-gen/architecture-generative-ui-visual.html) | **Visual tour** — the Gen UI stack in diagrams ([GitHub Pages](https://acuhlmann.github.io/mermaid-gen/)) |
| [`docs/architecture-generative-ui.md`](../architecture-generative-ui.md)                                                 | AG-UI, A2UI, MCP Apps map                                                                                 |
| [`docs/architecture-external-agents.md`](../architecture-external-agents.md)                                             | Guest-agent flows, session-events, tool etiquette                                                         |
| [`docs/architecture-ag-ui.md`](../architecture-ag-ui.md)                                                                 | AG-UI SSE contract                                                                                        |
| [`docs/architecture-a2ui.md`](../architecture-a2ui.md)                                                                   | Critique checklists on `CUSTOM` events                                                                    |
| [`docs/llm-config.md`](../llm-config.md)                                                                                 | Model tiers and provider details                                                                          |
| [`docs/deploy/gcp.md`](../deploy/gcp.md)                                                                                 | Cloud Run deploy and investigation                                                                        |
| [`AGENTS.md`](../../AGENTS.md)                                                                                           | Coding-agent operator manual                                                                              |
| [`STRUCTURE.md`](../../STRUCTURE.md)                                                                                     | Concept → file index                                                                                      |
| [`GLOSSARY.md`](../../GLOSSARY.md)                                                                                       | Terminology                                                                                               |
