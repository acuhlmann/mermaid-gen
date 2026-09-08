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
  resolveTreeNatureTheme,
  TREE_DAYLIGHT_BLOOM_THRESHOLD
} from '../src/utils/metaphorThemePresets.js';
import {
  DAYLIGHT_LOCKED_KINDS,
  resolveMetaphorSceneTheme
} from '../src/utils/metaphorSceneTheme.js';

/**
 * sRGB relative luminance, which is the quantity a bloom threshold is compared
 * against — deliberately NOT `THREE.Color`, whose channels are in the linear
 * working space (the trap `shiftColor` records: a mid-tone reads ~0.09 there).
 */
function srgbLuminance(hex) {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  const r = ((value >> 16) & 0xff) / 255;
  const g = ((value >> 8) & 0xff) / 255;
  const b = (value & 0xff) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** ~0.943 — the tree's own sky is brighter than any other kind's. */
const SKY_HORIZON_LUMINANCE = srgbLuminance(
  resolveTreeNatureTheme(METAPHOR_THEME_PRESETS.whiteboard).treeSkyHorizonColor
);

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

  // The defect this covers erased the scene rather than tinting it: the tree
  // paints a daylight sky on every theme, and a dark theme's bloom threshold
  // sits BELOW that sky's luminance, so the backdrop itself bloomed and its
  // radius smeared over the subject. Measured at all three standing viewports,
  // the noir/arcade/blueprint tree came back as a milky rectangle with zero
  // pixels of the amber accent marker anywhere in it.
  it.each(['noir', 'arcade', 'blueprint'])(
    'keeps the bloom cut-off above its own daylight sky on the %s theme',
    (themeId) => {
      const preset = METAPHOR_THEME_PRESETS[themeId];
      const tree = resolveTreeNatureTheme(preset);
      // The premise: the preset's own threshold is under the tree's sky.
      expect(preset.postfx.bloomThreshold).toBeLessThan(SKY_HORIZON_LUMINANCE);
      expect(tree.postfx.bloomThreshold).toBe(TREE_DAYLIGHT_BLOOM_THRESHOLD);
      expect(tree.postfx.bloomThreshold).toBeGreaterThan(SKY_HORIZON_LUMINANCE);
      expect(tree.postfx.bloomStrength).toBeLessThan(preset.postfx.bloomStrength);
    }
  );

  it('takes the daylight light and label ink, so the IBL agrees with the sky', () => {
    const tree = resolveTreeNatureTheme(METAPHOR_THEME_PRESETS.noir);
    // `SceneEnvironment` builds image-based lighting from these two keys, so a
    // noir tree used to reflect a night sky at a meadow standing in daylight.
    expect(tree.skyTopColor).toBe(tree.treeSkyTopColor);
    expect(tree.skyHorizonColor).toBe(tree.treeSkyHorizonColor);
    expect(tree.background).toBe(tree.treeSkyHorizonColor);
    expect(tree.ambientIntensity).toBe(0.72);
    expect(tree.envIntensity).toBe(0.7);
    // A dark theme's near-white ink is a name written in white on a white sky.
    expect(tree.labelColor).toBe('#102a43');
    expect(tree.labelOutline).toBe('#f8fafc');
  });

  it('is idempotent — the scene re-resolves the theme the renderer resolved', () => {
    const once = resolveTreeNatureTheme(METAPHOR_THEME_PRESETS.arcade);
    const twice = resolveTreeNatureTheme(once);
    // Not just equal: the same object, so a second pass cannot walk the leaf
    // tint back toward the untinted base by blending it against itself.
    expect(twice).toBe(once);
    expect(twice.treeLeafColor).toBe(once.treeLeafColor);
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

// Lives here rather than in a `metaphorSceneTheme.test.js` of its own on
// purpose: `scripts/test-affected-lib.mjs` keeps the metaphor blast bundle and
// its own reverse sweep fails on any `apps/web/test/metaphor*.test.js` not
// listed there — and that file is outside this automation's allowedPaths (the
// ledger's `metaphor-suite-blast-list`, blocked-by-paths). A new suite would
// have been red in CI and unfixable from here.
describe('resolveMetaphorSceneTheme', () => {
  it('leaves a kind that paints the theme sky on the theme preset', () => {
    const noirCity = resolveMetaphorSceneTheme({ themeId: 'noir', kind: 'city', moodId: null });
    expect(noirCity.skyHorizonColor).toBe(METAPHOR_THEME_PRESETS.noir.skyHorizonColor);
    expect(noirCity.postfx.bloomThreshold).toBe(METAPHOR_THEME_PRESETS.noir.postfx.bloomThreshold);
  });

  // The regression this pins is an omission, not a wrong value: the tree paints
  // its own daylight sky and was the one such kind missing from the ladder, so
  // the postfx handed to the effect stack stayed the dark theme's and its bloom
  // threshold sat below the backdrop's own luminance.
  it.each(Object.keys(DAYLIGHT_LOCKED_KINDS))(
    'locks %s to daylight on a dark theme, postfx included',
    (kind) => {
      const dark = METAPHOR_THEME_PRESETS.noir;
      const resolved = resolveMetaphorSceneTheme({ themeId: 'noir', kind, moodId: null });
      expect(resolved.skyHorizonColor).not.toBe(dark.skyHorizonColor);
      expect(resolved.postfx.bloomThreshold).toBeGreaterThan(dark.postfx.bloomThreshold);
      expect(resolved.postfx.bloomStrength).toBeLessThan(dark.postfx.bloomStrength);
    }
  );

  it('keeps the tree on the daylight ladder', () => {
    // Named rather than left to the table above: this is the entry whose
    // absence was the bug, and a table that silently loses a row cannot fail.
    expect(Object.keys(DAYLIGHT_LOCKED_KINDS)).toContain('tree');
  });

  it('softens a mood for a daylight kind and not for a themed one', () => {
    const stormTree = resolveMetaphorSceneTheme({ themeId: 'noir', kind: 'tree', moodId: 'storm' });
    const stormCity = resolveMetaphorSceneTheme({ themeId: 'noir', kind: 'city', moodId: 'storm' });
    // `soften` halves the mood's haze; a full-strength storm over a daylight
    // world is the scene disappearing again by another route.
    expect(stormTree.moodFx.fog.haze).toBeLessThan(stormCity.moodFx.fog.haze);
  });

  it('treats a missing or unknown kind as no lock rather than throwing', () => {
    for (const kind of [null, undefined, '', 'composite', 'nope']) {
      const resolved = resolveMetaphorSceneTheme({ themeId: 'noir', kind, moodId: null });
      expect(resolved.skyHorizonColor).toBe(METAPHOR_THEME_PRESETS.noir.skyHorizonColor);
    }
  });
});
