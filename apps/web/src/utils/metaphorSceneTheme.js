/**
 * The scene theme a metaphor is actually drawn with: the preset for
 * `scene.theme`, the daylight lock for the kinds that paint their own sky, then
 * the mood re-tint.
 *
 * This ladder lived inline in `MetaphorRenderer.jsx`, where its only reader was
 * a `useMemo` and nothing could test it. That cost a whole kind: **the tree was
 * missing from the daylight branch** while `TreeScene` resolved its own palette
 * privately, so the postfx the renderer handed `MetaphorEffects` stayed the dark
 * theme's — and a bloom threshold below the tree's daylight sky erased the scene
 * to a milky rectangle on noir, arcade and blueprint, at every viewport. A list
 * of kinds is exactly the kind of thing that goes stale silently when it is a
 * chain of `else if` inside a 1200-line component.
 *
 * `DAYLIGHT_LOCKED_KINDS` is therefore the list, exported, so a test can say
 * "every kind that paints its own daylight sky is on it" rather than a reader
 * having to notice an omission.
 */
import { applyMoodToTheme } from './metaphorMoods.js';
import {
  resolveArchipelagoDaylightTheme,
  resolveGardenDaylightTheme,
  resolveMetaphorThemePreset,
  resolveRiverDaylightTheme,
  resolveTreeNatureTheme
} from './metaphorThemePresets.js';

/**
 * Kinds whose scene paints a daylight sky whatever `scene.theme` says, mapped
 * to the resolver that locks the rest of the theme to it.
 *
 * Being on this list means three things travel together and cannot drift apart:
 * the sky the scene draws, the `skyTopColor`/`skyHorizonColor` that
 * `SceneEnvironment` reflects into every material, and the bloom threshold the
 * backdrop is measured against. A kind on the list also takes the softened mood
 * blend, because a full-strength storm over a daylight world is unreadable.
 */
export const DAYLIGHT_LOCKED_KINDS = Object.freeze({
  river: resolveRiverDaylightTheme,
  garden: resolveGardenDaylightTheme,
  archipelago: resolveArchipelagoDaylightTheme,
  tree: resolveTreeNatureTheme
});

/**
 * @param {object} args
 * @param {string} args.themeId — `scene.theme`
 * @param {string | null | undefined} args.kind — the kind whose sky is painted;
 *   for a composite this is the dominant layer, not `'composite'`
 * @param {string | null | undefined} args.moodId — `scene.mood`
 * @returns {Record<string, unknown>} the resolved theme
 */
export function resolveMetaphorSceneTheme({ themeId, kind, moodId }) {
  const base = resolveMetaphorThemePreset(themeId);
  const lock = kind ? DAYLIGHT_LOCKED_KINDS[kind] : undefined;
  // scene.mood re-tints the atmosphere only — never the encodings. Daylight
  // scenes take a softened blend so they stay readable.
  return applyMoodToTheme(lock ? lock(base) : base, moodId, { soften: Boolean(lock) });
}
