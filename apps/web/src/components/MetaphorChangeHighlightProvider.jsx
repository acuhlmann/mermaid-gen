import { useMemo } from 'react';
import { MetaphorChangeHighlightContext } from './metaphorChangeHighlightContext.js';

/**
 * @param {{ addedIds?: string[], modifiedIds?: string[] } | null | undefined} highlight
 */
export default function MetaphorChangeHighlightProvider({ highlight, children }) {
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
