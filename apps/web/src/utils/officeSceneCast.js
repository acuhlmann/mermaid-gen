/**
 * Who is in a canned set piece.
 *
 * Scenes (coffee breaks, cubicle battles) are stored as a flat list of lines;
 * the cast is implied by who speaks. Both renderers need that list — the floor
 * to place them and empty their desks, the store wiring to know who is away —
 * so it lives here rather than inside a component module.
 */

/**
 * Speakers in the order they first talk. A two-hander gives exactly two.
 *
 * @param {Array<{speakerId?: string}> | null | undefined} lines
 * @returns {string[]}
 */
export function sceneParticipants(lines) {
  const seen = [];
  for (const line of lines ?? []) {
    if (line?.speakerId && !seen.includes(line.speakerId)) seen.push(line.speakerId);
  }
  return seen;
}

/**
 * Everybody who is up and about, and whose desk should therefore stand empty
 * (§ 6 rule 5 — the furniture stays, the person doesn't). A meeting takes you
 * with it: it is the one place "you" are visibly in the room rather than at
 * your screen.
 *
 * @param {{
 *   coffee?: { lines?: Array<{speakerId?: string}> } | null,
 *   battle?: { lines?: Array<{speakerId?: string}> } | null,
 *   meeting?: { attendees?: string[] } | null,
 *   playerId: string
 * }} state
 * @returns {string[]}
 */
export function awayFromDeskIds({ coffee, battle, meeting, playerId }) {
  const away = [...sceneParticipants(coffee?.lines), ...sceneParticipants(battle?.lines)];
  if (meeting) away.push(playerId, ...(meeting.attendees ?? []));
  return away;
}
