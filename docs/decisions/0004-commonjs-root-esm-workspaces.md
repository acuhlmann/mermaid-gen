# ADR-0004: CommonJS root, ESM workspaces

**Status:** Accepted (current behavior)

## Context

The root `package.json` declares `"type": "commonjs"`. The workspace `package.json` files declare `"type": "module"`. This looks contradictory but is intentional.

## Decision

- **Root** stays CommonJS because the scripts that live at root (`concurrently`, deploy bash scripts, future tooling) often shell out to tools that don't care about ESM vs CJS, and because some npm script invocations behaved more predictably with the default Node module-loading mode.
- **Workspaces** are ESM because:
  - `apps/server` uses modern ESM-only deps (`@langchain/core`, `@modelcontextprotocol/sdk`, etc.).
  - `apps/web` is Vite + React 19, native ESM.
  - `packages/shared` is consumed by both apps, so matching their ESM mode means no `.cjs`/`.mjs` interop dance.

`node --test` and Vitest both run ESM cleanly in their respective workspaces.

## Consequences

**Good:**

- Workspaces stay modern and tree-shakeable.
- Root tooling can use plain CommonJS `require` if ever needed (e.g. tiny config helpers).

**Cost:**

- Newcomers occasionally try to add an `import` at root and are surprised. Add a top-of-file comment if you ever add JS at the repo root.
- The TypeScript migration (planned) will set `"module": "NodeNext"` for the ESM workspaces and `"moduleResolution": "bundler"` for `apps/web` — root will remain TS-free.

## Where this lives in code

- Root: `package.json` (`"type": "commonjs"`)
- Server: `apps/server/package.json` (`"type": "module"`)
- Web: `apps/web/package.json` (`"type": "module"`)
- Shared: `packages/shared/package.json` (`"type": "module"`)
