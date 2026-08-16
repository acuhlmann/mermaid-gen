import * as THREE from 'three';

/** Visual presets for metaphor `scene.theme` — lighting/env only, not scene geometry. */

/** Fixed nature palette — tree metaphor always reads as brown trunk + green canopy. */
const TREE_NATURE_BASE = {
  treeTrunkColor: '#6b4423',
  treeBranchColor: '#8b5a2b',
  treeLeafColor: '#2d6a4f',
  treeMeadowColor: '#52b788',
  treeSoilColor: '#5c4033',
  treeAccentColor: '#e63946',
  treeSkyTopColor: '#87ceeb',
  treeSkyHorizonColor: '#e8f4e8'
};

const DAYLIGHT_OUTDOOR_BASE = {
  background: '#9fd5f2',
  skyTopColor: '#258fce',
  skyHorizonColor: '#c9e8f0',
  ambientIntensity: 0.72,
  hemisphere: ['#dff5ff', '#557a3d', 0.65],
  directional: { position: [16, 24, 10], intensity: 1.45 },
  envIntensity: 0.7,
  waterColor: '#27afe2',
  riverDeepColor: '#087fb8',
  treeMeadowColor: '#53b95e',
  treeSoilColor: '#8b6843',
  treeTrunkColor: '#70451f',
  treeBranchColor: '#8b5a2b',
  treeLeafColor: '#36a852',
  labelColor: '#102a43',
  labelOutline: '#f8fafc'
};

function blendHexColors(base, tint, amount) {
  const out = new THREE.Color(base);
  out.lerp(new THREE.Color(tint), amount);
  return `#${out.getHexString()}`;
}

/**
 * A theme's `hemisphere` is `[skyColor, groundColor, intensity]`, and the second
 * entry is the ground bounce that lights whatever faces away from the sky. On
 * the dark themes it used to be near-black, which reads as "no bounce exists" —
 * and with real cast shadows now in the scene that turned the bridge's shores
 * and the machine's floor into shapes with no surface. Keep the bounce dark but
 * never black; drama belongs to the key light and the vignette, not to
 * withholding every last photon from the shadow side.
 */
