# Web App Notes

UI package for ArchiSlop.

## Key UX points
- **Go** streams diagram intents through `/api/copilotkit/agent-stream` while mirroring thoughts into the insights pane.
- **Fix** (after **Critique**) sends another **intent** stream with a client-built prompt derived from the critique; **syntax auto-fix** does the same when the editor shows a parse error.
- **Refine / Innovate / Go Mad** use the **transform** route; **Critique / Explain** use **analyze** (insights only, no diagram tools).
- **Clear** resets the diagram to the default HK hackathon starter; Monaco stays synced via `/api/copilotkit/state`.

## Runtime wiring
- CopilotKit provider runtime URL points to `${VITE_API_BASE_URL}/api/copilotkit`.
- State and actions are handled in `src/state/diagramStore.js`.

## Dev commands
- Run web only: `npm run dev -w apps/web`
- Test web only: `npm run test -w apps/web`
