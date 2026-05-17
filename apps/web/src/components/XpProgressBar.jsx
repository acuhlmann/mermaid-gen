import { useEffect, useRef, useState } from 'react';

/**
 * Compact "Lvl X · XP/Next" pill rendered in the brand chrome.
 *
 * Animates the progress bar fill when the underlying ratio changes, and
 * flashes the wrapper momentarily when xp crosses a level boundary so a
 * fresh fill reads as "you just levelled". Pure presentation — App.jsx
 * owns the level / xp state and passes it down.
 *
 * When `onClick` is supplied, the pill renders as a button that toggles
 * the level info popover. `expanded` reflects the open state for ARIA.
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
  variant = null,
  onClick = null,
  expanded = false,
  controlsId = null
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
    variant ? `is-variant-${variant}` : '',
    onClick ? 'is-interactive' : '',
    expanded ? 'is-expanded' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const ariaLabel = isMaxLevel
    ? `Level ${level}, max level, ${Math.round(totalXp)} XP total${onClick ? ' — tap for details' : ''}`
    : `Level ${level}, ${Math.round(xpInto)} of ${Math.round(xpForNext ?? 0)} XP to next level${onClick ? ' — tap for details' : ''}`;

  const sharedChildren = (
    <>
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
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        aria-label={ariaLabel}
        aria-expanded={expanded}
        aria-controls={controlsId ?? undefined}
        aria-haspopup="dialog"
        onClick={(event) => {
          event.stopPropagation();
          onClick(event);
        }}
        data-testid="xp-progress-bar"
        data-xp-bar-anchor="true"
      >
        {sharedChildren}
      </button>
    );
  }

  return (
    <div
      className={className}
      role="meter"
      aria-label={ariaLabel}
      aria-valuenow={Math.round(xpInto)}
      aria-valuemin={0}
      aria-valuemax={Math.round(xpForNext ?? Math.max(1, xpInto))}
      data-testid="xp-progress-bar"
    >
      {sharedChildren}
    </div>
  );
}
