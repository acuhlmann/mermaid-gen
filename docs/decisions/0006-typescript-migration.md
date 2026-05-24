# ADR-0006: TypeScript migration as a sliding ratchet

**Status:** In progress

## Context

The repo has a partial JS→TS migration: 189 `.js`, 51 `.jsx`, 58 `.ts`, 7 `.tsx`.
`packages/shared` is fully TypeScript with `strict: true`; `apps/server` and
`apps/web` extend the strict base but override `strict: false` and `checkJs: false`.

Concrete consequences for coding agents:

- ~240 `.js`/`.jsx` files get zero IDE type-checking. A wrong-shape object
  flowing into `applyDiagramSource` won't surface until a test or a runtime
  crash, even though the shared Zod schemas describe the right shape.
- Shared-package schema changes (new required field, renamed property) don't
  trip a typecheck error in consumer apps; they only fail at runtime in the
  request validator.

## Decision

Treat TS adoption as a ratchet, not a sweep. Three independent levers we tighten
file by file:

1. **`checkJs: true`** with JSDoc `@param`/`@returns`/`@typedef` on the busiest
   `.js` files. Cheap signal — no rename, no extension change.
2. **Migrate to `.ts`/`.tsx`** on the highest-churn files. Order by edit
   frequency, not by file size.
3. **Flip `strict: true`** for `apps/server` and `apps/web` once their top-10
   files are TS or fully JSDoc-annotated.

## Order of operations

Priority list (by edit churn × LOC):

1. ✅ `apps/server/src/routes/copilot.ts` (862 LOC, was `.js`) — converted; handlers
   typed via `copilotRouteTypes.ts` + `CopilotAgentService`; included in
   `apps/server/tsconfig.strict.json` with `diagramStateStore.ts` and
   `sessionEventBus.ts`. Factory ESLint rules gated on `**/*.{ts,tsx}` are enabled
   via `packages/eslint-config/factoryPluginCompat.js`.
2. `apps/server/src/agents/mermaidLangChainAgent.js` (1 350 LOC) — once
   `ToolApplyResultSchema` (ADR-0005's sibling work) is wired everywhere,
   the agent boundary is fully typed.
3. `apps/server/src/mcp/mcpServer.js` (1 484 LOC) — wait for the per-tool
   split (ADR-0005) so each tool can convert independently.
4. `apps/web/src/state/diagramStore.js` (795 LOC) — wire boundary on the
   web side; consumers fan out.
5. `apps/web/src/App.jsx` (3 789 LOC) — convert as it's split (ADR-0005);
   don't try to do both at once.
6. `apps/web/src/components/DiagramCanvas.jsx` (1 376 LOC).
7. `apps/web/src/components/InsightsPane.jsx` (1 475 LOC).

Pure utility files (`apps/web/src/utils/*.js`) stay `.js` unless we're editing
them anyway. They're stable, low-churn, and JSDoc-annotated where it matters.

## Strict-mode gate

`apps/server/tsconfig.json` and `apps/web/tsconfig.json` flip `strict: true`
+ `noImplicitAny: true` once the top 10 files in each workspace are typed
(`.ts`/`.tsx` or `checkJs` + JSDoc). The `tsconfig.strict.json` islands in
`apps/server` already prove the strict path works for the most contract-sensitive
modules (`copilot.ts`, `copilotRouteTypes.ts`, `diagramStateStore.ts`,
`sessionEventBus.ts`, stream helpers). Run `npm run typecheck:strict -w apps/server`.

## Consequences

- Sliding ratchet: every PR that touches a `.js` file is an opportunity to
  convert it; we don't block on a sweep.
- Strict-mode flip is a one-time CI gate change with a single payload of
  fixes, not a years-long migration.
- During the migration, shared package changes won't break consumers at
  typecheck time — keep using the Zod schemas as the runtime guard (see
  `docs/agent-blast-radius.md`).
