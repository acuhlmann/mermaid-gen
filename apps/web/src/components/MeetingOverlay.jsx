import { useCallback, useEffect, useRef, useState } from 'react';
import { meetingMinutes, MEETING_USER_SPEAKER } from '../hooks/useMeetingPlayback.js';
import { officeChromeCopy, officeMeetingCopy, officeSenderInfo } from '../utils/officeCast.js';
import {
  readOfficeMeetingMinimized,
  writeOfficeMeetingMinimized
} from '../utils/officeAmbienceStorage.js';
import { shouldShowSpokenText } from '../utils/officeCaptions.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';
import OfficeActionableChecklist from './OfficeActionableChecklist.jsx';
import VoiceMicButton from './VoiceMicButton.jsx';
import FloatingWindow, { FloatingWindowDragHandle } from './FloatingWindow.jsx';
import {
  FloatingWindowCloseButton,
  FloatingWindowMinimizeButton
} from './FloatingWindowChrome.jsx';

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

function MeetingTitlebar({ title, chrome, minimized, onToggleMinimized, onExit }) {
  return (
    <FloatingWindowDragHandle className="office-meeting-titlebar" title={chrome.meeting.dragHint}>
      <span className="office-meeting-title">📅 {title}</span>
      <div className="office-meeting-titlebar-actions">
        <FloatingWindowMinimizeButton
          minimized={minimized}
          minimizeLabel={chrome.meeting.minimize}
          restoreLabel={chrome.meeting.restore}
          minimizeTitle={chrome.meeting.minimizeTitle}
          restoreTitle={chrome.meeting.restoreTitle}
          onToggle={onToggleMinimized}
          className="office-meeting-minimize"
        />
        <FloatingWindowCloseButton
          label={chrome.meeting.close}
          onClose={onExit}
          className="office-meeting-leave"
        />
      </div>
    </FloatingWindowDragHandle>
  );
}

/** Zoom-style speaker tile — face + name only (no transcript when CC is off). */
function MeetingActiveSpeaker({ speakerId, chrome, flickKey }) {
  if (!speakerId) return null;
  const speaker = speakerInfo(speakerId, chrome);
  return (
    <div className="office-meeting-speaker-stage" role="status" aria-live="polite">
      <div
        key={flickKey}
        className="office-meeting-speaker-tile is-speaking office-meeting-speaker-flick"
      >
        <PersonaFace
          id={speakerId}
          size={64}
          className="office-meeting-speaker-face"
          fallbackEmoji={speaker.avatarEmoji}
        />
        <span className="office-meeting-speaker-name">{speaker.name}</span>
        {speaker.title ? (
          <span className="office-meeting-speaker-role">{speaker.title}</span>
        ) : null}
      </div>
    </div>
  );
}

