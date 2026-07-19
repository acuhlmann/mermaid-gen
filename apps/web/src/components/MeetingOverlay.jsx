import { useCallback, useEffect, useRef, useState } from 'react';
import { meetingMinutes, MEETING_USER_SPEAKER } from '../hooks/useMeetingPlayback.js';
import { officeChromeCopy, officeMeetingCopy, officeSenderInfo } from '../utils/officeCast.js';
import {
  readOfficeMeetingDocked,
  writeOfficeMeetingDocked
} from '../utils/officeAmbienceStorage.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';

function speakerInfo(speakerId, chrome) {
  if (speakerId === MEETING_USER_SPEAKER) {
    return {
      id: MEETING_USER_SPEAKER,
      name: chrome.meeting.youName,
      title: '',
      avatarEmoji: '🙋',
      accentColor: 'var(--accent)'
    };
  }
  return officeSenderInfo(speakerId);
}

function MeetingTitlebar({ title, chrome, copy, docked, ended, onToggleDocked, onExit }) {
  return (
    <div className="office-meeting-titlebar">
      <span className="office-meeting-title">📅 {title}</span>
      <button
        type="button"
        className="office-meeting-dock"
        onClick={onToggleDocked}
        aria-pressed={docked}
        title={docked ? chrome.meeting.undockTitle : chrome.meeting.dockTitle}
      >
        {docked ? chrome.meeting.undock : chrome.meeting.dock}
      </button>
      <button type="button" className="office-meeting-leave" onClick={onExit}>
        {ended ? chrome.meeting.close : copy.leaveLabel}
      </button>
    </div>
  );
}

function MeetingSeats({ attendees, lastSpeakerId, chrome }) {
  return (
    <div className="office-meeting-seats" aria-hidden="true">
      {attendees.map((id) => {
        const seat = speakerInfo(id, chrome);
        const speaking = id === lastSpeakerId ? ' is-speaking' : '';
        return (
          <span
            key={id}
            className={`office-meeting-seat-cell${speaking}`}
            title={`${seat.name}${seat.title ? ` · ${seat.title}` : ''}`}
          >
            <span className={`office-meeting-seat${speaking}`}>
              <PersonaFace
                id={id}
                size={30}
                className="office-meeting-seat-face"
                fallbackEmoji={seat.avatarEmoji}
              />
            </span>
            <span className="office-meeting-seat-name">{seat.name}</span>
          </span>
        );
      })}
    </div>
  );
}

