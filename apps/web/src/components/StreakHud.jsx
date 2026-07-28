import { useUiCopy } from '../i18n/useUiLocale.js';

const VARIANT_CLASS = {
  gilfoyle: 'is-variant-gilfoyle',
  dinesh: 'is-variant-dinesh',
  erlich: 'is-variant-erlich',
  russ: 'is-variant-russ',
  jared: 'is-variant-jared',
  explain: 'is-variant-explain'
};

function formatVariantName(variant, actions) {
  if (!variant) return '';
  return actions[variant] ?? variant.charAt(0).toUpperCase() + variant.slice(1);
}

function renderToastContent(toast, actions, hud) {
  if (toast.kind === 'xp') {
    const variantName = formatVariantName(toast.variant, actions);
    return (
      <>
        <span className="streak-hud-toast-amount">+{toast.amount} XP</span>
        {variantName ? <span className="streak-hud-toast-source">{variantName}</span> : null}
        {toast.bonus > 0 ? (
          <span className="streak-hud-toast-bonus">
            ⚡ +{toast.bonus} {hud.bonus}
          </span>
        ) : null}
      </>
    );
  }
  if (toast.kind === 'streak') {
    const variantName = formatVariantName(toast.variant, actions);
    return `🔥 ${variantName} ${hud.streak} ×${toast.streak}`;
  }
  if (toast.kind === 'combo') {
    return toast.label ? toast.label : `⚡ ${hud.combo} ×${toast.combo}`;
  }
  if (toast.kind === 'text') return toast.label || '';
  if (toast.kind === 'tip') return toast.label || '';
  return '';
}

/**
 * Pure-render HUD overlay. App owns toast lifecycle: it stamps each emission
 * with a `createdAt` and removes them when the TTL elapses. Achievement
 * banner and the level-up banner follow the same pattern. Level-up renders
 * with a distinctive promotion ribbon and confetti-friendly styling so it
 * doesn't blend in with achievement unlocks.
 */
export default function StreakHud({ toasts = [], achievement = null, levelUp = null }) {
  const { controls } = useUiCopy();
  const hud = controls.gamificationHud;
  const actions = controls.actions;
  if (toasts.length === 0 && !achievement && !levelUp) return null;
  return (
    <div className="streak-hud-root" aria-hidden="true">
      <div className="streak-hud-toast-column">
        {toasts.map((toast) => {
          const cls = ['streak-hud-toast'];
          if (toast.kind === 'streak') cls.push('is-streak');
          if (toast.kind === 'combo') cls.push('is-combo');
          if (toast.kind === 'xp') cls.push('is-xp');
          if (toast.kind === 'tip') cls.push('is-tip');
          if (toast.variant && VARIANT_CLASS[toast.variant]) cls.push(VARIANT_CLASS[toast.variant]);
          return (
            <span key={toast.id} className={cls.join(' ')} data-testid={`streak-hud-${toast.kind}`}>
              {renderToastContent(toast, actions, hud)}
            </span>
          );
        })}
      </div>
      {levelUp ? (
        <div
          className="streak-hud-level-up"
          role="status"
          aria-live="polite"
          data-testid="streak-hud-level-up"
        >
          <span className="streak-hud-level-up-stripe" aria-hidden="true" />
          <div className="streak-hud-level-up-body">
            <div className="streak-hud-level-up-eyebrow">{levelUp.bannerTitle || hud.levelUp}</div>
            <div className="streak-hud-level-up-title">
              <span className="streak-hud-level-up-flair" aria-hidden="true">
                {levelUp.flair || '✨'}
              </span>
              {`${hud.lvlPrefix} ${levelUp.to}`}
              <span className="streak-hud-level-up-name"> · {levelUp.title}</span>
            </div>
            {levelUp.bannerSubtitle ? (
              <div className="streak-hud-level-up-subtitle">{levelUp.bannerSubtitle}</div>
            ) : null}
          </div>
        </div>
      ) : null}
      {achievement ? (
        <div
          className="streak-hud-achievement"
          role="status"
          aria-live="polite"
          data-testid="streak-hud-achievement"
        >
          <div className="streak-hud-achievement-title">{achievement.title}</div>
          {achievement.subtitle ? (
            <div className="streak-hud-achievement-subtitle">{achievement.subtitle}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
