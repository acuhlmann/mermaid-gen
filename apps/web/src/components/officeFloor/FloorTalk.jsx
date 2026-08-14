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
import { formatLocale } from '../../i18n/formatLocale.js';
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

/**
 * The way into a conversation you are only near
 * (docs/office-isometric-mode.md § 5 slice 23).
 *
 * **It lives in this file because joining is the talk verb.** Slice 22 built
 * the half nobody had — two colleagues talking to each other with you placed to
 * hear it — and left "and then what" open. The answer turned out to need no new
 * verb at all: pressing this fires the same `startTalk` the person card's _Go
 * and talk_ and a double-click already fire, at a mark derived the same way. So
 * the offer sits next to the card it opens rather than in a module of its own,
 * and if the two ever disagree about what talking *is*, they are ten lines
 * apart.
 *
 * **It is a walk, not a reply**, which is the clause that keeps slice 22 legal
 * (ADR-0010, `office-parody.md` § 11). Nothing here answers the line you
 * overheard — there is no quote, no Do-it, no thread, no unread count, and the
 * exchange is not addressed to you before or after. Taking it walks you over
 * and hands you a composer, and you still speak first, exactly as you would
 * walking up to anybody (slice 8's deliberate silence). The exchange itself
 * ends as you accept, for free: `standingFree` goes false the instant you have
 * a reason to be somewhere, and `useFloorShopTalk` clears on it.
 *
 * In the card slot rather than on the balloon, for the reason `FloorTalkCard`
 * records about its own Do-it: `FloorDeskSpeech` returns `null` under
 * `hideBody`, so an offer hung on the bubble would come and go with a captions
 * preference that has nothing to do with it.
 *
 * @param {{
 *   join: { colleagueId: string, partnerId: string, kind: string },
 *   copy: Record<string, any>,
 *   onJoin?: (colleagueId: string) => void
 * }} props `copy` is `officeChromeCopy().floor`.
 */
export function FloorJoinCard({ join, copy, onJoin }) {
  const joinCopy = copy.join;
  /*
   * The handler is part of the guard, and the copy is too — the same check
   * `TalkPitch` makes, for the same reason (a button that silently does nothing
   * is worse than no offer), plus `officeChromeCopy()`'s: a locale that never
   * translated this block has no card rather than an untitled one.
   */
  if (!joinCopy || typeof onJoin !== 'function') return null;

  const speaker = officeSenderInfo(join.colleagueId);
  const partner = officeSenderInfo(join.partnerId);
  const theirName = speaker?.name ?? join.colleagueId;

  return (
    <aside
      className="office-floor-card office-floor-card--join"
      data-testid="office-floor-join-card"
    >
      <span className="office-floor-eyebrow">{joinCopy.eyebrow}</span>
      <div className="office-floor-card-head">
        <PersonaFace id={join.colleagueId} size={44} />
        <div className="office-floor-card-id">
          <strong>{theirName}</strong>
          <span>{speaker?.title ?? ''}</span>
        </div>
      </div>
      <p className="office-floor-card-blurb">
        {formatLocale(joinCopy.body, {
          name: theirName,
          partner: partner?.name ?? join.partnerId,
          // The same lookup the narration and the interrupt bank use; it
          // already carries its article.
          prop: copy.props?.items?.[join.kind]?.name ?? ''
        })}
      </p>
      <div className="office-floor-card-actions">
        <button
          type="button"
          className="office-floor-card-action office-floor-card-action--primary"
          title={joinCopy.actionTitle}
          onClick={() => onJoin(join.colleagueId)}
        >
          {joinCopy.action}
        </button>
      </div>
    </aside>
  );
}

/**
 * The way into a coffee break you turned down (§ 5 slice 28).
 *
 * **A separate card from `FloorJoinCard` above, on purpose.** They are the same
 * shape and a different verb, and folding them together would have cost more
 * than it saved: that one opens a composer and leaves two people talking, this
 * one *ends* a performance. Sharing a component would mean a `kind` branch
 * through the body, the action and the handler — and the two would then share
 * a copy block, so a translator changing "join in" for shop talk would silently
 * reword the offer to walk into somebody's coffee break.
 *
 * It names the colleague who asked you in the first place, so the card reads as
 * a second chance at a specific invitation rather than as a generic offer. No
 * `{prop}`: the kitchen is where the break is and the copy can say so plainly,
 * unlike shop talk where the prop picks the voice.
 *
 * Same two-part guard as every other rung — handler *and* copy — because
 * `officeChromeCopy()` swaps whole bundles, so a locale that never translated
 * this block must render no card rather than an untitled one.
 *
 * @param {{
 *   sceneJoin: { colleagueId: string, participants: string[], kind: string },
 *   copy: Record<string, any>,
 *   onJoinScene?: (colleagueId: string) => void
 * }} props `copy` is `officeChromeCopy().floor`.
 */
export function FloorSceneJoinCard({ sceneJoin, copy, onJoinScene }) {
  const joinCopy = copy.sceneJoin;
  if (!joinCopy || typeof onJoinScene !== 'function') return null;

  const speaker = officeSenderInfo(sceneJoin.colleagueId);
  const theirName = speaker?.name ?? sceneJoin.colleagueId;

  return (
    <aside
      className="office-floor-card office-floor-card--join"
      data-testid="office-floor-scene-join-card"
    >
      <span className="office-floor-eyebrow">{joinCopy.eyebrow}</span>
      <div className="office-floor-card-head">
        <PersonaFace id={sceneJoin.colleagueId} size={44} />
        <div className="office-floor-card-id">
          <strong>{theirName}</strong>
          <span>{speaker?.title ?? ''}</span>
        </div>
      </div>
      <p className="office-floor-card-blurb">{formatLocale(joinCopy.body, { name: theirName })}</p>
      <div className="office-floor-card-actions">
        <button
          type="button"
          className="office-floor-card-action office-floor-card-action--primary"
          title={joinCopy.actionTitle}
          onClick={() => onJoinScene(sceneJoin.colleagueId)}
        >
          {joinCopy.action}
        </button>
      </div>
    </aside>
  );
}

export default FloorTalk;
