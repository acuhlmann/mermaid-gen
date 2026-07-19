/**
 * Pure grouping helper for Slop Chat™ (docs/office-parody.md).
 *
 * Lives outside OfficeMessenger.jsx so that file only exports components —
 * mixing component and non-component exports breaks Vite Fast Refresh
 * (react-refresh/only-export-components).
 */

/**
 * @typedef {{
 *   id: string,
 *   colleagueId: string,
 *   body: string,
 *   createdAt: number,
 *   outbound?: boolean,
 *   read?: boolean
 * }} OfficeImMessage
 */

/**
 * Group a flat IM log into per-colleague threads, most recently active first —
 * the ordering a real messenger uses, so a fresh ping surfaces its thread to
 * the top. Outbound (user-authored) messages never count as unread.
 *
 * @param {OfficeImMessage[] | null | undefined} messages
 * @returns {Array<{
 *   colleagueId: string,
 *   messages: OfficeImMessage[],
 *   last: OfficeImMessage,
 *   unread: number
 * }>}
 */
export function groupImThreads(messages) {
  const byColleague = new Map();
  for (const msg of messages ?? []) {
    const list = byColleague.get(msg.colleagueId);
    if (list) list.push(msg);
    else byColleague.set(msg.colleagueId, [msg]);
  }
  return [...byColleague.entries()]
    .map(([colleagueId, list]) => ({
      colleagueId,
      messages: list,
      last: list[list.length - 1],
      unread: list.reduce((n, m) => (m.read || m.outbound ? n : n + 1), 0)
    }))
    .sort((a, b) => b.last.createdAt - a.last.createdAt);
}

/**
 * Build a compact transcript for IM reply prompts — last few turns with the
 * named colleague, oldest first.
 *
 * @param {OfficeImMessage[] | null | undefined} messages
 * @param {string} colleagueId
 * @param {number} [limit]
 * @returns {Array<{ from: 'user' | 'colleague', body: string }>}
 */
export function threadTranscriptFor(messages, colleagueId, limit = 8) {
  if (!colleagueId) return [];
  const safeLimit = Math.max(1, Math.min(12, limit));
  return (messages ?? [])
    .filter((msg) => msg.colleagueId === colleagueId)
    .slice(-safeLimit)
    .map((msg) => ({
      from: msg.outbound ? 'user' : 'colleague',
      body: String(msg.body ?? '').slice(0, 300)
    }));
}
