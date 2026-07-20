import { jsonResult } from '../mcpHelpers.js';
import { buildMcpBindingSnapshot } from '../mcpBindingSnapshot.js';
import { buildSessionBootstrap } from '../mcpSessionBootstrap.js';

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {{
 *   currentEntry: () => object | null,
 *   sessionRegistry: { getSessionServices: (id: string) => object | null },
 *   pairingCodeStore: { getOrCreateCode: (sessionId: string) => string },
 *   publicBaseUrl: () => string
 * }} ctx
 */
export function registerGetMcpBinding(server, ctx) {
  server.registerTool(
    'get_mcp_binding',
    {
      title: 'MCP transport binding',
      description:
        'Returns whether this MCP connection is bound to an ArchiSlop room (session id, pairing code, web canvas URL). Used by the session pairing MCP App.',
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
