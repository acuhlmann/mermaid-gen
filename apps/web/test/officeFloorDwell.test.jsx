// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
import { dwellLineFrom, dwellTargetAt } from '../src/utils/officeFloorDwell.js';
import { DWELL_MS } from '../src/components/officeFloor/useFloorDwell.js';
import { renderFloor, resetOfficeFloorTestState } from './helpers/officeFloorTestUtils.jsx';
import { propTileFor } from '../src/utils/officeFloorMovement.js';
import { isStandableTile, projectIso, seatFor } from '../src/utils/officeFloorPlan.js';

/**
 * Standing next to somebody for too long (slice 19).
 *
 * Every tile below is a **real standable tile**, chosen by sweeping the floor
 * plan rather than guessed, so a layout change fails these rather than quietly
 * moving what they test:
 *
 * - `(7, 6)` — one step from your own desk and adjacent to exactly one
 *   colleague, Jared. The plain case.
 * - `(7, 5)` — adjacent to three (Gilfoyle, Dinesh, Jared). The tie-break.
 * - `(7, 1)` — adjacent to three of the four executives and nobody else. It is
 *   also *inside* the fishbowl, which is the better half of the same fact: the
 *   room will not walk you there at all, so the `senior` exclusion is a belt to
 *   the geometry's braces.
 * - `(6, 6)` — reachable and beside nobody.
 */

const BESIDE_JARED = { x: 7, y: 6 };
const BESIDE_THE_POD = { x: 7, y: 5 };
const INSIDE_THE_GLASS = { x: 7, y: 1 };
const BESIDE_NOBODY = { x: 6, y: 6 };

