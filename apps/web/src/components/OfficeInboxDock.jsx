import { useState } from 'react';
import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';

/**
 * The corporate inbox (docs/office-parody.md): an envelope button with an
 * unread badge, opening a popover with the email list, a reading pane,
 * the Focus Time (office DND) + Soundscape + Narration toggles, and the
 * "Call a meeting" shortcut. Pure props — OfficeLayer owns the store
 * subscription. Narration covers walk-bys and meetings only; emails stay
 * silent (nobody reads your inbox out loud).
 */
export default function OfficeInboxDock({
  emails,
  unreadCount,
  focusTime,
  soundscape,
  narration,
  onToggleFocusTime,
  onToggleSoundscape,
  onToggleNarration,
  onMarkRead,
  onMarkAllRead,
  onAdoptPrompt,
  onCallMeeting,
  canCallMeeting
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const selected = emails.find((email) => email.id === selectedId) ?? null;
  const copy = officeChromeCopy();

  const toggleOpen = () => {
    setOpen((prev) => {
      if (prev) setSelectedId(null);
      return !prev;
    });
  };

  const openEmail = (email) => {
    setSelectedId(email.id);
    if (!email.read) onMarkRead?.(email.id);
  };

  return (
    <div className="office-inbox">
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
      {open ? (
        <div className="office-inbox-popover" role="dialog" aria-label={copy.inbox.buttonTitle}>
          <div className="office-inbox-header">
            <span className="office-inbox-title">{copy.inbox.title}</span>
            <label className="office-focus-toggle" title={copy.inbox.focusTimeTitle}>
              <input
                type="checkbox"
                checked={focusTime}
                onChange={() => onToggleFocusTime?.(!focusTime)}
              />
              <span>{copy.inbox.focusTimeLabel}</span>
            </label>
            <label
              className="office-focus-toggle office-soundscape-toggle"
              title={copy.inbox.soundscapeTitle}
            >
              <input
                type="checkbox"
                checked={Boolean(soundscape)}
                onChange={() => onToggleSoundscape?.(!soundscape)}
              />
              <span>{copy.inbox.soundscapeLabel}</span>
            </label>
            <label
              className="office-focus-toggle office-soundscape-toggle"
              title={copy.inbox.narrationTitle}
            >
              <input
                type="checkbox"
                checked={Boolean(narration)}
                onChange={() => onToggleNarration?.(!narration)}
              />
              <span>{copy.inbox.narrationLabel}</span>
            </label>
            <button
              type="button"
              className="office-inbox-close"
              aria-label={copy.inbox.closeAria}
              onClick={toggleOpen}
            >
              ×
            </button>
          </div>
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
            </div>
          ) : (
            <>
              <ul className="office-email-list">
                {emails.length === 0 ? (
                  <li className="office-email-empty">{copy.inbox.emptyLine}</li>
                ) : (
                  emails.map((email) => {
                    const sender = officeSenderInfo(email.colleagueId);
                    return (
                      <li key={email.id}>
                        <button
                          type="button"
                          className={`office-email-row${email.read ? '' : ' is-unread'}`}
                          onClick={() => openEmail(email)}
                        >
                          <span
                            className="office-email-avatar"
                            aria-hidden="true"
                            title={sender.title ? `${sender.name} · ${sender.title}` : sender.name}
                          >
                            {sender.avatarEmoji}
                          </span>
                          <span className="office-email-meta">
                            <span className="office-email-sender">
                              {sender.name}
                              {sender.title ? (
                                <span className="office-email-sender-role"> · {sender.title}</span>
                              ) : null}
                            </span>
                            <span className="office-email-subject">{email.subject}</span>
                          </span>
                        </button>
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
                  onClick={onCallMeeting}
                  disabled={!canCallMeeting}
                  title={
                    canCallMeeting
                      ? copy.inbox.callMeetingTitle
                      : copy.inbox.callMeetingDisabledTitle
                  }
                >
                  {copy.inbox.callMeeting}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function OfficeEmailHeader({ email }) {
  const sender = officeSenderInfo(email.colleagueId);
  return (
    <div className="office-email-head">
      <span
        className="office-email-avatar"
        aria-hidden="true"
        style={{ borderColor: sender.accentColor }}
      >
        {sender.avatarEmoji}
      </span>
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
