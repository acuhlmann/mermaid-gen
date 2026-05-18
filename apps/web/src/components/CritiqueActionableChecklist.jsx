import { useCallback, useEffect, useState } from 'react';

/**
 * Native HTML fallback for critique actionable checklists when A2UI cannot mount
 * (partial streams, processor failures, or constrained mobile WebViews).
 */
export default function CritiqueActionableChecklist({
  headingText,
  items,
  busy,
  onFixAll,
  onFixSelected
}) {
  const [selected, setSelected] = useState(() => items.map(() => false));

  useEffect(() => {
    setSelected(items.map(() => false));
  }, [items]);

  const toggleAt = useCallback((index) => {
    setSelected((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  const anySelected = selected.some(Boolean);

  return (
    <section
      className="insights-actionable-block insights-prose-section insights-tone-actionable"
      aria-label="Actionable improvements"
    >
      <h3 className="insights-actionable-title">{headingText || 'Actionable improvements'}</h3>
      <ul className="insights-actionable-list">
        {items.map((label, i) => (
          <li key={`${i}-${label.slice(0, 24)}`}>
            <label className="insights-actionable-label">
              <input
                type="checkbox"
                className="insights-actionable-checkbox"
                checked={Boolean(selected[i])}
                disabled={busy}
                onChange={() => toggleAt(i)}
              />
              <span className="insights-actionable-text">{label}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="insights-actionable-actions">
        <button
          type="button"
          className="insights-actionable-btn insights-actionable-btn-selected"
          disabled={busy || !anySelected}
          onClick={() => onFixSelected?.(selected)}
        >
          Fix selected
        </button>
        <button
          type="button"
          className="insights-actionable-btn insights-actionable-btn-all"
          disabled={busy}
          onClick={() => onFixAll?.()}
        >
          Fix all
        </button>
      </div>
    </section>
  );
}
