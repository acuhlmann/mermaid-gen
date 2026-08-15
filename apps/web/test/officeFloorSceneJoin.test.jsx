// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOfficeLayerPerformances } from '../src/hooks/useOfficeLayerPerformances.js';
import {
  _resetForTests,
  acceptOfficeBattle,
  acceptOfficeCoffee,
  declineOfficeBattle,
  declineOfficeCoffee,
  getOfficeSnapshot,
  hasActiveOfficeSurface,
  joinOfficeBattle,
  joinOfficeCoffee,
  pushOfficeBattleInvite,
  pushOfficeCoffeeInvite,
  voteOfficeBattle
} from '../src/state/officeMomentStore.js';
import {
  isUnattendedScene,
  sceneJoinOfferFor,
  withinSceneEarshot
} from '../src/utils/officeFloorSceneJoin.js';
import {
  BATTLE_LINE_PACE_MS,
  BATTLE_SILENT_DURATION_MS,
  COFFEE_BREAK_DURATION_MS,
  COFFEE_LINE_PACE_MS
} from '../src/hooks/officeScenePacingConstants.js';
import {
  BATTLE_TILES,
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

/**
 * Walking into the holy war (slice 30).
 *
 * Slice 28 deliberately left the battle, and named the reason: a coffee break
 * ends when its script ends, so "joining ends it" is unambiguous there. A battle
 * ends when somebody **settles** it — the pacing only raises `battleLinesDone`,
 * and what clears the store is a click on the verdict panel, which is gated on
 * `accepted`. So a declined battle would run out of lines, render no panel, and
 * sit in `hasActiveOfficeSurface` forever: slice 28's own trap in the one
 * costume that survives slice 28's fix.
 *
 * The first describe is therefore about the ending again, and it is the reason
 * the rest of the slice is allowed to exist.
 */

const BATTLE_LINES = [
  { speakerId: 'gilfoyle', text: 'Tabs.' },
  { speakerId: 'dinesh', text: 'Spaces. Obviously.' }
];

const BATTLE_CLOSING = { speakerId: 'gilfoyle', text: '…right. You. You decide.' };

const battle = () => getOfficeSnapshot().battle;

describe('declining a holy war', () => {
  it('keeps the argument running instead of cancelling it', () => {
    pushOfficeBattleInvite({ topic: 'tabs', lines: BATTLE_LINES, verdicts: { gilfoyle: 'Ha.' } });
    declineOfficeBattle();

    expect(battle(), 'declining deleted an argument two other people were having').not.toBeNull();
    expect(battle().declined).toBe(true);
    expect(battle().accepted).toBe(false);
    expect(battle().lines).toEqual(BATTLE_LINES);
  });

  it('still counts as an active surface while it plays', () => {
    pushOfficeBattleInvite({ topic: 'tabs', lines: BATTLE_LINES, verdicts: {} });
    declineOfficeBattle();
    expect(hasActiveOfficeSurface()).toBe(true);
  });

  it('refuses to decline an argument you are already in', () => {
    pushOfficeBattleInvite({ topic: 'tabs', lines: BATTLE_LINES, verdicts: {} });
    acceptOfficeBattle();
    declineOfficeBattle();

    expect(battle().declined).toBe(false);
    expect(battle().accepted).toBe(true);
  });
});

describe('an argument nobody refereed', () => {
  const declinedBattle = {
    id: 'battle-1',
    lines: BATTLE_LINES,
    verdicts: {},
    accepted: false,
    declined: true,
    votedFor: null
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  /*
   * The claim the whole slice rests on. If this regresses, the office stops
   * speaking for the rest of the session and every card and earshot assertion
   * below still passes.
   */
  it('goes unsettled and dismisses itself, so the ambient director gets the room back', async () => {
    const onBattleUnsettled = vi.fn();
    renderHook(() =>
      useOfficeLayerPerformances({
        coffee: null,
        battle: declinedBattle,
        huddle: null,
        onBattleUnsettled
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BATTLE_SILENT_DURATION_MS + BATTLE_LINE_PACE_MS * 4);
    });

    expect(
      onBattleUnsettled,
      'a declined battle never ends and holds the office silent'
    ).toHaveBeenCalled();
  });

  /*
   * The other half, and the one that makes the claim above a real distinction
   * rather than "the hook calls its callback". An *attended* battle must NOT
   * take the unsettled exit — it waits for the verdict panel, which is the
   * entire difference between this scene and the coffee break.
   */
  it('does not take the unsettled exit when you are in it', async () => {
    const onBattleUnsettled = vi.fn();
    const { result } = renderHook(() =>
      useOfficeLayerPerformances({
        coffee: null,
        battle: { ...declinedBattle, accepted: true, declined: false },
        huddle: null,
        onBattleUnsettled
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BATTLE_SILENT_DURATION_MS + BATTLE_LINE_PACE_MS * 4);
    });

    expect(
      onBattleUnsettled,
      'a battle you are in dismissed itself mid-verdict'
    ).not.toHaveBeenCalled();
    // …and it reached the state that raises the panel, so the negative above is
    // an override rather than a scene that simply never finished.
    expect(result.current.battleLinesDone).toBe(true);
  });

  it('speaks none of it, and still reveals it a line at a time', async () => {
    const narrateLine = vi.fn(() => ({ spoken: true }));
    const { result } = renderHook(() =>
      useOfficeLayerPerformances({
        coffee: null,
        battle: declinedBattle,
        huddle: null,
        narrateLine,
        onBattleUnsettled: () => {}
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BATTLE_LINE_PACE_MS / 2);
    });

    expect(narrateLine, 'two voices from an empty corner of the office').not.toHaveBeenCalled();
    expect(
      result.current.battleVisibleLines,
      'the whole script flushed at once — the missing-narrator trap'
    ).toBeLessThan(BATTLE_LINES.length);
  });

  it('does speak once you have joined it', async () => {
    const narrateLine = vi.fn(() => ({ spoken: true }));
    renderHook(() =>
      useOfficeLayerPerformances({
        coffee: null,
        battle: { ...declinedBattle, accepted: true, declined: false },
        huddle: null,
        narrateLine,
        onBattleUnsettled: () => {}
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BATTLE_LINE_PACE_MS);
    });

    expect(narrateLine, 'an argument you are in went silent').toHaveBeenCalled();
  });
});

describe('joining the holy war', () => {
  it('hands you the casting vote rather than merely ending it', () => {
    pushOfficeBattleInvite({
      topic: 'tabs',
      lines: BATTLE_LINES,
      verdicts: { gilfoyle: 'Obviously.' }
    });
    declineOfficeBattle();
    const before = battle().id;

    expect(joinOfficeBattle(BATTLE_CLOSING)).toBe(true);
    expect(battle().lines).toEqual([BATTLE_CLOSING]);
    expect(battle().accepted).toBe(true);
    expect(battle().declined).toBe(false);
    expect(battle().id, 'pacing would resume mid-script').not.toBe(before);

    /*
     * The difference from the coffee break, asserted rather than described:
     * joining leaves the question open and `accepted` is what raises the panel,
     * so the vote that was refused a moment ago now lands.
     */
    expect(battle().votedFor).toBeNull();
    voteOfficeBattle('gilfoyle');
    expect(battle().votedFor, 'joined the argument and still could not settle it').toBe('gilfoyle');
  });

  it('refuses a vote on an argument you only walked past', () => {
    pushOfficeBattleInvite({
      topic: 'tabs',
      lines: BATTLE_LINES,
      verdicts: { gilfoyle: 'Obviously.' }
    });
    declineOfficeBattle();

    voteOfficeBattle('gilfoyle');
    expect(battle().votedFor, 'settled an argument without being in it').toBeNull();
  });

  it('will not join an argument nobody declined, or one already joined', () => {
    pushOfficeBattleInvite({ topic: 'tabs', lines: BATTLE_LINES, verdicts: {} });
    expect(joinOfficeBattle(BATTLE_CLOSING), 'joined a battle that is still an open invite').toBe(
      false
    );

    declineOfficeBattle();
    expect(joinOfficeBattle(BATTLE_CLOSING)).toBe(true);
    expect(joinOfficeBattle(BATTLE_CLOSING), 'joined the same battle twice').toBe(false);
  });

  it('refuses a blank closing beat rather than joining you into nothing', () => {
    pushOfficeBattleInvite({ topic: 'tabs', lines: BATTLE_LINES, verdicts: {} });
    declineOfficeBattle();

    expect(joinOfficeBattle(null)).toBe(false);
    expect(joinOfficeBattle({ speakerId: 'gilfoyle', text: '' })).toBe(false);
    expect(battle().declined, 'a refused join left the scene in a third state').toBe(true);
    expect(battle().accepted).toBe(false);
  });
});

describe('the battle offer', () => {
  const unattended = { declined: true, lines: BATTLE_LINES };

  it('is made at the cubicles, and named as its own kind', () => {
    expect(sceneJoinOfferFor(null, BATTLE_TILES[0], unattended)).toEqual({
      colleagueId: 'gilfoyle',
      participants: ['gilfoyle', 'dinesh'],
      kind: 'battle'
    });
  });

  /*
   * **The two catchments overlap, and that is a fact about the floor rather
   * than a bug.** Measured: the kitchen marks and the cubicle marks are 2–4
   * tiles apart against an `EARSHOT_RANGE_TILES` of 3, so standing at the
   * coffee machine really is within earshot of the argument and vice versa. The
   * room is small; pretending otherwise would mean a second, tighter radius,
   * which is what `NAME_CHIP_RANGE_TILES` being one ladder exists to prevent.
   *
   * What that makes load-bearing is the **scan order**, since the card slot
   * holds one card: coffee is checked first, so two unattended scenes resolve to
   * the break every time rather than to whichever re-rendered last. In practice
   * the state is unreachable — `canOfferOfficeBattle` refuses while another
   * surface is up — so this pins the tie-break rather than a live behaviour.
   */
  it('offers the battle at the cubicles, and lets coffee win an overlap', () => {
    for (const tile of BATTLE_TILES) {
      expect(sceneJoinOfferFor(null, tile, unattended), `${tile.x},${tile.y}`).not.toBeNull();
    }

    // The overlap is real in both directions — assert it, so a later floor-plan
    // change that separates them turns this into a visible decision.
    const declinedCoffee = { declined: true, lines: LINES };
    expect(sceneJoinOfferFor(declinedCoffee, BATTLE_TILES[0])?.kind).toBe('coffee');
    expect(sceneJoinOfferFor(null, COFFEE_TILES[1], unattended)?.kind).toBe('battle');

    // Both unattended at once: fixed order decides, not render timing.
    expect(sceneJoinOfferFor(declinedCoffee, BATTLE_TILES[0], unattended)?.kind).toBe('coffee');
  });

  it('withholds itself for an open invite, one you are in, and an empty script', () => {
    const near = BATTLE_TILES[0];
    expect(sceneJoinOfferFor(null, near, { lines: BATTLE_LINES })).toBeNull();
    expect(sceneJoinOfferFor(null, near, { accepted: true, lines: BATTLE_LINES })).toBeNull();
    expect(sceneJoinOfferFor(null, near, { declined: true, lines: [] })).toBeNull();
    expect(sceneJoinOfferFor(null, near, null)).toBeNull();
  });

  it('tracks earshot of the cubicles across the whole floor', () => {
    const inside = [];
    const outside = [];
    for (let x = 0; x < GRID_W; x += 1) {
      for (let y = 0; y < GRID_H; y += 1) {
        const tile = { x, y };
        if (!isStandableTile(tile)) continue;
        const near = BATTLE_TILES.some((mark) => tileDistance(tile, mark) <= EARSHOT_RANGE_TILES);
        (near ? inside : outside).push(tile);
      }
    }

    expect(inside.length, 'no standable tile hears the cubicles').toBeGreaterThan(0);
    expect(outside.length, 'the whole floor hears the cubicles').toBeGreaterThan(0);

    for (const tile of inside) {
      expect(withinSceneEarshot(tile, 'battle'), `${tile.x},${tile.y} should hear it`).toBe(true);
    }
    for (const tile of outside) {
      expect(withinSceneEarshot(tile, 'battle'), `${tile.x},${tile.y} should not`).toBe(false);
    }
  });
});