export const METAPHOR_THEME_PRESETS = {
  whiteboard: {
    background: '#e9eef5',
    skyTopColor: '#b9cde4',
    skyHorizonColor: '#dde5ef',
    ambientIntensity: 0.6,
    hemisphere: ['#e0e7ff', '#1f2937', 0.45],
    // Pushed further off the camera axis (which looks down [18, 14, 18]) so cast
    // shadows fall across the scene instead of hiding behind their own casters.
    directional: { position: [9, 15, -6], intensity: 1.05 },
    envIntensity: 0.62,
    buildingColor: '#8fb6f0',
    buildingRoofColor: '#b6cff2',
    slabColor: '#f3c95b',
    starColor: '#ffd166',
    // A pale plaza, not the near-black `#1a1a2e` this used to be. Every other
    // preset pairs its ground with its sky; whiteboard paired a near-white sky
    // with a near-black plate, so the city footing and the fused world's ground
    // read as a hockey puck the scene was balanced on. It also feeds the IBL's
    // ground bounce now (SceneEnvironment), where a black nadir means the
    // undersides of everything reflect nothing at all.
    groundColor: '#c2cad8',
    labelColor: '#0f172a',
    labelOutline: '#ffffff',
    districtPalette: ['#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa'],
    clusterPalette: ['#ffd166', '#4cc9f0', '#ff6bcb', '#06d6a0'],
    linkColor: '#64748b',
    linkOpacity: 0.75,
    accentGlow: 0.35,
    componentChipColor: '#fde68a',
    treeTrunkColor: '#8b5a2b',
    treeBranchColor: '#a47148',
    treeLeafColor: '#4ade80',
    terrainBaseColor: '#86efac',
    binaryGlowColor: '#fef08a',
    nebulaPalette: ['#c084fc', '#60a5fa', '#fb7185'],
    windowColor: '#fef3c7',
    windowEmissiveColor: '#fef3c7',
    spireColor: '#94a3b8',
    districtGridColor: '#cbd5e1',
    crackColor: '#1f2937',
    slabTrimColor: '#fbbf24',
    waterColor: '#7dd3fc',
    treeAccentColor: '#f43f5e',
    nebulaDustColor: '#fde68a',
    treeMeadowColor: '#a8d39a',
    treeSoilColor: '#7a5a3a',
    spaceTopColor: '#0b1026',
    spaceHorizonColor: '#2a1050',
    machinePlateColor: '#5b6478',
    machineRimColor: '#a07a4f',
    machineSparkColor: '#f59e0b',
    machineAxlePalette: ['#d4a94e', '#b08968', '#e0c084', '#9a7b4f'],
    bridgeDeckColor: '#a1724f',
    bridgeCableColor: '#64748b',
    bridgeRockColor: '#7a6a58',
    cycleFrameColor: '#475569',
    cyclePaveColor: '#c9cdd6',
    cycleLampColor: '#fbbf24',
    // Clean/flat: restrained bloom, soft pale shadow, no depth-of-field. The
    // brightest theme has the most contrast to spend, so it carries the
    // strongest occlusion — it is what gives a pale skyline its corners.
    postfx: {
      enabled: true,
      bloomStrength: 0.18,
      bloomRadius: 0.35,
      bloomThreshold: 0.95,
      vignette: 0.18,
      samples: 4,
      shadowOpacity: 0.26,
      shadowBlur: 2.8,
      shadowColor: '#334155',
      shadowScale: 46,
      aoIntensity: 0.9
    }
  },
  noir: {
    background: '#0b0f19',
    skyTopColor: '#04060c',
    skyHorizonColor: '#1a2433',
    ambientIntensity: 0.35,
    hemisphere: ['#1e293b', '#1a2233', 0.55],
    directional: { position: [8, 20, 6], intensity: 0.95 },
    // Deliberately the strongest: on a near-black palette the sky reflection is
    // most of what separates a metal flank from the void behind it.
    envIntensity: 0.85,
    buildingColor: '#334155',
    buildingRoofColor: '#475569',
    slabColor: '#475569',
    starColor: '#f8fafc',
    groundColor: '#020617',
    labelColor: '#f1f5f9',
    labelOutline: '#0f172a',
    districtPalette: ['#1e293b', '#334155', '#475569', '#64748b'],
    clusterPalette: ['#818cf8', '#22d3ee', '#f472b6', '#a3e635'],
    linkColor: '#94a3b8',
    linkOpacity: 0.6,
    accentGlow: 0.5,
    componentChipColor: '#64748b',
    treeTrunkColor: '#1f2937',
    treeBranchColor: '#334155',
    treeLeafColor: '#94a3b8',
    terrainBaseColor: '#1e293b',
    binaryGlowColor: '#cbd5e1',
    nebulaPalette: ['#6366f1', '#06b6d4', '#ec4899'],
    windowColor: '#fbbf24',
    windowEmissiveColor: '#fde047',
    spireColor: '#cbd5e1',
    districtGridColor: '#1e293b',
    crackColor: '#020617',
    slabTrimColor: '#64748b',
    waterColor: '#1e3a8a',
    treeAccentColor: '#94a3b8',
    nebulaDustColor: '#cbd5e1',
    treeMeadowColor: '#0d1726',
    treeSoilColor: '#070d18',
    spaceTopColor: '#01030a',
    spaceHorizonColor: '#1e1b4b',
    machinePlateColor: '#1f2634',
    machineRimColor: '#5c6b7a',
    machineSparkColor: '#7dd3fc',
    machineAxlePalette: ['#8a97a8', '#6b7a8c', '#a5b4c4', '#55626f'],
    bridgeDeckColor: '#4a3b2e',
    bridgeCableColor: '#94a3b8',
    bridgeRockColor: '#5c6675',
    cycleFrameColor: '#334155',
    cyclePaveColor: '#1e293b',
    cycleLampColor: '#fde047',
    // Dramatic: heavy bloom on the lit windows/stars, deep vignette, dark shadow.
    postfx: {
      enabled: true,
      bloomStrength: 0.42,
      bloomRadius: 0.5,
      bloomThreshold: 0.78,
      vignette: 0.4,
      samples: 4,
      shadowOpacity: 0.5,
      shadowBlur: 2.4,
      shadowColor: '#01040c',
      shadowScale: 44,
      // Already the darkest palette; a full occlusion term reads as mud.
      aoIntensity: 0.45
    }
  },
  arcade: {
    background: '#1a0533',
    skyTopColor: '#0c0220',
    skyHorizonColor: '#37105e',
    ambientIntensity: 0.5,
    hemisphere: ['#ff6b6b', '#3d2a80', 0.6],
    directional: { position: [14, 18, 10], intensity: 1.1 },
    envIntensity: 0.75,
    buildingColor: '#ff6bcb',
    buildingRoofColor: '#ff9de6',
    slabColor: '#ffd166',
    starColor: '#4cc9f0',
    groundColor: '#240046',
    labelColor: '#fef08a',
    labelOutline: '#1a0533',
    districtPalette: ['#3c096c', '#5a189a', '#7b2cbf', '#9d4edd'],
    clusterPalette: ['#ff6bcb', '#4cc9f0', '#ffd166', '#06d6a0'],
    linkColor: '#c77dff',
    linkOpacity: 0.85,
    accentGlow: 0.65,
    componentChipColor: '#ffd166',
    treeTrunkColor: '#7b2cbf',
    treeBranchColor: '#c77dff',
    treeLeafColor: '#06d6a0',
    terrainBaseColor: '#9d4edd',
    binaryGlowColor: '#4cc9f0',
    nebulaPalette: ['#ff6bcb', '#4cc9f0', '#ffd166'],
    windowColor: '#fef08a',
    windowEmissiveColor: '#fef08a',
    spireColor: '#c77dff',
    districtGridColor: '#5a189a',
    crackColor: '#240046',
    slabTrimColor: '#ffd166',
    waterColor: '#4cc9f0',
    treeAccentColor: '#ff6bcb',
    nebulaDustColor: '#ffd166',
    treeMeadowColor: '#2d0a53',
    treeSoilColor: '#1c0336',
    spaceTopColor: '#0a0118',
    spaceHorizonColor: '#31085e',
    machinePlateColor: '#3a1d5e',
    machineRimColor: '#c77dff',
    machineSparkColor: '#ffd166',
    machineAxlePalette: ['#e0aaff', '#c77dff', '#ffd166', '#9d4edd'],
    bridgeDeckColor: '#7b2cbf',
    bridgeCableColor: '#c77dff',
    bridgeRockColor: '#3c096c',
    cycleFrameColor: '#9d4edd',
    cyclePaveColor: '#240046',
    cycleLampColor: '#ffd166',
    // Neon arcade: strongest bloom + saturation for a synthwave glow.
    postfx: {
      enabled: true,
      bloomStrength: 0.5,
      bloomRadius: 0.55,
      bloomThreshold: 0.72,
      vignette: 0.34,
      samples: 4,
      shadowOpacity: 0.42,
      shadowBlur: 2.6,
      shadowColor: '#1a0533',
      shadowScale: 44,
      // Neon wants its saturation intact; occlusion desaturates as it darkens.
      aoIntensity: 0.5
    }
  },
  blueprint: {
    background: '#0a1e3a',
    skyTopColor: '#05122a',
    skyHorizonColor: '#123a63',
    ambientIntensity: 0.55,
    hemisphere: ['#1e3a8a', '#1c3555', 0.55],
    directional: { position: [10, 18, 8], intensity: 0.9 },
    envIntensity: 0.7,
    buildingColor: '#bfdbfe',
    buildingRoofColor: '#dbeafe',
    slabColor: '#e0f2fe',
    starColor: '#f0f9ff',
    groundColor: '#0a1e3a',
    labelColor: '#f0f9ff',
    labelOutline: '#0a1e3a',
    districtPalette: ['#1e3a8a', '#1d4ed8', '#2563eb', '#3b82f6'],
    clusterPalette: ['#38bdf8', '#c084fc', '#fbbf24', '#34d399'],
    linkColor: '#bae6fd',
    linkOpacity: 0.9,
    accentGlow: 0.55,
    componentChipColor: '#dbeafe',
    treeTrunkColor: '#bfdbfe',
    treeBranchColor: '#bae6fd',
    treeLeafColor: '#e0f2fe',
    terrainBaseColor: '#1e40af',
    binaryGlowColor: '#f0f9ff',
    nebulaPalette: ['#2563eb', '#a855f7', '#f59e0b'],
    windowColor: '#e0f2fe',
    windowEmissiveColor: '#bae6fd',
    spireColor: '#dbeafe',
    districtGridColor: '#1d4ed8',
    crackColor: '#0a1e3a',
    slabTrimColor: '#bae6fd',
    waterColor: '#38bdf8',
    treeAccentColor: '#f0f9ff',
    nebulaDustColor: '#bae6fd',
    treeMeadowColor: '#11315e',
    treeSoilColor: '#0a2348',
    spaceTopColor: '#030b1c',
    spaceHorizonColor: '#1e3a6e',
    machinePlateColor: '#2c3e5c',
    machineRimColor: '#7f9cc4',
    machineSparkColor: '#93c5fd',
    machineAxlePalette: ['#9db8d6', '#7f9cc4', '#c0d4ea', '#5f7a9c'],
    bridgeDeckColor: '#35507a',
    bridgeCableColor: '#bae6fd',
    bridgeRockColor: '#54759e',
    cycleFrameColor: '#5b8bc4',
    cyclePaveColor: '#0d2c52',
    cycleLampColor: '#e0f2fe',
    // Technical/crisp: modest bloom on the linework, light vignette, no DoF.
    postfx: {
      enabled: true,
      bloomStrength: 0.28,
      bloomRadius: 0.4,
      bloomThreshold: 0.86,
      vignette: 0.24,
      samples: 4,
      shadowOpacity: 0.34,
      shadowBlur: 2.7,
      shadowColor: '#020a1a',
      shadowScale: 46,
      aoIntensity: 0.65
    }
  }
};

