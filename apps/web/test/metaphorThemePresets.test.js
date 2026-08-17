import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { shiftColor } from '../src/components/metaphorScenes/sceneUtils.js';
import {
  DEFAULT_POSTFX,
  METAPHOR_THEME_PRESETS,
  resolveArchipelagoDaylightTheme,
  resolveGalaxyVividTheme,
  resolveGardenDaylightTheme,
  resolveMetaphorPostfx,
  resolveRiverDaylightTheme,
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

describe('outdoor daylight themes', () => {
  it('keeps a noir-authored river sunny with clear water', () => {
    const river = resolveRiverDaylightTheme(METAPHOR_THEME_PRESETS.noir);
    // The daylight override must also replace the dark theme's IBL strength,
    // or a noir-authored river reflects a night sky into sunny water.
    expect(river.envIntensity).toBe(0.7);
    expect(river.background).toBe('#9fd5f2');
    expect(river.skyTopColor).toBe('#258fce');
    expect(river.treeMeadowColor).not.toBe(METAPHOR_THEME_PRESETS.noir.treeMeadowColor);
    expect(river.waterColor).not.toBe(METAPHOR_THEME_PRESETS.noir.waterColor);
    expect(river.ambientIntensity).toBeGreaterThan(0.7);
  });

  it('gives garden scenes a daylight botanical palette', () => {
    const garden = resolveGardenDaylightTheme(METAPHOR_THEME_PRESETS.blueprint);
    expect(garden.envIntensity).toBe(0.7);
    expect(garden.gardenBloomPalette.length).toBeGreaterThan(2);
    expect(garden.gardenThrivingColor).toBeTruthy();
    expect(garden.gardenRiskColor).toBeTruthy();
  });

  it('gives archipelago scenes a sunny tropical ocean palette', () => {
    const arch = resolveArchipelagoDaylightTheme(METAPHOR_THEME_PRESETS.noir);
    expect(arch.envIntensity).toBe(0.7);
    expect(arch.skyTopColor).toBe('#258fce');
    expect(arch.waterColor).toBeTruthy();
    expect(arch.ambientIntensity).toBeGreaterThan(0.7);
  });
});

describe('resolveMetaphorPostfx', () => {
  it('merges theme postfx over the shared defaults', () => {
    const merged = resolveMetaphorPostfx(METAPHOR_THEME_PRESETS.whiteboard);
    expect(merged.ao).toBe(true);
    expect(merged.aoScreenSpace).toBe(true);
    expect(merged.aoIntensity).toBe(0.9);
    expect(merged.bloomStrength).toBe(0.18);
  });

  it('keeps aoThickness under aoRadius so GTAO does not ring silhouettes', () => {
    // The gradient sky writes no depth, so a stock thickness of 1.0 drew a black
    // halo around every edge. Defaults cap thickness under radius; every theme
    // override must preserve that relationship.
    const defaults = resolveMetaphorPostfx({});
    expect(defaults.aoThickness).toBeLessThan(defaults.aoRadius);

    for (const [name, theme] of Object.entries(METAPHOR_THEME_PRESETS)) {
      const postfx = resolveMetaphorPostfx(theme);
      expect(postfx.aoThickness, `${name} aoThickness`).toBeLessThan(postfx.aoRadius);
    }
  });
});

describe('theme colour regressions (PR #317 / #318)', () => {
  /** Rec. 709 luma — catches near-black albedos that PBR cannot light. */
  function luma(hex) {
    const c = new THREE.Color(hex);
    return c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
  }

  it('whiteboard ground is a pale plaza, not a near-black IBL nadir', () => {
    expect(luma(METAPHOR_THEME_PRESETS.whiteboard.groundColor)).toBeGreaterThan(0.35);
  });

  it('shiftColor darkens bridge rock instead of clamping to black on noir', () => {
    const rock = METAPHOR_THEME_PRESETS.noir.bridgeRockColor;
    const shifted = shiftColor(rock, { lightness: -0.1 });
    expect(`#${shifted.getHexString()}`).not.toBe('#000000');
    expect(luma(`#${shifted.getHexString()}`)).toBeGreaterThan(0.05);
  });
});
