/**
 * Talking to somebody where they sit (docs/office-isometric-mode.md § 5 slice 8).
 *
 * **This renders conversation at their desk**, it does not own it. ADR-0011
 * rule 1: walking over and typing is the same `imSomeone` verb Slop Chat™
 * sends (typed IM stays in the messenger afterwards). Say-it-out-loud
 * (`channel: 'talk'`) shares `imHistory` so the newest line can lift as a
 * bubble here too, but that physical speech stays out of Slop Chat.
 *
 * The speaking half reuses `FloorDeskSpeech`, which already lifts a bubble past
 * a seated figure (§ 6 rule 15). The replying half is chrome and therefore
 * belongs in the card slot (§ 6 rule 12), not pinned to a pod of desks.
 *
 * Composer parity with other voice surfaces: typed prompt **and** mic
 * (`VoiceMicButton`). No thread strip — you are standing in front of them.
 */

import FloorDeskSpeech from './FloorDeskSpeech.jsx';
import { PersonaFace } from '../personaFaces/index.jsx';
import VoiceMicButton from '../VoiceMicButton.jsx';
import { officeChromeCopy, officeSenderInfo } from '../../utils/officeCast.js';

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
 * Their suggestion, with the trigger you pull (ADR-0012).
 *
 * Its own component so the guard lives out of `FloorTalkCard`'s body — the card
 * was under the complexity threshold and § 8's finding is that these small
 * boolean guards are exactly what pushes floor modules over it. The guard is
 * deliberately the *same shape* as `FloorTalk`'s above: a pitch and a bubble are
 * two halves of one arrival, so neither shows until you are actually stood
 * there. On the walk over, "the last thing they said" is still whatever they
 * said in Slop Chat last week, and offering to act on that would adopt a line
 * you have not heard.
 *
 * @param {{
 *   talk: { colleagueId: string, phase: string },
 *   pitch?: string | null,
 *   onAdopt?: (prompt: string, colleagueId: string) => void
 * }} props
 */
function TalkPitch({ talk, pitch, onAdopt }) {
  // The handler is part of the guard, not an optional call: a Do-it that renders
  // without one is a button that silently does nothing, which is worse than no
  // offer at all. `OfficeDeskSpeech` — the desk renderer of this same channel —
  // checks it the same way.
  if (talk.phase !== 'talking' || !pitch || typeof onAdopt !== 'function') return null;

  return (
    <button
      type="button"
      className="office-floor-card-action office-floor-card-action--adopt"
      data-testid="office-floor-talk-adopt"
      onClick={() => onAdopt(pitch, talk.colleagueId)}
    >
      {officeChromeCopy().doIt}
    </button>
  );
}

/**
 * What you say back. The composer is the whole surface: typed prompt and mic
 * (`VoiceMicButton`, same as Slop Chat / floor meetings). No opener chips —
 * they ate the card and you still speak first by typing or holding the mic.
 *
 * **The Do-it lives here rather than on the bubble**, which is the one place
 * this surface departs from the walk-by. Two reasons, and the second is the
 * load-bearing one:
 *
 * 1. § 6 rule 12 — the replying half is chrome and belongs in the card slot. A
 *    pitch is an action, not speech. (A walk-by puts its Do-it in the bubble
 *    because a walk-by has no card, not because the bubble is the right home.)
 * 2. `FloorDeskSpeech` returns `null` outright when `hideBody` is set, and the
 *    bubble is rendered with `hideBody={!showSpokenText}`. A Do-it on the bubble
 *    would therefore **disappear whenever captions are off** — the offer would
 *    come and go with a display preference that has nothing to do with it. The
 *    card is unconditional for as long as you are stood there.
 *
 * ADR-0010/0012: adopting runs *your* pipeline on their suggestion, attributed
 * to them. The remark itself never touched a slot.
 *
 * @param {{
 *   talk: { colleagueId: string, phase: string },
 *   copy: Record<string, any>,
 *   busy?: boolean,
 *   draft: string,
 *   onDraftChange: (value: string) => void,
 *   onSend: (body: string) => void,
 *   pitch?: string | null,
 *   onAdopt?: (prompt: string, colleagueId: string) => void,
 *   onLeave: () => void
 * }} props `copy` is `officeChromeCopy().floor`.
 */
export function FloorTalkCard({
  talk,
  copy,
  busy = false,
  draft,
  onDraftChange,
  onSend,
  /** No `= null`: truthiness-tested in `TalkPitch`, and § 8's rule is that a
      default parameter costs a complexity point apiece. */
  pitch,
  onAdopt,
  onLeave
}) {
  const talkCopy = copy.talk;
  const sender = officeSenderInfo(talk.colleagueId);
  const arrived = talk.phase === 'talking';
  const theirName = sender?.name ?? talk.colleagueId;

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
          <strong>{theirName}</strong>
          <span>{sender?.title ?? ''}</span>
        </div>
      </div>

      {arrived ? null : <p className="office-floor-card-blurb">{talkCopy.walking}</p>}

      {arrived ? (
        <form className="office-floor-talk-compose" onSubmit={submit}>
          <input
            type="text"
            className="office-floor-talk-input"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={busy ? talkCopy.thinking : talkCopy.placeholder}
            aria-label={talkCopy.placeholder}
            disabled={busy}
            autoFocus
            maxLength={300}
            enterKeyHint="send"
          />
          <VoiceMicButton
            value={draft}
            onChange={onDraftChange}
            disabled={busy}
            className="office-floor-talk-mic overlay-button is-mic-toggle"
          />
          <button
            type="submit"
            className="office-floor-card-action office-floor-card-action--primary"
            disabled={busy || !draft.trim()}
          >
            {talkCopy.send}
          </button>
        </form>
      ) : null}

      <div className="office-floor-card-actions">
        <TalkPitch talk={talk} pitch={pitch} onAdopt={onAdopt} />
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
