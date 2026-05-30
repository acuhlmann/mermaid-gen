# ADR-0006: TypeScript migration as a sliding ratchet

**Status:** In progress

## Context

The repo has a partial JS→TS migration. `packages/shared` is fully TypeScript;
`apps/server` and `apps/web` are mostly `.js`/`.jsx`. All three extend the strict
base (`tsconfig.base.json`) but each currently overrides `strict: false` and
`checkJs: false` — **including `packages/shared`**, despite being 100% TS. (An
earlier draft of this ADR claimed shared was already `strict: true`; that was
aspirational, not true — see the strict-mode gate below for the real sizing.)

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
4. `apps/web/src/state/diagramStore.js` (795 LOC) — wire/session peeled to
   `diagramSession.ts` + `diagramWireTypes.ts` + `copilotStreamHttpAgent.ts`; state
   machine remains `.js` until ADR-0005 split.
5. `apps/web/src/App.jsx` (3 789 LOC) — convert as it's split (ADR-0005);
   don't try to do both at once.
6. `apps/web/src/components/DiagramCanvas.jsx` (1 376 LOC).
7. `apps/web/src/components/InsightsPane.jsx` (1 475 LOC).

Pure utility files (`apps/web/src/utils/*.js`) stay `.js` unless we're editing
them anyway. They're stable, low-churn, and JSDoc-annotated where it matters.

## Strict-mode gate

`apps/server/tsconfig.json` and `apps/web/tsconfig.json` flip `strict: true`
+ `noImplicitAny: true` once the top 10 files in each workspace are typed
(`.ts`/`.tsx` or `checkJs` + JSDoc). Until then we grow **strict islands**:
`tsconfig.strict.json` per app lists the files checked under full strict
(`strict` + `noImplicitAny` + `strictNullChecks` + `noUncheckedIndexedAccess`).
Adding a `.ts`/`.tsx` file to an island's `include` array opts it in. Both
islands are wired into `npm run check` via the root `typecheck:strict` script,
so an island regression now fails CI — the ratchet is enforced, not advisory.
Run `npm run typecheck:strict` (both apps) or `-w apps/server` / `-w apps/web`.

### `packages/shared` → strict is sized, not free

A naive `tsc --strict` probe reported shared as clean, but that was a
measurement error: an *explicit* `"noImplicitAny": false` in a tsconfig
overrides the `--strict` meta-flag default, so the CLI probe wasn't actually
strict. Measured properly against `packages/shared/tsconfig.json`, flipping
shared to the strict base surfaces **363 errors** across ~34 files:

| Lever | Added errors |
| --- | --- |
| `noImplicitAny` (TS70xx — add annotations) | 204 |
| `+ strictNullChecks` (TS18048/2345) | +34 |
| `+ noUncheckedIndexedAccess` (TS2532 — null guards in sanitizers/diff) | +125 |
| **Total (`strict` + `noUncheckedIndexedAccess`)** | **363** (233 src / 130 test) |

Done in staged levers (see the 2026-05-29 log): `noImplicitAny` (204) then
`strictNullChecks` (+34) landed, and `packages/shared` now compiles at
**`strict: true`** — the standard strict bar. The one base flag still deferred is
`noUncheckedIndexedAccess` (~156 src/test array-index guards once strictNullChecks
is on): the most aggressive strict-family flag (not implied by `strict: true`),
lowest marginal value on already-tested sanitizer/diff code — so shared overrides
it `false` with a written reason while the server/web strict islands keep it.
`tsconfig.build.json` now sets `noEmitOnError: true` so a failed build can't
pollute `dist/.d.ts`.

## Progress log

### 2026-05-29 — ratchet step (config + lint + leaf conversions)

- **Strict islands grown.** `apps/server/tsconfig.strict.json` went from 7 to 15
  files: promoted the existing `.ts` modules `agentStreamAnalyzeFinalize`,
  `critiqueA2uiStream`, `explainSectionsStream`, `styleEditsStream`,
  `mcp/diagramDiffSummary`, plus the three converted leaves below.
- **New web strict island.** `apps/web/tsconfig.strict.json` (8 files) — the web
  app's first strict config; `typecheck:strict` script added to `apps/web`.
- **CI enforcement.** Root `typecheck:strict` fans out to both apps and is now
  part of `npm run check`.