export function resolveMetaphorThemePreset(theme) {
  return METAPHOR_THEME_PRESETS[theme] ?? METAPHOR_THEME_PRESETS.whiteboard;
}

/**
 * Ambient occlusion defaults.
 *
 * `aoScreenSpace` is the important one and it is the same lesson the fog band
 * already learned: GTAO's `radius` is a WORLD distance, and these scenes run
 * from a 10-unit cake to a 60-unit grove, so one authored radius is a heavy
 * smudge on the small scene and invisible on the large one. In screen-space
 * mode the radius is instead the world size of `aoRadius × 100` pixels at each
 * fragment's own depth, which is scale-independent by construction.
 *
 * `aoIntensity` is per theme rather than global because AO spends contrast, and
 * the dark themes have very little left to spend — the same occlusion term that
 * gives whiteboard's skyline its corners turns noir's flanks to mud.
 */
export const DEFAULT_POSTFX = {
  enabled: true,
  bloomStrength: 0.28,
  bloomRadius: 0.4,
  bloomThreshold: 0.9,
  vignette: 0.26,
  samples: 4,
  shadowOpacity: 0.35,
  shadowBlur: 2.6,
  shadowColor: '#0a0f1e',
  shadowScale: 44,
  ao: true,
  aoIntensity: 0.7,
  aoRadius: 0.5,
  aoThickness: 0.3,
  aoScreenSpace: true,
  aoSamples: 16
};

