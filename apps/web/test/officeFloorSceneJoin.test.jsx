// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOfficeLayerPerformances } from '../src/hooks/useOfficeLayerPerformances.js';
import {
  _resetForTests,
  acceptOfficeCoffee,
  declineOfficeCoffee,
  getOfficeSnapshot,
  hasActiveOfficeSurface,
  joinOfficeCoffee,
  pushOfficeCoffeeInvite
} from '../src/state/officeMomentStore.js';
import {
  isUnattendedScene,
  sceneJoinOfferFor,
  withinSceneEarshot
} from '../src/utils/officeFloorSceneJoin.js';
import {
  COFFEE_BREAK_DURATION_MS,
  COFFEE_LINE_PACE_MS
} from '../src/hooks/officeScenePacingConstants.js';
import {
  COFFEE_TILES,
  EARSHOT_RANGE_TILES,
  GRID_H,
  GRID_W,
  isStandableTile,
  tileDistance
} from '../src/utils/officeFloorPlan.js';

/**
 * Walking into a coffee break you turned down (slice 28).
 *
 * The half worth pinning hardest is the **lifecycle**, not the offer. Declining
 * used to delete the scene, and the whole slice rests on it surviving instead —
 * which puts a live entry in `hasActiveOfficeSurface` for the first time on a
 * path where nobody is watching it. If that entry ever stops being cleared the
 * ambient director goes silent for the rest of the session, and every assertion
 * about cards and earshot below would still pass while the office died quietly.
 * That is the errand trap, and it is why the first describe is about endings.
 */

const LINES = [
  { speakerId: 'gary', text: 'Kitchen?' },
  { speakerId: 'jared', text: 'Go on then.' }
];

const CLOSING = { speakerId: 'gary', text: '…anyway. Oh — hello.' };

const coffee = () => getOfficeSnapshot().coffee;

beforeEach(() => {
  _resetForTests();
});

describe('declining a set piece', () => {
  it('keeps the break running instead of cancelling it', () => {
    pushOfficeCoffeeInvite({ lines: LINES });
    declineOfficeCoffee();

    expect(coffee(), 'declining deleted somebody else’s coffee break').not.toBeNull();
    expect(coffee().declined).toBe(true);
    expect(coffee().accepted).toBe(false);
    // The cast is untouched — it is the same break, you are just not in it.
    expect(coffee().lines).toEqual(LINES);
  });

  /*
   * The reason this slice could break the office rather than merely itself.
   * `coffee` counts toward the predicate that holds the ambient director, so a
   * declined scene is a live surface with no user attention on it; the only
   * thing that ends it is the pacing running to `onDone`. This asserts the
   * dangerous half — that it *is* counted — so that the companion claim below
   * (it can still be dismissed) is load-bearing rather than incidental.
   */
  it('still counts as an active surface while it plays', () => {
    pushOfficeCoffeeInvite({ lines: LINES });
    declineOfficeCoffee();
    expect(hasActiveOfficeSurface()).toBe(true);
  });

  it('refuses to decline a break you are already in', () => {
    pushOfficeCoffeeInvite({ lines: LINES });
    acceptOfficeCoffee();
    declineOfficeCoffee();

    expect(coffee().declined).toBe(false);
    expect(coffee().accepted).toBe(true);
  });
});

describe('joining it', () => {
  it('swaps the script for the closing beat and makes the break yours', () => {
    pushOfficeCoffeeInvite({ lines: LINES });
    declineOfficeCoffee();
    const before = coffee().id;

    expect(joinOfficeCoffee(CLOSING)).toBe(true);
    expect(coffee().lines).toEqual([CLOSING]);
    expect(coffee().accepted).toBe(true);
    expect(coffee().declined).toBe(false);
    /*
     * A fresh id is the mechanism, not bookkeeping: `useScenePacing` keys on
     * it, so reusing the old one would leave `visibleLines` past the end of a
     * one-line script and the beat would never render.
     */
    expect(coffee().id, 'pacing would resume mid-script').not.toBe(before);
  });

  it('will not join a break nobody declined, or one already joined', () => {
    pushOfficeCoffeeInvite({ lines: LINES });
    expect(joinOfficeCoffee(CLOSING), 'joined a break that is still an open invite').toBe(false);

    declineOfficeCoffee();
    expect(joinOfficeCoffee(CLOSING)).toBe(true);
    expect(joinOfficeCoffee(CLOSING), 'joined the same break twice').toBe(false);
  });

  /*
   * `officeChromeCopy()` swaps whole bundles, so a locale that never translated
   * `floor.sceneJoin` yields no line at all. Refusing here is what stops that
   * becoming a break whose one remaining beat is empty — it stays declined and
   * plays out, which is the same silence every other missing bank degrades to.
   */
  it('refuses a blank closing beat rather than joining you into nothing', () => {
    pushOfficeCoffeeInvite({ lines: LINES });
    declineOfficeCoffee();

    expect(joinOfficeCoffee(null)).toBe(false);
    expect(joinOfficeCoffee({ speakerId: 'gary', text: '' })).toBe(false);
    expect(coffee().declined, 'a refused join left the scene in a third state').toBe(true);
    expect(coffee().accepted).toBe(false);
  });
});

/**
 * The claim the rest of the slice rests on: a break nobody is watching still
 * finishes.
 *
 * Pacing is what dismisses a scene, and before this slice a declined scene was
 * deleted outright so it never needed any. Now it sits in the store counting
 * toward `hasActiveOfficeSurface` until `onDone` fires — so if the pacing gate
 * ever goes back to `accepted` alone, the office stops speaking for the rest of
 * the session and no card, copy or earshot assertion above would notice.
 */
