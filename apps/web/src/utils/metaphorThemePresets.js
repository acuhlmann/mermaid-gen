/** Visual presets for metaphor `scene.theme` — lighting/env only, not scene geometry. */

export const METAPHOR_THEME_PRESETS = {
  whiteboard: {
    background: '#f8fafc',
    skyTopColor: '#d4e0f0',
    skyHorizonColor: '#e9eff7',
    ambientIntensity: 0.65,
    hemisphere: ['#e0e7ff', '#1f2937', 0.45],
    directional: { position: [12, 16, 8], intensity: 0.85 },
    environment: null,
    buildingColor: '#9ec5fe',
    buildingRoofColor: '#c7ddff',
    slabColor: '#f3c95b',
    starColor: '#ffd166',
    groundColor: '#1a1a2e',
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
    // Clean/flat: restrained bloom, soft pale shadow, no depth-of-field.
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
      shadowScale: 46
    }
  },
  noir: {
    background: '#0b0f19',
    skyTopColor: '#04060c',
    skyHorizonColor: '#1a2433',
    ambientIntensity: 0.35,
    hemisphere: ['#1e293b', '#020617', 0.55],
    directional: { position: [8, 20, 6], intensity: 0.95 },
    environment: 'night',
    buildingColor: '#334155',
    buildingRoofColor: '#475569',
    slabColor: '#475569',
    starColor: '#f8fafc',
    groundColor: '#020617',
    labelColor: '#f1f5f9',
    labelOutline: '#0f172a',
    districtPalette: ['#1e293b', '#334155', '#475569', '#64748b'],
    clusterPalette: ['#e2e8f0', '#94a3b8', '#cbd5e1', '#f1f5f9'],
    linkColor: '#94a3b8',
    linkOpacity: 0.6,
    accentGlow: 0.5,
    componentChipColor: '#64748b',
    treeTrunkColor: '#1f2937',
    treeBranchColor: '#334155',
    treeLeafColor: '#94a3b8',
    terrainBaseColor: '#1e293b',
    binaryGlowColor: '#cbd5e1',
    nebulaPalette: ['#475569', '#334155', '#1e293b'],
    windowColor: '#fbbf24',
    windowEmissiveColor: '#fde047',
    spireColor: '#cbd5e1',
    districtGridColor: '#1e293b',
    crackColor: '#020617',
    slabTrimColor: '#64748b',
    waterColor: '#1e3a8a',
    treeAccentColor: '#94a3b8',
    nebulaDustColor: '#cbd5e1',
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
      shadowScale: 44
    }
  },
  arcade: {
    background: '#1a0533',
    skyTopColor: '#0c0220',
    skyHorizonColor: '#37105e',
    ambientIntensity: 0.5,
    hemisphere: ['#ff6b6b', '#2d1b69', 0.6],
    directional: { position: [14, 18, 10], intensity: 1.1 },
    environment: 'sunset',
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
      shadowScale: 44
    }
  },
  blueprint: {
    background: '#0a1e3a',
    skyTopColor: '#05122a',
    skyHorizonColor: '#123a63',
    ambientIntensity: 0.55,
    hemisphere: ['#1e3a8a', '#0a1e3a', 0.55],
    directional: { position: [10, 18, 8], intensity: 0.9 },
    environment: null,
    buildingColor: '#bfdbfe',
    buildingRoofColor: '#dbeafe',
    slabColor: '#e0f2fe',
    starColor: '#f0f9ff',
    groundColor: '#0a1e3a',
    labelColor: '#f0f9ff',
    labelOutline: '#0a1e3a',
    districtPalette: ['#1e3a8a', '#1d4ed8', '#2563eb', '#3b82f6'],
    clusterPalette: ['#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8'],
    linkColor: '#bae6fd',
    linkOpacity: 0.9,
    accentGlow: 0.55,
    componentChipColor: '#dbeafe',
    treeTrunkColor: '#bfdbfe',
    treeBranchColor: '#bae6fd',
    treeLeafColor: '#e0f2fe',
    terrainBaseColor: '#1e40af',
    binaryGlowColor: '#f0f9ff',
    nebulaPalette: ['#1d4ed8', '#2563eb', '#3b82f6'],
    windowColor: '#e0f2fe',
    windowEmissiveColor: '#bae6fd',
    spireColor: '#dbeafe',
    districtGridColor: '#1d4ed8',
    crackColor: '#0a1e3a',
    slabTrimColor: '#bae6fd',
    waterColor: '#38bdf8',
    treeAccentColor: '#f0f9ff',
    nebulaDustColor: '#bae6fd',
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
      shadowScale: 46
    }
  }
};

export function resolveMetaphorThemePreset(theme) {
  return METAPHOR_THEME_PRESETS[theme] ?? METAPHOR_THEME_PRESETS.whiteboard;
}

/** Safe defaults so the post-processing composer never reads undefined params. */
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
  shadowScale: 44
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
