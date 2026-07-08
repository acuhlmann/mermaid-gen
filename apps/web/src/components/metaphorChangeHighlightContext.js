import { createContext, useContext } from 'react';

/** @typedef {'added' | 'modified'} MetaphorChangeHighlightCategory */

/** @type {import('react').Context<{ added: Set<string>, modified: Set<string> } | null>} */
export const MetaphorChangeHighlightContext = createContext(null);

/**
 * @param {string | null | undefined} itemId
 * @returns {MetaphorChangeHighlightCategory | null}
 */
export function useMetaphorChangeHighlight(itemId) {
  const store = useContext(MetaphorChangeHighlightContext);
  if (!store || !itemId) return null;
  if (store.added.has(itemId)) return 'added';
  if (store.modified.has(itemId)) return 'modified';
  return null;
}
