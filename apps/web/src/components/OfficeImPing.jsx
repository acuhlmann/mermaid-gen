import { officeChromeCopy, officeImQuickReplies, officeSenderInfo } from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';

/**
 * Slop Chat™ — stacked IM ping bubbles (docs/office-parody.md). Auto-expire is
 * handled by the store TTL; quick replies are pure local flavor (plus a tiny
 * XP nudge through onQuickReply).
 */
export default function OfficeImPing({ pings, onDismiss, onQuickReply }) {
  if (!pings || pings.length === 0) return null;
  const copy = officeChromeCopy();
  const quickReplies = officeImQuickReplies();
  return (
    <div
      className="office-im-stack"
      role="region"
      aria-label={copy.im.regionAria}
      aria-live="polite"
    >
      {pings.map((ping) => {
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
