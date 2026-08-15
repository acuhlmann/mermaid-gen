/**
 * Meetings on the floor (docs/office-parody.md + docs/office-isometric-mode.md).
 *
 * Two modalities, one playback state (ADR-0011):
 * - **physical** — everyone sits in the glass room (including you). Desks empty.
 * - **remote** — everyone stays at their desk with a headset; this module only
 *   draws the speech bubble above the speaker's chair. Headsets themselves are
 *   painted by `FloorStage` via `onCallIds`.
 *
 * The screen-side render is still `MeetingOverlay`. `useMeetingPlayback` owns
 * beat pacing; this module only ever *reads* state.
 */

import { useState } from 'react';
import VoiceMicButton from '../VoiceMicButton.jsx';
import FloorBubble from './FloorBubble.jsx';
import FloorFigure from './FloorFigure.jsx';
import { MEETING_USER_SPEAKER } from '../../hooks/useMeetingPlayback.js';
import {
  MEETING_MODALITY_REMOTE,
  officeChromeCopy,
  officeMeetingCopy,
  officeSenderInfo
} from '../../utils/officeCast.js';
import { formatLocale } from '../../i18n/formatLocale.js';
import { meetingActivityFor } from '../../utils/officeFloorActivity.js';
import {
  MEETING_PLAYER_TILE,
  YOU_SEAT_ID,
  bubbleAlignForTile,
  depthOf,
  meetingSeating,
  projectIso,
  seatFor
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

function isRemoteMeeting(meeting) {
  return meeting?.modality === MEETING_MODALITY_REMOTE;
}

/**
 * One attendee in their chair. Seated (the 30 px lift, § 6 rule 2) so heads
 * clear the table; whether the table then hides their lap or their torso sits
 * in front of it is pure paint order, which `MEETING_SEATS` arranges.
 *
 * `activity` is slice 29 and arrives derived, like every other figure on this
 * floor — `meetingActivityFor`, never composed here (see `officeFloorActivity.js`).
 */
function MeetingActor({ castId, tile, speaking, isYou, idleIndex, copy, activity }) {
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
        <FloorFigure
          id={castId}
          accent={accent}
          isYou={isYou}
          idleIndex={idleIndex}
          activity={activity}
        />
      </div>
    </div>
  );
}

/**
 * Desk-side bubble for a remote headset sync — sits above their own chair.
 */
function RemoteMeetingBubble({ speakerId, text, scale, copy }) {
  const seatId = speakerId === MEETING_USER_SPEAKER ? YOU_SEAT_ID : speakerId;
  const seat = seatFor(seatId);
  if (!seat) return null;
  const tile = { x: seat.x, y: seat.y };
  const { name, title } = actorInfo(speakerId, copy);
  const above = { x: tile.x, y: tile.x + tile.y - 0.55 };
  const { left, top } = projectIso(above.x, above.y);
  const align = bubbleAlignForTile(tile);
  return (
    <div
      className="office-floor-walker"
      data-testid="office-floor-meeting-bubble"
      data-modality="remote"
      style={{ left, top, zIndex: BUBBLE_Z }}
    >
      <div className="office-floor-walker-anchor">
        <FloorBubble name={name} title={title} scale={scale} align={align}>
          {text}
        </FloorBubble>
      </div>
    </div>
  );
}

/**
 * Physical: everyone in the glass room. Remote: bubble only (headsets on desks).
 *
 * @param {{
 *   meeting: {
 *     state: 'joining' | 'playing' | 'ended' | 'cancelled',
 *     attendees: string[],
 *     facilitatorId: string,
 *     modality?: string,
 *     transcript: Array<{ speakerId: string, text: string }>
 *   },
 *   copy: Record<string, any>,
 *   scale?: number,
 *   showSpokenText?: boolean,
 *   walkingIds?: Set<string> | null,
 *   dayPhase?: string | null
 * }} props `dayPhase` is slice 29 — the hour, which is what everybody who did
 *   not call the meeting is holding. No default for the same reason `FloorStage`
 *   has none: `meetingActivityFor` reads it for truthiness, so `= null` would
 *   buy a branch on the complexity budget and no behaviour.
 *
 *   `walkingIds` is slice 27: an attendee still crossing the floor to
 *   the threshold is being drawn by `FloorCommuters`, and two of anybody is
 *   § 6 rule 5. `null` means "don't ask" — a standalone mount with no commute
 *   hook seats the whole roster, exactly as slice 5 did.
 *
 *   Note this is the **complement** of the `settledIds` that `FloorScene` and
 *   `FloorHuddle` take, and the difference is not stylistic. Their casts commute
 *   in full, so "absent from settled" means "still walking". This one's does
 *   not — the leadership tier is sealed in its own fishbowl and never sets off —
 *   so gating on arrival would empty every executive out of the meeting.
 */
