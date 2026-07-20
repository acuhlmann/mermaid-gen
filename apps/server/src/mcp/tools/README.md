# MCP tool modules

Per-tool extraction for `apps/server/src/mcp/mcpServer.js` (ADR-0005). Prefer adding
new tools here instead of growing the hub file.

## Extracted so far

| Module                           | Tools                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `registerGetMcpBinding.js`       | `get_mcp_binding`                                                                           |
| `registerGetSessionBootstrap.js` | `get_session_bootstrap`                                                                     |
| `registerOpenSessionPairing.js`  | `open_session_pairing`                                                                      |
| `registerHumanOnlyAppTools.js`   | `resolve_handshake`, `resolve_proposal`, `request_proposal_changes`, `request_critique_fix` |

Shared binding JSON lives in `apps/server/src/mcp/mcpBindingSnapshot.js`.

## Pattern

Each tool module exports a `register{ToolName}(server, ctx)` function. The
shared `ctx` object is built once in `buildMcpServer` as `toolCtx` and contains
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
      const binding = buildMcpBindingSnapshot(entry, ctx.pairingCodeStore);
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
const toolCtx = {
  mcpRegistry,
  sessionRegistry,
  pairingCodeStore,
  agentTokenStore,
  mcpRateLimiter,
  mcpSessionIdRef,
  publicBaseUrl,
  currentEntry,
  currentServices,
  assertResourceSessionAccess,
  recordPairingFailure,
  finalizeApprovedAgent,
  requireBoundSession,
  requireSessionEntry,
  executeJoinSession
};
registerGetMcpBinding(server, toolCtx);
registerGetSessionBootstrap(server, toolCtx);
// …other registers in deterministic order
```

## Shared utilities

`apps/server/src/mcp/mcpHelpers.js` already exports the result helpers
(`textResult`, `jsonResult`, `safeError`, `humanOnlyMcpToolBlocked`) and the
identity helpers (`originFromMcpEntry`, `requireRegisteredAgent`,
`pairingFailureMessage`). Import from there, not from `mcpServer.js`.

## Verification

The MCP integration suite (`apps/server/test/mcpServer.test.js`) drives
every tool through a real transport, so it's the regression gate when you
extract a tool. Run `npm run test -w apps/server` after each move.
`npm run check:affected` also warns if MCP tool files change without that test
in the same diff (see `scripts/wire-cochange.mjs`).
