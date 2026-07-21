import { useEffect } from 'react';

/**
 * First-run coach tips that walk newcomers through the real desk chrome —
 * one control at a time — without duplicating the Deliverable format strip.
 * Auto-advances with the tour step timer; Next / Skip dismiss or advance.
 */
export default function EntryDeskPointers({
  pointers,
  activeId = null,
  onDismiss,
  onAdvance,
  nextLabel = 'Next',
  skipLabel = 'Skip'
}) {
  const items = Array.isArray(pointers) ? pointers.filter((p) => p && p.text) : [];
  const tip = activeId ? items.find((p) => p.id === activeId) : null;

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
        {tip.label ? <span className="entry-desk-pointer-label">{tip.label}</span> : null}
        <span className="entry-desk-pointer-text">{tip.text}</span>
        <div className="entry-desk-pointer-actions">
          {onAdvance ? (
            <button type="button" className="entry-desk-pointer-next" onClick={onAdvance}>
              {nextLabel}
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
