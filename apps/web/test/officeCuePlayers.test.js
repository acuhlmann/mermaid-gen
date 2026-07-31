import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SYNTH_CUES,
  cuesForProp,
  officeCueChime,
  playOfficeCue,
  playPropCues
} from '../src/utils/officeCuePlayers.js';
import { SAMPLED_CUES, _resetCueSamplesForTests } from '../src/utils/officeCueSamples.js';
import { FLOOR_PROP_USES } from '../src/utils/officeFloorProps.js';
import { SOUNDSCAPE_CUES } from '../src/utils/officeSoundscape.js';

afterEach(() => {
  _resetCueSamplesForTests();
  vi.restoreAllMocks();
});

describe('cuesForProp', () => {
  it('plays printer then paper when you walk up to the printer', () => {
    expect(cuesForProp('printer')).toEqual([
      { cue: 'printer', near: true },
      { cue: 'paper', near: true, delayMs: 1_600 }
    ]);
  });

  it('plays kitchen watercooler before espresso (floor auto-accepts the break)', () => {
    expect(cuesForProp('coffeeMachine')).toEqual([{ cue: 'watercooler', near: true }]);
  });

  it('maps the water cooler even though it is scenery-only today', () => {
    expect(cuesForProp('waterCooler')).toEqual([{ cue: 'watercooler', near: true }]);
  });

  it('squeaks a marker at the whiteboard — the usable prop that had no row', () => {
    expect(cuesForProp('whiteboard')).toEqual([{ cue: 'whiteboard', near: true }]);
  });

  it('is silent for scenery', () => {
    // `plant` is not in FLOOR_PROP_USES, so you can never stand at it. Scenery
    // staying silent is what keeps the four usable props worth walking to.
    expect(cuesForProp('plant')).toEqual([]);
    expect(cuesForProp('fridge')).toEqual([]);
  });

  it('gives every usable prop a cue', () => {
    // The gap this closed was invisible: whiteboard had been reachable since
    // slice 9 and silent the whole time, because nothing checked the two lists
    // against each other.
    for (const { kind } of FLOOR_PROP_USES) {
      expect(cuesForProp(kind).length, `${kind} has no cue`).toBeGreaterThan(0);
    }
  });
});

describe('every cue can actually make a sound', () => {
  it('gives each scheduled cue a synth player', () => {
    // The fallback table is what makes sampling best-effort. A cue the brain
    // can schedule but the table has no row for is silent on every play until
    // its buffer decodes — and for a one-shot like the door, that is the only
    // play there is.
    for (const cue of SOUNDSCAPE_CUES) {
      expect(SYNTH_CUES, `${cue} has no synth fallback`).toContain(cue);
    }
  });

  it('gives each sampled cue a synth player too', () => {
    for (const cue of SAMPLED_CUES) {
      expect(SYNTH_CUES, `${cue} has no synth fallback`).toContain(cue);
    }
  });
});

describe('playPropCues', () => {
  it('fires the immediate cue and schedules the follow-up', () => {
    vi.useFakeTimers();
    const playChime = vi.fn();
    const cancel = playPropCues('printer', playChime);
    expect(playChime).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1_600);
    expect(playChime).toHaveBeenCalledTimes(2);
    cancel();
    vi.useRealTimers();
  });

  it('no-ops without a playChime gate', () => {
    expect(() => playPropCues('printer', undefined)()).not.toThrow();
  });
});

describe('playOfficeCue', () => {
  it('falls back to the synth player when no sample is ready', () => {
    const context = {
      currentTime: 0,
      destination: {},
      createOscillator: vi.fn(() => ({
        type: 'sine',
        frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
        detune: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      })),
      createGain: vi.fn(() => ({
        gain: {
          value: 0,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn()
        },
        connect: vi.fn()
      })),
      createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(8) })),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        loop: false,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      })),
      createBiquadFilter: vi.fn(() => ({
        type: 'bandpass',
        frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
        Q: { setValueAtTime: vi.fn() },
        connect: vi.fn()
      })),
      sampleRate: 44100
    };
    globalThis.AudioContext = vi.fn(function MockAudioContext() {
      return context;
    });
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })
    );

    expect(() => playOfficeCue('keyboard', { current: null })).not.toThrow();
    expect(() => officeCueChime('printer', { near: true })({ current: null })).not.toThrow();

    delete globalThis.AudioContext;
    delete globalThis.fetch;
  });
});
