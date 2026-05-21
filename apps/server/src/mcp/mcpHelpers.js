/**
 * Shared MCP-tool result helpers + pairing/origin utilities, extracted from
 * `mcpServer.js` so per-tool modules under `tools/` can import them without
 * pulling in the full server closure.
 */
import { normalizePairingCode } from '../state/pairingCodeStore.js';

/** Build an MCP `text` content envelope. */
export function textResult(text) {
  return { content: [{ type: 'text', text }] };
}

/** Build an MCP `text` content envelope from an object (JSON-pretty-printed when needed). */
export function jsonResult(obj) {
  return {
    content: [
      {
        type: 'text',
        text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)
      }
    ]
  };
}

/** Build an `isError: true` MCP envelope with the supplied message. */
export function safeError(message) {
  return { content: [{ type: 'text', text: message }], isError: true };
}

const HUMAN_ONLY_MCP_TOOL_MESSAGE =
  'This action is only available from the ArchiSlop web UI. Approve agents and accept or reject diagram proposals in the browser, not via MCP tools.';

/** MCP-tool guard for actions that must be performed by a human in the web UI. */
export function humanOnlyMcpToolBlocked() {
  return safeError(HUMAN_ONLY_MCP_TOOL_MESSAGE);
}

/** Build an Origin payload for patches/insights authored by an external MCP agent. */
export function originFromMcpEntry(entry) {
  return {
    kind: 'external-agent',
    agentId: entry.agentId,
    agentName: entry.agentName,
    color: entry.color,
    emoji: entry.emoji ?? undefined
  };
}

/**
 * Returns an MCP error envelope if the calling agent is unregistered or its
 * identity has drifted from the current MCP connection; otherwise null.
 */
export function requireRegisteredAgent(entry, agentTokenStore) {
  if (!entry || !entry.agentId) {
    return {
      content: [
        {
          type: 'text',
          text: 'You must call `register_agent({ name, emoji?, color? })` first and have the user approve the handshake in the ArchiSlop UI before using any other tool.'
        }
      ],
      isError: true
    };
  }
  if (
    agentTokenStore &&
    entry.appSessionId &&
    entry.mcpSessionId &&
    !agentTokenStore.verifyMcpBinding(entry.appSessionId, entry.agentId, entry.mcpSessionId)
  ) {
    return safeError(
      'This agent identity is bound to a different MCP connection. Call register_agent again after reconnecting.'
    );
  }
  return null;
}

/** Human-readable message for a failed pairing-code redemption. */
export function pairingFailureMessage(result, rawCode) {
  const code = normalizePairingCode(rawCode) ?? rawCode;
  if (result.reason === 'expired') {
    return `Pairing code "${code}" expired. Copy a fresh code from Invite agent in the web UI.`;
  }
  if (result.reason === 'exhausted') {
    return `Pairing code "${code}" was already used. Copy a fresh code from Invite agent.`;
  }
  if (result.reason === 'invalid') {
    return 'Invalid pairing code format (expected 6 characters).';
  }
  return `Unknown pairing code "${code}". Copy a fresh code from Invite agent.`;
}
