import { useEffect } from 'react';

/**
 * First-run coach tips that walk newcomers through the real desk chrome —
 * one control at a time — without duplicating the Deliverable format strip.
 * Auto-advances with the tour step timer; Next / Skip dismiss or advance.
 */
export default function EntryDeskPointers({
  pointers,
  activeId = null,
  eyebrow = null,
  progress = null,
  onDismiss,
  onAdvance,
  nextLabel = 'Next',
  doneLabel = 'Start working',
  skipLabel = 'Skip'
}) {
  const items = Array.isArray(pointers) ? pointers.filter((p) => p && p.text) : [];
  const tip = activeId ? items.find((p) => p.id === activeId) : null;
  const isLast =
    progress && typeof progress.index === 'number' && typeof progress.total === 'number'
      ? progress.index >= progress.total - 1
      : false;

  useEffect(() => {
    if (!onDismiss || !tip) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDismiss, tip]);

  if (!tip) return null;

  return (
    <div
      className={`entry-desk-pointers entry-desk-pointers--tour entry-desk-pointers--${tip.id ?? 'tip'}`}
      data-testid="entry-desk-pointers"
      data-tour-step={tip.id ?? ''}
      role="status"
    >
      <div className="entry-desk-pointer is-active">
        {eyebrow ? <span className="entry-desk-pointer-eyebrow">{eyebrow}</span> : null}
        {tip.label ? <span className="entry-desk-pointer-label">{tip.label}</span> : null}
        <span className="entry-desk-pointer-text">{tip.text}</span>
        {progress && progress.total > 1 ? (
          <div className="entry-desk-pointer-progress" aria-hidden="true">
            {Array.from({ length: progress.total }, (_, itemIndex) => (
              <span
                key={itemIndex}
                className={`entry-desk-pointer-dot${itemIndex === progress.index ? ' is-active' : ''}${
                  itemIndex < progress.index ? ' is-done' : ''
                }`}
              />
            ))}
          </div>
        ) : null}
        <div className="entry-desk-pointer-actions">
          {onAdvance ? (
            <button type="button" className="entry-desk-pointer-next" onClick={onAdvance}>
              {isLast ? doneLabel : nextLabel}
            </button>
          ) : null}
          {onDismiss ? (
            <button type="button" className="entry-desk-pointer-skip" onClick={onDismiss}>
              {skipLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
