/**
 * A walk-by, embodied (docs/office-isometric-mode.md § 5 slice 2).
 *
 * Same `walkBy` state the desk-mode card renders — the colleague just arrives
 * on foot instead of sliding in from the screen edge. Footsteps and the spoken
 * line already fire from `OfficeLayer`'s effect on `snapshot.walkBy`, so this
 * component is presentation only: walk over, say the thing, walk back — and,
 * since queue 13's second half, say one more thing on the way back if you
 * waved the first one away. `data-refused` is on the figure so that beat is
 * testable from outside the copy bank, the same reason `FloorWanderer` carries
 * `data-said`.
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

/**
 * What they came over to say, with the same actions as the desk-mode card.
 *
 * `leaving` strips the chrome rather than branching the component: a walker on
 * the way home is saying the last word about an offer that is already over, so
 * there is no ✕ to press (pressing it again is the only thing it could do) and
 * no **Do it** (`useFloorWalker` has already dropped the prompt, and a second
 * chance to take a suggestion you waved off is the pitch chasing you).
 */
function WalkerBubble({ walkBy, sender, scale, onAdopt, onDismiss, hideBody, leaving = false }) {
  const chrome = officeChromeCopy();
  return (
    <FloorBubble
      name={sender.name}
      title={sender.title}
      scale={scale}
      hideBody={hideBody}
      onDismiss={leaving ? undefined : () => onDismiss?.(walkBy.id)}
      dismissLabel={
        leaving ? undefined : formatLocale(chrome.walkby.dismissAria, { name: sender.name })
      }
      footer={
        !leaving && walkBy.actionPrompt ? (
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
 *   walkBy: { id: string, colleagueId: string, body: string, actionPrompt?: string,
 *     refused?: boolean },
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
  /*
   * Two ways to have a balloon: standing at your desk having arrived, or
   * walking home having been waved off (`useFloorWalker` puts the line on the
   * departing copy and nothing else sets `refused`). The second is the
   * wanderer's posture from slice 18 — a figure speaking while it moves — and
   * it keeps `SPEAKING_Z` for the same reason that one does: a sentence nobody
   * can read because a filing cabinet is in front of it is the feature failing
   * silently. It ends when they reach their chair, because `onDeparted` clears
   * the copy the line is riding on, which is the 1800 ms linger slice 18 had to
   * schedule, arriving here for free.
   */
  const leaving = departing && Boolean(walkBy.refused) && Boolean(walkBy.body);
  const talking = (arrived && !departing) || leaving;

  return (
    <div
      ref={ref}
      className="office-floor-walker"
      data-testid="office-floor-walker"
      data-refused={leaving ? '' : undefined}
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
            leaving={leaving}
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
