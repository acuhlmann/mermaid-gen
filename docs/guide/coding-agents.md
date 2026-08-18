# Coding agents

Operator guide for Claude Code, Cursor, Copilot, and other agents editing **archislop**. Humans doing feature work can use [Development](development.md); this page optimizes **feedback loops** and **wire-contract safety**.

## Read order (first session)

1. [`GLOSSARY.md`](../../GLOSSARY.md) — vocabulary (slot, AG-UI vs session-events, etc.)
2. [`STRUCTURE.md`](../../STRUCTURE.md) — concept → file index
3. [`docs/agent-blast-radius.md`](../agent-blast-radius.md) — what else must change when you touch a contract
4. [`docs/recipes/`](../recipes/) — step-by-step for MCP tools, stream events, schemas, canvas graph-edit families
5. [`AGENTS.md`](../../AGENTS.md) — commands and key paths

## Architecture axes (do not conflate)

| Axis                   | Transport                               | Doc                                                                     |
| ---------------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| Built-in agents        | REST + AG-UI SSE on `/api/copilotkit/*` | [`architecture-ag-ui.md`](../architecture-ag-ui.md)                     |
| Collaboration          | `GET /api/copilotkit/session-events`    | [`architecture-external-agents.md`](../architecture-external-agents.md) |
| External agents        | MCP `GET/POST /mcp`                     | same                                                                    |
| MCP Apps (Gen UI HTML) | `ui://archislop/*.html`                 | [`architecture-generative-ui.md`](../architecture-generative-ui.md)     |

## Verification commands

| When you changed…                              | Run                                                                                                                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Not sure / many areas                          | `npm run check:affected` (diff-scoped; **Prettier** + **verify:boundaries** when `apps/web` changes + server **strict** islands when `apps/server` changes) |
| `apps/server` or `apps/web` (tests only)       | `npm run test:affected` (skips slow Anything integration unless the diff touches `anything*`)                                                               |
| Isometric floor only (`OfficeFloor`, geometry) | `npm run test:floor`                                                                                                                                        |
| Office presence / TTS / desk frame             | `officePresence.test.js`, `deskOsPresenceStrip.test.jsx`, `deskOsFrameStyles.test.js`, `officeTts.test.js`, `officeRoute.test.js` (or `test:affected`)      |
| `packages/shared` only                         | `npm run check:fast`                                                                                                                                        |
| Default local gate                             | `npm run check` (boundaries, typecheck, lint, test — wire files included in `npm test` — then doc-paths)                                                    |
| **Before opening a PR** (matches CI)           | `npm run check:full` (local); GitHub CI runs the same sensors/tests/build as **parallel jobs**                                                              |
| AG-UI / session-events / MCP / `diagramSchema` | `npm run check:wire` (focused loop; `npm test` / CI already cover the same wire files)                                                                      |
| Mermaid sanitizer or rule packs                | `npm run check:fast` + `node apps/server/scripts/benchMermaid.js --tag <label>`                                                                             |
| Server wire modules (strict islands)           | `npm run typecheck:strict -w apps/server`                                                                                                                   |

After editing `packages/shared`, run `npm run build -w packages/shared` before server/web typecheck if consumers report stale types from `dist/`.

## PR checklist (copy before submit)

- [ ] Ran `npm run precommit` and `git add -A` to re-stage (mandatory for cloud agents — Husky does not run)
- [ ] Ran `npm run check:affected` or the smallest row from the table above
- [ ] If Prettier still failed: `npm run format` on the whole repo
- [ ] Ran `npm run check:full` if the change touches build, routes, or multiple workspaces
- [ ] Updated producer **and** consumer for any wire/schema change ([blast-radius](../agent-blast-radius.md))
- [ ] Updated `docs/guide/`, architecture doc, or recipe if behavior or routes changed
- [ ] Did not hand-edit `package-lock.json` or `skills-lock.json`
- [ ] Did not commit `.env` or secrets

## File-size budgets

Prefer extracting helpers into sibling modules instead of growing hub files. See [`docs/decisions/0005-monolith-splits.md`](../decisions/0005-monolith-splits.md) and the table in [`CLAUDE.md`](../../CLAUDE.md).

## TypeScript ratchet

Most app code is still `.js`/`.jsx` with `strict: false`. `packages/shared` is `strict: true`; app **strict islands** are listed in each workspace's `tsconfig.strict.json` and checked by `npm run typecheck:strict`. Edits inside an island also get **type-aware ESLint** (`no-unsafe-*`, `no-floating-promises`, …) via [`packages/eslint-config/typeCheckedIsland.js`](../../packages/eslint-config/typeCheckedIsland.js). See [ADR-0006](../decisions/0006-typescript-migration.md) and [`docs/recipes/convert-js-leaf-to-ts.md`](../recipes/convert-js-leaf-to-ts.md).

When you touch a high-churn `.js` file, convert it (leaf recipe) or add JSDoc referencing `z.infer<typeof …>` from `@archislop/shared`. Next monolith targets: `diagramStore.js` state machine (wire/session modules are already `.ts`), `mermaidLangChainAgent.js` (gated on `ToolApplyResultSchema`), `mcpServer.js` (per-tool split).

## Project skills (Mermaid, etc.)

Edit [`.cursor/skills/`](../../.cursor/skills/) only. [`.claude/skills/mermaid`](../../.claude/skills/mermaid) symlinks to the same tree for Claude Code. CopilotKit skills: `npm run setup:skills` → gitignored `.agents/`.

## Related

- [`AGENTS.md`](../../AGENTS.md) — operator manual (commands, CLIs, don't-touch, Cursor Cloud)
- [`CLAUDE.md`](../../CLAUDE.md) — domain quick-reference (slots, validation ladders, wire habits)
- Keep operational tips mirrored in both files; domain depth stays in `CLAUDE.md` with a pointer from `AGENTS.md`
- [`docs/agents/testing.md`](../agents/testing.md) — diff-scoped tests, helpers, slow suites
- [`docs/agents/sensors.md`](../agents/sensors.md) — lint, dep-cruiser, and formatter guidance
- [`docs/agents/balanced-coupling-priorities.md`](../agents/balanced-coupling-priorities.md) — ranked modularity focus areas (Balanced Coupling model)
- [`docs/office-continuity.md`](../office-continuity.md) — office working memory + `runWalk` (v1 shipped)
- [`docs/guide/openusd-approach.md`](openusd-approach.md) — Metaphor3D USDA stub vs OpenUSD Stage; do not claim Core compliance
- [`change-diagram-schema.md`](../recipes/change-diagram-schema.md) — schema change playbook
- [`add-graph-edit-family.md`](../recipes/add-graph-edit-family.md) — canvas Add / Delete / Rename / Link for a new diagram family ([plan](../canvas-graph-edit.md))
