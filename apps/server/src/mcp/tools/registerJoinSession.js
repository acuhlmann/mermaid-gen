import { z } from 'zod';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { buildWebCanvasUrl } from '../diagramDiffSummary.js';
import { jsonResult, pairingFailureMessage, safeError } from '../mcpHelpers.js';
import { buildMcpBindingSnapshot } from '../mcpBindingSnapshot.js';
import { MCP_APP_URI_SESSION_PAIRING, UI_META } from '../registerMcpApps.js';

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {{
 *   mcpRegistry: object,
 *   pairingCodeStore: object,
 *   currentEntry: () => object | null,
 *   recordPairingFailure: (entry: object) => void,
 * }} ctx
 */
export function registerJoinSession(server, ctx) {
  const { mcpRegistry, pairingCodeStore, currentEntry, recordPairingFailure } = ctx;

  async function executeJoinSession({ pairingCode }) {
    const entry = currentEntry();
    if (!entry) {
      return safeError('No MCP transport session. Connect to /mcp first, then call join_session.');
    }
    if (!pairingCode) {
      return jsonResult({
        status: 'needs_pairing_code',
        ...buildMcpBindingSnapshot(entry, pairingCodeStore),
        message:
          'Enter the pairing code in the session pairing MCP App, or pass pairingCode in tool arguments.'
      });
    }

    let appSessionId = null;
    const resolved = await Promise.resolve(
      pairingCodeStore.resolveDetailed(pairingCode, { consumeUse: false })
    );
    if (!resolved.ok) {
      recordPairingFailure(entry);
      return safeError(pairingFailureMessage(resolved, pairingCode));
    }
    appSessionId = resolved.sessionId;

    mcpRegistry.setAppSession(entry.mcpSessionId, appSessionId);
    const code = pairingCodeStore.getOrCreateCode(appSessionId);
    return jsonResult({
      status: 'joined',
      bound: true,
      sessionId: appSessionId,
      pairingCode: code,
      webCanvasUrl: buildWebCanvasUrl(appSessionId),
      agentRegistered: false,
      message: 'Room bound. Call register_agent next to request access.'
    });
  }

  registerAppTool(
    server,
    'join_session',
    {
      title: 'Join ArchiSlop room',
      description:
        'Bind this MCP connection to an ArchiSlop session using the pairing code from Invite agent (stable /mcp URL). Opens the pairing MCP App when pairingCode is omitted. Pass pairingCode to join headlessly.',
      inputSchema: {
        pairingCode: z.string().min(4).max(16).optional()
      },
      ...UI_META(MCP_APP_URI_SESSION_PAIRING)
    },
    executeJoinSession
  );
}
