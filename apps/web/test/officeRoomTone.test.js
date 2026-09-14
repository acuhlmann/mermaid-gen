// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ROOM_TONE_DUCK_GAIN,
  ROOM_TONE_GAIN_DESK,
  ROOM_TONE_GAIN_FLOOR,
  ROOM_TONE_OCCUPANCY_FLOOR,
  warmRoomTone,
  _resetRoomToneForTests,
  duckRoomTone,
  getRoomToneOccupancy,
  isRoomTonePlaying,
  setRoomToneOccupancy,
  setRoomToneViewMode,
  startRoomTone,
  stopRoomTone,
  unduckRoomTone
} from '../src/utils/officeRoomTone.js';

const BUFFER_DURATION = 30;

function createAudioStubs() {
  const gainParam = {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn()
  };
  const sources = [];
  const context = {
    currentTime: 0,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    decodeAudioData: vi.fn(() => Promise.resolve({ duration: BUFFER_DURATION, sampleRate: 44100 })),
    createGain: vi.fn(() => ({ gain: gainParam, connect: vi.fn(), context })),
    createBufferSource: vi.fn(() => {
      const source = {
        buffer: null,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      };
      sources.push(source);
      return source;
    })
  };
  globalThis.AudioContext = vi.fn(function MockAudioContext() {
    return context;
  });
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })
  );
  return { context, gainParam, sources };
}

