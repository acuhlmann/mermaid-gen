# STRUCTURE.md — concept → file index

Look up a concept here before grepping. Paths are repo-relative.

## Server

| Concept                                                    | File(s)                                                                       |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Server entrypoint, app wiring                              | `apps/server/src/index.js`                                                    |
| Built-in agent + collaboration routes                      | `apps/server/src/routes/copilot.ts`                                           |
| Advisor companion routes                                   | `apps/server/src/routes/advisor.js`                                           |
| Office-parody moment + meeting routes                      | `apps/server/src/routes/office.js`                                            |
| Diagram repair route (render-error fast path)              | `apps/server/src/routes/diagramRepair.js`                                     |
| Agent dispatcher (content-type → agent service)            | `apps/server/src/agents/diagramAgentDispatcher.js`                            |
| Shared patch+repair ladder (chart/metaphor/anything/forms) | `apps/server/src/agents/_lib/invokePatchAgentWithRepair.js`                   |
| Mermaid agent service                                      | `apps/server/src/agents/mermaidLangChainAgent.js`                             |
| Infographic agent service                                  | `apps/server/src/agents/infographicLangChainAgent.js`                         |
| Metaphor3D agent service                                   | `apps/server/src/agents/metaphorLangChainAgent.js`                            |
| Chart agent service                                        | `apps/server/src/agents/chartLangChainAgent.js`                               |
| Anything agent service                                     | `apps/server/src/agents/anythingLangChainAgent.js`                            |
| Forms agent service (model-authored A2UI)                  | `apps/server/src/agents/formsLangChainAgent.js`                               |
| Mermaid syntax fixer (single-shot, no tools)               | `apps/server/src/agents/mermaidSyntaxFixer.js`                                |
| Infographic syntax fixer                                   | `apps/server/src/agents/infographicSyntaxFixer.js`                            |
| Mermaid diagram-type rule packs                            | `apps/server/src/prompts/mermaidSyntaxGuard.js`                               |
| Infographic rule packs                                     | `apps/server/src/prompts/infographicSyntaxGuard.js`                           |
| Anything design craft rule pack                            | `apps/server/src/prompts/anythingDesignGuide.js`                              |
| Forms parody prompt + A2UI authoring contract              | `apps/server/src/prompts/formsSystemPrompt.js`, `formsSyntaxGuard.js`         |
| Anything search/replace edit application                   | `apps/server/src/agents/_lib/searchReplaceEdits.js`                           |
| Advisor prompts (Slopitect persona)                        | `apps/server/src/agents/advisorPrompts.js`                                    |
| Office colleague voices + meeting script prompts           | `apps/server/src/agents/officePersonas.js`                                    |
| Critique markdown → A2UI checklist stream                  | `apps/server/src/agents/critiqueA2uiStream.ts`                                |
| Analyze finalize (critique / explain / style emits)        | `apps/server/src/agents/agentStreamAnalyzeFinalize.ts`                        |
| AG-UI stream emitter + wire types (shared)                 | `packages/shared/src/agentStreamEmitter.ts`, `agUiEventTypes.ts`              |
| LangGraph ReAct config knobs                               | `apps/server/src/agents/agentGraphConfig.js`                                  |
| LLM backend selection (Vertex / OpenRouter / DeepSeek)     | `apps/server/src/agents/llmProvider.js`                                       |
| CopilotKit runtime wrapper                                 | `apps/server/src/agents/copilotRuntimeAgent.js`                               |
| Diagram tools registry (LangChain `Tool[]`)                | `apps/server/src/agents/diagramTools.js`                                      |
| Mermaid validate + sanitizer rescue tool                   | `apps/server/src/tools/mermaidDiffTool.js`                                    |
| Infographic validate + sanitizer rescue tool               | `apps/server/src/tools/infographicDslTool.js`                                 |
| Chart validate + Vega-Lite compile tool                    | `apps/server/src/tools/chartDslTool.js`                                       |
| Anything validate + policy/quality lint tool               | `apps/server/src/tools/anythingHtmlTool.js`                                   |
| Forms validate (A2UI allowlist parser)                     | `apps/server/src/tools/formsA2uiTool.js`, `packages/shared/src/formsA2ui.ts`  |
| Session services registry                                  | `apps/server/src/state/sessionServices.js`                                    |
| Per-session diagram store (six slots)                      | `apps/server/src/state/diagramStateStore.ts`                                  |
| Session event bus (SSE feed)                               | `apps/server/src/state/sessionEventBus.ts`                                    |
| Pairing code store factory (in-memory / Redis)             | `apps/server/src/state/pairingCodeStoreFactory.js`                            |
| Agent token store                                          | `apps/server/src/state/agentTokenStore.js`                                    |
| MCP server + tool registration                             | `apps/server/src/mcp/mcpServer.js` + `apps/server/src/mcp/tools/register*.js` |
| MCP binding snapshot                                       | `apps/server/src/mcp/mcpBindingSnapshot.js`                                   |
| MCP App HTML bundles (Gen UI)                              | `apps/server/src/mcp/apps/`                                                   |
| MCP rate limiting                                          | `apps/server/src/mcp/mcpRateLimit.js`                                         |
| Production CSP                                             | `apps/server/src/security/productionCsp.js`                                   |
| Invite token HMAC                                          | `apps/server/src/utils/inviteToken.js`                                        |
| Mermaid run-budget shared timer                            | `packages/shared/src/agentRunBudget.ts`                                       |
| Agent turn metrics emitter                                 | `apps/server/src/metrics/agentTurnMetrics.js`                                 |

