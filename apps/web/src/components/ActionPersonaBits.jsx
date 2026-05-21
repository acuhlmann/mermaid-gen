import { actionCssVariant, actionPersonaName } from '../utils/appActionPersonas.js';
import { getVariantPersona } from '../utils/slopitectCopy.js';

export function ActionPersonaIcon({ variant, fallback = '🏗️' }) {
  const persona = getVariantPersona(variant);
  return (
    <span className={`action-persona-icon is-${actionCssVariant(variant)}`} aria-hidden="true">
      {persona.avatarEmoji || fallback}
    </span>
  );
}

export function ActionPersonaRole({ variant, fallback = null, fallbackEmoji = '🛠️' }) {
  const persona = variant ? getVariantPersona(variant) : null;
  const label = persona?.name || fallback;
  const emoji = persona?.avatarEmoji || fallbackEmoji;
  if (!label) return null;
  return (
    <span className="slop-action-role">
      <span className="slop-action-role-emoji" aria-hidden="true">{emoji}</span>
      {variant ? actionPersonaName(variant) : label.replace(/^The\s+/i, '')}
    </span>
  );
}