/** Merge a theme's `postfx` block over the defaults (theme may omit any key). */
export function resolveMetaphorPostfx(theme) {
  return { ...DEFAULT_POSTFX, ...(theme?.postfx ?? {}) };
}

export function resolveDistrictColor(theme, index) {
  const palette = theme.districtPalette ?? [];
  if (palette.length === 0) return theme.groundColor;
  return palette[index % palette.length];
}

export function resolveClusterColor(theme, index) {
  const palette = theme.clusterPalette ?? [theme.starColor];
  return palette[index % palette.length];
}

export function resolveNebulaColor(theme, index) {
  const palette = theme.nebulaPalette ?? theme.clusterPalette ?? [theme.starColor];
  return palette[index % palette.length];
}

/**
 * Nature-locked tree colours — trunks/branches/soil stay brown regardless of
 * scene.theme; leaf and meadow pick up a ~10% tint from the active theme so
 * arcade/noir still feel cohesive without purple trunks.
 */
export function resolveTreeNatureTheme(theme) {
  const leafTint = theme?.treeLeafColor ?? theme?.starColor ?? TREE_NATURE_BASE.treeLeafColor;
  const meadowTint =
    theme?.treeMeadowColor ?? theme?.groundColor ?? TREE_NATURE_BASE.treeMeadowColor;
  const blend = 0.1;
  return {
    ...theme,
    treeTrunkColor: TREE_NATURE_BASE.treeTrunkColor,
    treeBranchColor: TREE_NATURE_BASE.treeBranchColor,
    treeSoilColor: TREE_NATURE_BASE.treeSoilColor,
    treeLeafColor: blendHexColors(TREE_NATURE_BASE.treeLeafColor, leafTint, blend),
    treeMeadowColor: blendHexColors(TREE_NATURE_BASE.treeMeadowColor, meadowTint, blend),
    treeAccentColor: TREE_NATURE_BASE.treeAccentColor,
    treeSkyTopColor: TREE_NATURE_BASE.treeSkyTopColor,
    treeSkyHorizonColor: TREE_NATURE_BASE.treeSkyHorizonColor
  };
}

