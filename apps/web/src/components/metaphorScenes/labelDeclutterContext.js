/**
 * Context handle for the label declutter store. Split from the component file
 * so `ItemLabel` (chrome) and `MetaphorRenderer` (owner) share one identity
 * without a cycle, and so a scene mounted standalone in a test gets `null` and
 * simply keeps every label.
 */
import { createContext, useContext } from 'react';

export const LabelDeclutterContext = createContext(null);

export function useLabelDeclutter() {
  return useContext(LabelDeclutterContext);
}
