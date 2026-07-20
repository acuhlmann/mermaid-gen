# Recipe: add a content-type slot

Use when introducing a **new diagram slot** (a seventh `contentType` alongside `mermaid` / `infographic` / `metaphor3d` / `chart` / `anything` / `forms`). This is the highest blast-radius change in the repo — do not invent a parallel path.

The dual-slot pattern (ADR-0001) still applies: independent `diagramSource` + `revisionId` per slot, plus an `activeContentType` pointer. Switching modes must not mutate other slots.

## Preconditions

- You know the **validation ladder** for the new slot (parse → optional sanitizer → syntax fixer → agent repair). See [`CLAUDE.md`](../../CLAUDE.md) § Validation ladder.
- Prefer a Zod schema in `packages/shared` over server-only validation.
- Prefer the shared repair helper `invokePatchAgentWithRepair` (`apps/server/src/agents/_lib/invokePatchAgentWithRepair.js`) over copying Mermaid/Infographic's bespoke loops. Mermaid and Infographic remain special-cased until they converge.

## Steps (order matters)

1. **Shared schema** — extend `ContentTypeSchema` and `SessionDiagramStateSchema` in `packages/shared/src/diagramSchema.ts`. Add a slot object (`{ diagramSource, revisionId, history, … }`). Update `applyPatch` so a patch's `contentType` must match the target slot. Export any parse helpers the server/web need.

2. **Shared agent contract** — if the slot has a LangChain agent, ensure `DiagramAgentService` in `packages/shared/src/diagramAgentService.ts` still fits (or extend it deliberately).

3. **Server store** — `apps/server/src/state/diagramStateStore.ts` must initialize and accept patches for the new slot.

4. **Validation tool** — add `apps/server/src/tools/<slot>Tool.js` that validates + prepares patches (mirror `chartDslTool.js` or `formsA2uiTool.js`). Register the tool factory in `apps/server/src/agents/diagramTools.js`.

5. **Prompts + syntax fixer** — add `apps/server/src/prompts/<slot>SystemPrompt.js` (+ optional syntax guard). Add `apps/server/src/agents/<slot>SyntaxFixer.js` if the ladder needs a single-shot fixer.

6. **LangChain agent** — add `apps/server/src/agents/<slot>LangChainAgent.js` with `createLazy…AgentService`. Implement `invokeWithRepair` via `invokePatchAgentWithRepair` (see `formsLangChainAgent.js` / `chartLangChainAgent.js`). Wire into `apps/server/src/agents/diagramAgentDispatcher.js`.

7. **Routes / wire** — ensure `contentType` is accepted on intent/transform/analyze/stream (usually automatic via `ContentTypeSchema`). Update `inferContentType` classifier guidance in `apps/server/src/agents/inferContentType.ts` if Auto mode should pick the new slot.

8. **Web store** — `apps/web/src/state/diagramStore.js` (+ any `diagramWireTypes` / session helpers) must carry the new slot in initial state, cache restore, and active-mode switching.

9. **Renderer + canvas** — add `apps/web/src/components/<Slot>Renderer.jsx`. Register editor language / panel labels / renderer branch in `DiagramCanvas.jsx` (or a future slot registry). Prefer a declarative registry entry over another `if (contentType === …)` ladder when touching that file.

10. **Mode picker UI** — mode toggle / Auto options in `App.jsx` (or extracted feature hooks) and `apps/web/src/utils/appSessionLocation.js` persistence.

11. **Insights / MCP** — if critique/explain/propose should include the slot: update Insights pane branches, MCP `propose_diagram_edit` / focus / react `contentType` enums, and any MCP App HTML that lists modes.

12. **Tests** — shared schema tests, server agent/tool tests, web renderer smoke if present, and `npm run check:wire`.

13. **Docs** — update [`docs/guide/content-types.md`](../guide/content-types.md), [`GLOSSARY.md`](../../GLOSSARY.md), [`STRUCTURE.md`](../../STRUCTURE.md), [`CLAUDE.md`](../../CLAUDE.md) multi-slot paragraph, and [`docs/agent-blast-radius.md`](../agent-blast-radius.md) if a new wire surface appears.

## Files you'll typically touch

| Layer            | Paths                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Shared           | `packages/shared/src/diagramSchema.ts`, parse helpers, tests                                |
| Server agent     | `*LangChainAgent.js`, `diagramAgentDispatcher.js`, `diagramTools.js`, prompts, syntax fixer |
| Server tools     | `apps/server/src/tools/<slot>Tool.js`                                                       |
| Server state     | `diagramStateStore.ts`                                                                      |
| Web              | `diagramStore.js`, `DiagramCanvas.jsx`, `*Renderer.jsx`, mode picker                        |
| MCP (if exposed) | `mcpServer.js` / `apps/server/src/mcp/tools/`, App HTML                                     |
| Docs             | `content-types.md`, `STRUCTURE.md`, `GLOSSARY.md`, `CLAUDE.md`                              |

## Verification

```bash
npm run check:fast          # shared schemas
npm run test -w apps/server # agent + tool + MCP
npm run test -w apps/web
npm run check:wire
npm run precommit           # cloud agents before commit
```

## Don't forget

- Forward `contentType` on every HTTP body and SSE payload; `applyPatch` is the safety net, not a substitute for forgetting it on the wire.
- Cross-slot convert ("turn this Mermaid into X") needs **explicit** logic — never overwrite another slot's history by accident.
- Update the co-change blast-radius sensor expectations if you add a new producer/consumer pair (see `scripts/check-affected-lib.mjs`).
