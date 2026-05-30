import { createContext, useContext } from 'react';

/**
 * Hover plumbing for metaphor3d items.
 *
 * The tricky constraint: a hover must NOT re-render the 3D scene (that would
 * re-run every layout/useMemo on each pointer move). So instead of React state,
 * the hovered item lives in a tiny external store. In-canvas pointer handlers
 * call `store.set(...)`; only the HTML tooltip (outside the Canvas) subscribes
 * via useSyncExternalStore and re-renders. The Canvas never sees the update.
 *
 * The store is handed to in-canvas children through context (so we don't have to
 * thread a callback through MetaphorScene and all five per-metaphor scenes).
 */

/** @type {import('react').Context<ReturnType<typeof createMetaphorHoverStore> | null>} */
export const MetaphorHoverContext = createContext(null);

export function useMetaphorHover() {
  return useContext(MetaphorHoverContext);
}

/** Minimal subscribe/get/set store holding `{ item, metaphor, x, y } | null`. */
export function createMetaphorHoverStore() {
  let state = null;
  const listeners = new Set();
  return {
    get: () => state,
    set: (next) => {
      state = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
