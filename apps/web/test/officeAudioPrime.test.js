// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onOfficeAudioGateOpen, primeOfficeAudio } from '../src/utils/officeAudioPrime.js';
import { warmAllCueSamples } from '../src/utils/officeCueSamples.js';

vi.mock('../src/utils/officeCueSamples.js', () => ({
  warmAllCueSamples: vi.fn()
}));

const { getContext } = vi.hoisted(() => ({
  getContext: vi.fn(() => ({ resume: vi.fn(() => Promise.resolve()) }))
}));

vi.mock('../src/utils/agentChimes.js', () => ({
  getContext
}));

describe('officeAudioPrime', () => {
  let audioContextRef;
  let hasInteractedRef;

  beforeEach(() => {
    audioContextRef = { current: null };
    hasInteractedRef = { current: false };
    warmAllCueSamples.mockClear();
    getContext.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens the gate, warms samples, and notifies listeners once', () => {
    const listener = vi.fn();
    const unsubscribe = onOfficeAudioGateOpen(listener);

    expect(primeOfficeAudio(audioContextRef, hasInteractedRef)).toBe(true);
    expect(hasInteractedRef.current).toBe(true);
    expect(warmAllCueSamples).toHaveBeenCalledWith(audioContextRef);
    expect(listener).toHaveBeenCalledTimes(1);

    primeOfficeAudio(audioContextRef, hasInteractedRef);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
