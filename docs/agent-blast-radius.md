# Agent blast radius — wire change checklist

Recipes in [`docs/recipes/`](../docs/recipes/) describe **how** to add a feature. This doc lists **what else must change** when you touch a contract so coding agents do not ship producer-only diffs.

## AG-UI custom stream event (built-in agents)

| Layer                 | Location                                                                                                                                                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema / legacy union | [`packages/shared/src/legacyStreamEvents.ts`](../packages/shared/src/legacyStreamEvents.ts), [`agUiWireConstants.ts`](../packages/shared/src/agUiWireConstants.ts)                                                                                                            |
| Emitter               | [`packages/shared/src/agentStreamEmitter.ts`](../packages/shared/src/agentStreamEmitter.ts)                                                                                                                                                                                   |
| Server emit point     | [`apps/server/src/agents/agentStreamAnalyzeFinalize.ts`](../apps/server/src/agents/agentStreamAnalyzeFinalize.ts) or LangChain agent                                                                                                                                          |
| Web translator        | [`apps/web/src/state/agUiTranslator.ts`](../apps/web/src/state/agUiTranslator.ts)                                                                                                                                                                                             |
| Insight reducer       | [`apps/web/src/state/applyAgentStreamInsightEvent.ts`](../apps/web/src/state/applyAgentStreamInsightEvent.ts)                                                                                                                                                                 |
| UI                    | [`apps/web/src/components/InsightsPane.jsx`](../apps/web/src/components/InsightsPane.jsx) or sibling surface                                                                                                                                                                  |
| Tests                 | [`packages/shared/test/wireRoundTrip.test.ts`](../packages/shared/test/wireRoundTrip.test.ts), [`apps/web/test/wireAgUiTranslator.test.js`](../apps/web/test/wireAgUiTranslator.test.js), [`apps/server/test/copilotRoute.test.js`](../apps/server/test/copilotRoute.test.js) |
| Docs                  | [`docs/architecture-ag-ui.md`](../docs/architecture-ag-ui.md), recipe [`add-agent-stream-event.md`](../docs/recipes/add-agent-stream-event.md)                                                                                                                                |

Run: `npm run check:wire`

## Session-events SSE (collaboration)

| Layer                         | Location                                                                                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bus schema + publish          | [`apps/server/src/state/sessionEventBus.ts`](../apps/server/src/state/sessionEventBus.ts)                                                                                              |
| Producer (route / MCP / tool) | Matching handler in [`copilot.ts`](../apps/server/src/routes/copilot.ts) or [`mcpServer.js`](../apps/server/src/mcp/mcpServer.js)                                                      |
| Web client                    | [`apps/web/src/state/sessionEventsClient.js`](../apps/web/src/state/sessionEventsClient.js)                                                                                            |
| MCP App bridge (if UI)        | [`apps/server/src/mcp/apps/mcpAppSessionBridge.js`](../apps/server/src/mcp/apps/mcpAppSessionBridge.js) + App HTML bundle                                                              |
| Tests                         | [`apps/server/test/sessionEventBus.test.js`](../apps/server/test/sessionEventBus.test.js), [`apps/web/test/sessionEventsClient.test.js`](../apps/web/test/sessionEventsClient.test.js) |
| Docs                          | [`docs/architecture-external-agents.md`](../docs/architecture-external-agents.md)                                                                                                      |

## Chart validation ladder

| Layer         | Location                                                                                                                                                                                                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared schema | [`packages/shared/src/chartSchema.ts`](../packages/shared/src/chartSchema.ts)                                                                                                                                                                                               |
| Server tool   | [`apps/server/src/tools/chartDslTool.js`](../apps/server/src/tools/chartDslTool.js)                                                                                                                                                                                         |
| Syntax fixer  | [`apps/server/src/agents/chartSyntaxFixer.js`](../apps/server/src/agents/chartSyntaxFixer.js)                                                                                                                                                                               |
| Tests         | [`packages/shared/test/chartSchema.test.ts`](../packages/shared/test/chartSchema.test.ts), [`apps/server/test/chartDslTool.test.js`](../apps/server/test/chartDslTool.test.js), [`apps/server/test/chartSyntaxFixer.test.js`](../apps/server/test/chartSyntaxFixer.test.js) |

