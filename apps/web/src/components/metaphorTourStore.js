/**
 * Guided-read state for a metaphor3d scene.
 *
 * Same external-store shape as hover (metaphorHover.js) and selection
 * (metaphorSelection.js), and for the same reason: three separate consumers
 * need this — the panel outside the canvas, the camera inside it, and the
 * selection ring — and if it lived in `MetaphorRenderer`'s React state then
 * pressing Next would reconcile the entire R3F tree, re-running every scene's
 * layout memo, on every step of a five-step read.
 *
 * The state is `{ beats, index }` with `index === -1` meaning "not touring".
 * Beats come from `utils/metaphorTour.js`; this file owns only the cursor.
 */

/** @typedef {import('../utils/metaphorTour.js').buildMetaphorTour} BuildTour */

export function createMetaphorTourStore() {
  let state = { beats: [], index: -1 };
  const listeners = new Set();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const commit = (next) => {
    if (next.beats === state.beats && next.index === state.index) return;
    state = next;
    notify();
  };

  return {
    get: () => state,
    /**
     * Begin a read. A tour with no beats is not started at all — an empty
     * guided read is a panel that says nothing and cannot be advanced, which
     * reads as a broken button.
     */
    start: (beats) => {
      const list = Array.isArray(beats) ? beats : [];
      if (list.length === 0) return;
      commit({ beats: list, index: 0 });
    },
    stop: () => {
      if (state.index === -1 && state.beats.length === 0) return;
      commit({ beats: [], index: -1 });
    },
    /** Advance; past the last beat the read ENDS rather than wrapping — a tour
     *  that loops has no exit and the viewer cannot tell they finished it. */
    next: () => {
      if (state.index < 0) return;
      const next = state.index + 1;
      if (next >= state.beats.length) commit({ beats: [], index: -1 });
      else commit({ beats: state.beats, index: next });
    },
    prev: () => {
      if (state.index <= 0) return;
      commit({ beats: state.beats, index: state.index - 1 });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

/** The beat currently being read, or null when no read is running. */
export function currentBeat(state) {
  if (!state || state.index < 0) return null;
  return state.beats[state.index] ?? null;
}
