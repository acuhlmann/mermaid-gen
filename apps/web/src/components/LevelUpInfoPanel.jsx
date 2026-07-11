import { useEffect, useMemo, useRef } from 'react';
import { useUiCopy } from '../i18n/useUiLocale.js';
import { getVariantPersona, tipForIndex } from '../utils/slopitectCopy.js';

const VARIANT_ROW_ORDER = ['refine', 'innovate', 'goMad', 'critique', 'explain'];

function pickNextTaunt(taunts, seed) {
  if (!taunts?.length) return '';
  const safe = Math.max(0, Number.isFinite(seed) ? Math.trunc(seed) : 0);
  return taunts[safe % taunts.length];
}

function levelFlavorFor(levelFlavors, level) {
  if (!levelFlavors?.length) return '';
  const idx = Math.max(1, Math.min(levelFlavors.length, level)) - 1;
  return levelFlavors[idx];
}

function unlockedAchievementList(achievements) {
  if (!achievements || typeof achievements !== 'object') return [];
  return Object.keys(achievements).filter((id) => achievements[id] === true);
}

function nextPrestigeMilestone(prestigeTiers, totalRuns) {
  for (const tier of prestigeTiers) {
    if (totalRuns < tier.threshold) {
      return { label: tier.label, gap: tier.threshold - totalRuns };
    }
  }
  return null;
}

/**
 * Popover anchored to the XP progress bar in the brand chrome. Surfaces the
 * full level ladder, the XP rules that drive the bar, achievement progress,
 * and a rotating Slopitect tip. Pure presentation — the parent owns open/close.
 */
