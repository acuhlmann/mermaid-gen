/**
 * The furniture, and the four bits of it you can use
 * (docs/office-isometric-mode.md § 5 slice 9).
 *
 * Extracted from `FloorStage` when props stopped being scenery: the stage was
 * already mapping `FLOOR_PROPS` inline, and "which of these answers to a click"
 * is a second concern that would have doubled the JSX in a component whose job
 * is *put the office on the stage*.
 *
 * A usable prop is a real `<button>` wrapped round the same SVG art. That is
 * ADR-0011's DOM bet being cashed rather than a stylistic choice — the hit
 * target, the focus ring, the accessible name and the keyboard route all come
 * from the element, so the coffee machine is reachable by tab on a floor whose
 * click surface (`FloorRoam`) is deliberately pointer-only. Scenery stays an
 * `aria-hidden` SVG with `pointer-events: none`, so clicks on it fall through
 * to the roam surface and walk you there instead, exactly as before.
 *
 * Which props are usable is not decided here: `usablePropKinds()` asks the room
 * (§ 7's derived-not-authored habit), and a prop the room cannot give you a
 * mark for never renders a button at all — no dead click, no disabled control
 * explaining itself. That is how the water cooler quietly went back to being
 * scenery (§ 6 rule 21).
 */

import { useState } from 'react';
import { FloorPropArt } from './isoArt.jsx';
import { formatLocale } from '../../i18n/formatLocale.js';
import {
  FLOOR_PROPS,
  PROP_VIEW,
  PROP_VIEW_BOX,
  depthOf,
  projectIso
} from '../../utils/officeFloorPlan.js';
import { usablePropKinds } from '../../utils/officeFloorMovement.js';
import { boardNotesFor } from '../../utils/officeFloorNotes.js';
import { getOfficeLogSnapshot } from '../../state/officeLogStore.js';

/**
 * What the room has written on its own whiteboard, right now (§ 6a).
 *
 * **Sampled, never subscribed.** `boardNotesFor` is pure and both surfaces that
 * show the board — the panel and the **Look closer** card — call this one
 * composer with the same inputs, which is the `floorActivityFor` habit
 * (ADR-0011): six components may *call* a composer, none may be a second one.
 * They are rendered in the same commit under `OfficeFloor`, so they cannot
 * disagree; and because nothing here subscribes to the log, the board changes
 * only when the floor re-renders for some other reason — which is the right
 * fiction as well as the right cost. A board that re-inked itself the instant
 * somebody printed a page would be a dashboard.
 *
 * @param {Record<string, any>} copy `officeChromeCopy().floor`
 * @param {import('../../utils/officeFloorBoard.js').BoardState | null} board
 * @returns {import('../../utils/officeFloorNotes.js').BoardNote[]}
 */
function boardNotes(copy, board) {
  return boardNotesFor({
    officeLog: getOfficeLogSnapshot(),
    board,
    copy: copy.props?.items?.whiteboard?.notes ?? null
  });
}

/**
 * One prop's art, positioned on its tile. Shared by both branches so a usable
 * prop and a scenic one are the same object drawn the same way.
 */
function propArt(prop, board, notes) {
  return (
    <svg
      className="office-floor-prop-art"
      viewBox={PROP_VIEW_BOX}
      width={PROP_VIEW.w}
      height={PROP_VIEW.h}
      aria-hidden="true"
      focusable="false"
    >
      <FloorPropArt
        kind={prop.kind}
        span={prop.span}
        axis={prop.axis}
        board={board}
        notes={notes}
      />
    </svg>
  );
}

function propStyle(prop) {
  const { left, top } = projectIso(prop.x, prop.y);
  return {
    left: left + PROP_VIEW.minX,
    top: top + PROP_VIEW.minY,
    zIndex: depthOf(prop.x, prop.y)
  };
}

/**
 * @param {{
 *   copy: Record<string, any>,
 *   interactive?: boolean,
 *   onUseProp?: ((kind: string) => void) | null,
 *   activeKind?: string | null,
 *   board?: import('../../utils/officeFloorBoard.js').BoardState | null
 * }} props `copy` is `officeChromeCopy().floor`. Without `onUseProp`, or with
 *   `interactive` off — the arrival ceremony, or a meeting holding the room —
 *   every prop is scenery, which is the rule `FloorRoam` follows for the floor
 *   itself. `board` is what you are working on (§ 5 slice 16); the two props
 *   that can show it read it, the rest ignore it.
 */
export function FloorProps({
  copy,
  interactive = true,
  onUseProp = null,
  activeKind = null,
  board = null
}) {
  const usable = interactive && onUseProp ? usablePropKinds() : [];
  const items = copy.props?.items ?? {};
  const notes = boardNotes(copy, board);

  const rendered = FLOOR_PROPS.map((prop, index) => {
    const key = `${prop.kind}-${index}`;
    const style = propStyle(prop);

    // Only the first of a kind is the usable one: three plants would otherwise
    // be three buttons with one name, and `propTileFor` derives a single mark
    // per kind anyway.
    const isUsable =
      usable.includes(prop.kind) && FLOOR_PROPS.findIndex((p) => p.kind === prop.kind) === index;

    if (!isUsable) {
      return (
        <div key={key} className="office-floor-prop" style={style} aria-hidden="true">
          {propArt(prop, board, notes)}
        </div>
      );
    }

    const item = items[prop.kind] ?? {};
    return (
      <button
        key={key}
        type="button"
        className={`office-floor-prop office-floor-prop--usable${
          activeKind === prop.kind ? ' is-active' : ''
        }`}
        style={style}
        data-prop={prop.kind}
        title={item.useTitle ?? item.name ?? prop.kind}
        aria-label={item.useLabel ?? item.name ?? prop.kind}
        onClick={() => onUseProp?.(prop.kind)}
      >
        {propArt(prop, board, notes)}
      </button>
    );
  });

  return <>{rendered}</>;
}

