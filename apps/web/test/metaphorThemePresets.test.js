import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { isDarkBackdrop, shiftColor } from '../src/components/metaphorScenes/sceneUtils.js';
import {
  DEFAULT_POSTFX,
  METAPHOR_THEME_PRESETS,
  resolveArchipelagoDaylightTheme,
  resolveGalaxyVividTheme,
  resolveGardenDaylightTheme,
  resolveMetaphorPostfx,
  resolveRiverDaylightTheme,
  resolveSpaceSkyTheme,
  resolveTreeNatureTheme,
  SPACE_BLOOM_THRESHOLD,
  TREE_DAYLIGHT_BLOOM_THRESHOLD
} from '../src/utils/metaphorThemePresets.js';
import {
  DAYLIGHT_LOCKED_KINDS,
  SPACE_LOCKED_KINDS,
  resolveMetaphorSceneTheme
} from '../src/utils/metaphorSceneTheme.js';
import {
  DAYLIGHT_SURFACE_KEYS,
  DAYLIGHT_SURFACE_MIN_LUMA,
  SPACE_SURFACE_KEYS,
  SPACE_SURFACE_MAX_LUMA,
  raiseSurfacesForDaylight,
  srgbLuma
} from '../src/utils/metaphorDaylightSurfaces.js';

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

// The other half of the lock. A base river/garden/tree reads the colours the
// lock already rewrites, so this is invisible there; a FUSED composite draws
// every grammar's primitives, and its ground disc comes from `groundColor` —
// `#020617` on noir, under a daylight sky.
describe('daylight surface floor', () => {
  const LOCKED_DARK_THEMES = ['noir', 'arcade', 'blueprint'];

  it('raises every surface a daylight sky is meant to be lighting', () => {
    for (const kind of Object.keys(DAYLIGHT_LOCKED_KINDS)) {
      for (const themeId of LOCKED_DARK_THEMES) {
        const resolved = resolveMetaphorSceneTheme({ themeId, kind, moodId: null });
        for (const key of DAYLIGHT_SURFACE_KEYS) {
          const value = resolved[key];
          if (typeof value !== 'string') continue;
          expect(srgbLuma(value), `${kind}/${themeId} ${key}`).toBeGreaterThanOrEqual(
            DAYLIGHT_SURFACE_MIN_LUMA - 1e-6
          );
        }
      }
    }
  });

  it('leaves an unlocked kind on its theme, however dark the surface', () => {
    // The floor is the daylight lock's business alone. A noir city is a night
    // scene on purpose, and its near-black plaza is the picture the author
    // asked for.
    const noirCity = resolveMetaphorSceneTheme({ themeId: 'noir', kind: 'city', moodId: null });
    expect(noirCity.groundColor).toBe(METAPHOR_THEME_PRESETS.noir.groundColor);
  });

  it('returns the same object when nothing needed raising', () => {
    // Identity, not equality: this is what makes whiteboard's captures
    // pixel-identical rather than merely close, on every lock.
    const daylit = { skyHorizonColor: '#c9e8f0', groundColor: '#c2cad8', buildingColor: '#8fb6f0' };
    expect(raiseSurfacesForDaylight(daylit)).toBe(daylit);
  });

  it('is idempotent, so a scene may go on resolving the theme it was handed', () => {
    // `TreeScene` and `TreeSky` both re-resolve; the tree lock needs a
    // `treeNatureLocked` guard for that, and a floor needs none — a colour that
    // already clears the bar is returned unchanged.
    const once = resolveMetaphorSceneTheme({ themeId: 'noir', kind: 'tree', moodId: null });
    expect(raiseSurfacesForDaylight(once)).toBe(once);
  });

  it('walks toward the sky the scene paints, so the themes stay apart', () => {
    // Aerial perspective, the rule `SoaringBirds` and `recedeTheme` follow —
    // not a blend toward one neutral, which would land all three dark themes on
    // the same grey and delete the only theme signal a daylight world has left.
    const grounds = LOCKED_DARK_THEMES.map(
      (themeId) => resolveMetaphorSceneTheme({ themeId, kind: 'river', moodId: null }).groundColor
    );
    expect(new Set(grounds).size).toBe(LOCKED_DARK_THEMES.length);
  });

  it('never brightens a surface past the bar it had to clear', () => {
    // A floor, not a wash: the walk stops at the bar, so a raised ground stays
    // the darkest thing in the picture rather than becoming a light plaza.
    const noirRiver = resolveMetaphorSceneTheme({ themeId: 'noir', kind: 'river', moodId: null });
    expect(srgbLuma(noirRiver.groundColor)).toBeLessThan(DAYLIGHT_SURFACE_MIN_LUMA + 0.02);
  });

  it('leaves ink, light sources and grouping palettes alone', () => {
    // Three families the floor must not reach: a label is type (the lock sets
    // it), an emissive key is a light rather than a surface, and a group's
    // colour is an ordinal encoding — two territories agreeing is the one thing
    // a shared grouping noun exists to deny.
    const noir = METAPHOR_THEME_PRESETS.noir;
    const locked = resolveMetaphorSceneTheme({ themeId: 'noir', kind: 'river', moodId: null });
    expect(locked.districtPalette).toEqual(noir.districtPalette);
    expect(locked.clusterPalette).toEqual(noir.clusterPalette);
    expect(locked.windowEmissiveColor).toBe(noir.windowEmissiveColor);
    expect(locked.starColor).toBe(noir.starColor);
    for (const key of DAYLIGHT_SURFACE_KEYS) {
      expect(key, `${key} is a surface, not ink or a palette`).not.toMatch(
        /label|Palette|Emissive|Glow|star|Lamp/i
      );
    }
  });
});