## Forms validation ladder

| Layer             | Location                                                                                                                                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared parse gate | [`packages/shared/src/formsA2ui.ts`](../packages/shared/src/formsA2ui.ts)                                                                                                                                                                                                       |
| Server tool       | [`apps/server/src/tools/formsA2uiTool.js`](../apps/server/src/tools/formsA2uiTool.js)                                                                                                                                                                                           |
| Tests             | [`packages/shared/test/formsA2ui.test.ts`](../packages/shared/test/formsA2ui.test.ts), [`apps/server/test/formsA2uiTool.test.js`](../apps/server/test/formsA2uiTool.test.js), [`apps/server/test/formsLangChainAgent.test.js`](../apps/server/test/formsLangChainAgent.test.js) |

## HTTP / Zod body (intent, transform, analyze, style, user-edit)

| Layer          | Location                                                                                                                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema         | [`packages/shared/src/diagramSchema.ts`](../packages/shared/src/diagramSchema.ts)                                                                                                                                                                                                           |
| Inferred types | [`apps/server/src/routes/copilotRouteTypes.ts`](../apps/server/src/routes/copilotRouteTypes.ts)                                                                                                                                                                                             |
| Route handler  | [`apps/server/src/routes/copilot.ts`](../apps/server/src/routes/copilot.ts)                                                                                                                                                                                                                 |
| Dispatcher     | [`apps/server/src/agents/diagramAgentDispatcher.js`](../apps/server/src/agents/diagramAgentDispatcher.js)                                                                                                                                                                                   |
| Web client     | [`apps/web/src/state/diagramStore.js`](../apps/web/src/state/diagramStore.js), [`App.jsx`](../apps/web/src/App.jsx)                                                                                                                                                                         |
| Tests          | [`apps/server/test/copilotRoute.test.js`](../apps/server/test/copilotRoute.test.js), [`apps/server/test/diagramAgentDispatcher.test.js`](../apps/server/test/diagramAgentDispatcher.test.js), [`packages/shared/test/diagramSchema.test.ts`](../packages/shared/test/diagramSchema.test.ts) |

When you change **`uiLocale` on diagram POST bodies**, also run [`apps/web/test/diagramStore.test.js`](../apps/web/test/diagramStore.test.js) (omit/include on intent/transform/analyze) and [`packages/shared/test/promptLanguage.test.ts`](../packages/shared/test/promptLanguage.test.ts).

When you change **which `contentType` values `POST /user-edit` accepts**, add a family adapter in [`apps/web/src/utils/canvasGraphEdit.js`](../apps/web/src/utils/canvasGraphEdit.js), mutator tests, a `copilotRoute.test.js` apply/reject case, and a row in [`docs/canvas-graph-edit.md`](canvas-graph-edit.md). Recipe: [`add-graph-edit-family.md`](recipes/add-graph-edit-family.md).

When you change **`createLazyAgentService`** or per-slot `runAgentStream` wiring, run [`apps/server/test/createLazyAgentService.test.js`](../apps/server/test/createLazyAgentService.test.js).

Run: `npm run check:fast` when only shared changed; `npm run check` otherwise.

## MCP tool

| Layer             | Location                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool registration | [`apps/server/src/mcp/tools/register*.js`](../apps/server/src/mcp/tools/) composed from [`mcpServer.js`](../apps/server/src/mcp/mcpServer.js) |
| Optional App HTML | [`apps/server/src/mcp/apps/`](../apps/server/src/mcp/apps/)                                                                                   |
| Tests             | [`apps/server/test/mcpServer.test.js`](../apps/server/test/mcpServer.test.js)                                                                 |
| Docs              | [`docs/guide/external-agents.md`](../docs/guide/external-agents.md)                                                                           |

