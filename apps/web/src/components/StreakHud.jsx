const VARIANT_CLASS = {
  refine: 'is-variant-refine',
  innovate: 'is-variant-innovate',
  goMad: 'is-variant-go-mad',
  critique: 'is-variant-critique',
  explain: 'is-variant-explain'
};

function formatVariantName(variant) {
  if (variant === 'goMad') return 'Go Mad';
  if (!variant) return '';
  return variant.charAt(0).toUpperCase() + variant.slice(1);
}

function renderToastContent(toast) {
  if (toast.kind === 'xp') return `+${toast.amount} XP`;
  if (toast.kind === 'streak') return `🔥 ${formatVariantName(toast.variant)} streak ×${toast.streak}`;
  if (toast.kind === 'combo') {
    return toast.label ? toast.label : `⚡ COMBO ×${toast.combo}`;
  }
  if (toast.kind === 'text') return toast.label || '';
  return '';
}

/**
 * Pure-render HUD overlay. App owns toast lifecycle: it stamps each emission
 * with a `createdAt` and removes them when the TTL elapses. Achievement banner
 * follows the same pattern.
 */
export default function StreakHud({ toasts = [], achievement = null }) {
  if (toasts.length === 0 && !achievement) return null;
  return (
    <div className="streak-hud-root" aria-hidden="true">
      <div className="streak-hud-toast-column">
        {toasts.map((toast) => {
          const cls = ['streak-hud-toast'];
          if (toast.kind === 'streak') cls.push('is-streak');
          if (toast.kind === 'combo') cls.push('is-combo');
          if (toast.variant && VARIANT_CLASS[toast.variant]) cls.push(VARIANT_CLASS[toast.variant]);
          return (
            <span key={toast.id} className={cls.join(' ')} data-testid={`streak-hud-${toast.kind}`}>
              {renderToastContent(toast)}
            </span>
          );
        })}
      </div>
      {achievement ? (
        <div className="streak-hud-achievement" role="status" aria-live="polite" data-testid="streak-hud-achievement">
          <div className="streak-hud-achievement-title">{achievement.title}</div>
          {achievement.subtitle ? (
            <div className="streak-hud-achievement-subtitle">{achievement.subtitle}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
