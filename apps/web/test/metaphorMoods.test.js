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

  it('attaches moodFx with fog and a particle descriptor', () => {
    const storm = applyMoodToTheme(base, 'storm');
    expect(storm.moodFx?.fog?.near).toBeLessThan(storm.moodFx?.fog?.far);
    expect(storm.moodFx?.particles?.type).toBe('rain');
    expect(storm.moodFx?.particleSpaceSafe).toBe(false);

    const ember = applyMoodToTheme(base, 'ember');
    expect(ember.moodFx?.particles?.type).toBe('embers');
    expect(ember.moodFx?.particleSpaceSafe).toBe(true);

    const aurora = applyMoodToTheme(base, 'aurora');
    expect(aurora.moodFx?.particles?.type).toBe('aurora');
    expect(aurora.moodFx?.particles?.color2).toBeTruthy();
  });

  it('soften blends only partway and pushes fog further out (daylight scenes)', () => {
    const full = applyMoodToTheme(base, 'dusk');
    const soft = applyMoodToTheme(base, 'dusk', { soften: true });
    expect(soft.skyTopColor).not.toBe(full.skyTopColor);
    // Softened directional stays brighter than the full-strength mood.
    expect(soft.directional.intensity).toBeGreaterThan(full.directional.intensity);
    // Softened fog sits further away so the scene stays readable.
    expect(soft.moodFx.fog.near).toBeGreaterThan(full.moodFx.fog.near);
    expect(soft.moodFx.fog.far).toBeGreaterThan(full.moodFx.fog.far);
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
