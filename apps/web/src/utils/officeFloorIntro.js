/**
 * Day One walk stops on the isometric floor.
 *
 * `approachTileFor` answers "can I talk from my desk?" — leadership glass and
 * L-paths from reception both fail that test for some seats. The ceremony needs
 * a tile you can actually walk to from wherever you are standing, even if that
 * means looking at Jack through the fishbowl rather than standing in his cube.
 */

import { approachTileFor, standableTileAt } from './officeFloorMovement.js';
import { DAY_ONE_INTRO_IDS, officeSenderInfo, officeChromeCopy } from './officeCast.js';
import {
  RECEPTION_TILE,
  YOU_SEAT_ID,
  isStandableTile,
  pathCrossesGlass,
  seatFor,
  walkPathBetween
} from './officeFloorPlan.js';

/** Team stops on the floor walk — Linda hosts welcome/closing, not a second self-intro. */
export const DAY_ONE_WALK_IDS = Object.freeze(DAY_ONE_INTRO_IDS.filter((id) => id !== 'hr'));

/**
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 */
function reachableFrom(from, to) {
  return !pathCrossesGlass(walkPathBetween(from, to, YOU_SEAT_ID));
}

/**
 * Prefer the talk mark; otherwise the nearest standable tile you can reach from
 * `from` that still faces their seat (including "outside the glass" for Jack).
 *
 * @param {string} seatId
 * @param {{ x: number, y: number }} [from]
 * @returns {{ x: number, y: number } | null}
 */
export function introVisitTileFor(seatId, from = RECEPTION_TILE) {
  const seat = seatFor(seatId);
  if (!seat || seat.id === YOU_SEAT_ID) return null;

  const approach = approachTileFor(seatId);
  if (approach && reachableFrom(from, approach)) return approach;

  const origin = { x: seat.x, y: seat.y + 1.2 };
  for (const radius of [1, 2, 3]) {
    const snap = standableTileAt(origin, { from, radius });
    if (snap && reachableFrom(from, snap)) return snap;
  }

  // Last resort: scan a short south-facing band (leadership looks through glass).
  for (let y = Math.max(1, Math.round(seat.y) + 1); y <= Math.round(seat.y) + 3; y += 1) {
    for (let dx = 0; dx <= 2; dx += 1) {
      for (const sign of [0, -1, 1]) {
        if (dx === 0 && sign !== 0) continue;
        const tile = { x: Math.round(seat.x) + dx * sign, y };
        if (!isStandableTile(tile)) continue;
        if (!reachableFrom(from, tile)) continue;
        return tile;
      }
    }
  }
  return null;
}

/**
 * Your desk tile — the ceremony ends by walking here and sitting down.
 *
 * @returns {{ x: number, y: number }}
 */
export function introHomeTile() {
  const desk = seatFor(YOU_SEAT_ID);
  return desk ? { x: desk.x, y: desk.y } : { x: 7, y: 7 };
}

/**
 * @param {string} castId
 * @returns {string}
 */
export function colleagueVoiceLine(castId) {
  const colleague = officeSenderInfo(castId);
  if (colleague?.introLine) return colleague.introLine;
  return `${colleague?.name ?? ''}. ${colleague?.blurb ?? ''}`.trim();
}

/**
 * Ordered spoken beats for the floor ceremony (welcome → team → closing).
 * Closing is Linda's handoff, distinct from the welcome, and is meant to play
 * while you walk to your desk.
 *
 * @returns {Array<{ id: string, kind: 'welcome' | 'intro' | 'closing', line: string }>}
 */
export function arrivalSpeechBeats() {
  const directory = officeChromeCopy().directory;
  const welcome = {
    id: directory?.welcomeVoiceSpeakerId ?? 'hr',
    kind: 'welcome',
    line: directory?.welcomeVoiceLine ?? ''
  };
  const intros = DAY_ONE_WALK_IDS.map((id) => ({
    id,
    kind: 'intro',
    line: colleagueVoiceLine(id)
  }));
  const closingLine =
    directory?.welcomeClosingLine || colleagueVoiceLine('hr') || directory?.welcomeVoiceLine || '';
  const closing = {
    id: directory?.welcomeVoiceSpeakerId ?? 'hr',
    kind: 'closing',
    line: closingLine
  };
  return [welcome, ...intros, closing];
}