/** Horizontal film strip of everyone in the meeting. */
function MeetingFilmStrip({ attendees, lastSpeakerId, chrome }) {
  return (
    <div className="office-meeting-filmstrip" aria-label="Meeting participants">
      {attendees.map((id) => {
        const seat = speakerInfo(id, chrome);
        const speaking = id === lastSpeakerId ? ' is-speaking' : '';
        return (
          <span
            key={id}
            className={`office-meeting-filmstrip-cell${speaking}`}
            title={`${seat.name}${seat.title ? ` · ${seat.title}` : ''}`}
          >
            <span className={`office-meeting-filmstrip-avatar${speaking}`}>
              <PersonaFace
                id={id}
                size={28}
                className="office-meeting-filmstrip-face"
                fallbackEmoji={seat.avatarEmoji}
              />
            </span>
            <span className="office-meeting-filmstrip-name">{seat.name}</span>
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

function MeetingMinutes({ minutes, copy, chrome, onAdoptAllPrompts }) {
  const [notesOpen, setNotesOpen] = useState(false);
  const actionItems = minutes.filter((beat) => beat.actionPrompt);
  const discussionItems = minutes.filter((beat) => !beat.actionPrompt);
  const actionPrompts = actionItems.map((beat) => beat.actionPrompt);

  const handleApplySelected = (mask) => {
    const chosen = actionPrompts.filter((_, index) => mask[index]);
    if (chosen.length === 0) return;
    onAdoptAllPrompts?.(chosen);
  };

  const handleApplyAll = () => {
    if (actionPrompts.length === 0) return;
    onAdoptAllPrompts?.(actionPrompts);
  };

  return (
    <section className="office-meeting-minutes" aria-labelledby="office-meeting-minutes-heading">
      <div className="office-meeting-minutes-hero">
        <div className="office-meeting-minutes-head">
          <div className="office-meeting-minutes-headline">
            <h3 id="office-meeting-minutes-heading" className="office-meeting-minutes-title">
              {copy.minutesTitle}
            </h3>
            {actionItems.length > 0 ? (
              <span className="office-meeting-minutes-count">
                {formatLocale(copy.actionItemsCount, { count: actionItems.length })}
              </span>
            ) : null}
          </div>
          <p className="office-meeting-minutes-lede">
            {actionItems.length > 0 ? copy.minutesActionLede : copy.minutesEmptyLede}
          </p>
        </div>
        {minutes.length === 0 ? (
          <p className="office-meeting-minutes-empty">{chrome.meeting.noMinutes}</p>
        ) : actionItems.length > 0 ? (
          <div className="office-meeting-minutes-actions-panel">
            <div className="office-meeting-minutes-group-label">{copy.actionItemsLabel}</div>
            <OfficeActionableChecklist
              headingText={null}
              items={actionPrompts}
              onApplySelected={handleApplySelected}
              onApplyAll={handleApplyAll}
            />
            <ul className="office-meeting-minute-list office-meeting-minute-list--context">
              {actionItems.map((beat, index) => {
                const speaker = speakerInfo(beat.speakerId, chrome);
                return (
                  <li key={`action-${index}`} className="office-meeting-minute-card is-readonly">
                    <div className="office-meeting-minute-card-head">
                      <PersonaFace
                        id={beat.speakerId}
                        size={24}
                        className="office-meeting-minute-avatar"
                        fallbackEmoji={speaker.avatarEmoji}
                      />
                      <div className="office-meeting-minute-card-meta">
                        <span className="office-meeting-minute-speaker">{speaker.name}</span>
                        {speaker.title ? (
                          <span className="office-meeting-minute-role">{speaker.title}</span>
                        ) : null}
                      </div>
                    </div>
                    {beat.text && beat.text !== beat.actionPrompt ? (
                      <p className="office-meeting-minute-context">{beat.text}</p>
                    ) : null}
                    <p className="office-meeting-minute-action">{beat.actionPrompt}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
      {discussionItems.length > 0 ? (
        <details
          className="office-meeting-minutes-notes"
          open={notesOpen}
          onToggle={(event) => setNotesOpen(event.currentTarget.open)}
        >
          <summary className="office-meeting-minutes-notes-toggle">
            {notesOpen ? chrome.meeting.discussionToggleHide : chrome.meeting.discussionToggle}
            <span className="office-meeting-minutes-notes-count">{discussionItems.length}</span>
          </summary>
          <ul className="office-meeting-minute-list office-meeting-minute-list--notes">
            {discussionItems.map((beat, index) => {
              const speaker = speakerInfo(beat.speakerId, chrome);
              return (
                <li key={`note-${index}`} className="office-meeting-minute-note">
                  <span className="office-meeting-minute-note-speaker">
                    {speaker.avatarEmoji} {speaker.name}
                  </span>
                  <p className="office-meeting-minute-note-text">{beat.text}</p>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/**
 * The WG meeting room (docs/office-parody.md): speaker view when CC is off
 * (face + name of whoever is talking, like Zoom), transcript when CC is on or
 * voice is muted, raise-hand interjection, and a minutes card when the meeting
 * wraps.
 */
export default function MeetingOverlay({
  meeting,
  captions = false,
  narration = true,
  onInterject,
  onLeave,
  onClose,
  onAdoptPrompt,
  onAdoptAllPrompts
}) {
  const [handText, setHandText] = useState('');
  const [minimized, setMinimized] = useState(readOfficeMeetingMinimized);
  const transcriptRef = useRef(null);
  const copy = officeMeetingCopy();
  const chrome = officeChromeCopy();

  const transcriptLength = meeting?.transcript.length ?? 0;
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcriptLength]);

  const toggleMinimized = useCallback(() => {
    setMinimized((prev) => {
      const next = !prev;
      writeOfficeMeetingMinimized(next);
      return next;
    });
  }, []);

  const ended = meeting?.state === 'ended';
  const joining = meeting?.state === 'joining';
  const prevEndedRef = useRef(false);
  const prevJoiningRef = useRef(false);
  useEffect(() => {
    // A fresh join always expands — leftover minimize from the last call would
    // make "Hop on a call" look like a silent no-op (titlebar only).
    if (joining && !prevJoiningRef.current) {
      setMinimized(false);
      writeOfficeMeetingMinimized(false);
    }
    prevJoiningRef.current = joining;
  }, [joining]);
  useEffect(() => {
    if (ended && !prevEndedRef.current) {
      setMinimized(false);
      writeOfficeMeetingMinimized(false);
    }
    prevEndedRef.current = ended;
  }, [ended]);

  const handleAdoptAll = useCallback(
    (prompts) => {
      onAdoptAllPrompts?.(prompts);
      onClose?.();
    },
    [onAdoptAllPrompts, onClose]
  );

  if (!meeting) return null;

  const lastSpeakerId = meeting.transcript[meeting.transcript.length - 1]?.speakerId ?? null;
  const minutes = meetingMinutes(meeting);
  const playing = meeting.state === 'playing';
  const voiceActive = Boolean(narration && meeting.voiceSpeaking);
  const showTranscript = shouldShowSpokenText({ captions, voiceActive });
  const speakerView = playing && !showTranscript;

  const submitHand = (event) => {
    event.preventDefault();
    const text = handText.trim();
    if (!text) return;
    setHandText('');
    onInterject?.(text);
  };

  const windowClass = [
    'office-meeting-room',
    minimized ? 'is-minimized' : '',
    ended ? 'is-ended' : '',
    speakerView ? 'is-speaker-view' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <FloatingWindow
      id="office-meeting"
      open
      group="officeModal"
      className={windowClass}
      kind="meeting"
      title={meeting.title}
      defaultCorner="center"
      defaultOffsetX={0}
      defaultOffsetY={0}
      cascade={2}
      storageKey="office-meeting"
      role="dialog"
      aria-modal="false"
      aria-label={meeting.title}
    >
      <MeetingTitlebar
        title={meeting.title}
        chrome={chrome}
        minimized={minimized}
        onToggleMinimized={toggleMinimized}
        onExit={() => onClose?.()}
      />
      {minimized ? null : (
        <div className="office-meeting-body">
          {playing ? (
            <MeetingFilmStrip
              attendees={meeting.attendees}
              lastSpeakerId={lastSpeakerId}
              chrome={chrome}
            />
          ) : null}
          {speakerView ? (
            <MeetingActiveSpeaker
              speakerId={lastSpeakerId}
              chrome={chrome}
              flickKey={transcriptLength}
            />
          ) : null}
          {meeting.state === 'joining' ? (
            <div className="office-meeting-joining" role="status">
              {copy.joiningLine}
            </div>
          ) : ended ? (
            <MeetingMinutes
              minutes={minutes}
              copy={copy}
              chrome={chrome}
              onAdoptAllPrompts={handleAdoptAll}
            />
          ) : showTranscript ? (
            <MeetingTranscript
              transcript={meeting.transcript}
              chrome={chrome}
              ended={ended}
              playing={playing}
              onAdoptPrompt={onAdoptPrompt}
              scrollRef={transcriptRef}
            />
          ) : null}
          {playing ? (
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
              <VoiceMicButton
                value={handText}
                onChange={setHandText}
                disabled={meeting.interjectionsLeft <= 0}
                className="office-meeting-mic overlay-button is-mic-toggle"
              />
              <button type="submit" disabled={meeting.interjectionsLeft <= 0 || !handText.trim()}>
                {meeting.interjectionsLeft > 0
                  ? formatLocale(chrome.meeting.raiseHand, { count: meeting.interjectionsLeft })
                  : chrome.meeting.atTime}
              </button>
            </form>
          ) : null}
        </div>
      )}
    </FloatingWindow>
  );
}
