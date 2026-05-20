/**
 * Wire: in-process MCP transport session ↔ ArchiSlop app session binding.
 */

/**
 * In-process binding between an MCP transport session and an ArchiSlop session.
 * Created lazily on the first `initialize` request and used to look up state on
 * every subsequent tool/resource call from the same external agent.
 */
export function createMcpSessionRegistry() {
  const byMcpSessionId = new Map();

  function bind(mcpSessionId, { appSessionId, clientInfo, clientIp }) {
    byMcpSessionId.set(mcpSessionId, {
      mcpSessionId,
      appSessionId,
      clientInfo,
      clientIp: clientIp ?? null,
      agentId: null,
      agentName: null,
      color: null,
      emoji: null,
      agentToken: null,
      pendingHandshakeRequestId: null
    });
  }

  function get(mcpSessionId) {
    return byMcpSessionId.get(mcpSessionId) ?? null;
  }

  function remove(mcpSessionId) {
    byMcpSessionId.delete(mcpSessionId);
  }

  function setAgent(mcpSessionId, agent, { agentToken = null } = {}) {
    const entry = byMcpSessionId.get(mcpSessionId);
    if (!entry) return null;
    entry.agentId = agent.agentId;
    entry.agentName = agent.agentName;
    entry.color = agent.color;
    entry.emoji = agent.emoji;
    entry.agentToken = agentToken ?? entry.agentToken;
    entry.pendingHandshakeRequestId = null;
    return entry;
  }

  function clearAgentState(entry) {
    if (!entry) return;
    entry.agentId = null;
    entry.agentName = null;
    entry.color = null;
    entry.emoji = null;
    entry.agentToken = null;
    entry.pendingHandshakeRequestId = null;
  }

  function setAppSession(mcpSessionId, appSessionId) {
    const entry = byMcpSessionId.get(mcpSessionId);
    if (!entry) return null;
    if (entry.appSessionId !== appSessionId) {
      entry.appSessionId = appSessionId;
      clearAgentState(entry);
    }
    return entry;
  }

  return { bind, get, remove, setAgent, setAppSession };
}
