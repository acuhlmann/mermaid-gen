# Validation & repair

## Mermaid validation and repair ladder

Every Mermaid mutation runs through `invokeWithRepair`: inject the current diagram as a system context message, run the agent (stream events when streaming), then walk a **four-layer repair ladder** if the patch did not land or validation failed.

```mermaid
sequenceDiagram
  participant C as Client
  participant R as /api/copilotkit/*
  participant S as Agent service
  participant L as LangChain agent
  participant T as Diagram tools
  participant VRP as validateAndPreparePatch
  participant Fix as Syntax fixer (fast LLM)

  C->>R: intent / transform / agent-stream (SSE)
  R->>S: applyIntent / applyTransformIntent / runAgentStream
  S->>L: messages + optional streamEvents
  L->>T: get_diagram_state (optional)
  T-->>L: JSON snapshot
  L->>T: apply_mermaid_patch(source)
  T->>VRP: validate + (on parse fail) sanitizer rescue
  alt validated (parser OR sanitizer-rescue)
    VRP-->>T: patch accepted
    T-->>L: accepted:true
    L-->>S: final assistant text
    S-->>R: 200 + state / SSE final
    R-->>C: JSON or SSE tokens + final
  else rejected
    VRP-->>T: error JSON in tool result
    L-->>S: no revision change
    S->>Fix: brokenSource + parser error + rule pack
    Fix-->>S: corrected source (single-shot, no tools)
    alt fixer accepted
      S->>VRP: re-validate fixer output
      VRP-->>S: patch accepted
    else fixer failed or unavailable
      S->>L: full-agent syntax-repair turn
      L->>T: apply_mermaid_patch (repair turn, up to MERMAID_REPAIR_MAX_ATTEMPTS)
    end
  end
```

**The four-layer ladder, in order of cost:**

1. **Heuristic prefix check** — instant. Rejects source that doesn't start with a known diagram type.
2. **Deterministic sanitizer rescue** (`packages/shared/src/mermaidSanitizer.js`, also used for thinking-pane Mermaid previews) — ~1–10 ms. Composable fixers (smart quotes, header typos, malformed init JSON, reserved-word node IDs, parens/colons/slashes in labels, **quoted labels with embedded `"` / newlines**, unbalanced subgraphs, stray semicolons).
3. **Single-shot syntax fixer** (`apps/server/src/agents/mermaidSyntaxFixer.js`) — one LLM call, no tools, low temperature, fast model. Includes the parser error, broken source, and a diagram-type-specific rule pack (`apps/server/src/prompts/mermaidSyntaxGuard.js`, 15+ packs).
4. **Full-agent syntax-repair turns** — the original loop, kept as a fallback. Enriched with the same rule pack and broken-source block. Bounded by `MERMAID_REPAIR_MAX_ATTEMPTS` (default **2**).

Tune via [Configuration](configuration.md) (`MERMAID_REPAIR_*`, `MERMAID_METRICS`, run budgets).

## Infographic validation pipeline

Infographic uses the same **validate → single-shot fixer → agent repair** shape as Mermaid, with a smaller deterministic front end:

```mermaid
flowchart TB
  Raw["Proposed AntV DSL"] --> S["Sanitizer"]
  S --> L1["Layer 1: textual lint"]
  L1 -->|pass| L2["Layer 2: parseSyntax"]
  L1 -->|fail| R["Repair path"]
  L2 -->|valid| P["Patch accepted"]
  L2 -->|errors| R
  R --> F["Single-shot syntax fixer once"]
  F -->|accepted| P
  F -->|fail| A["Agent repair up to 2 attempts"]
```

- **Sanitizer** runs first (`strip-code-fence`, `tabs-to-spaces`, `smart-quotes-to-ascii`, `strip-leading-prose`).
- **Layer 1** checks the `infographic <template>` header, template whitelist (`@antv/infographic`), and indentation.
- **Layer 2** uses AntV `parseSyntax` for per-template structure.
- On failure, a **single-shot syntax fixer** (fast model, no tools) may apply corrected DSL once, then up to **two** full-agent repair turns with family-specific rule packs (list/sequence, chart, hierarchy, compare, relation).

## Session state: dual-slot model

```mermaid
flowchart TB
  Session["Session activeContentType mermaid or infographic"]
  Session --> MS["mermaid slot revisionId diagramSource styleConfig history"]
  Session --> IS["infographic slot revisionId diagramSource history"]
  MS -->|applyPatch| MV["Mermaid validator"]
  IS -->|applyPatch| IV["Infographic validator"]
```

The two slots are fully independent — switching modes does not touch the other slot's revision history. `applyPatch` in `packages/shared` enforces that a patch's `contentType` matches the slot it targets.

## Session alignment (REST vs CopilotKit)

```mermaid
flowchart LR
  H["HTTP header x-session-id"]
  Q["Query sessionId or threadId"]
  CT["Copilot input.threadId"]
  H --> RID["Resolved session id"]
  Q --> RID
  CT --> RID
  RID --> MAP["Map session to stateStore and agentDispatcher"]
```

Default session id is `default` when nothing is sent; the web client generates and persists a UUID in `localStorage` (`diagramStore.js`).