describe('while nobody is attending it', () => {
  const declined = { id: 'coffee-1', lines: LINES, accepted: false, declined: true };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('paces itself and ends, so the ambient director gets the room back', async () => {
    const onCoffeeDone = vi.fn();
    renderHook(() =>
      useOfficeLayerPerformances({
        coffee: declined,
        battle: null,
        huddle: null,
        onCoffeeDone
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(COFFEE_BREAK_DURATION_MS + COFFEE_LINE_PACE_MS * 4);
    });

    expect(
      onCoffeeDone,
      'a declined break never ends and holds the office silent'
    ).toHaveBeenCalled();
  });

  /*
   * Silent, and specifically silent *without* being handed `undefined` — which
   * is CLAUDE.md's `useScenePacing` trap. With no narrator the hook reveals
   * every line at once, so passing nothing would flush the script in a tick and
   * dismiss the break before anybody had walked to the machine. The wrapper
   * keeps the reveal one-at-a-time, which is what this asserts alongside the
   * silence: a first line, and not the whole script.
   */
  it('speaks none of it, and still reveals it a line at a time', async () => {
    const narrateLine = vi.fn(() => ({ spoken: true }));
    const { result } = renderHook(() =>
      useOfficeLayerPerformances({
        coffee: declined,
        battle: null,
        huddle: null,
        narrateLine,
        onCoffeeDone: () => {}
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(COFFEE_LINE_PACE_MS / 2);
    });

    expect(narrateLine, 'two voices from an empty corner of the office').not.toHaveBeenCalled();
    expect(
      result.current.coffeeVisibleLines,
      'the whole script flushed at once — the missing-narrator trap'
    ).toBeLessThan(LINES.length);
  });

  it('does speak once you have joined it', async () => {
    const narrateLine = vi.fn(() => ({ spoken: true }));
    renderHook(() =>
      useOfficeLayerPerformances({
        coffee: { ...declined, accepted: true, declined: false },
        battle: null,
        huddle: null,
        narrateLine,
        onCoffeeDone: () => {}
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(COFFEE_LINE_PACE_MS);
    });

    expect(narrateLine, 'a break you are in went silent').toHaveBeenCalled();
  });
});

describe('the offer', () => {
  const near = COFFEE_TILES[0];

  it('is made only for a break that is running without you', () => {
    expect(isUnattendedScene(null)).toBe(false);
    expect(isUnattendedScene({ accepted: false, declined: false })).toBe(false);
    expect(isUnattendedScene({ accepted: true, declined: false })).toBe(false);
    expect(isUnattendedScene({ accepted: true, declined: true })).toBe(false);
    expect(isUnattendedScene({ accepted: false, declined: true })).toBe(true);
  });

  it('names the person whose invitation you turned down', () => {
    const offer = sceneJoinOfferFor({ declined: true, lines: LINES }, near);
    expect(offer).toEqual({
      colleagueId: 'gary',
      participants: ['gary', 'jared'],
      kind: 'coffee'
    });
  });

  it('withholds itself for an open invite, a break you are in, and an empty script', () => {
    expect(sceneJoinOfferFor({ lines: LINES }, near)).toBeNull();
    expect(sceneJoinOfferFor({ accepted: true, lines: LINES }, near)).toBeNull();
    expect(sceneJoinOfferFor({ declined: true, lines: [] }, near)).toBeNull();
    expect(sceneJoinOfferFor(null, near)).toBeNull();
  });

  it('withholds itself when you are nowhere near the kitchen', () => {
    expect(sceneJoinOfferFor({ declined: true, lines: LINES }, null)).toBeNull();
  });

  /*
   * Over every standable tile rather than a sample, which is the shape slice 22
   * settled on for the proximity ladder: what breaks a range check is a layout
   * change, and a handful of hand-picked tiles cannot see one.
   *
   * The companion claim is the point — a sweep over a derived set that turns
   * out to be empty passes while examining nothing, which is exactly how slice
   * 22 shipped two probes that proved nothing. Both bounds are asserted
   * non-empty so a floor plan that put every tile in or out of earshot fails
   * here instead of silently agreeing.
   */
  it('tracks earshot of the kitchen across the whole floor', () => {
    const inside = [];
    const outside = [];

    for (let x = 0; x < GRID_W; x += 1) {
      for (let y = 0; y < GRID_H; y += 1) {
        const tile = { x, y };
        if (!isStandableTile(tile)) continue;
        const nearest = Math.min(...COFFEE_TILES.map((mark) => tileDistance(tile, mark)));
        (nearest <= EARSHOT_RANGE_TILES ? inside : outside).push(tile);
      }
    }

    expect(inside.length, 'no standable tile hears the kitchen').toBeGreaterThan(0);
    expect(outside.length, 'the whole floor hears the kitchen').toBeGreaterThan(0);

    for (const tile of inside) {
      expect(withinSceneEarshot(tile), `${tile.x},${tile.y} should hear the kitchen`).toBe(true);
    }
    for (const tile of outside) {
      expect(withinSceneEarshot(tile), `${tile.x},${tile.y} should not hear it`).toBe(false);
    }
  });

  /*
   * Slice 22's ladder has an inner bound; this deliberately does not. Standing
   * at the machine is the most natural moment to be let in, and the collision
   * that bound exists to dodge (slice 19 talking *to* you) cannot happen here:
   * a scene's cast are `awayIds`, so `dwellTargetAt` never picks them.
   */
  it('still offers when you are stood right at the machine', () => {
    for (const tile of COFFEE_TILES) {
      expect(sceneJoinOfferFor({ declined: true, lines: LINES }, tile)).not.toBeNull();
    }
  });
});