## Web

| Concept                                                                                                               | File(s)                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web entry                                                                                                             | `apps/web/src/main.jsx`                                                                                                                                                                                                                                                                                                                                                                      |
| Root app component                                                                                                    | `apps/web/src/App.jsx`                                                                                                                                                                                                                                                                                                                                                                       |
| Mermaid / Infographic / Metaphor3D / Chart / Anything / Forms renderer                                                | `apps/web/src/components/DiagramCanvas.jsx`, `apps/web/src/components/InfographicRenderer.jsx`, `apps/web/src/components/MetaphorRenderer.jsx`, `apps/web/src/components/ChartRenderer.jsx`, `apps/web/src/components/AnythingRenderer.jsx`, `apps/web/src/components/FormsRenderer.jsx`                                                                                                     |
| Insights / Thinking pane                                                                                              | `apps/web/src/components/InsightsPane.jsx`                                                                                                                                                                                                                                                                                                                                                   |
| Radial action menu (mobile)                                                                                           | `apps/web/src/components/RadialActionMenu.jsx`                                                                                                                                                                                                                                                                                                                                               |
| Critique checklist (A2UI surface)                                                                                     | `apps/web/src/components/CritiqueA2uiSurface.jsx`, `apps/web/src/components/CritiqueActionableChecklist.jsx`                                                                                                                                                                                                                                                                                 |
| Agent presence + handshake + proposal cards                                                                           | `apps/web/src/components/AgentPresenceBar.jsx`, `AgentHandshakeDialog.jsx`, `AgentProposalCard.jsx`                                                                                                                                                                                                                                                                                          |
| Invite agent dialog (pairing code, QR, deeplinks)                                                                     | `apps/web/src/components/InviteAgentDialog.jsx`                                                                                                                                                                                                                                                                                                                                              |
| Slopitect companion overlays                                                                                          | `apps/web/src/components/Slopitect*.jsx`, `LevelUpInfoPanel.jsx`, `RunCeremonyOverlays.jsx`, `StakeholdersMascot.jsx`                                                                                                                                                                                                                                                                        |
| Office-parody ambience chrome (inbox, IMs, walk-bys, coffee breaks, cubicle battles, meetings)                        | `apps/web/src/components/OfficeLayer.jsx` (+ `Office*.jsx`, `CoffeeBreakOverlay.jsx`, `OfficeBattleOverlay.jsx`, `Meeting*.jsx`), `apps/web/src/hooks/useOfficeAmbience.js`, `useMeetingPlayback.js`, `apps/web/src/state/officeMomentStore.js`, `apps/web/src/utils/officeCast.js`, `officeCadence.js`                                                                                      |
| Office soundscape (keyboard, mouse, paper, chair, printer, phone, watercooler, espresso, vending, elevator room tone) | `apps/web/src/utils/officeSoundscape.js` (pure scheduler), `apps/web/src/hooks/useOfficeSoundscape.js` (director), cues in `apps/web/src/utils/agentChimes.js`                                                                                                                                                                                                                               |
| Office narration (walk-bys, meetings, battles, coffee; emails/IMs silent)                                             | `apps/web/src/utils/officeNarration.js` + `POST /api/office/speak` (`apps/server/src/agents/officeTts.js` Chirp3-HD default with a Chirp3-HD → Neural2 → WaveNet → Web Speech fallback ladder); toggle in `officeAmbienceStorage.js` / inbox dock                                                                                                                                            |
| Office dialogue language (cast speaks the UI locale, not the diagram's script)                                        | `officeDialogueLocale()` in `apps/web/src/utils/officeCast.js` → `uiLocale` on `POST /api/office/{moment,meeting,meeting/interject}` → `buildOfficeLanguageRule` / `buildOfficeLanguageReminder` in `apps/server/src/agents/officePersonas.js`                                                                                                                                               |
| Slop Chat™ messenger (durable IM history, replies)                                                                    | `apps/web/src/components/OfficeMessenger.jsx` + `officeImThreads.js`; `imHistory` / `imUnreadCount` in `apps/web/src/state/officeMomentStore.js`; opened from the chat tab in `OfficeImPing.jsx`                                                                                                                                                                                             |
| Office character faces (parametric SVG avatars for the whole cast)                                                    | `apps/web/src/components/personaFaces/index.jsx` (`<PersonaFace>`) + `registry.js` (per-persona traits); accent color via `officeSenderInfo` in `apps/web/src/utils/officeCast.js`                                                                                                                                                                                                           |
| Isometric mode (the office floor — renderer #2, ADR-0011)                                                             | `apps/web/src/components/OfficeFloor.jsx` (+ `officeFloor/*`, `OfficeFloor.css`), layout in `apps/web/src/utils/officeFloorPlan.js`, mode in `apps/web/src/state/officeViewModeStore.js`, scaling in `apps/web/src/hooks/useStageScale.js`; design: [`docs/office-isometric-mode.md`](docs/office-isometric-mode.md)                                                                         |
| First-run arrival on the floor (reception → intros → walk to your desk)                                               | `apps/web/src/components/officeFloor/FloorArrival.jsx` (mounted by `ArchiSlop.jsx` on `officeBootPending`); walk motion in `officeFloor/useWalkAnimation.js`; card-tour fallback stays `apps/web/src/components/OfficeDirectory.jsx`                                                                                                                                                         |
| Meetings on the floor (glass room — the call window's second renderer)                                                | `apps/web/src/components/officeFloor/FloorMeeting.jsx` (room + its card); seats/`meetingSeating` in `apps/web/src/utils/officeFloorPlan.js`; state stays in `apps/web/src/hooks/useMeetingPlayback.js`, window renderer stays `apps/web/src/components/MeetingOverlay.jsx` (hidden while you stand)                                                                                          |
| Desk peeking (walk over to see what a colleague is "working on")                                                      | `apps/web/src/components/officeFloor/FloorPeek.jsx` (+ `FloorPlayer.jsx`, `FloorDeskSpeech.jsx`); the _Their-own-work_ fiction in `apps/web/src/utils/officeDeskWork.js`, screen art in `officeFloor/isoArt.jsx` (`MonitorScreen`), marks derived by `peekTileFor` in `apps/web/src/utils/officeFloorPlan.js`                                                                                |
| Free roam on the floor (click or arrow-key a tile and walk there)                                                     | `apps/web/src/components/officeFloor/FloorRoam.jsx` (click surface + hover marker), `officeFloor/useFloorPresence.js` (where you are standing — view state, absorbed the peek), `officeFloor/useFloorKeyboard.js`, `officeFloor/useFloorAutoPan.js`; where you may stand in `apps/web/src/utils/officeFloorMovement.js` on top of `isStandableTile` / `unprojectIso` in `officeFloorPlan.js` |
| Office narration roadmap (TTS follow-ups)                                                                             | [`docs/office-narration-roadmap.md`](docs/office-narration-roadmap.md)                                                                                                                                                                                                                                                                                                                       |
| Office onboarding (entry-screen directory + first-run welcome beats)                                                  | `apps/web/src/components/OfficeDirectory.jsx`, `apps/web/src/hooks/useOfficeWelcome.js`, flags in `apps/web/src/utils/officeAmbienceStorage.js`                                                                                                                                                                                                                                              |
| Office locale bundles (en-AU / zh-CN / zh-TW office copy)                                                             | `apps/web/src/i18n/locales/office.*.js`, merged in `apps/web/src/i18n/getUiLocaleBundle.js`, applied via `setActiveOfficeBundle` in `apps/web/src/utils/officeCast.js`                                                                                                                                                                                                                       |
| Hotkey overlay                                                                                                        | `apps/web/src/components/HotkeyOverlay.jsx`                                                                                                                                                                                                                                                                                                                                                  |
| Embedded diagram preview in insights                                                                                  | `apps/web/src/components/InsightsEmbeddedDiagram.jsx`                                                                                                                                                                                                                                                                                                                                        |
| Web store (intent / stream / sync / cache)                                                                            | `apps/web/src/state/diagramStore.js`                                                                                                                                                                                                                                                                                                                                                         |
| Session-events SSE client                                                                                             | `apps/web/src/state/sessionEventsClient.js`                                                                                                                                                                                                                                                                                                                                                  |
| AG-UI stream → insight mapper                                                                                         | `apps/web/src/state/applyAgentStreamInsightEvent.ts`, `agUiTranslator.ts`                                                                                                                                                                                                                                                                                                                    |
| Run gamification store (XP, streaks)                                                                                  | `apps/web/src/state/runGamificationStore.js`                                                                                                                                                                                                                                                                                                                                                 |
| Mermaid render init / preview / source-locate                                                                         | `apps/web/src/utils/mermaidRenderInit.js`, `renderMermaidPreview.js`, `mermaidSourceLocate.js`                                                                                                                                                                                                                                                                                               |
| Infographic hit-testing                                                                                               | `apps/web/src/utils/infographicHitTest.js`                                                                                                                                                                                                                                                                                                                                                   |
| Diagram SVG selection + highlight                                                                                     | `apps/web/src/utils/diagramSvgSelection.js`, `applyDiagramHighlightToSvg.js`                                                                                                                                                                                                                                                                                                                 |
| Agent chimes (audio)                                                                                                  | `apps/web/src/utils/agentChimes.js`                                                                                                                                                                                                                                                                                                                                                          |
| Advisor orchestration hook                                                                                            | `apps/web/src/hooks/useAdvisorOrchestrator.js`                                                                                                                                                                                                                                                                                                                                               |
| Hotkey hook                                                                                                           | `apps/web/src/hooks/useDiagramHotkeys.js`                                                                                                                                                                                                                                                                                                                                                    |
| Monaco language registration                                                                                          | `apps/web/src/utils/registerMermaidMonacoOnce.js`, `registerInfographicMonacoOnce.js`                                                                                                                                                                                                                                                                                                        |

## Shared (`packages/shared`)

| Concept                                                         | File(s)                                                                                                                                                        |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All Zod schemas (`SessionDiagramStateSchema`, `PatchSchema`, …) | `packages/shared/src/diagramSchema.ts`                                                                                                                         |
| Metaphor3D schema + sanitizer                                   | `packages/shared/src/metaphorSchema.ts`, `metaphorSanitizer.ts`                                                                                                |
| Metaphor3D → USDA author (ADR-0009 steps 1–2)                   | `packages/shared/src/metaphorUsda.ts` (mapping spec: `docs/guide/metaphor-usda-mapping.md`)                                                                    |
| Chart schema + DSL parser                                       | `packages/shared/src/chartSchema.ts`                                                                                                                           |
| Anything schema + iframe sandbox constants                      | `packages/shared/src/anythingSchema.ts`                                                                                                                        |
| Anything inline-lib registry + `@lib:` marker lint              | `packages/shared/src/anythingLibs.ts`                                                                                                                          |
| Anything lib expansion + vendored bytes (subpath export)        | `packages/shared/src/anythingLibVendor.ts`, `packages/shared/src/vendor/anythingLibSources.ts` (generated by `packages/shared/scripts/vendorAnythingLibs.mjs`) |
| Mermaid deterministic sanitizer                                 | `packages/shared/src/mermaidSanitizer.ts`                                                                                                                      |
| Infographic deterministic sanitizer                             | `packages/shared/src/infographicSanitizer.ts`                                                                                                                  |
| AG-UI wire constants + event types                              | `packages/shared/src/agUiWireConstants.ts`, `agUiEventTypes.ts`                                                                                                |
| AG-UI stream emitter (server-side helper)                       | `packages/shared/src/agentStreamEmitter.ts`                                                                                                                    |
| Legacy stream event union (client semantic layer)               | `packages/shared/src/legacyStreamEvents.ts`                                                                                                                    |
| A2UI critique message builder                                   | `packages/shared/src/critiqueA2uiMessages.ts`, `critiqueActionable.ts`                                                                                         |
| Explain / style Gen UI payloads                                 | `packages/shared/src/explainSections.ts`, `styleEdits.ts`                                                                                                      |
| Mermaid graph metrics (node/edge counts)                        | `packages/shared/src/mermaidGraphMetrics.ts`                                                                                                                   |
| Mermaid style helpers (`%%init%%`, classDef)                    | `packages/shared/src/mermaidStyle.ts`                                                                                                                          |
| Mermaid transform policy (caps per mode)                        | `packages/shared/src/mermaidTransformPolicy.ts`                                                                                                                |
| Infographic transform policy                                    | `packages/shared/src/infographicTransformPolicy.ts`                                                                                                            |
| Infographic diff (for proposal preview)                         | `packages/shared/src/infographicDiff.ts`                                                                                                                       |
| Infographic refine pre-pass                                     | `packages/shared/src/infographicRefinePrepass.ts`                                                                                                              |
| SVG sanitizer                                                   | `packages/shared/src/sanitizeSvg.ts`                                                                                                                           |
| Label "explain dumb" levels                                     | `packages/shared/src/labelExplainDumbLevels.ts`                                                                                                                |
| Run budget timer                                                | `packages/shared/src/agentRunBudget.ts`                                                                                                                        |

## Tests

| Concept                | File(s)                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------- |
| Server tests           | `apps/server/test/*.test.js` (run via `node --test`)                               |
| Web tests              | `apps/web/test/*.test.{js,jsx}` (run via Vitest)                                   |
| Shared tests           | `packages/shared/test/*.test.ts` (run via `node --test`)                           |
| Mermaid offline bench  | `apps/server/scripts/benchMermaid.js` (snapshots in `apps/server/bench-results/`)  |
| Anything offline bench | `apps/server/scripts/benchAnything.js` (snapshots in `apps/server/bench-results/`) |

## Human guides (`docs/guide/`)

| Concept                               | File                                                                |
| ------------------------------------- | ------------------------------------------------------------------- |
| Guide index                           | `docs/guide/README.md`                                              |
| Quick start, product, system overview | `docs/guide/quick-start.md`, `product.md`, `system-overview.md`     |
| Content types (six slots)             | `docs/guide/content-types.md`                                       |
| Agents, validation, MCP quick start   | `docs/guide/agents.md`, `validation.md`, `external-agents.md`       |
| Config, API routes, development       | `docs/guide/configuration.md`, `api-endpoints.md`, `development.md` |
| Coding agents (verification, PR)      | `docs/guide/coding-agents.md`                                       |

## Architecture docs (read before changing wire contracts)

| Concept                                           | File                                   |
| ------------------------------------------------- | -------------------------------------- |
| Gen UI layer map (AG-UI + A2UI + MCP Apps)        | `docs/architecture-generative-ui.md`   |
| External agents (MCP join, handshakes, proposals) | `docs/architecture-external-agents.md` |
| AG-UI SSE contract                                | `docs/architecture-ag-ui.md`           |
| A2UI critique checklist contract                  | `docs/architecture-a2ui.md`            |
| Cloud Run deploy                                  | `docs/deploy/gcp.md`                   |
| LLM backend resolution                            | `docs/llm-config.md`                   |
| ADRs (past decisions)                             | `docs/decisions/`                      |
| Task recipes                                      | `docs/recipes/`                        |

## Agent operator docs (`docs/agents/`)

| Concept              | File                           |
| -------------------- | ------------------------------ |
| Sensors (lint stack) | `docs/agents/sensors.md`       |
| Modularity review    | `docs/agents/modularity.md`    |
| Issue tracker        | `docs/agents/issue-tracker.md` |
| Triage labels        | `docs/agents/triage-labels.md` |
| Domain doc layout    | `docs/agents/domain.md`        |

## Build & deploy

| Concept                              | File(s)                                         |
| ------------------------------------ | ----------------------------------------------- |
| Root workspaces + scripts            | `package.json`                                  |
| CI workflow                          | `.github/workflows/ci.yml`                      |
| Cloud Run deploy workflow            | `.github/workflows/deploy-cloud-run.yml`        |
| Cloud Run deploy script              | `scripts/deploy-cloud-run.sh`                   |
| Hackathon Cloud Run deploy script    | `scripts/deploy-hackathon-cloud-run.sh`         |
| Secret Manager push (invite token)   | `scripts/push-invite-token-secret-cloud-run.sh` |
| Secret Manager push (OpenRouter key) | `scripts/push-openrouter-secret-cloud-run.sh`   |
| gcloud SDK bootstrap                 | `scripts/setup-gcloud.sh`                       |
| Docker production image              | `Dockerfile`                                    |
