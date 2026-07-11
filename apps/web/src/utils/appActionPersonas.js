import { getVariantPersona, slopitectShortName } from './slopitectCopy.js';

/** CSS class suffix for an action variant — `goMad` ships as `go-mad` for kebab-case rules. */
export function actionCssVariant(variant) {
  return variant === 'goMad' ? 'go-mad' : variant;
}

/** Short persona name for an action variant (strips a leading `The `, except for overrides). */
export function actionPersonaName(variant) {
  const persona = getVariantPersona(variant);
  const override = slopitectShortName(variant);
  return override || persona.name.replace(/^The\s+/i, '');
}

/** Emoji avatar for an action variant, falling back to 🏗️. */
export function actionPersonaEmoji(variant) {
  return getVariantPersona(variant).avatarEmoji || '🏗️';
}

/** Full persona title for an action variant — `${name} · ${title}`. */
export function actionPersonaTitle(variant) {
  const persona = getVariantPersona(variant);
  return `${persona.name} · ${persona.title}`;
}
