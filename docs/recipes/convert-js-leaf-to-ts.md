# Convert a `.js` leaf to `.ts` (ADR-0006 ratchet step)

The cheapest, highest-leverage TS migration unit: a small, pure `.js` module
that a strict island already imports. Today it resolves to `any` inside the
island, silently weakening it; converting it gives the island real types — and
often surfaces a latent mistype that `any` was masking. See [ADR-0006](../decisions/0006-typescript-migration.md).

Pick leaves first: pure functions, few dependencies, ideally already imported by
a `tsconfig.strict.json` island. Do **not** convert monoliths this way (ADR-0006
defers those until the ADR-0005 splits).

## Steps

1. **Rename, preserving history:** `git mv src/foo/bar.js src/foo/bar.ts`.
   **Do not touch importers** — under `NodeNext` the `'./bar.js'` specifier still
   resolves to `bar.ts`, and the build still emits `dist/foo/bar.js`. Zero importer
   edits, zero runtime path change.
2. **Move JSDoc into the signature.** `@param {string} x` → `x: string`;
   `@returns {string | null}` → `: string | null`. Delete the now-redundant
   `@param`/`@returns` tags; keep the prose description.
3. **Type the return to match consumers, not the implementation.** If a strict
   island assigns the result where a `string` is required, return `string` (not
   `string | null`) — check the call sites first (`grep -rn fnName src`).
4. **Satisfy the island's strict flags.** Islands run `noUncheckedIndexedAccess`,
   so `arr[i]` is `T | undefined`: use `arr[i] ?? fallback` or a guard. A
   `Record<string, V>` index is also `V | undefined` (`map[key] ?? null`).
5. **Add the file to the island.** Append its path to the relevant
   `tsconfig.strict.json` `include` array (`apps/server` and/or `apps/web`). It's
   pulled in transitively anyway, but listing it documents intent.
6. **Verify:** `npm run typecheck -w <ws>` (loose stays green) **and**
   `npm run typecheck:strict` (island green, including any new error the
   conversion surfaced in its importers — fix those too). Then `npm run lint -w <ws>`:
   the file now also gets `@typescript-eslint` `recommended` guidance.
7. **If a failed strict build left bad `.d.ts` in `packages/shared/dist`**, rebuild
   it: `npm run build -w packages/shared` (shared's build emits even on error).

## Worked example

The 2026-05-29 ratchet step converted `apps/server/src/utils/redactSecrets.js`,
`agents/inferDiagramType.js`, and `utils/publicBaseUrl.js`. Typing `publicBaseUrl`
surfaced a real mistype in `copilot.ts:756` that `any` had hidden — the payoff.
