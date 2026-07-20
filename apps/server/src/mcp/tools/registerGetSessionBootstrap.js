import { jsonResult } from '../mcpHelpers.js';
import { buildSessionBootstrap } from '../mcpSessionBootstrap.js';

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {{
 *   requireBoundSession: () => { error?: unknown, entry?: object },
 *   sessionRegistry: { getSessionServices: (id: string) => object | null },
 *   pairingCodeStore: unknown,
 *   publicBaseUrl: () => string
 * }} ctx
 */
export function registerGetSessionBootstrap(server, ctx) {
  server.registerTool(
    'get_session_bootstrap',
    {
      title: 'Session bootstrap',
      description:
        'One-shot JSON for this MCP connection: room binding, revisions, handshake status, checklist, collaboration guide prompt name.',
      inputSchema: {}
    },
    async () => {
      const bound = ctx.requireBoundSession();
      if (bound.error) return bound.error;
      const { entry } = bound;
      const services = ctx.sessionRegistry.getSessionServices(entry.appSessionId);
      return jsonResult(
        buildSessionBootstrap({
          entry,
          services,
          pairingCodeStore: ctx.pairingCodeStore,
          publicBaseUrl: ctx.publicBaseUrl()
        })
      );
    }
  );
}
