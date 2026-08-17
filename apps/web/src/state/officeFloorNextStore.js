/**
 * Floor-local obligations the taskbar presence strip may surface while you are
 * standing (ADR-0011 — renderer #2 publishes, shell chrome reads).
 *
 * Written by `OfficeFloorView` from derivations it already owns; cleared on
 * unmount. Produces nothing on its own — it is a read-only projection window.
 */

/** @typedef {{ colleagueId: string, partnerId: string, mark: { x: number, y: number } }} FloorShopJoinNext */

/** @typedef {{ colleagueId: string, participants: string[], kind: 'coffee' | 'battle' }} FloorSceneJoinNext */

/** @type {{ shopJoin: FloorShopJoinNext | null, sceneJoin: FloorSceneJoinNext | null }} */
let state = { shopJoin: null, sceneJoin: null };

const listeners = new Set();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeOfficeFloorNext(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOfficeFloorNext() {
  return state;
}

/**
 * @param {{ shopJoin?: FloorShopJoinNext | null, sceneJoin?: FloorSceneJoinNext | null }} next
 */
export function setOfficeFloorNext({ shopJoin = null, sceneJoin = null } = {}) {
  const shopSame =
    state.shopJoin?.colleagueId === shopJoin?.colleagueId &&
    state.shopJoin?.partnerId === shopJoin?.partnerId &&
    state.shopJoin?.mark?.x === shopJoin?.mark?.x &&
    state.shopJoin?.mark?.y === shopJoin?.mark?.y;
  const sceneSame =
    state.sceneJoin?.colleagueId === sceneJoin?.colleagueId &&
    state.sceneJoin?.kind === sceneJoin?.kind &&
    JSON.stringify(state.sceneJoin?.participants ?? []) ===
      JSON.stringify(sceneJoin?.participants ?? []);
  if (shopSame && sceneSame) return;
  state = { shopJoin: shopJoin ?? null, sceneJoin: sceneJoin ?? null };
  emit();
}

export function clearOfficeFloorNext() {
  if (!state.shopJoin && !state.sceneJoin) return;
  state = { shopJoin: null, sceneJoin: null };
  emit();
}

/** @internal Reset between tests. */
export function _resetOfficeFloorNextForTests() {
  state = { shopJoin: null, sceneJoin: null };
  listeners.clear();
}
