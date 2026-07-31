# Testing guide for coding agents

This page complements [`docs/agent-blast-radius.md`](../agent-blast-radius.md) (what tests to touch) and [`docs/guide/coding-agents.md`](../guide/coding-agents.md) (verification commands). It focuses on **how to run the smallest useful test loop** while editing this repo.

## Frameworks

| Workspace         | Runner                 | Location                         |
| ----------------- | ---------------------- | -------------------------------- |
| `packages/shared` | Node `node:test` + tsx | `packages/shared/test/*.test.ts` |
| `apps/server`     | Node `node:test` + tsx | `apps/server/test/*.test.js`     |
| `apps/web`        | Vitest + jsdom         | `apps/web/test/*`                |
| Root scripts      | Node `node:test`       | `scripts/*.test.mjs`             |

All tests run without API keys. LLM calls are mocked in agent and route tests.

## Commands (smallest loop first)

| Goal                                                   | Command                            |
| ------------------------------------------------------ | ---------------------------------- |
| **Diff-scoped tests** (preferred while editing)        | `npm run test:affected`            |
| Shared schemas / sanitizers only                       | `npm run check:fast`               |
| Wire contracts (AG-UI, emitter, translator)            | `npm run check:wire`               |
| Server tests without slow Anything child-process suite | `npm run test:fast -w apps/server` |
| Full local gate                                        | `npm run check`                    |
| Before PR / local CI parity                            | `npm run check:full`               |

`npm run check` ends with `verify:doc-paths` (not a second wire suite): wire round-trip files already run inside `npm test`. Use `check:wire` when you want only those three files + doc-paths.

GitHub CI (`.github/workflows/ci.yml`) splits sensors, workspace tests, and build into **parallel jobs** so wall clock is closer to the slowest suite than to the sum. Deploy waits for that CI workflow to succeed (`workflow_run`) before updating Cloud Run.

`npm run check:affected` runs `test:affected` automatically when `apps/server` or `apps/web` files change (instead of the full ~100s suite). When those workspaces change, wire coverage comes from `test:affected` (not a second `check:wire`).

### Diff-scoped mapping

`scripts/test-affected-lib.mjs` maps changed paths to test files:

1. **Basename mirror** — `apps/server/src/agents/diagramAgentDispatcher.js` → `apps/server/test/diagramAgentDispatcher.test.js`; `scripts/test-affected-lib.mjs` → `scripts/test-affected.test.mjs` (runner) plus `scripts/test-affected-lib.test.mjs` when present
2. **Blast-radius rules** — e.g. `diagramSchema.ts` also runs `copilotRoute.test.js` and wire tests
3. **Fallback** — unmapped server paths use `test:fast`; unmapped shared/web paths use the workspace full suite; unmapped `scripts/` paths use `test:scripts`
4. **Slow skip** — Anything runtime tests (~40s of jsdom child processes) are skipped unless the diff touches `anything*` paths. Set `TEST_AFFECTED_SLOW=1` to force them.

**`check:affected` vs `test:affected`:** any `scripts/` change (including
`scripts/test-affected-lib.mjs`) is classified as `root` tooling and runs the full
`npm run check` — see [`sensors.md`](sensors.md) § Known flake. Do not weaken that fallback;
the durable fix for the recurring `anythingRuntimeCheck` flake under load is a higher
`ANYTHING_RUNTIME_CHECK_TIMEOUT_MS`, not a narrower resolver.

Examples:

```bash
# After editing the dispatcher
npm run test:affected

# Force slow Anything integration tests in the affected set
TEST_AFFECTED_SLOW=1 npm run test:affected

# Compare against a specific base branch
npm run test:affected -- --base origin/main
```

## Reusable test helpers

Import these instead of copying payloads or store fixtures.

| Helper                                                | Path                                           | Use for                                              |
| ----------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| `UNCONFIGURED_LLM_ENV`                                | `apps/server/test/helpers/testEnv.js`          | Route tests — avoids `.env` key leakage on cloud VMs |
| `intentPayload`, `transformPayload`, `analyzePayload` | `apps/server/test/helpers/copilotPayloads.js`  | Minimal valid copilot HTTP bodies                    |
| `createMockAgentService`, `createLabeledAgentStub`    | `apps/server/test/helpers/mockAgentService.js` | Dispatcher / route handler stubs                     |
| `createDiagramStateFixture`                           | `apps/web/test/helpers/diagramStateFactory.js` | Vitest store / insight reducer fixtures              |

The MCP harness in `apps/server/test/mcpServer.test.js` (`setupServer`, `connectClient`, `callTool`) is the template for new MCP tool tests.

## What to extend for common edits

| You changed…               | Extend these tests                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Zod schema / patch shape   | `packages/shared/test/diagramSchema.test.ts` + producer/consumer per [blast-radius](../agent-blast-radius.md) |
| Copilot HTTP handler       | `apps/server/test/copilotRoute.test.js`                                                                       |
| Multi-slot routing         | `apps/server/test/diagramAgentDispatcher.test.js`                                                             |
| LangChain agent (new slot) | Mirror `chartLangChainAgent.test.js` — builder unit tests + non-cumulative repair loop                        |
| AG-UI CUSTOM event         | `wireRoundTrip.test.ts`, `wireEmitterRoundTrip.test.js`, `wireAgUiTranslator.test.js`                         |
| Session-events SSE         | `sessionEventBus.test.js`, `sessionEventsClient.test.js`                                                      |
| MCP tool                   | `mcpServer.test.js` (+ optional per-tool file as tools split continues)                                       |

## Slow tests (Anything slot)

These spawn isolated jsdom child processes by design (ADR-0008):

- `apps/server/test/anythingRuntimeCheck.test.js`
- `apps/server/test/anythingLangChainAgent.test.js`
- `apps/server/test/anythingHtmlTool.test.js`

They still run in CI (`npm test`) and when your diff touches Anything code. For unrelated server edits, `test:affected` and `test:fast` skip them.

## Offline benches (not in `npm test`)

| Slot     | Command                                                   |
| -------- | --------------------------------------------------------- |
| Mermaid  | `node apps/server/scripts/benchMermaid.js --tag <label>`  |
| Anything | `node apps/server/scripts/benchAnything.js --tag <label>` |

Use after sanitizer / validation ladder changes when unit tests are not enough.

## Hygiene checks

`npm run verify:agent-infra` ensures agent docs cite real `npm run` scripts and blast-radius test paths. When you add a new canonical test file, link it from [`docs/agent-blast-radius.md`](../agent-blast-radius.md) so the check stays green.

## Related

- [`docs/agents/sensors.md`](sensors.md) — lint, boundaries, Prettier
- [`docs/recipes/`](../recipes/) — wire-change playbooks with test steps
- [ADR-0007](../decisions/0007-sensors-for-coding-agents.md) — tests + recipes as the teaching layer
