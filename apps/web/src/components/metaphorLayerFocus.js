import { createContext, useContext, useSyncExternalStore } from 'react';

/**
 * Which layer of a fused composite the viewer is reading right now.
 *
 * A fused world draws three or four spatial grammars into one landscape —
 * islands for domains, towers for services, a river for a flow — and the layer
 * key names them. Naming is where it stopped: nothing tied the row "Services ·
 * City · 3" to the three towers among a dozen shapes, so the panel was a legend
 * for a map with no key, and the denser the composite the less it explained.
 *
 * Pressing a row answers that by removing everything else: the other layers
 * recede into the scene's own haze (see `recedeTheme`) and drop their labels,
 * leaving the pressed layer standing in colour. Pressing it again brings the
 * world back.
 *
 * Three rules it holds to:
 *
 * 1. **Recede, never hide.** The other layers stay exactly where they are, in
 *    shape and position — the fused world's whole claim is that these grammars
 *    share one ground, and deleting two of them would show a different world
 *    rather than the same one read one layer at a time.
 * 2. **Recede by colour, never by opacity.** Three sorts transparent objects by
 *    centroid distance, so fading a dozen bodies re-opens exactly the sorting
 *    trap the iceberg's submerged blocks are opaque to avoid. A desaturated
 *    body lerped toward the horizon is aerial perspective: correct in the depth
 *    pass, and better looking than a fade.
 * 3. **It never re-plans the world.** Focus is React state on the scene, not an
 *    input to `planFusedCompositeWorld`, so the layout, the camera fit and the
 *    reserved safe area are all untouched by pressing a row. What moves is
 *    colour and labels, which is what "read this layer" should cost.
 *
 * The store shape mirrors metaphorSelection.js — an external store, so the
 * layer key can subscribe without the panel and the scene re-rendering each
 * other.
 */

/** @type {import('react').Context<ReturnType<typeof createMetaphorLayerFocusStore> | null>} */
export const MetaphorLayerFocusContext = createContext(null);

export function useMetaphorLayerFocus() {
  return useContext(MetaphorLayerFocusContext);
}

/** Stable no-op store shape for a subscriber mounted without a provider. */
const NO_FOCUS_SUBSCRIBE = () => () => {};
const NO_FOCUS_GET = () => null;

/**
 * The focused layer id, subscribed. A scene mounted without a provider — a
 * streaming preview, a standalone mount — reads null forever rather than
 * needing a null check at every use site.
 */
export function useMetaphorLayerFocusId(store = null) {
  const provided = useContext(MetaphorLayerFocusContext);
  const resolved = store ?? provided;
  return useSyncExternalStore(
    resolved?.subscribe ?? NO_FOCUS_SUBSCRIBE,
    resolved?.get ?? NO_FOCUS_GET,
    resolved?.get ?? NO_FOCUS_GET
  );
}

/** Minimal subscribe/get/set store holding the focused layer id, or null. */
export function createMetaphorLayerFocusStore() {
  let state = null;
  const listeners = new Set();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const normalize = (value) => (typeof value === 'string' && value ? value : null);
  return {
    get: () => state,
    set: (next) => {
      const value = normalize(next);
      if (state === value) return;
      state = value;
      notify();
    },
    /**
     * Pressing the focused row again clears the focus. Without this the only
     * way back to the whole world is a second control, and a viewer who presses
     * the same row twice expects the second press to undo the first — the same
     * reasoning as the selection store's toggle.
     */
    toggle: (next) => {
      const value = normalize(next);
      state = state === value ? null : value;
      notify();
    },
    clear: () => {
      if (state === null) return;
      state = null;
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
