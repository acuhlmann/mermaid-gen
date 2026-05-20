# Recipe: add a new MCP tool

Use when external agents (Cursor, Claude Desktop, VS Code Copilot) need a new capability over MCP — e.g. "let agents query insights" or "let agents toggle focus."

## Steps

1. **Define the tool** in `apps/server/src/mcp/mcpServer.js` inside the existing `server.tool(name, schema, handler)` registration block. Match the surrounding pattern: Zod schema for inputs, async handler returning `{ content: [...] }` (and optionally `{ structuredContent }` for App-aware hosts).
2. **Forward to session services.** The handler runs inside a closure over `getSessionServicesForInput` / pairing. Get session services and call the appropriate method on the in-process services (`stateStore`, `sessionEventBus`, `agentDispatcher`, …). Don't reach into other tools' state directly.
3. **If the tool needs human approval** (anything that mutates the diagram), emit a _proposal_ via `sessionEventBus.publishProposal(...)` and have the tool block on `wait_for_resolution` rather than applying directly. See `propose_diagram_edit` for the reference pattern.
4. **If the tool returns an MCP App URL** (for hosts that support SEP-1865), add a new HTML bundle under `apps/server/src/mcp/apps/` exporting a string. Use an existing bundle (`webCompanionAppHtml.js`, `proposalReviewAppHtml.js`) as the template — they share nav chrome and use the session-event bridge for auto-refresh. Return `{ uri: 'ui://archislop/your-bundle.html' }` from the tool.
5. **Document the tool** in [`docs/guide/external-agents.md`](../guide/external-agents.md) under the _MCP Apps_ table (if it has a UI surface) and the _Other MCP tools_ list (if not). Update [`docs/architecture-external-agents.md`](../architecture-external-agents.md) if the tool changes any of the named flows (join, handshake, proposal, insights).
6. **Add a test** in `apps/server/test/mcpServer.test.js`. The test harness already mocks the session services — copy the closest existing test.
7. **Smoke-test interactively.** `npm run dev`, open the UI, hit _Invite agent_, copy the pairing code, then call your tool from any MCP client (`mcp inspector`, Cursor with the pairing URL, …). Confirm `session-events` shows the right activity and the web UI reflects the change.

## Files you'll touch

- `apps/server/src/mcp/mcpServer.js` — tool registration.
- `apps/server/src/mcp/apps/<your-bundle>.js` — optional MCP App HTML.
- `apps/server/test/mcpServer.test.js` — test.
- `docs/guide/external-agents.md`, `docs/architecture-external-agents.md` — docs.

## Don't forget

- The MCP wire schema is Zod — keep input shape narrow and named.
- External-agent edits **never auto-apply**; if your tool mutates the diagram, route through a proposal.
- Hosts that don't support MCP Apps (some Cursor versions) ignore the App URL; your tool must still work as text-only.
