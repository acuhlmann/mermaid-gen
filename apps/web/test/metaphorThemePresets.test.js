import { describe, expect, it } from 'vitest';
import {
  METAPHOR_THEME_PRESETS,
  resolveGalaxyVividTheme,
  resolveTreeNatureTheme
} from '../src/utils/metaphorThemePresets.js';

describe('resolveTreeNatureTheme', () => {
  it('locks trunk and branch to natural browns even on arcade theme', () => {
    const arcade = METAPHOR_THEME_PRESETS.arcade;
    const tree = resolveTreeNatureTheme(arcade);
    expect(tree.treeTrunkColor).toBe('#6b4423');
    expect(tree.treeBranchColor).toBe('#8b5a2b');
    expect(tree.treeSoilColor).toBe('#5c4033');
    expect(tree.treeLeafColor).not.toBe(arcade.treeLeafColor);
    expect(tree.treeLeafColor.startsWith('#')).toBe(true);
  });

  it('provides outdoor sky gradient colours', () => {
    const tree = resolveTreeNatureTheme(METAPHOR_THEME_PRESETS.whiteboard);
    expect(tree.treeSkyTopColor).toBe('#87ceeb');
    expect(tree.treeSkyHorizonColor).toBe('#e8f4e8');
  });
});

describe('resolveGalaxyVividTheme', () => {
  it('adds spectral spread tuning and deep space horizon', () => {
    const vivid = resolveGalaxyVividTheme(METAPHOR_THEME_PRESETS.noir);
    expect(vivid.galaxySpectralSpread).toBeGreaterThan(0);
    expect(vivid.clusterPalette.length).toBeGreaterThan(1);
    expect(vivid.spaceHorizonColor).toBeTruthy();
  });

  it('keeps multi-hue cluster palette on blueprint theme', () => {
    const vivid = resolveGalaxyVividTheme(METAPHOR_THEME_PRESETS.blueprint);
    const unique = new Set(vivid.clusterPalette);
    expect(unique.size).toBeGreaterThan(1);
  });
});
