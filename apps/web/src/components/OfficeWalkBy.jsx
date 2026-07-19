import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';

/**
 * Over-the-shoulder walk-by (docs/office-parody.md): a colleague slides in
 * from the screen edge, says one thing about the actual diagram, and leaves
 * (store TTL). Deliberately NOT AdvisorSpeechBubble — that component is
 * coupled to pin/history/dumb-down mechanics the walk-by doesn't want.
 */
export default function OfficeWalkBy({ walkBy, onDismiss, onAdoptPrompt }) {
  if (!walkBy) return null;
  const copy = officeChromeCopy();
  const sender = officeSenderInfo(walkBy.colleagueId);
  return (
    <div className="office-walkby" role="status" aria-live="polite">
      <PersonaFace id={walkBy.colleagueId} size={40} className="office-walkby-avatar" />
      <div className="office-walkby-bubble">
        <button
          type="button"
          className="office-walkby-dismiss"
          aria-label={formatLocale(copy.walkby.dismissAria, { name: sender.name })}
          onClick={() => onDismiss?.(walkBy.id)}
        >
          ×
        </button>
        <div className="office-walkby-name">
          {sender.name}
          {sender.title ? <span className="office-walkby-title"> · {sender.title}</span> : null}
        </div>
        <p className="office-walkby-body">{walkBy.body}</p>
        {walkBy.actionPrompt ? (
          <button
            type="button"
            className="office-do-it"
            onClick={() => onAdoptPrompt?.(walkBy.actionPrompt, walkBy.colleagueId)}
          >
            {copy.doIt}
          </button>
        ) : null}
      </div>
    </div>
  );
}
