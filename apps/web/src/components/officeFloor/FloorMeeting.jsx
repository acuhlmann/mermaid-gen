/**
 * Meetings in the glass room (docs/office-isometric-mode.md § 5 slice 5).
 *
 * The floor-side render of the meeting whose screen-side render is the call
 * window (`MeetingOverlay`). `useMeetingPlayback` — mounted in `OfficeLayer`,
 * one instance for both worlds — already owns beat pacing, narration,
 * interjections and minutes, and appends one beat at a time to
 * `meeting.transcript`. So this module only ever *reads* state: there is no
 * pacing here and therefore no double-narration risk (unlike slice 4, where the
 * pacing had to be hoisted into a shared hook first). `OfficeLayer` still hides
 * the overlay while you are standing, but for the visual reason alone — two
 * meeting rooms on screen at once.
 *
 * Deliberately not a port of `MeetingOverlay`: that component is 333 lines of
 * its own layout, and the transcript history and the minutes card belong on a
 * screen, not in a room. The room shows who is here and who is talking; the
 * paperwork is what sitting down is for.
 *
 * Two exports because the meeting lands in two places, and a capture is what
 * settled it (§ 6 rule 12): `FloorMeeting` goes inside the scaled stage,
 * `FloorMeetingCard` is ordinary chrome beside the person card. A counter-scaled
 * panel pinned to the table — the obvious choice, and the one the plan called
 * for — is wider than the entire room and hid all nine people in it.
 */

import { useState } from 'react';
import FloorBubble from './FloorBubble.jsx';
import FloorFigure from './FloorFigure.jsx';
import { MEETING_USER_SPEAKER } from '../../hooks/useMeetingPlayback.js';
import { officeChromeCopy, officeMeetingCopy, officeSenderInfo } from '../../utils/officeCast.js';
import { formatLocale } from '../../i18n/formatLocale.js';
import {
  MEETING_BUBBLE_DEPTH,
  MEETING_PLAYER_TILE,
  depthOf,
  liftToDepth,
  meetingSeating,
  projectIso
} from '../../utils/officeFloorPlan.js';

/** Above the zone signage (9000), same as the arrival ceremony's speakers. */
const BUBBLE_Z = 9600;

/** Display fields for an attendee — or for you, who are in no cast bank. */
function actorInfo(castId, copy) {
  if (castId === MEETING_USER_SPEAKER) {
    return { name: copy.youName, title: copy.youTitle, accent: 'var(--accent)' };
  }
  const sender = officeSenderInfo(castId);
  return {
    name: sender?.name ?? castId,
    title: sender?.title ?? '',
    accent: sender?.accentColor ?? 'var(--accent)'
  };
}

/**
 * One attendee in their chair. Seated (the 30 px lift, § 6 rule 2) so heads
 * clear the table; whether the table then hides their lap or their torso sits
 * in front of it is pure paint order, which `MEETING_SEATS` arranges.
 */
function MeetingActor({ castId, tile, speaking, isYou, idleIndex, copy }) {
  const { left, top } = projectIso(tile.x, tile.y);
  const { name, title, accent } = actorInfo(castId, copy);

  return (
    <div
      className={`office-floor-walker office-floor-meeting-actor${speaking ? ' is-speaking' : ''}`}
      data-testid={`office-floor-meeting-seat-${castId}`}
      title={title ? `${name} — ${title}` : name}
      /*
       * Plain `depthOf`, with no nudge: the far row's whole job is to paint
       * *before* the meeting table, and a +5 would push the outermost mark past
       * it and float that attendee over the tabletop.
       */
      style={{ left, top, zIndex: depthOf(tile.x, tile.y) }}
    >
      <div className="office-floor-walker-anchor office-floor-walker-anchor--seated">
        <FloorFigure id={castId} accent={accent} isYou={isYou} idleIndex={idleIndex} />
      </div>
    </div>
  );
}

/**
 * The newest beat, on a fixed depth line above the room and in the speaker's own
 * screen column — so the tail points at them, the bubble clears the back row,
 * and it does not leap across the table on every beat. Its own positioned
 * element rather than a child of the figure, so the figure keeps its place in
 * the room's depth order while the bubble rides above the signage layer (§ 6
 * rule 6).
 */
function MeetingBubble({ speakerId, text, tile, scale, copy }) {
  const { name, title } = actorInfo(speakerId, copy);
  const above = liftToDepth(tile, MEETING_BUBBLE_DEPTH);
  const { left, top } = projectIso(above.x, above.y);
  return (
    <div
      className="office-floor-walker"
      data-testid="office-floor-meeting-bubble"
      style={{ left, top, zIndex: BUBBLE_Z }}
    >
      <div className="office-floor-walker-anchor">
        <FloorBubble name={name} title={title} scale={scale}>
          {text}
        </FloorBubble>
      </div>
    </div>
  );
}

/**
 * The room itself: everyone in their chair, and whatever was just said.
 *
 * @param {{
 *   meeting: {
 *     state: 'joining' | 'playing' | 'ended' | 'cancelled',
 *     attendees: string[],
 *     facilitatorId: string,
 *     transcript: Array<{ speakerId: string, text: string }>
 *   },
 *   copy: Record<string, any>,
 *   scale?: number
 * }} props `copy` is `officeChromeCopy().floor`.
 */
