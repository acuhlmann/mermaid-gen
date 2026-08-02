import { useSyncExternalStore } from 'react';
import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { getOfficeSnapshot, subscribe } from '../state/officeMomentStore.js';
import { overlayLayerStyle, useOverlayLayer } from '../hooks/useOverlayLayer.js';
import { useSpokenLineVoice } from '../hooks/useSpokenLineVoice.js';
import { PersonaFace } from './personaFaces/index.jsx';

/**
 * Over-the-shoulder walk-by (docs/office-parody.md): a colleague's head drops
 * in from above your screen — like someone actually leaning over your shoulder.
 * You cannot summon them; the ambience director decides when they appear.
 *
 * Voice-first: when narration is speaking and captions are off, hide the
 * speech text (you hear them behind you). Keep dismiss / Do it chrome so the
 * interruption stays actionable. If TTS is muted or fails, the line falls back
 * to text so the interruption is never silent *and* blank.
 *
 * @param {{
 *   walkBy: { id: string, colleagueId: string, body: string, actionPrompt?: string } | null,
 *   onDismiss?: (id: string) => void,
 *   onAdoptPrompt?: (prompt: string, colleagueId: string) => void,
 *   narrateLine?: (line: { speakerId: string, text: string }) =>
 *     Promise<{ spoken?: boolean } | void>
 * }} props
 */
export default function OfficeWalkBy({ walkBy, onDismiss, onAdoptPrompt, narrateLine }) {
  const snapshot = useSyncExternalStore(subscribe, getOfficeSnapshot, getOfficeSnapshot);
  const overlayId = walkBy ? `office-walkby-${walkBy.id}` : 'office-walkby';
  const walkByZIndex = useOverlayLayer(overlayId, Boolean(walkBy), 'officeModal', {
    title: 'Walk-by',
    kind: 'officeWalkBy',
    manageable: false
  });
  const { showSpokenText: showText } = useSpokenLineVoice({
    captions: snapshot.captions,
    narration: snapshot.narration,
    narrateLine,
    speakerId: walkBy?.colleagueId ?? '',
    text: walkBy?.body ?? '',
    lineKey: walkBy?.id ?? null
  });

  if (!walkBy) return null;

  const copy = officeChromeCopy();
  const sender = officeSenderInfo(walkBy.colleagueId);
  // Voice-first: hide the line but keep who it is and the adopt action compact.
  const compactChrome = !showText;

  return (
    <div
      className="office-walkby-overlay"
      style={overlayLayerStyle(walkByZIndex)}
      role="status"
      aria-live="polite"
      data-testid="office-walkby"
      data-floating-window="office-walkby"
    >
      <div className="office-walkby-shade" aria-hidden="true" />
      <div className="office-walkby office-walkby--shoulder">
        <button
          type="button"
          className="office-walkby-dismiss"
          aria-label={formatLocale(copy.walkby.dismissAria, { name: sender.name })}
          onClick={() => onDismiss?.(walkBy.id)}
        >
          ×
        </button>
        <div className="office-walkby-head" aria-hidden="true">
          <PersonaFace id={walkBy.colleagueId} size={168} className="office-walkby-avatar" />
        </div>
        <div className="office-walkby-presence">
          <p className="office-walkby-kind" aria-hidden="true">
            {copy.walkby.kindLabel}
          </p>
          <div
            className={`office-walkby-meta${compactChrome ? ' office-walkby-meta--inline' : ''}`}
          >
            <div className="office-walkby-name">
              {sender.name}
              {sender.title ? <span className="office-walkby-title"> · {sender.title}</span> : null}
            </div>
            {walkBy.actionPrompt && compactChrome ? (
              <button
                type="button"
                className="office-do-it"
                onClick={() => onAdoptPrompt?.(walkBy.actionPrompt, walkBy.colleagueId)}
              >
                {copy.doIt}
              </button>
            ) : null}
          </div>
          {showText && copy.walkby.preamble ? (
            <p className="office-walkby-preamble">{copy.walkby.preamble}</p>
          ) : null}
          {showText ? <p className="office-walkby-body">{walkBy.body}</p> : null}
          {walkBy.actionPrompt && !compactChrome ? (
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
    </div>
  );
}
