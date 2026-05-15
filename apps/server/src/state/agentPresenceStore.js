const PRESENCE_TTL_MS = 60_000;

export function createAgentPresenceStore() {
  const presenceByAgentId = new Map();

  function prune() {
    const now = Date.now();
    const dropped = [];
    for (const [agentId, entry] of presenceByAgentId) {
      if (now - entry.lastSeenAtMs > PRESENCE_TTL_MS) {
        presenceByAgentId.delete(agentId);
        dropped.push(agentId);
      }
    }
    return dropped;
  }

  function upsert({ agentId, agentName, color, emoji, focus }) {
    prune();
    const now = Date.now();
    const entry = {
      agentId,
      agentName,
      color,
      emoji,
      focus: focus ?? null,
      lastSeenAt: new Date(now).toISOString(),
      lastSeenAtMs: now
    };
    presenceByAgentId.set(agentId, entry);
    return toPublic(entry);
  }

  function touch(agentId) {
    const entry = presenceByAgentId.get(agentId);
    if (!entry) return null;
    const now = Date.now();
    entry.lastSeenAt = new Date(now).toISOString();
    entry.lastSeenAtMs = now;
    return toPublic(entry);
  }

  function remove(agentId) {
    return presenceByAgentId.delete(agentId);
  }

  function list() {
    prune();
    return Array.from(presenceByAgentId.values()).map(toPublic);
  }

  function get(agentId) {
    const entry = presenceByAgentId.get(agentId);
    return entry ? toPublic(entry) : null;
  }

  function toPublic({ agentId, agentName, color, emoji, focus, lastSeenAt }) {
    return { agentId, agentName, color, emoji, focus, lastSeenAt };
  }

  return { upsert, touch, remove, list, get, prune };
}
