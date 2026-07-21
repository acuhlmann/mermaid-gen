# Sensors for coding agents

archislop follows Martin Fowler's ["Sensors for Coding Agents"](https://martinfowler.com/articles/sensors-for-coding-agents.html) framing: every automated check on an agent's edit should hand the agent the _canonical fix_, not just a violation. This page lists the sensors that fire during normal development, what each one tells you, and how to read its output.

## Map

| Sensor                         | Command                                                                                                                                                  | What it catches                                                                                                                                                                                                                                                                                                                                                      | Where guidance lives                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Prettier                       | `npm run format:check` (CI); scoped in `npm run check:affected`; auto-fix on commit via lint-staged; **agents:** `npm run format:affected` before commit | Inconsistent quotes, line width, trailing commas (often after large JSX wraps in `App.jsx`)                                                                                                                                                                                                                                                                          | Run `npm run format:affected` then re-stage; config in `.prettierrc.json`             |
| Dependency dedupe              | `npm run verify:deps`                                                                                                                                    | Duplicate npm installs of override-pinned packages (e.g. `@a2ui/web_core` hoisted vs nested under `@a2ui/react`) that cause TypeScript "separate declarations" errors                                                                                                                                                                                                | Error message prints `npm install …` fix                                              |
| TypeScript (loose)             | `npm run typecheck` (per workspace)                                                                                                                      | Type errors at each workspace's baseline strictness                                                                                                                                                                                                                                                                                                                  | tsc output is canonical                                                               |
| TypeScript (strict islands)    | `npm run typecheck:strict` (both apps; part of `npm run check`)                                                                                          | Full-strict errors on the files listed in each app's `tsconfig.strict.json`; a regression fails CI                                                                                                                                                                                                                                                                   | tsc output is canonical; see [ADR-0006](../decisions/0006-typescript-migration.md)    |
| ESLint + custom formatter      | `npm run lint` (all three workspaces)                                                                                                                    | Threshold rules (`max-lines`, `max-lines-per-function`, `max-params`, `complexity`), Factory plugin rules, `@typescript-eslint` `recommended` (warn) on `.ts`/`.tsx`, **type-aware** rules (`no-unsafe-*`, `no-floating-promises`, …) on `packages/shared/src` and each app's **strict island** (see `@archislop/eslint-config/type-checked-island`), React 19 hooks | Per-rule footer block at end of lint output                                           |
| dependency-cruiser             | `npm run verify:boundaries`                                                                                                                              | Workspace + layer boundary violations, cycles, orphans                                                                                                                                                                                                                                                                                                               | `comment` field of each rule in `.dependency-cruiser.cjs`                             |
| Doc-path check                 | `npm run verify:doc-paths`                                                                                                                               | Broken `apps/` / `packages/` / `scripts/` references in `STRUCTURE.md`, `AGENTS.md`, `CLAUDE.md`, `docs/recipes/`, `docs/guide/`, and `docs/agents/`                                                                                                                                                                                                                 | Error message names the missing path                                                  |
| Wire round-trip tests          | `npm run check:wire`                                                                                                                                     | Contract drift between producer + consumer for AG-UI / MCP / Zod schemas                                                                                                                                                                                                                                                                                             | Failing test + the recipe under [`docs/recipes/`](../recipes/)                        |
| Wire co-change (producer-only) | Soft warn inside `npm run check:affected` (`scripts/wire-cochange.mjs`)                                                                                  | Diff touches a wire producer (`diagramSchema`, AG-UI emitter, MCP tools, `sessionEventBus`) without the expected consumer/test files                                                                                                                                                                                                                                 | Warning text is the fix; see [`docs/agent-blast-radius.md`](../agent-blast-radius.md) |
| Modularity (semantic, manual)  | `/modularity:review` (Claude) or [`.cursor/skills/modularity/review/SKILL.md`](../../.cursor/skills/modularity/review/SKILL.md) (Cursor)                 | Coupling imbalances, distributed-monolith risks, hub modules                                                                                                                                                                                                                                                                                                         | [`docs/agents/modularity.md`](modularity.md)                                          |

The smallest meaningful loop is `npm run check:affected` — it inspects your diff, runs **Prettier on changed files**, and runs only the other sensors that apply (including **`verify:boundaries`** when `apps/web` changes, and **`typecheck:strict` for `apps/server`** when server files change — loose `typecheck` alone misses strict-island regressions). Staged commits are auto-formatted by the Husky pre-commit hook (`lint-staged`).

### Why Prettier keeps failing on agent commits

CI runs `prettier --check .` on the **whole repo** (first step in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)). Local Husky hooks (`lint-staged` on commit, `check:affected` on push) fix or catch drift — but **cloud agents and `--no-verify` commits skip those hooks**, so unformatted edits (especially large JSX re-wraps in `apps/web/src/App.jsx`) land on `main` and fail CI there.

**Before every agent commit** (no Husky in cloud VMs):

1. `npm run precommit` — formats your diff **and** runs the scoped sensor check (includes **untracked** new files, not only staged/committed paths)
2. `git add -A` — re-stage any files Prettier rewrote (use `-A`, not `-u`, when adding new modules)
3. `git commit` … then `npm run check:full` before opening a PR if the change is large

