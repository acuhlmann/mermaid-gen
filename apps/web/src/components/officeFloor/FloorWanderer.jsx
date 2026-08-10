/**
 * A colleague who has got up for a minute (slice 11), and — since slice 12 —
 * somebody you can walk up to while they are up.
 *
 * Still the quietest actor on the floor: no card, nothing written anywhere. An
 * ambient wanderer is scenery that moves, and giving it *content* would make it
 * a feature (`office-parody.md` § 11). What it now has is an **identity**, which
 * is a different thing: while they are stood at the machine their figure is the
 * same `FloorPersonButton` their chair renders, so selecting them, talking to
 * them and glowing at them all work exactly where they are standing instead of
 * only where they normally sit.
 *
 * Slice 18 gave it the one line it is allowed, and the exception is narrow
 * enough to state in a sentence: **an errand you walked into**. `said` is only
 * ever non-null on the leg home from a trip *you* turned round, so the trigger
 * is a tile you claimed rather than a timer, and § 11's ambient/reactive split
 * lands it on the reactive side. Every other trip on this floor is as silent as
 * it was in slice 11. The balloon lives inside the walking anchor rather than at
 * a tile of its own, because unlike `FloorDeskSpeech`'s speakers this one is
 * moving: it has to travel on the same transform as the figure, which is what
 * `FloorWalker` already does for a departing walk-by.
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
import FloorBubble from './FloorBubble.jsx';
import FloorFigure from './FloorFigure.jsx';
import FloorPersonButton from './FloorPersonButton.jsx';
import { useWalkAnimation } from './useWalkAnimation.js';
import { bubbleAlignForSpeaker, depthOf, walkPathBetween } from '../../utils/officeFloorPlan.js';
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
 * Above the zone-signage layer (9000), the lift every floor balloon takes.
 * Same number as `FloorWalker`'s, and deliberately a second copy: one shared
 * constant would be a module for one integer, which § 8's note about the four
 * `useWalkAnimation` callers already rejected on the same grounds.
 */
const SPEAKING_Z = 9500;

/**
 * The one line an interrupted errand carries home.
 *
 * Its own component for the reason § 8 records about this file: slice 12 got
 * `FloorWanderer` back *under* its complexity budget, and a component with no
 * warning should not acquire one — the same lever that moved a guard out of
 * `FloorTalkCard` into a `TalkPitch` sibling. The null check and the name
 * fallback are the two branches that were going to cost it.
 *
 * No footer, no dismiss, no chrome of any kind: unlike a walk-by there is
 * nothing here to keep when the body is hidden, which is why the caller passes
 * `said` already gated on captions rather than passing a `hideBody` through.
 *
 * § 6 rules 28–29 apply to a moving speaker too, and this is the first bubble
 * that had to decide *which* position to ask them about. Measured on a capture
 * of the walk back from the whiteboard, and both findings are worth keeping:
 *
 * - **Per-leg, off `useWalkAnimation`'s `tile`, is not better.** The helper
 *   assumes a speaker who is standing still, so biasing on the leg's
 *   destination shifts the balloon for a spot it has not reached — head
 *   overlaps during transit came out no better than centred, and a two-leg walk
 *   can flip the bias halfway and slide the balloon sideways for no reason.
 * - **The destination is the frame that matters.** The line is read during the
 *   linger, when they are stationary at their own desk — which is the one
 *   moment the helper's assumption actually holds. Aligning on `to` is exact
 *   there and stable for the whole trip.
 *
 * Computed here rather than in the parent so the box tests behind it only run
 * for the one trip in a session that has anything to say.
 */
function WandererLine({ said, sender, seatId, scale, to }) {
  if (!said) return null;
  return (
    <FloorBubble
      name={sender?.name ?? seatId}
      title={sender?.title}
      scale={scale}
      align={bubbleAlignForSpeaker(to, seatId)}
    >
      {said.text}
    </FloorBubble>
  );
}

/**
 * @param {{
 *   wanderer: {
 *     seatId: string,
 *     kind?: string,
 *     from: { x: number, y: number },
 *     to: { x: number, y: number },
 *     phase: 'out' | 'dwell' | 'home',
 *     leg: number,
 *     carrying?: string | null
 *   },
 *   copy: Record<string, any>,
 *   said?: { text: string, reaction: string } | null,
 *   scale?: number,
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
 *   the default parameters). `said` joins them for the same reason: it is read
 *   for truthiness twice below and always passed.
 *
 *   `said` is `interruptSpeech`'s answer, derived once in `OfficeFloor` and
 *   handed to the narrator as well as to here — asking twice would let the
 *   balloon and the voice draw different lines out of the same bank. It arrives
 *   already `null` when captions are off and the voice took the line, so this
 *   component never has to ask whether anybody heard it.
 */
export function FloorWanderer({
  wanderer,
  copy,
  said,
  scale,
  onArrive,
  elementRef,
  selected,
  speaking,
  nearby,
  onSelect,
  /* No default, twice over: `FloorPersonButton` already applies `= null` to
     both of these, and § 8's finding is that redundant defaults are most of
     what puts a floor component over its complexity budget. Slice 18 needed
     the two points back. */
  onActivate,
  onStep,
  // Same reason again: `floorActivityFor` defaults it, so a default here would
  // cost a complexity point for nothing.
  dayPhase
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
   *
   * `carrying` is what the trip *changed* about the hand: null on the way out,
   * whatever the prop handed over on the way back (`useFloorWander`). The
   * composition still happens in one place — this passes the context and reads
   * the answer, it does not decide what a coffee machine gives you.
   */
  const activity = floorActivityFor(seatId, {
    moving: !settled,
    // `floorActivityFor` defaults this to null itself; coalescing here as well
    // bought a branch and no behaviour.
    carrying: wanderer.carrying,
    dayPhase
  });

  return (
    <div
      ref={ref}
      className="office-floor-walker"
      data-testid="office-floor-wanderer"
      data-wanderer={seatId}
      data-settled={settled ? 'true' : undefined}
      data-said={said ? said.reaction : undefined}
      /* +5 like every other travelling figure, so they pass in front of the
         desk they are walking past rather than through it — until they say
         something, which has to clear the zone signage like every other line on
         this floor (§ 6 rule 6). */
      style={{ zIndex: said ? SPEAKING_Z : depthOf(tile.x, tile.y) + 5 }}
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
          <WandererLine said={said} sender={sender} seatId={seatId} scale={scale} to={to} />
          <FloorFigure id={seatId} accent={accent} activity={activity} walking={!arrived} />
        </div>
      )}
    </div>
  );
}

export default FloorWanderer;
