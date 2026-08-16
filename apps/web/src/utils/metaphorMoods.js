import * as THREE from 'three';

/**
 * Mood presets for the optional `scene.mood` DSL field. A mood re-tints the
 * resolved theme's atmosphere — sky gradient, fog, light colour, ambient
 * particles — so the scene's emotional register matches the user's topic
 * (a post-mortem feels like a storm, a launch like embers). Moods NEVER touch
 * spatial encodings (positions, sizes, colours of items); they only change the
 * world the items stand in.
 *
 * `day` is the neutral default and deliberately returns no overrides.
 */

const MOOD_PRESETS = {
  dawn: {
    skyTopColor: '#6f5f9b',
    skyHorizonColor: '#ffd9a8',
    fog: { color: '#e8c9a8', haze: 0.24 },
    directionalColor: '#ffd9a8',
    directionalScale: 0.92,
    ambientScale: 0.95,
    particles: { type: 'petals', color: '#ffd6a5', color2: '#ffb8c6', count: 16 },
    particleSpaceSafe: false
  },
  dusk: {
    skyTopColor: '#3b2f5a',
    skyHorizonColor: '#ff9e6d',
    fog: { color: '#c98a6a', haze: 0.3 },
    directionalColor: '#ffb37a',
    directionalScale: 0.78,
    ambientScale: 0.85,
    particles: { type: 'fireflies', color: '#ffcf8a', count: 22 },
    particleSpaceSafe: false
  },
  night: {
    skyTopColor: '#050914',
    skyHorizonColor: '#101c33',
    fog: { color: '#0a1224', haze: 0.26 },
    directionalColor: '#8fb2e8',
    directionalScale: 0.5,
    ambientScale: 0.62,
    particles: { type: 'stars', color: '#dbeafe', count: 34 },
    particleSpaceSafe: true
  },
  storm: {
    skyTopColor: '#1c2330',
    skyHorizonColor: '#3a4356',
    fog: { color: '#39424f', haze: 0.62 },
    directionalColor: '#9aa7bd',
    directionalScale: 0.55,
    ambientScale: 0.72,
    particles: { type: 'rain', color: '#a8c4e0', count: 42 },
    particleSpaceSafe: false
  },
  ember: {
    skyTopColor: '#221016',
    skyHorizonColor: '#57281f',
    fog: { color: '#331915', haze: 0.34 },
    directionalColor: '#ff9a5c',
    directionalScale: 0.85,
    ambientScale: 0.78,
    particles: { type: 'embers', color: '#ffb35c', color2: '#ff7847', count: 24 },
    particleSpaceSafe: true
  },
  aurora: {
    skyTopColor: '#06121f',
    skyHorizonColor: '#123b3a',
    fog: { color: '#0c2430', haze: 0.2 },
    directionalColor: '#7be8c9',
    directionalScale: 0.72,
    ambientScale: 0.75,
    particles: { type: 'aurora', color: '#5eead4', color2: '#a78bfa', count: 3 },
    particleSpaceSafe: true
  }
};

function blendHex(base, target, amount) {
  const out = new THREE.Color(base);
  out.lerp(new THREE.Color(target), amount);
  return `#${out.getHexString()}`;
}

/**
 * Layer a mood over a resolved theme preset. Returns the theme unchanged for
 * absent/unknown/`day` moods. `soften` (used for daylight-locked outdoor kinds
 * like river/garden/archipelago) blends 55% toward the mood instead of a full
 * replacement so those scenes stay readable.
 *
 * The returned theme carries a `moodFx` side-channel ({ fog, particles,
 * particleSpaceSafe }) that MetaphorRenderer reads; it is not a colour key.
 */
export function applyMoodToTheme(theme, moodId, { soften = false } = {}) {
  if (!moodId || moodId === 'day') return theme;
  const preset = MOOD_PRESETS[moodId];
  if (!preset) return theme;

  const mix = soften ? 0.55 : 1;
  const directionalScale = soften
    ? 1 - (1 - preset.directionalScale) * mix
    : preset.directionalScale;
  const ambientScale = soften ? 1 - (1 - preset.ambientScale) * mix : preset.ambientScale;

  return {
    ...theme,
    background: blendHex(theme.background ?? preset.skyTopColor, preset.skyTopColor, mix),
    skyTopColor: blendHex(theme.skyTopColor ?? theme.background, preset.skyTopColor, mix),
    skyHorizonColor: blendHex(
      theme.skyHorizonColor ?? theme.background,
      preset.skyHorizonColor,
      mix
    ),
    ambientIntensity: (theme.ambientIntensity ?? 0.6) * ambientScale,
    directional: {
      ...theme.directional,
      intensity: (theme.directional?.intensity ?? 1) * directionalScale,
      color: soften ? blendHex('#ffffff', preset.directionalColor, mix) : preset.directionalColor
    },
    moodFx: {
      fog: preset.fog
        ? {
            ...preset.fog,
            color: soften
              ? blendHex(theme.skyHorizonColor ?? '#c9e8f0', preset.fog.color, mix)
              : preset.fog.color,
            // Softened moods pull the haze back toward the horizon so daylight
            // scenes stay clear. `haze` is a fraction of the content radius, not
            // a world distance — see metaphorAtmosphere.js.
            haze: soften ? preset.fog.haze * 0.5 : preset.fog.haze
          }
        : null,
      particles: preset.particles ?? null,
      particleSpaceSafe: Boolean(preset.particleSpaceSafe)
    }
  };
}
