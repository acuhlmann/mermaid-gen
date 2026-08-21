# Sensors for coding agents

archislop follows Martin Fowler's ["Sensors for Coding Agents"](https://martinfowler.com/articles/sensors-for-coding-agents.html) framing: every automated check on an agent's edit should hand the agent the _canonical fix_, not just a violation. This page lists the sensors that fire during normal development, what each one tells you, and how to read its output.

## Map

| Sensor                         | Command                                                                                                                                                              | What it catches                                                                                                                                                                                                                                                                                                                                                      | Where guidance lives                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Prettier                       | `npm run format:check` (CI sensors job); scoped in `npm run check:affected`; auto-fix on commit via lint-staged; **agents:** `npm run format:affected` before commit | Inconsistent quotes, line width, trailing commas (often after large JSX wraps in `App.jsx`)                                                                                                                                                                                                                                                                          | Run `npm run format:affected` then re-stage; config in `.prettierrc.json`                                                 |
| Dependency dedupe              | `npm run verify:deps`                                                                                                                                                | Duplicate npm installs of override-pinned packages (e.g. `@a2ui/web_core` hoisted vs nested under `@a2ui/react`) that cause TypeScript "separate declarations" errors                                                                                                                                                                                                | Error message prints `npm install …` fix                                                                                  |
| TypeScript (loose)             | `npm run typecheck` (per workspace)                                                                                                                                  | Type errors at each workspace's baseline strictness                                                                                                                                                                                                                                                                                                                  | tsc output is canonical                                                                                                   |
| TypeScript (strict islands)    | `npm run typecheck:strict` (both apps; part of `npm run check`)                                                                                                      | Full-strict errors on the files listed in each app's `tsconfig.strict.json`; a regression fails CI                                                                                                                                                                                                                                                                   | tsc output is canonical; see [ADR-0006](../decisions/0006-typescript-migration.md)                                        |
| ESLint + custom formatter      | `npm run lint` (all three workspaces)                                                                                                                                | Threshold rules (`max-lines`, `max-lines-per-function`, `max-params`, `complexity`), Factory plugin rules, `@typescript-eslint` `recommended` (warn) on `.ts`/`.tsx`, **type-aware** rules (`no-unsafe-*`, `no-floating-promises`, …) on `packages/shared/src` and each app's **strict island** (see `@archislop/eslint-config/type-checked-island`), React 19 hooks | Per-rule footer block at end of lint output                                                                               |
| dependency-cruiser             | `npm run verify:boundaries`                                                                                                                                          | Workspace + layer boundary violations, cycles, orphans                                                                                                                                                                                                                                                                                                               | `comment` field of each rule in `.dependency-cruiser.cjs`                                                                 |
| Doc-path check                 | `npm run verify:doc-paths`                                                                                                                                           | Broken `apps/` / `packages/` / `scripts/` references in `STRUCTURE.md`, `AGENTS.md`, `CLAUDE.md`, `docs/recipes/`, `docs/guide/`, `docs/agents/`, and `docs/routines/`                                                                                                                                                                                               | Error message names the missing path                                                                                      |
| Quality trend (gates nothing)  | `npm run verify:ratchet` (**not** in `check`; `-- --json`, `-- --with-lint`)                                                                                         | A quality metric moving the wrong way: monolith LOC or lint warnings growing, strict-island or suite counts shrinking                                                                                                                                                                                                                                                | Failure names the metric, the measured value, and the budget; budgets live in `ratchet.json`                              |
| Routine budget                 | `npm run routine:guard -- --postflight <name>`                                                                                                                       | A scheduled NFR routine exceeding its declared `maxFiles`, writing outside `allowedPaths`, touching a don't-touch path, deleting a test file, or shrinking one                                                                                                                                                                                                       | Failure names the file and which budget rule it broke; budgets live in the playbook front-matter                          |
| Wire round-trip tests          | `npm run check:wire`                                                                                                                                                 | Contract drift between producer + consumer for AG-UI / MCP / Zod schemas                                                                                                                                                                                                                                                                                             | Failing test + the recipe under [`docs/recipes/`](../recipes/)                                                            |
| Wire co-change (producer-only) | Soft warn inside `npm run check:affected` (`scripts/wire-cochange.mjs`)                                                                                              | Diff touches a wire producer (`diagramSchema`, AG-UI emitter, MCP tools, `sessionEventBus`) without the expected consumer/test files                                                                                                                                                                                                                                 | Warning text is the fix; see [`docs/agent-blast-radius.md`](../agent-blast-radius.md)                                     |
| Live `vi.mock` paths           | `vitest run test/viMockPathsResolve.test.js -w apps/web` (part of `npm test`)                                                                                        | A relative `vi.mock` specifier that resolves nowhere — vitest no-ops it silently, the real module runs, and the suite passes for the wrong reason                                                                                                                                                                                                                    | Failure names the `file:line -> specifier`; see below                                                                     |
| Modularity (semantic, manual)  | `/modularity:review` (Claude) or [`.cursor/skills/modularity/review/SKILL.md`](../../.cursor/skills/modularity/review/SKILL.md) (Cursor)                             | Coupling imbalances, distributed-monolith risks, hub modules                                                                                                                                                                                                                                                                                                         | [`modularity.md`](modularity.md), ranked priorities: [`balanced-coupling-priorities.md`](balanced-coupling-priorities.md) |

The smallest meaningful loop is `npm run check:affected` — it inspects your diff, runs **Prettier on changed files**, and runs only the other sensors that apply (including **`verify:boundaries`** when `apps/web` changes, and **`typecheck:strict` for `apps/server`** when server files change — loose `typecheck` alone misses strict-island regressions). Staged commits are auto-formatted by the Husky pre-commit hook (`lint-staged`).

