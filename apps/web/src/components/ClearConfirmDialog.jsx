import { useEffect, useState } from 'react';
import { CONTROLS_EN } from '../i18n/locales/controls.en.js';
import { overlayLayerStyle, useOverlayLayer } from '../hooks/useOverlayLayer.js';

const DEFAULT_COPY = CONTROLS_EN.clearDialog;

/**
 * Demolition confirmation. App owns lifecycle via the `key` prop so this
 * component remounts each time it opens — that lets the lazy `useState`
 * initializer roll a fresh impure random copy without touching render.
 */
export default function ClearConfirmDialog({ open, onConfirm, onCancel, copy = DEFAULT_COPY }) {
  const modalZIndex = useOverlayLayer('clear-confirm', open, 'modal');
  const [line] = useState(() => {
    const prompts = copy?.prompts ?? [];
    return prompts[Math.floor(Math.random() * prompts.length)] ?? { title: '', body: '' };
  });

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') onCancel?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) onCancel?.();
  }

  return (
    <div
      className="clear-confirm-overlay"
      style={overlayLayerStyle(modalZIndex)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-confirm-title"
      onPointerDown={handleBackdropClick}
    >
      <div className="clear-confirm-card">
        <h2 id="clear-confirm-title" className="clear-confirm-title">
          {line.title}
        </h2>
        <p className="clear-confirm-body">{line.body}</p>
        <div className="clear-confirm-actions">
          <button
            type="button"
            className="overlay-button"
            onClick={onCancel}
            aria-label={copy.saveAria}
          >
            {copy.save}
          </button>
          <button
            type="button"
            className="overlay-button clear-confirm-demolish"
            onClick={onConfirm}
            aria-label={copy.demolishAria}
          >
            <span aria-hidden="true">💣</span>
            <span>{copy.demolish}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
