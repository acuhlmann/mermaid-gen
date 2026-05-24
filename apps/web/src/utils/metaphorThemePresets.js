/** Visual presets for metaphor `scene.theme` — lighting/env only, not scene geometry. */

export const METAPHOR_THEME_PRESETS = {
  whiteboard: {
    background: '#f8fafc',
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
    componentChipColor: '#fde68a'
  },
  noir: {
    background: '#0b0f19',
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
    componentChipColor: '#64748b'
  },
  arcade: {
    background: '#1a0533',
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
    componentChipColor: '#ffd166'
  }
};

export function resolveMetaphorThemePreset(theme) {
  return METAPHOR_THEME_PRESETS[theme] ?? METAPHOR_THEME_PRESETS.whiteboard;
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
