import { useCallback, useRef } from 'react';
import { clearDeskSlotElement, setDeskSlotElement } from '../state/deskSlotStore.js';

/** Registers the bottom-row desk anchor for OfficeLayer's desk comms portal. */
export function useDeskSlotRef() {
  const held = useRef(null);
  return useCallback((el) => {
    if (held.current) clearDeskSlotElement(held.current);
    held.current = el;
    if (el) setDeskSlotElement(el);
  }, []);
}
