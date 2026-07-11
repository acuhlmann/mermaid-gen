import { getVariantPersona } from '../utils/slopitectCopy.js';
import { useUiCopy } from '../i18n/useUiLocale.js';
import { formatLocale } from '../i18n/formatLocale.js';

function cssVariant(variant) {
  return variant === 'goMad' ? 'go-mad' : variant;
}

/**
 * Compact "one of many stakeholders" chrome: group tag + avatars for the cast.
 * Shown while a single persona is speaking or thinking.
 */
export default function StakeholderCastStrip({
  variants = [],
  activeVariant = null,
  className = '',
  compact = false,
  onSelectVariant,
  disabled = false
}) {
  const { controls } = useUiCopy();
  const stk = controls.stakeholders;
  const cast = variants.filter(Boolean);
  if (cast.length < 2 || !activeVariant) return null;

  const activeMeta = getVariantPersona(activeVariant);

  const rootClass = [
    'stakeholder-cast-strip',
    compact ? 'is-compact' : '',
    onSelectVariant ? 'is-selectable' : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rootClass}
      aria-label={formatLocale(stk.castOneOfMany, { name: activeMeta.name, count: cast.length })}
    >
      <span className="stakeholder-cast-strip-tag">
        <span className="stakeholder-cast-strip-icon" aria-hidden="true">
          👥
        </span>
        <span className="stakeholder-cast-strip-label">{stk.castLabel}</span>
      </span>
      <span className="stakeholder-cast-strip-avatars" role="group" aria-label={stk.castGroup}>
        {cast.map((variant) => {
          const meta = getVariantPersona(variant);
          const isActive = variant === activeVariant;
          const variantClass = cssVariant(variant);
          const sharedClass = [
            'stakeholder-cast-avatar',
            `is-${variantClass}`,
            isActive ? 'is-active' : ''
          ]
            .filter(Boolean)
            .join(' ');

          if (onSelectVariant) {
            return (
              <button
                key={variant}
                type="button"
                className={`stakeholder-cast-avatar-btn ${sharedClass}`}
                disabled={disabled || isActive}
                aria-current={isActive ? 'true' : undefined}
                aria-label={
                  isActive
                    ? formatLocale(stk.castSpeaking, { name: meta.name })
                    : formatLocale(stk.castAskCommentary, { name: meta.name })
                }
                title={
                  isActive ? meta.name : formatLocale(stk.castAskCommentary, { name: meta.name })
                }
                onClick={(event) => {
                  event.stopPropagation();
                  if (!isActive) onSelectVariant(variant);
                }}
              >
                {meta.avatarEmoji || '🏗️'}
              </button>
            );
          }

          return (
            <span
              key={variant}
              className={sharedClass}
              title={meta.name}
              aria-hidden={isActive ? undefined : true}
            >
              {meta.avatarEmoji || '🏗️'}
            </span>
          );
        })}
      </span>
    </div>
  );
}