- **Leaf conversions (the recurring ratchet step).** Converted three pure,
  island-imported leaves from `.js` to `.ts` — `utils/redactSecrets`,
  `agents/inferDiagramType`, `utils/publicBaseUrl` — moving their existing JSDoc
  into real signatures. These had been resolving to `any` inside the strict
  islands; typing `publicBaseUrl` surfaced a latent mistype in `copilot.ts` that
  was previously masked. Pattern recipe: [`docs/recipes/convert-js-leaf-to-ts.md`](../recipes/convert-js-leaf-to-ts.md).
- **`@typescript-eslint` `recommended` enabled (warn).** Non-type-aware rules
  (`no-explicit-any`, `ban-ts-comment`, …) now fire on every `.ts`/`.tsx` file,
  softened to warn per ADR-0007. This is the "Factory works better with TS"
  multiplier: each `.js`→`.ts` conversion now gains both Factory and ts-eslint
  guidance. Type-aware rules stay deferred (need `parserOptions.project`).
- **`packages/shared` → `strict: true`.** Flipped the contract leaf to full
  `strict` in staged levers — `noImplicitAny` (204 fixes across 19 files) then
  `strictNullChecks` (4 src fixes + discriminated-union return types on
  `applyPatch` / `parseMermaidStyleConfig` / the transform validators + test
  narrowing). The widened-discriminant return types were a latent bug (callers
  couldn't narrow `{ accepted }`/`{ ok }`); the explicit annotations fix it for all
  consumers. All 147 shared tests green; server/web loose + both strict islands
  unaffected. `tsconfig.build.json` gains `noEmitOnError: true`.
- **`recommended-type-checked` on `packages/shared/src` (warn).** Type-aware rules
  (`no-floating-promises`, `no-base-to-string`, `no-unsafe-*`, …) now lint shared's
  src via `projectService` — the one workspace strict + fully-TS enough to afford
  it. Scoped to `src/` (node:test's floating `test(...)` would flood tests).
- **Deferred:** `noUncheckedIndexedAccess` on shared (~156 guards, sized above);
  type-aware lint on the apps' loose `.js` corpus (strict islands only — see below).

The web island now covers **all 12** of the web app's TypeScript files. Typing the
`utils/thinkingProseEnrich.tsx` hub (tokenizer discriminated-union + regex-group
`?? ''` coercions, plus *permissive optional* component props so there was no
consumer cascade) pulled in its importers
`components/{StyleEditsPanel,PlanBeatCard,PatchSummaryViz}.tsx` cleanly; behavior is
guarded by `apps/web/test/thinkingProseEnrich.test.jsx` (14 tests, green).

### 2026-05-30 — agent-friendly ratchet (type-aware lint + wire boundaries)

- **Type-aware ESLint on strict islands.** `packages/eslint-config/typeCheckedIsland.js`
  exports `strictIslandTypeCheckedConfig` and `SERVER_STRICT_ISLAND_FILES` (keep in
  sync with `apps/server/tsconfig.strict.json`). `apps/server` and `apps/web`
  eslint configs layer `recommended-type-checked-only` (warn) via `projectService` on
  island paths only — same pattern as `packages/shared/eslint.config.js`, without
  scanning the legacy `.js` corpus.
- **Server wire leaves (6 modules).** Converted island-imported `.js` → `.ts`:
  `mcp/mcpInviteLinks`, `middleware/apiRateLimit`, `utils/inviteToken`,
  `mcp/mcpCollaborationActions`, `state/sessionServices`, `state/pairingCodeStore`.
  Strict island grew to **22** server files. `copilot.ts` uses `PairingCodeStore` and
  `SessionServices` types at the HTTP/MCP edge.
- **Web wire boundary (no `diagramStore.js` monolith).** New strict-island modules:
  `state/diagramWireTypes.ts` (Zod-inferred bodies, mirrors `copilotRouteTypes.ts`),
  `state/diagramSession.ts` (API base URL, session header, browser session id),
  `state/copilotStreamHttpAgent.ts`. `diagramStore.js` re-exports session helpers for
  compatibility; `sessionEventsClient`, hooks, and utils import from `diagramSession.ts`
  directly. Web strict island: **15** files.

## Consequences

- Sliding ratchet: every PR that touches a `.js` file is an opportunity to
  convert it; we don't block on a sweep.
- Strict-mode flip is a one-time CI gate change with a single payload of
  fixes, not a years-long migration.
- During the migration, shared package changes won't break consumers at
  typecheck time — keep using the Zod schemas as the runtime guard (see
  `docs/agent-blast-radius.md`).
