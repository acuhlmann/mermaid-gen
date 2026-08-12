// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFloorShopTalk } from '../src/components/officeFloor/useFloorShopTalk.js';
import { officeChromeCopy } from '../src/utils/officeCast.js';
import { OFFICE_SHOP_TALK_CAP, WANDER_BIAS_WINDOWS } from '../src/utils/officeCadence.js';
import { propTileFor, usablePropKinds } from '../src/utils/officeFloorMovement.js';
import { dwellTargetAt } from '../src/utils/officeFloorDwell.js';
import { tierOf } from '../src/utils/castTiers.js';
import {
  overhearableAt,
  overheardPartnerFor,
  shopTalkExchange,
  shopTalkPartnerFor
} from '../src/utils/officeFloorShopTalk.js';
import {
  EARSHOT_RANGE_TILES,
  FLOOR_SEATS,
  GRID_H,
  GRID_W,
  NAME_CHIP_RANGE_TILES,
  YOU_SEAT_ID,
  isStandableTile,
  seatFor,
  tileDistance
} from '../src/utils/officeFloorPlan.js';

/**
 * Two colleagues talking to each other (slice 22).
 *
 * The half worth pinning hardest is not that the exchange plays — it is the
 * **proximity ladder**, because slices 19 and 22 both measure distance and both
 * put a balloon over somebody's head, and the only thing keeping them from
 * firing together is that each is defined as what the other is not. That
 * invariant is asserted over every standable tile on the floor rather than at a
 * sample, since a layout change is exactly what would break it silently.
 */

const FLOOR_COPY = () => officeChromeCopy().floor;

/** A settled trip: somebody stood at a prop, which is when they can be overheard. */
function tripTo(seatId, kind) {
  return { seatId, kind, to: propTileFor(kind), phase: 'dwell', leg: 1 };
}