## Mermaid validation / sanitizer

| Layer            | Location                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Shared sanitizer | [`packages/shared/src/mermaidSanitizer.ts`](../packages/shared/src/mermaidSanitizer.ts)                                 |
| Server tool      | [`apps/server/src/tools/mermaidDiffTool.js`](../apps/server/src/tools/mermaidDiffTool.js)                               |
| Rule pack        | [`apps/server/src/prompts/mermaidSyntaxGuard.js`](../apps/server/src/prompts/mermaidSyntaxGuard.js)                     |
| Tests            | [`packages/shared/test/mermaidSanitizer.test.ts`](../packages/shared/test/mermaidSanitizer.test.ts), server agent tests |

## Deliverable format UI (mode picker)

| Layer             | Location                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mode labels       | [`apps/web/src/i18n/locales/controls.en.js`](../apps/web/src/i18n/locales/controls.en.js) `contentModes`                                                                 |
| Option builder    | [`apps/web/src/utils/renderModeAction.js`](../apps/web/src/utils/renderModeAction.js)                                                                                    |
| Empty-state chips | [`apps/web/src/components/EntryRenderAs.jsx`](../apps/web/src/components/EntryRenderAs.jsx)                                                                              |
| Deliverable menu  | [`apps/web/src/components/DeskOsMenuBar.jsx`](../apps/web/src/components/DeskOsMenuBar.jsx)                                                                              |
| Radial picker     | [`apps/web/src/components/RadialActionMenu.jsx`](../apps/web/src/components/RadialActionMenu.jsx)                                                                        |
| Integration       | [`apps/web/test/App.test.jsx`](../apps/web/test/App.test.jsx) (`pickContentMode` helper — menu rows expose label + tech subtitle)                                        |
| Unit              | [`apps/web/test/entryRenderAs.test.jsx`](../apps/web/test/entryRenderAs.test.jsx), [`apps/web/test/renderModeAction.test.js`](../apps/web/test/renderModeAction.test.js) |

`test:affected` pulls `App.test.jsx` when any of the above change (see `scripts/test-affected-lib.mjs`).

## Desk chrome (concentration + bottom row)

| Layer              | Location                                                                                                                                                                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rush / Deep toggle | [`apps/web/src/components/DeskConcentrationChip.jsx`](../apps/web/src/components/DeskConcentrationChip.jsx) on the bottom chrome row via [`DeskBottomActionsSlot.jsx`](../apps/web/src/features/desk/DeskBottomActionsSlot.jsx)                                                         |
| Desk comms icons   | [`apps/web/src/components/DeskActionsDock.jsx`](../apps/web/src/components/DeskActionsDock.jsx) — Mail / Chat / Meeting icons; Headphones / Focus live in Admin (`DeskOsMenuBar`)                                                                                                       |
| Thinking pane      | [`apps/web/src/components/InsightsPane.jsx`](../apps/web/src/components/InsightsPane.jsx) still hosts `ConcentrationControl` in the header tools                                                                                                                                        |
| Integration        | [`apps/web/test/App.test.jsx`](../apps/web/test/App.test.jsx) (`sends quality modelProfile after selecting Deep work` — targets `desk-concentration-chip`)                                                                                                                              |
| Unit               | [`apps/web/test/deskBottomActionsSlot.test.jsx`](../apps/web/test/deskBottomActionsSlot.test.jsx), [`apps/web/test/deskActionsDock.test.jsx`](../apps/web/test/deskActionsDock.test.jsx), [`apps/web/test/officeLayerDeskSlot.test.jsx`](../apps/web/test/officeLayerDeskSlot.test.jsx) |

`test:affected` pulls the integration + unit files above when desk chrome or concentration modules change (see `scripts/test-affected-lib.mjs`).

