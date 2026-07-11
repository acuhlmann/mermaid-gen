import { useEffect, useMemo, useRef } from 'react';
import {
  ACHIEVEMENTS,
  LEVELS,
  PRESTIGE_TIERS,
  getVariantPersona,
  tipForIndex
} from '../utils/slopitectCopy.js';

const VARIANT_ROW_ORDER = ['refine', 'innovate', 'goMad', 'critique', 'explain'];

const LEVEL_FLAVOR = [
  'The Slopitect notices you exist.',
  'Promoted to "knows where the Confluence is".',
  'Your name is now spelled correctly in stand-ups.',
  'Eligible to lead a Co-Design workshop. Bring snacks.',
  'You may now title slides without manager review.',
  'The board uses your diagram in a slide. No credit.',
  'You have a reserved seat at the architecture review.',
  'A junior asks how you "see the whole system". Smile.',
  'HR has approved a new title card. It says SLOPITECT.',
  'The CTO follows you on the org chart. Reluctantly.',
  'Mythic synergy unlocked. Recruiters appear in dreams.',
  'You ARE the architecture now. Frame this in HR.'
];

const NEXT_LEVEL_TAUNTS = [
  'so close the synergy can taste it.',
  'one good Co-Design away.',
  'a single stand-up could push you over.',
  'the gap is mostly vibes at this point.',
  'a microservice or two would do it.',
  'go bribe a stakeholder.',
  'just ship something. anything.',
  'stop reading this and slop.',
  "you're basically already there. legally.",
  'fewer naps, more Co-Design.'
];

function pickNextTaunt(seed) {
  const safe = Math.max(0, Number.isFinite(seed) ? Math.trunc(seed) : 0);
  return NEXT_LEVEL_TAUNTS[safe % NEXT_LEVEL_TAUNTS.length];
}

function levelFlavorFor(level) {
  const idx = Math.max(1, Math.min(LEVEL_FLAVOR.length, level)) - 1;
  return LEVEL_FLAVOR[idx];
}

function unlockedAchievementList(achievements) {
  if (!achievements || typeof achievements !== 'object') return [];
  return Object.keys(achievements).filter((id) => achievements[id] === true);
}

function nextPrestigeMilestone(totalRuns) {
  for (const tier of PRESTIGE_TIERS) {
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
  const panelRef = useRef(null);
  const ratio = Number.isFinite(progressRatio) ? Math.max(0, Math.min(1, progressRatio)) : 0;
  const fillWidth = `${Math.round(ratio * 1000) / 10}%`;
  const xpRemaining = isMaxLevel ? 0 : Math.max(0, Math.round((xpForNext ?? 0) - xpInto));

  const nextLevelEntry = useMemo(() => {
    const idx = LEVELS.findIndex((tier) => tier.level === level);
    if (idx < 0) return null;
    return LEVELS[idx + 1] ?? null;
  }, [level]);

  const ladder = useMemo(() => {
    const idx = LEVELS.findIndex((tier) => tier.level === level);
    if (idx < 0) return LEVELS.slice(0, 4);
    const from = Math.max(0, idx - 1);
    const to = Math.min(LEVELS.length, idx + 3);
    return LEVELS.slice(from, to);
  }, [level]);

  const unlocked = useMemo(() => unlockedAchievementList(achievements), [achievements]);
  const recentUnlocked = useMemo(
    () =>
      unlocked
        .slice(-3)
        .reverse()
        .map((id) => ACHIEVEMENTS[id])
        .filter(Boolean),
    [unlocked]
  );
  const totalTrackedAchievements = useMemo(
    () => Object.keys(ACHIEVEMENTS).filter((id) => id !== 'prestige').length,
    []
  );

  const nextPrestige = useMemo(() => nextPrestigeMilestone(totalRuns), [totalRuns]);
  const taunt = useMemo(() => pickNextTaunt(level + Math.floor(totalXp / 10)), [level, totalXp]);
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

  return (
    <div
      ref={panelRef}
      className="levelup-info-panel"
      role="dialog"
      aria-modal="false"
      aria-label={`Level ${level} progress`}
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
            <p className="levelup-info-flavor">{levelFlavorFor(level)}</p>
          </div>
          {typeof onClose === 'function' ? (
            <button
              type="button"
              className="levelup-info-close"
              onClick={onClose}
              aria-label="Close level details"
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
              <span aria-hidden="true">🏆</span> Max level. The slop is forever.
            </p>
          ) : (
            <p className="levelup-info-progress-caption">
              <strong>{xpRemaining} XP</strong> to{' '}
              <span className="levelup-info-next-name">
                {nextLevelEntry?.flair} {nextLevelEntry?.title || 'next tier'}
              </span>
              <span className="levelup-info-next-taunt"> — {taunt}</span>
            </p>
          )}
        </div>
      </header>

      <section className="levelup-info-section" aria-label="Level ladder">
        <h3 className="levelup-info-section-title">Slopitect Ladder™</h3>
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
                    you are here
                  </span>
                ) : reached ? (
                  <span className="levelup-info-ladder-pin is-done" aria-hidden="true">
                    cleared
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="levelup-info-section" aria-label="How to earn XP">
        <h3 className="levelup-info-section-title">Slop Engine</h3>
        <p className="levelup-info-section-lede">
          Every completed run pays XP. Stack streaks, combos and Go Mad depth to mint extra.
        </p>
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
                    +{persona.xpAward} base · +{persona.xpStreakBonus} per streak
                    {id === 'goMad' ? ' · +35 depth ≥ 3' : ''}
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
          <span className="levelup-info-bonus-chip">Combo</span>
          chain two personas in a row inside 6s for +8 (+4 per extra link).
        </p>
      </section>

      <section className="levelup-info-section" aria-label="Trophy shelf">
        <h3 className="levelup-info-section-title">Trophy Shelf</h3>
        <p className="levelup-info-section-lede">
          <strong>
            {unlocked.length} / {totalTrackedAchievements}
          </strong>{' '}
          unlocked.
          {prestigeShortLabel ? ` Tier: ${prestigeShortLabel}.` : ''}
          {nextPrestige
            ? ` Next: ${nextPrestige.label} in ${nextPrestige.gap} run${nextPrestige.gap === 1 ? '' : 's'}.`
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
          <p className="levelup-info-empty">
            No trophies yet. Hat-trick three personas in 30s to break the seal.
          </p>
        )}
      </section>

      <aside className="levelup-info-tip" data-testid="levelup-info-tip">
        <span className="levelup-info-tip-label">Slopitect Tip™</span>
        <span className="levelup-info-tip-text">{tip}</span>
      </aside>
    </div>
  );
}
