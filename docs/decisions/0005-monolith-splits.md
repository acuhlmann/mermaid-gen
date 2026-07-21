# ADR-0005: Splitting monolithic files for agent-friendly editing

**Status:** In progress (extraction underway)

## Context

A handful of files in `apps/web` and `apps/server` have grown into 1 000–4 000 LOC
monoliths. Concretely, before this ADR landed:

| File                                              | LOC   | Shape                                                               |
| ------------------------------------------------- | ----- | ------------------------------------------------------------------- |
| `apps/web/src/App.jsx`                            | 4 292 | One component with 143 hooks + 38 inline helpers + 4 000 LOC of JSX |
| `apps/server/src/mcp/mcpServer.js`                | 1 551 | One closure registering 14 tools + 4 resources inline               |
| `apps/web/src/components/InsightsPane.jsx`        | 1 475 | Single component                                                    |
| `apps/server/src/agents/mermaidLangChainAgent.js` | 1 350 | Agent loop + repair flow + finalize in one module                   |
| `apps/web/src/components/DiagramCanvas.jsx`       | 1 376 | Renderer + selection + diff + highlight                             |

For coding agents, these are bottleneck files: every feature in the area requires
a long-context edit, and unrelated work serializes through the same file.

## Decision

Split each monolith along seams that already exist in the code. Always preserve
wire contracts; the integration test suites (`copilotRoute.test.js`,
`mcpServer.test.js`, web Vitest suite) catch regressions.

The default extraction pattern is **closure-helper-to-sibling-module**: pure helpers
move to a co-located `*Helpers.{js,ts}` module, then per-feature blocks move to
their own files that import from the shared helpers + take a `ctx` argument when
they need access to outer-closure state.

## Progress

### `mcpServer.js` (~1 542 → ~1 413 LOC)

- ✅ Helpers extracted to `apps/server/src/mcp/mcpHelpers.js`
  (`textResult`, `jsonResult`, `safeError`, `humanOnlyMcpToolBlocked`,
  `originFromMcpEntry`, `requireRegisteredAgent`, `pairingFailureMessage`).
- ✅ Binding snapshot extracted to `apps/server/src/mcp/mcpBindingSnapshot.js`.
- ✅ First per-tool modules under `apps/server/src/mcp/tools/`:
  `registerGetMcpBinding`, `registerGetSessionBootstrap`,
  `registerOpenSessionPairing`, `registerHumanOnlyAppTools` (four human-only
  stubs). Remaining tools still inline; continue the
  `register{ToolName}(server, ctx)` pattern from `tools/README.md`.

### Shared repair ladder (agent maintainability)

- ✅ `invokePatchAgentWithRepair` in
  `apps/server/src/agents/_lib/invokePatchAgentWithRepair.js` — immutable-transcript
  repair loop shared by chart, metaphor3d, anything, and forms agents.
  Mermaid and Infographic keep bespoke loops (stable-agent fallback) until they
  converge on the same helper.

### `App.jsx` / `ArchiSlop.jsx` (4 292 → 12 LOC entry + ~3 590 LOC shell, -870 LOC total)

- ✅ Module-scope helpers extracted to `apps/web/src/utils/app*.js`
  (`appConfetti`, `appToolLabels`, `appStreamDebug`, `appInsightHelpers`,
  `appSessionLocation`, `appActionPersonas`).
- ✅ Icon components extracted to `apps/web/src/components/AppIcons.jsx`.
- ✅ Action-persona UI bits extracted to
  `apps/web/src/components/ActionPersonaBits.jsx`.
- ✅ `AiCornerControlsInner` (~115 LOC) extracted to its own file.
- ✅ `useSyncVisualViewportHeight` extracted to
  `apps/web/src/hooks/useSyncVisualViewportHeight.js`.
- ✅ **Entry split:** `App.jsx` is now a 12-line `UiLocaleProvider` wrapper;
  the shell lives in `apps/web/src/ArchiSlop.jsx`.
- ✅ **Feature hooks:** `useVoiceInput`, `useStyleEdits`, `useSubmitIntent`, `useAnalyzeFlow` under `hooks/`.
- ✅ **Feature modules:** `features/insights/InsightsSlot.jsx` (Thinking pane
  wiring + `useCritiqueActionableUi`), `features/ceremony/CeremonyOverlaysSlot.jsx`,
  `features/session/` (`useSessionCollaboration`, `useSessionHydrate`,
  `SessionCollaborationSlot`), `features/prompt/` (`useSlopitectTips`,
  `useRadialMenu`, `SlopitectTipSlot`), `features/advisor/useAdvisorShell`,
  `components/buildRadialActions.jsx`, `utils/appConstants.js`,
  `utils/formatFormAnswer.js`.
  (JSX that imports `components/` must not live under `utils/` — see
  `web-non-component-no-components` in `.dependency-cruiser.cjs`.)
- ⏳ Larger seam: lift remaining major JSX sections (radial menu handler, advisor
  chrome) into wrapper components. Target: `ArchiSlop.jsx` < 1 000 LOC, mostly
  layout + composition.

### Other targets

- ⏳ `InsightsPane.jsx`, `DiagramCanvas.jsx`, `mermaidLangChainAgent.js`,
  `infographicLangChainAgent.js`, `copilot.ts`, `diagramStore.js`,
  `RadialActionMenu.jsx`. Same pattern: extract helpers first, then per-feature
  modules. No work scheduled yet.

## Consequences

- Smaller files mean agents can edit one feature without scrolling through
  unrelated code; multiple agents can work in parallel without merge conflicts
  on a single hub file.
- The `ctx` indirection for per-tool / per-feature files adds one level of
  pointer-chasing for human readers; we accept that in exchange for navigability.
- The CLAUDE.md file-size budget table tracks remaining heavy hitters and is
  updated as each split lands.