/**
 * Rivers always render as a clear daytime landscape. The selected theme still
 * contributes a restrained accent tint, but cannot turn the sky, meadow, or
 * water into a night scene.
 */
export function resolveRiverDaylightTheme(theme) {
  const accent = theme?.waterColor ?? DAYLIGHT_OUTDOOR_BASE.waterColor;
  const meadowTint = theme?.treeMeadowColor ?? DAYLIGHT_OUTDOOR_BASE.treeMeadowColor;
  return {
    ...theme,
    ...DAYLIGHT_OUTDOOR_BASE,
    waterColor: blendHexColors(DAYLIGHT_OUTDOOR_BASE.waterColor, accent, 0.12),
    riverDeepColor: blendHexColors(DAYLIGHT_OUTDOOR_BASE.riverDeepColor, accent, 0.08),
    treeMeadowColor: blendHexColors(DAYLIGHT_OUTDOOR_BASE.treeMeadowColor, meadowTint, 0.08),
    postfx: {
      ...(theme?.postfx ?? {}),
      bloomStrength: 0.12,
      bloomThreshold: 0.92,
      vignette: 0.18,
      shadowOpacity: 0.3,
      shadowColor: '#31543f',
      // Open-air daylight: contact darkening is what stops a bank, a bed or a
      // hull reading as a flat sticker against the ground it sits on.
      aoIntensity: 0.8
    }
  };
}

/** Sunny botanical palette for the garden metaphor, with theme-tinted blooms. */
export function resolveGardenDaylightTheme(theme) {
  return {
    ...resolveRiverDaylightTheme(theme),
    gardenBloomPalette: theme?.clusterPalette ?? ['#f472b6', '#fbbf24', '#a78bfa', '#fb7185'],
    gardenThrivingColor: '#2f9e44',
    gardenSteadyColor: '#65a30d',
    gardenRiskColor: '#c26b35',
    gardenSoilColor: '#795438',
    gardenPathColor: '#e9d6aa'
  };
}

/** Tropical daylight ocean palette for the archipelago metaphor. */
export function resolveArchipelagoDaylightTheme(theme) {
  const ocean = resolveRiverDaylightTheme(theme);
  return {
    ...ocean,
    waterColor: blendHexColors('#1aa7d6', theme?.waterColor ?? '#1aa7d6', 0.15),
    riverDeepColor: '#066a9c',
    treeMeadowColor: '#3cb86a',
    treeLeafColor: '#2f9e44',
    // Green family only — pastel cyan/pink chain tints made islands look industrial.
    archipelagoGreenPalette: ['#3d9a4a', '#2f8f5b', '#4aa86a', '#287a48', '#5bb872'],
    districtPalette: theme?.districtPalette ?? ['#3d9a4a', '#2f8f5b', '#4aa86a', '#287a48'],
    postfx: {
      ...(ocean.postfx ?? {}),
      bloomStrength: 0.14,
      bloomThreshold: 0.9,
      vignette: 0.16,
      shadowOpacity: 0.28,
      shadowColor: '#1e4d5c',
      aoIntensity: 0.8
    }
  };
}

/** Galaxy-specific tuning layered on the resolved scene theme. */
export function resolveGalaxyVividTheme(theme) {
  return {
    ...theme,
    galaxySpectralSpread: theme?.galaxySpectralSpread ?? 0.35,
    spaceTopColor: theme?.spaceTopColor ?? '#070b18',
    spaceHorizonColor: theme?.spaceHorizonColor ?? '#2a1050'
  };
}
