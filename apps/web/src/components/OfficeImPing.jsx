import { officeChromeCopy, officeImQuickReplies, officeSenderInfo } from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';

/**
 * Slop Chat™ — stacked IM ping bubbles (docs/office-parody.md). Auto-expire is
 * handled by the store TTL; quick replies are pure local flavor (plus a tiny
 * XP nudge through onQuickReply).
 *
 * Toasts are notifications, not the archive: once any IM has ever arrived this
 * also renders the chat tab that opens OfficeMessenger, so an expired ping is
 * still reachable. That tab is why the component no longer bails out when the
 * ping stack is empty.
 */
export default function OfficeImPing({
  pings,
  unreadCount = 0,
  historyCount = 0,
  onDismiss,
  onQuickReply,
  onOpenHistory
}) {
  const copy = officeChromeCopy();
  const quickReplies = officeImQuickReplies();
  const hasPings = Array.isArray(pings) && pings.length > 0;
  if (!hasPings && historyCount === 0) return null;
  return (
    <div
      className="office-im-stack"
      role="region"
      aria-label={copy.im.regionAria}
      aria-live="polite"
    >
      {historyCount > 0 ? (
        <button
          type="button"
          className={`office-im-history${unreadCount > 0 ? ' has-unread' : ''}`}
          aria-label={formatLocale(copy.im.openHistoryAria, { count: unreadCount })}
          title={copy.im.openHistoryTitle}
          onClick={() => onOpenHistory?.()}
        >
          <span aria-hidden="true">💬</span>
          {unreadCount > 0 ? (
            <span className="office-im-history-badge" aria-hidden="true">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </button>
      ) : null}
      {(pings ?? []).map((ping) => {
        const sender = officeSenderInfo(ping.colleagueId);
        return (
          <div key={ping.id} className="office-im-ping" style={{ borderColor: sender.accentColor }}>
            <PersonaFace id={ping.colleagueId} size={26} className="office-im-avatar" />
            <div className="office-im-content">
              <span className="office-im-sender">
                {sender.name}
                {sender.title ? <span className="office-im-title"> · {sender.title}</span> : null}
              </span>
              <p className="office-im-body">{ping.body}</p>
              <div className="office-im-replies">
                {quickReplies.map((reply) => (
                  <button
                    key={reply}
                    type="button"
                    className="office-im-reply"
                    onClick={() => onQuickReply?.(ping, reply)}
                  >
                    {reply}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="office-im-dismiss"
              aria-label={formatLocale(copy.im.dismissAria, { name: sender.name })}
              onClick={() => onDismiss?.(ping.id)}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
