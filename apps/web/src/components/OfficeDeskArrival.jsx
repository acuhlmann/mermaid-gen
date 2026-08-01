import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';
import OfficeMomentShell from './OfficeMomentShell.jsx';

/**
 * Brief desk-side arrival toasts for mail and IM (docs/office-parody.md).
 * Like the inbox badge pattern: announce who reached out, not the full body.
 * Unread counts live on the composer Mail / Chat icons once these auto-expire.
 */
export default function OfficeDeskArrival({ arrivals, onDismiss, onOpenEmail, onOpenIm }) {
  const copy = officeChromeCopy();
  const arrivalCopy = copy.arrivals ?? copy.im;
  const hasArrivals = Array.isArray(arrivals) && arrivals.length > 0;
  if (!hasArrivals) return null;

  return (
    <div
      className="office-desk-arrivals"
      role="region"
      aria-label={arrivalCopy.regionAria}
      aria-live="polite"
    >
      {arrivals.map((arrival) => {
        const sender = officeSenderInfo(arrival.colleagueId);
        const isEmail = arrival.kind === 'email';
        const announce = isEmail
          ? formatLocale(arrivalCopy.emailAnnounce, { name: sender.name })
          : formatLocale(arrivalCopy.imAnnounce, { name: sender.name });
        const kindLabel = isEmail ? arrivalCopy.emailKindLabel : arrivalCopy.imKindLabel;
        const kindClass = isEmail ? 'office-moment-kind--email' : 'office-moment-kind--im';
        const openHandler = isEmail ? onOpenEmail : onOpenIm;
        const openLabel = isEmail ? arrivalCopy.openMail : arrivalCopy.openChat;
        return (
          <OfficeMomentShell
            key={arrival.id}
            className={`office-moment-shell--desk-arrival office-desk-arrival-shell${isEmail ? ' is-email' : ' is-im'}`}
            kindClass={kindClass}
            kindLabel={kindLabel}
            headExtra={
              <button
                type="button"
                className="office-desk-arrival-dismiss office-moment-shell-dismiss"
                aria-label={formatLocale(arrivalCopy.dismissAria, { name: sender.name })}
                onClick={() => onDismiss?.(arrival.id)}
              >
                ×
              </button>
            }
          >
            <div className="office-desk-arrival" style={{ borderColor: sender.accentColor }}>
              <PersonaFace
                id={arrival.colleagueId}
                size={26}
                className="office-desk-arrival-avatar"
              />
              <div className="office-desk-arrival-content">
                <span className="office-desk-arrival-sender">
                  {sender.name}
                  {sender.title ? (
                    <span className="office-desk-arrival-title"> · {sender.title}</span>
                  ) : null}
                </span>
                <p className="office-desk-arrival-announce">{announce}</p>
                {isEmail && arrival.subject ? (
                  <p className="office-desk-arrival-subject">{arrival.subject}</p>
                ) : null}
                {typeof openHandler === 'function' ? (
                  <button
                    type="button"
                    className="office-desk-arrival-open"
                    onClick={() => openHandler(arrival)}
                  >
                    {openLabel}
                  </button>
                ) : null}
              </div>
            </div>
          </OfficeMomentShell>
        );
      })}
    </div>
  );
}