### Why Prettier keeps failing on agent commits

CI runs `prettier --check .` in the **sensors** job ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)). Local Husky hooks (`lint-staged` on commit, `check:affected` on push) fix or catch drift — but **cloud agents and `--no-verify` commits skip those hooks**, so unformatted edits (especially large JSX re-wraps in `apps/web/src/App.jsx`) land on `main` and fail CI there.

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

## Known flake: `anythingRuntimeCheck` under a full-suite run

`apps/server/test/anythingRuntimeCheck.test.js` can fail **six tests at once** ("accepts a
working interactive page", "rejects a page whose script throws at load", …) during
`npm run check` / `npm test`, while passing 16/16 when run on its own:

```bash
cd apps/server && node --import ../../scripts/register-antv-layout-esm.mjs --import tsx --test test/anythingRuntimeCheck.test.js
```

It is load contention, not a regression. Each case spawns a child process (browser or jsdom, per `ANYTHING_RUNTIME_ENGINE`) with a
deadline; alone they take ~2 s each on browser (~4 s under jsdom), and under a loaded full-suite run the same cases can miss the deadline. **The tell is the timing** — a real failure does not shift every duration in
the file from 2 s to 4 s. Before assuming you broke something, check whether your diff touches
`apps/server` at all, then re-run the file alone.

### Why `scripts/test-affected-lib.mjs` edits keep hitting it

Any change under `scripts/` sets the `root` flag in `check-affected-lib.mjs`, so
`npm run check:affected` (and Husky pre-push) runs the **full** `npm run check` — not the
diff-scoped `test:affected` loop. That is intentional: resolver and blast-radius rules are
tooling that gates every agent's verify path; a bad mapping is worse than a slow run.

`scripts/test-affected-lib.mjs` has no basename mirror under `scripts/` (the runner's
`scripts/test-affected.test.mjs` imports it but is not auto-selected for lib-only edits), so `test:affected` alone would fall back to `npm run test:scripts` — but
`check:affected` never takes that shortcut for `scripts/` paths. Expect the flake whenever you
touch the resolver until the timeout issue is fixed.

Do **not** weaken the `scripts/` → full-check fallback or add a fake mirror test just to dodge
the suite. The runtime gate default budget is 6000 ms (`ANYTHING_RUNTIME_CHECK_TIMEOUT_MS` in
`.env`; override in `anythingRuntimeCheck.js`). Slow Anything server tests also run in a
serial batch via `scripts/run-server-tests.mjs`, and `anythingRuntimeCheck.test.js` runs its
sandbox cases inside one `{ concurrency: false }` parent so cases in that file do not contend
with each other.
An agent who has just changed unrelated tooling still sees six red tests and a non-zero
`npm run check` when load wins anyway — re-run the file alone before assuming a regression.

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

## How to read the `vi.mock` path check

`apps/web/test/viMockPathsResolve.test.js` scans every test file under `apps/web/test/` and fails with the exact offenders:

```
vi.mock specifiers that resolve nowhere (they silently no-op):
test/useOfficeRunReactions.test.js:10 -> ../utils/officeAmbienceStorage.js
```

The fix is almost always a missing `src/` segment (`../utils/x.js` → `../src/utils/x.js`). **Check what the mock was doing before you repair the path**: a mock that has never executed is not load-bearing, and making it live is a behaviour change, not a fix. If the suite has come to depend on the real module — as `useOfficeRunReactions.test.js` had — deleting the dead mock is the zero-risk edit and repairing it is not.

Only **relative** specifiers are checked; a bare one (`vi.mock('react-dom')`) resolves through `node_modules`. The check maps `.js` → `.ts`/`.tsx` before deciding, because importing `./x.js` and meaning `./x.ts` is the ordinary TypeScript convention that Vite resolves — without that mapping every leaf converted by [`convert-js-leaf-to-ts.md`](../recipes/convert-js-leaf-to-ts.md) reports as broken.

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
- **Modularity priorities (archislop)**: [`docs/agents/balanced-coupling-priorities.md`](balanced-coupling-priorities.md)

## Why

The full rationale is in [ADR-0007](../decisions/0007-sensors-for-coding-agents.md).

## How to read the quality ratchet

`npm run verify:ratchet` compares the repo against budgets in `docs/agents/ratchet.json`.

**It gates no build, on purpose.** Two unattended feature automations run against this repo daily,
and a quality metric that reddens their build at an hour nobody is watching does not get the code
fixed — it teaches the agent that raising the budget is how you get green. So the ratchet is not in
`npm run check`, not in CI, and not in any hook. It is an instrument the `improve` routine reads
(`--json`) and acts on: a number that moved the wrong way becomes that routine's next task.

Anyone can run it to see where things stand.

| Metric                                                                      | Direction     |
| --------------------------------------------------------------------------- | ------------- |
| `monolithLoc` — line count of each file suppressed in `legacy-monoliths.js` | may only fall |
| `lintWarnings` — total ESLint problems per workspace (`--with-lint` only)   | may only fall |
| `strictIslandFiles` — `include` length of each `tsconfig.strict.json`       | may only rise |
| `suite` — test file and test case counts                                    | may only rise |

**When it reports a regression, fix the code first.** If the growth is genuinely warranted, raise
that entry's `budget` and add a `reason`. The script cross-checks `budget` against `initial` and
reports when they differ with no reason recorded — so the file itself carries the history of every
concession rather than quietly forgetting them.

A run also prints `improved — …` lines when a metric has moved past its budget in the good
direction. Those are free wins: tighten the budget to lock them in.

**Lint is opt-in.** The default run does the cheap metrics only (well under a second). Counting
lint warnings needs a second full ESLint pass; the `improve` routine runs `--with-lint`.
