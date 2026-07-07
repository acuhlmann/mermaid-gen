# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, if it exists — domain glossary and vocabulary for archislop.
- **`GLOSSARY.md`** at the repo root — canonical terminology (product name **archislop**, five-slot model, wire concepts).
- **`STRUCTURE.md`** at the repo root — concept→file index for navigation.
- **`docs/decisions/`** — architecture decision records (ADRs). Read decisions that touch the area you're about to work in. This repo uses `docs/decisions/` (not `docs/adr/`).

If `CONTEXT.md` does not exist, **proceed silently**. Don't flag its absence upfront; `/grill-with-docs` can create it when terms get resolved.

## Layout

**Single-context** monorepo (no `CONTEXT-MAP.md`):

```
/
├── GLOSSARY.md
├── STRUCTURE.md
├── docs/decisions/          ← ADRs (0001, 0002, …)
├── docs/guide/              ← human setup and architecture guides
├── apps/web/
├── apps/server/
└── packages/shared/
```

## Use the project's vocabulary

When output names a domain concept (issue title, refactor proposal, hypothesis, test name), prefer terms from **`GLOSSARY.md`** and any future **`CONTEXT.md`**. Product name is **archislop** (repo directory remains `mermaid-gen`).

## Flag ADR conflicts

If your output contradicts an existing ADR under `docs/decisions/`, surface it explicitly rather than silently overriding:

> _Contradicts [0001 dual-slot](docs/decisions/0001-dual-slot-mermaid-infographic.md) (historical — session state now has five slots) — but worth reopening because…_
