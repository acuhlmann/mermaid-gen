import { useEffect, useState } from 'react';
import {
  meetingTopicFromEmailSubjects,
  officeChromeCopy,
  officeSenderInfo
} from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';
import FloatingWindow, { FloatingWindowDragHandle } from './FloatingWindow.jsx';

/**
 * The corporate inbox (docs/office-parody.md): an envelope button with an
 * unread badge, opening a popover with the email list, a reading pane,
 * the Focus Time / Soundscape / Narration / Captions toggles (compact toolbar
 * under the title), and the "Call a meeting" shortcut. Pure props — OfficeLayer
 * owns the store subscription. Narration covers walk-bys and meetings only;
 * emails stay silent (nobody reads your inbox out loud). Captions (CC) shows
 * spoken dialogue as on-screen text when voice is playing.
 *
 * "Call a meeting" opens the people/group picker (seeded with selected
 * senders + email subjects as the topic) rather than instantly summoning a
 * random steering committee — like grabbing people after a thread in a real
 * office.
 */
export default function OfficeInboxDock({
  openSignal = 0,
  emails,
  unreadCount,
  focusTime,
  soundscape,
  narration,
  captions,
  onToggleFocusTime,
  onToggleSoundscape,
  onToggleNarration,
  onToggleCaptions,
  onMarkRead,
  onMarkAllRead,
  onAdoptPrompt,
  onCallMeeting,
  canCallMeeting,
  showTrigger = true
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedEmailIds, setSelectedEmailIds] = useState(() => new Set());
  const selected = emails.find((email) => email.id === selectedId) ?? null;
  const copy = officeChromeCopy();
  const selectedCount = selectedEmailIds.size;
  const implicitSingleEmail = emails.length === 1 && selectedCount === 0 ? emails[0] : null;
  const meetingEmailCount = selectedCount > 0 ? selectedCount : implicitSingleEmail ? 1 : 0;
  const canCallFromSelection = canCallMeeting && meetingEmailCount > 0;

  // The desk menu's "Check your mail" verb bumps openSignal; 0 is the initial
  // value, so the inbox never pops open on mount.
  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);

  // One email in the tray — pre-select it so "Call a meeting" works without an
  // extra checkbox tap (multi-email still requires explicit selection).
  useEffect(() => {
    if (!open || emails.length !== 1 || selectedId) return;
    setSelectedEmailIds((prev) => {
      if (prev.size > 0) return prev;
      return new Set([emails[0].id]);
    });
  }, [open, emails, selectedId]);

  const toggleOpen = () => {
    setOpen((prev) => {
      if (prev) {
        setSelectedId(null);
        setSelectedEmailIds(new Set());
      }
      return !prev;
    });
  };

  const openEmail = (email) => {
    setSelectedId(email.id);
    if (!email.read) onMarkRead?.(email.id);
  };

  const toggleEmailSelection = (emailId) => {
    setSelectedEmailIds((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) next.delete(emailId);
      else next.add(emailId);
      return next;
    });
  };

  const resolveMeetingEmails = () => {
    if (selectedEmailIds.size > 0) {
      return emails.filter((email) => selectedEmailIds.has(email.id));
    }
    if (emails.length === 1) return emails;
    return [];
  };

  const callMeetingFromEmails = (emailList) => {
    if (!canCallMeeting || emailList.length === 0) return;
    const colleagueIds = [...new Set(emailList.map((email) => email.colleagueId))];
    onCallMeeting?.({
      seedAttendees: colleagueIds,
      topic: meetingTopicFromEmailSubjects(emailList.map((email) => email.subject)),
      source: 'email'
    });
    setOpen(false);
    setSelectedId(null);
    setSelectedEmailIds(new Set());
  };

  const handleCallMeeting = () => {
    callMeetingFromEmails(resolveMeetingEmails());
  };

  const handleCallMeetingAboutOpenEmail = () => {
    if (!selected) return;
    callMeetingFromEmails([selected]);
  };

  const callMeetingLabel =
    meetingEmailCount > 0
      ? formatLocale(copy.inbox.callMeetingWithCount, { count: meetingEmailCount })
      : copy.inbox.callMeeting;

  const callMeetingTitle = !canCallMeeting
    ? copy.inbox.callMeetingDisabledTitle
    : meetingEmailCount > 0
      ? copy.inbox.callMeetingFromSelectionTitle
      : copy.inbox.callMeetingSelectTitle;

  return (
    <div className={`office-inbox${showTrigger ? '' : ' office-inbox--headless'}`}>
      {showTrigger ? (
        <button
          type="button"
          className={`office-inbox-button${open ? ' is-open' : ''}${focusTime ? ' is-focus-time' : ''}`}
          aria-label={
            unreadCount > 0
              ? formatLocale(copy.inbox.unreadAria, { count: unreadCount })
              : copy.inbox.noUnreadAria
          }
          aria-expanded={open}
          title={copy.inbox.buttonTitle}
          onClick={toggleOpen}
        >
          <span aria-hidden="true">{focusTime ? '📪' : '📥'}</span>
          {unreadCount > 0 ? (
            <span className="office-inbox-badge" aria-hidden="true">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </button>
      ) : null}
      {open ? (
        <FloatingWindow
          id="office-inbox"
          open={open}
          group="officeModal"
          className="office-inbox-popover"
          kind="inbox"
          defaultCorner="center"
          defaultOffsetX={0}
          defaultOffsetY={0}
          cascade={0}
          role="dialog"
          aria-label={copy.inbox.buttonTitle}
        >
          <FloatingWindowDragHandle
            className="office-inbox-header"
            title={copy.inbox.dragHint ?? 'Drag to move'}
          >
            <div className="office-inbox-header-row">
              <span className="office-inbox-title">{copy.inbox.title}</span>
              <button
                type="button"
                className="office-inbox-close"
                aria-label={copy.inbox.closeAria}
                onClick={toggleOpen}
              >
                ×
              </button>
            </div>
            <div className="office-inbox-toggles" role="group" aria-label={copy.inbox.togglesAria}>
              <label className="office-focus-toggle" title={copy.inbox.focusTimeTitle}>
                <input
                  type="checkbox"
                  checked={focusTime}
                  onChange={() => onToggleFocusTime?.(!focusTime)}
                />
                <span>{copy.inbox.focusTimeLabel}</span>
              </label>
              <label className="office-focus-toggle" title={copy.inbox.soundscapeTitle}>
                <input
                  type="checkbox"
                  checked={Boolean(soundscape)}
                  onChange={() => onToggleSoundscape?.(!soundscape)}
                />
                <span>{copy.inbox.soundscapeLabel}</span>
              </label>
              <label className="office-focus-toggle" title={copy.inbox.narrationTitle}>
                <input
                  type="checkbox"
                  checked={Boolean(narration)}
                  onChange={() => onToggleNarration?.(!narration)}
                />
                <span>{copy.inbox.narrationLabel}</span>
              </label>
              <label className="office-focus-toggle" title={copy.inbox.captionsTitle}>
                <input
                  type="checkbox"
                  checked={Boolean(captions)}
                  onChange={() => onToggleCaptions?.(!captions)}
                />
                <span>{copy.inbox.captionsLabel}</span>
              </label>
            </div>
          </FloatingWindowDragHandle>
          {selected ? (
            <div className="office-email-view">
              <button
                type="button"
                className="office-email-back"
                onClick={() => setSelectedId(null)}
              >
                {copy.inbox.back}
              </button>
              <OfficeEmailHeader email={selected} />
              <p className="office-email-body">{selected.body}</p>
              {selected.actionPrompt ? (
                <button
                  type="button"
                  className="office-do-it"
                  onClick={() => onAdoptPrompt?.(selected.actionPrompt, selected.colleagueId)}
                >
                  {copy.doIt}
                </button>
              ) : null}
              <button
                type="button"
                className="office-call-meeting office-email-call-meeting"
                onClick={handleCallMeetingAboutOpenEmail}
                disabled={!canCallMeeting}
                title={canCallMeeting ? copy.inbox.callMeetingFromSelectionTitle : callMeetingTitle}
              >
                {copy.inbox.callMeetingAboutEmail}
              </button>
            </div>
          ) : (
            <>
              <ul className="office-email-list">
                {emails.length === 0 ? (
                  <li className="office-email-empty">{copy.inbox.emptyLine}</li>
                ) : (
                  emails.map((email) => {
                    const sender = officeSenderInfo(email.colleagueId);
                    const isChecked = selectedEmailIds.has(email.id);
                    return (
                      <li key={email.id}>
                        <div className={`office-email-row-wrap${isChecked ? ' is-selected' : ''}`}>
                          <label className="office-email-select">
                            <input
                              type="checkbox"
                              className="office-email-select-input"
                              checked={isChecked}
                              onChange={() => toggleEmailSelection(email.id)}
                              aria-label={formatLocale(copy.inbox.selectEmailAria, {
                                name: sender.name
                              })}
                            />
                          </label>
                          <button
                            type="button"
                            className={`office-email-row${email.read ? '' : ' is-unread'}`}
                            onClick={() => openEmail(email)}
                          >
                            <span
                              className="office-email-avatar"
                              aria-hidden="true"
                              title={
                                sender.title ? `${sender.name} · ${sender.title}` : sender.name
                              }
                            >
                              <PersonaFace id={email.colleagueId} size={24} />
                            </span>
                            <span className="office-email-meta">
                              <span className="office-email-sender">
                                {sender.name}
                                {sender.title ? (
                                  <span className="office-email-sender-role">
                                    {' '}
                                    · {sender.title}
                                  </span>
                                ) : null}
                              </span>
                              <span className="office-email-subject">{email.subject}</span>
                            </span>
                          </button>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
              <div className="office-inbox-footer">
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    className="office-inbox-footer-action"
                    onClick={onMarkAllRead}
                  >
                    {copy.inbox.markAllRead}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="office-inbox-footer-action office-call-meeting"
                  onClick={handleCallMeeting}
                  disabled={!canCallFromSelection}
                  title={callMeetingTitle}
                >
                  {callMeetingLabel}
                </button>
              </div>
            </>
          )}
        </FloatingWindow>
      ) : null}
    </div>
  );
}

function OfficeEmailHeader({ email }) {
  const sender = officeSenderInfo(email.colleagueId);
  return (
    <div className="office-email-head">
      <PersonaFace id={email.colleagueId} size={30} className="office-email-avatar" />
      <div>
        <div className="office-email-sender">
          {sender.name}
          {sender.title ? (
            <span className="office-email-sender-title"> · {sender.title}</span>
          ) : null}
        </div>
        <div className="office-email-subject">{email.subject}</div>
      </div>
    </div>
  );
}
