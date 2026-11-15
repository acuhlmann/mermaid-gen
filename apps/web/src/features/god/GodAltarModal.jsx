import { useEffect, useSyncExternalStore } from 'react';
import GodAltarPanel from './GodAltarPanel.jsx';
import { GOD_ALTAR_COPY as COPY } from './godAltarCopy.js';
import { closeGodAltar, getGodAltarOpen, subscribeGodAltar } from './godAltarStore.js';
import { buildGodWindowUrl } from './godRoute.js';

export function GodAltarModal({
  open,
  onClose,
  diagramSource,
  contentType,
  userName,
  modelProfile
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="god-altar-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={COPY.title}
      data-testid="god-altar-modal"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="god-altar-modal-frame">
        <div className="god-altar-modal-topbar">
          <a
            href={buildGodWindowUrl({ tab: 'altar' })}
            className="god-altar-secondary-btn"
            data-testid="god-altar-ascend-link"
          >
            {COPY.ascendLink} →
          </a>
          <div className="god-altar-modal-topbar-actions">
            <button
              type="button"
              className="god-altar-secondary-btn"
              data-testid="god-altar-close"
              aria-label={COPY.closeAria}
              onClick={onClose}
            >
              × {COPY.closeAria}
            </button>
          </div>
        </div>
        <GodAltarPanel
          diagramSource={diagramSource}
          contentType={contentType}
          userName={userName}
          modelProfile={modelProfile}
        />
      </div>
    </div>
  );
}

/** Subscribes to `godAltarStore` so Studio and Office can summon the Altar from anywhere. */
export default function GodAltarHost({ diagramSource, contentType, userName, modelProfile }) {
  const open = useSyncExternalStore(subscribeGodAltar, getGodAltarOpen, getGodAltarOpen);
  return (
    <GodAltarModal
      open={open}
      onClose={closeGodAltar}
      diagramSource={diagramSource}
      contentType={contentType}
      userName={userName}
      modelProfile={modelProfile}
    />
  );
}
