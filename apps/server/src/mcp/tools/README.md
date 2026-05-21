# MCP tool modules

Per-tool extraction target for `apps/server/src/mcp/mcpServer.js`. The file is
~1480 LOC and historically registers every MCP tool inside one closure.
Future per-tool splits should live here, one file per tool.

## Pattern

Each tool module exports a `register{ToolName}(server, ctx)` function. The
shared `ctx` object is built once at the top of `buildMcpServer` and contains
the stores and closure helpers that the tool needs to call into:

```js
// apps/server/src/mcp/tools/registerGetMcpBinding.js
import { jsonResult } from '../mcpHelpers.js';
import { buildMcpBindingSnapshot } from '../mcpBindingSnapshot.js';
import { buildSessionBootstrap } from '../mcpSessionBootstrap.js';

export function registerGetMcpBinding(server, ctx) {
  server.registerTool(
    'get_mcp_binding',
    {
      title: 'MCP transport binding',
      description: '…',
      inputSchema: {}
    },
    async () => {
      const entry = ctx.currentEntry();
      const services = entry?.appSessionId
        ? ctx.sessionRegistry.getSessionServices(entry.appSessionId)
        : null;
      const binding = buildMcpBindingSnapshot(entry);
      const bootstrap =
        entry && services
          ? buildSessionBootstrap({
              entry,
              services,
              pairingCodeStore: ctx.pairingCodeStore,
              publicBaseUrl: ctx.publicBaseUrl()
            })
          : null;
      return jsonResult({ ...binding, bootstrap });
    }
  );
}
```

`mcpServer.js` then composes everything in `buildMcpServer`:

```js
const ctx = {
  mcpRegistry, sessionRegistry, pairingCodeStore, agentTokenStore,
  mcpRateLimiter, mcpSessionIdRef,
  publicBaseUrl, currentEntry, currentServices,
  assertResourceSessionAccess, recordPairingFailure, finalizeApprovedAgent
};
registerGetMcpBinding(server, ctx);
// …other registers in deterministic order
```

## Shared utilities

`apps/server/src/mcp/mcpHelpers.js` already exports the result helpers
(`textResult`, `jsonResult`, `safeError`, `humanOnlyMcpToolBlocked`) and the
identity helpers (`originFromMcpEntry`, `requireRegisteredAgent`,
`pairingFailureMessage`). Import from there, not from `mcpServer.js`.

## Verification

The MCP integration suite (`apps/server/test/mcpServer.test.js`, 474 LOC) drives
every tool through a real transport, so it's the regression gate when you
extract a tool. Run `npm run test -w apps/server` after each move.
