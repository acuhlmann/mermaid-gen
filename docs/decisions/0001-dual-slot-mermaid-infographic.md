# ADR-0001: Dual-slot session state (Mermaid + Infographic)

**Status:** Accepted (current behavior)

## Context

The product supports two diagram modes — Mermaid (flowcharts, sequences, …) and AntV Infographic (template-based layouts). A user often wants to flip between them while iterating on a story: e.g. start with a Mermaid flow, jump to an infographic for stakeholder framing, then back to Mermaid.

Two obvious shapes existed:

- **Single slot, content-type tagged.** One `diagramSource` + `contentType`. Switching modes overwrites the source.
- **Dual slot, content-type pointer.** Two independent `diagramSource` strings, one per content type, plus an `activeContentType` pointer. Switching modes preserves both.

## Decision

We use the **dual-slot model**. `SessionDiagramStateSchema` in `packages/shared/src/diagramSchema.js` carries:

- `mermaid: { diagramSource, revisionId, styleConfig, history }`
- `infographic: { diagramSource, revisionId, history }`
- `activeContentType: 'mermaid' | 'infographic'`

`applyPatch` enforces that a patch's `contentType` field matches the slot it targets. Routes and SSE payloads forward `contentType` from the UI; the `DiagramAgentDispatcher` uses it to pick the Mermaid or Infographic agent service.

## Consequences

**Good:**

- Mode toggles are non-destructive — users can experiment freely.
- Validators and agents stay specialized per content type (different parsers, sanitizers, rule packs).
- The web UI can render both canvases independently and remember focus per mode.

**Cost:**

- Twice the session state per slot (history, revision counter, source).
- Every route handler and SSE event carries a `contentType` field; forgetting it is a frequent bug class — `applyPatch` is the safety net.
- Cross-slot operations (e.g. "convert this Mermaid to an Infographic") need explicit cross-mode logic.

## Alternatives considered

- **Single slot.** Simpler state, but mode-switching becomes destructive and a "compare modes" affordance becomes impossible without ad-hoc history.
- **Slot per diagram type (flowchart vs sequence vs gantt …).** Too granular — Mermaid's diagram type changes within a single source string, so this would explode into a per-type schema with no clear benefit.

## Where this lives in code

- Schema: `packages/shared/src/diagramSchema.js`
- Server-side store: `apps/server/src/state/diagramStateStore.js`
- Web-side store: `apps/web/src/state/diagramStore.js`
- Dispatcher: `apps/server/src/agents/diagramAgentDispatcher.js`
