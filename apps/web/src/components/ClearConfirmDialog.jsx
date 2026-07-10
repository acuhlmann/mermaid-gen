import { useEffect, useState } from 'react';

const PROMPTS = [
  {
    title: '🚧 Demolition permit requested',
    body: 'Sure you want to bulldoze this masterpiece? The slop will live on only in our memories (and probably in three other Confluence pages).'
  },
  {
    title: '🏗️ Wrecking ball on standby',
    body: 'Are you sure? Once we tear this down, the stakeholders are going to want a post-mortem and at least one re-org.'
  },
  {
    title: '⛏️ Ready to grind it to gravel?',
    body: 'Demolishing the diagram resets everything — including our streak of brave architectural decisions.'
  },
  {
    title: '💣 Controlled demolition?',
    body: 'Architecture is forever, except when you click the button. Last chance to keep the slop.'
  }
];

/**
 * Demolition confirmation. App owns lifecycle via the `key` prop so this
 * component remounts each time it opens — that lets the lazy `useState`
 * initializer roll a fresh impure random copy without touching render.
 */
export default function ClearConfirmDialog({ open, onConfirm, onCancel }) {
  const [copy] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);

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
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-confirm-title"
      onPointerDown={handleBackdropClick}
    >
      <div className="clear-confirm-card">
        <h2 id="clear-confirm-title" className="clear-confirm-title">
          {copy.title}
        </h2>
        <p className="clear-confirm-body">{copy.body}</p>
        <div className="clear-confirm-actions">
          <button
            type="button"
            className="overlay-button"
            onClick={onCancel}
            aria-label="Save the slop"
          >
            Save the slop
          </button>
          <button
            type="button"
            className="overlay-button clear-confirm-demolish"
            onClick={onConfirm}
            aria-label="Demolish it"
          >
            <span aria-hidden="true">💣</span>
            <span>Demolish it!</span>
          </button>
        </div>
      </div>
    </div>
  );
}
