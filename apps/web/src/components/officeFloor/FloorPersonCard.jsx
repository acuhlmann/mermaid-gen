/**
 * Who you just walked up to. Actions follow the one-producer model
 * (ADR-0010): the floor offers conversation, never work — Slop Chat™ for the
 * office tier, a look over their shoulder at fiction they are not producing,
 * an in-fiction brush-off for leadership, and "sit down" at your own desk.
 */

import { PersonaFace } from '../personaFaces/index.jsx';

/**
 * @param {{
 *   person: { id: string, name: string, title: string, blurb: string, tier: string | null },
 *   copy: Record<string, any>,
 *   canMessage: boolean,
 *   canPeek?: boolean,
 *   onMessage?: (colleagueId: string) => void,
 *   onPeek?: (colleagueId: string) => void,
 *   onSitDown: () => void,
 *   onClose: () => void
 * }} props `canPeek` is false wherever there is nowhere to stand — leadership
 *   sit behind glass, and Gary has no desk (`peekTileFor`).
 */
export function FloorPersonCard({
  person,
  copy,
  canMessage,
  canPeek = false,
  onMessage,
  onPeek,
  onSitDown,
  onClose
}) {
  const isYou = person.tier === 'you';

  return (
    <aside className="office-floor-card" aria-live="polite">
      <button
        type="button"
        className="office-floor-card-close"
        onClick={onClose}
        aria-label={copy.close}
        title={copy.close}
      >
        ✕
      </button>
      <div className="office-floor-card-head">
        <PersonaFace id={person.id} size={44} fallbackEmoji={isYou ? '🙋' : undefined} />
        <div className="office-floor-card-id">
          <strong>{person.name}</strong>
          <span>{person.title}</span>
        </div>
      </div>
      {person.blurb ? <p className="office-floor-card-blurb">{person.blurb}</p> : null}
      <div className="office-floor-card-actions">
        {isYou ? (
          <button type="button" className="office-floor-card-action" onClick={onSitDown}>
            {copy.sitHere}
          </button>
        ) : (
          <>
            {canMessage ? (
              <button
                type="button"
                className="office-floor-card-action"
                title={copy.messageTitle}
                onClick={() => onMessage?.(person.id)}
              >
                {copy.message}
              </button>
            ) : null}
            {canPeek ? (
              <button
                type="button"
                className="office-floor-card-action"
                title={copy.peek.actionTitle}
                onClick={() => onPeek?.(person.id)}
              >
                {copy.peek.action}
              </button>
            ) : null}
            {/* Leadership and your own team get a line instead of a verb —
                but only when there is no verb left to offer. */}
            {!canMessage && !canPeek ? (
              <span className="office-floor-card-note">
                {person.tier === 'senior' ? copy.seniorNote : copy.teamNote}
              </span>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}

export default FloorPersonCard;