After touching `App.jsx` or any file with a big structural edit, prefer `npm run format:affected` over hand-indenting.

After touching `@a2ui/*`, `package.json`, or `package-lock.json`, also run `npm run verify:deps` and `npm run typecheck -w apps/web` — duplicate `@a2ui/web_core` installs fail TypeScript only when a `.tsx` file imports from both `@a2ui/web_core` and `@a2ui/react`.

## Line endings (Windows + Linux)

Repo text files are **LF** (`.editorconfig`, Prettier `endOfLine: "lf"`, and [`.gitattributes`](../../.gitattributes) `eol=lf`). CI runs on Linux, so CRLF working trees make `format:check` fail even when Git itself looks clean (`core.autocrlf=true` converts on checkout; Prettier reads the raw bytes).

If a Windows clone fails Prettier on hundreds of files with no real formatting drift:

1. Confirm [`.gitattributes`](../../.gitattributes) is present (pull / rebase if needed) and stage it: `git add .gitattributes`
2. Stash or commit any WIP, then refresh checkouts so `eol=lf` applies:

```bash
git stash push -u -m "wip before lf refresh"
git restore .
git stash pop
```

`.gitattributes` overrides `core.autocrlf`; new clones and restores get LF. Do **not** "fix" a pure line-ending mismatch with a whole-repo `npm run format` unless you intend a mass formatting commit.

## How to read verify:deps output

On failure the script prints the mismatched install paths and a one-line `npm install` fix. No separate guidance file — the error _is_ the fix.

Example:

```
verify:deps: @a2ui/web_core versions used by apps/web imports are mismatched:
    apps/web import path → 0.9.2
    @a2ui/react nested import path → 0.10.0
  TypeScript treats these as incompatible types when imported from @a2ui/web_core and @a2ui/react in the same file.
  Fix: npm install @a2ui/web_core@0.10.5 -w apps/web && npm run verify:deps && commit package-lock.json
```

Singleton checks are configured in `scripts/verify-deps.mjs`; override pins live in root `package.json` `overrides`.

When overrides hoist a newer `@a2ui/web_core`, npm ls may also mark **older transitive copies** (e.g. `@copilotkit/a2ui-renderer` still declares `0.9.0`) as invalid. That is expected — `verify:deps` only fails when the versions **app code actually imports** (`apps/web` and `@a2ui/react` paths) disagree. CI uses Node from `.nvmrc` (currently 26); match it locally before dependency bumps so `npm ls` output matches CI.

## How to read ESLint output

The custom formatter at `packages/eslint-config/formatter.cjs` renders one line per violation, then a trailing block titled **"Agent guidance"**. The block quotes, for each rule id that fired, the canonical fix and the exact suppression syntax.

Example:

```
apps/server/src/routes/_demo.js
  12:1   warning  Function 'doStuff' has too many lines (180). Maximum allowed is 120.   max-lines-per-function

0 error(s), 1 warning(s)

Agent guidance (read before suppressing)

[agent guidance: max-lines-per-function]
    Long functions resist comprehension and surgical edits.
    Extract guard clauses and named helpers; a function over the limit usually contains 2-3 cohesive sub-tasks.
    Suppress with a reason if the function is essentially a state machine that would be worse when split:
      // eslint-disable-next-line max-lines-per-function -- (reason: ...)
```

Read the guidance block before doing anything. The default move is to fix; the second-best move is to suppress with a written reason.

## How to read dependency-cruiser output

Each rule has a `comment` field that doubles as the fix:

```
error no-cycles: Cycle detected. Break it by inverting a dependency or by hoisting
  the shared piece into packages/shared. Do not extend the cycle.
  apps/server/src/foo.js -> apps/server/src/bar.js -> apps/server/src/foo.js
```

The rule names are stable: `shared-must-be-leaf`, `web-not-server`, `server-not-web`, `server-prompts-leaf`, `server-tools-no-agents-routes`, `server-mcp-no-routes`, `web-non-component-no-components`, `no-cycles`, `no-orphans`.

## Suppression policy

Format:

```
// eslint-disable-next-line <rule-id> -- (reason: <one-line why>)
```

The `--` separator tells ESLint everything after it is a description; reviewers expect a `(reason: ...)`. For threshold rules on specific files, file-scoped overrides are preferred:

```
/* eslint max-lines: ["warn", { max: 950, skipBlankLines: true, skipComments: true }] -- (reason: pending split #NNN) */
```

The ADR-0005 monolith files are pre-suppressed via `packages/eslint-config/legacy-monoliths.js`. When a file is split, remove it from that list so the rule re-engages.

## Extending the stack

- **Add an ESLint rule + guidance**: [`docs/recipes/add-eslint-rule.md`](../recipes/add-eslint-rule.md)
- **Add a dep-cruiser layer**: [`docs/recipes/add-dep-cruiser-layer.md`](../recipes/add-dep-cruiser-layer.md)
- **Run a modularity review**: [`docs/agents/modularity.md`](modularity.md)

## Why

The full rationale is in [ADR-0007](../decisions/0007-sensors-for-coding-agents.md).
