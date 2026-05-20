# Content types

```mermaid
flowchart LR
  Toggle["Mode toggle\n(UI)"] -->|"contentType: mermaid"| MS["Mermaid slot\ndiagramSource = Mermaid text"]
  Toggle -->|"contentType: infographic"| IS["Infographic slot\ndiagramSource = AntV DSL"]
  MS --> MR["Mermaid.js renderer\n(SVG via JSDOM)"]
  IS --> IR["@antv/infographic renderer\n(InfographicRenderer.jsx)"]
```

Each HTTP request and SSE payload carries `contentType`, which is forwarded from the UI to the `DiagramAgentDispatcher`. The dispatcher selects the Mermaid or Infographic service transparently; routes and stream events are otherwise identical from the client's perspective.

The active content type defaults to `mermaid` and is persisted in `localStorage` under `archislop:content-mode`.

See also [Agents](agents.md) and [Validation & repair](validation.md) for how each slot is validated.
