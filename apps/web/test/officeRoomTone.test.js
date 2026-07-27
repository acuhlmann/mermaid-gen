// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ROOM_TONE_DUCK_GAIN,
  ROOM_TONE_GAIN,
  _resetRoomToneForTests,
  duckRoomTone,
  isRoomTonePlaying,
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
  it('loops the bed and fades it in at the bed level', async () => {
    startRoomTone(audioContextRef);
    await settle();

    const [source] = stubs.sources;
    expect(source.loop).toBe(true);
    expect(source.start).toHaveBeenCalled();
    expect(stubs.gainParam.linearRampToValueAtTime).toHaveBeenCalledWith(
      ROOM_TONE_GAIN,
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
      ROOM_TONE_GAIN,
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