export default function LevelUpInfoPanel({
  level,
  levelTitle,
  levelFlair,
  levelShortLabel,
  progressRatio = 0,
  xpInto = 0,
  xpForNext = null,
  totalXp = 0,
  isMaxLevel = false,
  prestigeShortLabel,
  totalRuns = 0,
  runsByVariant = {},
  achievements = {},
  onClose
}) {
  const { slopitect, controls } = useUiCopy();
  const levels = slopitect.LEVELS ?? [];
  const prestigeTiers = slopitect.PRESTIGE_TIERS ?? [];
  const achievementCopy = slopitect.ACHIEVEMENTS ?? {};
  const panel = slopitect.LEVEL_PANEL ?? {};

  const panelRef = useRef(null);
  const ratio = Number.isFinite(progressRatio) ? Math.max(0, Math.min(1, progressRatio)) : 0;
  const fillWidth = `${Math.round(ratio * 1000) / 10}%`;
  const xpRemaining = isMaxLevel ? 0 : Math.max(0, Math.round((xpForNext ?? 0) - xpInto));

  const nextLevelEntry = useMemo(() => {
    const idx = levels.findIndex((tier) => tier.level === level);
    if (idx < 0) return null;
    return levels[idx + 1] ?? null;
  }, [level, levels]);

  const ladder = useMemo(() => {
    const idx = levels.findIndex((tier) => tier.level === level);
    if (idx < 0) return levels.slice(0, 4);
    const from = Math.max(0, idx - 1);
    const to = Math.min(levels.length, idx + 3);
    return levels.slice(from, to);
  }, [level, levels]);

  const unlocked = useMemo(() => unlockedAchievementList(achievements), [achievements]);
  const recentUnlocked = useMemo(
    () =>
      unlocked
        .slice(-3)
        .reverse()
        .map((id) => achievementCopy[id])
        .filter(Boolean),
    [unlocked, achievementCopy]
  );
  const totalTrackedAchievements = useMemo(
    () => Object.keys(achievementCopy).filter((id) => id !== 'prestige').length,
    [achievementCopy]
  );

  const nextPrestige = useMemo(
    () => nextPrestigeMilestone(prestigeTiers, totalRuns),
    [prestigeTiers, totalRuns]
  );
  const taunt = useMemo(
    () => pickNextTaunt(panel.nextLevelTaunts, level + Math.floor(totalXp / 10)),
    [panel.nextLevelTaunts, level, totalXp]
  );
  const tip = useMemo(() => tipForIndex(level + (unlocked.length % 7)), [level, unlocked.length]);

  useEffect(() => {
    if (typeof onClose !== 'function') return undefined;
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    function onPointer(event) {
      const root = panelRef.current;
      if (!root) return;
      if (root.contains(event.target)) return;
      const anchor = event.target.closest?.('[data-xp-bar-anchor="true"]');
      if (anchor) return;
      onClose();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [onClose]);

  useEffect(() => {
    const root = panelRef.current;
    if (!root) return;
    const focusable = root.querySelector('button, [tabindex]:not([tabindex="-1"])');
    focusable?.focus?.({ preventScroll: true });
  }, []);

  const runsGapLabel = nextPrestige?.gap === 1 ? panel.trophyRunsGap : panel.trophyRunsGapPlural;

  return (
    <div
      ref={panelRef}
      className="levelup-info-panel"
      role="dialog"
      aria-modal="false"
      aria-label={`Level ${level} ${panel.progressAriaLabel ?? 'progress'}`}
      data-testid="levelup-info-panel"
    >
      <header className="levelup-info-head">
        <div className="levelup-info-head-row">
          <span className="levelup-info-flair" aria-hidden="true">
            {levelFlair || '⭐'}
          </span>
          <div className="levelup-info-head-text">
            <div className="levelup-info-eyebrow">
              {levelShortLabel || `Lvl ${level}`} ·{' '}
              <span className="levelup-info-eyebrow-xp">{Math.round(totalXp)} XP</span>
            </div>
            <h2 className="levelup-info-title">{levelTitle || 'Slopitect'}</h2>
            <p className="levelup-info-flavor">{levelFlavorFor(panel.levelFlavor, level)}</p>
          </div>
          {typeof onClose === 'function' ? (
            <button
              type="button"
              className="levelup-info-close"
              onClick={onClose}
              aria-label={panel.closeLevelDetails ?? 'Close level details'}
            >
              ✕
            </button>
          ) : null}
        </div>
        <div className="levelup-info-progress">
          <div className="levelup-info-progress-track" aria-hidden="true">
            <div className="levelup-info-progress-fill" style={{ width: fillWidth }} />
          </div>
          {isMaxLevel ? (
            <p className="levelup-info-progress-caption is-max">
              <span aria-hidden="true">🏆</span> {panel.maxLevelCaption}
            </p>
          ) : (
            <p className="levelup-info-progress-caption">
              <strong>{xpRemaining} XP</strong> {panel.xpToNextPrefix}{' '}
              <span className="levelup-info-next-name">
                {nextLevelEntry?.flair} {nextLevelEntry?.title || panel.nextTierFallback}
              </span>
              <span className="levelup-info-next-taunt"> — {taunt}</span>
            </p>
          )}
        </div>
      </header>

      <section className="levelup-info-section" aria-label={controls.insights.levelLadder}>
        <h3 className="levelup-info-section-title">{panel.ladderTitle}</h3>
        <ol className="levelup-info-ladder">
          {ladder.map((tier) => {
            const reached = tier.level <= level;
            const current = tier.level === level;
            return (
              <li
                key={tier.level}
                className={`levelup-info-ladder-row ${reached ? 'is-reached' : ''} ${current ? 'is-current' : ''}`}
              >
                <span className="levelup-info-ladder-flair" aria-hidden="true">
                  {tier.flair}
                </span>
                <span className="levelup-info-ladder-label">
                  <span className="levelup-info-ladder-title">{tier.title}</span>
                  <span className="levelup-info-ladder-xp">{tier.xp} XP</span>
                </span>
                {current ? (
                  <span className="levelup-info-ladder-pin" aria-hidden="true">
                    {panel.youAreHere}
                  </span>
                ) : reached ? (
                  <span className="levelup-info-ladder-pin is-done" aria-hidden="true">
                    {panel.cleared}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="levelup-info-section" aria-label={controls.insights.earnXp}>
        <h3 className="levelup-info-section-title">{panel.engineTitle}</h3>
        <p className="levelup-info-section-lede">{panel.engineLede}</p>
        <ul className="levelup-info-variants">
          {VARIANT_ROW_ORDER.map((id) => {
            const persona = getVariantPersona(id);
            if (!persona) return null;
            const runs = runsByVariant?.[id] ?? 0;
            return (
              <li key={id} className={`levelup-info-variant is-${id}`}>
                <span className="levelup-info-variant-emoji" aria-hidden="true">
                  {persona.avatarEmoji}
                </span>
                <span className="levelup-info-variant-text">
                  <span className="levelup-info-variant-name">{persona.name}</span>
                  <span className="levelup-info-variant-meta">
                    +{persona.xpAward} base · +{persona.xpStreakBonus} {panel.variantMetaSuffix}
                    {id === 'goMad' ? ` ${panel.goMadDepthBonus}` : ''}
                  </span>
                </span>
                <span
                  className="levelup-info-variant-runs"
                  title={`${runs} ${id} run${runs === 1 ? '' : 's'} on record`}
                >
                  ×{runs}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="levelup-info-bonus-line">
          <span className="levelup-info-bonus-chip">{panel.comboChip}</span>
          {panel.comboLine}
        </p>
      </section>

      <section className="levelup-info-section" aria-label={controls.insights.trophyShelf}>
        <h3 className="levelup-info-section-title">{panel.trophyTitle}</h3>
        <p className="levelup-info-section-lede">
          <strong>
            {unlocked.length} / {totalTrackedAchievements}
          </strong>{' '}
          {panel.trophyLedeUnlocked}
          {prestigeShortLabel ? ` ${panel.tierLabel} ${prestigeShortLabel}.` : ''}
          {nextPrestige
            ? ` ${panel.trophyNextPrestige} ${nextPrestige.label} in ${nextPrestige.gap} ${runsGapLabel}.`
            : ''}
        </p>
        {recentUnlocked.length > 0 ? (
          <ul className="levelup-info-trophies">
            {recentUnlocked.map((a) => (
              <li key={a.id} className="levelup-info-trophy">
                <span className="levelup-info-trophy-title">{a.title}</span>
                <span className="levelup-info-trophy-sub">{a.subtitle}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="levelup-info-empty">{panel.trophyEmpty}</p>
        )}
      </section>

      <aside className="levelup-info-tip" data-testid="levelup-info-tip">
        <span className="levelup-info-tip-label">{panel.tipLabel}</span>
        <span className="levelup-info-tip-text">{tip}</span>
      </aside>
    </div>
  );
}
