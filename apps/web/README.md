# Web App Notes

UI package for Mermaid Architect.

## Key UX points
- **Go** streams diagram intents through `/api/copilotkit/agent-stream` while mirroring thoughts into the insights pane.
- **Refine / Innovate / Go Mad** plus **Critique / Explain** reuse that pane for streamed telemetry or prose-only analyses.
- **Clear** resets the diagram to the default HK hackathon starter; Monaco stays synced via `/api/copilotkit/state`.

## Runtime wiring
- CopilotKit provider runtime URL points to `${VITE_API_BASE_URL}/api/copilotkit`.
- State and actions are handled in `src/state/diagramStore.js`.

## Dev commands
- Run web only: `npm run dev -w apps/web`
- Test web only: `npm run test -w apps/web`
