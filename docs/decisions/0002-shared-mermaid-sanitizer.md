# ADR-0002: Single shared Mermaid sanitizer

**Status:** Accepted

## Context

The Mermaid sanitizer (Layer 2 of the [validation ladder](../../CLAUDE.md#validation-ladder)) is used in two places:

1. **Server-side** patch validation — every Mermaid mutation runs the sanitizer before re-attempting `mermaid.parse`.
2. **Web-side** Thinking-pane Mermaid previews — draft strings the agent is streaming need to be cleaned before mermaid-js renders them in JSDOM.

This briefly lived in both `apps/server` and `packages/shared`. Either could legitimately be the canonical location.

## Decision

The canonical implementation lives in **`packages/shared/src/mermaidSanitizer.ts`**. All callers import from `@archislop/shared`. The former server-only copy and deprecation shim have been removed.

## Consequences

**Good:**

- Server and web share the same sanitizer behavior — a fix on one side is automatically visible on the other.
- Unit tests live in `packages/shared/test/mermaidSanitizer.test.ts`; server integration tests in `apps/server/test/mermaidSanitizer.test.js` exercise `validateAndPreparePatch` with the shared sanitizer.

**Cost:**

- `packages/shared` cannot depend on server-only utilities (this is structural — `shared` is the leaf of the dependency graph).

## Where this lives in code

- Canonical: `packages/shared/src/mermaidSanitizer.ts`
- Server integration tests: `apps/server/test/mermaidSanitizer.test.js`
- Sister file (infographic): `packages/shared/src/infographicSanitizer.ts`
