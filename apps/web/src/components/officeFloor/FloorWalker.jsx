/**
 * A walk-by, embodied (docs/office-isometric-mode.md § 5 slice 2).
 *
 * Same `walkBy` state the desk-mode card renders — the colleague just arrives
 * on foot instead of sliding in from the screen edge. Footsteps and the spoken
 * line already fire from `OfficeLayer`'s effect on `snapshot.walkBy`, so this
 * component is presentation only: walk over, say the thing, walk back.
 */

import { useRef } from 'react';
import FloorBubble from './FloorBubble.jsx';
import FloorFigure from './FloorFigure.jsx';
import { useWalkAnimation } from './useWalkAnimation.js';
import { VISITOR_TILE, depthOf, walkPathFrom } from '../../utils/officeFloorPlan.js';
import { officeChromeCopy, officeSenderInfo } from '../../utils/officeCast.js';
import { floorActivityFor } from '../../utils/officeFloorActivity.js';
import { formatLocale } from '../../i18n/formatLocale.js';

/** Above the zone-signage layer (9000) so the speech bubble is never buried. */
const SPEAKING_Z = 9500;

/** What they came over to say, with the same actions as the desk-mode card. */
function WalkerBubble({ walkBy, sender, scale, onAdopt, onDismiss, hideBody }) {
  const chrome = officeChromeCopy();
  return (
    <FloorBubble
      name={sender.name}
      title={sender.title}
      scale={scale}
      hideBody={hideBody}
      onDismiss={() => onDismiss?.(walkBy.id)}
      dismissLabel={formatLocale(chrome.walkby.dismissAria, { name: sender.name })}
      footer={
        walkBy.actionPrompt ? (
          <button
            type="button"
            className="office-floor-bubble-action"
            onClick={() => onAdopt?.(walkBy.actionPrompt, walkBy.colleagueId)}
          >
            {chrome.doIt}
          </button>
        ) : null
      }
    >
      {walkBy.body}
    </FloorBubble>
  );
}

/**
 * @param {{
 *   walkBy: { id: string, colleagueId: string, body: string, actionPrompt?: string },
 *   departing?: boolean,
 *   scale?: number,
 *   hideBody?: boolean,
 *   onAdopt?: (prompt: string, colleagueId: string) => void,
 *   onDismiss?: (id: string) => void,
 *   onDeparted?: () => void,
 *   onStep?: (tile: { x: number, y: number }, isYou?: boolean) => void
 * }} props
 */
export function FloorWalker({
  walkBy,
  departing = false,
  scale = 1,
  hideBody = false,
  onAdopt,
  onDismiss,
  onDeparted,
  onStep
}) {
  const ref = useRef(null);
  const outbound = walkPathFrom(walkBy.colleagueId);
  const path = departing ? [...outbound].reverse() : outbound;
  const fallback = [VISITOR_TILE];

  const { tile, arrived } = useWalkAnimation(ref, path.length ? path : fallback, {
    walkKey: `${walkBy.id}:${departing ? 'out' : 'in'}`,
    onArrive: departing ? onDeparted : undefined,
    // Somebody else's approach, so it is placed rather than centred — and it
    // carries on as they leave, which is what the desk renderer's one-shot
    // `playFootsteps` could never do.
    onLeg: onStep ? (legTile) => onStep(legTile, false) : undefined
  });

  const sender = officeSenderInfo(walkBy.colleagueId);
  const talking = arrived && !departing;

  return (
    <div
      ref={ref}
      className="office-floor-walker"
      data-testid="office-floor-walker"
      /*
       * While travelling, depth ordering so they pass behind and in front of
       * furniture correctly. Once they are talking at your desk, the speech
       * bubble has to clear the zone signage layer — and nothing should occlude
       * someone standing right in front of you anyway.
       */
      style={{ zIndex: talking ? SPEAKING_Z : depthOf(tile.x, tile.y) + 5 }}
    >
      <div className="office-floor-walker-anchor">
        {talking ? (
          <WalkerBubble
            walkBy={walkBy}
            sender={sender}
            scale={scale}
            hideBody={hideBody}
            onAdopt={onAdopt}
            onDismiss={onDismiss}
          />
        ) : null}
        <FloorFigure
          id={walkBy.colleagueId}
          accent={sender?.accentColor ?? 'var(--accent)'}
          /* They came over holding whatever they were holding. `moving` covers
             both legs of the trip and the beat at your desk in between, because
             somebody delivering a line is not at their keyboard. */
          activity={floorActivityFor(walkBy.colleagueId, { moving: true })}
          walking={!arrived || departing}
        />
      </div>
    </div>
  );
}

export default FloorWalker;
