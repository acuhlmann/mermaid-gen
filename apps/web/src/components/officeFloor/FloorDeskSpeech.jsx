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
 * Shared by the arrival ceremony (each colleague introducing themselves) and
 * desk peeking (what they say when you look over their shoulder).
 */

import FloorBubble from './FloorBubble.jsx';
import { officeSenderInfo } from '../../utils/officeCast.js';
import { projectIso, seatFor } from '../../utils/officeFloorPlan.js';

/** Above the signage layer, same as the walker's bubble at your desk. */
const BUBBLE_Z = 9600;

/**
 * @param {{ castId: string, line: string, scale?: number, testId?: string }} props
 */
export function FloorDeskSpeech({ castId, line, scale = 1, testId }) {
  const seat = seatFor(castId);
  if (!seat || !line) return null;

  const sender = officeSenderInfo(castId);
  const { left, top } = projectIso(seat.x, seat.y);

  return (
    <div
      className="office-floor-walker"
      data-testid={testId}
      style={{ left, top, zIndex: BUBBLE_Z }}
    >
      <div className="office-floor-walker-anchor office-floor-walker-anchor--over-seat">
        <FloorBubble name={sender?.name ?? castId} title={sender?.title} scale={scale}>
          {line}
        </FloorBubble>
      </div>
    </div>
  );
}

export default FloorDeskSpeech;
