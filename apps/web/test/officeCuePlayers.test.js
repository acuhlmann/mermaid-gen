import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cuesForProp,
  officeCueChime,
  playOfficeCue,
  playPropCues
} from '../src/utils/officeCuePlayers.js';
import { _resetCueSamplesForTests } from '../src/utils/officeCueSamples.js';

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

  it('leaves coffee to the accept SFX (floor auto-accepts the break)', () => {
    expect(cuesForProp('coffeeMachine')).toEqual([]);
  });

  it('maps the water cooler even though it is scenery-only today', () => {
    expect(cuesForProp('waterCooler')).toEqual([{ cue: 'watercooler', near: true }]);
  });

  it('is silent for props with no diegetic sound', () => {
    expect(cuesForProp('whiteboard')).toEqual([]);
    expect(cuesForProp('plant')).toEqual([]);
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
