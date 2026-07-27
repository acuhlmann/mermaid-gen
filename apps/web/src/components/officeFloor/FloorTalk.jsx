/**
 * Talking to somebody where they sit (docs/office-isometric-mode.md § 5 slice 8).
 *
 * **This renders the IM thread**, it does not own a conversation. ADR-0011
 * rule 1: you walking over and saying something is the same `imSomeone` verb
 * Slop Chat™ sends, landing in the same `imHistory`, answered by the same
 * reactive LLM ladder. The window shows it as a thread; the floor shows the
 * newest line as a speech bubble over the person who said it. Two renderers,
 * one state — and afterwards the whole exchange is still in Slop Chat, because
 * it never left.
 *
 * The speaking half reuses `FloorDeskSpeech`, which already lifts a bubble past
 * a seated figure (§ 6 rule 15). The replying half is chrome and therefore
 * belongs in the card slot (§ 6 rule 12), not pinned to a pod of desks.
 */

import FloorDeskSpeech from './FloorDeskSpeech.jsx';
import { PersonaFace } from '../personaFaces/index.jsx';
import { officeImQuickReplies, officeSenderInfo } from '../../utils/officeCast.js';

/**
 * The newest thing they said, over their head.
 *
 * @param {{
 *   talk: {
 *     colleagueId: string,
 *     phase: 'walking' | 'talking',
 *     at?: { x: number, y: number } | null
 *   },
 *   line: string,
 *   scale?: number,
 *   hideBody?: boolean
 * }} props `at` is where they are standing when that is not their own desk
 *   (slice 12) — a bubble over the chair somebody left points at nobody.
 */
export function FloorTalk({ talk, line, scale = 1, hideBody = false }) {
  if (talk.phase !== 'talking' || !line) return null;

  return (
    <FloorDeskSpeech
      castId={talk.colleagueId}
      line={line}
      scale={scale}
      tile={talk.at ?? null}
      testId="office-floor-talk-line"
      hideBody={hideBody}
    />
  );
}

/**
 * What you say back. Quick replies are the canned pure-local flavour Slop Chat
 * already offers under a ping; the composer routes through the identical send
 * path, so a reply typed on the floor and one typed in the window are the same
 * message.
 *
 * @param {{
 *   talk: { colleagueId: string, phase: string },
 *   copy: Record<string, any>,
 *   busy?: boolean,
 *   draft: string,
 *   onDraftChange: (value: string) => void,
 *   onSend: (body: string) => void,
 *   onLeave: () => void
 * }} props `copy` is `officeChromeCopy().floor`.
 */
export function FloorTalkCard({ talk, copy, busy = false, draft, onDraftChange, onSend, onLeave }) {
  const talkCopy = copy.talk;
  const sender = officeSenderInfo(talk.colleagueId);
  const arrived = talk.phase === 'talking';

  const submit = (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    onSend(body);
  };

  /*
   * Not a live region — see `FloorLiveRegion`. This one had a second reason to
   * lose it: the composer below re-renders the card on every keystroke, and a
   * region wrapping a text field is a region that reads itself out as you type.
   */
  return (
    <aside
      className="office-floor-card office-floor-card--talk"
      data-testid="office-floor-talk-card"
    >
      <span className="office-floor-eyebrow">{talkCopy.eyebrow}</span>
      <div className="office-floor-card-head">
        <PersonaFace id={talk.colleagueId} size={44} />
        <div className="office-floor-card-id">
          <strong>{sender?.name ?? talk.colleagueId}</strong>
          <span>{sender?.title ?? ''}</span>
        </div>
      </div>

      {arrived ? null : <p className="office-floor-card-blurb">{talkCopy.walking}</p>}

      {arrived ? (
        <>
          <div className="office-floor-talk-quick">
            {officeImQuickReplies().map((reply) => (
              <button
                key={reply}
                type="button"
                className="office-floor-talk-quick-reply"
                disabled={busy}
                onClick={() => onSend(reply)}
              >
                {reply}
              </button>
            ))}
          </div>
          <form className="office-floor-talk-compose" onSubmit={submit}>
            <input
              type="text"
              className="office-floor-talk-input"
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder={busy ? talkCopy.thinking : talkCopy.placeholder}
              aria-label={talkCopy.placeholder}
              disabled={busy}
            />
            <button
              type="submit"
              className="office-floor-card-action office-floor-card-action--primary"
              disabled={busy || !draft.trim()}
            >
              {talkCopy.send}
            </button>
          </form>
        </>
      ) : null}

      <div className="office-floor-card-actions">
        <button
          type="button"
          className="office-floor-card-action"
          title={talkCopy.leaveTitle}
          onClick={onLeave}
        >
          {talkCopy.leave}
        </button>
      </div>
    </aside>
  );
}

export default FloorTalk;
