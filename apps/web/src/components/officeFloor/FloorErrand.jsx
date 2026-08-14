/**
 * A soft errand you are carrying (docs/office-isometric-mode.md § 5 slice 26).
 *
 * **The lowest rung in the card slot, and the only durable one.** Every other
 * card is something happening now — a meeting you are in, a conversation you
 * are stood in, an offer that expires when you walk away. This one is a thing
 * you agreed to do and have not done, so it sits exactly where the hint sits:
 * while you carry an errand, "what you are doing on this floor" *is* the
 * errand, and the generic hint is the thing worth replacing.
 *
 * **It is a walk, not a task.** Taking it fires the same `startTalk` the person
 * card's _Go and talk_, a double-click and slice 23's _Join in_ already fire,
 * at a mark derived by the same `talkTileFor` — so an errand adds no verb to
 * the floor and no second way to reach anybody (slice 12's rule). The offer
 * exists only where the room can honour it: `OfficeFloor` withholds the card
 * when the target has no mark, which is the same reason they are not clickable
 * mid-stride.
 *
 * **Dropping it is half the feature.** ADR-0010 consequence #4 rules out office
 * machinery that acts on its own, and the softest version of acting on its own
 * is refusing to go away. There is no timer behind this card, no reminder and
 * no second ask; _Not today_ is the only thing besides speaking to them that
 * ends it, and it is one press with no confirmation.
 *
 * Not a live region — see `FloorLiveRegion`, which announces this card's
 * arrival in the card slot's own position along with everything else.
 */

import { PersonaFace } from '../personaFaces/index.jsx';
import { formatLocale } from '../../i18n/formatLocale.js';
import { officeSenderInfo } from '../../utils/officeCast.js';

/**
 * @param {{
 *   errand: { colleagueId: string, fromId: string },
 *   copy: Record<string, any>,
 *   onTalk?: (colleagueId: string) => void,
 *   onDrop?: () => void
 * }} props `copy` is `officeChromeCopy().floor`.
 */
export function FloorErrandCard({ errand, copy, onTalk, onDrop }) {
  const errandCopy = copy.errand;
  /*
   * Handler *and* copy in the guard, the same check `FloorJoinCard` and
   * `TalkPitch` make: a button that silently does nothing is worse than no
   * offer, and `officeChromeCopy()` swaps whole bundles rather than merging, so
   * a locale that never translated this block gets no card instead of an
   * untitled one.
   */
  if (!errandCopy || typeof onTalk !== 'function') return null;

  const target = officeSenderInfo(errand.colleagueId);
  const asker = officeSenderInfo(errand.fromId);
  const theirName = target?.name ?? errand.colleagueId;

  return (
    <aside
      className="office-floor-card office-floor-card--errand"
      data-testid="office-floor-errand-card"
    >
      <span className="office-floor-eyebrow">{errandCopy.eyebrow}</span>
      <div className="office-floor-card-head">
        <PersonaFace id={errand.colleagueId} size={44} />
        <div className="office-floor-card-id">
          <strong>{theirName}</strong>
          <span>{target?.title ?? ''}</span>
        </div>
      </div>
      <p className="office-floor-card-blurb">
        {formatLocale(errandCopy.body, {
          name: theirName,
          from: asker?.name ?? errand.fromId
        })}
      </p>
      <div className="office-floor-card-actions">
        <button
          type="button"
          className="office-floor-card-action office-floor-card-action--primary"
          title={errandCopy.actionTitle}
          onClick={() => onTalk(errand.colleagueId)}
        >
          {errandCopy.action}
        </button>
        {typeof onDrop === 'function' ? (
          <button
            type="button"
            className="office-floor-card-action"
            title={errandCopy.dropTitle}
            onClick={onDrop}
          >
            {errandCopy.drop}
          </button>
        ) : null}
      </div>
    </aside>
  );
}

export default FloorErrandCard;
