import { getVariantPersona } from '../utils/slopitectCopy.js';

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
  const cast = variants.filter(Boolean);
  if (cast.length < 2 || !activeVariant) return null;

  const activeMeta = getVariantPersona(activeVariant);

  const rootClass = [
    'stakeholder-cast-strip',
    compact ? 'is-compact' : '',
    onSelectVariant ? 'is-selectable' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      className={rootClass}
      aria-label={`${activeMeta.name} is one of ${cast.length} stakeholders`}
    >
      <span className="stakeholder-cast-strip-tag">
        <span className="stakeholder-cast-strip-icon" aria-hidden="true">👥</span>
        <span className="stakeholder-cast-strip-label">Stakeholders</span>
      </span>
      <span className="stakeholder-cast-strip-avatars" role="group" aria-label="Stakeholder cast">
        {cast.map((variant) => {
          const meta = getVariantPersona(variant);
          const isActive = variant === activeVariant;
          const variantClass = cssVariant(variant);
          const sharedClass = [
            'stakeholder-cast-avatar',
            `is-${variantClass}`,
            isActive ? 'is-active' : ''
          ].filter(Boolean).join(' ');

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
                    ? `${meta.name} is speaking`
                    : `Ask ${meta.name} for commentary`
                }
                title={isActive ? meta.name : `Ask ${meta.name} for commentary`}
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
