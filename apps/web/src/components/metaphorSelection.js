import { createContext, useContext } from 'react';

/**
 * Tap-to-inspect plumbing for metaphor3d items.
 *
 * Hover (metaphorHover.js) is a *mouse* affordance: the tooltip follows the
 * pointer and dies the moment the pointer leaves. On a touch screen that is
 * unusable twice over — a tap fires pointerover/pointerout back to back so the
 * tooltip flashes, and where it lands is under the finger. So a phone had no
 * way at all to read an item's encoded metrics, which is most of what makes a
 * scene mean something.
 *
 * Selection is the touch answer: an explicit, sticky pick that survives the
 * finger lifting and renders in a panel anchored to the canvas rather than to
 * the pointer. It shares the external-store shape with hover for the same
 * reason — a selection must not re-render the 3D scene, so the panel and the
 * in-canvas marker subscribe individually via useSyncExternalStore.
 *
 * State shape: `{ item, metaphor, layerLabel } | null`. `metaphor` is the
 * per-item kind (in a fused composite that is the *layer's* kind, not
 * 'composite'), which is what picks the metric vocabulary in
 * metaphorLegendAxes.js.
 */

/** @type {import('react').Context<ReturnType<typeof createMetaphorSelectionStore> | null>} */
export const MetaphorSelectionContext = createContext(null);

export function useMetaphorSelection() {
  return useContext(MetaphorSelectionContext);
}

/**
 * Movement budget, in CSS pixels, between pointerdown and pointerup for the
 * gesture to still count as a tap. Anything further is an orbit drag that
 * happened to end over an item — selecting there would make the scene
 * impossible to rotate on a phone.
 */
export const TAP_SLOP_PX = 8;

/**
 * Down/up tap recogniser, kept out of the component so it can be tested without
 * a WebGL context.
 *
 * R3F's own `onClick` is the wrong primitive here: the canvas is a single DOM
 * element, so an orbit drag that starts and ends inside it still produces a DOM
 * click, and the scene would select whatever the finger happened to be over
 * when the rotation stopped — on a phone, where every rotation is a finger
 * drag, that makes the scene unusable.
 *
 * @returns {{ start: (event: PointerEvent) => void, end: (event: PointerEvent) => boolean }}
 */
export function createTapGesture(slop = TAP_SLOP_PX) {
  let origin = null;
  return {
    start: (event) => {
      origin = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    },
    end: (event) => {
      const start = origin;
      origin = null;
      if (!start || start.pointerId !== event.pointerId) return false;
      return Math.hypot(event.clientX - start.x, event.clientY - start.y) <= slop;
    }
  };
}

/** Minimal subscribe/get/set store holding the pinned item, or null. */
export function createMetaphorSelectionStore() {
  let state = null;
  const listeners = new Set();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    get: () => state,
    set: (next) => {
      if (state === next) return;
      state = next ?? null;
      notify();
    },
    clear: () => {
      if (state === null) return;
      state = null;
      notify();
    },
    /**
     * Tapping the selected item again dismisses it. Without this the only way
     * off a selection on a phone is the close button, and a viewer who taps
     * the same island twice expects the second tap to undo the first.
     */
    toggle: (next) => {
      const currentId = state?.item?.id;
      const nextId = next?.item?.id;
      const same = Boolean(currentId) && currentId === nextId;
      state = same ? null : (next ?? null);
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
