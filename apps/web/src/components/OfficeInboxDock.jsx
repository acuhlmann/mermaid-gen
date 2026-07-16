import { useState } from 'react';
import { officeSenderInfo } from '../utils/officeCast.js';

/**
 * The corporate inbox (docs/office-parody.md): an envelope button with an
 * unread badge, opening a popover with the email list, a reading pane,
 * the Focus Time (office DND) toggle, and the "Call a meeting" shortcut.
 * Pure props — OfficeLayer owns the store subscription.
 */
export default function OfficeInboxDock({
  emails,
  unreadCount,
  focusTime,
  onToggleFocusTime,
  onMarkRead,
  onMarkAllRead,
  onAdoptPrompt,
  onCallMeeting,
  canCallMeeting
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const selected = emails.find((email) => email.id === selectedId) ?? null;

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
          unreadCount > 0 ? `Inbox — ${unreadCount} unread emails` : 'Inbox — no unread email'
        }
        aria-expanded={open}
        title="Corporate inbox"
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
        <div className="office-inbox-popover" role="dialog" aria-label="Corporate inbox">
          <div className="office-inbox-header">
            <span className="office-inbox-title">📥 Inbox</span>
            <label className="office-focus-toggle" title="Colleagues (mostly) respect Focus Time">
              <input
                type="checkbox"
                checked={focusTime}
                onChange={() => onToggleFocusTime?.(!focusTime)}
              />
              <span>Focus Time</span>
            </label>
            <button
              type="button"
              className="office-inbox-close"
              aria-label="Close inbox"
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
                ← Back
              </button>
              <OfficeEmailHeader email={selected} />
              <p className="office-email-body">{selected.body}</p>
              {selected.actionPrompt ? (
                <button
                  type="button"
                  className="office-do-it"
                  onClick={() => onAdoptPrompt?.(selected.actionPrompt, selected.colleagueId)}
                >
                  Do it
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <ul className="office-email-list">
                {emails.length === 0 ? (
                  <li className="office-email-empty">
                    Inbox zero. HR finds this suspicious. Enjoy it while it lasts.
                  </li>
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
                          <span className="office-email-avatar" aria-hidden="true">
                            {sender.avatarEmoji}
                          </span>
                          <span className="office-email-meta">
                            <span className="office-email-sender">{sender.name}</span>
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
                    Mark all read
                  </button>
                ) : null}
                <button
                  type="button"
                  className="office-inbox-footer-action office-call-meeting"
                  onClick={onCallMeeting}
                  disabled={!canCallMeeting}
                  title={
                    canCallMeeting
                      ? 'Summon a working-group meeting about the current diagram'
                      : 'Draw something first — even this meeting needs an agenda'
                  }
                >
                  📅 Call a meeting
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
