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

  it('fetches every variant of a multi-take cue', async () => {
    playCueSample('keyboard', ref);
    await settle();
    // keyboard has a second take because it fires ~4x more than anything else.
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('plays a decoded variant rather than rolling and hoping', async () => {
    // Only take A resolves; take B never does. Rolling first and checking
    // second would fall back to synthesis half the time for no reason.
    let call = 0;
    globalThis.fetch = vi.fn(() => {
      call += 1;
      return call === 1
        ? Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })
        : Promise.resolve({ ok: false });
    });

    playCueSample('keyboard', ref);
    await settle();

    // Every roll, including the one that would have picked take B.
    for (const roll of [0, 0.5, 0.99]) {
      expect(playCueSample('keyboard', ref, () => roll)).toBe(true);
    }
  });

  it('honours an explicit pan, so a walker is heard where they are', async () => {
    playCueSample('printer', ref);
    await settle();

    // `random` would place this hard right; the caller's pan must win.
    playCueSample('printer', ref, () => 1, { pan: -0.6 });
    expect(stubs.panners.at(-1).pan.value).toBeCloseTo(-0.6, 6);
  });

  it('clamps a pan into range instead of trusting the caller', async () => {
    playCueSample('printer', ref);
    await settle();

    playCueSample('printer', ref, () => 0.5, { pan: -9 });
    expect(stubs.panners.at(-1).pan.value).toBe(-1);
    playCueSample('printer', ref, () => 0.5, { pan: Number.NaN });
    // Not a number at all → fall back to the random placement, not to a throw.
    expect(Number.isFinite(stubs.panners.at(-1).pan.value)).toBe(true);
  });

  it('centres a near play even when a pan was passed', async () => {
    // Standing at the machine is centred by definition; a caller that supplies
    // both is describing where the *thing* is, not where you are.
    playCueSample('printer', ref);
    await settle();

    playCueSample('printer', ref, () => 0.5, { near: true, pan: 0.9 });
    expect(stubs.panners).toHaveLength(0);
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