function MeetingTranscript({ transcript, chrome, ended, playing, onAdoptPrompt, scrollRef }) {
  return (
    <div className="office-meeting-transcript" ref={scrollRef}>
      {transcript.map((beat, index) => {
        const speaker = speakerInfo(beat.speakerId, chrome);
        const isUser = beat.speakerId === MEETING_USER_SPEAKER;
        return (
          <div
            key={index}
            className={`office-meeting-beat office-meeting-beat--${beat.kind}${isUser ? ' is-user' : ''}`}
          >
            <PersonaFace
              id={beat.speakerId}
              size={26}
              className="office-meeting-beat-avatar"
              fallbackEmoji={speaker.avatarEmoji}
            />
            <div className="office-meeting-beat-bubble">
              <span
                className="office-meeting-beat-name"
                title={speaker.title ? `${speaker.name} · ${speaker.title}` : speaker.name}
              >
                {speaker.name}
                {speaker.title ? (
                  <span className="office-meeting-beat-role"> · {speaker.title}</span>
                ) : null}
              </span>
              <p className="office-meeting-beat-text">{beat.text}</p>
              {ended && beat.actionPrompt ? (
                <button
                  type="button"
                  className="office-do-it"
                  onClick={() => onAdoptPrompt?.(beat.actionPrompt, beat.speakerId)}
                >
                  {chrome.doIt}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
      {playing ? (
        <div className="office-meeting-typing" aria-hidden="true">
          …
        </div>
      ) : null}
    </div>
  );
}

function MeetingMinutes({ minutes, copy, chrome, onAdoptPrompt }) {
  return (
    <div className="office-meeting-minutes">
      <div className="office-meeting-minutes-title">{copy.minutesTitle}</div>
      {minutes.length === 0 ? (
        <p className="office-meeting-minutes-empty">{chrome.meeting.noMinutes}</p>
      ) : (
        <ul>
          {minutes.map((beat, index) => {
            const speaker = speakerInfo(beat.speakerId, chrome);
            return (
              <li key={index} className="office-meeting-minute">
                <span>
                  {speaker.avatarEmoji} {beat.actionPrompt ?? beat.text}
                </span>
                {beat.actionPrompt ? (
                  <button
                    type="button"
                    className="office-do-it"
                    onClick={() => onAdoptPrompt?.(beat.actionPrompt, beat.speakerId)}
                  >
                    {chrome.doIt}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * The WG meeting room (docs/office-parody.md): avatar row with a speaking
 * highlight, transcript bubbles pacing in from useMeetingPlayback, a
 * raise-hand interjection input (capped), leave button, and the minutes card
 * with "Do it" action items when the meeting wraps.
 *
 * Two presentation modes, because a real meeting doesn't confiscate your
 * screen: **centred** (the default first-run beat — you are In A Meeting) and
 * **docked**, where the room shrinks to a corner card, drops `aria-modal`, and
 * stops swallowing pointer events so the user can keep editing the diagram the
 * cast is arguing about. The choice persists (readOfficeMeetingDocked), so
 * anyone who prefers to multitask only has to say so once.
 */
export default function MeetingOverlay({ meeting, onInterject, onLeave, onClose, onAdoptPrompt }) {
  const [handText, setHandText] = useState('');
  const [docked, setDocked] = useState(readOfficeMeetingDocked);
  const transcriptRef = useRef(null);
  const copy = officeMeetingCopy();
  const chrome = officeChromeCopy();

  const transcriptLength = meeting?.transcript.length ?? 0;
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcriptLength]);

  const toggleDocked = useCallback(() => {
    setDocked((prev) => {
      writeOfficeMeetingDocked(!prev);
      return !prev;
    });
  }, []);

  // Escape docks the meeting rather than leaving it — losing an in-flight
  // meeting to a stray keypress would be worse than the modality it fixes.
  useEffect(() => {
    if (!meeting || docked) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setDocked(true);
      writeOfficeMeetingDocked(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [meeting, docked]);

  if (!meeting) return null;

  const lastSpeakerId = meeting.transcript[meeting.transcript.length - 1]?.speakerId ?? null;
  const minutes = meetingMinutes(meeting);
  const ended = meeting.state === 'ended';
  const playing = meeting.state === 'playing';

  const submitHand = (event) => {
    event.preventDefault();
    const text = handText.trim();
    if (!text) return;
    setHandText('');
    onInterject?.(text);
  };

  return (
    <div
      className={`office-meeting-backdrop${docked ? ' is-docked' : ''}`}
      role="dialog"
      // Docked, the meeting is a non-blocking side panel: claiming aria-modal
      // would lie to screen readers about the canvas being inert.
      aria-modal={docked ? 'false' : 'true'}
      aria-label={meeting.title}
    >
      <div className="office-meeting-room">
        <MeetingTitlebar
          title={meeting.title}
          chrome={chrome}
          copy={copy}
          docked={docked}
          ended={ended}
          onToggleDocked={toggleDocked}
          onExit={ended ? onClose : onLeave}
        />
        <MeetingSeats attendees={meeting.attendees} lastSpeakerId={lastSpeakerId} chrome={chrome} />
        {meeting.state === 'joining' ? (
          <div className="office-meeting-joining" role="status">
            {copy.joiningLine}
          </div>
        ) : (
          <MeetingTranscript
            transcript={meeting.transcript}
            chrome={chrome}
            ended={ended}
            playing={playing}
            onAdoptPrompt={onAdoptPrompt}
            scrollRef={transcriptRef}
          />
        )}
        {ended ? (
          <MeetingMinutes
            minutes={minutes}
            copy={copy}
            chrome={chrome}
            onAdoptPrompt={onAdoptPrompt}
          />
        ) : playing ? (
          <form className="office-meeting-hand" onSubmit={submitHand}>
            <input
              type="text"
              value={handText}
              onChange={(event) => setHandText(event.target.value)}
              placeholder={
                meeting.interjectionsLeft > 0 ? copy.raiseHandPlaceholder : copy.interjectCapLine
              }
              disabled={meeting.interjectionsLeft <= 0}
              maxLength={400}
              aria-label={chrome.meeting.raiseHandAria}
            />
            <button type="submit" disabled={meeting.interjectionsLeft <= 0 || !handText.trim()}>
              {meeting.interjectionsLeft > 0
                ? formatLocale(chrome.meeting.raiseHand, { count: meeting.interjectionsLeft })
                : chrome.meeting.atTime}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