afterEach(() => {
  resetOfficeFloorTestState();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('who you are stood next to', () => {
  it('names the one colleague within a tile of you', () => {
    expect(isStandableTile(BESIDE_JARED)).toBe(true);
    expect(dwellTargetAt(BESIDE_JARED, {})?.colleagueId).toBe('jared');
  });

  it('reports nobody when you are stood on your own', () => {
    expect(dwellTargetAt(null, {})).toBeNull();
    // Mid-room, a comfortable distance from every desk.
    expect(dwellTargetAt({ x: 2, y: 1 }, {})?.colleagueId).not.toBe('jared');
  });

  it('leaves the executives alone, because of the glass', () => {
    /*
     * Not manners: `tileDistance` is Chebyshev and the leadership seats sit at
     * y 0–1, so an ordinary standable tile is one step from three of them with a
     * sealed panel in between (§ 6 rules 17–18). `talkTileFor` draws the same
     * line for the same reason — this asserts they agree.
     */
    expect(isStandableTile(INSIDE_THE_GLASS)).toBe(true);
    expect(dwellTargetAt(INSIDE_THE_GLASS, {})).toBeNull();
  });

  it('still finds a reachable colleague standing among executives', () => {
    // (6, 1) is beside Bryce *and* two executives. The exclusion is per person,
    // not "give up on this tile".
    expect(dwellTargetAt({ x: 6, y: 1 }, {})?.colleagueId).toBe('scrumMaster');
  });

  it('breaks ties the same way every time', () => {
    /*
     * In the pod you are regularly within a tile of three people. A random pick
     * would let the speaker change on an unrelated re-render — the same beat,
     * credited to somebody else, for no reason you could see.
     */
    const first = dwellTargetAt(BESIDE_THE_POD, {});
    expect(first?.colleagueId).toBe('gilfoyle');
    expect(dwellTargetAt(BESIDE_THE_POD, {})).toEqual(first);
  });

  it('says null for somebody in their own chair, and a tile for somebody who is not', () => {
    /*
     * `whereaboutsOf`'s convention, kept on purpose: `FloorDeskSpeech` picks the
     * over-seat lift from the *absence* of a tile, so resolving a seat position
     * here would float every seated colleague's balloon a tile above their head
     * (§ 6 rules 15 and 20).
     */
    expect(dwellTargetAt(BESIDE_JARED, {})?.at).toBeNull();

    /*
     * The kitchen, not the whiteboard, and the difference is worth recording:
     * every tile beside the whiteboard mark is also beside a pod desk, and at
     * equal distance the seat order wins — so at the board it is Gilfoyle who
     * looks up, not the person stood at it. Dwelling on somebody who is away
     * from their desk is reachable at the coffee machine and the printer, whose
     * marks have a clear side.
     */
    const machine = propTileFor('coffeeMachine');
    const wanderer = { seatId: 'intern', kind: 'coffeeMachine', to: machine, phase: 'dwell' };
    const beside = { x: machine.x, y: machine.y - 1 };
    expect(dwellTargetAt(beside, { wanderer })?.colleagueId).toBe('intern');
    expect(dwellTargetAt(beside, { wanderer })?.at).toEqual(machine);
  });

  it('ignores somebody crossing the room, and somebody a moment has taken', () => {
    const machine = propTileFor('coffeeMachine');
    const beside = { x: machine.x, y: machine.y - 1 };

    // Mid-stride: somebody walking past you is not somebody you are stood next
    // to, and `whereaboutsOf` already refuses to place them.
    const walking = { seatId: 'intern', kind: 'coffeeMachine', to: machine, phase: 'out' };
    expect(dwellTargetAt(beside, { wanderer: walking })?.colleagueId).not.toBe('intern');

    // § 6 rule 5: a scene is already drawing them, with chrome of its own.
    const seat = seatFor('jared');
    expect(
      dwellTargetAt(BESIDE_JARED, { awayIds: ['jared'] })?.colleagueId,
      `${seat.id} was claimed`
    ).not.toBe('jared');
  });
});

describe('finding the line they broke the silence with', () => {
  /*
   * `channel: 'talk'` because a dwell remark is answered out loud — `remarkTo`
   * pushes on the talk channel. It was implicit while `dwellLineFrom` filtered
   * on the timestamp alone; it is explicit now that the medium rule is enforced
   * too, and a fixture without it is a typed Slop Chat™ message that the office
   * must refuse to speak (`officeVoiceMedium.test.jsx`).
   */
  const msg = (over) => ({
    colleagueId: 'jared',
    body: 'Morning.',
    channel: 'talk',
    createdAt: 1_000,
    ...over
  });

  it('ignores anything older than the remark', () => {
    /*
     * The whole reason this is not `lastInboundFrom`. Walk up to somebody you
     * traded messages with an hour ago and their old line would otherwise appear
     * over their head the moment you got near, as though they had just said it.
     */
    const history = [msg({ createdAt: 500, body: 'From earlier.' })];
    expect(dwellLineFrom(history, { colleagueId: 'jared', at: 1_000 })).toBe('');
  });

  it('takes the newest inbound line from that colleague', () => {
    const history = [
      msg({ createdAt: 500, body: 'From earlier.' }),
      msg({ createdAt: 1_200, body: 'Did you need something?' })
    ];
    expect(dwellLineFrom(history, { colleagueId: 'jared', at: 1_000 })).toBe(
      'Did you need something?'
    );
  });

  it('never quotes you back at yourself, or somebody else', () => {
    const history = [
      msg({ createdAt: 1_200, body: 'Hello?', outbound: true }),
      msg({ createdAt: 1_300, colleagueId: 'russ', body: 'Bold of you.' })
    ];
    expect(dwellLineFrom(history, { colleagueId: 'jared', at: 1_000 })).toBe('');
    expect(dwellLineFrom([], { colleagueId: 'jared', at: 1_000 })).toBe('');
    expect(dwellLineFrom(history, null)).toBe('');
  });
});

describe('loitering, on a real floor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    /*
     * **Ambient traffic was leaking into a suite that is not about traffic.**
     * `renderFloor` mounts the whole floor, so `useFloorWander` sends somebody
     * out on an unstubbed `Math.random()` — which means these tests shared one
     * PRNG stream across the *file*, and any change anywhere that consumed a
     * different number of randoms re-rolled who was up and where. Slice 23
     * consumed one fewer (an overheard exchange no longer re-rolls its pair
     * after it has played) and "re-arms when you leave and come back" went red
     * with a wanderer standing in a place it had never had one — passing alone,
     * failing in file order, which is the signature of this class.
     *
     * Pinned rather than made reduced-motion: the tests want a *populated* room,
     * they only want the same one every run. Same lesson as § 8's clock finding
     * — a floor test that mounts is at the mercy of an input it never named.
     */
    vi.spyOn(Math, 'random').mockReturnValue(0.75);
  });

  /** Walk to a tile by clicking the roam surface, the way a player would. */
  function walkTo(tile) {
    const { left, top } = projectIso(tile.x, tile.y);
    fireEvent.click(screen.getByTestId('office-floor-roam'), { clientX: left, clientY: top });
  }

  it('gets you a word once you stop moving and stay', () => {
    const onDwellRemark = vi.fn();
    renderFloor({ onDwellRemark });

    walkTo(BESIDE_JARED);
    expect(onDwellRemark).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(DWELL_MS));
    expect(onDwellRemark).toHaveBeenCalledWith('jared');
  });

  it('says it once, however long you stand there', () => {
    // A repeating timer would turn a colleague into a car alarm, which is worse
    // than silence: a surface people mute is not there for the beat that mattered.
    const onDwellRemark = vi.fn();
    renderFloor({ onDwellRemark });

    walkTo(BESIDE_JARED);
    act(() => vi.advanceTimersByTime(DWELL_MS * 6));
    expect(onDwellRemark).toHaveBeenCalledTimes(1);
  });

  it('never fires for somebody you only walked past', () => {
    const onDwellRemark = vi.fn();
    renderFloor({ onDwellRemark });

    walkTo(BESIDE_JARED);
    act(() => vi.advanceTimersByTime(DWELL_MS - 1_000));
    walkTo(BESIDE_THE_POD);
    act(() => vi.advanceTimersByTime(DWELL_MS));

    // Arriving somewhere is not loitering: the clock restarts on whoever you are
    // next to now, and Jared never got to the end of his.
    expect(onDwellRemark).toHaveBeenCalledTimes(1);
    expect(onDwellRemark).toHaveBeenCalledWith('gilfoyle');
  });

  it('re-arms when you leave and come back', async () => {
    const onDwellRemark = vi.fn();
    renderFloor({ onDwellRemark });

    walkTo(BESIDE_JARED);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DWELL_MS);
    });
    walkTo(BESIDE_THE_POD);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DWELL_MS);
    });
    walkTo(BESIDE_JARED);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DWELL_MS);
    });

    expect(onDwellRemark.mock.calls.map(([id]) => id)).toEqual(['jared', 'gilfoyle', 'jared']);
  });

  it('stays quiet when you are stood on your own', () => {
    const onDwellRemark = vi.fn();
    renderFloor({ onDwellRemark });

    walkTo(BESIDE_NOBODY);
    act(() => vi.advanceTimersByTime(DWELL_MS * 3));
    expect(onDwellRemark).not.toHaveBeenCalled();
  });

  it('cannot be made to loiter inside the fishbowl at all', () => {
    /*
     * The `senior` exclusion never even gets a turn here, which is the more
     * reassuring fact: clicking a tile inside the glass does not put you on it
     * (§ 6 rule 17 — the room's answer to "may I go there" is the snap), so
     * loitering among the executives is unreachable rather than merely refused.
     */
    const onDwellRemark = vi.fn();
    renderFloor({ onDwellRemark });

    walkTo(INSIDE_THE_GLASS);
    const { left, top } = projectIso(INSIDE_THE_GLASS.x, INSIDE_THE_GLASS.y);
    expect(screen.getByTestId('office-floor-player').style.transform).not.toBe(
      `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`
    );

    act(() => vi.advanceTimersByTime(DWELL_MS * 3));
    // Somebody outside the glass may well have looked up — what must not happen
    // is an executive doing it.
    for (const [id] of onDwellRemark.mock.calls) {
      expect(['belson', 'cfo', 'ciso', 'barker']).not.toContain(id);
    }
  });

  it('puts their answer over their head, and not a word they said earlier', () => {
    /*
     * The remark lands in `imHistory` like every other line the cast says
     * (ADR-0011 rule 1 — the floor renders shared state, it does not own it), so
     * this drives the real round trip: fire, then let the line arrive.
     *
     * Pin the fake clock: `useFloorDwell` stamps `spoke.at` with Date.now() when
     * the timer fires, and `dwellLineFrom` rejects anything older than that mark.
     * Calling Date.now() again outside the same act tick can land *before* the
     * mark on slower CI runners, so derive the inbound line's `createdAt` from the
     * same frozen timeline instead.
     */
    vi.setSystemTime(1_000);
    const onDwellRemark = vi.fn();
    const stale = [
      { id: 'old', colleagueId: 'jared', body: 'Said an hour ago.', createdAt: 0, channel: 'talk' }
    ];
    const view = renderFloor({ onDwellRemark, imHistory: stale });

    walkTo(BESIDE_JARED);
    // Standing there with only old scrollback: nothing is put over his head.
    expect(screen.queryByTestId('office-floor-dwell-line')).toBeNull();

    act(() => vi.advanceTimersByTime(DWELL_MS));
    expect(onDwellRemark).toHaveBeenCalledWith('jared');
    expect(screen.queryByTestId('office-floor-dwell-line')).toBeNull();

    const remarkAt = 1_000 + DWELL_MS;
    const arrived = [
      ...stale,
      {
        id: 'new',
        colleagueId: 'jared',
        body: 'Did you need something, or…?',
        createdAt: remarkAt,
        channel: 'talk'
      }
    ];
    act(() => view.rerender(<OfficeFloor onDwellRemark={onDwellRemark} imHistory={arrived} />));

    const bubble = screen.getByTestId('office-floor-dwell-line');
    expect(bubble.textContent).toContain('Did you need something');
    expect(bubble.textContent).not.toContain('Said an hour ago');
    // § 6 rule 20: he is in his own chair, so the balloon takes the seat lift.
    expect(bubble.querySelector('.office-floor-walker-anchor--over-seat')).toBeTruthy();
  });

  it('does not interrupt a conversation you opened on purpose', () => {
    /*
     * `standingFree` is the gate, and it is the honest definition of loitering:
     * a card open is a *reason* to be stood there, and that surface speaks for
     * itself. Without this you would get a second, unrelated line on top of the
     * one you walked over for.
     */
    const onDwellRemark = vi.fn();
    renderFloor({ onDwellRemark, onTalkGreet: vi.fn() });

    fireEvent.click(screen.getByRole('button', { name: /Jared/i }));
    act(() => vi.advanceTimersByTime(DWELL_MS * 3));
    expect(onDwellRemark).not.toHaveBeenCalled();
  });
});

afterEach(cleanup);
