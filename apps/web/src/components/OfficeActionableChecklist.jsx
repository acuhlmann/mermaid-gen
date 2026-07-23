import { useCallback, useEffect, useState } from 'react';
import { officeChromeCopy, officeMeetingCopy } from '../utils/officeCast.js';

/**
 * Checkbox + apply controls for office action items (meeting minutes, etc.).
 * Mirrors the critique actionable pattern with office "Do selected" / "Do it all" labels.
 */
export default function OfficeActionableChecklist({
  headingText,
  items,
  busy,
  onApplyAll,
  onApplySelected
}) {
  const chrome = officeChromeCopy();
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
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <section
      className="insights-actionable-block insights-prose-section insights-tone-actionable office-actionable-block"
      aria-label={headingText || officeMeetingCopy().actionItemsLabel}
    >
      {headingText ? <h3 className="insights-actionable-title">{headingText}</h3> : null}
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
          className="insights-actionable-btn insights-actionable-btn-selected office-do-it"
          disabled={busy || !anySelected}
          onClick={() => onApplySelected?.(selected)}
        >
          {chrome.doSelected}
        </button>
        <button
          type="button"
          className="insights-actionable-btn insights-actionable-btn-all office-do-it"
          disabled={busy}
          onClick={() => onApplyAll?.()}
        >
          {chrome.doItAll}
        </button>
      </div>
    </section>
  );
}
