# ADR-0002: Single shared Mermaid sanitizer

**Status:** Accepted

## Context

The Mermaid sanitizer (Layer 2 of the [validation ladder](../../CLAUDE.md#validation-ladder)) is used in two places:

1. **Server-side** patch validation — every Mermaid mutation runs the sanitizer before re-attempting `mermaid.parse`.
2. **Web-side** Thinking-pane Mermaid previews — draft strings the agent is streaming need to be cleaned before mermaid-js renders them in JSDOM.

Briefly, this lived in `apps/server/src/agents/mermaidSanitizer.js` _and_ `packages/shared/src/mermaidSanitizer.js`. Either could legitimately be the canonical location.

## Decision

The canonical implementation lives in **`packages/shared/src/mermaidSanitizer.js`**. The file at `apps/server/src/agents/mermaidSanitizer.js` is a 2-line deprecation shim that re-exports from `@archislop/shared`:

```js
/** @deprecated Import from `@archislop/shared` instead. */
export { sanitizeMermaid, prepareMermaidForRender, __internal } from '@archislop/shared';
```

New code in `apps/server` should import directly from `@archislop/shared`. The shim exists only so we don't break in-flight branches; remove it when no callers remain.

## Consequences

**Good:**

- Server and web share the same sanitizer behavior — a fix on one side is automatically visible on the other.
- The sanitizer test suite (`apps/server/test/mermaidSanitizer.test.js`) is authoritative.

**Cost:**

- `packages/shared` cannot depend on server-only utilities (this is structural — `shared` is the leaf of the dependency graph).
- Anyone editing the sanitizer must remember to add tests in **shared**'s test directory (not server's), since the shim doesn't ship its own tests.

## Where this lives in code

- Canonical: `packages/shared/src/mermaidSanitizer.js`
- Shim: `apps/server/src/agents/mermaidSanitizer.js` _(deprecated)_
- Tests: `apps/server/test/mermaidSanitizer.test.js` _(will move to `packages/shared` when tests are co-located in Phase 2)_
- Sister file (infographic): `packages/shared/src/infographicSanitizer.js`
