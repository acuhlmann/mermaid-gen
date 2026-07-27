// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SAMPLED_CUES,
  _resetCueSamplesForTests,
  playCueSample
} from '../src/utils/officeCueSamples.js';

function createAudioStubs({ withPanner = true } = {}) {
  const sources = [];
  const gains = [];
  const panners = [];
  const context = {
    currentTime: 0,
    destination: {},
    decodeAudioData: vi.fn(() => Promise.resolve({ duration: 2, sampleRate: 44100 })),
    createGain: vi.fn(() => {
      const node = { gain: { value: 0 }, connect: vi.fn(), context };
      gains.push(node);
      return node;
    }),
    createBufferSource: vi.fn(() => {
      const node = {
        buffer: null,
        playbackRate: { value: 1 },
        connect: vi.fn(),
        start: vi.fn()
      };
      sources.push(node);
      return node;
    })
  };
  if (withPanner) {
    context.createStereoPanner = vi.fn(() => {
      const node = { pan: { value: 0 }, connect: vi.fn() };
      panners.push(node);
      return node;
    });
  }
  globalThis.AudioContext = vi.fn(function MockAudioContext() {
    return context;
  });
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })
  );
  return { context, sources, gains, panners };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

let stubs;
let ref;

beforeEach(() => {
  stubs = createAudioStubs();
  ref = { current: null };
  _resetCueSamplesForTests();
});

afterEach(() => {
  _resetCueSamplesForTests();
  delete globalThis.AudioContext;
  delete globalThis.fetch;
  vi.restoreAllMocks();
});

describe('officeCueSamples', () => {
  it('only claims the cues that synthesis actually loses on', () => {
    expect(SAMPLED_CUES).toEqual(
      expect.arrayContaining([
        'keyboard',
        'paper',
        'chair',
        'printer',
        'watercooler',
        'espresso',
        'vending'
      ])
    );
    // Tones stay synthesized — synthesis is the right tool for a bell or a click.
    expect(SAMPLED_CUES).not.toContain('elevator');
    expect(SAMPLED_CUES).not.toContain('phone');
    expect(SAMPLED_CUES).not.toContain('mouse');
  });

  it('defers to the synth cue on the first play, then plays the sample', async () => {
    // First call can only start the download — the caller falls back to synth.
    expect(playCueSample('keyboard', ref)).toBe(false);
    expect(stubs.sources).toHaveLength(0);

    await settle();

    expect(playCueSample('keyboard', ref)).toBe(true);
    expect(stubs.sources).toHaveLength(1);
    expect(stubs.sources[0].start).toHaveBeenCalled();
  });

  it('never asks a cue it has no sample for', () => {
    expect(playCueSample('elevator', ref)).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('varies rate and gain per play so a repeat does not sound identical', async () => {
    playCueSample('keyboard', ref);
    await settle();

    const randoms = [0, 1];
    for (const r of randoms) playCueSample('keyboard', ref, () => r);

    expect(stubs.sources[0].playbackRate.value).toBeLessThan(1);
    expect(stubs.sources[1].playbackRate.value).toBeGreaterThan(1);
    expect(stubs.gains[0].gain.value).toBeLessThan(stubs.gains[1].gain.value);
  });

  it('boosts gain and centres the pan when you are standing at the source', async () => {
    playCueSample('printer', ref);
    await settle();

    playCueSample('printer', ref, () => 0.5, { near: true });
    playCueSample('printer', ref, () => 0.5);

    expect(stubs.gains[0].gain.value).toBeGreaterThan(stubs.gains[1].gain.value);
    // Near plays skip the panner entirely so the source is in front of you.
    expect(stubs.panners).toHaveLength(1);
  });

  it('places set pieces across the room but keeps desk textures centred', async () => {
    playCueSample('printer', ref);
    playCueSample('keyboard', ref);
    await settle();

    playCueSample('printer', ref, () => 1); // hard right
    playCueSample('keyboard', ref, () => 1);

    const [printerPan, keyboardPan] = stubs.panners.map((p) => Math.abs(p.pan.value));
    expect(printerPan).toBeGreaterThan(keyboardPan);
  });

  it('still plays where the browser has no StereoPanner', async () => {
    _resetCueSamplesForTests();
    stubs = createAudioStubs({ withPanner: false });
    playCueSample('printer', ref);
    await settle();

    expect(playCueSample('printer', ref)).toBe(true);
    expect(stubs.sources).toHaveLength(1);
  });

  it('falls back to synth forever when the asset cannot be fetched', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false }));
    expect(playCueSample('espresso', ref)).toBe(false);
    await settle();
    expect(playCueSample('espresso', ref)).toBe(false);
    expect(stubs.sources).toHaveLength(0);
  });

  it('falls back to synth where there is no Web Audio at all', () => {
    delete globalThis.AudioContext;
    expect(playCueSample('keyboard', { current: null })).toBe(false);
  });
});
