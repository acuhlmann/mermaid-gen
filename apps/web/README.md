# Web App Notes

UI package for Mermaid Architect.

## Key UX points
- The primary input bar triggers the Intent Agent path.
- Agent Settings include a dedicated **Co-Author Surprise Mode** button for manual creative extensions.
- Monaco editor + Mermaid preview stay in sync with the shared server diagram state.

## Runtime wiring
- CopilotKit provider runtime URL points to `${VITE_API_BASE_URL}/api/copilotkit`.
- State and actions are handled in `src/state/diagramStore.js`.

## Dev commands
- Run web only: `npm run dev -w apps/web`
- Test web only: `npm run test -w apps/web`
