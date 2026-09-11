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
import { dimSurfacesForSpace, raiseSurfacesForDaylight } from './metaphorDaylightSurfaces.js';
import { applyMoodToTheme } from './metaphorMoods.js';
import {
  resolveArchipelagoDaylightTheme,
  resolveGardenDaylightTheme,
  resolveMetaphorThemePreset,
  resolveRiverDaylightTheme,
  resolveSpaceSkyTheme,
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
 * The mirror of the table above: kinds whose scene paints **deep space**
 * whatever `scene.theme` says, mapped to the resolver that locks the sky keys
 * to it.
 *
 * These two tables are the same bug in opposite directions, and the galaxy's
 * half is worse-hidden. `GalaxySky` (mounted for galaxy and, by the renderer's
 * own comment, orrery) draws from `spaceTopColor`/`spaceHorizonColor` — a
 * DIFFERENT theme channel from the `skyTopColor`/`skyHorizonColor` every other
 * kind's sky sphere reads — so nothing in the theme was ever wrong, and nothing
 * was missing from a list. The two channels simply disagreed, on the one preset
 * whose sky is daylight, and every consumer of the sky keys believed the wrong
 * one. See `resolveSpaceSkyTheme` for the six of them.
 */
export const SPACE_LOCKED_KINDS = Object.freeze({
  galaxy: resolveSpaceSkyTheme,
  orrery: resolveSpaceSkyTheme
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
  // The lock fixes the atmosphere; the floor fixes the surfaces that atmosphere
  // lights. It runs here rather than inside each resolver for the reason the
  // table itself exists — a kind added to `DAYLIGHT_LOCKED_KINDS` tomorrow gets
  // it without anyone remembering to — and BEFORE the mood, because a mood
  // re-tints the sky and the floor walks toward the sky the scene paints.
  const daylit = lock ? raiseSurfacesForDaylight(lock(base)) : base;
  // scene.mood re-tints the atmosphere only — never the encodings. Daylight
  // scenes take a softened blend so they stay readable.
  const withMood = applyMoodToTheme(daylit, moodId, { soften: Boolean(lock) });
  // The space lock runs AFTER the mood, where the daylight one runs before, and
  // the asymmetry is not an oversight. A daylight scene's own sky sphere reads
  // keys the lock rewrote, so a mood re-tinting them at dusk moves the backdrop
  // and everything agreeing with it together. `GalaxySky` reads the space
  // channel, which no mood touches — so a mood that rewrote `skyTopColor` would
  // put the IBL, the rim light and the clear colour back off the sky actually
  // painted, which is the whole defect. The mood still owns the ambient, the
  // key light and `moodFx`, which is the part of a mood a space scene can
  // honestly express.
  // …and it carries the same second half the daylight lock does, in the other
  // direction: the lock fixes the atmosphere, the ceiling fixes the one surface
  // that atmosphere cannot account for. Only a galaxy-dominant COMPOSITE draws
  // a ground at all, which is exactly how `raiseSurfacesForDaylight` behaves.
  const spaceLock = kind ? SPACE_LOCKED_KINDS[kind] : undefined;
  return spaceLock ? dimSurfacesForSpace(spaceLock(withMood)) : withMood;
}
