# ADR-0007: Sensors for coding agents

## Status

Accepted — 2026-05-24

## Context

Most edits in this repo are now made by coding agents (Claude Code, Cursor). The existing automated checks — `verify:boundaries` (regex), `verify:doc-paths`, typecheck, tests — catch correctness regressions but were never designed to *teach* the agent. When a check fails, the agent reads "violation X at line Y" and has to guess the canonical fix from context.

Martin Fowler's article [Sensors for Coding Agents](https://martinfowler.com/articles/sensors-for-coding-agents.html) reframes this: every sensor should hand the agent the fix. The article highlights four levers: stricter linting (with custom guidance), `dependency-cruiser` for layered architecture, AI-driven semantic modularity review, and a custom ESLint formatter that overrides default messages.

We were also blocked on three secondary problems:

1. Only `apps/web` had ESLint. `apps/server` (where the monoliths live) and `packages/shared` had zero static analysis beyond `tsc`.
2. The regex-based `scripts/verify-boundaries.mjs` enforced three workspace-level rules but couldn't detect cycles, transitive depth, or the intra-`apps/server` layering described in `CLAUDE.md` (routes / agents / tools / prompts / mcp).
3. Cursor had no parity with `.claude/` — agents using Cursor missed any guidance that lived only in Claude's skill format.

## Decision

Three additions, each tuned to be additive over the existing scaffolding:

**1. Workspace-wide ESLint with a custom guidance formatter.** Factor a `packages/eslint-config` workspace exporting `index`, `backend`, `frontend`, and a `formatter.cjs`. All three app/lib workspaces extend it. The formatter renders standard violation output, then appends one "Agent guidance" block per unique rule id with the canonical fix and the exact suppression syntax (with `-- (reason: ...)`). Fowler-recommended threshold rules (`max-lines`, `max-lines-per-function`, `max-params`, `complexity`) ship at `'warn'` severity to match the existing `react-hooks/*` warm-up precedent. ADR-0005 monolith files are pre-suppressed via `legacy-monoliths.js` so the warnings don't drown new signal; when those files split, they come off the list.

**2. Install `@factory/eslint-plugin` as a TypeScript-direction bet.** Enable only the rules that work on JS today (`@factory/no-log-exception-with-throw` server-wide; `@factory/filename-match-export` on `apps/web/src/components/`). Gate the file-organization and TS-only rules behind `{ files: ['**/*.ts', '**/*.tsx'] }` blocks so they activate automatically as the ADR-0006 migration progresses — a passive nudge rather than a forced rewrite.

**3. Replace `scripts/verify-boundaries.mjs` with `dependency-cruiser`.** The `npm run verify:boundaries` script name stays the same; the implementation switches to `depcruise --config .dependency-cruiser.cjs apps packages`. Nine rules encoded today: the three original workspace-leaf rules (now graph-aware, so they catch transitive violations the regex missed), four intra-`apps/server` layer rules from `CLAUDE.md` (prompts-as-leaf, tools-can't-reach-up, mcp-doesn't-import-routes, no web reverse-deps from state/utils/hooks), a global `no-cycles`, and `no-orphans` at warning level. Each rule's `comment` field is the agent-facing fix.

**4. Install Vlad Khononov's `vladikk/modularity` Claude Code plugin and mirror its skill markdown into `.cursor/skills/modularity/`** via `scripts/sync-modularity-skill.mjs`. Modularity reviews are semantic, not automatable; the plugin gives Claude a `/modularity:review` slash command, the mirror lets Cursor agents read the same Balanced Coupling Model and apply it manually. Entry point: `docs/agents/modularity.md`.

**5. Cursor parity.** Add `.cursor/rules/sensors.mdc` (the modern Cursor convention; `.cursorrules` would duplicate `AGENTS.md`). The rule has `alwaysApply: true` so Cursor surfaces it in every session, pointing at `AGENTS.md`, `CLAUDE.md`, the formatter footer convention, the `.dependency-cruiser.cjs` comments, and the mirrored modularity skill.

## Consequences

Positive:

- Both agents read the same self-correction guidance for every rule.
- Cycle and intra-layer violations that the regex script couldn't see are now caught.
- The TypeScript migration (ADR-0006) gets a self-rewarding mechanism: rules light up as files migrate.
- ADR-0005 monolith splits get a visible scoreboard — every file removed from `legacy-monoliths.js` re-engages the threshold check.

Negative:

- One additional workspace to maintain (`packages/eslint-config`).
- The custom formatter ships duplicated guidance text (ESM in `guidance.js`, CJS in `formatter.cjs`) because ESLint loads formatters via `require()`. Documented in [`docs/recipes/add-eslint-rule.md`](../recipes/add-eslint-rule.md); both must be updated together.
- `dependency-cruiser` is heavier than the regex script (~3-5 s vs <1 s) on full runs; `check:affected` triggers it only when `.dependency-cruiser.cjs`, `package.json`, or `package-lock.json` change.
- The Factory plugin's JS subset is small on this codebase today; we accept the install for the directional signal more than the immediate rule coverage.

## Alternatives considered

- **Keep the regex script, just extend it.** Cheapest. Rejected because cycle detection and the intra-server layer rules required real graph analysis, and the regex script's error messages were single-line and not extensible.
- **Custom ESLint rules instead of `@factory/eslint-plugin`.** Cleaner fit today but loses the TypeScript-migration nudge. Reconsider if `@factory/eslint-plugin` proves brittle on ESLint 10.
- **`.cursorrules` instead of `.cursor/rules/*.mdc`.** Rejected because `.cursorrules` is being deprecated by Cursor in favor of `.mdc` files with `globs:` and `alwaysApply:` front-matter, and it would duplicate `AGENTS.md`.
- **Don't mirror the modularity skill, just document it.** Rejected because Cursor users would then need to switch to Claude Code for every modularity review.

## Rollout

This ADR ships in one PR alongside the implementation. The threshold rules ship as warnings; promotion to errors happens per-rule after a two-week quiet period with no unexplained suppressions. `legacy-monoliths.js` is the visible scoreboard — file removals from it are encouraged during ADR-0005 work.

## References

- [Sensors for Coding Agents — Martin Fowler](https://martinfowler.com/articles/sensors-for-coding-agents.html)
- [`@factory/eslint-plugin` (GitHub)](https://github.com/Factory-AI/eslint-plugin)
- [`vladikk/modularity` (GitHub)](https://github.com/vladikk/modularity)
- [`dependency-cruiser`](https://github.com/sverweij/dependency-cruiser)
- ADR-0003 — packages/shared as a leaf
- ADR-0005 — Splitting monolithic files for agent-friendly editing
- ADR-0006 — TypeScript migration as a sliding ratchet
