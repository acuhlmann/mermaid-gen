import { useEffect } from 'react';
import { CONTROLS_EN } from '../i18n/locales/controls.en.js';
import {
  overlayFocusHandlers,
  overlayLayerStyle,
  useOverlayLayer
} from '../hooks/useOverlayLayer.js';

const DEFAULT_COPY = CONTROLS_EN.hotkeys;

function buildEntries(copy) {
  return [
    { keys: ['R'], label: copy.refine },
    { keys: ['I'], label: copy.innovate },
    { keys: ['M'], label: copy.goMad },
    { keys: ['B'], label: copy.barker },
    { keys: ['C'], label: copy.critique },
    { keys: ['E'], label: copy.explain },
    { keys: ['?'], label: copy.toggleHelp },
    { keys: ['Esc'], label: copy.esc },
    { keys: ['↑', '↓', '←', '→'], label: copy.arrows },
    { keys: ['Enter', 'Space'], label: copy.activate }
  ];
}

export default function HotkeyOverlay({ open, onClose, copy = DEFAULT_COPY }) {
  const modalZIndex = useOverlayLayer('hotkey-overlay', open, 'modal');
  const entries = buildEntries(copy);

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
      style={overlayLayerStyle(modalZIndex)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="hotkey-overlay-title"
      {...overlayFocusHandlers('hotkey-overlay', open)}
      onClick={onClose}
      data-testid="hotkey-overlay"
    >
      <div className="hotkey-overlay-card" onClick={(event) => event.stopPropagation()}>
        <div className="hotkey-overlay-header">
          <h2 id="hotkey-overlay-title" className="hotkey-overlay-title">
            {copy.title}
          </h2>
          <button
            type="button"
            className="hotkey-overlay-close"
            aria-label={copy.close}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p className="hotkey-overlay-hint">{copy.hint}</p>
        <ul className="hotkey-overlay-list">
          {entries.map((entry) => (
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
