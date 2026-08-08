/**
 * A line spoken by somebody sitting at their own desk.
 *
 * Its own positioned element rather than a child of the seat, for the reason
 * § 6 rule 6 records: depth ordering is right for the *figure*, but a bubble
 * has to clear the zone-signage layer (z 9000) or the text ends up behind the
 * word POD. `--over-seat` then lifts it past the speaker themselves — 30 px of
 * seat lift *plus* the 58 px figure, or the balloon covers the person talking
 * (§ 6 rule 15).
 *
 * Which lift depends on whether they are actually sitting: a colleague with no
 * desk is never seat-lifted, so clearing 30 px he does not have leaves the
 * bubble floating a tile above his head (§ 6 rule 20).
 *
 * Slice 12 is that rule generalized rather than a new one. `tile` moves the
 * balloon to wherever the speaker is stood — a wanderer answering you at the
 * printer is not at their desk, and a bubble over the chair they left points at
 * nobody. Posture follows position for exactly rule 20's reason: somebody away
 * from their desk has no seat lift to clear, whatever their desk would imply.
 * Rule 28's horizontal bias follows position too, for the same reason.
 *
 * Shared by the arrival ceremony (each colleague introducing themselves), desk
 * peeking (what they say over their shoulder) and floor conversation.
 */

import FloorBubble from './FloorBubble.jsx';
import { officeSenderInfo } from '../../utils/officeCast.js';
import { bubbleAlignForSpeaker, projectIso, seatFor } from '../../utils/officeFloorPlan.js';

/** Above the signage layer, same as the walker's bubble at your desk. */
const BUBBLE_Z = 9600;

const OVER_SEAT = 'office-floor-walker-anchor--over-seat';
const OVER_STANDING = 'office-floor-walker-anchor--over-standing';

/**
 * Where the balloon hangs and how much of the speaker it has to clear — one
 * decision, because the two halves are the same question (§ 6 rules 15 and 20).
 * A tile means they are on their feet somewhere that is not their desk, so there
 * is no seat lift to clear whatever their desk would imply.
 *
 * @param {string} castId
 * @param {{ x: number, y: number } | null} tile
 * @returns {{ tile: { x: number, y: number }, lift: string } | null}
 */
function anchorFor(castId, tile) {
  if (tile) return { tile, lift: OVER_STANDING };
  const seat = seatFor(castId);
  if (!seat) return null;
  return { tile: { x: seat.x, y: seat.y }, lift: seat.desk ? OVER_SEAT : OVER_STANDING };
}

/**
 * @param {{
 *   castId: string,
 *   line: string,
 *   scale?: number,
 *   testId?: string,
 *   tile?: { x: number, y: number } | null,
 *   hideBody?: boolean
 * }} props `tile` overrides their seat — where they are actually standing.
 */
export function FloorDeskSpeech({ castId, line, scale = 1, testId, tile, hideBody = false }) {
  const anchor = anchorFor(castId, tile);
  if (!anchor || !line) return null;
  if (hideBody) return null;

  const sender = officeSenderInfo(castId);
  const { left, top } = projectIso(anchor.tile.x, anchor.tile.y);
  const lift = anchor.lift;
  /*
   * Off the **anchor**, not off their seat. Rule 28's bias exists to slide an
   * edge speaker's balloon back toward screen centre, and where somebody is
   * standing is the only position that answers that — Chad's desk is a `start`
   * tile and the whiteboard he is stood at is a `center` one, so aligning by the
   * chair he left would shove the balloon the wrong way across the room.
   */
  const standing = lift === OVER_STANDING;
  const align = bubbleAlignForSpeaker(anchor.tile, castId, { standing });

  return (
    <div
      className="office-floor-walker"
      data-testid={testId}
      style={{ left, top, zIndex: BUBBLE_Z }}
    >
      <div className={`office-floor-walker-anchor ${lift}`}>
        <FloorBubble
          name={sender?.name ?? castId}
          title={sender?.title}
          scale={scale}
          align={align}
        >
          {line}
        </FloorBubble>
      </div>
    </div>
  );
}

export default FloorDeskSpeech;
