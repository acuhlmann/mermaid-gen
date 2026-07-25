/**
 * Desk peeking (docs/office-isometric-mode.md § 5 slice 6).
 *
 * You walk over to see what somebody is working on. Your seat empties, you
 * appear at a mark beside their desk, they glow and say a line about the
 * fiction they carry (`officeDeskWork.js`), and "back to my desk" walks you
 * home. The screen you came to look at is drawn by `MonitorScreen` on their
 * desk — always, for everyone, whether or not you are standing there; peeking
 * is what gets you close enough to read it.
 *
 * **This produces nothing.** The Sign-off rule (ADR-0010) is not a caveat here,
 * it is the design: a look is a handful of rectangles and a line is a line. No
 * slot content is written, no artifact is created, and nothing about a peek
 * reaches a store — the state below is view state and dies when you sit down.
 *
 * Two exports for the same reason `FloorMeeting` has two (§ 6 rule 12): the
 * room is diegesis, the controls are chrome in the floor card slot, off the
 * stage where they cannot occlude the person you walked over to look at.
 */

import FloorDeskSpeech from './FloorDeskSpeech.jsx';
import FloorPlayer from './FloorPlayer.jsx';
import { PersonaFace } from '../personaFaces/index.jsx';
import { officeSenderInfo } from '../../utils/officeCast.js';
import { deskWorkFor } from '../../utils/officeDeskWork.js';
import { YOU_SEAT_ID, peekTileFor, seatFor } from '../../utils/officeFloorPlan.js';

/**
 * You at their desk, and what they say about it.
 *
 * @param {{
 *   peek: { colleagueId: string, phase: 'walking' | 'looking' | 'returning' },
 *   scale?: number,
 *   onArrive?: () => void
 * }} props
 */
export function FloorPeek({ peek, scale = 1, onArrive }) {
  const mark = peekTileFor(peek.colleagueId);
  const desk = seatFor(YOU_SEAT_ID);
  if (!mark || !desk) return null;

  const home = { x: desk.x, y: desk.y };
  const returning = peek.phase === 'returning';
  const work = deskWorkFor(peek.colleagueId);

  return (
    <>
      <FloorPlayer
        /*
         * One walk per direction, not per phase: 'walking' and 'looking' share
         * a key so arriving does not restart the journey you just finished.
         */
        from={returning ? mark : home}
        to={returning ? home : mark}
        walking
        walkKey={`peek:${peek.colleagueId}:${returning ? 'back' : 'over'}`}
        onArrive={onArrive}
        testId="office-floor-peek-player"
      />
      {peek.phase === 'looking' && work ? (
        <FloorDeskSpeech
          castId={peek.colleagueId}
          line={work.line}
          scale={scale}
          testId="office-floor-peek-line"
        />
      ) : null}
    </>
  );
}

/**
 * The way back, and a caption for what is on the screen. In the card slot
 * rather than pinned to their desk: a counter-scaled panel over a pod of desks
 * covers the people in it, and rule 2 wants a labelled conventional control.
 *
 * @param {{
 *   peek: { colleagueId: string, phase: string },
 *   copy: Record<string, any>,
 *   onBack?: () => void
 * }} props `copy` is `officeChromeCopy().floor`.
 */
export function FloorPeekCard({ peek, copy, onBack }) {
  const peekCopy = copy.peek;
  const sender = officeSenderInfo(peek.colleagueId);
  const work = deskWorkFor(peek.colleagueId);
  const arrived = peek.phase === 'looking';

  return (
    <aside
      className="office-floor-card office-floor-card--peek"
      data-testid="office-floor-peek-card"
      aria-live="polite"
    >
      <span className="office-floor-eyebrow">{peekCopy.eyebrow}</span>
      <div className="office-floor-card-head">
        <PersonaFace id={peek.colleagueId} size={44} />
        <div className="office-floor-card-id">
          <strong>{sender?.name ?? peek.colleagueId}</strong>
          <span>{sender?.title ?? ''}</span>
        </div>
      </div>
      <p className="office-floor-card-blurb">
        {arrived ? (peekCopy.looks[work?.look] ?? peekCopy.walking) : peekCopy.walking}
      </p>
      <div className="office-floor-card-actions">
        <button
          type="button"
          className="office-floor-card-action office-floor-card-action--primary"
          title={peekCopy.backTitle}
          onClick={onBack}
        >
          {peekCopy.back}
        </button>
      </div>
    </aside>
  );
}

export default FloorPeek;