/**
 * The readable words a prop has to offer.
 *
 * There are two camps, and a prop declares which one it is in with a copy key
 * rather than by being named here:
 *
 * - **Reflects your work** (`lineYours`) — the printer, which really does hand
 *   you a page of it. At 62 px the art can only show the *shape*, so the words
 *   go here where there is room for them.
 * - **Carries the room's own record** (`notes`) — the whiteboard (§ 6a). Its
 *   `line` and `details` are the old board nobody erased; the derived notes are
 *   what the room has added since, and they read first because they are the new
 *   handwriting.
 *
 * A third usable prop joins a camp with a copy row, not a branch.
 *
 * @param {Record<string, any>} item
 * @param {import('../../utils/officeFloorBoard.js').BoardState | null} board
 * @param {import('../../utils/officeFloorNotes.js').BoardNote[]} notes
 * @returns {{ line: string, details: string[] }}
 */
function propCopyFor(item, board, notes) {
  const fallback = { line: item.line, details: Array.isArray(item.details) ? item.details : [] };
  if (item.notes) {
    return { line: item.line, details: [...notes.map((note) => note.text), ...fallback.details] };
  }
  if (!board || !item.lineYours) return fallback;

  const vars = {
    count: String(board.nodes),
    labels: board.labels.slice(0, 3).join(', ')
  };
  const yours = Array.isArray(item.detailsYours) ? item.detailsYours : [];
  return {
    line: formatLocale(item.lineYours, vars),
    details: yours.map((detail) => formatLocale(detail, vars))
  };
}

/**
 * What you are doing over there, in the floor card slot rather than pinned to
 * the prop (§ 6 rule 12) — and for a second reason here: nobody is speaking. A
 * peek at least has a colleague to hang a bubble over; a printer talking would
 * be a different and much stupider game.
 *
 * @param {{
 *   prop: { propKind: string, phase: 'walking' | 'using' },
 *   phase?: 'idle' | 'working' | 'done' | 'blocked',
 *   copy: Record<string, any>,
 *   onBack?: () => void,
 *   board?: import('../../utils/officeFloorBoard.js').BoardState | null
 * }} props `copy` is `officeChromeCopy().floor`.
 */
export function FloorPropCard({ prop, phase = 'idle', copy, onBack, board = null }) {
  const propsCopy = copy.props ?? {};
  const item = propsCopy.items?.[prop.propKind] ?? {};
  const arrived = prop.phase === 'using';
  const shown = propCopyFor(item, board, boardNotes(copy, board));

  /*
   * Looking closer (§ 8 "examine / look at").
   *
   * § 8's own examples name the fridge and its sticky notes, but no unclaimed
   * kitchen prop is reachable — `propTileFor('fridge')` is null, same as the
   * water cooler (§ 6 rule 21), and making one reachable is a furniture move
   * that re-opens the `COFFEE_TILES` validation § 8 parks as "only worth it if
   * something wants a second kitchen prop". So the idea lands on the props that
   * § 8 actually describes — "a few props that today only have a line" — by
   * giving that line somewhere to go.
   *
   * An index in a component, not a store slice: § 8 says "never a second state
   * machine", and which sentence you are on is not office state. Walking away
   * unmounts the card and the prop starts fresh, which is right — noticing the
   * doodle again next time is the joke, not a continuity bug.
   */
  const [looked, setLooked] = useState(0);
  const details = shown.details;
  const showing = looked > 0 && details.length ? details[(looked - 1) % details.length] : null;

  const body = () => {
    if (!arrived) return propsCopy.walking;
    if (phase === 'blocked') return item.blocked ?? propsCopy.blocked;
    if (phase === 'working') return propsCopy.working ?? propsCopy.walking;
    return showing ?? shown.line;
  };

  const canLook = arrived && phase !== 'working' && phase !== 'blocked' && details.length > 0;

  /* Not a live region — see `FloorLiveRegion`. */
  return (
    <aside
      className="office-floor-card office-floor-card--prop"
      data-testid="office-floor-prop-card"
    >
      <span className="office-floor-eyebrow">{propsCopy.eyebrow}</span>
      <div className="office-floor-card-head">
        <span className="office-floor-prop-glyph" aria-hidden="true">
          {item.glyph ?? '📦'}
        </span>
        <div className="office-floor-card-id">
          <strong>{item.name ?? prop.propKind}</strong>
          <span>{item.note ?? ''}</span>
        </div>
      </div>
      <p className="office-floor-card-blurb">{body()}</p>
      <div className="office-floor-card-actions">
        {canLook ? (
          <button
            type="button"
            className="office-floor-card-action"
            data-testid="office-floor-prop-look"
            title={propsCopy.lookTitle}
            onClick={() => setLooked((n) => n + 1)}
          >
            {propsCopy.look}
          </button>
        ) : null}
        <button
          type="button"
          className="office-floor-card-action office-floor-card-action--primary"
          title={propsCopy.backTitle}
          onClick={onBack}
        >
          {propsCopy.back}
        </button>
      </div>
    </aside>
  );
}

export default FloorProps;
