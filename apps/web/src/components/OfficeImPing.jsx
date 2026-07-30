import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';
import OfficeMomentShell from './OfficeMomentShell.jsx';

/**
 * Slop Chat™ — brief IM arrival toasts (docs/office-parody.md). Like email,
 * they announce who pinged you, not the full thread. Auto-expire is handled by
 * the store TTL; tap through to Slop Chat for the message body and replies.
 */
export default function OfficeImPing({
  pings,
  imUnreadCount = 0,
  onDismiss,
  onOpenMessage,
  onOpenHistory
}) {
  const copy = officeChromeCopy();
  const imCopy = copy.im;
  const hasPings = Array.isArray(pings) && pings.length > 0;
  const showHistory = imUnreadCount > 0 && typeof onOpenHistory === 'function';
  if (!hasPings && !showHistory) return null;

  return (
    <div
      className="office-im-stack"
      role="region"
      aria-label={imCopy.regionAria}
      aria-live="polite"
    >
      {(pings ?? []).map((ping) => {
        const sender = officeSenderInfo(ping.colleagueId);
        const announce = formatLocale(imCopy.announce, { name: sender.name });
        return (
          <OfficeMomentShell
            key={ping.id}
            className="office-moment-shell--im office-im-ping-shell"
            kindClass="office-moment-kind--im"
            kindLabel={imCopy.kindLabel}
            headExtra={
              <button
                type="button"
                className="office-im-dismiss office-moment-shell-dismiss"
                aria-label={formatLocale(imCopy.dismissAria, { name: sender.name })}
                onClick={() => onDismiss?.(ping.id)}
              >
                ×
              </button>
            }
          >
            <div
              className="office-im-ping office-im-ping--announce"
              style={{ borderColor: sender.accentColor }}
            >
              <PersonaFace id={ping.colleagueId} size={26} className="office-im-avatar" />
              <div className="office-im-content">
                <span className="office-im-sender">
                  {sender.name}
                  {sender.title ? <span className="office-im-title"> · {sender.title}</span> : null}
                </span>
                <p className="office-im-announce">{announce}</p>
                {typeof onOpenMessage === 'function' ? (
                  <button
                    type="button"
                    className="office-im-show-full"
                    onClick={() => onOpenMessage(ping.colleagueId, ping.id)}
                  >
                    {imCopy.showFull}
                  </button>
                ) : null}
              </div>
            </div>
          </OfficeMomentShell>
        );
      })}
      {showHistory ? (
        <button
          type="button"
          className="office-im-history"
          aria-label={formatLocale(imCopy.openHistoryAria, { count: imUnreadCount })}
          title={imCopy.openHistoryTitle}
          onClick={() => onOpenHistory()}
        >
          <span aria-hidden="true">💬</span>
          <span className="office-im-history-badge">
            {imUnreadCount > 9 ? '9+' : imUnreadCount}
          </span>
        </button>
      ) : null}
    </div>
  );
}
