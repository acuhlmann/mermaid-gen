import { createContext, useContext, useMemo } from 'react';

/** @typedef {'added' | 'modified'} MetaphorChangeHighlightCategory */

/** @type {import('react').Context<{ added: Set<string>, modified: Set<string> } | null>} */
export const MetaphorChangeHighlightContext = createContext(null);

/**
 * @param {{ addedIds?: string[], modifiedIds?: string[] } | null | undefined} highlight
 */
export function MetaphorChangeHighlightProvider({ highlight, children }) {
  const value = useMemo(() => {
    if (!highlight) return null;
    const added = new Set(highlight.addedIds ?? []);
    const modified = new Set(highlight.modifiedIds ?? []);
    if (added.size === 0 && modified.size === 0) return null;
    return { added, modified };
  }, [highlight]);

  return (
    <MetaphorChangeHighlightContext.Provider value={value}>
      {children}
    </MetaphorChangeHighlightContext.Provider>
  );
}

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
