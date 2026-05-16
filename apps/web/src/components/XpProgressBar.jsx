import { useEffect, useRef, useState } from 'react';

/**
 * Compact "Lvl X · XP/Next" pill rendered in the brand chrome.
 *
 * Animates the progress bar fill when the underlying ratio changes, and
 * flashes the wrapper momentarily when xp crosses a level boundary so a
 * fresh fill reads as "you just levelled". Pure presentation — App.jsx
 * owns the level / xp state and passes it down.
 */
export default function XpProgressBar({
  level,
  short,
  flair,
  progressRatio = 0,
  xpInto = 0,
  xpForNext = null,
  totalXp = 0,
  isMaxLevel = false,
  flashKey = 0,
  variant = null
}) {
  const ratio = Number.isFinite(progressRatio) ? Math.max(0, Math.min(1, progressRatio)) : 0;
  const fillWidth = `${Math.round(ratio * 1000) / 10}%`;
  const widthLabel = isMaxLevel ? 'MAX' : `${Math.round(xpInto)}/${Math.round(xpForNext ?? 0)}`;
  const previousFlashKey = useRef(flashKey);
  const [flashing, setFlashing] = useState(false);
  useEffect(() => {
    if (flashKey === previousFlashKey.current) return undefined;
    previousFlashKey.current = flashKey;
    setFlashing(true);
    const handle = setTimeout(() => setFlashing(false), 2400);
    return () => clearTimeout(handle);
  }, [flashKey]);

  const className = [
    'xp-progress-bar',
    flashing ? 'is-level-up' : '',
    isMaxLevel ? 'is-max-level' : '',
    variant ? `is-variant-${variant}` : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      role="meter"
      aria-label={
        isMaxLevel
          ? `Level ${level}, max level, ${Math.round(totalXp)} XP total`
          : `Level ${level}, ${Math.round(xpInto)} of ${Math.round(xpForNext ?? 0)} XP to next level`
      }
      aria-valuenow={Math.round(xpInto)}
      aria-valuemin={0}
      aria-valuemax={Math.round(xpForNext ?? Math.max(1, xpInto))}
      data-testid="xp-progress-bar"
    >
      <span className="xp-progress-bar-flair" aria-hidden="true">
        {flair || '⭐'}
      </span>
      <span className="xp-progress-bar-level">{short || `Lvl ${level}`}</span>
      <span className="xp-progress-bar-track" aria-hidden="true">
        <span className="xp-progress-bar-fill" style={{ width: fillWidth }} />
        <span className="xp-progress-bar-spark" />
      </span>
      <span className="xp-progress-bar-xp" aria-hidden="true">
        {widthLabel}
      </span>
    </div>
  );
}
