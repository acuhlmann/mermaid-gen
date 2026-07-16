import { OFFICE_IM_QUICK_REPLIES, officeSenderInfo } from '../utils/officeCast.js';

/**
 * Slop Chat™ — stacked IM ping bubbles (docs/office-parody.md). Auto-expire is
 * handled by the store TTL; quick replies are pure local flavor (plus a tiny
 * XP nudge through onQuickReply).
 */
export default function OfficeImPing({ pings, onDismiss, onQuickReply }) {
  if (!pings || pings.length === 0) return null;
  return (
    <div className="office-im-stack" role="region" aria-label="Instant messages" aria-live="polite">
      {pings.map((ping) => {
        const sender = officeSenderInfo(ping.colleagueId);
        return (
          <div key={ping.id} className="office-im-ping" style={{ borderColor: sender.accentColor }}>
            <span className="office-im-avatar" aria-hidden="true">
              {sender.avatarEmoji}
            </span>
            <div className="office-im-content">
              <span className="office-im-sender">{sender.name}</span>
              <p className="office-im-body">{ping.body}</p>
              <div className="office-im-replies">
                {OFFICE_IM_QUICK_REPLIES.map((reply) => (
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
              aria-label={`Dismiss message from ${sender.name}`}
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
