# Recipe: add a collaboration event on session-events SSE

Use when something that _isn't_ part of an agent run needs to be observable by multiple humans + external agents in the same diagram room — e.g. presence changes, proposals, reactions, focus highlights, attributed insights.

Note: `session-events` is **not AG-UI**. It's a separate SSE feed at `GET /api/copilotkit/session-events`. If your event belongs to an in-flight agent run, use [add-agent-stream-event.md](add-agent-stream-event.md) instead.

## Steps

1. **Name the event.** Use kebab-case, descriptive: `proposal.created`, `presence.focus`, `insight.attributed`. Group by the entity it concerns.
2. **Define the payload** in a Zod schema near the bus (`apps/server/src/state/sessionEventBus.js`). Match the shape of existing events — `{ type, ts, actor, data }` is the convention.
3. **Publish from the producer.** Wherever the state change happens (a route handler, an MCP tool handler, an agent service), get `sessionEventBus` from the session services and call `publish(...)`. The bus deduplicates and persists to the per-session ring buffer that backs the long-poll fallback.
4. **Subscribe on web** via `apps/web/src/state/sessionEventsClient.js`. Add a handler branch and dispatch into the store. The SSE stream is already wired to the store; the new branch just routes to the right reducer.
5. **Subscribe on MCP Apps** if the App should auto-refresh on this event. The shared `session-events.html` bridge wraps the same feed for inside-App use.
6. **Handle long-poll fallback.** Hosts that can't keep an SSE open use `GET /api/copilotkit/session-events?after=<lastEventId>`. The ring buffer already supports this; just make sure your event is emitted via the bus (not a side channel).
7. **Tests.** `apps/server/test/sessionServices.test.js` (or a focused new test file) for the bus publish; `apps/web/test/sessionEventsClient.test.js` for the client handler.
8. **Document.** Add a row in [`docs/architecture-external-agents.md`](../architecture-external-agents.md) under _session-events_.

## Files you'll touch

- `apps/server/src/state/sessionEventBus.js` — schema + publish helper.
- Producer (route, MCP tool, or agent file) — call to `publish`.
- `apps/web/src/state/sessionEventsClient.js` — handler.
- `apps/server/src/mcp/apps/session-events.html` style bundles — if the App needs to react.
- Tests + `docs/architecture-external-agents.md`.

## Don't forget

- session-events is **fan-out per session**. Don't fire it on every tick — events are durable in the ring buffer and consumed by every connected human + external agent.
- Attribute every event to its actor (`actor: { kind: 'agent' | 'human', id, displayName, emoji?, color? }`). The UI relies on this for the avatar in the Insights pane and presence bar.
- If the event triggers a UI affordance with an action (accept/reject a proposal, dismiss an insight), the _action handler_ belongs in a regular HTTP route, not on the SSE feed.
