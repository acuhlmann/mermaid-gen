import { useEffect, useState } from 'react';
import {
  meetingContextFromEmails,
  officeChromeCopy,
  officeSenderInfo
} from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';
import OfficeColleaguePicker from './OfficeColleaguePicker.jsx';
import FloatingWindow, { FloatingWindowDragHandle } from './FloatingWindow.jsx';
import {
  FloatingWindowCloseButton,
  FloatingWindowMinimizeButton
} from './FloatingWindowChrome.jsx';

/**
 * The corporate inbox (docs/office-parody.md): an envelope button with an
 * unread badge, opening a popover with the email list, a reading pane, and
 * the "Call a meeting" shortcut. Pure props — OfficeLayer owns the store
 * subscription. Ambience toggles (Focus / Noise / Voice / CC) live on the desk
 * menu, not here — the inbox is mail only.
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
  focusTime = false,
  onMarkRead,
  onMarkAllRead,
  onAdoptPrompt,
  onCallMeeting,
  onComposeEmail,
  composeBusy = false,
  canCallMeeting,
  showTrigger = true
}) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedEmailIds, setSelectedEmailIds] = useState(() => new Set());
  const [composing, setComposing] = useState(false);
  const [composeTo, setComposeTo] = useState(null);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const selected = emails.find((email) => email.id === selectedId) ?? null;
  const copy = officeChromeCopy();
  const selectedCount = selectedEmailIds.size;
  const implicitSingleEmail = emails.length === 1 && selectedCount === 0 ? emails[0] : null;
  const meetingEmailCount = selectedCount > 0 ? selectedCount : implicitSingleEmail ? 1 : 0;
  const canCallFromSelection = canCallMeeting && meetingEmailCount > 0;

  // The desk menu's "Check your mail" verb bumps openSignal; 0 is the initial
  // value, so the inbox never pops open on mount.
  useEffect(() => {
    if (openSignal > 0) {
      setOpen(true);
      setMinimized(false);
    }
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
        setMinimized(false);
        setComposing(false);
        setComposeTo(null);
        setComposeSubject('');
        setComposeBody('');
      }
      return !prev;
    });
  };

  const startCompose = () => {
    setSelectedId(null);
    setSelectedEmailIds(new Set());
    setComposing(true);
    setComposeTo(null);
    setComposeSubject('');
    setComposeBody('');
  };

  const cancelCompose = () => {
    setComposing(false);
    setComposeTo(null);
    setComposeSubject('');
    setComposeBody('');
  };

  const handleComposeSend = async () => {
    if (!composeTo || composeBusy) return;
    const subject = composeSubject.trim();
    const body = composeBody.trim();
    if (!subject && !body) return;
    const sent = await onComposeEmail?.(composeTo, { subject, body });
    if (sent !== false) {
      cancelCompose();
      setOpen(false);
    }
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
      source: 'email',
      modality: 'remote',
      ...meetingContextFromEmails(emailList)
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
          className={`office-inbox-popover${minimized ? ' is-minimized' : ''}`}
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
              <div className="office-inbox-header-actions">
                <FloatingWindowMinimizeButton
                  minimized={minimized}
                  minimizeLabel={copy.windowMinimize}
                  restoreLabel={copy.windowRestore}
                  minimizeTitle={copy.windowMinimizeTitle}
                  restoreTitle={copy.windowRestoreTitle}
                  onToggle={() => setMinimized((prev) => !prev)}
                  className="office-inbox-minimize"
                />
                <FloatingWindowCloseButton
                  label={copy.inbox.closeAria}
                  onClose={toggleOpen}
                  className="office-inbox-close"
                />
              </div>
            </div>
          </FloatingWindowDragHandle>
          {minimized ? null : composing ? (
            <div className="office-email-compose">
              <button type="button" className="office-email-back" onClick={cancelCompose}>
                {copy.inbox.back}
              </button>
              <p className="office-email-compose-heading">{copy.inbox.compose}</p>
              <label className="office-email-compose-field">
                <span>{copy.inbox.composeToLabel}</span>
                {composeTo ? (
                  <div className="office-email-compose-recipient">
                    <PersonaFace id={composeTo} size={24} />
                    <span>{officeSenderInfo(composeTo).name}</span>
                    <button
                      type="button"
                      className="office-email-compose-change"
                      onClick={() => setComposeTo(null)}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <OfficeColleaguePicker
                    selectedId={composeTo}
                    onSelect={setComposeTo}
                    ariaLabel={copy.inbox.composePickSomeone}
                  />
                )}
              </label>
              {composeTo ? (
                <>
                  <label className="office-email-compose-field">
                    <span>{copy.inbox.composeSubjectLabel}</span>
                    <input
                      type="text"
                      value={composeSubject}
                      maxLength={120}
                      placeholder={copy.inbox.composeSubjectPlaceholder}
                      onChange={(event) => setComposeSubject(event.target.value)}
                      disabled={composeBusy}
                    />
                  </label>
                  <label className="office-email-compose-field">
                    <span>{copy.inbox.composeBodyLabel}</span>
                    <textarea
                      value={composeBody}
                      maxLength={800}
                      rows={4}
                      placeholder={copy.inbox.composeBodyPlaceholder}
                      onChange={(event) => setComposeBody(event.target.value)}
                      disabled={composeBusy}
                    />
                  </label>
                  <div className="office-email-compose-actions">
                    <button
                      type="button"
                      className="office-inbox-footer-action"
                      onClick={cancelCompose}
                      disabled={composeBusy}
                    >
                      {copy.inbox.composeCancel}
                    </button>
                    <button
                      type="button"
                      className="office-inbox-footer-action office-email-compose-send"
                      onClick={() => void handleComposeSend()}
                      disabled={
                        composeBusy || !composeTo || (!composeSubject.trim() && !composeBody.trim())
                      }
                    >
                      {composeBusy ? copy.inbox.composeSending : copy.inbox.composeSend}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : selected ? (
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
                <button
                  type="button"
                  className="office-inbox-footer-action"
                  onClick={startCompose}
                  disabled={composeBusy || typeof onComposeEmail !== 'function'}
                  title={copy.inbox.composeTitle}
                >
                  {copy.inbox.compose}
                </button>
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
