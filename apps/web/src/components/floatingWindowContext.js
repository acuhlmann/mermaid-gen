import { createContext, useContext } from 'react';

/**
 * What an office window tells the chrome rendered inside it: which overlay it
 * is, how it is placed, and the gesture handlers for its title bar.
 *
 * Its own file so `FloatingWindow.jsx` exports components only (Fast Refresh),
 * and so `FloatingWindowChrome.jsx` can read the window id without importing a
 * component from a component.
 *
 * @typedef {{
 *   id: string,
 *   presentation: import('../hooks/useWindowPresentation.js').WindowPresentation,
 *   manageable: boolean,
 *   copy: Record<string, any>,
 *   dragHandleProps: Record<string, (event: PointerEvent) => void>,
 *   snap: 'peek' | 'half' | 'full' | null,
 *   cycleSnap: () => void,
 *   focusWindow: () => void
 * }} FloatingWindowContextValue
 */

/** @type {import('react').Context<FloatingWindowContextValue | null>} */
export const FloatingWindowContext = createContext(null);

/** @returns {FloatingWindowContextValue | null} */
export function useFloatingWindow() {
  return useContext(FloatingWindowContext);
}
