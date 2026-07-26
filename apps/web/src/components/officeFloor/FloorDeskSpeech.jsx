/**
 * A line spoken by somebody sitting at their own desk.
 *
 * Its own positioned element rather than a child of the seat, for the reason
 * § 6 rule 6 records: depth ordering is right for the *figure*, but a bubble
 * has to clear the zone-signage layer (z 9000) or the text ends up behind the
 * word POD. `--over-seat` then lifts it past the speaker themselves — 30 px of
 * seat lift *plus* the 48 px figure, or the balloon covers the person talking
 * (§ 6 rule 15).
 *
 * Which lift depends on whether they are actually sitting: a colleague with no
 * desk is never seat-lifted, so clearing 30 px he does not have leaves the
 * bubble floating a tile above his head (§ 6 rule 20).
 *
 * Shared by the arrival ceremony (each colleague introducing themselves), desk
 * peeking (what they say over their shoulder) and floor conversation.
 */

import FloorBubble from './FloorBubble.jsx';
import { officeSenderInfo } from '../../utils/officeCast.js';
import { bubbleAlignForTile, projectIso, seatFor } from '../../utils/officeFloorPlan.js';

/** Above the signage layer, same as the walker's bubble at your desk. */
const BUBBLE_Z = 9600;

/**
 * @param {{
 *   castId: string,
 *   line: string,
 *   scale?: number,
 *   testId?: string,
 *   hideBody?: boolean
 * }} props
 */
export function FloorDeskSpeech({ castId, line, scale = 1, testId, hideBody = false }) {
  const seat = seatFor(castId);
  if (!seat || (!line && !hideBody)) return null;
  if (hideBody) return null;

  const sender = officeSenderInfo(castId);
  const { left, top } = projectIso(seat.x, seat.y);
  const lift = seat.desk
    ? 'office-floor-walker-anchor--over-seat'
    : 'office-floor-walker-anchor--over-standing';
  const align = bubbleAlignForTile(seat);

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
