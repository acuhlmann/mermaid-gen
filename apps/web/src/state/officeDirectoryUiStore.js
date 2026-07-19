/**
 * Tiny UI signal so desk verbs / entry CTAs can open the Meet the Office
 * directory from anywhere — and so App / OfficeLayer can pause ambience while
 * the orientation (or roster) is on screen.
 *
 * OfficeDirectory owns open/seen state; this store:
 * - bumps a nonce that means "please open now" (`requestOfficeDirectoryOpen`)
 * - mirrors whether the directory is currently open (`setOfficeDirectoryOpen`)
 */

let state = { openNonce: 0, mode: 'roster', open: false };
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
    ...state,
    openNonce: state.openNonce + 1,
    mode: mode === 'tour' ? 'tour' : 'roster'
  };
  emit();
}

/**
 * Mirror the directory's live open state so other surfaces can pause
 * (ambience, welcome email/IM, advisor) while Meet the Office is up.
 * @param {boolean} open
 */
export function setOfficeDirectoryOpen(open) {
  const next = Boolean(open);
  if (state.open === next) return;
  state = { ...state, open: next };
  emit();
}

/** Test helper — reset without touching localStorage. */
export function _resetOfficeDirectoryUiForTests() {
  state = { openNonce: 0, mode: 'roster', open: false };
  emit();
}