// The daylight lock's mirror. `GalaxySky` paints from `spaceTopColor` /
// `spaceHorizonColor` — a different theme channel from the one every other
// kind's sky sphere reads — so on whiteboard the backdrop was `#0b1026` while
// the IBL, the key light's fill and rim, the clear colour, `recedeTheme`'s
// horizon, `isDarkBackdrop` and the bloom threshold all still answered
// `#b9cde4`/`#dde5ef`.
describe('space sky lock', () => {
  const THEMES = ['whiteboard', 'noir', 'arcade', 'blueprint'];

  it('covers exactly the kinds that mount GalaxySky', () => {
    // Named rather than left implicit, for the reason `DAYLIGHT_LOCKED_KINDS`
    // is: the tree bug was an omission from a list, and the orrery is the entry
    // an eye skips because the renderer mounts it through the galaxy's branch.
    expect(Object.keys(SPACE_LOCKED_KINDS).sort()).toEqual(['galaxy', 'orrery']);
  });

  it('never claims a kind both paints daylight and paints space', () => {
    for (const kind of Object.keys(SPACE_LOCKED_KINDS)) {
      expect(DAYLIGHT_LOCKED_KINDS, kind).not.toHaveProperty(kind);
    }
  });

  it.each(THEMES)('puts %s sky keys on the space the scene actually paints', (themeId) => {
    for (const kind of Object.keys(SPACE_LOCKED_KINDS)) {
      const resolved = resolveMetaphorSceneTheme({ themeId, kind, moodId: null });
      const space = resolveGalaxyVividTheme(METAPHOR_THEME_PRESETS[themeId]);
      expect(resolved.skyTopColor, `${kind}/${themeId}`).toBe(space.spaceTopColor);
      expect(resolved.skyHorizonColor, `${kind}/${themeId}`).toBe(space.spaceHorizonColor);
      expect(resolved.background, `${kind}/${themeId}`).toBe(space.spaceHorizonColor);
    }
  });

  it('lets the additive accent glow fire on every theme, whiteboard included', () => {
    // The behavioural point of the lock. `isDarkBackdrop` reads the sky keys to
    // decide whether an additive glow can register at all, and on a whiteboard
    // galaxy it was answering "no" about a sky that is `#2a1050`.
    expect(isDarkBackdrop(METAPHOR_THEME_PRESETS.whiteboard)).toBe(false);
    for (const themeId of THEMES) {
      for (const kind of Object.keys(SPACE_LOCKED_KINDS)) {
        const resolved = resolveMetaphorSceneTheme({ themeId, kind, moodId: null });
        expect(isDarkBackdrop(resolved), `${kind}/${themeId}`).toBe(true);
      }
    }
  });

  it('caps the bloom threshold and leaves the three dark themes untouched', () => {
    for (const themeId of THEMES) {
      const preset = METAPHOR_THEME_PRESETS[themeId];
      const resolved = resolveMetaphorSceneTheme({ themeId, kind: 'galaxy', moodId: null });
      expect(resolved.postfx.bloomThreshold).toBeLessThanOrEqual(SPACE_BLOOM_THRESHOLD);
      if (preset.postfx.bloomThreshold <= SPACE_BLOOM_THRESHOLD) {
        // A cap, not a value: a theme already under the bar keeps its own.
        expect(resolved.postfx.bloomThreshold, themeId).toBe(preset.postfx.bloomThreshold);
      }
    }
    // Only whiteboard's is picked for a daylight sky, so only whiteboard moves.
    expect(METAPHOR_THEME_PRESETS.whiteboard.postfx.bloomThreshold).toBeGreaterThan(
      SPACE_BLOOM_THRESHOLD
    );
    // And a theme that authors no postfx block at all still gets the cap rather
    // than the daylight-ish default the merge would otherwise hand it.
    expect(DEFAULT_POSTFX.bloomThreshold).toBeGreaterThan(SPACE_BLOOM_THRESHOLD);
    expect(
      resolveSpaceSkyTheme({ spaceTopColor: '#01030a', spaceHorizonColor: '#1e1b4b' }).postfx
    ).toHaveProperty('bloomThreshold', SPACE_BLOOM_THRESHOLD);
  });

  it('holds the lock through a mood, which is why it runs after one', () => {
    // A mood replaces the sky keys outright (mix 1 for an unsoftened kind), so
    // a space lock applied before it would be undone by `dusk` on every theme —
    // the IBL, rim and clear colour back on a sunset the galaxy never paints.
    const dusk = resolveMetaphorSceneTheme({ themeId: 'noir', kind: 'galaxy', moodId: 'dusk' });
    const plain = resolveMetaphorSceneTheme({ themeId: 'noir', kind: 'galaxy', moodId: null });
    expect(dusk.skyTopColor).toBe(plain.skyTopColor);
    expect(dusk.skyHorizonColor).toBe(plain.skyHorizonColor);
    // …and the mood still owns the parts a space scene can honestly express.
    expect(dusk.directional.intensity).toBeLessThan(plain.directional.intensity);
    expect(dusk.moodFx).toBeTruthy();
  });

  it('is idempotent, because the scene resolves the theme again for itself', () => {
    // `GalaxyScene` and `GalaxySky` both call `resolveGalaxyVividTheme` on the
    // theme the renderer already resolved.
    for (const themeId of THEMES) {
      const once = resolveMetaphorSceneTheme({ themeId, kind: 'galaxy', moodId: null });
      expect(resolveSpaceSkyTheme(once)).toEqual(once);
      expect(resolveGalaxyVividTheme(once)).toEqual(once);
    }
  });

  it('leaves every other kind on its theme sky', () => {
    for (const themeId of THEMES) {
      const preset = METAPHOR_THEME_PRESETS[themeId];
      for (const kind of ['city', 'layercake', 'machine', 'subway', 'iceberg']) {
        const resolved = resolveMetaphorSceneTheme({ themeId, kind, moodId: null });
        expect(resolved.skyTopColor, `${kind}/${themeId}`).toBe(preset.skyTopColor);
        expect(resolved.postfx.bloomThreshold, `${kind}/${themeId}`).toBe(
          preset.postfx.bloomThreshold
        );
      }
    }
  });

  it('brings the ground under a lightness deep space could account for', () => {
    for (const themeId of THEMES) {
      for (const kind of Object.keys(SPACE_LOCKED_KINDS)) {
        const resolved = resolveMetaphorSceneTheme({ themeId, kind, moodId: null });
        for (const key of SPACE_SURFACE_KEYS) {
          expect(srgbLuma(resolved[key]), `${kind}/${themeId} ${key}`).toBeLessThanOrEqual(
            SPACE_SURFACE_MAX_LUMA + 1e-6
          );
        }
      }
    }
  });

  it('moves only whiteboard, and leaves every dark theme byte-identical', () => {
    // The ceiling's safety property, and the reason the bar is 0.35: whiteboard's
    // ground is 0.79 and the next highest is blueprint's 0.11, so the bar has a
    // wide margin either side rather than sitting between two live values.
    for (const themeId of ['noir', 'arcade', 'blueprint']) {
      const resolved = resolveMetaphorSceneTheme({ themeId, kind: 'galaxy', moodId: null });
      expect(resolved.groundColor, themeId).toBe(METAPHOR_THEME_PRESETS[themeId].groundColor);
    }
    const white = resolveMetaphorSceneTheme({
      themeId: 'whiteboard',
      kind: 'galaxy',
      moodId: null
    });
    expect(white.groundColor).not.toBe(METAPHOR_THEME_PRESETS.whiteboard.groundColor);
  });

  it('leaves the bodies alone, because a bright body in space can be right', () => {
    // The asymmetry with the daylight floor, which reaches nine keys. A
    // near-black albedo cannot be lit whatever the sky; a pale TOWER in space is
    // a lit object, and blueprint's are 0.85/0.91/0.94 by design.
    expect(SPACE_SURFACE_KEYS).toEqual(['groundColor']);
    for (const themeId of THEMES) {
      const preset = METAPHOR_THEME_PRESETS[themeId];
      const resolved = resolveMetaphorSceneTheme({ themeId, kind: 'galaxy', moodId: null });
      expect(resolved.buildingColor, themeId).toBe(preset.buildingColor);
      expect(resolved.slabColor, themeId).toBe(preset.slabColor);
      expect(resolved.districtPalette, themeId).toEqual(preset.districtPalette);
    }
  });

  it('never dims the ground of a kind that is not in space', () => {
    const whiteCity = resolveMetaphorSceneTheme({
      themeId: 'whiteboard',
      kind: 'city',
      moodId: null
    });
    expect(whiteCity.groundColor).toBe(METAPHOR_THEME_PRESETS.whiteboard.groundColor);
  });

  it('keeps each theme a different deep space rather than one black', () => {
    // The `tree-themes-read-alike` cost, avoided: the lock substitutes the
    // theme's OWN space channel, which the presets already author apart, so
    // picking noir over arcade still buys a different sky.
    const skies = THEMES.map(
      (themeId) =>
        resolveMetaphorSceneTheme({ themeId, kind: 'galaxy', moodId: null }).skyHorizonColor
    );
    expect(new Set(skies).size).toBe(THEMES.length);
  });
});
