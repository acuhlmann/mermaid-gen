import { useEffect } from 'react';

/**
 * Brief first-run callouts that point newcomers at the real desk chrome —
 * Work order, Your desk menu, and Deliverable format — without duplicating
 * the menu listing. Auto-dismisses after a short beat or on first interaction.
 */
export default function EntryDeskPointers({ pointers, onDismiss, autoDismissMs = 16_000 }) {
  const items = Array.isArray(pointers) ? pointers.filter((p) => p && p.text) : [];

  useEffect(() => {
    if (!onDismiss || autoDismissMs <= 0 || items.length === 0) return undefined;
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [onDismiss, autoDismissMs, items.length]);

  useEffect(() => {
    if (!onDismiss || items.length === 0) return undefined;
    const dismiss = () => onDismiss();
    document.addEventListener('pointerdown', dismiss, { once: true });
    document.addEventListener('keydown', dismiss, { once: true });
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', dismiss);
    };
  }, [onDismiss, items.length]);

  if (items.length === 0) return null;

  return (
    <div className="entry-desk-pointers" data-testid="entry-desk-pointers" role="status">
      {items.map((pointer) => (
        <div
          key={pointer.id ?? pointer.text}
          className={`entry-desk-pointer${pointer.id ? ` entry-desk-pointer--${pointer.id}` : ''}`}
        >
          {pointer.label ? (
            <span className="entry-desk-pointer-label">{pointer.label}</span>
          ) : null}
          <span className="entry-desk-pointer-text">{pointer.text}</span>
        </div>
      ))}
    </div>
  );
}