/** Every tile the room will actually let you stand on. */
function standableTiles() {
  const tiles = [];
  for (let x = 0; x < GRID_W; x += 1) {
    for (let y = 0; y < GRID_H; y += 1) {
      // Takes a tile, not two numbers — passing `(x, y)` yields an empty set
      // and every loop below then passes vacuously.
      if (isStandableTile({ x, y })) tiles.push({ x, y });
    }
  }
  return tiles;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('who answers is an answer the room gives', () => {
  /*
   * The pay-off slice 11 got from `wanderTripsFor`, running one step further.
   * Nobody wrote down who chats to whom: a wander mark is a prop mark, prop
   * marks were placed so somebody could stand at them and be seen, and the desks
   * beside them belong to whoever the layout put there. If this ever comes back
   * empty for a prop, the room has stopped supporting the mechanic and the
   * feature is silently dead at that place.
   */
  it('gives every wanderable prop somebody to talk to', () => {
    for (const kind of usablePropKinds()) {
      const partner = shopTalkPartnerFor(propTileFor(kind), 'gilfoyle');
      expect(partner, `nobody sits near ${kind}`).toBeTruthy();
      expect(tileDistance(propTileFor(kind), seatFor(partner))).toBeLessThanOrEqual(
        NAME_CHIP_RANGE_TILES
      );
    }
  });

  /*
   * Reachable rather than theoretical: Dinesh sits a tile from the whiteboard
   * *and* is on the wander roster, so the person who walked over is regularly
   * the person the geometry would nominate to answer them.
   */
  it('never lets the wanderer answer their own opener', () => {
    const board = propTileFor('whiteboard');
    expect(shopTalkPartnerFor(board, 'gilfoyle')).toBe('dinesh');
    expect(shopTalkPartnerFor(board, 'dinesh')).toBe('jared');
  });

  it('never nominates leadership, whatever the prop', () => {
    for (const kind of usablePropKinds()) {
      for (const seat of FLOOR_SEATS) {
        const partner = shopTalkPartnerFor(propTileFor(kind), seat.id);
        if (partner)
          expect(tierOf(partner), `${partner} answered from behind glass`).not.toBe('senior');
      }
    }
  });

  /*
   * § 6 rule 5: a colleague a moment has claimed is already being drawn with
   * chrome of its own, so they cannot also be leaning back in a chair answering
   * somebody at the printer.
   */
  it('skips anybody a moment has already taken', () => {
    const printer = propTileFor('printer');
    expect(shopTalkPartnerFor(printer, 'gilfoyle')).toBe('helpdesk');
    expect(shopTalkPartnerFor(printer, 'gilfoyle', { awayIds: ['helpdesk'] })).toBeNull();
  });
});

describe('the proximity ladder', () => {
  const mark = propTileFor('whiteboard');
  const partnerTile = seatFor('dinesh');

  it('is silent when you are too far to hear it', () => {
    const far = { x: mark.x, y: mark.y + EARSHOT_RANGE_TILES + 1 };
    expect(overhearableAt(far, mark, partnerTile)).toBe(false);
  });

  it('is silent when you are close enough to be spoken to instead', () => {
    expect(overhearableAt(mark, mark, partnerTile)).toBe(false);
    // Two tiles from the board but shoulder to shoulder with whoever is
    // answering — which is why the inner bound is measured per speaker rather
    // than to the mark. `dwellTargetAt` hands this tile to Dinesh.
    const besidePartner = { x: partnerTile.x - 1, y: partnerTile.y - 1 };
    expect(tileDistance(besidePartner, mark)).toBeGreaterThan(NAME_CHIP_RANGE_TILES);
    expect(overhearableAt(besidePartner, mark, partnerTile)).toBe(false);
  });

  it('carries in the ring between the two', () => {
    const listening = { x: mark.x, y: mark.y + NAME_CHIP_RANGE_TILES + 1 };
    expect(overhearableAt(listening, mark, partnerTile)).toBe(true);
  });

  /**
   * The invariant the whole design rests on, and the reason both slices can
   * share `NAME_CHIP_RANGE_TILES` without colliding: there is no tile on this
   * floor where somebody is talking *to* you and two other people are talking
   * *past* you at the same time. Checked over every standable tile against every
   * prop, because the failure mode is a layout change rather than a logic
   * change — and it would show up as three lines in five seconds rather than as
   * anything a unit test of either slice alone would notice.
   */
  it('never lets slice 19 and slice 22 fire at the same person on the same tile', () => {
    for (const kind of usablePropKinds()) {
      const trip = tripTo('gilfoyle', kind);
      const floorState = { wanderer: trip };
      for (const tile of standableTiles()) {
        const partner = overheardPartnerFor(trip, tile, floorState);
        if (!partner) continue;
        const dwell = dwellTargetAt(tile, floorState);
        expect(
          [trip.seatId, partner].includes(dwell?.colleagueId),
          `at (${tile.x},${tile.y}) near ${kind}: ${dwell?.colleagueId} both spoke to you and was overheard`
        ).toBe(false);
      }
    }
  });

  it('finds you a spot to overhear from at every prop', () => {
    for (const kind of usablePropKinds()) {
      const trip = tripTo('gilfoyle', kind);
      const audible = standableTiles().filter((tile) =>
        overheardPartnerFor(trip, tile, { wanderer: trip })
      );
      expect(audible.length, `${kind} cannot be overheard from anywhere`).toBeGreaterThan(0);
    }
  });

  it('is silent while nobody is standing on the floor', () => {
    const trip = tripTo('gilfoyle', 'whiteboard');
    expect(overheardPartnerFor(trip, null, { wanderer: trip })).toBeNull();
  });

  it('is silent while they are still walking', () => {
    const trip = { ...tripTo('gilfoyle', 'whiteboard'), phase: 'out' };
    const listening = { x: mark.x, y: mark.y + 2 };
    expect(overheardPartnerFor(trip, listening, { wanderer: trip })).toBeNull();
  });
});

describe('the exchange', () => {
  it('is a pair, opened by whoever walked over', () => {
    const trip = tripTo('gilfoyle', 'printer');
    const exchange = shopTalkExchange(trip, 'helpdesk', FLOOR_COPY(), 0);
    expect(exchange.lines).toHaveLength(2);
    expect(exchange.lines[0].speakerId).toBe('gilfoyle');
    expect(exchange.lines[1].speakerId).toBe('helpdesk');
    expect(exchange.lines[0].text).toBeTruthy();
    expect(exchange.lines[1].text).toBeTruthy();
    // The mark, so the opener's balloon hangs where the speaker is stood rather
    // than over the chair they left.
    expect(exchange.at).toEqual(propTileFor('printer'));
  });

  /*
   * The reply has to answer the opener, which is the whole reason the bank
   * stores pairs instead of two lists. A roll that took the opener from one
   * entry and the reply from another would be a non-sequitur every time, and
   * nothing but reading it would ever notice.
   */
  it('takes both halves from the same bank entry', () => {
    const trip = tripTo('gilfoyle', 'coffeeMachine');
    const bank = FLOOR_COPY().shopTalk.coffeeMachine;
    for (let index = 0; index < bank.length; index += 1) {
      const roll = index / bank.length;
      const exchange = shopTalkExchange(trip, 'facilities', FLOOR_COPY(), roll);
      expect(exchange.lines.map((line) => line.text)).toEqual(bank[index]);
    }
  });

  /**
   * Slice 24 moved this from "a debt" to "a number", so it is worth pinning.
   *
   * The roll is uniform and has no memory, so the chance of hearing the same
   * pair twice inside a visit is a function of two dials that live in two files
   * on purpose — `OFFICE_SHOP_TALK_CAP` for how often, the bank for how much.
   * Raising one without the other is exactly what makes repeats visible, and
   * slice 24 raised the *traffic* to the coffee machine, so its bank had to
   * grow with it. This asserts the relationship rather than the number: the
   * prop the room drifts toward must carry at least as many pairs as the cap
   * allows exchanges.
   */
  it('gives the prop the room drifts toward enough material for a whole visit', () => {
    const biased = WANDER_BIAS_WINDOWS.map((window) => window.kind);
    expect(biased.length, 'nothing is biased — this proves nothing').toBeGreaterThan(0);
    for (const kind of biased) {
      expect(
        FLOOR_COPY().shopTalk[kind]?.length ?? 0,
        `${kind} is favoured by the clock and can exhaust itself`
      ).toBeGreaterThanOrEqual(OFFICE_SHOP_TALK_CAP);
    }
  });

  it('clamps a roll of 1 rather than running off the end', () => {
    const trip = tripTo('gilfoyle', 'coffeeMachine');
    expect(shopTalkExchange(trip, 'facilities', FLOOR_COPY(), 1)).toBeTruthy();
  });

  /*
   * `officeChromeCopy()` swaps whole bundles rather than merging, so a locale
   * that has not been translated has no bank at all. Silence is the right
   * runtime answer and is exactly why nothing would surface it — hence the
   * parity assertion in `officeLocale.test.js`.
   */
  it('goes quiet rather than half-speaking when a bank is missing', () => {
    const trip = tripTo('gilfoyle', 'printer');
    expect(shopTalkExchange(trip, 'helpdesk', { shopTalk: {} }, 0)).toBeNull();
    expect(shopTalkExchange(trip, 'helpdesk', {}, 0)).toBeNull();
    expect(shopTalkExchange(trip, null, FLOOR_COPY(), 0)).toBeNull();
  });
});

describe('overhearing one, in a renderer', () => {
  const KIND = 'whiteboard';
  const MARK = propTileFor(KIND);
  /** In the ring: past the chip range of both speakers, inside earshot. */
  const LISTENING = { x: MARK.x, y: MARK.y + NAME_CHIP_RANGE_TILES + 1 };

  function mountShopTalk(overrides = {}) {
    const trip = tripTo('gilfoyle', KIND);
    return renderHook((props) => useFloorShopTalk(props), {
      initialProps: {
        wanderer: trip,
        youTile: LISTENING,
        floorState: { wanderer: trip },
        copy: FLOOR_COPY(),
        active: true,
        suspended: false,
        // A wrapper rather than `undefined`: with no narrator `useScenePacing`
        // reveals every line at once, and two balloons over two adjacent heads
        // is the thing this slice is shaped to avoid.
        narrateLine: () => Promise.resolve({ spoken: false }),
        ...overrides
      }
    });
  }

  it('lights one speaker at a time, opener first', async () => {
    vi.useFakeTimers();
    const { result } = mountShopTalk();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.said.speakerId).toBe('gilfoyle');
    // The opener is spoken standing at the board, so it needs the mark rather
    // than the chair Gilfoyle left.
    expect(result.current.at).toEqual(MARK);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(result.current.said.speakerId).toBe('dinesh');
    // The replier never got up, so `null` is what earns them the seat lift.
    expect(result.current.at).toBeNull();
  });

  it('says nothing while you are close enough to be spoken to', async () => {
    vi.useFakeTimers();
    const { result } = mountShopTalk({ youTile: MARK });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.said).toBeNull();
  });

  it('says nothing while something else has your attention', async () => {
    vi.useFakeTimers();
    const { result } = mountShopTalk({ active: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.said).toBeNull();
  });

  /*
   * Walking out mid-sentence is the one interaction this slice has. A
   * conversation that followed you across the room would be worse than one you
   * never heard — and `useScenePacing`'s cleanup cancels the voice with it.
   */
  it('stops when you walk away', async () => {
    vi.useFakeTimers();
    const { result, rerender } = mountShopTalk();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.said).toBeTruthy();

    const trip = tripTo('gilfoyle', KIND);
    // Two act blocks on purpose: a rerender and a clock advance in one block
    // advances the clock before the effect that owns the timer has run.
    await act(async () => {
      rerender({
        wanderer: trip,
        youTile: { x: MARK.x, y: MARK.y + EARSHOT_RANGE_TILES + 1 },
        floorState: { wanderer: trip },
        copy: FLOOR_COPY(),
        active: true,
        suspended: false,
        narrateLine: () => Promise.resolve({ spoken: false })
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.said).toBeNull();
  });

  /*
   * The anti-annoyance guarantee, and the reason the dial sits in
   * `officeCadence.js` beside the LLM budgets even though this one is free:
   * § 11's rule is about how often the office makes a noise at you, not about
   * what a noise costs.
   */
  it('settles after the cap and leaves the room quiet', async () => {
    vi.useFakeTimers();
    const { result, rerender } = mountShopTalk();

    for (let leg = 1; leg <= OFFICE_SHOP_TALK_CAP + 1; leg += 1) {
      const trip = { ...tripTo('gilfoyle', KIND), leg };
      await act(async () => {
        rerender({
          wanderer: trip,
          youTile: LISTENING,
          floorState: { wanderer: trip },
          copy: FLOOR_COPY(),
          active: true,
          suspended: false,
          narrateLine: () => Promise.resolve({ spoken: false })
        });
      });
      // Long enough for both lines, the tail, and `onDone`.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });
    }

    const trip = { ...tripTo('gilfoyle', KIND), leg: OFFICE_SHOP_TALK_CAP + 2 };
    await act(async () => {
      rerender({
        wanderer: trip,
        youTile: LISTENING,
        floorState: { wanderer: trip },
        copy: FLOOR_COPY(),
        active: true,
        suspended: false,
        narrateLine: () => Promise.resolve({ spoken: false })
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.said).toBeNull();
  });

  it('speaks both halves aloud, in order', async () => {
    vi.useFakeTimers();
    const heard = [];
    mountShopTalk({
      narrateLine: (line) => {
        heard.push(line.speakerId);
        return Promise.resolve({ spoken: true });
      }
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(heard).toEqual(['gilfoyle', 'dinesh']);
  });

  /**
   * Slice 23. The offer is the middle rung of the ladder wearing a button, so
   * everything asserted above about *hearing* an exchange has to hold for
   * *joining* one — with a single deliberate exception, which is the first case
   * below: two lines are over in seven seconds and the pair are still standing
   * there, so an offer that died with the last balloon would be a reflex test.
   */
  it('outlives the exchange it came from', async () => {
    vi.useFakeTimers();
    const { result } = mountShopTalk();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.join).toEqual({
      colleagueId: 'gilfoyle',
      partnerId: 'dinesh',
      kind: KIND
    });

    // Both lines, the tail, and `onDone`.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(result.current.said, 'the balloon should have cleared').toBeNull();
    expect(result.current.join, 'the offer should not have').toBeTruthy();
  });

  /*
   * Not a coin toss between the two speakers: the replier is in their chair and
   * will be all day, and the wanderer's errand ends in seconds. The offer is
   * for the one who is about to leave.
   */
  it('names the speaker who is about to walk away', async () => {
    vi.useFakeTimers();
    const { result } = mountShopTalk();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.join.colleagueId).toBe('gilfoyle');
    expect(result.current.join.colleagueId).not.toBe(result.current.join.partnerId);
  });

  it('is withdrawn when you walk out of earshot', async () => {
    vi.useFakeTimers();
    const { result, rerender } = mountShopTalk();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.join).toBeTruthy();

    const trip = tripTo('gilfoyle', KIND);
    const props = {
      wanderer: trip,
      youTile: { x: MARK.x, y: MARK.y + EARSHOT_RANGE_TILES + 1 },
      floorState: { wanderer: trip },
      copy: FLOOR_COPY(),
      active: true,
      suspended: false,
      narrateLine: () => Promise.resolve({ spoken: false })
    };
    await act(async () => {
      rerender(props);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.join).toBeNull();
  });

  /*
   * The other half of the same rule, and the one that matters when you *take*
   * the offer: `active` goes false the instant you have a reason to be
   * somewhere, so accepting ends the exchange rather than leaving it playing
   * over the conversation you just started.
   */
  it('is withdrawn once something has your attention', async () => {
    vi.useFakeTimers();
    const { result, rerender } = mountShopTalk();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.join).toBeTruthy();

    const trip = tripTo('gilfoyle', KIND);
    await act(async () => {
      rerender({
        wanderer: trip,
        youTile: LISTENING,
        floorState: { wanderer: trip },
        copy: FLOOR_COPY(),
        active: false,
        suspended: false,
        narrateLine: () => Promise.resolve({ spoken: false })
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.said).toBeNull();
    expect(result.current.join).toBeNull();
  });

  /*
   * A locale with no bank has two people standing in silence, and inviting you
   * to join a conversation that is not happening is worse than the silence. The
   * offer is read off the exchange for exactly this reason.
   */
  it('offers nothing to join when the bank is missing', async () => {
    vi.useFakeTimers();
    const { result } = mountShopTalk({ copy: { shopTalk: {} } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.said).toBeNull();
    expect(result.current.join).toBeNull();
  });

  it('does not draw the audience into it', () => {
    // Nothing this slice produces names the player, and nothing invites a
    // reply: no thread, no unread count, no Do-it. That is the line between an
    // overheard exchange and a walk-by, which is a moment and belongs in the
    // store (ADR-0011 rule 1).
    const trip = tripTo('gilfoyle', KIND);
    const exchange = shopTalkExchange(trip, 'dinesh', FLOOR_COPY(), 0);
    for (const line of exchange.lines) {
      expect(line.speakerId).not.toBe(YOU_SEAT_ID);
    }
  });
});