## Office window manager (phone sheets)

| Layer        | Location                                                                                                                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Presentation | [`apps/web/src/hooks/useWindowPresentation.js`](../apps/web/src/hooks/useWindowPresentation.js), [`apps/web/src/components/FloatingWindow.jsx`](../apps/web/src/components/FloatingWindow.jsx)              |
| Sheet snap   | [`apps/web/src/hooks/useSheetSnap.js`](../apps/web/src/hooks/useSheetSnap.js) (`SHEET_SNAPS`, `DEFAULT_SHEET_SNAP`, gesture thresholds)                                                                     |
| Minimize     | [`apps/web/src/state/overlayStack.js`](../apps/web/src/state/overlayStack.js)                                                                                                                               |
| Design doc   | [`docs/office-window-manager.md`](office-window-manager.md)                                                                                                                                                 |
| Tests        | [`apps/web/test/officeWindowManager.test.jsx`](../apps/web/test/officeWindowManager.test.jsx), [`apps/web/test/useSheetSnap.test.jsx`](../apps/web/test/useSheetSnap.test.jsx), `deskOsFrameStyles.test.js` |

## Office cast + meetings (roster helpers)

| Layer              | Location                                                                                                                                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wire enums**     | [`packages/shared/src/officeScript.ts`](../packages/shared/src/officeScript.ts) (`MEETING_VENUES`, `MeetingVenueSchema`, attendee caps, `OFFICE_MOMENT_SITUATIONS`) — import here first; re-export from cast/personas only for legacy paths                 |
| Cast + roster APIs | [`apps/web/src/utils/officeCast.js`](../apps/web/src/utils/officeCast.js) (`normalizeMeetingRoster`, `buildMeetingAttendeesFromColleagues`, `pickMeetingAttendees`, chrome copy)                                                                            |
| Server prompts     | [`apps/server/src/agents/officePersonas.js`](../apps/server/src/agents/officePersonas.js) (`isSpokenMomentSituation`, `MOMENT_SITUATION_RULES`, `buildMomentSituationReminder`)                                                                             |
| Meeting route      | [`apps/server/src/routes/office.js`](../apps/server/src/routes/office.js)                                                                                                                                                                                   |
| Meeting UI         | [`MeetingOverlay.jsx`](../apps/web/src/components/MeetingOverlay.jsx), [`CallMeetingPicker.jsx`](../apps/web/src/components/CallMeetingPicker.jsx), [`OfficeLayer.jsx`](../apps/web/src/components/OfficeLayer.jsx)                                         |
| Unit               | [`apps/web/test/castTiers.test.js`](../apps/web/test/castTiers.test.js), [`apps/web/test/officeComponents.test.jsx`](../apps/web/test/officeComponents.test.jsx), [`apps/web/test/officeWireContract.test.js`](../apps/web/test/officeWireContract.test.js) |

`test:affected` pulls `castTiers.test.js` and `officeComponents.test.jsx` when `officeCast.js` or office locale bundles change — basename mirror alone misses roster helpers. Changing `officeScript.ts` venue/attendee constants → shared tests + `officeWireContract.test.js` + `officePersonas.test.js` + `officeRoute.test.js`. Adding a value to `OFFICE_MOMENT_SITUATIONS` is a four-place contract (enum, `isSpokenMomentSituation`, rule block, reminder) — see [`docs/office-continuity.md`](office-continuity.md) for `runWalk`.

## Desk work order (SlopNextPrompt)

| Layer       | Location                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| Prompt UI   | [`apps/web/src/components/SlopNextPrompt.jsx`](../apps/web/src/components/SlopNextPrompt.jsx)                     |
| Desk row    | [`apps/web/src/features/desk/DeskBottomActionsSlot.jsx`](../apps/web/src/features/desk/DeskBottomActionsSlot.jsx) |
| Unit        | [`apps/web/test/SlopNextPrompt.test.jsx`](../apps/web/test/SlopNextPrompt.test.jsx)                               |
| Integration | [`apps/web/test/App.test.jsx`](../apps/web/test/App.test.jsx) (entry desk idle chrome — mic vs submit visibility) |

