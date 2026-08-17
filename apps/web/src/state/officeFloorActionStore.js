/**
 * Lets desk chrome on the floor fire verbs `OfficeFloorView` already owns,
 * without prop-drilling through `OfficeLayer` (same pattern as
 * `officeMessengerUiStore`).
 */

/** @typedef {{ type: 'floorTalk', colleagueId: string, mark: { x: number, y: number } } | { type: 'floorSceneJoin', kind: 'coffee' | 'battle' }} FloorActionRequest */

/** @type {{ actionNonce: number, request: FloorActionRequest | null }} */
let state = { actionNonce: 0, request: null };

const listeners = new Set();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeOfficeFloorAction(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOfficeFloorAction() {
  return state;
}

/**
 * @param {string} colleagueId
 * @param {{ x: number, y: number }} mark
 */
export function requestFloorShopJoin(colleagueId, mark) {
  if (!colleagueId || !mark) return;
  state = {
    actionNonce: state.actionNonce + 1,
    request: { type: 'floorTalk', colleagueId, mark }
  };
  emit();
}

/**
 * @param {'coffee' | 'battle'} kind
 */
export function requestFloorSceneJoin(kind) {
  if (kind !== 'coffee' && kind !== 'battle') return;
  state = {
    actionNonce: state.actionNonce + 1,
    request: { type: 'floorSceneJoin', kind }
  };
  emit();
}

/** @internal Reset between tests. */
export function _resetOfficeFloorActionForTests() {
  state = { actionNonce: 0, request: null };
  listeners.clear();
}
