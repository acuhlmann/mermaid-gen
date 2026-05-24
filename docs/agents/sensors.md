# Sensors for coding agents

archislop follows Martin Fowler's ["Sensors for Coding Agents"](https://martinfowler.com/articles/sensors-for-coding-agents.html) framing: every automated check on an agent's edit should hand the agent the *canonical fix*, not just a violation. This page lists the sensors that fire during normal development, what each one tells you, and how to read its output.

## Map

| Sensor | Command | What it catches | Where guidance lives |
| --- | --- | --- | --- |
| TypeScript | `npm run typecheck` (per workspace) | Type errors | tsc output is canonical |
| ESLint + custom formatter | `npm run lint` (all three workspaces) | Threshold rules (`max-lines`, `max-lines-per-function`, `max-params`, `complexity`), Factory plugin rules, React 19 hooks | Per-rule footer block at end of lint output |
| dependency-cruiser | `npm run verify:boundaries` | Workspace + layer boundary violations, cycles, orphans | `comment` field of each rule in `.dependency-cruiser.cjs` |
| Doc-path check | `npm run verify:doc-paths` | Broken file references in `STRUCTURE.md`, `CLAUDE.md`, recipes | Error message names the missing path |
| Wire round-trip tests | `npm run check:wire` | Contract drift between producer + consumer for AG-UI / MCP / Zod schemas | Failing test + the recipe under [`docs/recipes/`](../recipes/) |
| Modularity (semantic, manual) | `/modularity:review` (Claude) or [`.cursor/skills/modularity/review/SKILL.md`](../../.cursor/skills/modularity/review/SKILL.md) (Cursor) | Coupling imbalances, distributed-monolith risks, hub modules | [`docs/agents/modularity.md`](modularity.md) |

The smallest meaningful loop is `npm run check:affected` — it inspects your diff and runs only the sensors that apply.

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