/**
 * Drain the whole fetch → arrayBuffer → decode → schedule chain. A macrotask
 * runs after every pending microtask, so this settles regardless of how many
 * links the chain has.
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

let stubs;
let audioContextRef;

beforeEach(() => {
  stubs = createAudioStubs();
  audioContextRef = { current: null };
  _resetRoomToneForTests();
});

afterEach(() => {
  _resetRoomToneForTests();
  delete globalThis.AudioContext;
  delete globalThis.fetch;
  vi.restoreAllMocks();
});

describe('officeRoomTone', () => {
  it('preloads the bed without starting playback', async () => {
    warmRoomTone(audioContextRef);
    await settle();
    expect(globalThis.fetch).toHaveBeenCalled();
    expect(isRoomTonePlaying()).toBe(false);

    startRoomTone(audioContextRef);
    await settle();
    expect(isRoomTonePlaying()).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('loops the bed and fades it in at the bed level', async () => {
    startRoomTone(audioContextRef);
    await settle();

    const [source] = stubs.sources;
    expect(source.loop).toBe(true);
    expect(source.start).toHaveBeenCalled();
    expect(stubs.gainParam.linearRampToValueAtTime).toHaveBeenCalledWith(
      ROOM_TONE_GAIN_DESK,
      expect.any(Number)
    );
    expect(isRoomTonePlaying()).toBe(true);
  });

  it('keeps the loop inside the buffer edges so MP3 encoder delay cannot click', async () => {
    startRoomTone(audioContextRef);
    await settle();

    const [source] = stubs.sources;
    expect(source.loopStart).toBeGreaterThan(0);
    expect(source.loopEnd).toBeLessThan(BUFFER_DURATION);
    // The first pass must begin inside the loop region, not at sample zero.
    expect(source.start).toHaveBeenCalledWith(expect.any(Number), source.loopStart);
  });

  it('is idempotent — a second start does not stack a second loop', async () => {
    startRoomTone(audioContextRef);
    await settle();
    startRoomTone(audioContextRef);
    await settle();

    expect(stubs.sources).toHaveLength(1);
  });

  it('does not leave a stray loop when a stop lands mid-decode', async () => {
    startRoomTone(audioContextRef);
    stopRoomTone(); // user hit Focus Time before the fetch resolved
    await settle();

    expect(stubs.sources).toHaveLength(0);
    expect(isRoomTonePlaying()).toBe(false);
  });

  it('ducks under narration and comes back up afterwards', async () => {
    startRoomTone(audioContextRef);
    await settle();
    stubs.gainParam.linearRampToValueAtTime.mockClear();

    duckRoomTone();
    expect(stubs.gainParam.linearRampToValueAtTime).toHaveBeenCalledWith(
      ROOM_TONE_DUCK_GAIN,
      expect.any(Number)
    );

    unduckRoomTone();
    expect(stubs.gainParam.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      ROOM_TONE_GAIN_DESK,
      expect.any(Number)
    );
  });

  it('ramps the bed louder on the isometric floor than at the desk', async () => {
    startRoomTone(audioContextRef);
    await settle();
    stubs.gainParam.linearRampToValueAtTime.mockClear();

    setRoomToneViewMode('floor');

    expect(stubs.gainParam.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      ROOM_TONE_GAIN_FLOOR,
      expect.any(Number)
    );
  });

  it('stops by fading out rather than cutting the loop dead', async () => {
    startRoomTone(audioContextRef);
    await settle();

    stopRoomTone();

    const [source] = stubs.sources;
    expect(stubs.gainParam.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      expect.any(Number),
      expect.any(Number)
    );
    expect(source.stop).toHaveBeenCalledWith(expect.any(Number));
    expect(isRoomTonePlaying()).toBe(false);
  });

  it('stays a silent no-op where there is no Web Audio at all', async () => {
    delete globalThis.AudioContext;
    startRoomTone({ current: null });
    await settle();

    expect(isRoomTonePlaying()).toBe(false);
    expect(() => stopRoomTone()).not.toThrow();
    expect(() => duckRoomTone()).not.toThrow();
  });

  it('survives a missing bed asset without breaking the office', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false }));
    startRoomTone(audioContextRef);
    await settle();

    expect(isRoomTonePlaying()).toBe(false);
    expect(stubs.sources).toHaveLength(0);
  });
});

describe('the bed thins out in an emptier room (queue 8)', () => {
  it('starts at the level it was mixed at and calls that a full room', () => {
    expect(getRoomToneOccupancy()).toBe(1);
  });

  /*
   * Exactly, not approximately. `0.55 + 0.45 * 1` is 0.9999999999999999 in
   * binary floating point, so a formula without the early return would put the
   * bed a hair off its own published constant for the whole working day.
   */
  it('is byte-identical to the pre-occupancy level in a full room', async () => {
    startRoomTone(audioContextRef);
    await settle();
    stubs.gainParam.linearRampToValueAtTime.mockClear();

    setRoomToneOccupancy(1);
    expect(stubs.gainParam.linearRampToValueAtTime).not.toHaveBeenCalled();

    setRoomToneOccupancy(0.5);
    setRoomToneOccupancy(1);
    expect(stubs.gainParam.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      ROOM_TONE_GAIN_DESK,
      expect.any(Number)
    );
  });

  it('pulls the bed down for an office nobody is in', async () => {
    startRoomTone(audioContextRef);
    await settle();
    stubs.gainParam.linearRampToValueAtTime.mockClear();

    setRoomToneOccupancy(0.15);

    const [level] = stubs.gainParam.linearRampToValueAtTime.mock.lastCall;
    expect(level).toBeLessThan(ROOM_TONE_GAIN_DESK);
    expect(level).toBeGreaterThan(ROOM_TONE_GAIN_DESK * ROOM_TONE_OCCUPANCY_FLOOR * 0.99);
  });

  /*
   * A room that empties is not a room that disappears — there is still a
   * building around you. Silence here would be a different bug.
   */
  it('never fades the room to nothing, even at zero', async () => {
    startRoomTone(audioContextRef);
    await settle();
    stubs.gainParam.linearRampToValueAtTime.mockClear();

    setRoomToneOccupancy(0);

    const [level] = stubs.gainParam.linearRampToValueAtTime.mock.lastCall;
    expect(level).toBeCloseTo(ROOM_TONE_GAIN_DESK * ROOM_TONE_OCCUPANCY_FLOOR, 10);
    expect(level).toBeGreaterThan(0);
  });

  it('composes with the view gain rather than replacing it', async () => {
    startRoomTone(audioContextRef);
    await settle();
    setRoomToneOccupancy(0);
    stubs.gainParam.linearRampToValueAtTime.mockClear();

    setRoomToneViewMode('floor');

    const [level] = stubs.gainParam.linearRampToValueAtTime.mock.lastCall;
    expect(level).toBeCloseTo(ROOM_TONE_GAIN_FLOOR * ROOM_TONE_OCCUPANCY_FLOOR, 10);
    expect(level).toBeLessThan(ROOM_TONE_GAIN_FLOOR);
    // Still louder on the floor than at the desk — the two dials are independent.
    expect(level).toBeGreaterThan(ROOM_TONE_GAIN_DESK * ROOM_TONE_OCCUPANCY_FLOOR);
  });

  it('comes back up to the thinned level after narration, not to the full one', async () => {
    startRoomTone(audioContextRef);
    await settle();
    setRoomToneOccupancy(0);

    duckRoomTone();
    // The duck thins with the room it ducks — the case above pins the ratio.
    expect(stubs.gainParam.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      ROOM_TONE_DUCK_GAIN * ROOM_TONE_OCCUPANCY_FLOOR,
      expect.any(Number)
    );

    unduckRoomTone();
    const [level] = stubs.gainParam.linearRampToValueAtTime.mock.lastCall;
    expect(level).toBeCloseTo(ROOM_TONE_GAIN_DESK * ROOM_TONE_OCCUPANCY_FLOOR, 10);
  });

  /*
   * The duck is a *cut*, not a level.
   *
   * 0.03 under a 0.055 desk bed is the ~45% dip narration was mixed against;
   * `ROOM_TONE_DUCK_GAIN`'s own comment is "so narration stays intelligible".
   * The occupancy dial thins the un-ducked bed and, before this was pinned,
   * left the duck at its absolute value — so the two levels converged as the
   * room emptied. At `afterHours` occupancy (0.15, reachable every evening)
   * the desk bed is 0.034 and an absolute 0.03 duck is an 11.7% dip instead
   * of 45.5%: a colleague speaks at 20:00 and the room does not get out of
   * the way. Below a 0.5454 floor the duck would have gone *louder* than the
   * bed it ducks.
   *
   * Asserting the ratio rather than the level is the point — the cut is the
   * thing that was tuned, and it has to survive every cell of the dial.
   */
  it('ducks by the same proportion in a thin room as in a full one', async () => {
    startRoomTone(audioContextRef);
    await settle();

    const cells = [];
    for (const [view, viewBase] of [
      ['desk', ROOM_TONE_GAIN_DESK],
      ['floor', ROOM_TONE_GAIN_FLOOR]
    ]) {
      for (const occupancy of [1, 0.15, 0]) {
        setRoomToneViewMode(view);
        setRoomToneOccupancy(occupancy);
        unduckRoomTone();
        const [base] = stubs.gainParam.linearRampToValueAtTime.mock.lastCall;

        duckRoomTone();
        const [ducked] = stubs.gainParam.linearRampToValueAtTime.mock.lastCall;
        unduckRoomTone();

        cells.push({ view, occupancy, base, ducked, cut: ducked / base });
        // The dip narration was tuned against, unchanged by how full the room is.
        expect(cells.at(-1).cut).toBeCloseTo(ROOM_TONE_DUCK_GAIN / viewBase, 10);
        // And never the inversion: ducking can only ever go down.
        expect(ducked).toBeLessThan(base);
      }
    }

    // A sweep over an empty set would pass while examining nothing.
    expect(cells).toHaveLength(6);
  });

  it('clamps nonsense to a full room and never throws without a bed', () => {
    setRoomToneOccupancy(9);
    expect(getRoomToneOccupancy()).toBe(1);
    setRoomToneOccupancy(-4);
    expect(getRoomToneOccupancy()).toBe(0);
    setRoomToneOccupancy(Number.NaN);
    expect(getRoomToneOccupancy()).toBe(1);
    expect(() => setRoomToneOccupancy(0.3)).not.toThrow();
  });
});
