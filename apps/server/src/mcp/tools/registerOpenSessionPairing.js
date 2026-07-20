import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { jsonResult } from '../mcpHelpers.js';
import { buildMcpBindingSnapshot } from '../mcpBindingSnapshot.js';
import { MCP_APP_URI_SESSION_PAIRING, UI_META } from '../registerMcpApps.js';

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {{
 *   currentEntry: () => object | null,
 *   pairingCodeStore: { getOrCreateCode: (sessionId: string) => string }
 * }} ctx
 */
export function registerOpenSessionPairing(server, ctx) {
  registerAppTool(
    server,
    'open_session_pairing',
    {
      title: 'Open session pairing',
      description:
        'Opens the session pairing MCP App: paste the code from Invite agent in the web UI, or let the agent pass pairingCode via join_session.',
      inputSchema: {},
      ...UI_META(MCP_APP_URI_SESSION_PAIRING)
    },
    async () => jsonResult(buildMcpBindingSnapshot(ctx.currentEntry(), ctx.pairingCodeStore))
  );
}
