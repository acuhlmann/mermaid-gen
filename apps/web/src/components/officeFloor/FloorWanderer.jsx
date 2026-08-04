/**
 * A colleague who has got up for a minute (slice 11), and — since slice 12 —
 * somebody you can walk up to while they are up.
 *
 * Still the quietest actor on the floor: no bubble of its own, no card, nothing
 * written anywhere. An ambient wanderer is scenery that moves, and giving it
 * *content* would make it a feature (`office-parody.md` § 11). What it now has
 * is an **identity**, which is a different thing: while they are stood at the
 * machine their figure is the same `FloorPersonButton` their chair renders, so
 * selecting them, talking to them and glowing at them all work exactly where
 * they are standing instead of only where they normally sit.
 *
 * **Only while they are settled.** Mid-stride there is no button at all: a
 * moving hit target is a coin flip, and a mark derived from a tile they have not
 * reached is a mark they will not be at (`whereaboutsOf`). The swap is also why
 * the button and the plain figure are two branches rather than one with a
 * conditional wrapper — a settled figure is not walking, so it wants the idle
 * animation and the chip, and a travelling one wants neither.
 *
 * Third caller of `useWalkAnimation`, after `FloorWalker` (a colleague coming
 * to bother you) and `FloorPlayer` (you). The three share about ten lines —
 * a positioned wrapper, a depth, an anchor — and differ in everything they wrap
 * it around, so they stay three files. A fourth would be the moment to collapse
 * them.
 */

import { useRef } from 'react';
import FloorFigure from './FloorFigure.jsx';
import FloorPersonButton from './FloorPersonButton.jsx';
import { useWalkAnimation } from './useWalkAnimation.js';
import { depthOf, walkPathBetween } from '../../utils/officeFloorPlan.js';
import { officeSenderInfo } from '../../utils/officeCast.js';
import { floorActivityFor } from '../../utils/officeFloorActivity.js';
import { formatLocale } from '../../i18n/formatLocale.js';

/**
 * What they are called to anybody not looking at the room. The place is in here
 * rather than in the live region on purpose: slice 11 decided ambient traffic is
 * not worth announcing and slice 12 does not reopen that, but a *target* has to
 * say what it is, and "at the whiteboard" is the difference between a name you
 * can act on and a name that has moved.
 */
function awayLabel(sender, seatId, propKind, copy) {
  const name = sender?.name ?? seatId;
  const who = sender?.title ? `${name} — ${sender.title}` : name;
  // Non-optional on `copy` the way `floorAnnouncement` is, and for the same
  // reason: a floor bundle without `props.items` has already broken the stage.
  const place = copy.props.items[propKind]?.name;
  if (!place) return who;
  return formatLocale(copy.away.atLabel, { who, prop: place });
}

/**
 * @param {{
 *   wanderer: {
 *     seatId: string,
 *     kind?: string,
 *     from: { x: number, y: number },
 *     to: { x: number, y: number },
 *     phase: 'out' | 'dwell' | 'home',
 *     leg: number
 *   },
 *   copy: Record<string, any>,
 *   onArrive?: () => void,
 *   elementRef?: { current: HTMLElement | null },
 *   selected?: boolean,
 *   speaking?: boolean,
 *   nearby?: boolean,
 *   onSelect?: ((id: string) => void) | null,
 *   onActivate?: ((id: string) => void) | null,
 *   onStep?: (tile: { x: number, y: number }, isYou?: boolean) => void
 * }} props `elementRef` lets the hook read where they actually got to when a
 *   trip is turned round mid-stride (`liveTileOf`), exactly as free roam does
 *   for you. `onSelect` is what makes them reachable; without it they are the
 *   slice 11 wanderer, which is what the arrival ceremony still wants.
 *   `onActivate` is the double-click walk-and-talk shortcut.
 *
 *   `selected`, `speaking` and `nearby` take no defaults: all three are
 *   forwarded to `FloorPersonButton`, which defaults them itself, so a default
 *   here would buy nothing but a branch each — and this component has a
 *   complexity budget to keep (§ 8's note that most of these warnings *are*
 *   the default parameters).
 */
export function FloorWanderer({
  wanderer,
  copy,
  onArrive,
  elementRef,
  selected,
  speaking,
  nearby,
  onSelect,
  onActivate = null,
  onStep
}) {
  const ownRef = useRef(null);
  const ref = elementRef ?? ownRef;
  const { seatId, from, to, leg } = wanderer;
  const path = walkPathBetween(from, to, seatId);

  const { tile, arrived } = useWalkAnimation(ref, path, {
    walkKey: `wander:${seatId}:${leg}`,
    onArrive,
    // Ambient traffic finally gets the one thing it is allowed to have. It says
    // nothing and is announced nowhere (slice 11), but a room where somebody
    // crosses it in total silence is a room that reads as empty.
    onLeg: onStep ? (legTile) => onStep(legTile, false) : undefined
  });

  const sender = officeSenderInfo(seatId);
  const accent = sender?.accentColor ?? 'var(--accent)';
  const settled = wanderer.phase === 'dwell';
  /*
   * They keep whatever they were holding while they are up — which is most of
   * why ambient traffic reads as errands rather than pacing: Gary crossing the
   * room with his mug is going somewhere, Gary crossing it empty-handed is
   * lost. `moving` only drops the idle rhythm, never the hand (see
   * `floorActivityFor`), and the walk animation owns the body meanwhile.
   */
  const activity = floorActivityFor(seatId, { moving: !settled });

  return (
    <div
      ref={ref}
      className="office-floor-walker"
      data-testid="office-floor-wanderer"
      data-wanderer={seatId}
      data-settled={settled ? 'true' : undefined}
      /* +5 like every other travelling figure, so they pass in front of the
         desk they are walking past rather than through it. */
      style={{ zIndex: depthOf(tile.x, tile.y) + 5 }}
    >
      {settled && onSelect ? (
        <FloorPersonButton
          id={seatId}
          name={sender?.name ?? seatId}
          label={awayLabel(sender, seatId, wanderer.kind, copy)}
          accent={accent}
          selected={selected}
          speaking={speaking}
          nearby={nearby}
          activity={activity}
          onSelect={onSelect}
          onActivate={onActivate}
        />
      ) : (
        <div className="office-floor-walker-anchor">
          <FloorFigure id={seatId} accent={accent} activity={activity} walking={!arrived} />
        </div>
      )}
    </div>
  );
}

export default FloorWanderer;
