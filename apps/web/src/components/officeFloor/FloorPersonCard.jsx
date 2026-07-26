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
 *   canTalk?: boolean,
 *   onMessage?: (colleagueId: string) => void,
 *   onPeek?: (colleagueId: string) => void,
 *   onTalk?: (colleagueId: string) => void,
 *   onSitDown: () => void,
 *   onClose: () => void
 * }} props `canPeek` is false wherever there is nowhere to stand — leadership
 *   sit behind glass, and Gary has no desk (`peekTileFor`). `canTalk` asks a
 *   different question and gets a different answer: Gary has nowhere to sit but
 *   is perfectly easy to walk up to (`approachTileFor`).
 */
export function FloorPersonCard({
  person,
  copy,
  canMessage,
  canPeek = false,
  canTalk = false,
  onMessage,
  onPeek,
  onTalk,
  onSitDown,
  onClose
}) {
  const isYou = person.tier === 'you';

  /*
   * In offer order, and every one of them gated by a question the room already
   * answered. Walking over comes first because it is the diegetic path; the
   * window sits beside it as the labelled conventional one (binding rule 2).
   */
  const verbs = [
    canTalk && {
      key: 'talk',
      label: copy.talk.action,
      title: copy.talk.actionTitle,
      run: onTalk,
      primary: true
    },
    canMessage && {
      key: 'message',
      label: copy.message,
      title: copy.messageTitle,
      run: onMessage
    },
    canPeek && {
      key: 'peek',
      label: copy.peek.action,
      title: copy.peek.actionTitle,
      run: onPeek
    }
  ].filter(Boolean);

  /*
   * Not a live region — see `FloorLiveRegion`. Selecting somebody is a click
   * with a visible result and an `aria-pressed` button behind it, so the card
   * has less to announce than the others did in the first place.
   */
  return (
    <aside className="office-floor-card">
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
            {verbs.map((verb) => (
              <button
                key={verb.key}
                type="button"
                className={`office-floor-card-action${verb.primary ? ' office-floor-card-action--primary' : ''}`}
                title={verb.title}
                onClick={() => verb.run?.(person.id)}
              >
                {verb.label}
              </button>
            ))}
            {/* Leadership and your own team get a line instead of a verb —
                but only when there is no verb left to offer. */}
            {verbs.length === 0 ? (
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
