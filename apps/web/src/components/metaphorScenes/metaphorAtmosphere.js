/**
 * Scene atmosphere (depth haze) maths for metaphor scenes. The `<AdaptiveFog>`
 * component that applies it lives in AdaptiveFog.jsx.
 *
 * Fog used to be specified in absolute world units — the city default was
 * `near 42 / far 150`, and the mood presets ran `near 20…48`. But the camera
 * distance is not a constant: `SceneFrame` fits the content, so a 5-item cycle
 * is framed from ~20 units and a 40-node tree grove from ~70. The same "near 40"
 * therefore lands behind a small scene (invisible) and *in front of* a large one
 * (the whole subject washes to the fog colour). That is the reported "trees are
 * too foggy when viewed at distance", and it hit terrain and city just as hard.
 *
 * So haze is parameterised relative to the fit instead. Given camera distance D
 * and content radius R, a mood's `haze` (0–1) places the fog band at
 *
 *     near = D + R·(1 − 2·haze)        far = near + R·(2 + 6·(1 − haze))
 *
 * haze 0 starts the band a full radius BEHIND the subject (pure horizon
 * softening); haze 1 brings it a radius in front (a storm closing in). Because
 * both ends are measured in radii, a scene looks the same whether it holds 5
 * items or 60 — which is the property the absolute units never had.
 */

/** Barely-there horizon softening for grounded kinds that set no mood. */
export const DEFAULT_GROUND_HAZE = 0.12;

/** Deep-space kinds draw their own star fields; ground haze reads wrong there. */
const FOGLESS_KINDS = new Set(['galaxy', 'orrery']);

export function sceneWantsHaze(kind) {
  return !FOGLESS_KINDS.has(kind);
}

/**
 * Fog band for a fit. The invariant that matters: `near` grows with the camera
 * distance, so pulling back can never walk the subject into the haze.
 *
 * @param {number} distance — camera distance to the content centre
 * @param {number} radius — content bounding radius
 * @param {number} haze — 0 (horizon only) … 1 (closes in)
 * @returns {{ near: number, far: number }}
 */
export function hazeBand(distance, radius, haze) {
  const h = Math.max(0, Math.min(1, haze));
  const r = Math.max(1, radius);
  const near = Math.max(distance * 0.05, distance + r * (1 - 2 * h));
  const far = near + r * (2 + 6 * (1 - h));
  return { near, far };
}