export function FloorMeeting({
  meeting,
  copy,
  scale = 1,
  showSpokenText = true,
  walkingIds = null,
  dayPhase
}) {
  const remote = isRemoteMeeting(meeting);
  const seating = remote ? [] : meetingSeating(meeting.attendees, meeting.facilitatorId);
  const lastBeat = meeting.transcript[meeting.transcript.length - 1] ?? null;
  const speakingId = meeting.state === 'playing' && lastBeat ? lastBeat.speakerId : null;

  if (remote) {
    return showSpokenText && speakingId && lastBeat?.text ? (
      <RemoteMeetingBubble speakerId={speakingId} text={lastBeat.text} scale={scale} copy={copy} />
    ) : null;
  }

  return (
    <>
      {seating.map(({ id, tile }, index) =>
        walkingIds?.has(id) ? null : (
          <MeetingActor
            key={id}
            castId={id}
            tile={tile}
            speaking={speakingId === id}
            idleIndex={index}
            isYou={false}
            copy={copy}
            // Keyed on the id rather than on `index === 0`: `meetingSeating`
            // only promotes the facilitator to the head seat when they are
            // actually on the invite, so a meeting whose facilitator was not
            // invited has nobody holding the agenda — which is correct.
            activity={meetingActivityFor(id, {
              facilitator: id === meeting.facilitatorId,
              dayPhase
            })}
          />
        )
      )}
      <MeetingActor
        castId={MEETING_USER_SPEAKER}
        tile={MEETING_PLAYER_TILE}
        speaking={speakingId === MEETING_USER_SPEAKER}
        idleIndex={seating.length}
        isYou
        copy={copy}
        // You never chair one of these (the server picks a cast id), so you get
        // the hour like everybody else who was summoned.
        activity={meetingActivityFor(MEETING_USER_SPEAKER, { dayPhase })}
      />
    </>
  );
}

/** Speak to the room — capped interjections, mic parity with the call window. */
function MeetingSpeakForm({ meeting, meetingCopy, chromeMeeting, onInterject }) {
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
        placeholder={spent ? meetingCopy.interjectCapLine : meetingCopy.speakPlaceholder}
        disabled={spent}
        maxLength={400}
        aria-label={chromeMeeting.speakAria}
      />
      <VoiceMicButton
        value={text}
        onChange={setText}
        disabled={spent}
        className="office-floor-card-mic overlay-button is-mic-toggle"
      />
      <button
        type="submit"
        className="office-floor-card-action office-floor-card-action--primary"
        disabled={spent || !text.trim()}
      >
        {spent
          ? chromeMeeting.atTime
          : formatLocale(chromeMeeting.speak, { count: meeting.interjectionsLeft })}
      </button>
    </form>
  );
}

/**
 * The meeting's chrome card beside the person card.
 */
export function FloorMeetingCard({ meeting, copy, onInterject, onLeave, onSitDown }) {
  const meetingCopy = officeMeetingCopy();
  const chromeMeeting = officeChromeCopy().meeting;
  const floorMeeting = copy.meeting;
  const ended = meeting.state === 'ended';
  const remote = isRemoteMeeting(meeting);

  return (
    <aside
      className="office-floor-card office-floor-card--meeting"
      data-testid="office-floor-meeting-card"
      data-modality={remote ? 'remote' : 'physical'}
      aria-live="polite"
    >
      <span className="office-floor-eyebrow">
        {remote ? (floorMeeting.eyebrowRemote ?? floorMeeting.eyebrow) : floorMeeting.eyebrow}
      </span>
      <strong className="office-floor-card-heading">{meeting.title}</strong>

      {meeting.state === 'playing' ? (
        <MeetingSpeakForm
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
