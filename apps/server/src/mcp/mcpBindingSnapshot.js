import { buildWebCanvasUrl } from './diagramDiffSummary.js';

/**
 * Snapshot of whether this MCP transport entry is bound to an ArchiSlop room.
 * Used by get_mcp_binding, open_session_pairing, and join_session responses.
 *
 * @param {object | null | undefined} entry
 * @param {{ getOrCreateCode: (sessionId: string) => string }} pairingCodeStore
 */
export function buildMcpBindingSnapshot(entry, pairingCodeStore) {
  if (!entry) {
    return {
      bound: false,
      message: 'No MCP transport session. Connect to /mcp first.'
    };
  }
  if (!entry.appSessionId) {
    return {
      bound: false,
      message: 'Not bound to an ArchiSlop room.',
      inviteHint: 'Open Invite agent in the ArchiSlop web UI and copy the pairing code.'
    };
  }
  const code = pairingCodeStore.getOrCreateCode(entry.appSessionId);
  return {
    bound: true,
    sessionId: entry.appSessionId,
    pairingCode: code,
    webCanvasUrl: buildWebCanvasUrl(entry.appSessionId),
    agentRegistered: Boolean(entry.agentId),
    agentId: entry.agentId ?? null,
    agentName: entry.agentName ?? null,
    message: entry.agentId
      ? 'Room bound and agent registered.'
      : 'Room bound. Call register_agent next.'
  };
}