`test:affected` pulls `App.test.jsx` when `SlopNextPrompt.jsx` changes — the basename mirror only runs `SlopNextPrompt.test.jsx`.

## Isometric floor (renderer #2)

| Layer              | Location                                                                                                                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer #2 root   | [`apps/web/src/components/OfficeFloor.jsx`](../../apps/web/src/components/OfficeFloor.jsx), [`officeFloor/`](../../apps/web/src/components/officeFloor/)                                                                                                                                                            |
| Mode toggle        | [`apps/web/src/state/officeViewModeStore.js`](../../apps/web/src/state/officeViewModeStore.js)                                                                                                                                                                                                                      |
| Geometry kernel    | [`apps/web/src/utils/officeFloorPlan.js`](../../apps/web/src/utils/officeFloorPlan.js), [`officeFloorMovement.js`](../../apps/web/src/utils/officeFloorMovement.js), [`officeFloorReach.js`](../../apps/web/src/utils/officeFloorReach.js), [`officeFloorWander.js`](../../apps/web/src/utils/officeFloorWander.js) |
| Mount-one renderer | [`apps/web/src/components/OfficeLayer.jsx`](../../apps/web/src/components/OfficeLayer.jsx) (`onFloor` guards)                                                                                                                                                                                                       |
| Agent test map     | [`docs/agents/isometric-floor-tests.md`](agents/isometric-floor-tests.md)                                                                                                                                                                                                                                           |
| Full floor suite   | `npm run test:floor`                                                                                                                                                                                                                                                                                                |

`test:affected` pulls `ISOMETRIC_FLOOR_BLAST_TESTS` when the diff touches the paths above (see `scripts/test-affected-lib.mjs`). Add new floor tests to that list and the agent doc.

## Office audio (baked assets + playback)

| Layer                       | Location                                                                                                                                                                                                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baked assets                | [`apps/web/src/assets/audio/`](../apps/web/src/assets/audio/) — generated, never hand-edited                                                                                                                                                                                                                |
| Generator                   | [`scripts/generate-office-audio.sh`](../scripts/generate-office-audio.sh) (build-time only; `--dry-run` prints credit cost)                                                                                                                                                                                 |
| Continuous bed              | [`apps/web/src/utils/officeRoomTone.js`](../apps/web/src/utils/officeRoomTone.js), [`hooks/useOfficeRoomTone.js`](../apps/web/src/hooks/useOfficeRoomTone.js)                                                                                                                                               |
| Sampled cues                | [`apps/web/src/utils/officeCueSamples.js`](../apps/web/src/utils/officeCueSamples.js) + [`officeCuePlayers.js`](../apps/web/src/utils/officeCuePlayers.js) (`playOfficeCue` / diegetic `playPropCues`), used by [`useOfficeSoundscape.js`](../apps/web/src/hooks/useOfficeSoundscape.js) and floor prop use |
| Synth cues + shared context | [`apps/web/src/utils/agentChimes.js`](../apps/web/src/utils/agentChimes.js) (exports `getContext`)                                                                                                                                                                                                          |
| Floor→layer cue bridge      | `onFloorCue` in [`officeFloorBridge.js`](../apps/web/src/components/officeFloor/officeFloorBridge.js) → `handleFloorCue` in `OfficeLayer.jsx`; footsteps come from `useWalkAnimation`'s `onLeg`, surface/pan from `floorSurfaceAt` / `stereoPanForTile` in `officeFloorPlan.js`                             |
| Sound gate                  | `tryAgentSound` in [`apps/web/src/ArchiSlop.jsx`](../apps/web/src/ArchiSlop.jsx) — **returns whether it let the call through**; the bed depends on that to stop when muted mid-session                                                                                                                      |
| Docs                        | [`docs/audio-assets.md`](audio-assets.md) (pipeline + licensing), [`docs/office-parody.md`](office-parody.md) §6                                                                                                                                                                                            |

