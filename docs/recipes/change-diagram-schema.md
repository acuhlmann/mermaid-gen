# Recipe: change a diagram / session schema

Use when adding or renaming fields on `SessionDiagramState`, patch payloads, intent bodies, or other Zod types in `packages/shared`.

## Steps

1. **Edit the schema** in `packages/shared/src/diagramSchema.ts` (or the focused module if split later). Keep new fields optional when possible for forward compatibility.
2. **Rebuild shared** so consumers see types: `npm run build -w packages/shared`.
3. **Update server validation** in `apps/server/src/routes/copilot.ts` and inferred types in `apps/server/src/routes/copilotRouteTypes.ts` if the HTTP body changed.
4. **Update web client** in `apps/web/src/state/diagramStore.js` and any caller in `App.jsx` that builds the request body.
5. **Tests**
   - `packages/shared/test/diagramSchema.test.ts`
   - `apps/server/test/copilotRoute.test.js` (minimal valid body + one rejection case)
   - `apps/web/test/diagramStore.test.js` if the client shape changed
6. **Run** `npm run check:fast` after shared-only edits; `npm run check` (or `check:affected`) once server/web are updated.
7. **Docs** — if the field is user-visible or part of the public API, update `docs/guide/api-endpoints.md` or `content-types.md`.

## Blast radius

See [`docs/agent-blast-radius.md`](../agent-blast-radius.md) — HTTP / Zod body row.

## Don't forget

- Multi-slot model: fields are per `contentType` (`mermaid` | `infographic` | `metaphor3d` | `chart` | `anything`). Patches must target the correct slot.
- External agents over MCP use the same session state; MCP tools may need updates in `apps/server/src/mcp/mcpServer.js` (or extracted tool modules).
