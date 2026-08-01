/**
 * Tiny UI signal so the presence strip (and any other desk chrome outside
 * `OfficeLayer`) can open Slop Chat™ without prop-drilling through the shell.
 *
 * Mirrors `officeDirectoryUiStore`: a nonce means "please open now", optional
 * `colleagueId` focuses that thread. `OfficeLayer` owns the messenger window
 * and is the only consumer that acts on the nonce.
 */

/** @type {{ openNonce: number, colleagueId: string | null }} */
let state = { openNonce: 0, colleagueId: null };
const listeners = new Set();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeOfficeMessengerUi(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOfficeMessengerUi() {
  return state;
}

/**
 * @param {string | null | undefined} [colleagueId]
 *   When set, open on that colleague's thread; otherwise the last / empty view.
 */
export function requestOfficeMessengerOpen(colleagueId) {
  state = {
    openNonce: state.openNonce + 1,
    colleagueId: typeof colleagueId === 'string' && colleagueId ? colleagueId : null
  };
  emit();
}

/** Test helper — reset without touching localStorage. */
export function _resetOfficeMessengerUiForTests() {
  state = { openNonce: 0, colleagueId: null };
  emit();
}
