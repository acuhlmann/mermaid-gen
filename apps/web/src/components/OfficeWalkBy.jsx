import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { useNarrowLayout } from '../hooks/useAppLayoutMedia.js';
import { PersonaFace } from './personaFaces/index.jsx';
import FloatingWindow from './FloatingWindow.jsx';
import OfficeMomentShell from './OfficeMomentShell.jsx';

/**
 * Over-the-shoulder walk-by (docs/office-parody.md): a colleague slides in
 * from the screen edge, says one thing about the actual diagram, and leaves
 * (store TTL). Deliberately NOT AdvisorSpeechBubble — that component is
 * coupled to pin/history/dumb-down mechanics the walk-by doesn't want.
 */
export default function OfficeWalkBy({ walkBy, onDismiss, onAdoptPrompt }) {
  const narrowLayout = useNarrowLayout();
  if (!walkBy) return null;
  const copy = officeChromeCopy();
  const sender = officeSenderInfo(walkBy.colleagueId);
  return (
    <FloatingWindow
      id="office-walkby"
      open={Boolean(walkBy)}
      group="officeChrome"
      className="office-walkby-host"
      kind="walkby"
      senderId={walkBy.colleagueId}
      defaultCorner={narrowLayout ? 'bottom-left' : 'bottom-left'}
      defaultOffsetX={14}
      defaultOffsetY={narrowLayout ? 240 : 130}
      cascade={0}
      role="status"
      aria-live="polite"
    >
      <OfficeMomentShell
        className="office-moment-shell--walkby office-walkby"
        kindClass="office-moment-kind--walkby"
        kindLabel={copy.walkby.kindLabel}
        dragHandleTitle="Drag to move"
        headExtra={
          <button
            type="button"
            className="office-walkby-dismiss office-moment-shell-dismiss"
            aria-label={formatLocale(copy.walkby.dismissAria, { name: sender.name })}
            onClick={() => onDismiss?.(walkBy.id)}
          >
            ×
          </button>
        }
      >
        {copy.walkby.preamble ? (
          <p className="office-walkby-preamble">{copy.walkby.preamble}</p>
        ) : null}
        <div className="office-walkby-row">
          <PersonaFace id={walkBy.colleagueId} size={40} className="office-walkby-avatar" />
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
                {copy.doIt}
              </button>
            ) : null}
          </div>
        </div>
      </OfficeMomentShell>
    </FloatingWindow>
  );
}
