import { officeSenderInfo } from '../utils/officeCast.js';

/**
 * Over-the-shoulder walk-by (docs/office-parody.md): a colleague slides in
 * from the screen edge, says one thing about the actual diagram, and leaves
 * (store TTL). Deliberately NOT AdvisorSpeechBubble — that component is
 * coupled to pin/history/dumb-down mechanics the walk-by doesn't want.
 */
export default function OfficeWalkBy({ walkBy, onDismiss, onAdoptPrompt }) {
  if (!walkBy) return null;
  const sender = officeSenderInfo(walkBy.colleagueId);
  return (
    <div className="office-walkby" role="status" aria-live="polite">
      <span
        className="office-walkby-avatar"
        aria-hidden="true"
        style={{ borderColor: sender.accentColor }}
      >
        {sender.avatarEmoji}
      </span>
      <div className="office-walkby-bubble">
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
            Do it
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="office-walkby-dismiss"
        aria-label={`Wave off ${sender.name}`}
        onClick={() => onDismiss?.(walkBy.id)}
      >
        ×
      </button>
    </div>
  );
}
