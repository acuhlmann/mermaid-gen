/**
 * Tiny UI signal so desk verbs / entry CTAs can open the Meet the Office
 * directory from anywhere. OfficeDirectory owns open/seen state; this store
 * only bumps a nonce that means "please open now".
 */

let state = { openNonce: 0, mode: 'roster' };
const listeners = new Set();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeOfficeDirectoryUi(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOfficeDirectoryUi() {
  return state;
}

/**
 * @param {'roster' | 'tour'} [mode='roster']
 *   roster = full cast with ▶ intros; tour = replay the game-style orientation.
 */
export function requestOfficeDirectoryOpen(mode = 'roster') {
  state = {
    openNonce: state.openNonce + 1,
    mode: mode === 'tour' ? 'tour' : 'roster'
  };
  emit();
}

/** Test helper — reset without touching localStorage. */
export function _resetOfficeDirectoryUiForTests() {
  state = { openNonce: 0, mode: 'roster' };
  emit();
}
