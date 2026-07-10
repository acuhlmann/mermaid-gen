import { useEffect } from 'react';

const ENTRIES = [
  { keys: ['R'], label: 'Refine — polish labels & structure' },
  { keys: ['I'], label: 'Innovate — bolder redesign' },
  { keys: ['M'], label: 'Go Mad — chaos transformation' },
  { keys: ['X'], label: 'Exec — boil it down' },
  { keys: ['C'], label: 'Critique — structured review' },
  { keys: ['E'], label: 'Explain — what does this mean?' },
  { keys: ['?'], label: 'Toggle this help' },
  { keys: ['Esc'], label: 'Close menus / dialogs' },
  { keys: ['↑', '↓', '←', '→'], label: 'Move focus across radial actions' },
  { keys: ['Enter', 'Space'], label: 'Activate focused action' }
];

export default function HotkeyOverlay({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="hotkey-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hotkey-overlay-title"
      onClick={onClose}
      data-testid="hotkey-overlay"
    >
      <div className="hotkey-overlay-card" onClick={(event) => event.stopPropagation()}>
        <div className="hotkey-overlay-header">
          <h2 id="hotkey-overlay-title" className="hotkey-overlay-title">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            className="hotkey-overlay-close"
            aria-label="Close keyboard shortcuts"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p className="hotkey-overlay-hint">
          Single-letter hotkeys fire when a diagram element is selected. Hotkeys are ignored while
          typing.
        </p>
        <ul className="hotkey-overlay-list">
          {ENTRIES.map((entry) => (
            <li key={entry.label} className="hotkey-overlay-row">
              <span className="hotkey-overlay-keys">
                {entry.keys.map((k, i) => (
                  <kbd key={`${entry.label}-${k}-${i}`} className="hotkey-overlay-key">
                    {k}
                  </kbd>
                ))}
              </span>
              <span className="hotkey-overlay-label">{entry.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
