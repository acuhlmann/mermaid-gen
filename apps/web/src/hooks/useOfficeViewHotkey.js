import { useEffect } from 'react';
import { toggleOfficeViewMode } from '../state/officeViewModeStore.js';

function isTypingTarget(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Global toggle for desktop screen mode ↔ isometric floor (ADR-0011).
 * Deliberately Shift+O — single-letter keys belong to the radial menu when a
 * diagram part is selected (`useDiagramHotkeys`).
 *
 * @param {{ enabled?: boolean }} [options] pass `enabled: false` during boot
 */
export function useOfficeViewHotkey({ enabled = true } = {}) {
  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event) => {
      if (event.defaultPrevented) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (!event.shiftKey) return;
      if ((event.key ?? '').toLowerCase() !== 'o') return;
      if (isTypingTarget(event.target)) return;

      event.preventDefault();
      toggleOfficeViewMode();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}

/** Shown in desk chrome and the hotkey overlay. */
export const OFFICE_VIEW_HOTKEY_LABEL = 'Shift+O';

export default useOfficeViewHotkey;
