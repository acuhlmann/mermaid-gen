import { describe, expect, it } from 'vitest';
import { resolveMetaphorMotionPolicy } from '../src/components/metaphorScenes/metaphorMotionPolicy.js';

describe('resolveMetaphorMotionPolicy', () => {
  it('animates authored semantic motion normally', () => {
    expect(
      resolveMetaphorMotionPolicy({
        streamingPreview: false,
        reducedMotion: false,
        motionIntensity: 0.72
      })
    ).toEqual({ animated: true, intensity: 0.72, frozen: false });
  });

  it('keeps intensity for a meaningful reduced-motion frozen pose', () => {
    expect(
      resolveMetaphorMotionPolicy({
        streamingPreview: false,
        reducedMotion: true,
        motionIntensity: 0.72
      })
    ).toEqual({ animated: false, intensity: 0.72, frozen: true });
  });

  it('removes movement and displacement during streaming preview', () => {
    expect(
      resolveMetaphorMotionPolicy({
        streamingPreview: true,
        reducedMotion: false,
        motionIntensity: 1
      })
    ).toEqual({ animated: false, intensity: 0, frozen: true });
  });
});