export function FloorMeeting({ meeting, copy, scale = 1 }) {
  const seating = meetingSeating(meeting.attendees, meeting.facilitatorId);
  const lastBeat = meeting.transcript[meeting.transcript.length - 1] ?? null;
  // Whoever spoke last holds the floor — the same rule the call window's seat
  // highlight uses, so the glow and the voice can never disagree.
  const speakingId = meeting.state === 'playing' && lastBeat ? lastBeat.speakerId : null;
  const seatOf = (castId) =>
    castId === MEETING_USER_SPEAKER
      ? MEETING_PLAYER_TILE
      : (seating.find((seat) => seat.id === castId)?.tile ?? null);
  const bubbleTile = speakingId ? seatOf(speakingId) : null;

  return (
    <>
      {seating.map(({ id, tile }, index) => (
        <MeetingActor
          key={id}
          castId={id}
          tile={tile}
          speaking={speakingId === id}
          idleIndex={index}
          isYou={false}
          copy={copy}
        />
      ))}
      <MeetingActor
        castId={MEETING_USER_SPEAKER}
        tile={MEETING_PLAYER_TILE}
        speaking={speakingId === MEETING_USER_SPEAKER}
        idleIndex={seating.length}
        isYou
        copy={copy}
      />

      {bubbleTile && lastBeat?.text ? (
        <MeetingBubble
          speakerId={speakingId}
          text={lastBeat.text}
          tile={bubbleTile}
          scale={scale}
          copy={copy}
        />
      ) : null}
    </>
  );
}

/** Raise a hand — the same capped one-liner the call window takes. */
function RaiseHandForm({ meeting, meetingCopy, chromeMeeting, onInterject }) {
  const [text, setText] = useState('');
  const spent = meeting.interjectionsLeft <= 0;

  const submit = (event) => {
    event.preventDefault();
    const line = text.trim();
    if (!line) return;
    setText('');
    onInterject?.(line);
  };

  return (
    <form className="office-floor-card-hand" onSubmit={submit}>
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={spent ? meetingCopy.interjectCapLine : meetingCopy.raiseHandPlaceholder}
        disabled={spent}
        maxLength={400}
        aria-label={chromeMeeting.raiseHandAria}
      />
      <button
        type="submit"
        className="office-floor-card-action office-floor-card-action--primary"
        disabled={spent || !text.trim()}
      >
        {spent
          ? chromeMeeting.atTime
          : formatLocale(chromeMeeting.raiseHand, { count: meeting.interjectionsLeft })}
      </button>
    </form>
  );
}

/**
 * The meeting's two inputs, in the same corner as every other floor card.
 *
 * Chrome, not diegesis — deliberately, and by measurement: the glass room is
 * ~170 px wide on screen and a counter-scaled panel over the table covered all
 * nine people in it. Rule 2 wants a labelled conventional control anyway; the
 * diegetic half of this slice is the room itself.
 *
 * @param {{
 *   meeting: any,
 *   copy: Record<string, any>,
 *   onInterject?: (text: string) => void,
 *   onLeave?: () => void,
 *   onSitDown?: () => void
 * }} props
 */
export function FloorMeetingCard({ meeting, copy, onInterject, onLeave, onSitDown }) {
  const meetingCopy = officeMeetingCopy();
  const chromeMeeting = officeChromeCopy().meeting;
  const floorMeeting = copy.meeting;
  const ended = meeting.state === 'ended';

  return (
    <aside
      className="office-floor-card office-floor-card--meeting"
      data-testid="office-floor-meeting-card"
      aria-live="polite"
    >
      <span className="office-floor-eyebrow">{floorMeeting.eyebrow}</span>
      <strong className="office-floor-card-heading">{meeting.title}</strong>

      {meeting.state === 'joining' ? (
        <p className="office-floor-card-blurb" role="status">
          {meetingCopy.joiningLine}
        </p>
      ) : null}

      {meeting.state === 'playing' ? (
        <RaiseHandForm
          meeting={meeting}
          meetingCopy={meetingCopy}
          chromeMeeting={chromeMeeting}
          onInterject={onInterject}
        />
      ) : null}

      {ended ? <p className="office-floor-card-blurb">{floorMeeting.endedLine}</p> : null}

      <div className="office-floor-card-actions">
        {ended ? (
          <>
            <button
              type="button"
              className="office-floor-card-action office-floor-card-action--primary"
              title={floorMeeting.readMinutesTitle}
              onClick={onSitDown}
            >
              {floorMeeting.readMinutes}
            </button>
            <button type="button" className="office-floor-card-action" onClick={onLeave}>
              {chromeMeeting.close}
            </button>
          </>
        ) : (
          <>
            {/* Sitting down leaves the meeting running and hands it back to the
                call window — the floor's equivalent of its docked mode. */}
            <button
              type="button"
              className="office-floor-card-action"
              title={floorMeeting.sitOutTitle}
              onClick={onSitDown}
            >
              {floorMeeting.sitOut}
            </button>
            <button
              type="button"
              className="office-floor-card-action"
              title={floorMeeting.leaveTitle}
              onClick={onLeave}
            >
              {floorMeeting.leave}
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

export default FloorMeeting;
