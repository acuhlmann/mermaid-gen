import { describe, expect, it } from 'vitest';
import { applyMoodToTheme } from '../src/utils/metaphorMoods.js';
import { resolveMetaphorThemePreset } from '../src/utils/metaphorThemePresets.js';

describe('applyMoodToTheme', () => {
  const base = resolveMetaphorThemePreset('whiteboard');

  it('returns the theme unchanged for day, null, and unknown moods', () => {
    expect(applyMoodToTheme(base, 'day')).toBe(base);
    expect(applyMoodToTheme(base, null)).toBe(base);
    expect(applyMoodToTheme(base, undefined)).toBe(base);
    expect(applyMoodToTheme(base, 'vaporwave')).toBe(base);
  });

  it('re-tints sky, light, and background for a full-strength mood', () => {
    const themed = applyMoodToTheme(base, 'night');
    expect(themed).not.toBe(base);
    expect(themed.skyTopColor).not.toBe(base.skyTopColor);
    expect(themed.skyHorizonColor).not.toBe(base.skyHorizonColor);
    expect(themed.directional.color).toBe('#8fb2e8');
    expect(themed.directional.intensity).toBeCloseTo(base.directional.intensity * 0.5, 5);
    expect(themed.ambientIntensity).toBeCloseTo(base.ambientIntensity * 0.62, 5);
    // Base theme keys survive the overlay.
    expect(themed.buildingColor).toBe(base.buildingColor);
  });

  it('attaches moodFx with haze and a particle descriptor', () => {
    const storm = applyMoodToTheme(base, 'storm');
    // Haze is a fraction of the content radius, not a world distance — the
    // renderer re-solves the band against the live camera distance so the same
    // mood reads identically on a 5-item and a 60-item scene.
    expect(storm.moodFx?.fog?.haze).toBeGreaterThan(0);
    expect(storm.moodFx?.fog?.haze).toBeLessThanOrEqual(1);
    expect(storm.moodFx?.particles?.type).toBe('rain');
    expect(storm.moodFx?.particleSpaceSafe).toBe(false);

    const ember = applyMoodToTheme(base, 'ember');
    expect(ember.moodFx?.particles?.type).toBe('embers');
    expect(ember.moodFx?.particleSpaceSafe).toBe(true);

    const aurora = applyMoodToTheme(base, 'aurora');
    expect(aurora.moodFx?.particles?.type).toBe('aurora');
    expect(aurora.moodFx?.particles?.color2).toBeTruthy();
  });

  it('soften blends only partway and pulls haze back (daylight scenes)', () => {
    const full = applyMoodToTheme(base, 'dusk');
    const soft = applyMoodToTheme(base, 'dusk', { soften: true });
    expect(soft.skyTopColor).not.toBe(full.skyTopColor);
    // Softened directional stays brighter than the full-strength mood.
    expect(soft.directional.intensity).toBeGreaterThan(full.directional.intensity);
    // Less haze means the band sits further back toward the horizon.
    expect(soft.moodFx.fog.haze).toBeLessThan(full.moodFx.fog.haze);
    // Particles still apply in softened mode.
    expect(soft.moodFx.particles?.type).toBe('fireflies');
  });

  it('covers every documented mood with a coherent preset', () => {
    for (const mood of ['dawn', 'dusk', 'night', 'storm', 'ember', 'aurora']) {
      const themed = applyMoodToTheme(base, mood);
      expect(themed).not.toBe(base);
      expect(themed.moodFx?.particles?.type).toBeTruthy();
      expect(themed.directional.intensity).toBeGreaterThan(0);
      expect(themed.directional.intensity).toBeLessThanOrEqual(base.directional.intensity);
    }
  });
});
