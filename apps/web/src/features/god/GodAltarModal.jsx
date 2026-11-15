import { useEffect, useRef, useSyncExternalStore } from 'react';
import GodAltarPanel from './GodAltarPanel.jsx';
import { GOD_ALTAR_COPY as COPY } from './godAltarCopy.js';
import { closeGodAltar, getGodAltarOpen, subscribeGodAltar } from './godAltarStore.js';
import { buildGodWindowUrl } from './godRoute.js';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"]):not(:disabled)'
].join(', ');

function getFocusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
    (el) => el.getAttribute('aria-hidden') !== 'true' && !el.closest('[hidden]')
  );
}

function handleTabTrap(event, dialogEl) {
  if (!dialogEl) return;
  const focusables = getFocusableElements(dialogEl);
  if (focusables.length === 0) {
    event.preventDefault();
    dialogEl.focus({ preventScroll: true });
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (event.shiftKey) {
    if (active === first || !dialogEl.contains(active)) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    }
    return;
  }
  if (active === last || !dialogEl.contains(active)) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
}

export function GodAltarModal({
  open,
  onClose,
  diagramSource,
  contentType,
  userName,
  modelProfile
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialogEl = dialogRef.current;

    const initialTarget =
      dialogEl?.querySelector('#god-altar-input') ?? getFocusableElements(dialogEl)[0] ?? dialogEl;
    initialTarget?.focus?.({ preventScroll: true });

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key === 'Tab') {
        handleTabTrap(event, dialogRef.current);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
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
