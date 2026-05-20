# ADR-0003: No state store in `packages/shared`

**Status:** Accepted

## Context

`packages/shared` is the leaf of the dependency graph — both `apps/server` and `apps/web` import from it. A natural temptation is to put a "session store" or similar stateful module in shared so both sides can call it.

We don't. Shared modules are **pure** (schemas, sanitizers, helpers, transform policies). State lives only in:

- `apps/server/src/state/diagramStateStore.js` — authoritative per-session diagram state (server-owned).
- `apps/server/src/state/sessionEventBus.js` — SSE feed.
- `apps/server/src/state/pairingCodeStoreFactory.js` — pairing codes (in-memory or Redis-backed).
- `apps/web/src/state/diagramStore.js` — web-side cache + REST/SSE client wrapper.

## Decision

Anything that holds mutable state, or that calls a database, network, or file system, lives in the workspace that owns the responsibility — never in `packages/shared`.

Concretely: a function in `packages/shared` should be **referentially transparent** modulo `Date.now()` / `crypto.randomUUID()` — given the same inputs, it returns the same outputs.

## Consequences

**Good:**

- `packages/shared` is trivially testable (pure functions, no fixtures, no mocks).
- Server and web cannot accidentally share singleton state via shared (which would be a bug; web has many tabs / workers, server has many sessions).
- Bundle size for web stays small — shared has no Node-only dependencies.

**Cost:**

- Two implementations of session-store-like things (one per side) when both apps need similar behavior. We mitigate this by keeping the shapes identical (same Zod schemas) and the helpers pure (e.g. `applyPatch`, `validateMermaid`).

## Where this lives in code

- Pure modules: `packages/shared/src/`
- Server state: `apps/server/src/state/`
- Web state: `apps/web/src/state/`