Four coupling traps worth knowing before you touch this:

- **Changing the cue peak ceiling rebalances every cue.** Assets are peak-normalized to −3 dBFS and `officeCueSamples.js` derives each playback gain as the old synth `peakGain` ÷ 0.708. Change `CUE_TARGET_PEAK_DB` in the generator and you must update that gain table too, or every cue silently shifts level.
- **`agentChimes.js` has no test of its own**, so basename matching finds nothing for it. The blast-radius rule covers it explicitly — along with the `.mp3` assets themselves, since a regenerated asset is a behaviour change.
- **A `SAMPLES` row whose `.mp3` does not exist is a build failure, not a fallback.** Vite resolves the `import` at build time. Add the manifest row and generate the asset _first_, wire `officeCueSamples.js` last. Everything else about a new cue (the synth fallback, the trigger, the weight) can land before the asset does — and should, because that keeps the moment audible while the asset is pending.
- **A cue needs a row in `SYNTH_CUE_PLAYERS` or it is silent on first play.** Sampling is best-effort; the fallback is what makes that safe. `officeCuePlayers.test.js` asserts every `SOUNDSCAPE_CUES` and `SAMPLED_CUES` entry has one, and that every `FLOOR_PROP_USES` entry has a `cuesForProp` row — the guard that would have caught the whiteboard being reachable and silent for three slices.

## Agent tooling (diff-scoped tests + verify)

| Layer      | Location                                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resolver   | [`scripts/test-affected-lib.mjs`](../scripts/test-affected-lib.mjs) (`resolveAffectedTests`, `BLAST_RADIUS_RULES`, `AGENT_TOOLING_BLAST_TESTS`)                                                                                 |
| Classifier | [`scripts/check-affected-lib.mjs`](../scripts/check-affected-lib.mjs) (`classifyChangedFiles` — any `scripts/` path is `root` → full `npm run check`)                                                                           |
| Runners    | [`scripts/test-affected.mjs`](../scripts/test-affected.mjs), [`scripts/check-affected.mjs`](../scripts/check-affected.mjs), [`scripts/run-server-tests.mjs`](../scripts/run-server-tests.mjs)                                   |
| Tests      | [`scripts/test-affected.test.mjs`](../scripts/test-affected.test.mjs), [`scripts/check-affected.test.mjs`](../scripts/check-affected.test.mjs), [`scripts/verify-agent-infra.test.mjs`](../scripts/verify-agent-infra.test.mjs) |

`npm run test:affected` pulls `AGENT_TOOLING_BLAST_TESTS` when the diff touches the scripts above (see `scripts/test-affected-lib.mjs`). `*-lib.mjs` edits also basename-match the runner `*.test.mjs` (e.g. `test-affected-lib.mjs` → `test-affected.test.mjs`). `check:affected` still runs the full gate for any `scripts/` change — intentional; see [`docs/agents/sensors.md`](agents/sensors.md) § Known flake.

## Verification commands (quick reference)

| Scope                         | Command                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| Diff-scoped (agents)          | `npm run check:affected`                                                |
| Diff-scoped tests only        | `npm run test:affected`                                                 |
| Shared only                   | `npm run check:fast`                                                    |
| Default (wire via `npm test`) | `npm run check`                                                         |
| Before PR / local CI parity   | `npm run check:full`                                                    |
| Wire + doc paths only         | `npm run check:wire`                                                    |
| Doc links only                | `npm run verify:doc-paths` (scans `docs/guide/` and `docs/agents/` too) |
| Server strict TS islands      | `npm run typecheck:strict -w apps/server`                               |

See [`docs/guide/coding-agents.md`](guide/coding-agents.md) for the full agent verification table and PR checklist.
