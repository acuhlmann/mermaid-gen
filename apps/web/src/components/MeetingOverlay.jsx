import { useEffect, useRef, useState } from 'react';
import { meetingMinutes, MEETING_USER_SPEAKER } from '../hooks/useMeetingPlayback.js';
import { officeChromeCopy, officeMeetingCopy, officeSenderInfo } from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';

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

/**
 * The WG meeting room (docs/office-parody.md): avatar row with a speaking
 * highlight, transcript bubbles pacing in from useMeetingPlayback, a
 * raise-hand interjection input (capped), leave button, and the minutes card
 * with "Do it" action items when the meeting wraps.
 */
export default function MeetingOverlay({ meeting, onInterject, onLeave, onClose, onAdoptPrompt }) {
  const [handText, setHandText] = useState('');
  const transcriptRef = useRef(null);
  const copy = officeMeetingCopy();
  const chrome = officeChromeCopy();

  const transcriptLength = meeting?.transcript.length ?? 0;
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcriptLength]);

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
      className="office-meeting-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={meeting.title}
    >
      <div className="office-meeting-room">
        <div className="office-meeting-titlebar">
          <span className="office-meeting-title">📅 {meeting.title}</span>
          <button
            type="button"
            className="office-meeting-leave"
            onClick={ended ? onClose : onLeave}
          >
            {ended ? chrome.meeting.close : copy.leaveLabel}
          </button>
        </div>
        <div className="office-meeting-seats" aria-hidden="true">
          {meeting.attendees.map((id) => {
            const seat = speakerInfo(id, chrome);
            return (
              <span
                key={id}
                className={`office-meeting-seat-cell${id === lastSpeakerId ? ' is-speaking' : ''}`}
                title={`${seat.name}${seat.title ? ` · ${seat.title}` : ''}`}
              >
                <span
                  className={`office-meeting-seat${id === lastSpeakerId ? ' is-speaking' : ''}`}
                  style={{ borderColor: seat.accentColor }}
                >
                  {seat.avatarEmoji}
                </span>
                <span className="office-meeting-seat-name">{seat.name}</span>
              </span>
            );
          })}
        </div>
        {meeting.state === 'joining' ? (
          <div className="office-meeting-joining" role="status">
            {copy.joiningLine}
          </div>
        ) : (
          <div className="office-meeting-transcript" ref={transcriptRef}>
            {meeting.transcript.map((beat, index) => {
              const speaker = speakerInfo(beat.speakerId, chrome);
              const isUser = beat.speakerId === MEETING_USER_SPEAKER;
              return (
                <div
                  key={index}
                  className={`office-meeting-beat office-meeting-beat--${beat.kind}${isUser ? ' is-user' : ''}`}
                >
                  <span className="office-meeting-beat-avatar" aria-hidden="true">
                    {speaker.avatarEmoji}
                  </span>
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
        )}
        {ended ? (
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
