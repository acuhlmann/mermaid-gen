import { randomUUID } from 'node:crypto';

const AGENT_TOKEN_TTL_MS = Number(process.env.AGENT_TOKEN_TTL_MS) || 24 * 60 * 60 * 1000;

/**
 * Agent-scoped tokens for session-events SSE and MCP session binding after handshake.
 */
export function createAgentTokenStore({ ttlMs = AGENT_TOKEN_TTL_MS } = {}) {
  /** @type {Map<string, { sessionId: string, agentId: string, mcpSessionId: string | null, expiresAt: number }>} */
  const byToken = new Map();
  /** @type {Map<string, string>} key sessionId:agentId -> mcpSessionId */
  const mcpBindingByAgent = new Map();

  function agentKey(sessionId, agentId) {
    return `${sessionId}:${agentId}`;
  }

  function prune() {
    const now = Date.now();
    for (const [token, entry] of byToken) {
      if (now > entry.expiresAt) byToken.delete(token);
    }
  }

  function issue({ sessionId, agentId, mcpSessionId = null }) {
    prune();
    const token = randomUUID();
    byToken.set(token, {
      sessionId,
      agentId,
      mcpSessionId,
      expiresAt: Date.now() + ttlMs
    });
    if (mcpSessionId) {
      mcpBindingByAgent.set(agentKey(sessionId, agentId), mcpSessionId);
    }
    return token;
  }

  function verify(token) {
    prune();
    const entry = byToken.get(token);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      byToken.delete(token);
      return null;
    }
    return {
      sessionId: entry.sessionId,
      agentId: entry.agentId,
      mcpSessionId: entry.mcpSessionId
    };
  }

  function bindMcpSession(sessionId, agentId, mcpSessionId) {
    mcpBindingByAgent.set(agentKey(sessionId, agentId), mcpSessionId);
    for (const entry of byToken.values()) {
      if (entry.sessionId === sessionId && entry.agentId === agentId) {
        entry.mcpSessionId = mcpSessionId;
      }
    }
  }

  function verifyMcpBinding(sessionId, agentId, mcpSessionId) {
    const bound = mcpBindingByAgent.get(agentKey(sessionId, agentId));
    if (!bound) return true;
    return bound === mcpSessionId;
  }

  function clearBinding(sessionId, agentId) {
    mcpBindingByAgent.delete(agentKey(sessionId, agentId));
  }

  return { issue, verify, bindMcpSession, verifyMcpBinding, clearBinding };
}
