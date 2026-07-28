import { useEffect, useMemo, useRef, useState } from 'react';
import { officeChromeCopy, officeImQuickReplies, officeSenderInfo } from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { groupImThreads } from '../utils/officeImThreads.js';
import { PersonaFace } from './personaFaces/index.jsx';
import FloatingWindow, { FloatingWindowDragHandle } from './FloatingWindow.jsx';
import {
  FloatingWindowCloseButton,
  FloatingWindowMinimizeButton
} from './FloatingWindowChrome.jsx';

function MessengerThreadList({ threads, activeId, label, unreadLabel, onSelect }) {
  return (
    <ul className="office-messenger-threads" aria-label={label}>
      {threads.map((thread) => {
        const sender = officeSenderInfo(thread.colleagueId);
        const isActive = thread.colleagueId === activeId;
        return (
          <li key={thread.colleagueId}>
            <button
              type="button"
              className={`office-messenger-thread${isActive ? ' is-active' : ''}`}
              aria-current={isActive}
              // The name is visually hidden in the mobile avatar strip, so it
              // has to live on the control itself.
              aria-label={sender.name}
              title={sender.title ? `${sender.name} · ${sender.title}` : sender.name}
              onClick={() => onSelect(thread.colleagueId)}
            >
              <PersonaFace id={thread.colleagueId} size={26} />
              <span className="office-messenger-thread-meta">
                <span className="office-messenger-thread-name">{sender.name}</span>
                <span className="office-messenger-thread-snippet">{thread.last.body}</span>
              </span>
              {thread.unread > 0 ? (
                <span className="office-messenger-unread" title={unreadLabel}>
                  {thread.unread > 9 ? '9+' : thread.unread}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function MessengerLog({ thread, chat, busy, typingName, scrollRef }) {
  return (
    <div className="office-messenger-log" ref={scrollRef}>
      {thread ? (
        thread.messages.map((msg) => {
          const sender = officeSenderInfo(msg.colleagueId);
          return (
            <div
              key={msg.id}
              className={`office-messenger-msg${msg.outbound ? ' is-outbound' : ''}`}
            >
              {msg.outbound ? null : (
                <PersonaFace id={msg.colleagueId} size={22} fallbackEmoji={sender.avatarEmoji} />
              )}
              <div className="office-messenger-bubble">
                <span className="office-messenger-msg-name">
                  {msg.outbound ? chat.you : sender.name}
                </span>
                <p className="office-messenger-msg-body">{msg.body}</p>
              </div>
            </div>
          );
        })
      ) : (
        <p className="office-messenger-empty">{chat.emptyThread}</p>
      )}
      {busy && typingName ? (
        <div className="office-messenger-typing" role="status">
          {formatLocale(chat.typing, { name: typingName })}
        </div>
      ) : null}
    </div>
  );
}

function MessengerComposer({ chat, disabled, busy, targetName, onSend }) {
  const [draft, setDraft] = useState('');
  const quickReplies = officeImQuickReplies();

  const submit = (text) => {
    const body = String(text ?? '').trim();
    if (!body || disabled) return;
    setDraft('');
    onSend(body);
  };

  return (
    <>
      <div className="office-messenger-quick">
        {quickReplies.map((reply) => (
          <button
            key={reply}
            type="button"
            className="office-messenger-quick-reply"
            disabled={disabled}
            onClick={() => submit(reply)}
          >
            {reply}
          </button>
        ))}
      </div>
      <form
        className="office-messenger-composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit(draft);
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={chat.composerPlaceholder}
          aria-label={
            targetName
              ? formatLocale(chat.composerAria, { name: targetName })
              : chat.composerPlaceholder
          }
          maxLength={300}
          disabled={disabled}
        />
        <button type="submit" disabled={disabled || !draft.trim()}>
          {busy ? chat.sending : chat.send}
        </button>
      </form>
    </>
  );
}

/**
 * Slop Chat™ — the messenger window (docs/office-parody.md).
 *
 * OfficeImPing is a *notification*: two toasts, nine seconds, then gone. This
 * is the durable other half — `imHistory` in officeMomentStore keeps every IM
 * so the user can scroll back through a thread they missed, and reply into it.
 *
 * Non-modal by design (same reasoning as the docked meeting): you read chat
 * *while* working, so this never blocks the canvas. Pure props — OfficeLayer
 * owns the store subscription and the send plumbing.
 */
export default function OfficeMessenger({
  open,
  messages,
  onClose,
  onMarkRead,
  onSend,
  onMessageSomeone,
  onCallMeeting,
  canCallMeeting = false,
  busy = false
}) {
  const chat = officeChromeCopy().messenger;
  const chrome = officeChromeCopy();
  const [selectedId, setSelectedId] = useState(null);
  const [minimized, setMinimized] = useState(false);
  const scrollRef = useRef(null);

  const threads = useMemo(() => groupImThreads(messages), [messages]);

  // Default to the most recently active thread, and follow new arrivals until
  // the user deliberately picks another conversation.
  const activeId = selectedId ?? threads[0]?.colleagueId ?? null;
  const active = threads.find((t) => t.colleagueId === activeId) ?? null;
  const activeName = activeId ? officeSenderInfo(activeId).name : null;

  useEffect(() => {
    if (!open || !activeId) return;
    onMarkRead?.(activeId);
  }, [open, activeId, active?.messages.length, onMarkRead]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active?.messages.length, activeId, busy]);

  useEffect(() => {
    if (!open) {
      setMinimized(false);
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <FloatingWindow
      id="office-messenger"
      open={open}
      group="officeModal"
      className={`office-messenger${minimized ? ' is-minimized' : ''}`}
      kind="messenger"
      senderId={activeId}
      defaultCorner="center"
      defaultOffsetX={0}
      defaultOffsetY={0}
      cascade={1}
      role="dialog"
      aria-label={chat.title}
      aria-modal="false"
    >
      <FloatingWindowDragHandle className="office-messenger-titlebar" title={chat.dragHint}>
        <span className="office-messenger-title">{chat.title}</span>
        <span className="office-messenger-tagline">{chat.tagline}</span>
        {typeof onCallMeeting === 'function' ? (
          <button
            type="button"
            className="office-messenger-call-meeting"
            disabled={!canCallMeeting}
            title={
              !canCallMeeting
                ? chat.callMeetingDisabledTitle
                : activeId
                  ? chat.callMeetingTitle
                  : chat.callMeetingNoThreadTitle
            }
            onClick={() =>
              onCallMeeting?.({
                seedAttendees: activeId ? [activeId] : [],
                source: 'chat',
                forceFacilitator: Boolean(activeId)
              })
            }
          >
            {activeId ? chat.callMeeting : chat.callMeetingNoThread}
          </button>
        ) : null}
        <div className="office-messenger-titlebar-actions">
          <FloatingWindowMinimizeButton
            minimized={minimized}
            minimizeLabel={chrome.windowMinimize}
            restoreLabel={chrome.windowRestore}
            minimizeTitle={chrome.windowMinimizeTitle}
            restoreTitle={chrome.windowRestoreTitle}
            onToggle={() => setMinimized((prev) => !prev)}
            className="office-messenger-minimize"
          />
          <FloatingWindowCloseButton
            label={chat.closeAria}
            onClose={onClose}
            className="office-messenger-close"
          />
        </div>
      </FloatingWindowDragHandle>

      {minimized ? null : (
        <>
          {threads.length === 0 ? (
            <div className="office-messenger-empty-panel">
              <p className="office-messenger-empty">{chat.emptyThreads}</p>
              {typeof onMessageSomeone === 'function' ? (
                <button
                  type="button"
                  className="office-messenger-message-someone"
                  disabled={busy}
                  title={chat.messageSomeoneTitle}
                  onClick={() => onMessageSomeone()}
                >
                  {chat.messageSomeone}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="office-messenger-body">
              <MessengerThreadList
                threads={threads}
                activeId={activeId}
                label={chat.threadsAria}
                unreadLabel={chat.unreadDot}
                onSelect={setSelectedId}
              />
              <div className="office-messenger-thread-view">
                <MessengerLog
                  thread={active}
                  chat={chat}
                  busy={busy}
                  typingName={activeName}
                  scrollRef={scrollRef}
                />
                <MessengerComposer
                  chat={chat}
                  busy={busy}
                  disabled={busy || !activeId}
                  targetName={activeName}
                  onSend={(body) => onSend?.(activeId, body)}
                />
              </div>
            </div>
          )}
        </>
      )}
    </FloatingWindow>
  );
}
