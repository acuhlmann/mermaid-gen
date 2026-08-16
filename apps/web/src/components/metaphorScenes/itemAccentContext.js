/**
 * Whether the item currently being rendered is the scene's accented one.
 *
 * `HoverableItem` publishes it, and everything drawn for that item can read it
 * without the scene having to thread a prop down — which matters because the
 * accent has to reach `ItemLabel` in fourteen different scene modules, each of
 * which builds its labels differently.
 */
import { createContext, useContext } from 'react';

export const ItemAccentContext = createContext(false);

export function useItemAccent() {
  return useContext(ItemAccentContext);
}
